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

	// ── Restore Deployments & StatefulSets ───────────────────────────────
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

	entries := r.collectFilteredEntries(deployments, statefulsets, skipNS, namespaceFilter, counts, false)
	r.restoreWorkloads(ctx, mode, entries, logCh, counts)

	r.info(logCh, fmt.Sprintf("Wake complete — restored %d workloads, %d errors", counts.Scaled, counts.Errors))
	return counts, nil
}
