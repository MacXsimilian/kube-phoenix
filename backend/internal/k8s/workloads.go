// SPDX-License-Identifier: Apache-2.0

package k8s

import (
	"context"
	"fmt"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// ─── Deployments ─────────────────────────────────────────────────────────────

func (c *Client) ListDeployments(ctx context.Context, namespace string) ([]appsv1.Deployment, error) {
	start := time.Now()
	items, err := paginatedList(metav1.ListOptions{}, func(opts metav1.ListOptions) ([]appsv1.Deployment, string, error) {
		list, err := c.cs.AppsV1().Deployments(namespace).List(ctx, opts)
		if err != nil {
			return nil, "", err
		}
		return list.Items, list.Continue, nil
	})
	recordK8sOpWith(c.callRecorder, "list", "deployment", start, err)
	if err != nil {
		return nil, fmt.Errorf("list deployments in %q: %w", namespace, err)
	}
	return items, nil
}

// ListDeploymentsBySelector lists deployments filtered by a label selector string.
// An empty labelSelector returns all deployments (same as ListDeployments).
func (c *Client) ListDeploymentsBySelector(ctx context.Context, namespace, labelSelector string) ([]appsv1.Deployment, error) {
	start := time.Now()
	items, err := paginatedList(metav1.ListOptions{LabelSelector: labelSelector}, func(opts metav1.ListOptions) ([]appsv1.Deployment, string, error) {
		list, err := c.cs.AppsV1().Deployments(namespace).List(ctx, opts)
		if err != nil {
			return nil, "", err
		}
		return list.Items, list.Continue, nil
	})
	recordK8sOpWith(c.callRecorder, "list", "deployment", start, err)
	if err != nil {
		return nil, fmt.Errorf("list deployments by selector in %q: %w", namespace, err)
	}
	return items, nil
}

func (c *Client) GetDeployment(ctx context.Context, namespace, name string) (*appsv1.Deployment, error) {
	start := time.Now()
	d, err := c.cs.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
	recordK8sOpWith(c.callRecorder, "get", "deployment", start, err)
	if err != nil {
		return nil, fmt.Errorf("get deployment %s/%s: %w", namespace, name, err)
	}
	return d, nil
}

func (c *Client) ScaleDeployment(ctx context.Context, namespace, name string, replicas int32) error {
	start := time.Now()
	dep := c.cs.AppsV1().Deployments(namespace)
	err := c.scaleWithRetry(ctx, namespace, name, replicas, dep.GetScale, dep.UpdateScale)
	recordK8sOpWith(c.callRecorder, "scale", "deployment", start, err)
	return err
}

// ─── StatefulSets ─────────────────────────────────────────────────────────────

func (c *Client) ListStatefulSets(ctx context.Context, namespace string) ([]appsv1.StatefulSet, error) {
	start := time.Now()
	items, err := paginatedList(metav1.ListOptions{}, func(opts metav1.ListOptions) ([]appsv1.StatefulSet, string, error) {
		list, err := c.cs.AppsV1().StatefulSets(namespace).List(ctx, opts)
		if err != nil {
			return nil, "", err
		}
		return list.Items, list.Continue, nil
	})
	recordK8sOpWith(c.callRecorder, "list", "statefulset", start, err)
	if err != nil {
		return nil, fmt.Errorf("list statefulsets in %q: %w", namespace, err)
	}
	return items, nil
}

// ListStatefulSetsBySelector lists statefulsets filtered by a label selector string.
func (c *Client) ListStatefulSetsBySelector(ctx context.Context, namespace, labelSelector string) ([]appsv1.StatefulSet, error) {
	start := time.Now()
	items, err := paginatedList(metav1.ListOptions{LabelSelector: labelSelector}, func(opts metav1.ListOptions) ([]appsv1.StatefulSet, string, error) {
		list, err := c.cs.AppsV1().StatefulSets(namespace).List(ctx, opts)
		if err != nil {
			return nil, "", err
		}
		return list.Items, list.Continue, nil
	})
	recordK8sOpWith(c.callRecorder, "list", "statefulset", start, err)
	if err != nil {
		return nil, fmt.Errorf("list statefulsets by selector in %q: %w", namespace, err)
	}
	return items, nil
}

func (c *Client) GetStatefulSet(ctx context.Context, namespace, name string) (*appsv1.StatefulSet, error) {
	start := time.Now()
	ss, err := c.cs.AppsV1().StatefulSets(namespace).Get(ctx, name, metav1.GetOptions{})
	recordK8sOpWith(c.callRecorder, "get", "statefulset", start, err)
	if err != nil {
		return nil, fmt.Errorf("get statefulset %s/%s: %w", namespace, name, err)
	}
	return ss, nil
}

func (c *Client) ScaleStatefulSet(ctx context.Context, namespace, name string, replicas int32) error {
	start := time.Now()
	ss := c.cs.AppsV1().StatefulSets(namespace)
	err := c.scaleWithRetry(ctx, namespace, name, replicas, ss.GetScale, ss.UpdateScale)
	recordK8sOpWith(c.callRecorder, "scale", "statefulset", start, err)
	return err
}

const rsCacheTTL = 60 * time.Second

// ListAllReplicaSets returns cached ReplicaSets, refreshing from the API
// at most once every 60 seconds.
func (c *Client) ListAllReplicaSets(ctx context.Context) ([]appsv1.ReplicaSet, error) {
	c.rsMu.Lock()
	defer c.rsMu.Unlock()

	if c.cachedRS != nil && time.Since(c.rsAt) < rsCacheTTL {
		return c.cachedRS, nil
	}

	start := time.Now()
	items, err := paginatedList(metav1.ListOptions{}, func(opts metav1.ListOptions) ([]appsv1.ReplicaSet, string, error) {
		list, err := c.cs.AppsV1().ReplicaSets("").List(ctx, opts)
		if err != nil {
			return nil, "", err
		}
		return list.Items, list.Continue, nil
	})
	recordK8sOpWith(c.callRecorder, "list", "replicaset", start, err)
	if err != nil {
		return nil, fmt.Errorf("list replicasets: %w", err)
	}
	c.cachedRS = items
	c.rsAt = time.Now()
	return c.cachedRS, nil
}
