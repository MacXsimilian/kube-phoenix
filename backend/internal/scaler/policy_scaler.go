package scaler

import (
	"context"
	"fmt"
	"log/slog"
	"runtime/debug"
	"sync"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/k8s"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

const defaultScalingConcurrency = 10

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

func workloadKey(kind, namespace, name string) string {
	return kind + "/" + namespace + "/" + name
}

// runConcurrent processes items in parallel, bounded by concurrency.
func runConcurrent[T any](items []T, concurrency int, fn func(T) (scaled, skipped, errored bool), counts *Counts) {
	if concurrency <= 0 {
		concurrency = defaultScalingConcurrency
	}
	sem := make(chan struct{}, concurrency)
	var wg sync.WaitGroup
	var mu sync.Mutex
	for _, item := range items {
		item := item
		wg.Add(1)
		sem <- struct{}{}
		go func() {
			defer wg.Done()
			defer func() { <-sem }()
			defer func() {
				if r := recover(); r != nil {
					slog.Error("panic in concurrent worker", "recover", r, "stack", string(debug.Stack()))
					mu.Lock()
					counts.Errors++
					mu.Unlock()
				}
			}()
			scaled, skipped, errored := fn(item)
			mu.Lock()
			switch {
			case errored:
				counts.Errors++
			case scaled:
				counts.Scaled++
			case skipped:
				counts.Skipped++
			}
			mu.Unlock()
		}()
	}
	wg.Wait()
}

// sleepWorkloadParams holds all context needed to process a single workload during sleep.
type sleepWorkloadParams struct {
	ctx     context.Context
	policy  store.Policy
	execID  uint
	logCh   chan<- LogLine
	snapped map[string]bool // read-only after construction — safe for concurrent access
}

// sleepWorkload processes a single workload (Deployment or StatefulSet) during a policy sleep.
// Returns: scaled, skipped, errored.
func (r *PolicyRunner) sleepWorkload(p sleepWorkloadParams, e workloadEntry) (scaled, skipped, errored bool) {
	wl := formatWorkload(e.Kind, e.Namespace, e.Name)

	if p.snapped[workloadKey(e.Kind, e.Namespace, e.Name)] {
		emit(p.logCh, "info", fmt.Sprintf("Snapshot already exists for %s (skipping double-sleep)", wl))
		return false, true, false
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
		return false, true, false
	}

	if !isApply(p.policy.Mode) {
		emit(p.logCh, "plan", fmt.Sprintf("Would sleep %s → 0 (currently %d replicas)", wl, e.Replicas))
		return true, false, false
	}

	if err := r.store.CreateWorkloadSnapshot(snap); err != nil {
		emit(p.logCh, "error", fmt.Sprintf("Failed to save snapshot for %s: %s", wl, err))
		return false, false, true
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
		return false, false, true
	}
	emit(p.logCh, "ok", fmt.Sprintf("Slept %s (was %d replicas)", wl, e.Replicas))
	return true, false, false
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
		snappedSet[workloadKey(s.Kind, s.Namespace, s.Name)] = true
	}

	sleepParams := sleepWorkloadParams{ctx: ctx, policy: policy, execID: execID, logCh: logCh, snapped: snappedSet}

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
	entries = sortByPriorityNamespaces(entries, guardrails.ScalingPriorityNamespaces)
	if _, hasPriority := parsePriorityList(guardrails.ScalingPriorityNamespaces); hasPriority {
		emit(logCh, "info", fmt.Sprintf("Scaling priority namespaces first: %s", guardrails.ScalingPriorityNamespaces))
	}

	runConcurrent(entries, guardrails.ScalingConcurrency, func(e workloadEntry) (scaled, skipped, errored bool) {
		return r.sleepWorkload(sleepParams, e)
	}, counts)

	// ── Drain & Delete Nodes (same as scale_down) ──────────────────────────
	r.base.drainNodes(ctx, policy.Mode, guardrails, logCh, counts)

	emit(logCh, "info", fmt.Sprintf("Sleep complete — scaled %d workloads, %d skipped, %d errors",
		counts.Scaled, counts.Skipped, counts.Errors))
	return counts, nil
}

// lookupWorkload checks if a workload still exists in the cluster and returns its current replicas.
// Returns (false, 0, nil) when the workload is genuinely not found (HTTP 404).
func (r *PolicyRunner) lookupWorkload(ctx context.Context, kind, namespace, name string) (exists bool, currentReplicas int32, err error) {
	switch kind {
	case "Deployment":
		d, err := r.base.k8s.GetDeployment(ctx, namespace, name)
		if err != nil {
			if apierrors.IsNotFound(err) {
				return false, 0, nil
			}
			return false, 0, err
		}
		if d.Spec.Replicas != nil {
			return true, *d.Spec.Replicas, nil
		}
		return true, 0, nil
	case "StatefulSet":
		ss, err := r.base.k8s.GetStatefulSet(ctx, namespace, name)
		if err != nil {
			if apierrors.IsNotFound(err) {
				return false, 0, nil
			}
			return false, 0, err
		}
		if ss.Spec.Replicas != nil {
			return true, *ss.Spec.Replicas, nil
		}
		return true, 0, nil
	default:
		return false, 0, fmt.Errorf("unsupported workload kind: %q", kind)
	}
}

// restoreWorkload scales a workload back to its target replicas and removes the annotation.
func (r *PolicyRunner) restoreWorkload(ctx context.Context, kind, namespace, name string, target int32) error {
	switch kind {
	case "Deployment":
		if err := r.base.k8s.ScaleDeployment(ctx, namespace, name, target); err != nil {
			return err
		}
		if err := r.base.k8s.RemoveDeploymentAnnotation(ctx, namespace, name, annotationKey); err != nil {
			slog.Warn("failed to remove annotation", "kind", kind, "namespace", namespace, "name", name, "err", err)
		}
	case "StatefulSet":
		if err := r.base.k8s.ScaleStatefulSet(ctx, namespace, name, target); err != nil {
			return err
		}
		if err := r.base.k8s.RemoveStatefulSetAnnotation(ctx, namespace, name, annotationKey); err != nil {
			slog.Warn("failed to remove annotation", "kind", kind, "namespace", namespace, "name", name, "err", err)
		}
	default:
		return fmt.Errorf("unsupported workload kind: %q", kind)
	}
	return nil
}

// wakeWorkloadParams holds all context needed to process a single snapshot during wake.
type wakeWorkloadParams struct {
	ctx    context.Context
	policy store.Policy
	execID uint
	logCh  chan<- LogLine
}

// wakeWorkload processes a single snapshot during wake.
// Returns: scaled, skipped, errored.
func (r *PolicyRunner) wakeWorkload(p wakeWorkloadParams, snap store.WorkloadSnapshot) (scaled bool, skipped bool, errored bool) {
	wl := formatWorkload(snap.Kind, snap.Namespace, snap.Name)

	if snap.WasAlreadyZero {
		emit(p.logCh, "info", fmt.Sprintf("Skipping %s — was already at 0 before sleep (not owned by this policy)", wl))
		if isApply(p.policy.Mode) {
			if err := r.store.CloseSnapshot(snap.ID, p.execID, 0); err != nil {
				slog.Warn("failed to close zero-replica snapshot", "snapshotID", snap.ID, "err", err)
			}
		}
		return false, true, false
	}

	exists, currentReplicas, err := r.lookupWorkload(p.ctx, snap.Kind, snap.Namespace, snap.Name)
	if err != nil {
		emit(p.logCh, "error", fmt.Sprintf("Failed to look up %s: %s", wl, err))
		return false, false, true
	}
	if !exists {
		emit(p.logCh, "warn", fmt.Sprintf("Workload %s no longer exists — skipping restore", wl))
		if isApply(p.policy.Mode) {
			if err := r.store.MarkSnapshotDeletedAtWake(snap.ID, p.execID); err != nil {
				slog.Warn("failed to mark snapshot as deleted at wake", "snapshotID", snap.ID, "err", err)
			}
		}
		return false, true, false
	}

	if currentReplicas != 0 {
		emit(p.logCh, "warn", fmt.Sprintf(
			"Workload %s was externally scaled to %d while sleeping — restoring to %d anyway",
			wl, currentReplicas, snap.ReplicasBefore,
		))
		if isApply(p.policy.Mode) {
			if err := r.store.MarkSnapshotExternallyScaled(snap.ID); err != nil {
				slog.Warn("failed to mark snapshot as externally scaled", "snapshotID", snap.ID, "err", err)
			}
		}
	}

	target := snap.ReplicasBefore
	if !isApply(p.policy.Mode) {
		emit(p.logCh, "plan", fmt.Sprintf("Would restore %s → %d replicas", wl, target))
		return true, false, false
	}

	if err := r.restoreWorkload(p.ctx, snap.Kind, snap.Namespace, snap.Name, target); err != nil {
		emit(p.logCh, "error", fmt.Sprintf("Failed to restore %s: %s", wl, err))
		return false, false, true
	}
	if err := r.store.CloseSnapshot(snap.ID, p.execID, target); err != nil {
		slog.Warn("failed to close snapshot after restore", "snapshotID", snap.ID, "err", err)
	}
	emit(p.logCh, "ok", fmt.Sprintf("Restored %s → %d replicas", wl, target))
	return true, false, false
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

	guardrails, err := r.store.GetGuardrails()
	if err != nil {
		return nil, fmt.Errorf("guardrails: %w", err)
	}
	snaps = sortSnapshotsByPriority(snaps, guardrails.ScalingPriorityNamespaces)

	emit(logCh, "info", fmt.Sprintf("Policy wake — restoring %d snapshotted workloads", len(snaps)))
	if _, hasPriority := parsePriorityList(guardrails.ScalingPriorityNamespaces); hasPriority {
		emit(logCh, "info", fmt.Sprintf("Scaling priority namespaces first: %s", guardrails.ScalingPriorityNamespaces))
	}

	wakeParams := wakeWorkloadParams{ctx: ctx, policy: policy, execID: execID, logCh: logCh}

	runConcurrent(snaps, guardrails.ScalingConcurrency, func(snap store.WorkloadSnapshot) (scaled, skipped, errored bool) {
		return r.wakeWorkload(wakeParams, snap)
	}, counts)

	emit(logCh, "info", fmt.Sprintf("Wake complete — restored %d workloads, %d skipped, %d errors",
		counts.Scaled, counts.Skipped, counts.Errors))
	return counts, nil
}
