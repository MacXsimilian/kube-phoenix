// SPDX-License-Identifier: Apache-2.0

package k8s

import (
	"context"
	"fmt"
	"io"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// ─── Pods ─────────────────────────────────────────────────────────────────────

func (c *Client) ListPods(ctx context.Context, namespace string) ([]corev1.Pod, error) {
	start := time.Now()
	items, err := paginatedList(metav1.ListOptions{}, func(opts metav1.ListOptions) ([]corev1.Pod, string, error) {
		list, err := c.cs.CoreV1().Pods(namespace).List(ctx, opts)
		if err != nil {
			return nil, "", err
		}
		return list.Items, list.Continue, nil
	})
	recordK8sOpWith(c.callRecorder, "list", "pod", start, err)
	if err != nil {
		return nil, fmt.Errorf("list pods in %q: %w", namespace, err)
	}
	return items, nil
}

func (c *Client) ListAllPods(ctx context.Context) ([]corev1.Pod, error) {
	return c.ListPods(ctx, "")
}

func (c *Client) ListPodsOnNode(ctx context.Context, nodeName string) ([]corev1.Pod, error) {
	start := time.Now()
	items, err := paginatedList(metav1.ListOptions{FieldSelector: "spec.nodeName=" + nodeName}, func(opts metav1.ListOptions) ([]corev1.Pod, string, error) {
		list, err := c.cs.CoreV1().Pods("").List(ctx, opts)
		if err != nil {
			return nil, "", err
		}
		return list.Items, list.Continue, nil
	})
	recordK8sOpWith(c.callRecorder, "list", "pod", start, err)
	if err != nil {
		return nil, fmt.Errorf("list pods on node %q: %w", nodeName, err)
	}
	return items, nil
}

func (c *Client) GetPod(ctx context.Context, namespace, name string) (*corev1.Pod, error) {
	start := time.Now()
	pod, err := c.cs.CoreV1().Pods(namespace).Get(ctx, name, metav1.GetOptions{})
	recordK8sOpWith(c.callRecorder, "get", "pod", start, err)
	if err != nil {
		return nil, fmt.Errorf("get pod %s/%s: %w", namespace, name, err)
	}
	return pod, nil
}

// CountReadyPods returns the number of Ready pods and total pods owned by the
// given Deployment or StatefulSet. Used to verify workload health after wake.
func (c *Client) CountReadyPods(ctx context.Context, kind, namespace, name string) (ready, total int, err error) {
	selector, err := c.workloadLabelSelector(ctx, kind, namespace, name)
	if err != nil {
		return 0, 0, err
	}
	start := time.Now()
	pods, listErr := paginatedList(metav1.ListOptions{LabelSelector: selector}, func(opts metav1.ListOptions) ([]corev1.Pod, string, error) {
		list, err := c.cs.CoreV1().Pods(namespace).List(ctx, opts)
		if err != nil {
			return nil, "", err
		}
		return list.Items, list.Continue, nil
	})
	recordK8sOpWith(c.callRecorder, "list", "pod", start, listErr)
	if listErr != nil {
		return 0, 0, fmt.Errorf("list pods for %s %s/%s: %w", kind, namespace, name, listErr)
	}
	for _, pod := range pods {
		total++
		if isPodReady(pod) {
			ready++
		}
	}
	return ready, total, nil
}

func (c *Client) workloadLabelSelector(ctx context.Context, kind, namespace, name string) (string, error) {
	var labelSelector *metav1.LabelSelector
	switch kind {
	case "Deployment":
		deployment, err := c.GetDeployment(ctx, namespace, name)
		if err != nil {
			return "", err
		}
		labelSelector = deployment.Spec.Selector
	case "StatefulSet":
		statefulSet, err := c.GetStatefulSet(ctx, namespace, name)
		if err != nil {
			return "", err
		}
		labelSelector = statefulSet.Spec.Selector
	default:
		return "", fmt.Errorf("unsupported kind %q", kind)
	}
	if labelSelector == nil || len(labelSelector.MatchLabels)+len(labelSelector.MatchExpressions) == 0 {
		return "", fmt.Errorf("missing pod selector for %s %s/%s", kind, namespace, name)
	}
	selector, err := metav1.LabelSelectorAsSelector(labelSelector)
	if err != nil {
		return "", fmt.Errorf("invalid pod selector for %s %s/%s: %w", kind, namespace, name, err)
	}
	return selector.String(), nil
}

func isPodReady(pod corev1.Pod) bool {
	for _, condition := range pod.Status.Conditions {
		if condition.Type == corev1.PodReady {
			return condition.Status == corev1.ConditionTrue
		}
	}
	return false
}

// PodLogOptions configures which logs to retrieve from a pod.
type PodLogOptions struct {
	Container string
	TailLines int64
	Previous  bool
	Follow    bool
}

// GetPodLogs returns the raw log output for a container in a pod.
// When Follow is true the stream stays open and tails new output (like kubectl logs -f).
// The caller is responsible for closing the returned io.ReadCloser.
func (c *Client) GetPodLogs(ctx context.Context, namespace, name string, logOpts PodLogOptions) (io.ReadCloser, error) {
	start := time.Now()
	opts := &corev1.PodLogOptions{
		Container: logOpts.Container,
		Previous:  logOpts.Previous,
		Follow:    logOpts.Follow,
	}
	if logOpts.TailLines > 0 {
		opts.TailLines = &logOpts.TailLines
	}
	stream, err := c.cs.CoreV1().Pods(namespace).GetLogs(name, opts).Stream(ctx)
	recordK8sOpWith(c.callRecorder, "get", "podlogs", start, err)
	if err != nil {
		return nil, fmt.Errorf("get logs %s/%s (container=%s): %w", namespace, name, logOpts.Container, err)
	}
	return stream, nil
}

func (c *Client) GetPodEvents(ctx context.Context, namespace, podName string) ([]corev1.Event, error) {
	start := time.Now()
	items, err := paginatedList(metav1.ListOptions{FieldSelector: "involvedObject.name=" + podName}, func(opts metav1.ListOptions) ([]corev1.Event, string, error) {
		list, err := c.cs.CoreV1().Events(namespace).List(ctx, opts)
		if err != nil {
			return nil, "", err
		}
		return list.Items, list.Continue, nil
	})
	recordK8sOpWith(c.callRecorder, "list", "event", start, err)
	if err != nil {
		return nil, fmt.Errorf("get events for pod %s/%s: %w", namespace, podName, err)
	}
	return items, nil
}
