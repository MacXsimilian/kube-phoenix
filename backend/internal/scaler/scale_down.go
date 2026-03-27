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

// RunScaleDown scales all Deployments and StatefulSets to 0 (excluding skip namespaces)
// and drains + deletes non-protected nodes.
// namespaceFilter: comma-separated list of namespaces to target; empty = all.
func (r *Runner) RunScaleDown(ctx context.Context, mode, namespaceFilter string, logCh chan<- LogLine) (*Counts, error) {
	counts := &Counts{}

	g, err := r.store.GetGuardrails()
	if err != nil {
		return nil, fmt.Errorf("guardrails: %w", err)
	}

	skipNS := mergeCSV(g.SystemNamespaces, g.SkipNamespaces)

	// ── Scale Deployments & StatefulSets ─────────────────────────────────
	r.info(logCh, "Fetching Deployments...")
	deployments, dErr := r.k8s.ListDeployments(ctx, "")
	if dErr != nil {
		r.errLog(logCh, "Failed to list deployments: "+dErr.Error())
		counts.Errors++
	}

	r.info(logCh, "Fetching StatefulSets...")
	statefulsets, ssErr := r.k8s.ListStatefulSets(ctx, "")
	if ssErr != nil {
		r.errLog(logCh, "Failed to list statefulsets: "+ssErr.Error())
		counts.Errors++
	}

	entries := r.collectFilteredEntries(deployments, statefulsets, filterOptions{
		skipNamespaces:  skipNS,
		namespaceFilter: namespaceFilter,
		countSkipped:    true,
	}, counts)
	r.scaleDownWorkloads(ctx, mode, entries, logCh, counts)

	// ── Drain & Delete Nodes ──────────────────────────────────────────────
	r.drainNodes(ctx, mode, g, logCh, counts)

	return counts, nil
}

// nodeWorkloadInfo holds per-node pod accounting derived from the pod list.
type nodeWorkloadInfo struct {
	// criticalNodes is the set of node names that host pods from skip-namespaces.
	criticalNodes map[string]bool
	// podCountPerNode counts non-DaemonSet pods per node (used to size drain timeout).
	podCountPerNode map[string]int
}

// identifyNodeWorkloads scans allPods and returns per-node workload info.
// Nodes hosting pods in skipNsNode are marked critical (protected from drain).
func identifyNodeWorkloads(allPods []corev1.Pod, skipNsNode map[string]bool) nodeWorkloadInfo {
	info := nodeWorkloadInfo{
		criticalNodes:   make(map[string]bool),
		podCountPerNode: make(map[string]int),
	}
	for _, pod := range allPods {
		if skipNsNode[pod.Namespace] {
			info.criticalNodes[pod.Spec.NodeName] = true
		}
		isDaemon := false
		for _, ref := range pod.OwnerReferences {
			if ref.Kind == "DaemonSet" {
				isDaemon = true
				break
			}
		}
		if !isDaemon {
			info.podCountPerNode[pod.Spec.NodeName]++
		}
	}
	return info
}

// isNodeGuardrailProtected returns true when the node matches any label or taint
// protection rule defined in the guardrails configuration.
func isNodeGuardrailProtected(node corev1.Node, g *store.Guardrails) bool {
	return isLabelProtected(node.Labels, g.SkipNodeLabels) || isTaintProtected(node.Spec.Taints, g.SkipNodeTaints)
}

// drainNodes handles node draining and deletion during scale-down.
// It delegates pod-counting to identifyNodeWorkloads and protection checks to
// isNodeGuardrailProtected, keeping this function as a thin orchestration loop.
func (r *Runner) drainNodes(ctx context.Context, mode string, g *store.Guardrails, logCh chan<- LogLine, counts *Counts) {
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

	workloadInfo := identifyNodeWorkloads(allPods, splitCSV(g.SkipNsNode))

	for _, node := range nodes {
		name := node.Name

		if isNodeGuardrailProtected(node, g) {
			r.info(logCh, fmt.Sprintf("Protected node %s (label/taint match)", name))
			counts.Protected++
			continue
		}
		if workloadInfo.criticalNodes[name] {
			r.info(logCh, fmt.Sprintf("Protected node %s (running critical workload)", name))
			counts.Protected++
			continue
		}

		podCount := workloadInfo.podCountPerNode[name]
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
