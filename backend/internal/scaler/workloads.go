// SPDX-License-Identifier: Apache-2.0

package scaler

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

// sleepWorkloadParams holds all context needed to process a single workload during sleep.
type sleepWorkloadParams struct {
	ctx     context.Context
	policy  store.Policy
	execID  uint
	logCh   chan<- LogLine
	snapped map[string]store.WorkloadSnapshot // read-only after construction — safe for concurrent access
	counts  *Counts
}

// sleepWorkload processes a single workload (Deployment or StatefulSet) during a policy sleep.
// Returns: scaled, skipped, errored.
func (r *PolicyRunner) sleepWorkload(params sleepWorkloadParams, entry workloadEntry) (scaled, skipped, errored bool) {
	workload := formatWorkload(entry.Kind, entry.Namespace, entry.Name)

	// Snapshots intentionally follow kind/namespace/name across recreation, as in
	// the original restoration contract. UID metadata does not gate recovery.
	snapshot, exists := params.snapped[workloadKey(entry.Kind, entry.Namespace, entry.Name)]
	if !exists {
		snapshot = store.WorkloadSnapshot{
			PolicyID: params.policy.ID, SleepExecutionID: params.execID,
			Kind: entry.Kind, Namespace: entry.Namespace, Name: entry.Name,
			ReplicasBefore: entry.Replicas, WasAlreadyZero: entry.Replicas == 0,
			WorkloadUID: entry.UID, Phase: "prepared", CapturedAt: time.Now(),
		}
	}
	if !isApply(params.policy.Mode) {
		emit(params.logCh, "plan", fmt.Sprintf("Would sleep %s → 0 (baseline %d replicas)", workload, snapshot.ReplicasBefore))
		return entry.Replicas > 0, entry.Replicas == 0, false
	}
	if !exists {
		if err := r.store.CreateWorkloadSnapshot(&snapshot); err != nil {
			emit(params.logCh, "error", fmt.Sprintf("Cannot persist sleep intent for %s: %s", workload, err))
			return false, false, true
		}
	}
	if snapshot.WasAlreadyZero {
		return false, true, false
	}
	if entry.Replicas > 0 {
		if err := entry.Scale(params.ctx, entry.Namespace, entry.Name, 0); err != nil {
			emit(params.logCh, "error", fmt.Sprintf("Failed to scale %s (intent retained): %s", workload, err))
			params.counts.AddRequests(1)
			return false, false, true
		}
		params.counts.AddRequests(1)
	}
	// Zero replicas may mean a previous process applied the intent before exiting.
	if err := r.store.MarkSnapshotApplied(snapshot.ID); err != nil {
		emit(params.logCh, "error", fmt.Sprintf("Cannot record applied sleep for %s (intent retained): %s", workload, err))
		return false, false, true
	}
	emit(params.logCh, "ok", fmt.Sprintf("Slept %s (was %d replicas)", workload, entry.Replicas))
	return true, false, false
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
func (r *PolicyRunner) wakeWorkload(params wakeWorkloadParams, snapshot store.WorkloadSnapshot) (scaled bool, skipped bool, errored bool) {
	workload := formatWorkload(snapshot.Kind, snapshot.Namespace, snapshot.Name)

	if snapshot.WasAlreadyZero {
		emit(params.logCh, "info", fmt.Sprintf("Skipping %s — was already at 0 before sleep (not owned by this policy)", workload))
		if isApply(params.policy.Mode) {
			if err := r.store.CloseSnapshot(snapshot.ID, params.execID, 0); err != nil {
				emit(params.logCh, "error", fmt.Sprintf("Cannot close snapshot %d: %s", snapshot.ID, err))
				return false, false, true
			}
		}
		return false, true, false
	}

	entry, err := r.lookupEntry(params.ctx, snapshot.Kind, snapshot.Namespace, snapshot.Name)
	exists := entry != nil
	var currentReplicas int32
	if exists {
		currentReplicas = entry.Replicas
	}
	params.counts.AddRequests(1) // GET for lookup
	if err != nil {
		emit(params.logCh, "error", fmt.Sprintf("Failed to look up %s: %s", workload, err))
		return false, false, true
	}
	if !exists {
		emit(params.logCh, "warn", fmt.Sprintf("Workload %s no longer exists — skipping restore", workload))
		if isApply(params.policy.Mode) {
			if err := r.store.MarkSnapshotDeletedAtWake(snapshot.ID, params.execID); err != nil {
				emit(params.logCh, "error", fmt.Sprintf("Cannot close deleted snapshot %d: %s", snapshot.ID, err))
				return false, false, true
			}
		}
		return false, true, false
	}

	allowed, scopeErr := r.filterEntries(params.policy, []workloadEntry{*entry}, "wake")
	if scopeErr != nil {
		emit(params.logCh, "error", scopeErr.Error())
		return false, false, true
	}
	if len(allowed) == 0 {
		return false, true, false
	}

	target := snapshot.ReplicasBefore

	if currentReplicas != 0 {
		if done, scaled, skipped, errored := r.handleExternallyScaled(params, snapshot, workload, target, currentReplicas); done {
			return scaled, skipped, errored
		}
	}

	if !isApply(params.policy.Mode) {
		emit(params.logCh, "plan", fmt.Sprintf("Would restore %s → %d replicas", workload, target))
		return true, false, false
	}

	if err := entry.Scale(params.ctx, snapshot.Namespace, snapshot.Name, target); err != nil {
		emit(params.logCh, "error", fmt.Sprintf("Failed to restore %s: %s", workload, err))
		params.counts.AddRequests(2) // GET + UPDATE for scale
		return false, false, true
	}
	params.counts.AddRequests(2) // GET + UPDATE for scale
	if err := r.store.CloseSnapshot(snapshot.ID, params.execID, target); err != nil {
		emit(params.logCh, "error", fmt.Sprintf("Failed to close restored snapshot %d: %s", snapshot.ID, err))
		return false, false, true
	}
	emit(params.logCh, "ok", fmt.Sprintf("Restored %s → %d replicas", workload, target))
	return true, false, false
}

// handleExternallyScaled handles a workload that was scaled by an external
// actor while sleeping. If the workload is already at the target count, the
// snapshot is closed without a redundant API call. Returns done=true when the
// caller should return immediately with the provided values.
func (r *PolicyRunner) handleExternallyScaled(
	params wakeWorkloadParams, snapshot store.WorkloadSnapshot,
	workload string, target, currentReplicas int32,
) (done bool, scaled bool, skipped bool, errored bool) {
	if isApply(params.policy.Mode) {
		if err := r.store.MarkSnapshotExternallyScaled(snapshot.ID); err != nil {
			slog.Warn("failed to mark snapshot as externally scaled", "snapshotID", snapshot.ID, "err", err)
		}
	}
	if currentReplicas == target {
		emit(params.logCh, "info", fmt.Sprintf(
			"Workload %s already at %d replicas (externally scaled) — closing snapshot",
			workload, currentReplicas,
		))
		if isApply(params.policy.Mode) {
			if err := r.store.CloseSnapshot(snapshot.ID, params.execID, target); err != nil {
				emit(params.logCh, "error", fmt.Sprintf("Failed to close snapshot %d: %s", snapshot.ID, err))
				return true, false, false, true
			}
		}
		return true, true, false, false
	}
	emit(params.logCh, "warn", fmt.Sprintf(
		"Workload %s was externally scaled to %d while sleeping — restoring to %d",
		workload, currentReplicas, target,
	))
	return false, false, false, false
}
