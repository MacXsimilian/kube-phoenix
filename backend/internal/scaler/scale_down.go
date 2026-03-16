package scaler

import (
	"context"
	"fmt"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
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

	// ── Scale Deployments ──────────────────────────────────────────────────
	r.info(logCh, "Fetching Deployments...")
	deployments, err := r.k8s.ListDeployments(ctx, "")
	if err != nil {
		r.errLog(logCh, "Failed to list deployments: "+err.Error())
		counts.Errors++
	} else {
		entries := make([]workloadEntry, 0, len(deployments))
		for _, d := range deployments {
			if skipNS[d.Namespace] || !namespaceAllowed(d.Namespace, namespaceFilter) {
				counts.Skipped++
				continue
			}
			replicas := int32(0)
			if d.Spec.Replicas != nil {
				replicas = *d.Spec.Replicas
			}
			entries = append(entries, workloadEntry{
				Kind: "Deployment", Namespace: d.Namespace, Name: d.Name,
				Replicas: replicas, Annotations: d.Annotations,
				Annotate: r.k8s.AnnotateDeployment, Scale: r.k8s.ScaleDeployment,
			})
		}
		r.scaleDownWorkloads(ctx, mode, entries, logCh, counts)
	}

	// ── Scale StatefulSets ─────────────────────────────────────────────────
	r.info(logCh, "Fetching StatefulSets...")
	statefulsets, err := r.k8s.ListStatefulSets(ctx, "")
	if err != nil {
		r.errLog(logCh, "Failed to list statefulsets: "+err.Error())
		counts.Errors++
	} else {
		entries := make([]workloadEntry, 0, len(statefulsets))
		for _, ss := range statefulsets {
			if skipNS[ss.Namespace] || !namespaceAllowed(ss.Namespace, namespaceFilter) {
				counts.Skipped++
				continue
			}
			replicas := int32(0)
			if ss.Spec.Replicas != nil {
				replicas = *ss.Spec.Replicas
			}
			entries = append(entries, workloadEntry{
				Kind: "StatefulSet", Namespace: ss.Namespace, Name: ss.Name,
				Replicas: replicas, Annotations: ss.Annotations,
				Annotate: r.k8s.AnnotateStatefulSet, Scale: r.k8s.ScaleStatefulSet,
			})
		}
		r.scaleDownWorkloads(ctx, mode, entries, logCh, counts)
	}

	// ── Drain & Delete Nodes ──────────────────────────────────────────────
	r.drainNodes(ctx, mode, g, logCh, counts)

	return counts, nil
}

// drainNodes handles node draining and deletion during scale-down.
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

	skipNsNode := splitCSV(g.SkipNsNode)
	criticalNodes := map[string]bool{}
	podCountPerNode := map[string]int{}
	for _, pod := range allPods {
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

	for _, node := range nodes {
		name := node.Name

		if isLabelProtected(node.Labels, g.SkipNodeLabels) || isTaintProtected(node.Spec.Taints, g.SkipNodeTaints) {
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
		drainTimeout := time.Duration(podCount*15+60) * time.Second
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

