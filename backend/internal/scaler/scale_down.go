package scaler

import (
	"context"
	"fmt"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	corev1 "k8s.io/api/core/v1"
)

const (
	drainTimeoutPerPod = 15 // seconds per pod
	drainTimeoutBase   = 60 // base seconds
)

// classifyNodes groups pods by node, identifying which nodes run critical
// workloads (pods in protected namespaces) and how many evictable (non-DaemonSet)
// pods each node has.
func classifyNodes(pods []corev1.Pod, skipNsNode map[string]bool) (criticalNodes map[string]bool, podCountPerNode map[string]int) {
	criticalNodes = map[string]bool{}
	podCountPerNode = map[string]int{}
	for _, pod := range pods {
		if skipNsNode[pod.Namespace] {
			criticalNodes[pod.Spec.NodeName] = true
		}
		isDaemon := false
		for _, ref := range pod.OwnerReferences {
			if ref.Kind == "DaemonSet" {
				isDaemon = true
				break
			}
		}
		if !isDaemon {
			podCountPerNode[pod.Spec.NodeName]++
		}
	}
	return criticalNodes, podCountPerNode
}

// drainNodes handles node draining and deletion during scale-down.
func (r *Runner) drainNodes(ctx context.Context, mode string, guardrails *store.Guardrails, logCh chan<- LogLine, counts *Counts) {
	r.info(logCh, "Fetching nodes...")
	nodes, err := r.k8s.ListNodes(ctx)
	if err != nil {
		r.errLog(logCh, "Failed to list nodes: "+err.Error())
		counts.Errors++
		return
	}

	r.info(logCh, "Identifying nodes with critical workloads...")
	allPods, err := r.k8s.ListAllPods(ctx)
	if err != nil {
		r.errLog(logCh, "Failed to list pods: "+err.Error())
		counts.Errors++
		return
	}

	skipNsNode := splitCSV(guardrails.SkipNsNode)
	criticalNodes, podCountPerNode := classifyNodes(allPods, skipNsNode)

	for _, node := range nodes {
		name := node.Name

		if isLabelProtected(node.Labels, guardrails.SkipNodeLabels) || isTaintProtected(node.Spec.Taints, guardrails.SkipNodeTaints) {
			r.info(logCh, fmt.Sprintf("Protected node %s (label/taint match)", name))
			counts.Protected++
			continue
		}
		if criticalNodes[name] {
			r.info(logCh, fmt.Sprintf("Protected node %s (running critical workload)", name))
			counts.Protected++
			continue
		}

		podCount := podCountPerNode[name]
		drainTimeout := time.Duration(podCount*drainTimeoutPerPod+drainTimeoutBase) * time.Second
		r.drainAndDeleteNode(ctx, mode, name, podCount, drainTimeout, logCh, counts)
	}
}

// drainAndDeleteNode drains and deletes a single node.
func (r *Runner) drainAndDeleteNode(ctx context.Context, mode, name string, podCount int, drainTimeout time.Duration, logCh chan<- LogLine, counts *Counts) {
	if !isApply(mode) {
		r.plan(logCh, fmt.Sprintf("Would drain node %s (pods=%d timeout=%s)", name, podCount, drainTimeout))
		r.plan(logCh, fmt.Sprintf("Would delete node object %s", name))
		counts.Drained++
		counts.Deleted++
		return
	}

	r.info(logCh, fmt.Sprintf("Draining node %s (pods=%d timeout=%s)...", name, podCount, drainTimeout))
	if err := r.k8s.DrainNode(ctx, name, drainTimeout); err != nil {
		r.errLog(logCh, fmt.Sprintf("Drain failed for %s: %s", name, err))
		counts.Errors++
		return
	}
	r.ok(logCh, fmt.Sprintf("Drained node %s", name))
	counts.Drained++

	if err := r.k8s.DeleteNode(ctx, name); err != nil {
		r.errLog(logCh, fmt.Sprintf("Failed to delete node %s: %s", name, err))
		counts.Errors++
	} else {
		r.ok(logCh, fmt.Sprintf("Deleted node object %s", name))
		counts.Deleted++
	}
}
