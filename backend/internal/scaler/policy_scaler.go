// SPDX-License-Identifier: Apache-2.0

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
	"github.com/macxsimilian/kube-phoenix/backend/internal/stringutil"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

const defaultScalingConcurrency = 10

// API calls per workload for estimation.
const (
	apiCallsPerSleep = 2 // scale (GET+UPDATE)
	apiCallsPerWake  = 3 // lookup (GET) + scale (GET+UPDATE)
)

// countScalable returns the number of entries with replicas > 0.
func countScalable(entries []workloadEntry) int {
	n := 0
	for _, e := range entries {
		if e.Replicas > 0 {
			n++
		}
	}
	return n
}

// emitEstimate logs an estimated K8s API call count before scaling begins.
// extraCalls accounts for non-per-workload calls (e.g. LIST operations).
func emitEstimate(logCh chan<- LogLine, direction string, workloads, callsPerWorkload, concurrency, extraCalls int) {
	if workloads == 0 {
		return
	}
	total := workloads*callsPerWorkload + extraCalls
	emit(logCh, "info", fmt.Sprintf("Estimate: %s %d workloads → ~%d K8s API calls with concurrency %d",
		direction, workloads, total, concurrency))
}

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
	counts  *Counts
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

	if err := e.Scale(p.ctx, e.Namespace, e.Name, 0); err != nil {
		emit(p.logCh, "error", fmt.Sprintf("Failed to scale %s: %s", wl, err))
		p.counts.AddRequests(2) // GET + UPDATE for scale
		return false, false, true
	}
	p.counts.AddRequests(2) // GET + UPDATE for scale
	if err := r.store.CreateWorkloadSnapshot(snap); err != nil {
		slog.Error("snapshot write failed after successful scale",
			"workload", wl, "err", err)
		emit(p.logCh, "warn", fmt.Sprintf("Snapshot write failed for %s — workload is at 0 but cannot be restored automatically: %s", wl, err))
	}
	emit(p.logCh, "ok", fmt.Sprintf("Slept %s (was %d replicas)", wl, e.Replicas))
	return true, false, false
}

// RunPolicySleep scales matching workloads to 0 and writes WorkloadSnapshot
// rows to the DB.
//
// Decision (per design): workloads already at 0 are snapshotted with
// WasAlreadyZero=true and skipped (we did not own those replicas).
func (r *PolicyRunner) RunPolicySleep(
	ctx context.Context,
	policy store.Policy,
	execID uint,
	logCh chan<- LogLine,
) (*Counts, error) {
	counts := &Counts{StartedAt: time.Now()}

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

	sleepParams := sleepWorkloadParams{ctx: ctx, policy: policy, execID: execID, logCh: logCh, snapped: snappedSet, counts: counts}

	// ── Deployments & StatefulSets ────────────────────────────────────────
	emit(logCh, "info", "Fetching Deployments...")
	deps, err := r.base.k8s.ListDeploymentsBySelector(ctx, "", policy.LabelSelector)
	counts.AddRequests(1) // LIST deployments
	if err != nil {
		emit(logCh, "error", "Failed to list deployments: "+err.Error())
		counts.Errors++
	}

	emit(logCh, "info", "Fetching StatefulSets...")
	ssets, err := r.base.k8s.ListStatefulSetsBySelector(ctx, "", policy.LabelSelector)
	counts.AddRequests(1) // LIST statefulsets
	if err != nil {
		emit(logCh, "error", "Failed to list statefulsets: "+err.Error())
		counts.Errors++
	}

	entries := r.base.collectFilteredEntries(deps, ssets, skipNS, policy.NamespaceFilter, counts)
	entries = sortByPriorityNamespaces(entries, guardrails.ScalingPriorityNamespaces)
	if _, hasPriority := parsePriorityList(guardrails.ScalingPriorityNamespaces); hasPriority {
		emit(logCh, "info", fmt.Sprintf("Scaling priority namespaces first: %s", guardrails.ScalingPriorityNamespaces))
	}

	scalable := countScalable(entries)
	emitEstimate(logCh, "sleep", scalable, apiCallsPerSleep, guardrails.ScalingConcurrency, 2) // +2 LIST calls

	runConcurrent(ctx, entries, guardrails.ScalingConcurrency, func(e workloadEntry) (scaled, skipped, errored bool) {
		return r.sleepWorkload(sleepParams, e)
	}, counts)

	// ── Drain & Delete Nodes ────────────────────────────────────────────────
	r.base.drainNodes(ctx, policy.Mode, guardrails, logCh, counts)

	if ctx.Err() != nil {
		emit(logCh, "warn", "Sleep interrupted")
		return counts, ctx.Err()
	}

	emit(logCh, "info", fmt.Sprintf("Sleep complete in %s — scaled %d workloads, %d skipped, %d errors, %d K8s API calls (%.1f req/s)",
		counts.Duration().Round(time.Millisecond), counts.Scaled, counts.Skipped, counts.Errors, counts.Requests, counts.RequestsPerSecond()))
	if counts.Errors > 0 && counts.Scaled == 0 {
		return counts, fmt.Errorf("sleep failed: all %d workloads errored", counts.Errors)
	}
	return counts, nil
}

// workloadOps returns the k8s operations (get-replicas, scale) for the given
// workload kind. This eliminates the duplicated Deployment/StatefulSet switch
// blocks in lookupWorkload and restoreWorkload.
func (r *PolicyRunner) workloadOps(kind string) (
	getReplicas func(ctx context.Context, ns, name string) (*int32, error),
	scale func(ctx context.Context, ns, name string, replicas int32) error,
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
			nil
	default:
		return nil, nil, fmt.Errorf("unsupported workload kind: %q", kind)
	}
}

// lookupWorkload checks if a workload still exists in the cluster and returns its current replicas.
// Returns (false, 0, nil) when the workload is genuinely not found (HTTP 404).
func (r *PolicyRunner) lookupWorkload(ctx context.Context, kind, namespace, name string) (exists bool, currentReplicas int32, err error) {
	getReplicas, _, err := r.workloadOps(kind)
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

// restoreWorkload scales a workload back to its target replicas.
func (r *PolicyRunner) restoreWorkload(ctx context.Context, kind, namespace, name string, target int32) error {
	_, scale, err := r.workloadOps(kind)
	if err != nil {
		return err
	}
	return scale(ctx, namespace, name, target)
}

// wakeWorkloadParams holds all context needed to process a single snapshot during wake.
type wakeWorkloadParams struct {
	ctx    context.Context
	policy store.Policy
	execID uint
	logCh  chan<- LogLine
	counts *Counts
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
	p.counts.AddRequests(1) // GET for lookup
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
		p.counts.AddRequests(2) // GET + UPDATE for scale
		return false, false, true
	}
	p.counts.AddRequests(2) // GET + UPDATE for scale
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
	counts := &Counts{StartedAt: time.Now()}

	snaps, err := r.store.GetOpenSnapshots(policy.ID)
	if err != nil {
		return nil, fmt.Errorf("get open snapshots: %w", err)
	}

	// When the policy carries a namespace filter (e.g. from a scoped
	// exception), only restore snapshots that belong to those namespaces.
	if policy.NamespaceFilter != "" {
		snaps = filterSnapshotsByNamespace(snaps, policy.NamespaceFilter)
	}

	guardrails, err := r.store.GetGuardrails()
	if err != nil {
		return nil, fmt.Errorf("guardrails: %w", err)
	}
	snaps = sortSnapshotsByPriority(snaps, guardrails.ScalingPriorityNamespaces)

	emit(logCh, "info", fmt.Sprintf("Policy wake — restoring %d snapshotted workloads (namespace filter: %q)", len(snaps), policy.NamespaceFilter))
	if _, hasPriority := parsePriorityList(guardrails.ScalingPriorityNamespaces); hasPriority {
		emit(logCh, "info", fmt.Sprintf("Scaling priority namespaces first: %s", guardrails.ScalingPriorityNamespaces))
	}

	wakeParams := wakeWorkloadParams{ctx: ctx, policy: policy, execID: execID, logCh: logCh, counts: counts}
	wakeFn := func(snap store.WorkloadSnapshot) (scaled, skipped, errored bool) {
		return r.wakeWorkload(wakeParams, snap)
	}

	emitEstimate(logCh, "wake", len(snaps), apiCallsPerWake, guardrails.ScalingConcurrency, 0)

	if guardrails.WakeWaveSize > 0 {
		r.runWaves(ctx, snaps, guardrails, wakeFn, logCh, counts)
	} else {
		runConcurrent(ctx, snaps, guardrails.ScalingConcurrency, wakeFn, counts)
	}

	if ctx.Err() != nil {
		emit(logCh, "warn", "Wake interrupted")
		return counts, ctx.Err()
	}

	emit(logCh, "info", fmt.Sprintf("Wake complete in %s — restored %d workloads, %d skipped, %d errors, %d K8s API calls (%.1f req/s)",
		counts.Duration().Round(time.Millisecond), counts.Scaled, counts.Skipped, counts.Errors, counts.Requests, counts.RequestsPerSecond()))
	if counts.Errors > 0 && counts.Scaled == 0 {
		return counts, fmt.Errorf("wake failed: all %d workloads errored", counts.Errors)
	}
	return counts, nil
}

const waveReadinessPollInterval = 10 * time.Second

// runWaves processes snapshots in waves, pausing between each wave for pod
// readiness so Karpenter can provision nodes incrementally.
func (r *PolicyRunner) runWaves(
	ctx context.Context,
	snaps []store.WorkloadSnapshot,
	guardrails *store.Guardrails,
	fn func(store.WorkloadSnapshot) (scaled, skipped, errored bool),
	logCh chan<- LogLine,
	counts *Counts,
) {
	waves := chunkSnapshots(snaps, guardrails.WakeWaveSize)
	pauseDuration := time.Duration(guardrails.WakeWavePauseSeconds) * time.Second

	emit(logCh, "info", fmt.Sprintf("Wave scaling: %d workloads in %d waves of %d (max %s pause between waves)",
		len(snaps), len(waves), guardrails.WakeWaveSize, pauseDuration))

	for i, wave := range waves {
		if ctx.Err() != nil {
			break
		}
		emit(logCh, "info", fmt.Sprintf("Wave %d/%d — scaling %d workloads", i+1, len(waves), len(wave)))
		scaledBefore := counts.Scaled
		runConcurrent(ctx, wave, guardrails.ScalingConcurrency, fn, counts)

		scaledInWave := counts.Scaled - scaledBefore
		if i < len(waves)-1 && scaledInWave > 0 {
			r.waitForWaveReady(ctx, wave, pauseDuration, i+1, len(waves), logCh, counts)
		}
	}
}

func chunkSnapshots(snaps []store.WorkloadSnapshot, size int) [][]store.WorkloadSnapshot {
	if size <= 0 {
		size = defaultScalingConcurrency
	}
	var waves [][]store.WorkloadSnapshot
	for i := 0; i < len(snaps); i += size {
		end := i + size
		if end > len(snaps) {
			end = len(snaps)
		}
		waves = append(waves, snaps[i:end])
	}
	return waves
}

// waitForWaveReady polls pod readiness for workloads in a wave until all are
// ready or the pause duration expires.
func (r *PolicyRunner) waitForWaveReady(
	ctx context.Context,
	wave []store.WorkloadSnapshot,
	maxWait time.Duration,
	waveNum, totalWaves int,
	logCh chan<- LogLine,
	counts *Counts,
) {
	deadline := time.Now().Add(maxWait)
	ticker := time.NewTicker(waveReadinessPollInterval)
	defer ticker.Stop()

	targets := buildReadinessTargets(wave)
	if len(targets) == 0 {
		return
	}

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}

		ready, total := r.checkReadiness(ctx, targets, counts)
		remaining := time.Until(deadline).Round(time.Second)

		if ready >= total {
			emit(logCh, "info", fmt.Sprintf("Wave %d/%d: all %d workloads ready", waveNum, totalWaves, total))
			return
		}
		if time.Now().After(deadline) {
			emit(logCh, "warn", fmt.Sprintf("Wave %d/%d: proceeding after timeout (%d/%d ready)", waveNum, totalWaves, ready, total))
			return
		}
		emit(logCh, "info", fmt.Sprintf("Wave %d/%d: %d/%d workloads ready, waiting (%s remaining)", waveNum, totalWaves, ready, total, remaining))
	}
}

type readinessTarget struct {
	kind, namespace, name string
	target                int32
}

func buildReadinessTargets(wave []store.WorkloadSnapshot) []readinessTarget {
	var targets []readinessTarget
	for _, snap := range wave {
		if snap.WasAlreadyZero || snap.ReplicasBefore <= 0 {
			continue
		}
		targets = append(targets, readinessTarget{
			kind: snap.Kind, namespace: snap.Namespace, name: snap.Name,
			target: snap.ReplicasBefore,
		})
	}
	return targets
}

func (r *PolicyRunner) checkReadiness(ctx context.Context, targets []readinessTarget, counts *Counts) (ready, total int) {
	total = len(targets)
	for _, t := range targets {
		if ctx.Err() != nil {
			return ready, total
		}
		readyPods, _, err := r.base.k8s.CountReadyPods(ctx, t.kind, t.namespace, t.name)
		counts.AddRequests(2) // GET workload + LIST pods
		if err != nil {
			continue
		}
		if readyPods >= int(t.target) {
			ready++
		}
	}
	return ready, total
}

// collectStayAwakeNamespaces returns the set of namespaces protected by active
// stay_awake scoped exceptions. Workloads in these namespaces should not be
// forcibly scaled back to zero during enforce-sleep reconciliation.
func collectStayAwakeNamespaces(exceptions []store.ScheduledException) map[string]bool {
	ns := map[string]bool{}
	for _, ex := range exceptions {
		if ex.ExceptionType != store.ExceptionTypeStayAwake {
			continue
		}
		if ex.NamespaceFilter == "" {
			continue
		}
		for k, v := range stringutil.SplitCSVSet(ex.NamespaceFilter) {
			if v {
				ns[k] = true
			}
		}
	}
	return ns
}

// HasDriftedFromSleep checks whether any workload covered by the policy's open
// snapshots has been externally scaled above zero while the policy is sleeping.
// Returns true on the first drifted workload found. This is a lightweight
// pre-check — no scaling or DB writes occur.
func (r *PolicyRunner) HasDriftedFromSleep(ctx context.Context, policyID uint) (bool, error) {
	snaps, err := r.store.GetOpenSnapshotsForSleepReconcile(policyID)
	if err != nil {
		return false, fmt.Errorf("get open snapshots for sleep reconcile: %w", err)
	}
	if len(snaps) == 0 {
		return false, nil
	}

	guardrails, err := r.store.GetGuardrails()
	if err != nil {
		return false, fmt.Errorf("guardrails: %w", err)
	}
	skipNS := stringutil.SplitCSVSet(guardrails.SystemNamespaces)

	exceptions, err := r.store.ListActiveExceptionsForPolicy(policyID, time.Now())
	if err != nil {
		slog.Warn("enforce sleep: failed to list active exceptions", "policyID", policyID, "err", err)
		exceptions = nil
	}
	exceptionNS := collectStayAwakeNamespaces(exceptions)

	for _, snap := range snaps {
		if skipNS[snap.Namespace] || exceptionNS[snap.Namespace] {
			continue
		}
		exists, currentReplicas, err := r.lookupWorkload(ctx, snap.Kind, snap.Namespace, snap.Name)
		if err != nil {
			slog.Warn("enforce sleep: lookup error", "kind", snap.Kind, "ns", snap.Namespace, "name", snap.Name, "err", err)
			continue
		}
		if exists && currentReplicas > 0 {
			return true, nil
		}
	}
	return false, nil
}

// RunPolicySleepReconcile scales drifted workloads back to zero during a sleep
// window. Unlike RunPolicySleep, it does NOT create new snapshots — the existing
// open snapshots already hold the correct ReplicasBefore for eventual wake.
func (r *PolicyRunner) RunPolicySleepReconcile(
	ctx context.Context,
	p store.Policy,
	execID uint,
	logCh chan<- LogLine,
) (*Counts, error) {
	counts := &Counts{StartedAt: time.Now()}

	snaps, err := r.store.GetOpenSnapshotsForSleepReconcile(p.ID)
	if err != nil {
		return nil, fmt.Errorf("get open snapshots for sleep reconcile: %w", err)
	}

	guardrails, err := r.store.GetGuardrails()
	if err != nil {
		return nil, fmt.Errorf("guardrails: %w", err)
	}
	skipNS := stringutil.SplitCSVSet(guardrails.SystemNamespaces)

	exceptions, err := r.store.ListActiveExceptionsForPolicy(p.ID, time.Now())
	if err != nil {
		slog.Warn("enforce sleep: failed to list active exceptions", "policyID", p.ID, "err", err)
		exceptions = nil
	}
	exceptionNS := collectStayAwakeNamespaces(exceptions)

	emit(logCh, "info", fmt.Sprintf("Enforce sleep — checking %d open snapshots for drift", len(snaps)))

	for _, snap := range snaps {
		r.reconcileSnapshotSleep(ctx, p, snap, skipNS, exceptionNS, logCh, counts)
	}

	emit(logCh, "info", fmt.Sprintf("Enforce sleep complete in %s — scaled %d workloads, %d skipped, %d errors, %d K8s API calls (%.1f req/s)",
		counts.Duration().Round(time.Millisecond), counts.Scaled, counts.Skipped, counts.Errors, counts.Requests, counts.RequestsPerSecond()))
	if counts.Errors > 0 && counts.Scaled == 0 {
		return counts, fmt.Errorf("enforce sleep failed: all %d workloads errored", counts.Errors)
	}
	return counts, nil
}

// reconcileSnapshotSleep enforces a single workload back to zero replicas during
// a sleep window, updating counts in place.
func (r *PolicyRunner) reconcileSnapshotSleep(
	ctx context.Context,
	p store.Policy,
	snap store.WorkloadSnapshot,
	skipNS, exceptionNS map[string]bool,
	logCh chan<- LogLine,
	counts *Counts,
) {
	wl := formatWorkload(snap.Kind, snap.Namespace, snap.Name)

	if skipNS[snap.Namespace] || exceptionNS[snap.Namespace] {
		emit(logCh, "info", fmt.Sprintf("Skipping %s — namespace protected", wl))
		counts.Skipped++
		return
	}

	exists, currentReplicas, err := r.lookupWorkload(ctx, snap.Kind, snap.Namespace, snap.Name)
	counts.AddRequests(1) // GET for lookup
	if err != nil {
		emit(logCh, "error", fmt.Sprintf("Failed to look up %s: %s", wl, err))
		counts.Errors++
		return
	}
	if !exists {
		emit(logCh, "info", fmt.Sprintf("Workload %s no longer exists — skipping", wl))
		counts.Skipped++
		return
	}
	if currentReplicas == 0 {
		counts.Skipped++
		return
	}

	if !isApply(p.Mode) {
		emit(logCh, "plan", fmt.Sprintf("Would enforce sleep %s → 0 (currently %d replicas)", wl, currentReplicas))
		counts.Scaled++
		return
	}

	_, scale, opsErr := r.workloadOps(snap.Kind)
	if opsErr != nil {
		emit(logCh, "error", fmt.Sprintf("Unsupported kind for %s: %s", wl, opsErr))
		counts.Errors++
		return
	}
	if err := scale(ctx, snap.Namespace, snap.Name, 0); err != nil {
		emit(logCh, "error", fmt.Sprintf("Failed to enforce sleep on %s: %s", wl, err))
		counts.AddRequests(2) // GET + UPDATE for scale
		counts.Errors++
		return
	}
	counts.AddRequests(2) // GET + UPDATE for scale
	if err := r.store.MarkSnapshotExternallyScaled(snap.ID); err != nil {
		slog.Warn("enforce sleep: failed to mark snapshot as externally scaled", "snapshotID", snap.ID, "err", err)
	}
	emit(logCh, "ok", fmt.Sprintf("Enforced sleep on %s (was %d replicas)", wl, currentReplicas))
	counts.Scaled++
}

// buildSnapshotedSet returns the set of workload keys that already have DB snapshots.
func buildSnapshotedSet(snaps []store.WorkloadSnapshot) map[string]bool {
	set := make(map[string]bool, len(snaps))
	for _, s := range snaps {
		set[workloadKey(s.Kind, s.Namespace, s.Name)] = true
	}
	return set
}
