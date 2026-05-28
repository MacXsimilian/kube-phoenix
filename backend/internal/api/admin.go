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
)

const resetConfirmPhrase = "RESET DATABASE"

// destructiveOpTimeout bounds long-running admin operations (resetDB,
// emergencyScale) so they can finish even if the operator closes the browser
// tab mid-flight. Without it the in-flight K8s scale calls and DB writes would
// inherit the request context and abort on client disconnect, potentially
// leaving workloads half-scaled.
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

	opCtx, opCancel := context.WithTimeout(context.Background(), destructiveOpTimeout)
	defer opCancel()

	emit("step", "Restarting policy scheduler...")
	if err := h.policyScheduler.Restart(opCtx); err != nil {
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

	if len(snapshots) == 0 {
		emit("step", "No sleeping workloads found — skipping scaling")
	} else {
		h.emergencyScaleSnapshots(opCtx, snapshots, emit)
	}

	// Step 7: Restart the scheduler (all policies are now disabled, so it idles).
	emit("step", "Restarting policy scheduler...")
	if err := h.policyScheduler.Restart(opCtx); err != nil {
		slog.Error("admin: policy scheduler restart failed", "err", err)
		emit("error", "Policy scheduler restart failed — see server logs for details")
		return
	}

	emit("done", "Emergency scale complete. All policies disabled, sleeping workloads scaled to 1 replica.")
}

// emergencyScaleSnapshots groups snapshots by policy, creates synthetic wake
// executions, scales every workload to one replica, closes snapshots, and
// finalises each execution. Progress is reported via emit.
func (h *Handler) emergencyScaleSnapshots(
	ctx context.Context,
	snapshots []store.WorkloadSnapshot,
	emit func(typ, msg string),
) {
	policyExecs := h.createEmergencyExecutions(snapshots, emit)

	var scaled, failed int
	for _, snap := range snapshots {
		execID, ok := policyExecs[snap.PolicyID]
		if !ok {
			failed++
			continue
		}
		if err := scaleWorkloadTo(ctx, h.k8s, snap, 1); err != nil {
			slog.Error("admin: emergency scale workload failed",
				"kind", snap.Kind, "namespace", snap.Namespace, "name", snap.Name, "err", err)
			emit("step", fmt.Sprintf("Failed to scale %s %s/%s: %v", snap.Kind, snap.Namespace, snap.Name, err))
			_ = h.store.MarkSnapshotDeletedAtWake(snap.ID, execID)
			failed++
			continue
		}
		if err := h.store.CloseSnapshot(snap.ID, execID, 1); err != nil {
			slog.Error("admin: close snapshot failed", "snapID", snap.ID, "err", err)
		}
		emit("step", fmt.Sprintf("Scaled %s %s/%s to 1 replica", snap.Kind, snap.Namespace, snap.Name))
		scaled++
	}

	for policyID, execID := range policyExecs {
		_ = h.store.FinishPolicyExecution(execID, store.ExecStatusSuccess, map[string]int{
			"scaled": scaled, "errors": failed,
		})
		_ = h.store.UpdatePolicyState(policyID, store.PolicyStateAwake, nil)
	}

	emit("step", fmt.Sprintf("Scaling complete: %d succeeded, %d failed", scaled, failed))
}

// createEmergencyExecutions returns a map of policyID → executionID, creating
// one synthetic wake execution per distinct policy referenced by the snapshots.
func (h *Handler) createEmergencyExecutions(
	snapshots []store.WorkloadSnapshot,
	emit func(typ, msg string),
) map[uint]uint {
	policyExecs := map[uint]uint{}
	for _, snap := range snapshots {
		if _, ok := policyExecs[snap.PolicyID]; ok {
			continue
		}
		exec := &store.PolicyExecution{
			PolicyID:  snap.PolicyID,
			Direction: "wake",
			Trigger:   "emergency_scale",
			StartedAt: time.Now(),
			Status:    store.ExecStatusRunning,
			Mode:      store.PolicyModeApply,
		}
		if err := h.store.CreatePolicyExecution(exec); err != nil {
			slog.Error("admin: create emergency execution failed", "policyID", snap.PolicyID, "err", err)
			emit("step", fmt.Sprintf("Warning: could not create execution record for policy %d", snap.PolicyID))
			continue
		}
		policyExecs[snap.PolicyID] = exec.ID
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
