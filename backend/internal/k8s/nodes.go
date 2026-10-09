// SPDX-License-Identifier: Apache-2.0

package k8s

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	corev1 "k8s.io/api/core/v1"
	policyv1 "k8s.io/api/policy/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// ─── Nodes ────────────────────────────────────────────────────────────────────

func (c *Client) ListNodes(ctx context.Context) ([]corev1.Node, error) {
	start := time.Now()
	items, err := paginatedList(metav1.ListOptions{}, func(opts metav1.ListOptions) ([]corev1.Node, string, error) {
		list, err := c.cs.CoreV1().Nodes().List(ctx, opts)
		if err != nil {
			return nil, "", err
		}
		return list.Items, list.Continue, nil
	})
	recordK8sOpWith(c.callRecorder, "list", "node", start, err)
	if err != nil {
		return nil, fmt.Errorf("list nodes: %w", err)
	}
	return items, nil
}

func (c *Client) CordonNode(ctx context.Context, name string) error {
	start := time.Now()
	err := retryOnConflict(func() error {
		node, err := c.cs.CoreV1().Nodes().Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return fmt.Errorf("get node %q: %w", name, err)
		}
		if err := c.checkMutation(ctx); err != nil {
			return err
		}
		node.Spec.Unschedulable = true
		_, err = c.cs.CoreV1().Nodes().Update(ctx, node, metav1.UpdateOptions{})
		if err != nil {
			return fmt.Errorf("cordon node %q: %w", name, err)
		}
		return nil
	})
	recordK8sOpWith(c.callRecorder, "cordon", "node", start, err)
	return err
}

// isDaemonSetPod returns true if any owner reference is a DaemonSet.
func isDaemonSetPod(pod corev1.Pod) bool {
	for _, ref := range pod.OwnerReferences {
		if ref.Kind == "DaemonSet" {
			return true
		}
	}
	return false
}

// CountNonDaemonSetPods returns the number of non-DaemonSet pods on a node.
// Used to compute a dynamic drain timeout before calling DrainNode.
func (c *Client) CountNonDaemonSetPods(ctx context.Context, nodeName string) (int, error) {
	start := time.Now()
	allPods, err := paginatedList(metav1.ListOptions{FieldSelector: "spec.nodeName=" + nodeName}, func(opts metav1.ListOptions) ([]corev1.Pod, string, error) {
		list, err := c.cs.CoreV1().Pods("").List(ctx, opts)
		if err != nil {
			return nil, "", err
		}
		return list.Items, list.Continue, nil
	})
	recordK8sOpWith(c.callRecorder, "list", "pod", start, err)
	if err != nil {
		return 0, fmt.Errorf("list pods on %s: %w", nodeName, err)
	}
	count := 0
	for _, pod := range allPods {
		if !isDaemonSetPod(pod) {
			count++
		}
	}
	return count, nil
}

// DrainNode cordons and evicts all non-DaemonSet pods from a node, waiting
// up to the given timeout for them to terminate.
func (c *Client) DrainNode(ctx context.Context, name string, timeout time.Duration) (result error) {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	owner, err := c.cordonForDrain(ctx, name)
	defer func() {
		if result != nil && owner != "" {
			cleanupCtx, cancelCleanup := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
			defer cancelCleanup()
			if err := c.recoverCordon(cleanupCtx, name, owner); err != nil {
				result = fmt.Errorf("%w; cordon recovery failed: %v", result, err)
			}
		}
	}()
	if err != nil {
		return err
	}
	start := time.Now()
	drainPods, err := paginatedList(metav1.ListOptions{FieldSelector: "spec.nodeName=" + name}, func(opts metav1.ListOptions) ([]corev1.Pod, string, error) {
		list, err := c.cs.CoreV1().Pods("").List(ctx, opts)
		if err != nil {
			return nil, "", err
		}
		return list.Items, list.Continue, nil
	})
	if err != nil {
		return fmt.Errorf("list pods on %s: %w", name, err)
	}
	if err := c.evictPods(ctx, name, drainPods); err != nil {
		return err
	}
	drainErr := c.waitForDrain(ctx, name, timeout)
	recordK8sOpWith(c.callRecorder, "drain", "node", start, drainErr)
	return drainErr
}

// evictPods preserves the original eviction-first, force-delete fallback.
// Sleep deliberately shuts down workloads and removes unprotected nodes, so an
// eviction blocker (including a PDB) must not keep idle nodes running indefinitely.
// After an eviction error, zero-grace deletion prioritizes shutdown completion:
// it bypasses PDBs and graceful termination and requires delete on core pods.
// Cancellation, scheduler ownership and the observed pod UID still constrain it.
func (c *Client) evictPods(ctx context.Context, nodeName string, pods []corev1.Pod) error {
	var failures []error
	for _, pod := range pods {
		if isDaemonSetPod(pod) {
			continue
		}
		if err := c.checkMutation(ctx); err != nil {
			return err
		}
		eviction := &policyv1.Eviction{
			ObjectMeta: metav1.ObjectMeta{
				Name:      pod.Name,
				Namespace: pod.Namespace,
			},
			DeleteOptions: &metav1.DeleteOptions{
				Preconditions: &metav1.Preconditions{UID: &pod.UID},
			},
		}
		evictErr := c.cs.PolicyV1().Evictions(pod.Namespace).Evict(ctx, eviction)
		if evictErr == nil || apierrors.IsNotFound(evictErr) {
			continue
		}
		if err := c.checkMutation(ctx); err != nil {
			return err
		}
		slog.Warn("drain: eviction failed, falling back to zero-grace pod deletion",
			"node", nodeName, "namespace", pod.Namespace, "pod", pod.Name, "evictErr", evictErr)
		grace := int64(0)
		delErr := c.cs.CoreV1().Pods(pod.Namespace).Delete(ctx, pod.Name, metav1.DeleteOptions{
			GracePeriodSeconds: &grace,
			Preconditions:      &metav1.Preconditions{UID: &pod.UID},
		})
		if delErr != nil && !apierrors.IsNotFound(delErr) {
			// Attempt the remaining pods as before. Report unresolved failures
			// so the caller can recover its cordon and retain the node.
			failures = append(failures, fmt.Errorf("evict %s/%s on %s failed: %v; force-delete also failed (requires delete on core pods): %w",
				pod.Namespace, pod.Name, nodeName, evictErr, delErr))
		}
	}
	return errors.Join(failures...)
}

// waitForDrain polls until all non-DaemonSet pods are gone or timeout expires.
func (c *Client) waitForDrain(ctx context.Context, nodeName string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		remainingPods, err := paginatedList(metav1.ListOptions{FieldSelector: "spec.nodeName=" + nodeName}, func(opts metav1.ListOptions) ([]corev1.Pod, string, error) {
			list, err := c.cs.CoreV1().Pods("").List(ctx, opts)
			if err != nil {
				return nil, "", err
			}
			return list.Items, list.Continue, nil
		})
		if err != nil {
			return fmt.Errorf("poll pods on %s: %w", nodeName, err)
		}
		evictable := 0
		for _, pod := range remainingPods {
			if !isDaemonSetPod(pod) {
				evictable++
			}
		}
		if evictable == 0 {
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(2 * time.Second):
		}
	}
	return fmt.Errorf("drain %s: timed out waiting for pods to terminate", nodeName)
}

func (c *Client) DeleteNode(ctx context.Context, name string) error {
	if err := c.checkMutation(ctx); err != nil {
		return err
	}
	start := time.Now()
	err := c.cs.CoreV1().Nodes().Delete(ctx, name, metav1.DeleteOptions{})
	recordK8sOpWith(c.callRecorder, "delete", "node", start, err)
	if err != nil {
		return fmt.Errorf("delete node %q: %w", name, err)
	}
	return nil
}

func (c *Client) GetNode(ctx context.Context, name string) (*corev1.Node, error) {
	start := time.Now()
	node, err := c.cs.CoreV1().Nodes().Get(ctx, name, metav1.GetOptions{})
	recordK8sOpWith(c.callRecorder, "get", "node", start, err)
	if err != nil {
		return nil, fmt.Errorf("get node %q: %w", name, err)
	}
	return node, nil
}
