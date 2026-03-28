// Package k8s provides a Kubernetes API client wrapper with typed operations
// for deployments, statefulsets, nodes, and pods.
package k8s

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"os"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	autoscalingv1 "k8s.io/api/autoscaling/v1"
	corev1 "k8s.io/api/core/v1"
	policyv1 "k8s.io/api/policy/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

type Client struct {
	cs *kubernetes.Clientset
}

func New() (*Client, error) {
	cfg, err := rest.InClusterConfig()
	if err != nil {
		// Fall back to kubeconfig
		kubeconfig := os.Getenv("KUBECONFIG")
		if kubeconfig == "" {
			home, homeErr := os.UserHomeDir()
			if homeErr != nil {
				return nil, fmt.Errorf("k8s config: cannot determine home directory: %w", homeErr)
			}
			kubeconfig = home + "/.kube/config"
		}
		cfg, err = clientcmd.BuildConfigFromFlags("", kubeconfig)
		if err != nil {
			return nil, fmt.Errorf("k8s config: %w", err)
		}
	}
	cs, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("k8s client: %w", err)
	}
	return &Client{cs: cs}, nil
}

// ─── Deployments ─────────────────────────────────────────────────────────────

func (c *Client) ListDeployments(ctx context.Context, namespace string) ([]appsv1.Deployment, error) {
	list, err := c.cs.AppsV1().Deployments(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("list deployments in %q: %w", namespace, err)
	}
	return list.Items, nil
}

// ListDeploymentsBySelector lists deployments filtered by a label selector string.
// An empty labelSelector returns all deployments (same as ListDeployments).
func (c *Client) ListDeploymentsBySelector(ctx context.Context, namespace, labelSelector string) ([]appsv1.Deployment, error) {
	list, err := c.cs.AppsV1().Deployments(namespace).List(ctx, metav1.ListOptions{LabelSelector: labelSelector})
	if err != nil {
		return nil, fmt.Errorf("list deployments by selector in %q: %w", namespace, err)
	}
	return list.Items, nil
}

func (c *Client) GetDeployment(ctx context.Context, namespace, name string) (*appsv1.Deployment, error) {
	d, err := c.cs.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("get deployment %s/%s: %w", namespace, name, err)
	}
	return d, nil
}

var conflictRetryBackoff = []time.Duration{500 * time.Millisecond, 1500 * time.Millisecond, 3 * time.Second}

// retryOnConflict retries fn on 409 Conflict errors using the shared backoff schedule.
// fn should re-fetch the resource on each call to get a fresh resourceVersion.
func retryOnConflict(fn func() error) error {
	var lastErr error
	for attempt := 0; attempt <= len(conflictRetryBackoff); attempt++ {
		if attempt > 0 {
			slog.Warn("retrying on conflict", "attempt", attempt+1, "maxAttempts", len(conflictRetryBackoff)+1)
			time.Sleep(conflictRetryBackoff[attempt-1])
		}
		err := fn()
		if err == nil {
			return nil
		}
		if !apierrors.IsConflict(err) {
			return err
		}
		lastErr = err
	}
	return lastErr
}

func (c *Client) scaleWithRetry(ctx context.Context, namespace, name string, replicas int32,
	getScale func(ctx context.Context, name string, opts metav1.GetOptions) (*autoscalingv1.Scale, error),
	updateScale func(ctx context.Context, name string, scale *autoscalingv1.Scale, opts metav1.UpdateOptions) (*autoscalingv1.Scale, error),
) error {
	return retryOnConflict(func() error {
		scale, err := getScale(ctx, name, metav1.GetOptions{})
		if err != nil {
			return fmt.Errorf("get scale %s/%s: %w", namespace, name, err)
		}
		scale.Spec.Replicas = replicas
		_, err = updateScale(ctx, name, scale, metav1.UpdateOptions{})
		if err != nil {
			return fmt.Errorf("update scale %s/%s: %w", namespace, name, err)
		}
		return nil
	})
}

func (c *Client) ScaleDeployment(ctx context.Context, namespace, name string, replicas int32) error {
	dep := c.cs.AppsV1().Deployments(namespace)
	return c.scaleWithRetry(ctx, namespace, name, replicas, dep.GetScale, dep.UpdateScale)
}

func (c *Client) AnnotateDeployment(ctx context.Context, namespace, name, key, value string) error {
	return retryOnConflict(func() error {
		d, err := c.cs.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return fmt.Errorf("get deployment %s/%s: %w", namespace, name, err)
		}
		if d.Annotations == nil {
			d.Annotations = map[string]string{}
		}
		d.Annotations[key] = value
		_, err = c.cs.AppsV1().Deployments(namespace).Update(ctx, d, metav1.UpdateOptions{})
		if err != nil {
			return fmt.Errorf("annotate deployment %s/%s: %w", namespace, name, err)
		}
		return nil
	})
}

func (c *Client) RemoveDeploymentAnnotation(ctx context.Context, namespace, name, key string) error {
	return retryOnConflict(func() error {
		d, err := c.cs.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return fmt.Errorf("get deployment %s/%s: %w", namespace, name, err)
		}
		delete(d.Annotations, key)
		_, err = c.cs.AppsV1().Deployments(namespace).Update(ctx, d, metav1.UpdateOptions{})
		if err != nil {
			return fmt.Errorf("remove annotation deployment %s/%s: %w", namespace, name, err)
		}
		return nil
	})
}

// ─── StatefulSets ─────────────────────────────────────────────────────────────

func (c *Client) ListStatefulSets(ctx context.Context, namespace string) ([]appsv1.StatefulSet, error) {
	list, err := c.cs.AppsV1().StatefulSets(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("list statefulsets in %q: %w", namespace, err)
	}
	return list.Items, nil
}

// ListStatefulSetsBySelector lists statefulsets filtered by a label selector string.
func (c *Client) ListStatefulSetsBySelector(ctx context.Context, namespace, labelSelector string) ([]appsv1.StatefulSet, error) {
	list, err := c.cs.AppsV1().StatefulSets(namespace).List(ctx, metav1.ListOptions{LabelSelector: labelSelector})
	if err != nil {
		return nil, fmt.Errorf("list statefulsets by selector in %q: %w", namespace, err)
	}
	return list.Items, nil
}

func (c *Client) GetStatefulSet(ctx context.Context, namespace, name string) (*appsv1.StatefulSet, error) {
	ss, err := c.cs.AppsV1().StatefulSets(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("get statefulset %s/%s: %w", namespace, name, err)
	}
	return ss, nil
}

func (c *Client) ScaleStatefulSet(ctx context.Context, namespace, name string, replicas int32) error {
	ss := c.cs.AppsV1().StatefulSets(namespace)
	return c.scaleWithRetry(ctx, namespace, name, replicas, ss.GetScale, ss.UpdateScale)
}

func (c *Client) AnnotateStatefulSet(ctx context.Context, namespace, name, key, value string) error {
	return retryOnConflict(func() error {
		ss, err := c.cs.AppsV1().StatefulSets(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return fmt.Errorf("get statefulset %s/%s: %w", namespace, name, err)
		}
		if ss.Annotations == nil {
			ss.Annotations = map[string]string{}
		}
		ss.Annotations[key] = value
		_, err = c.cs.AppsV1().StatefulSets(namespace).Update(ctx, ss, metav1.UpdateOptions{})
		if err != nil {
			return fmt.Errorf("annotate statefulset %s/%s: %w", namespace, name, err)
		}
		return nil
	})
}

func (c *Client) RemoveStatefulSetAnnotation(ctx context.Context, namespace, name, key string) error {
	return retryOnConflict(func() error {
		ss, err := c.cs.AppsV1().StatefulSets(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return fmt.Errorf("get statefulset %s/%s: %w", namespace, name, err)
		}
		delete(ss.Annotations, key)
		_, err = c.cs.AppsV1().StatefulSets(namespace).Update(ctx, ss, metav1.UpdateOptions{})
		if err != nil {
			return fmt.Errorf("remove annotation statefulset %s/%s: %w", namespace, name, err)
		}
		return nil
	})
}

// ─── Nodes ────────────────────────────────────────────────────────────────────

func (c *Client) ListNodes(ctx context.Context) ([]corev1.Node, error) {
	list, err := c.cs.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("list nodes: %w", err)
	}
	return list.Items, nil
}

func (c *Client) CordonNode(ctx context.Context, name string) error {
	return retryOnConflict(func() error {
		node, err := c.cs.CoreV1().Nodes().Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return fmt.Errorf("get node %q: %w", name, err)
		}
		node.Spec.Unschedulable = true
		_, err = c.cs.CoreV1().Nodes().Update(ctx, node, metav1.UpdateOptions{})
		if err != nil {
			return fmt.Errorf("cordon node %q: %w", name, err)
		}
		return nil
	})
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
	pods, err := c.cs.CoreV1().Pods("").List(ctx, metav1.ListOptions{
		FieldSelector: "spec.nodeName=" + nodeName,
	})
	if err != nil {
		return 0, fmt.Errorf("list pods on %s: %w", nodeName, err)
	}
	count := 0
	for _, pod := range pods.Items {
		if !isDaemonSetPod(pod) {
			count++
		}
	}
	return count, nil
}

// DrainNode cordons and evicts all non-DaemonSet pods from a node, waiting
// up to the given timeout for them to terminate.
func (c *Client) DrainNode(ctx context.Context, name string, timeout time.Duration) error {
	if err := c.CordonNode(ctx, name); err != nil {
		return fmt.Errorf("cordon %s: %w", name, err)
	}

	pods, err := c.cs.CoreV1().Pods("").List(ctx, metav1.ListOptions{
		FieldSelector: "spec.nodeName=" + name,
	})
	if err != nil {
		return fmt.Errorf("list pods on %s: %w", name, err)
	}

	c.evictPods(ctx, name, pods.Items)
	return c.waitForDrain(ctx, name, timeout)
}

// evictPods attempts to evict all non-DaemonSet pods, falling back to force delete.
func (c *Client) evictPods(ctx context.Context, nodeName string, pods []corev1.Pod) {
	for _, pod := range pods {
		if isDaemonSetPod(pod) {
			continue
		}
		eviction := &policyv1.Eviction{
			ObjectMeta: metav1.ObjectMeta{
				Name:      pod.Name,
				Namespace: pod.Namespace,
			},
		}
		if err := c.cs.PolicyV1().Evictions(pod.Namespace).Evict(ctx, eviction); err != nil {
			grace := int64(0)
			if delErr := c.cs.CoreV1().Pods(pod.Namespace).Delete(ctx, pod.Name, metav1.DeleteOptions{
				GracePeriodSeconds: &grace,
			}); delErr != nil {
				slog.Warn("drain: eviction failed and force-delete also failed",
					"node", nodeName, "namespace", pod.Namespace, "pod", pod.Name,
					"evictErr", err, "deleteErr", delErr)
			}
		}
	}
}

// waitForDrain polls until all non-DaemonSet pods are gone or timeout expires.
func (c *Client) waitForDrain(ctx context.Context, nodeName string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		remaining, err := c.cs.CoreV1().Pods("").List(ctx, metav1.ListOptions{
			FieldSelector: "spec.nodeName=" + nodeName,
		})
		if err != nil {
			return fmt.Errorf("poll pods on %s: %w", nodeName, err)
		}
		evictable := 0
		for _, pod := range remaining.Items {
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
	if err := c.cs.CoreV1().Nodes().Delete(ctx, name, metav1.DeleteOptions{}); err != nil {
		return fmt.Errorf("delete node %q: %w", name, err)
	}
	return nil
}

// ─── Pods ─────────────────────────────────────────────────────────────────────

func (c *Client) ListPods(ctx context.Context, namespace string) ([]corev1.Pod, error) {
	list, err := c.cs.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("list pods in %q: %w", namespace, err)
	}
	return list.Items, nil
}

func (c *Client) ListAllPods(ctx context.Context) ([]corev1.Pod, error) {
	return c.ListPods(ctx, "")
}

func (c *Client) ListPodsOnNode(ctx context.Context, nodeName string) ([]corev1.Pod, error) {
	list, err := c.cs.CoreV1().Pods("").List(ctx, metav1.ListOptions{
		FieldSelector: "spec.nodeName=" + nodeName,
	})
	if err != nil {
		return nil, fmt.Errorf("list pods on node %q: %w", nodeName, err)
	}
	return list.Items, nil
}

func (c *Client) ListAllReplicaSets(ctx context.Context) ([]appsv1.ReplicaSet, error) {
	list, err := c.cs.AppsV1().ReplicaSets("").List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("list replicasets: %w", err)
	}
	return list.Items, nil
}

func (c *Client) ListNamespaces(ctx context.Context) ([]corev1.Namespace, error) {
	list, err := c.cs.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("list namespaces: %w", err)
	}
	return list.Items, nil
}

func (c *Client) GetPod(ctx context.Context, namespace, name string) (*corev1.Pod, error) {
	pod, err := c.cs.CoreV1().Pods(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("get pod %s/%s: %w", namespace, name, err)
	}
	return pod, nil
}

func (c *Client) GetNode(ctx context.Context, name string) (*corev1.Node, error) {
	node, err := c.cs.CoreV1().Nodes().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("get node %q: %w", name, err)
	}
	return node, nil
}

type ContainerMetrics struct {
	CPUMillis int64
	MemBytes  int64
}

// GetAllPodMetrics fetches cluster-wide pod metrics from the Metrics Server.
// Returns a map keyed by "namespace/podName" with the summed CPU+mem across all containers.
func (c *Client) GetAllPodMetrics(ctx context.Context) (map[string]ContainerMetrics, error) {
	res := c.cs.RESTClient().Get().AbsPath("/apis/metrics.k8s.io/v1beta1/pods").Do(ctx)
	data, err := res.Raw()
	if err != nil {
		return nil, fmt.Errorf("fetch pod metrics: %w", err)
	}

	var resp struct {
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
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse pod metrics response: %w", err)
	}

	result := make(map[string]ContainerMetrics, len(resp.Items))
	for _, item := range resp.Items {
		key := item.Metadata.Namespace + "/" + item.Metadata.Name
		var totalCPU, totalMem int64
		for _, ctr := range item.Containers {
			if q, err := resource.ParseQuantity(ctr.Usage.CPU); err == nil {
				totalCPU += q.MilliValue()
			} else {
				slog.Debug("unparseable CPU metric", "pod", key, "raw", ctr.Usage.CPU, "err", err)
			}
			if q, err := resource.ParseQuantity(ctr.Usage.Memory); err == nil {
				totalMem += q.Value()
			} else {
				slog.Debug("unparseable memory metric", "pod", key, "raw", ctr.Usage.Memory, "err", err)
			}
		}
		result[key] = ContainerMetrics{CPUMillis: totalCPU, MemBytes: totalMem}
	}
	return result, nil
}

// GetPodMetrics queries the Metrics Server API for current pod resource usage.
// Returns an empty map (no error) when Metrics Server is unavailable.
func (c *Client) GetPodMetrics(ctx context.Context, namespace, name string) (map[string]ContainerMetrics, error) {
	data, err := c.cs.RESTClient().
		Get().
		AbsPath(fmt.Sprintf("/apis/metrics.k8s.io/v1beta1/namespaces/%s/pods/%s", namespace, name)).
		DoRaw(ctx)
	if err != nil {
		return nil, fmt.Errorf("fetch pod metrics %s/%s: %w", namespace, name, err)
	}

	var resp struct {
		Containers []struct {
			Name  string `json:"name"`
			Usage struct {
				CPU    string `json:"cpu"`
				Memory string `json:"memory"`
			} `json:"usage"`
		} `json:"containers"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse pod metrics %s/%s: %w", namespace, name, err)
	}

	result := make(map[string]ContainerMetrics)
	for _, ctr := range resp.Containers {
		cpu, err := resource.ParseQuantity(ctr.Usage.CPU)
		if err != nil {
			slog.Debug("unparseable CPU metric", "container", ctr.Name, "err", err)
			continue
		}
		mem, err := resource.ParseQuantity(ctr.Usage.Memory)
		if err != nil {
			slog.Debug("unparseable memory metric", "container", ctr.Name, "err", err)
			continue
		}
		result[ctr.Name] = ContainerMetrics{
			CPUMillis: cpu.MilliValue(),
			MemBytes:  mem.Value(),
		}
	}
	return result, nil
}

// GetPodLogs returns the raw log output for a container in a pod.
// When follow is true the stream stays open and tails new output (like kubectl logs -f).
// The caller is responsible for closing the returned io.ReadCloser.
func (c *Client) GetPodLogs(ctx context.Context, namespace, name, container string, tailLines int64, previous, follow bool) (io.ReadCloser, error) {
	opts := &corev1.PodLogOptions{
		Container: container,
		Previous:  previous,
		Follow:    follow,
	}
	if tailLines > 0 {
		opts.TailLines = &tailLines
	}
	stream, err := c.cs.CoreV1().Pods(namespace).GetLogs(name, opts).Stream(ctx)
	if err != nil {
		return nil, fmt.Errorf("get logs %s/%s (container=%s): %w", namespace, name, container, err)
	}
	return stream, nil
}

func (c *Client) GetPodEvents(ctx context.Context, namespace, podName string) ([]corev1.Event, error) {
	list, err := c.cs.CoreV1().Events(namespace).List(ctx, metav1.ListOptions{
		FieldSelector: "involvedObject.name=" + podName,
	})
	if err != nil {
		return nil, fmt.Errorf("get events for pod %s/%s: %w", namespace, podName, err)
	}
	return list.Items, nil
}
