package k8s

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	policyv1 "k8s.io/api/policy/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/api/resource"
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
			home, _ := os.UserHomeDir()
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
		return nil, err
	}
	return list.Items, nil
}

func (c *Client) ScaleDeployment(ctx context.Context, namespace, name string, replicas int32) error {
	scale, err := c.cs.AppsV1().Deployments(namespace).GetScale(ctx, name, metav1.GetOptions{})
	if err != nil {
		return err
	}
	scale.Spec.Replicas = replicas
	_, err = c.cs.AppsV1().Deployments(namespace).UpdateScale(ctx, name, scale, metav1.UpdateOptions{})
	return err
}

func (c *Client) AnnotateDeployment(ctx context.Context, namespace, name, key, value string) error {
	d, err := c.cs.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return err
	}
	if d.Annotations == nil {
		d.Annotations = map[string]string{}
	}
	d.Annotations[key] = value
	_, err = c.cs.AppsV1().Deployments(namespace).Update(ctx, d, metav1.UpdateOptions{})
	return err
}

func (c *Client) RemoveDeploymentAnnotation(ctx context.Context, namespace, name, key string) error {
	d, err := c.cs.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return err
	}
	delete(d.Annotations, key)
	_, err = c.cs.AppsV1().Deployments(namespace).Update(ctx, d, metav1.UpdateOptions{})
	return err
}

// ─── StatefulSets ─────────────────────────────────────────────────────────────

func (c *Client) ListStatefulSets(ctx context.Context, namespace string) ([]appsv1.StatefulSet, error) {
	list, err := c.cs.AppsV1().StatefulSets(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	return list.Items, nil
}

func (c *Client) ScaleStatefulSet(ctx context.Context, namespace, name string, replicas int32) error {
	scale, err := c.cs.AppsV1().StatefulSets(namespace).GetScale(ctx, name, metav1.GetOptions{})
	if err != nil {
		return err
	}
	scale.Spec.Replicas = replicas
	_, err = c.cs.AppsV1().StatefulSets(namespace).UpdateScale(ctx, name, scale, metav1.UpdateOptions{})
	return err
}

func (c *Client) AnnotateStatefulSet(ctx context.Context, namespace, name, key, value string) error {
	ss, err := c.cs.AppsV1().StatefulSets(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return err
	}
	if ss.Annotations == nil {
		ss.Annotations = map[string]string{}
	}
	ss.Annotations[key] = value
	_, err = c.cs.AppsV1().StatefulSets(namespace).Update(ctx, ss, metav1.UpdateOptions{})
	return err
}

func (c *Client) RemoveStatefulSetAnnotation(ctx context.Context, namespace, name, key string) error {
	ss, err := c.cs.AppsV1().StatefulSets(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return err
	}
	delete(ss.Annotations, key)
	_, err = c.cs.AppsV1().StatefulSets(namespace).Update(ctx, ss, metav1.UpdateOptions{})
	return err
}

// ─── Nodes ────────────────────────────────────────────────────────────────────

func (c *Client) ListNodes(ctx context.Context) ([]corev1.Node, error) {
	list, err := c.cs.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	return list.Items, nil
}

func (c *Client) CordonNode(ctx context.Context, name string) error {
	node, err := c.cs.CoreV1().Nodes().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return err
	}
	node.Spec.Unschedulable = true
	_, err = c.cs.CoreV1().Nodes().Update(ctx, node, metav1.UpdateOptions{})
	return err
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
		isDaemon := false
		for _, ref := range pod.OwnerReferences {
			if ref.Kind == "DaemonSet" {
				isDaemon = true
				break
			}
		}
		if !isDaemon {
			count++
		}
	}
	return count, nil
}

// DrainNode cordons and evicts all non-DaemonSet pods from a node, waiting
// up to the given timeout for them to terminate.
func (c *Client) DrainNode(ctx context.Context, name string, timeout time.Duration) error {
	// Cordon first
	if err := c.CordonNode(ctx, name); err != nil {
		return fmt.Errorf("cordon %s: %w", name, err)
	}

	// List all non-daemonset pods on the node
	pods, err := c.cs.CoreV1().Pods("").List(ctx, metav1.ListOptions{
		FieldSelector: "spec.nodeName=" + name,
	})
	if err != nil {
		return fmt.Errorf("list pods on %s: %w", name, err)
	}

	for _, pod := range pods.Items {
		// Skip daemonset pods
		isDaemonSet := false
		for _, ref := range pod.OwnerReferences {
			if ref.Kind == "DaemonSet" {
				isDaemonSet = true
				break
			}
		}
		if isDaemonSet {
			continue
		}

		// Try eviction first, fall back to delete
		eviction := &policyv1.Eviction{
			ObjectMeta: metav1.ObjectMeta{
				Name:      pod.Name,
				Namespace: pod.Namespace,
			},
		}
		if err := c.cs.PolicyV1().Evictions(pod.Namespace).Evict(ctx, eviction); err != nil {
			// Fall back to force delete
			grace := int64(0)
			_ = c.cs.CoreV1().Pods(pod.Namespace).Delete(ctx, pod.Name, metav1.DeleteOptions{
				GracePeriodSeconds: &grace,
			})
		}
	}

	// Wait up to timeout for evictable pods to terminate, honouring context cancellation.
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		remaining, err := c.cs.CoreV1().Pods("").List(ctx, metav1.ListOptions{
			FieldSelector: "spec.nodeName=" + name,
		})
		if err != nil {
			break
		}
		evictable := 0
		for _, pod := range remaining.Items {
			isDaemon := false
			for _, ref := range pod.OwnerReferences {
				if ref.Kind == "DaemonSet" {
					isDaemon = true
					break
				}
			}
			if !isDaemon {
				evictable++
			}
		}
		if evictable == 0 {
			break
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(2 * time.Second):
		}
	}
	return nil
}

func (c *Client) DeleteNode(ctx context.Context, name string) error {
	return c.cs.CoreV1().Nodes().Delete(ctx, name, metav1.DeleteOptions{})
}

// ─── Pods ─────────────────────────────────────────────────────────────────────

func (c *Client) ListPods(ctx context.Context, namespace string) ([]corev1.Pod, error) {
	list, err := c.cs.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
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
		return nil, err
	}
	return list.Items, nil
}

func (c *Client) ListAllReplicaSets(ctx context.Context) ([]appsv1.ReplicaSet, error) {
	list, err := c.cs.AppsV1().ReplicaSets("").List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	return list.Items, nil
}

func (c *Client) ListNamespaces(ctx context.Context) ([]corev1.Namespace, error) {
	list, err := c.cs.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	return list.Items, nil
}

func (c *Client) GetPod(ctx context.Context, namespace, name string) (*corev1.Pod, error) {
	pod, err := c.cs.CoreV1().Pods(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	return pod, nil
}

func (c *Client) GetNode(ctx context.Context, name string) (*corev1.Node, error) {
	node, err := c.cs.CoreV1().Nodes().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	return node, nil
}

type ContainerMetrics struct {
	CPUMillis int64
	MemBytes  int64
}

// GetPodMetrics queries the Metrics Server API for current pod resource usage.
// Returns an empty map (no error) when Metrics Server is unavailable.
func (c *Client) GetPodMetrics(ctx context.Context, namespace, name string) (map[string]ContainerMetrics, error) {
	data, err := c.cs.RESTClient().
		Get().
		AbsPath(fmt.Sprintf("/apis/metrics.k8s.io/v1beta1/namespaces/%s/pods/%s", namespace, name)).
		DoRaw(ctx)
	if err != nil {
		return nil, err
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
		return nil, err
	}

	result := make(map[string]ContainerMetrics)
	for _, c := range resp.Containers {
		cpu, err := resource.ParseQuantity(c.Usage.CPU)
		if err != nil {
			continue
		}
		mem, err := resource.ParseQuantity(c.Usage.Memory)
		if err != nil {
			continue
		}
		result[c.Name] = ContainerMetrics{
			CPUMillis: cpu.MilliValue(),
			MemBytes:  mem.Value(),
		}
	}
	return result, nil
}

func (c *Client) GetPodEvents(ctx context.Context, namespace, podName string) ([]corev1.Event, error) {
	list, err := c.cs.CoreV1().Events(namespace).List(ctx, metav1.ListOptions{
		FieldSelector: "involvedObject.name=" + podName,
	})
	if err != nil {
		return nil, err
	}
	return list.Items, nil
}
