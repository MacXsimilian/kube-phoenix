package scaler

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"gorm.io/gorm"

	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

// RunScaleUp restores Deployments and StatefulSets from workload_snapshots.
// Falls back to previous-replicas annotation for v1 migration (FR-46).
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

			// FR-41: query workload_snapshots for oldest unrestored row
			snap, err := r.store.GetLatestUnrestored(ns, name)
			if err == gorm.ErrRecordNotFound || snap == nil {
				// FR-46: v1 migration fallback — check previous-replicas annotation
				if saved, ok := d.Annotations[annotationKey]; ok && saved != "" {
					savedInt, parseErr := strconv.ParseInt(saved, 10, 32)
					if parseErr != nil {
						r.errLog(logCh, fmt.Sprintf("Invalid annotation on Deployment %s/%s: %s", ns, name, saved))
						counts.Errors++
						continue
					}
					r.warn(logCh, fmt.Sprintf("No DB snapshot for %s — falling back to annotation (v1 migration)", wl))

					if isApply(mode) {
						// Create retroactive snapshot
						retroSnap := &store.WorkloadSnapshot{
							SleepExecutionID: execID, // use wake exec as proxy (no sleep exec known)
							Namespace:        ns,
							WorkloadName:     name,
							WorkloadKind:     "Deployment",
							ReplicasBefore:   int(savedInt),
							SnapshottedAt:    time.Now(),
						}
						if policy != nil {
							retroSnap.PolicyID = &policy.ID
						}
						if err := r.store.CreateWorkloadSnapshot(retroSnap); err != nil {
							r.errLog(logCh, fmt.Sprintf("Failed to create retroactive snapshot for %s: %s", wl, err))
							counts.Errors++
							continue
						}

						if err := r.k8s.ScaleDeployment(ctx, ns, name, int32(savedInt)); err != nil {
							r.errLog(logCh, fmt.Sprintf("Failed to scale up %s: %s", wl, err))
							counts.Errors++
							continue
						}
						r.ok(logCh, fmt.Sprintf("Restored %s → %d (via annotation fallback)", wl, savedInt))

						// Remove annotation
						if err := r.k8s.RemoveDeploymentAnnotation(ctx, ns, name, annotationKey); err != nil {
							r.errLog(logCh, fmt.Sprintf("Failed to remove annotation from %s: %s", wl, err))
						}

						// Mark the retroactive snapshot as restored
						restored := int(savedInt)
						wakeID := execID
						if err := r.store.MarkSnapshotRestored(retroSnap.ID, wakeID, restored); err != nil {
							r.errLog(logCh, fmt.Sprintf("Failed to mark retroactive snapshot restored for %s: %s", wl, err))
						}
					} else {
						r.plan(logCh, fmt.Sprintf("Would restore %s → %d (via annotation fallback)", wl, savedInt))
					}
					counts.Scaled++
					continue
				}

				// FR-42: no snapshot and no annotation — log warn and skip
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

				// FR-43: mark snapshot restored
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
				// v1 migration fallback
				if saved, ok := ss.Annotations[annotationKey]; ok && saved != "" {
					savedInt, parseErr := strconv.ParseInt(saved, 10, 32)
					if parseErr != nil {
						r.errLog(logCh, fmt.Sprintf("Invalid annotation on StatefulSet %s/%s: %s", ns, name, saved))
						counts.Errors++
						continue
					}
					r.warn(logCh, fmt.Sprintf("No DB snapshot for %s — falling back to annotation (v1 migration)", wl))

					if isApply(mode) {
						retroSnap := &store.WorkloadSnapshot{
							SleepExecutionID: execID,
							Namespace:        ns,
							WorkloadName:     name,
							WorkloadKind:     "StatefulSet",
							ReplicasBefore:   int(savedInt),
							SnapshottedAt:    time.Now(),
						}
						if policy != nil {
							retroSnap.PolicyID = &policy.ID
						}
						if err := r.store.CreateWorkloadSnapshot(retroSnap); err != nil {
							r.errLog(logCh, fmt.Sprintf("Failed to create retroactive snapshot for %s: %s", wl, err))
							counts.Errors++
							continue
						}

						if err := r.k8s.ScaleStatefulSet(ctx, ns, name, int32(savedInt)); err != nil {
							r.errLog(logCh, fmt.Sprintf("Failed to scale up %s: %s", wl, err))
							counts.Errors++
							continue
						}
						r.ok(logCh, fmt.Sprintf("Restored %s → %d (via annotation fallback)", wl, savedInt))

						if err := r.k8s.RemoveStatefulSetAnnotation(ctx, ns, name, annotationKey); err != nil {
							r.errLog(logCh, fmt.Sprintf("Failed to remove annotation from %s: %s", wl, err))
						}

						restored := int(savedInt)
						if err := r.store.MarkSnapshotRestored(retroSnap.ID, execID, restored); err != nil {
							r.errLog(logCh, fmt.Sprintf("Failed to mark retroactive snapshot restored for %s: %s", wl, err))
						}
					} else {
						r.plan(logCh, fmt.Sprintf("Would restore %s → %d (via annotation fallback)", wl, savedInt))
					}
					counts.Scaled++
					continue
				}

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

// RunScaleUpLegacy is the v1 backward-compat scale-up using annotations.
func (r *Runner) RunScaleUpLegacy(ctx context.Context, mode, namespaceFilter string, logCh chan<- LogLine) (*Counts, error) {
	counts := &Counts{}

	g, err := r.store.GetGuardrails()
	if err != nil {
		return nil, fmt.Errorf("guardrails: %w", err)
	}
	skipNS := splitCSV(g.SkipNamespaces)

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
			if skipNS[ns] || !namespaceAllowed(ns, namespaceFilter) {
				continue
			}
			savedStr, ok := d.Annotations[annotationKey]
			if !ok {
				counts.Skipped++
				continue
			}
			saved, err := strconv.ParseInt(savedStr, 10, 32)
			if err != nil {
				r.errLog(logCh, fmt.Sprintf("Invalid annotation on Deployment %s/%s: %s", ns, name, savedStr))
				counts.Errors++
				continue
			}
			wl := formatWorkload("Deployment", ns, name)

			if isApply(mode) {
				if err := r.k8s.ScaleDeployment(ctx, ns, name, int32(saved)); err != nil {
					r.errLog(logCh, fmt.Sprintf("Failed to scale up %s: %s", wl, err))
					counts.Errors++
					continue
				}
				r.ok(logCh, fmt.Sprintf("Restored %s → %d", wl, saved))
				if err := r.k8s.RemoveDeploymentAnnotation(ctx, ns, name, annotationKey); err != nil {
					r.errLog(logCh, fmt.Sprintf("Failed to remove annotation from %s: %s", wl, err))
				}
			} else {
				r.plan(logCh, fmt.Sprintf("Would restore %s → %d", wl, saved))
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
			if skipNS[ns] || !namespaceAllowed(ns, namespaceFilter) {
				continue
			}
			savedStr, ok := ss.Annotations[annotationKey]
			if !ok {
				counts.Skipped++
				continue
			}
			saved, err := strconv.ParseInt(savedStr, 10, 32)
			if err != nil {
				r.errLog(logCh, fmt.Sprintf("Invalid annotation on StatefulSet %s/%s: %s", ns, name, savedStr))
				counts.Errors++
				continue
			}
			wl := formatWorkload("StatefulSet", ns, name)

			if isApply(mode) {
				if err := r.k8s.ScaleStatefulSet(ctx, ns, name, int32(saved)); err != nil {
					r.errLog(logCh, fmt.Sprintf("Failed to scale up %s: %s", wl, err))
					counts.Errors++
					continue
				}
				r.ok(logCh, fmt.Sprintf("Restored %s → %d", wl, saved))
				if err := r.k8s.RemoveStatefulSetAnnotation(ctx, ns, name, annotationKey); err != nil {
					r.errLog(logCh, fmt.Sprintf("Failed to remove annotation from %s: %s", wl, err))
				}
			} else {
				r.plan(logCh, fmt.Sprintf("Would restore %s → %d", wl, saved))
			}
			counts.Scaled++
		}
	}

	r.info(logCh, fmt.Sprintf("Wake complete — restored %d workloads, %d errors", counts.Scaled, counts.Errors))
	return counts, nil
}
