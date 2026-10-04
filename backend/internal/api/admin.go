// SPDX-License-Identifier: Apache-2.0

package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

const resetConfirmPhrase = "RESET DATABASE"

// destructiveOpTimeout bounds emergency workload scaling independently of the
// request so closing the browser does not abort recovery midway. It does not
// govern the scheduler's application lifetime or non-context-aware store calls.
const destructiveOpTimeout = 5 * time.Minute

type resetEvent struct {
	Type    string `json:"type"` // "step" | "done" | "error"
	Message string `json:"message"`
}

// resetDB streams NDJSON progress events while resetting the database.
// Requires {"confirm": "RESET DATABASE"} in the body.
func (h *Handler) resetDB(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Confirm string `json:"confirm"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if body.Confirm != resetConfirmPhrase {
		jsonError(w, `confirmation phrase must be exactly "RESET DATABASE"`, http.StatusUnprocessableEntity)
		return
	}

	slog.Warn("admin: reset-db initiated", "remote_addr", r.RemoteAddr)
	h.audit(r, "admin.reset_db", "", nil, nil, nil)

	flusher, ok := w.(http.Flusher)
	if !ok {
		jsonError(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/x-ndjson")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Accel-Buffering", "no") // disable nginx buffering
	w.WriteHeader(http.StatusOK)

	emit := func(typ, msg string) {
		_ = json.NewEncoder(w).Encode(resetEvent{Type: typ, Message: msg})
		flusher.Flush()
		slog.Info("admin: reset "+typ, "msg", msg)
	}

	emit("step", "Stopping policy scheduler...")
	h.policyScheduler.Stop()

	emit("step", "Dropping all tables...")
	if err := h.store.DropAllTables(); err != nil {
		slog.Error("admin: drop tables failed", "err", err)
		emit("error", "Schema drop failed — see server logs for details")
		return
	}

	emit("step", "Recreating schema...")
	if err := h.store.MigrateSchema(); err != nil {
		slog.Error("admin: migrate failed", "err", err)
		emit("error", "Schema migration failed — see server logs for details")
		return
	}

	emit("step", "Seeding default data...")
	if err := h.store.SeedDefaults(h.adminUser, h.adminPassword); err != nil {
		slog.Error("admin: seed failed", "err", err)
		emit("error", "Seed failed — see server logs for details")
		return
	}

	emit("step", "Restarting policy scheduler...")
	if err := h.policyScheduler.Restart(); err != nil {
		slog.Error("admin: policy scheduler restart failed", "err", err)
		emit("error", "Policy scheduler restart failed — see server logs for details")
		return
	}

	emit("done", "Database reset and reseeded successfully.")
}

const emergencyScaleConfirmPhrase = "EMERGENCY SCALE"

// emergencyScale disables all policies and scales every sleeping workload to 1
// replica, streaming NDJSON progress events. Requires {"confirm": "EMERGENCY SCALE"}.
func (h *Handler) emergencyScale(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Confirm string `json:"confirm"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if body.Confirm != emergencyScaleConfirmPhrase {
		jsonError(w, `confirmation phrase must be exactly "EMERGENCY SCALE"`, http.StatusUnprocessableEntity)
		return
	}

	slog.Warn("admin: emergency-scale initiated", "remote_addr", r.RemoteAddr)
	h.audit(r, "admin.emergency_scale", "", nil, nil, nil)

	flusher, ok := w.(http.Flusher)
	if !ok {
		jsonError(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/x-ndjson")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)

	emit := func(typ, msg string) {
		_ = json.NewEncoder(w).Encode(resetEvent{Type: typ, Message: msg})
		flusher.Flush()
		slog.Info("admin: emergency-scale "+typ, "msg", msg)
	}

	// Step 1: Stop the policy scheduler so no new executions start.
	emit("step", "Stopping policy scheduler...")
	h.policyScheduler.Stop()

	// Step 2: Disable all policies.
	emit("step", "Disabling all policies...")
	disabledCount, err := h.store.DisableAllPolicies()
	if err != nil {
		slog.Error("admin: disable policies failed", "err", err)
		emit("error", "Failed to disable policies — see server logs for details")
		return
	}
	emit("step", fmt.Sprintf("Disabled %d policies", disabledCount))

	// Step 3: Cancel all pending/active exceptions so they don't re-trigger.
	emit("step", "Cancelling active exceptions...")
	cancelledCount, err := h.store.CancelAllOpenExceptions("emergency_scale")
	if err != nil {
		slog.Error("admin: cancel exceptions failed", "err", err)
		emit("step", "Warning: could not cancel exceptions — see server logs")
	} else if cancelledCount > 0 {
		emit("step", fmt.Sprintf("Cancelled %d exceptions", cancelledCount))
	}

	// Step 4: Fetch all open snapshots (workloads currently scaled to 0).
	emit("step", "Finding sleeping workloads...")
	snapshots, err := h.store.GetAllOpenSnapshots()
	if err != nil {
		slog.Error("admin: get open snapshots failed", "err", err)
		emit("error", "Failed to fetch sleeping workloads — see server logs for details")
		return
	}
	emit("step", fmt.Sprintf("Found %d workloads to scale up", len(snapshots)))

	opCtx, opCancel := context.WithTimeout(context.Background(), destructiveOpTimeout)
	defer opCancel()

	var result emergencyScaleCounts
	if len(snapshots) == 0 {
		emit("step", "No sleeping workloads found — skipping scaling")
	} else {
		result = emergencyScaleSnapshots(opCtx, h.store, h.k8s, snapshots, emit)
	}

	// Step 7: Restart the scheduler (all policies are now disabled, so it idles).
	emit("step", "Restarting policy scheduler...")
	if err := h.policyScheduler.Restart(); err != nil {
		slog.Error("admin: policy scheduler restart failed", "err", err)
		emit("error", "Policy scheduler restart failed — see server logs for details")
		return
	}

	if result.failed > 0 {
		emit("error", "Emergency scale finished with errors. All policies disabled; failed workload restores retain their snapshots for retry. See progress and server logs for details.")
		return
	}
	emit("done", "Emergency scale complete. All policies disabled; existing sleeping workloads scaled to 1 replica, missing workloads skipped.")
}

// emergencyScaleStore contains the persistence operations needed by emergency
// recovery. Keeping this boundary narrow allows failure-path regression tests.
type emergencyScaleStore interface {
	CreatePolicyExecution(*store.PolicyExecution) error
	FinishPolicyExecution(uint, string, map[string]int) error
	UpdatePolicyState(uint, string, *time.Time) error
	CloseSnapshot(uint, uint, int32) error
	MarkSnapshotDeletedAtWake(uint, uint) error
}

type emergencyScaleCounts struct {
	scaled  int
	skipped int
	failed  int
}

type emergencyPolicyExecution struct {
	id     uint
	counts emergencyScaleCounts
}

// emergencyScaleSnapshots groups snapshots by policy, creates synthetic wake
// executions, scales every workload to one replica, closes snapshots, and
// finalises each execution. Progress is reported via emit.
func emergencyScaleSnapshots(
	ctx context.Context,
	st emergencyScaleStore,
	k8sClient k8sScaler,
	snapshots []store.WorkloadSnapshot,
	emit func(typ, msg string),
) emergencyScaleCounts {
	policyExecs := createEmergencyExecutions(st, snapshots, emit)

	for _, snap := range snapshots {
		exec := policyExecs[snap.PolicyID]
		if exec.id == 0 {
			exec.counts.failed++
			continue
		}
		if err := scaleWorkloadTo(ctx, k8sClient, snap, 1); err != nil {
			if apierrors.IsNotFound(err) {
				if err := st.MarkSnapshotDeletedAtWake(snap.ID, exec.id); err != nil {
					slog.Error("admin: mark missing snapshot failed", "snapID", snap.ID, "err", err)
					emit("step", fmt.Sprintf("Failed to record missing %s %s/%s; snapshot retained for retry", snap.Kind, snap.Namespace, snap.Name))
					exec.counts.failed++
				} else {
					emit("step", fmt.Sprintf("Skipped missing %s %s/%s", snap.Kind, snap.Namespace, snap.Name))
					exec.counts.skipped++
				}
				continue
			}
			slog.Error("admin: emergency scale workload failed",
				"kind", snap.Kind, "namespace", snap.Namespace, "name", snap.Name, "err", err)
			emit("step", fmt.Sprintf("Failed to scale %s %s/%s: %v", snap.Kind, snap.Namespace, snap.Name, err))
			exec.counts.failed++
			continue
		}
		exec.counts.scaled++
		if err := st.CloseSnapshot(snap.ID, exec.id, 1); err != nil {
			slog.Error("admin: close snapshot failed", "snapID", snap.ID, "err", err)
			emit("step", fmt.Sprintf("Scaled %s %s/%s to 1 replica, but failed to close its snapshot; retained for retry", snap.Kind, snap.Namespace, snap.Name))
			exec.counts.failed++
			continue
		}
		emit("step", fmt.Sprintf("Scaled %s %s/%s to 1 replica", snap.Kind, snap.Namespace, snap.Name))
	}

	var result emergencyScaleCounts
	for policyID, exec := range policyExecs {
		state := store.PolicyStateAwake
		if exec.counts.failed > 0 {
			state = store.PolicyStateUnknown
		}
		if err := st.UpdatePolicyState(policyID, state, nil); err != nil {
			slog.Error("admin: update emergency policy state failed", "policyID", policyID, "err", err)
			emit("step", fmt.Sprintf("Failed to record recovery state for policy %d", policyID))
			exec.counts.failed++
		}
		if exec.id != 0 {
			status := store.ExecStatusSuccess
			if exec.counts.failed > 0 {
				status = store.ExecStatusFailed
			}
			if err := st.FinishPolicyExecution(exec.id, status, map[string]int{
				"scaled": exec.counts.scaled, "skipped": exec.counts.skipped, "errors": exec.counts.failed,
			}); err != nil {
				slog.Error("admin: finish emergency execution failed", "execID", exec.id, "err", err)
				emit("step", fmt.Sprintf("Failed to finalize recovery execution for policy %d", policyID))
				exec.counts.failed++
			}
		}
		result.scaled += exec.counts.scaled
		result.skipped += exec.counts.skipped
		result.failed += exec.counts.failed
	}

	emit("step", fmt.Sprintf("Scaling complete: %d scaled, %d skipped, %d errors", result.scaled, result.skipped, result.failed))
	return result
}

// createEmergencyExecutions returns a map of policyID → execution, creating
// one synthetic wake execution per distinct policy referenced by the snapshots.
// Failed creations retain an entry with a zero ID so scaling is skipped safely.
func createEmergencyExecutions(
	st emergencyScaleStore,
	snapshots []store.WorkloadSnapshot,
	emit func(typ, msg string),
) map[uint]*emergencyPolicyExecution {
	policyExecs := map[uint]*emergencyPolicyExecution{}
	for _, snap := range snapshots {
		if _, ok := policyExecs[snap.PolicyID]; ok {
			continue
		}
		policyExecs[snap.PolicyID] = &emergencyPolicyExecution{}
		exec := &store.PolicyExecution{
			PolicyID:  snap.PolicyID,
			Direction: "wake",
			Trigger:   "emergency_scale",
			StartedAt: time.Now(),
			Status:    store.ExecStatusRunning,
			Mode:      store.PolicyModeApply,
		}
		if err := st.CreatePolicyExecution(exec); err != nil {
			slog.Error("admin: create emergency execution failed", "policyID", snap.PolicyID, "err", err)
			emit("step", fmt.Sprintf("Warning: could not create execution record for policy %d", snap.PolicyID))
			continue
		}
		policyExecs[snap.PolicyID].id = exec.ID
	}
	return policyExecs
}

// scaleWorkloadTo scales a Deployment or StatefulSet to the given replica count.
func scaleWorkloadTo(ctx context.Context, k8sClient k8sScaler, snap store.WorkloadSnapshot, replicas int32) error {
	switch snap.Kind {
	case "Deployment":
		return k8sClient.ScaleDeployment(ctx, snap.Namespace, snap.Name, replicas)
	case "StatefulSet":
		return k8sClient.ScaleStatefulSet(ctx, snap.Namespace, snap.Name, replicas)
	default:
		return fmt.Errorf("unsupported workload kind: %s", snap.Kind)
	}
}

// k8sScaler is a minimal interface for scaling workloads, extracted for testability.
type k8sScaler interface {
	ScaleDeployment(ctx context.Context, namespace, name string, replicas int32) error
	ScaleStatefulSet(ctx context.Context, namespace, name string, replicas int32) error
}
