package scaler

import (
	"context"
	"fmt"
	"log/slog"
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

// sleepWorkloadParams holds all context needed to process a single workload during sleep.
type sleepWorkloadParams struct {
	ctx     context.Context
	policy  store.Policy
	execID  uint
	logCh   chan<- LogLine
	snapped map[string]bool
}

// sleepWorkload processes a single workload (Deployment or StatefulSet) during a policy sleep.
// Returns: scaled (bool), error occurred (bool).
func (r *PolicyRunner) sleepWorkload(p sleepWorkloadParams, e workloadEntry) (scaled bool, errored bool) {
	wl := formatWorkload(e.Kind, e.Namespace, e.Name)

	if p.snapped[e.Kind+"/"+e.Namespace+"/"+e.Name] {
		emit(p.logCh, "info", fmt.Sprintf("Snapshot already exists for %s (skipping double-sleep)", wl))
		return false, false
	}

	snap := &store.WorkloadSnapshot{
		PolicyID:         p.policy.ID,
		SleepExecutionID: p.execID,
		Kind:             e.Kind,
		Namespace:        e.Namespace,
		Name:             e.Name,
		ReplicasBefore:   e.Replicas,
		WasAlreadyZero:   e.Replicas == 0,
		CapturedAt:       time.Now(),
	}

	if e.Replicas == 0 {
		emit(p.logCh, "info", fmt.Sprintf("Already at 0 replicas: %s (snapshotted, not scaled)", wl))
		if isApply(p.policy.Mode) {
			if err := r.store.CreateWorkloadSnapshot(snap); err != nil {
				slog.Warn("failed to snapshot zero-replica workload", "workload", wl, "err", err)
			}
		}
		return false, false
	}

	if !isApply(p.policy.Mode) {
		emit(p.logCh, "plan", fmt.Sprintf("Would sleep %s → 0 (currently %d replicas)", wl, e.Replicas))
		return true, false
	}

	if err := r.store.CreateWorkloadSnapshot(snap); err != nil {
		emit(p.logCh, "error", fmt.Sprintf("Failed to save snapshot for %s: %s", wl, err))
		return false, true
	}
	if err := e.Annotate(p.ctx, e.Namespace, e.Name, annotationKey, fmt.Sprintf("%d", e.Replicas)); err != nil {
		emit(p.logCh, "warn", fmt.Sprintf("Could not write annotation for %s: %s", wl, err))
	}
	if err := e.Scale(p.ctx, e.Namespace, e.Name, 0); err != nil {
		emit(p.logCh, "error", fmt.Sprintf("Failed to scale %s: %s", wl, err))
		if delErr := r.store.DeleteWorkloadSnapshot(snap.ID); delErr != nil {
			slog.Error("orphaned snapshot: failed to delete after scale failure",
				"snapshotID", snap.ID, "workload", wl, "err", delErr)
			emit(p.logCh, "warn", fmt.Sprintf("Could not remove snapshot for %s: %s", wl, delErr))
		}
		return false, true
	}
	emit(p.logCh, "ok", fmt.Sprintf("Slept %s (was %d replicas)", wl, e.Replicas))
	return true, false
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

	guardrails, err := r.store.GetGuardrails()
	if err != nil {
		return nil, fmt.Errorf("guardrails: %w", err)
	}
	skipNS := splitCSV(guardrails.SystemNamespaces)

	emit(logCh, "info", fmt.Sprintf("Policy sleep — namespace filter: %q  label selector: %q", policy.NamespaceFilter, policy.LabelSelector))

	openSnaps, err := r.store.GetOpenSnapshots(policy.ID)
	if err != nil {
		slog.Warn("failed to fetch open snapshots", "policyID", policy.ID, "err", err)
	}
	snappedSet := make(map[string]bool, len(openSnaps))
	for _, s := range openSnaps {
		snappedSet[s.Kind+"/"+s.Namespace+"/"+s.Name] = true
	}

	swp := sleepWorkloadParams{ctx: ctx, policy: policy, execID: execID, logCh: logCh, snapped: snappedSet}

	// ── Deployments & StatefulSets ────────────────────────────────────────
	emit(logCh, "info", "Fetching Deployments...")
	deps, err := r.base.k8s.ListDeploymentsBySelector(ctx, "", policy.LabelSelector)
	if err != nil {
		emit(logCh, "error", "Failed to list deployments: "+err.Error())
		counts.Errors++
	}

	emit(logCh, "info", "Fetching StatefulSets...")
	ssets, err := r.base.k8s.ListStatefulSetsBySelector(ctx, "", policy.LabelSelector)
	if err != nil {
		emit(logCh, "error", "Failed to list statefulsets: "+err.Error())
		counts.Errors++
	}

	entries := r.base.collectFilteredEntries(deps, ssets, skipNS, policy.NamespaceFilter, counts, true)
	for _, e := range entries {
		e := e
		scaled, errored := r.sleepWorkload(swp, e)
		switch {
		case errored:
			counts.Errors++
		case scaled:
			counts.Scaled++
		default:
			counts.Skipped++
		}
	}

	// ── Drain & Delete Nodes (same as scale_down) ──────────────────────────
	r.base.drainNodes(ctx, policy.Mode, guardrails, logCh, counts)

	emit(logCh, "info", fmt.Sprintf("Sleep complete — scaled %d workloads, %d skipped, %d errors",
		counts.Scaled, counts.Skipped, counts.Errors))
	return counts, nil
}

// lookupWorkload checks if a workload still exists in the cluster and returns its current replicas.
func (r *PolicyRunner) lookupWorkload(ctx context.Context, kind, namespace, name string) (exists bool, currentReplicas int32) {
	switch kind {
	case "Deployment":
		d, err := r.base.k8s.GetDeployment(ctx, namespace, name)
		if err != nil {
			return false, 0
		}
		if d.Spec.Replicas != nil {
			return true, *d.Spec.Replicas
		}
		return true, 0
	case "StatefulSet":
		ss, err := r.base.k8s.GetStatefulSet(ctx, namespace, name)
		if err != nil {
			return false, 0
		}
		if ss.Spec.Replicas != nil {
			return true, *ss.Spec.Replicas
		}
		return true, 0
	}
	return false, 0
}

// restoreWorkload scales a workload back to its target replicas and removes the annotation.
func (r *PolicyRunner) restoreWorkload(ctx context.Context, kind, namespace, name string, target int32) error {
	switch kind {
	case "Deployment":
		if err := r.base.k8s.ScaleDeployment(ctx, namespace, name, target); err != nil {
			return err
		}
		_ = r.base.k8s.RemoveDeploymentAnnotation(ctx, namespace, name, annotationKey)
	case "StatefulSet":
		if err := r.base.k8s.ScaleStatefulSet(ctx, namespace, name, target); err != nil {
			return err
		}
		_ = r.base.k8s.RemoveStatefulSetAnnotation(ctx, namespace, name, annotationKey)
	}
	return nil
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
				if err := r.store.CloseSnapshot(snap.ID, execID, 0); err != nil {
					slog.Warn("failed to close zero-replica snapshot", "snapshotID", snap.ID, "err", err)
				}
			}
			counts.Skipped++
			continue
		}

		exists, currentReplicas := r.lookupWorkload(ctx, snap.Kind, snap.Namespace, snap.Name)
		if !exists {
			emit(logCh, "warn", fmt.Sprintf("Workload %s no longer exists — skipping restore", wl))
			if isApply(policy.Mode) {
				if err := r.store.MarkSnapshotDeletedAtWake(snap.ID, execID); err != nil {
					slog.Warn("failed to mark snapshot as deleted at wake", "snapshotID", snap.ID, "err", err)
				}
			}
			counts.Skipped++
			continue
		}

		if currentReplicas != 0 {
			emit(logCh, "warn", fmt.Sprintf(
				"Workload %s was externally scaled to %d while sleeping — restoring to %d anyway",
				wl, currentReplicas, snap.ReplicasBefore,
			))
			if isApply(policy.Mode) {
				if err := r.store.MarkSnapshotExternallyScaled(snap.ID); err != nil {
					slog.Warn("failed to mark snapshot as externally scaled", "snapshotID", snap.ID, "err", err)
				}
			}
		}

		target := snap.ReplicasBefore
		if !isApply(policy.Mode) {
			emit(logCh, "plan", fmt.Sprintf("Would restore %s → %d replicas", wl, target))
			counts.Scaled++
			continue
		}

		if err := r.restoreWorkload(ctx, snap.Kind, snap.Namespace, snap.Name, target); err != nil {
			emit(logCh, "error", fmt.Sprintf("Failed to restore %s: %s", wl, err))
			counts.Errors++
			continue
		}
		if err := r.store.CloseSnapshot(snap.ID, execID, target); err != nil {
			slog.Warn("failed to close snapshot after restore", "snapshotID", snap.ID, "err", err)
		}
		emit(logCh, "ok", fmt.Sprintf("Restored %s → %d replicas", wl, target))
		counts.Scaled++
	}

	emit(logCh, "info", fmt.Sprintf("Wake complete — restored %d workloads, %d skipped, %d errors",
		counts.Scaled, counts.Skipped, counts.Errors))
	return counts, nil
}
