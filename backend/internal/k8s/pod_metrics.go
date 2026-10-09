// SPDX-License-Identifier: Apache-2.0

package k8s

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"k8s.io/apimachinery/pkg/api/resource"
)

type ContainerMetrics struct {
	CPUMillis int64
	MemBytes  int64
}

const podMetricsTTL = 10 * time.Second

// GetAllPodMetrics returns cached cluster-wide pod metrics, refreshing from
// the Metrics Server at most once every 10 seconds.
func (c *Client) GetAllPodMetrics(ctx context.Context) (map[string]ContainerMetrics, error) {
	c.podMetricsMu.Lock()
	defer c.podMetricsMu.Unlock()

	if c.cachedPodMetrics != nil && time.Since(c.podMetricsAt) < podMetricsTTL {
		return c.cachedPodMetrics, nil
	}

	podMetrics, err := c.fetchAllPodMetrics(ctx)
	if err != nil {
		return nil, err
	}
	c.cachedPodMetrics = podMetrics
	c.podMetricsAt = time.Now()
	return podMetrics, nil
}

// fetchAllPodMetrics fetches cluster-wide pod metrics from the Metrics Server.
// Returns a map keyed by "namespace/podName" with the summed CPU+mem across all containers.
func (c *Client) fetchAllPodMetrics(ctx context.Context) (map[string]ContainerMetrics, error) {
	start := time.Now()
	res := c.cs.Discovery().RESTClient().Get().AbsPath("/apis/metrics.k8s.io/v1beta1/pods").Do(ctx)
	data, err := res.Raw()
	recordK8sOpWith(c.callRecorder, "get", "podmetrics", start, err)
	if err != nil {
		return nil, fmt.Errorf("fetch pod metrics: %w", err)
	}

	var response struct {
		Items []struct {
			Metadata struct {
				Name      string `json:"name"`
				Namespace string `json:"namespace"`
			} `json:"metadata"`
			Containers []struct {
				Usage struct {
					CPU    string `json:"cpu"`
					Memory string `json:"memory"`
				} `json:"usage"`
			} `json:"containers"`
		} `json:"items"`
	}
	if err := json.Unmarshal(data, &response); err != nil {
		return nil, fmt.Errorf("parse pod metrics response: %w", err)
	}

	result := make(map[string]ContainerMetrics, len(response.Items))
	for _, item := range response.Items {
		key := item.Metadata.Namespace + "/" + item.Metadata.Name
		var totalCPU, totalMemory int64
		for _, container := range item.Containers {
			if q, err := resource.ParseQuantity(container.Usage.CPU); err == nil {
				totalCPU += q.MilliValue()
			} else {
				slog.Debug("unparseable CPU metric", "pod", key, "raw", container.Usage.CPU, "err", err)
			}
			if q, err := resource.ParseQuantity(container.Usage.Memory); err == nil {
				totalMemory += q.Value()
			} else {
				slog.Debug("unparseable memory metric", "pod", key, "raw", container.Usage.Memory, "err", err)
			}
		}
		result[key] = ContainerMetrics{CPUMillis: totalCPU, MemBytes: totalMemory}
	}
	return result, nil
}

// GetPodMetrics queries the Metrics Server API for current pod resource usage.
// Returns container metrics keyed by container name, or an error if unavailable.
func (c *Client) GetPodMetrics(ctx context.Context, namespace, name string) (map[string]ContainerMetrics, error) {
	start := time.Now()
	data, err := c.cs.Discovery().RESTClient().
		Get().
		AbsPath(fmt.Sprintf("/apis/metrics.k8s.io/v1beta1/namespaces/%s/pods/%s", namespace, name)).
		DoRaw(ctx)
	recordK8sOpWith(c.callRecorder, "get", "podmetrics", start, err)
	if err != nil {
		return nil, fmt.Errorf("fetch pod metrics %s/%s: %w", namespace, name, err)
	}

	var response struct {
		Containers []struct {
			Name  string `json:"name"`
			Usage struct {
				CPU    string `json:"cpu"`
				Memory string `json:"memory"`
			} `json:"usage"`
		} `json:"containers"`
	}
	if err := json.Unmarshal(data, &response); err != nil {
		return nil, fmt.Errorf("parse pod metrics %s/%s: %w", namespace, name, err)
	}

	result := make(map[string]ContainerMetrics)
	for _, container := range response.Containers {
		cpu, err := resource.ParseQuantity(container.Usage.CPU)
		if err != nil {
			slog.Debug("unparseable CPU metric", "container", container.Name, "err", err)
			continue
		}
		memory, err := resource.ParseQuantity(container.Usage.Memory)
		if err != nil {
			slog.Debug("unparseable memory metric", "container", container.Name, "err", err)
			continue
		}
		result[container.Name] = ContainerMetrics{
			CPUMillis: cpu.MilliValue(),
			MemBytes:  memory.Value(),
		}
	}
	return result, nil
}
