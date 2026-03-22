package scaler

import (
	"context"
	"fmt"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/k8s"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

// PolicyRunner wraps Runner and adds DB-backed WorkloadSnapshot logic for
// the policy model. RunPolicySleep / RunPolicyWake replace RunScaleDown /
// RunScaleUp when a Policy drives the execution.
type PolicyRunner struct {
	base  *Runner
	store *store.Store
}

// NewPolicyRunner creates a PolicyRunner that reuses the base k8s client and store.
func NewPolicyRunner(k8sClient *k8s.Client, st *store.Store) *PolicyRunner {
	return &PolicyRunner{
		base:  New(k8sClient, st),
		store: st,
	}
}

// RunPolicySleep scales matching workloads to 0 and writes WorkloadSnapshot
// rows to the DB. It also writes the existing k8s annotation as a fallback.
//
// Decision (per design): workloads already at 0 are snapshotted with
// WasAlreadyZero=true and skipped (we did not own those replicas).
func (r *PolicyRunner) RunPolicySleep(
	ctx context.Context,
	policy store.Policy,
	execID uint,
	logCh chan<- LogLine,
) (*Counts, error) {
	counts := &Counts{}

	g, err := r.store.GetGuardrails()
	if err != nil {
		return nil, fmt.Errorf("guardrails: %w", err)
	}
	skipNS := mergeCSV(g.SystemNamespaces, g.SkipNamespaces)

	emit(logCh, "info", fmt.Sprintf("Policy sleep — namespace filter: %q  label selector: %q", policy.NamespaceFilter, policy.LabelSelector))

	// ── Deployments ────────────────────────────────────────────────────────
	emit(logCh, "info", "Fetching Deployments...")
	var deployments []interface{ GetNamespace() string }
	deps, err := r.base.k8s.ListDeploymentsBySelector(ctx, "", policy.LabelSelector)
	if err != nil {
		emit(logCh, "error", "Failed to list deployments: "+err.Error())
		counts.Errors++
	} else {
		for _, d := range deps {
			d := d
			if skipNS[d.Namespace] || !namespaceAllowed(d.Namespace, policy.NamespaceFilter) {
				counts.Skipped++
				continue
			}
			replicas := int32(0)
			if d.Spec.Replicas != nil {
				replicas = *d.Spec.Replicas
			}
			_ = deployments // suppress unused

			wl := formatWorkload("Deployment", d.Namespace, d.Name)

			// Check for existing open snapshot (double-sleep guard)
			open, snapErr := r.store.GetOpenSnapshots(policy.ID)
			if snapErr == nil {
				alreadySnapped := false
				for _, s := range open {
					if s.Kind == "Deployment" && s.Namespace == d.Namespace && s.Name == d.Name {
						alreadySnapped = true
						break
					}
				}
				if alreadySnapped {
					emit(logCh, "info", fmt.Sprintf("Snapshot already exists for %s (skipping double-sleep)", wl))
					counts.Skipped++
					continue
				}
			}

			snap := &store.WorkloadSnapshot{
				PolicyID:         policy.ID,
				SleepExecutionID: execID,
				Kind:             "Deployment",
				Namespace:        d.Namespace,
				Name:             d.Name,
				ReplicasBefore:   replicas,
				WasAlreadyZero:   replicas == 0,
				CapturedAt:       time.Now(),
			}

			if replicas == 0 {
				emit(logCh, "info", fmt.Sprintf("Already at 0 replicas: %s (snapshotted, not scaled)", wl))
				if isApply(policy.Mode) {
					_ = r.store.CreateWorkloadSnapshot(snap)
				}
				counts.Skipped++
				continue
			}

			if isApply(policy.Mode) {
				if err := r.store.CreateWorkloadSnapshot(snap); err != nil {
					emit(logCh, "error", fmt.Sprintf("Failed to save snapshot for %s: %s", wl, err))
					counts.Errors++
					continue
				}
				// Belt-and-suspenders: also write k8s annotation
				if err := r.base.k8s.AnnotateDeployment(ctx, d.Namespace, d.Name, annotationKey, fmt.Sprintf("%d", replicas)); err != nil {
					emit(logCh, "warn", fmt.Sprintf("Could not write annotation for %s: %s", wl, err))
				}
				if err := r.base.k8s.ScaleDeployment(ctx, d.Namespace, d.Name, 0); err != nil {
					emit(logCh, "error", fmt.Sprintf("Failed to scale %s: %s", wl, err))
					// Remove snapshot since scale failed
					r.store.DeleteWorkloadSnapshot(snap.ID)
					counts.Errors++
					continue
				}
				emit(logCh, "ok", fmt.Sprintf("Slept %s (was %d replicas)", wl, replicas))
			} else {
				emit(logCh, "plan", fmt.Sprintf("Would sleep %s → 0 (currently %d replicas)", wl, replicas))
			}
			counts.Scaled++
		}
	}

	// ── StatefulSets ───────────────────────────────────────────────────────
	emit(logCh, "info", "Fetching StatefulSets...")
	ssets, err := r.base.k8s.ListStatefulSetsBySelector(ctx, "", policy.LabelSelector)
	if err != nil {
		emit(logCh, "error", "Failed to list statefulsets: "+err.Error())
		counts.Errors++
	} else {
		for _, ss := range ssets {
			ss := ss
			if skipNS[ss.Namespace] || !namespaceAllowed(ss.Namespace, policy.NamespaceFilter) {
				counts.Skipped++
				continue
			}
			replicas := int32(0)
			if ss.Spec.Replicas != nil {
				replicas = *ss.Spec.Replicas
			}
			wl := formatWorkload("StatefulSet", ss.Namespace, ss.Name)

			open, snapErr := r.store.GetOpenSnapshots(policy.ID)
			if snapErr == nil {
				alreadySnapped := false
				for _, s := range open {
					if s.Kind == "StatefulSet" && s.Namespace == ss.Namespace && s.Name == ss.Name {
						alreadySnapped = true
						break
					}
				}
				if alreadySnapped {
					emit(logCh, "info", fmt.Sprintf("Snapshot already exists for %s (skipping double-sleep)", wl))
					counts.Skipped++
					continue
				}
			}

			snap := &store.WorkloadSnapshot{
				PolicyID:         policy.ID,
				SleepExecutionID: execID,
				Kind:             "StatefulSet",
				Namespace:        ss.Namespace,
				Name:             ss.Name,
				ReplicasBefore:   replicas,
				WasAlreadyZero:   replicas == 0,
				CapturedAt:       time.Now(),
			}

			if replicas == 0 {
				emit(logCh, "info", fmt.Sprintf("Already at 0 replicas: %s (snapshotted, not scaled)", wl))
				if isApply(policy.Mode) {
					_ = r.store.CreateWorkloadSnapshot(snap)
				}
				counts.Skipped++
				continue
			}

			if isApply(policy.Mode) {
				if err := r.store.CreateWorkloadSnapshot(snap); err != nil {
					emit(logCh, "error", fmt.Sprintf("Failed to save snapshot for %s: %s", wl, err))
					counts.Errors++
					continue
				}
				if err := r.base.k8s.AnnotateStatefulSet(ctx, ss.Namespace, ss.Name, annotationKey, fmt.Sprintf("%d", replicas)); err != nil {
					emit(logCh, "warn", fmt.Sprintf("Could not write annotation for %s: %s", wl, err))
				}
				if err := r.base.k8s.ScaleStatefulSet(ctx, ss.Namespace, ss.Name, 0); err != nil {
					emit(logCh, "error", fmt.Sprintf("Failed to scale %s: %s", wl, err))
					r.store.DeleteWorkloadSnapshot(snap.ID)
					counts.Errors++
					continue
				}
				emit(logCh, "ok", fmt.Sprintf("Slept %s (was %d replicas)", wl, replicas))
			} else {
				emit(logCh, "plan", fmt.Sprintf("Would sleep %s → 0 (currently %d replicas)", wl, replicas))
			}
			counts.Scaled++
		}
	}

	// ── Drain & Delete Nodes (same as scale_down) ──────────────────────────
	r.base.drainNodes(ctx, policy.Mode, g, logCh, counts)

	emit(logCh, "info", fmt.Sprintf("Sleep complete — scaled %d workloads, %d skipped, %d errors",
		counts.Scaled, counts.Skipped, counts.Errors))
	return counts, nil
}

// RunPolicyWake restores workloads from DB snapshots.
//
// Decision (per design): always restore to ReplicasBefore, even if the workload
// was manually scaled while sleeping. Log a warning when this happens.
func (r *PolicyRunner) RunPolicyWake(
	ctx context.Context,
	policy store.Policy,
	execID uint,
	logCh chan<- LogLine,
) (*Counts, error) {
	counts := &Counts{}

	snaps, err := r.store.GetOpenSnapshots(policy.ID)
	if err != nil {
		return nil, fmt.Errorf("get open snapshots: %w", err)
	}

	emit(logCh, "info", fmt.Sprintf("Policy wake — restoring %d snapshotted workloads", len(snaps)))

	for _, snap := range snaps {
		snap := snap
		wl := formatWorkload(snap.Kind, snap.Namespace, snap.Name)

		if snap.WasAlreadyZero {
			emit(logCh, "info", fmt.Sprintf("Skipping %s — was already at 0 before sleep (not owned by this policy)", wl))
			if isApply(policy.Mode) {
				_ = r.store.CloseSnapshot(snap.ID, execID, 0)
			}
			counts.Skipped++
			continue
		}

		// Check workload still exists and get current replicas
		var currentReplicas int32
		var exists bool

		switch snap.Kind {
		case "Deployment":
			deps, listErr := r.base.k8s.ListDeploymentsBySelector(ctx, snap.Namespace, "")
			if listErr == nil {
				for _, d := range deps {
					if d.Name == snap.Name {
						exists = true
						if d.Spec.Replicas != nil {
							currentReplicas = *d.Spec.Replicas
						}
						break
					}
				}
			}
		case "StatefulSet":
			ssets, listErr := r.base.k8s.ListStatefulSetsBySelector(ctx, snap.Namespace, "")
			if listErr == nil {
				for _, ss := range ssets {
					if ss.Name == snap.Name {
						exists = true
						if ss.Spec.Replicas != nil {
							currentReplicas = *ss.Spec.Replicas
						}
						break
					}
				}
			}
		}

		if !exists {
			emit(logCh, "warn", fmt.Sprintf("Workload %s no longer exists — skipping restore", wl))
			if isApply(policy.Mode) {
				_ = r.store.MarkSnapshotDeletedAtWake(snap.ID, execID)
			}
			counts.Skipped++
			continue
		}

		// Detect external scaling (someone changed replicas while sleeping)
		if currentReplicas != 0 {
			emit(logCh, "warn", fmt.Sprintf(
				"Workload %s was externally scaled to %d while sleeping — restoring to %d anyway",
				wl, currentReplicas, snap.ReplicasBefore,
			))
			if isApply(policy.Mode) {
				_ = r.store.MarkSnapshotExternallyScaled(snap.ID)
			}
		}

		target := snap.ReplicasBefore
		if isApply(policy.Mode) {
			var scaleErr error
			switch snap.Kind {
			case "Deployment":
				scaleErr = r.base.k8s.ScaleDeployment(ctx, snap.Namespace, snap.Name, target)
				if scaleErr == nil {
					_ = r.base.k8s.RemoveDeploymentAnnotation(ctx, snap.Namespace, snap.Name, annotationKey)
				}
			case "StatefulSet":
				scaleErr = r.base.k8s.ScaleStatefulSet(ctx, snap.Namespace, snap.Name, target)
				if scaleErr == nil {
					_ = r.base.k8s.RemoveStatefulSetAnnotation(ctx, snap.Namespace, snap.Name, annotationKey)
				}
			}
			if scaleErr != nil {
				emit(logCh, "error", fmt.Sprintf("Failed to restore %s: %s", wl, scaleErr))
				counts.Errors++
				continue
			}
			_ = r.store.CloseSnapshot(snap.ID, execID, target)
			emit(logCh, "ok", fmt.Sprintf("Restored %s → %d replicas", wl, target))
		} else {
			emit(logCh, "plan", fmt.Sprintf("Would restore %s → %d replicas", wl, target))
		}
		counts.Scaled++
	}

	emit(logCh, "info", fmt.Sprintf("Wake complete — restored %d workloads, %d skipped, %d errors",
		counts.Scaled, counts.Skipped, counts.Errors))
	return counts, nil
}
