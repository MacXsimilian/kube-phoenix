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

// workloadRef identifies a single Deployment or StatefulSet and its current replica count.
type workloadRef struct {
	kind      string
	namespace string
	name      string
	replicas  int32
}

// sleepWorkload processes a single workload (Deployment or StatefulSet) during a policy sleep.
// Returns: scaled (bool), error occurred (bool).
func (r *PolicyRunner) sleepWorkload(p sleepWorkloadParams, ref workloadRef, annotate func() error, scale func() error) (scaled bool, errored bool) {
	wl := formatWorkload(ref.kind, ref.namespace, ref.name)

	if p.snapped[ref.kind+"/"+ref.namespace+"/"+ref.name] {
		emit(p.logCh, "info", fmt.Sprintf("Snapshot already exists for %s (skipping double-sleep)", wl))
		return false, false
	}

	snap := &store.WorkloadSnapshot{
		PolicyID:         p.policy.ID,
		SleepExecutionID: p.execID,
		Kind:             ref.kind,
		Namespace:        ref.namespace,
		Name:             ref.name,
		ReplicasBefore:   ref.replicas,
		WasAlreadyZero:   ref.replicas == 0,
		CapturedAt:       time.Now(),
	}

	if ref.replicas == 0 {
		emit(p.logCh, "info", fmt.Sprintf("Already at 0 replicas: %s (snapshotted, not scaled)", wl))
		if isApply(p.policy.Mode) {
			_ = r.store.CreateWorkloadSnapshot(snap)
		}
		return false, false
	}

	if !isApply(p.policy.Mode) {
		emit(p.logCh, "plan", fmt.Sprintf("Would sleep %s → 0 (currently %d replicas)", wl, ref.replicas))
		return true, false
	}

	if err := r.store.CreateWorkloadSnapshot(snap); err != nil {
		emit(p.logCh, "error", fmt.Sprintf("Failed to save snapshot for %s: %s", wl, err))
		return false, true
	}
	if err := annotate(); err != nil {
		emit(p.logCh, "warn", fmt.Sprintf("Could not write annotation for %s: %s", wl, err))
	}
	if err := scale(); err != nil {
		emit(p.logCh, "error", fmt.Sprintf("Failed to scale %s: %s", wl, err))
		if delErr := r.store.DeleteWorkloadSnapshot(snap.ID); delErr != nil {
			emit(p.logCh, "warn", fmt.Sprintf("Could not remove snapshot for %s: %s", wl, delErr))
		}
		return false, true
	}
	emit(p.logCh, "ok", fmt.Sprintf("Slept %s (was %d replicas)", wl, ref.replicas))
	return true, false
}

// processSleepWorkloads iterates the filtered workload entries and delegates each
// one to sleepWorkload. It returns aggregate scaled, skipped, and error counts.
func (r *PolicyRunner) processSleepWorkloads(ctx context.Context, entries []workloadEntry, swp sleepWorkloadParams) (scaled, skipped, errs int) {
	for _, e := range entries {
		e := e
		didScale, errored := r.sleepWorkload(swp, workloadRef{
			kind:      e.Kind,
			namespace: e.Namespace,
			name:      e.Name,
			replicas:  e.Replicas,
		},
			func() error {
				return e.Annotate(ctx, e.Namespace, e.Name, annotationKey, fmt.Sprintf("%d", e.Replicas))
			},
			func() error { return e.Scale(ctx, e.Namespace, e.Name, 0) },
		)
		switch {
		case errored:
			errs++
		case didScale:
			scaled++
		default:
			skipped++
		}
	}
	return scaled, skipped, errs
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

	entries := r.base.collectFilteredEntries(deps, ssets, filterOptions{
		skipNamespaces:  skipNS,
		namespaceFilter: policy.NamespaceFilter,
		countSkipped:    true,
	}, counts)
	scaled, skipped, errs := r.processSleepWorkloads(ctx, entries, swp)
	counts.Scaled += scaled
	counts.Skipped += skipped
	counts.Errors += errs

	// ── Drain & Delete Nodes (same as scale_down) ──────────────────────────
	r.base.drainNodes(ctx, policy.Mode, g, logCh, counts)

	emit(logCh, "info", fmt.Sprintf("Sleep complete — scaled %d workloads, %d skipped, %d errors",
		counts.Scaled, counts.Skipped, counts.Errors))
	return counts, nil
}

// lookupWorkload checks if a workload still exists in the cluster and returns its current replicas.
func (r *PolicyRunner) lookupWorkload(ctx context.Context, kind, namespace, name string) (exists bool, currentReplicas int32) {
	switch kind {
	case "Deployment":
		deps, err := r.base.k8s.ListDeploymentsBySelector(ctx, namespace, "")
		if err != nil {
			return false, 0
		}
		for _, d := range deps {
			if d.Name == name {
				if d.Spec.Replicas != nil {
					return true, *d.Spec.Replicas
				}
				return true, 0
			}
		}
	case "StatefulSet":
		ssets, err := r.base.k8s.ListStatefulSetsBySelector(ctx, namespace, "")
		if err != nil {
			return false, 0
		}
		for _, ss := range ssets {
			if ss.Name == name {
				if ss.Spec.Replicas != nil {
					return true, *ss.Spec.Replicas
				}
				return true, 0
			}
		}
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
				_ = r.store.CloseSnapshot(snap.ID, execID, 0)
			}
			counts.Skipped++
			continue
		}

		exists, currentReplicas := r.lookupWorkload(ctx, snap.Kind, snap.Namespace, snap.Name)
		if !exists {
			emit(logCh, "warn", fmt.Sprintf("Workload %s no longer exists — skipping restore", wl))
			if isApply(policy.Mode) {
				_ = r.store.MarkSnapshotDeletedAtWake(snap.ID, execID)
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
				_ = r.store.MarkSnapshotExternallyScaled(snap.ID)
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
		_ = r.store.CloseSnapshot(snap.ID, execID, target)
		emit(logCh, "ok", fmt.Sprintf("Restored %s → %d replicas", wl, target))
		counts.Scaled++
	}

	emit(logCh, "info", fmt.Sprintf("Wake complete — restored %d workloads, %d skipped, %d errors",
		counts.Scaled, counts.Skipped, counts.Errors))
	return counts, nil
}
