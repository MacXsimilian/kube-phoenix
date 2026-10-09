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
	store snapshotStore
}

type snapshotStore interface {
	GetGuardrails() (*store.Guardrails, error)
	GetOpenSnapshots(uint) ([]store.WorkloadSnapshot, error)
	GetOpenSnapshotsForSleepReconcile(uint) ([]store.WorkloadSnapshot, error)
	CreateWorkloadSnapshot(*store.WorkloadSnapshot) error
	MarkSnapshotApplied(uint) error
	CloseSnapshot(uint, uint, int32) error
	MarkSnapshotDeletedAtWake(uint, uint) error
	MarkSnapshotExternallyScaled(uint) error
	ListActiveExceptionsForPolicy(uint, time.Time) ([]store.ScheduledException, error)
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

func (r *PolicyRunner) lookupEntry(ctx context.Context, kind, ns, name string) (*workloadEntry, error) {
	var entry workloadEntry
	switch kind {
	case "Deployment":
		d, err := r.base.k8s.GetDeployment(ctx, ns, name)
		if apierrors.IsNotFound(err) {
			return nil, nil
		}
		if err != nil {
			return nil, err
		}
		entry = r.base.deploymentToEntry(*d)
	case "StatefulSet":
		ss, err := r.base.k8s.GetStatefulSet(ctx, ns, name)
		if apierrors.IsNotFound(err) {
			return nil, nil
		}
		if err != nil {
			return nil, err
		}
		entry = r.base.statefulSetToEntry(*ss)
	default:
		return nil, fmt.Errorf("unsupported workload kind: %q", kind)
	}
	return &entry, nil
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
	skipNS := stringutil.SplitCSVSet(guardrails.ProtectedNamespaces)

	emit(logCh, "info", fmt.Sprintf("Policy sleep — namespace filter: %q  label selector: %q", policy.NamespaceFilter, policy.LabelSelector))

	openSnaps, err := r.store.GetOpenSnapshots(policy.ID)
	if err != nil {
		return counts, fmt.Errorf("get open snapshots: %w", err)
	}
	snappedSet := make(map[string]store.WorkloadSnapshot, len(openSnaps))
	for _, snap := range openSnaps {
		snappedSet[workloadKey(snap.Kind, snap.Namespace, snap.Name)] = snap
	}

	sleepParams := sleepWorkloadParams{
		ctx: ctx, policy: policy, execID: execID, logCh: logCh,
		snapped: snappedSet,
		counts:  counts,
	}

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
	selectedCount := len(entries)
	entries, err = r.filterEntries(policy, entries, "sleep")
	if err != nil {
		return counts, err
	}
	skipNodeActions := policy.ExceptionScope != nil || len(entries) != selectedCount
	entries = sortByPriorityNamespaces(entries, guardrails.ScalingPriorityNamespaces)
	if _, hasPriority := parsePriorityList(guardrails.ScalingPriorityNamespaces); hasPriority {
		emit(logCh, "info", fmt.Sprintf("Scaling priority namespaces first: %s", guardrails.ScalingPriorityNamespaces))
	}

	scalable := countScalable(entries)
	emitEstimate(logCh, "sleep", scalable, apiCallsPerSleep, guardrails.ScalingConcurrency, 2) // +2 LIST calls

	runConcurrent(ctx, entries, guardrails.ScalingConcurrency, func(e workloadEntry) (scaled, skipped, errored bool) {
		return r.sleepWorkload(sleepParams, e)
	}, counts)

	seen := make(map[string]bool, len(entries))
	for _, entry := range entries {
		seen[workloadKey(entry.Kind, entry.Namespace, entry.Name)] = true
	}
	for _, snap := range openSnaps {
		if snap.Phase == "prepared" && !snap.WasAlreadyZero && !seen[workloadKey(snap.Kind, snap.Namespace, snap.Name)] {
			skipNodeActions = true
			emit(logCh, "warn", "Node actions deferred: an unresolved sleep intent is outside this execution's selection")
		}
	}

	// ── Drain & Delete Nodes ────────────────────────────────────────────────
	if counts.Errors == 0 && ctx.Err() == nil && !skipNodeActions {
		r.base.drainNodes(ctx, policy.Mode, guardrails, logCh, counts)
	} else {
		emit(logCh, "warn", "Node operations skipped: workload sleep is incomplete")
	}

	if ctx.Err() != nil {
		emit(logCh, "warn", "Sleep interrupted")
		return counts, ctx.Err()
	}

	emit(logCh, "info", fmt.Sprintf("Sleep complete in %s — scaled %d workloads, %d skipped, %d errors, %d K8s API calls (%.1f req/s)",
		counts.Duration().Round(time.Millisecond), counts.Scaled, counts.Skipped, counts.Errors, counts.Requests, counts.RequestsPerSecond()))
	if counts.Errors > 0 {
		return counts, fmt.Errorf("sleep incomplete: %d operations errored", counts.Errors)
	}
	return counts, nil
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

	snaps, err = r.filterWakeSnapshots(ctx, policy, snaps)
	if err != nil {
		return counts, fmt.Errorf("resolve wake scope: %w", err)
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
	if counts.Errors > 0 {
		return counts, fmt.Errorf("wake incomplete: %d operations errored", counts.Errors)
	}
	return counts, nil
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
	skipNS := stringutil.SplitCSVSet(guardrails.ProtectedNamespaces)

	for _, snap := range snaps {
		if skipNS[snap.Namespace] {
			continue
		}
		entry, lookupErr := r.lookupEntry(ctx, snap.Kind, snap.Namespace, snap.Name)
		if lookupErr != nil {
			return false, lookupErr
		}
		if entry == nil {
			continue
		}
		allowed, scopeErr := r.filterEntries(store.Policy{ID: policyID}, []workloadEntry{*entry}, "sleep")
		if scopeErr != nil {
			return false, scopeErr
		}
		if len(allowed) == 0 {
			continue
		}
		if entry.Replicas > 0 {
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
	skipNS := stringutil.SplitCSVSet(guardrails.ProtectedNamespaces)

	emit(logCh, "info", fmt.Sprintf("Enforce sleep — checking %d open snapshots for drift", len(snaps)))

	for _, snap := range snaps {
		r.reconcileSnapshotSleep(ctx, p, snap, skipNS, logCh, counts)
	}

	emit(logCh, "info", fmt.Sprintf("Enforce sleep complete in %s — scaled %d workloads, %d skipped, %d errors, %d K8s API calls (%.1f req/s)",
		counts.Duration().Round(time.Millisecond), counts.Scaled, counts.Skipped, counts.Errors, counts.Requests, counts.RequestsPerSecond()))
	if counts.Errors > 0 {
		return counts, fmt.Errorf("enforce sleep incomplete: %d operations errored", counts.Errors)
	}
	return counts, nil
}

// reconcileSnapshotSleep enforces a single workload back to zero replicas during
// a sleep window, updating counts in place.
func (r *PolicyRunner) reconcileSnapshotSleep(
	ctx context.Context,
	p store.Policy,
	snap store.WorkloadSnapshot,
	skipNS map[string]bool,
	logCh chan<- LogLine,
	counts *Counts,
) {
	wl := formatWorkload(snap.Kind, snap.Namespace, snap.Name)
	if skipNS[snap.Namespace] {
		counts.Skipped++
		return
	}
	entry, err := r.lookupEntry(ctx, snap.Kind, snap.Namespace, snap.Name)
	counts.AddRequests(1)
	if err != nil {
		emit(logCh, "error", err.Error())
		counts.Errors++
		return
	}
	if entry == nil {
		counts.Skipped++
		return
	}
	allowed, err := r.filterEntries(p, []workloadEntry{*entry}, "sleep")
	if err != nil {
		emit(logCh, "error", err.Error())
		counts.Errors++
		return
	}
	if len(allowed) == 0 {
		counts.Skipped++
		return
	}
	currentReplicas := entry.Replicas
	if currentReplicas == 0 {
		if isApply(p.Mode) && snap.Phase == "prepared" {
			if err := r.store.MarkSnapshotApplied(snap.ID); err != nil {
				emit(logCh, "error", err.Error())
				counts.Errors++
				return
			}
		}
		counts.Skipped++
		return
	}

	if !isApply(p.Mode) {
		emit(logCh, "plan", fmt.Sprintf("Would enforce sleep %s → 0 (currently %d replicas)", wl, currentReplicas))
		counts.Scaled++
		return
	}

	if err := entry.Scale(ctx, snap.Namespace, snap.Name, 0); err != nil {
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
