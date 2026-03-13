package scaler

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

// RunScaleUp restores Deployments and StatefulSets from workload_snapshots.
// Nodes are expected to be re-provisioned by Karpenter automatically.
func (r *Runner) RunScaleUp(ctx context.Context, policy *store.SleepPolicy, execID uint, logCh chan<- LogLine) (*Counts, error) {
	counts := &Counts{}

	g, err := r.store.GetGuardrails()
	if err != nil {
		return nil, fmt.Errorf("guardrails: %w", err)
	}

	// Load per-policy guardrails
	var pg *store.PolicyGuardrails
	if policy != nil {
		pg, _ = r.store.GetPolicyGuardrails(policy.ID)
	}

	globalSkipNS := splitCSV(g.SkipNamespaces)
	var policySkipNS map[string]bool
	var policySkipWorkloads map[string]bool
	if pg != nil {
		policySkipNS = splitCSV(pg.SkipNamespaces)
		policySkipWorkloads = splitCSV(pg.SkipWorkloads)
	}

	namespaceFilter := ""
	mode := "plan"
	if policy != nil {
		namespaceFilter = policy.NamespaceFilter
		mode = policy.Mode
	}

	// ── Restore Deployments ────────────────────────────────────────────────
	r.info(logCh, "Fetching Deployments...")
	deployments, err := r.k8s.ListDeployments(ctx, "")
	if err != nil {
		r.errLog(logCh, "Failed to list deployments: "+err.Error())
		counts.Errors++
	} else {
		for _, d := range deployments {
			ns := d.Namespace
			name := d.Name

			// Guardrail evaluation
			if globalSkipNS[ns] {
				continue
			}
			if !namespaceAllowed(ns, namespaceFilter) {
				continue
			}
			if policySkipNS[ns] {
				continue
			}
			if policySkipWorkloads[name] {
				continue
			}

			wl := formatWorkload("Deployment", ns, name)

			snap, err := r.store.GetLatestUnrestored(ns, name)
			if err == gorm.ErrRecordNotFound || snap == nil {
				r.warn(logCh, fmt.Sprintf("No snapshot found for %s — skipping", wl))
				counts.Skipped++
				continue
			}
			if err != nil {
				r.errLog(logCh, fmt.Sprintf("Snapshot lookup failed for %s: %s", wl, err))
				counts.Errors++
				continue
			}

			if isApply(mode) {
				if err := r.k8s.ScaleDeployment(ctx, ns, name, int32(snap.ReplicasBefore)); err != nil {
					r.errLog(logCh, fmt.Sprintf("Failed to scale up %s: %s", wl, err))
					counts.Errors++
					continue
				}
				r.ok(logCh, fmt.Sprintf("Restored %s → %d", wl, snap.ReplicasBefore))

				if err := r.store.MarkSnapshotRestored(snap.ID, execID, snap.ReplicasBefore); err != nil {
					r.errLog(logCh, fmt.Sprintf("Failed to mark snapshot restored for %s: %s", wl, err))
				}
			} else {
				r.plan(logCh, fmt.Sprintf("Would restore %s → %d", wl, snap.ReplicasBefore))
			}
			counts.Scaled++
		}
	}

	// ── Restore StatefulSets ───────────────────────────────────────────────
	r.info(logCh, "Fetching StatefulSets...")
	statefulsets, err := r.k8s.ListStatefulSets(ctx, "")
	if err != nil {
		r.errLog(logCh, "Failed to list statefulsets: "+err.Error())
		counts.Errors++
	} else {
		for _, ss := range statefulsets {
			ns := ss.Namespace
			name := ss.Name

			if globalSkipNS[ns] {
				continue
			}
			if !namespaceAllowed(ns, namespaceFilter) {
				continue
			}
			if policySkipNS[ns] {
				continue
			}
			if policySkipWorkloads[name] {
				continue
			}

			wl := formatWorkload("StatefulSet", ns, name)

			snap, err := r.store.GetLatestUnrestored(ns, name)
			if err == gorm.ErrRecordNotFound || snap == nil {
				r.warn(logCh, fmt.Sprintf("No snapshot found for %s — skipping", wl))
				counts.Skipped++
				continue
			}
			if err != nil {
				r.errLog(logCh, fmt.Sprintf("Snapshot lookup failed for %s: %s", wl, err))
				counts.Errors++
				continue
			}

			if isApply(mode) {
				if err := r.k8s.ScaleStatefulSet(ctx, ns, name, int32(snap.ReplicasBefore)); err != nil {
					r.errLog(logCh, fmt.Sprintf("Failed to scale up %s: %s", wl, err))
					counts.Errors++
					continue
				}
				r.ok(logCh, fmt.Sprintf("Restored %s → %d", wl, snap.ReplicasBefore))

				if err := r.store.MarkSnapshotRestored(snap.ID, execID, snap.ReplicasBefore); err != nil {
					r.errLog(logCh, fmt.Sprintf("Failed to mark snapshot restored for %s: %s", wl, err))
				}
			} else {
				r.plan(logCh, fmt.Sprintf("Would restore %s → %d", wl, snap.ReplicasBefore))
			}
			counts.Scaled++
		}
	}

	r.info(logCh, fmt.Sprintf("Wake complete — restored %d workloads, %d skipped, %d errors", counts.Scaled, counts.Skipped, counts.Errors))
	return counts, nil
}
