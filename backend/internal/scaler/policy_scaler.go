package scaler

import (
	"context"
	"fmt"
	"log/slog"
	"runtime/debug"
	"strconv"
	"sync"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/k8s"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	"github.com/macxsimilian/kube-phoenix/backend/internal/stringutil"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

const defaultScalingConcurrency = 10

// PolicyRunner wraps Runner and adds DB-backed WorkloadSnapshot logic for
// the policy model. RunPolicySleep and RunPolicyWake are the sole entry
// points for all policy-driven scaling operations.
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
func runConcurrent[T any](ctx context.Context, items []T, concurrency int, fn func(T) (scaled, skipped, errored bool), counts *Counts) {
	if concurrency <= 0 {
		concurrency = defaultScalingConcurrency
	}
	sem := make(chan struct{}, concurrency)
	var wg sync.WaitGroup
	var mu sync.Mutex
loop:
	for _, item := range items {
		if ctx.Err() != nil {
			break
		}
		item := item
		wg.Add(1)
		select {
		case sem <- struct{}{}:
		case <-ctx.Done():
			wg.Done()
			break loop
		}
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
			if ctx.Err() != nil {
				return
			}
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
	skipNS := stringutil.SplitCSVSet(guardrails.SystemNamespaces)

	emit(logCh, "info", fmt.Sprintf("Policy sleep — namespace filter: %q  label selector: %q", policy.NamespaceFilter, policy.LabelSelector))

	openSnaps, err := r.store.GetOpenSnapshots(policy.ID)
	if err != nil {
		slog.Warn("failed to fetch open snapshots", "policyID", policy.ID, "err", err)
	}
	snappedSet := buildSnapshotedSet(openSnaps)

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

	entries := r.base.collectFilteredEntries(deps, ssets, skipNS, policy.NamespaceFilter, counts)
	entries = sortByPriorityNamespaces(entries, guardrails.ScalingPriorityNamespaces)
	if _, hasPriority := parsePriorityList(guardrails.ScalingPriorityNamespaces); hasPriority {
		emit(logCh, "info", fmt.Sprintf("Scaling priority namespaces first: %s", guardrails.ScalingPriorityNamespaces))
	}

	runConcurrent(ctx, entries, guardrails.ScalingConcurrency, func(e workloadEntry) (scaled, skipped, errored bool) {
		return r.sleepWorkload(sleepParams, e)
	}, counts)

	// ── Drain & Delete Nodes ────────────────────────────────────────────────
	r.base.drainNodes(ctx, policy.Mode, guardrails, logCh, counts)

	if ctx.Err() != nil {
		emit(logCh, "warn", "Sleep interrupted")
		return counts, ctx.Err()
	}

	emit(logCh, "info", fmt.Sprintf("Sleep complete — scaled %d workloads, %d skipped, %d errors",
		counts.Scaled, counts.Skipped, counts.Errors))
	if counts.Errors > 0 && counts.Scaled == 0 {
		return counts, fmt.Errorf("sleep failed: all %d workloads errored", counts.Errors)
	}
	return counts, nil
}

// workloadOps returns the k8s operations (get-replicas, scale, remove-annotation)
// for the given workload kind. This eliminates the duplicated Deployment/StatefulSet
// switch blocks in lookupWorkload and restoreWorkload.
func (r *PolicyRunner) workloadOps(kind string) (
	getReplicas func(ctx context.Context, ns, name string) (*int32, error),
	scale func(ctx context.Context, ns, name string, replicas int32) error,
	removeAnnotation func(ctx context.Context, ns, name, key string) error,
	err error,
) {
	switch kind {
	case "Deployment":
		return func(ctx context.Context, ns, name string) (*int32, error) {
				d, err := r.base.k8s.GetDeployment(ctx, ns, name)
				if err != nil {
					return nil, err
				}
				return d.Spec.Replicas, nil
			},
			r.base.k8s.ScaleDeployment,
			r.base.k8s.RemoveDeploymentAnnotation,
			nil
	case "StatefulSet":
		return func(ctx context.Context, ns, name string) (*int32, error) {
				ss, err := r.base.k8s.GetStatefulSet(ctx, ns, name)
				if err != nil {
					return nil, err
				}
				return ss.Spec.Replicas, nil
			},
			r.base.k8s.ScaleStatefulSet,
			r.base.k8s.RemoveStatefulSetAnnotation,
			nil
	default:
		return nil, nil, nil, fmt.Errorf("unsupported workload kind: %q", kind)
	}
}

// lookupWorkload checks if a workload still exists in the cluster and returns its current replicas.
// Returns (false, 0, nil) when the workload is genuinely not found (HTTP 404).
func (r *PolicyRunner) lookupWorkload(ctx context.Context, kind, namespace, name string) (exists bool, currentReplicas int32, err error) {
	getReplicas, _, _, err := r.workloadOps(kind)
	if err != nil {
		return false, 0, err
	}
	replicasPtr, err := getReplicas(ctx, namespace, name)
	if err != nil {
		if apierrors.IsNotFound(err) {
			return false, 0, nil
		}
		return false, 0, err
	}
	if replicasPtr != nil {
		return true, *replicasPtr, nil
	}
	return true, 0, nil
}

// restoreWorkload scales a workload back to its target replicas and removes the annotation.
func (r *PolicyRunner) restoreWorkload(ctx context.Context, kind, namespace, name string, target int32) error {
	_, scale, removeAnnotation, err := r.workloadOps(kind)
	if err != nil {
		return err
	}
	if err := scale(ctx, namespace, name, target); err != nil {
		return err
	}
	if err := removeAnnotation(ctx, namespace, name, annotationKey); err != nil {
		slog.Warn("failed to remove annotation", "kind", kind, "namespace", namespace, "name", name, "err", err)
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

	target := snap.ReplicasBefore

	if currentReplicas != 0 {
		if done, scaled, skip, err := r.handleExternallyScaled(p, snap, wl, target, currentReplicas); done {
			return scaled, skip, err
		}
	}

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

// handleExternallyScaled handles a workload that was scaled by an external
// actor while sleeping. If the workload is already at the target count, the
// snapshot is closed without a redundant API call. Returns done=true when the
// caller should return immediately with the provided values.
func (r *PolicyRunner) handleExternallyScaled(
	p wakeWorkloadParams, snap store.WorkloadSnapshot,
	wl string, target, currentReplicas int32,
) (done bool, scaled bool, skipped bool, errored bool) {
	if isApply(p.policy.Mode) {
		if err := r.store.MarkSnapshotExternallyScaled(snap.ID); err != nil {
			slog.Warn("failed to mark snapshot as externally scaled", "snapshotID", snap.ID, "err", err)
		}
	}
	if currentReplicas == target {
		emit(p.logCh, "info", fmt.Sprintf(
			"Workload %s already at %d replicas (externally scaled) — closing snapshot",
			wl, currentReplicas,
		))
		if isApply(p.policy.Mode) {
			if err := r.store.CloseSnapshot(snap.ID, p.execID, target); err != nil {
				slog.Warn("failed to close snapshot", "snapshotID", snap.ID, "err", err)
			}
		}
		return true, true, false, false
	}
	emit(p.logCh, "warn", fmt.Sprintf(
		"Workload %s was externally scaled to %d while sleeping — restoring to %d",
		wl, currentReplicas, target,
	))
	return false, false, false, false
}

// RunPolicyWake restores workloads from DB snapshots.
//
// If a workload was externally scaled back to its original count, the snapshot
// is closed without issuing a redundant scale call. If it was scaled to a
// different count, we restore to ReplicasBefore and log a warning.
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

	runConcurrent(ctx, snaps, guardrails.ScalingConcurrency, func(snap store.WorkloadSnapshot) (scaled, skipped, errored bool) {
		return r.wakeWorkload(wakeParams, snap)
	}, counts)

	r.restoreOrphanedFromAnnotations(annotationFallbackParams{
		ctx:        ctx,
		policy:     policy,
		guardrails: guardrails,
		dbSnaps:    snaps,
		logCh:      logCh,
		counts:     counts,
	})

	if ctx.Err() != nil {
		emit(logCh, "warn", "Wake interrupted")
		return counts, ctx.Err()
	}

	emit(logCh, "info", fmt.Sprintf("Wake complete — restored %d workloads, %d skipped, %d errors",
		counts.Scaled, counts.Skipped, counts.Errors))
	if counts.Errors > 0 && counts.Scaled == 0 {
		return counts, fmt.Errorf("wake failed: all %d workloads errored", counts.Errors)
	}
	return counts, nil
}

// annotationFallbackParams holds all context for the annotation-based recovery sweep.
type annotationFallbackParams struct {
	ctx        context.Context
	policy     store.Policy
	guardrails *store.Guardrails
	dbSnaps    []store.WorkloadSnapshot
	logCh      chan<- LogLine
	counts     *Counts
}

// restoreOrphanedFromAnnotations scans workloads in the policy's scope for
// leftover previous-replicas annotations that have no matching open snapshot.
// This handles the edge case where the DB lost snapshot data but the K8s
// annotation was written during sleep.
func (r *PolicyRunner) restoreOrphanedFromAnnotations(p annotationFallbackParams) {
	if !isApply(p.policy.Mode) {
		return
	}

	snapshotedWorkloads := buildSnapshotedSet(p.dbSnaps)
	entries := r.listAnnotatedWorkloads(p.ctx, p.policy, p.guardrails, p.logCh)

	recovered := 0
	for _, e := range entries {
		if snapshotedWorkloads[workloadKey(e.Kind, e.Namespace, e.Name)] {
			continue
		}
		if r.restoreFromAnnotation(p.ctx, e, p.logCh, p.counts) {
			recovered++
		}
	}
	if recovered > 0 {
		emit(p.logCh, "info", fmt.Sprintf("Annotation fallback: recovered %d workloads from K8s annotations", recovered))
	}
}

// buildSnapshotedSet returns the set of workload keys that already have DB snapshots.
func buildSnapshotedSet(snaps []store.WorkloadSnapshot) map[string]bool {
	set := make(map[string]bool, len(snaps))
	for _, s := range snaps {
		set[workloadKey(s.Kind, s.Namespace, s.Name)] = true
	}
	return set
}

// listAnnotatedWorkloads fetches all workloads matching the policy scope.
// Deployments and StatefulSets are fetched independently so a failure in one
// does not prevent recovery of the other.
func (r *PolicyRunner) listAnnotatedWorkloads(
	ctx context.Context,
	policy store.Policy,
	guardrails *store.Guardrails,
	logCh chan<- LogLine,
) []workloadEntry {
	skipNS := stringutil.SplitCSVSet(guardrails.SystemNamespaces)
	discardCounts := &Counts{}

	deps, err := r.base.k8s.ListDeploymentsBySelector(ctx, "", policy.LabelSelector)
	if err != nil {
		emit(logCh, "warn", "Annotation fallback: failed to list deployments: "+err.Error())
	}

	ssets, err := r.base.k8s.ListStatefulSetsBySelector(ctx, "", policy.LabelSelector)
	if err != nil {
		emit(logCh, "warn", "Annotation fallback: failed to list statefulsets: "+err.Error())
	}

	return r.base.collectFilteredEntries(deps, ssets, skipNS, policy.NamespaceFilter, discardCounts)
}

// restoreFromAnnotation reads the previous-replicas annotation from a single
// workload and restores it. Returns true when the workload was restored.
func (r *PolicyRunner) restoreFromAnnotation(ctx context.Context, e workloadEntry, logCh chan<- LogLine, counts *Counts) bool {
	savedStr, ok := e.Annotations[annotationKey]
	if !ok {
		return false
	}

	wl := formatWorkload(e.Kind, e.Namespace, e.Name)

	target, parseErr := strconv.ParseInt(savedStr, 10, 32)
	if parseErr != nil {
		emit(logCh, "warn", fmt.Sprintf("Annotation fallback: invalid annotation value %q on %s: %s", savedStr, wl, parseErr))
		return false
	}
	if target <= 0 {
		return false
	}

	emit(logCh, "warn", fmt.Sprintf("Annotation fallback: restoring %s → %d (no DB snapshot found)", wl, target))
	if err := r.restoreWorkload(ctx, e.Kind, e.Namespace, e.Name, int32(target)); err != nil {
		emit(logCh, "error", fmt.Sprintf("Annotation fallback: failed to restore %s: %s", wl, err))
		counts.Errors++
		return false
	}
	emit(logCh, "ok", fmt.Sprintf("Annotation fallback: restored %s → %d replicas", wl, target))
	counts.Scaled++
	return true
}
