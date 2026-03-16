package scaler

import (
	"context"
	"fmt"
)

// RunScaleUp restores Deployments and StatefulSets from the previous-replicas annotation.
// Nodes are expected to be re-provisioned by Karpenter automatically.
// namespaceFilter: comma-separated list of namespaces to target; empty = all.
func (r *Runner) RunScaleUp(ctx context.Context, mode, namespaceFilter string, logCh chan<- LogLine) (*Counts, error) {
	counts := &Counts{}

	g, err := r.store.GetGuardrails()
	if err != nil {
		return nil, fmt.Errorf("guardrails: %w", err)
	}
	skipNS := mergeCSV(g.SystemNamespaces, g.SkipNamespaces)

	// ── Restore Deployments ────────────────────────────────────────────────
	r.info(logCh, "Fetching Deployments...")
	deployments, err := r.k8s.ListDeployments(ctx, "")
	if err != nil {
		r.errLog(logCh, "Failed to list deployments: "+err.Error())
		counts.Errors++
	} else {
		entries := make([]workloadEntry, 0, len(deployments))
		for _, d := range deployments {
			if skipNS[d.Namespace] || !namespaceAllowed(d.Namespace, namespaceFilter) {
				continue
			}
			replicas := int32(0)
			if d.Spec.Replicas != nil {
				replicas = *d.Spec.Replicas
			}
			entries = append(entries, workloadEntry{
				Kind: "Deployment", Namespace: d.Namespace, Name: d.Name,
				Replicas: replicas, Annotations: d.Annotations,
				Scale: r.k8s.ScaleDeployment, RemoveAnnotation: r.k8s.RemoveDeploymentAnnotation,
			})
		}
		r.restoreWorkloads(ctx, mode, entries, logCh, counts)
	}

	// ── Restore StatefulSets ───────────────────────────────────────────────
	r.info(logCh, "Fetching StatefulSets...")
	statefulsets, err := r.k8s.ListStatefulSets(ctx, "")
	if err != nil {
		r.errLog(logCh, "Failed to list statefulsets: "+err.Error())
		counts.Errors++
	} else {
		entries := make([]workloadEntry, 0, len(statefulsets))
		for _, ss := range statefulsets {
			if skipNS[ss.Namespace] || !namespaceAllowed(ss.Namespace, namespaceFilter) {
				continue
			}
			replicas := int32(0)
			if ss.Spec.Replicas != nil {
				replicas = *ss.Spec.Replicas
			}
			entries = append(entries, workloadEntry{
				Kind: "StatefulSet", Namespace: ss.Namespace, Name: ss.Name,
				Replicas: replicas, Annotations: ss.Annotations,
				Scale: r.k8s.ScaleStatefulSet, RemoveAnnotation: r.k8s.RemoveStatefulSetAnnotation,
			})
		}
		r.restoreWorkloads(ctx, mode, entries, logCh, counts)
	}

	r.info(logCh, fmt.Sprintf("Wake complete — restored %d workloads, %d errors", counts.Scaled, counts.Errors))
	return counts, nil
}
