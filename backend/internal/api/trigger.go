package api

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

type triggerRequest struct {
	// V2: policy-based trigger
	PolicyID uint   `json:"policyId"`
	Edge     string `json:"edge"` // "sleep" | "wake"

	// V1: legacy schedule-based trigger (backward compat)
	ScheduleID uint   `json:"scheduleId"`
	Mode       string `json:"mode"` // "plan" | "apply"
}

type triggerResponse struct {
	ExecutionID uint `json:"executionId"`
}

func (h *Handler) trigger(w http.ResponseWriter, r *http.Request) {
	var req triggerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid body", http.StatusBadRequest)
		return
	}
	if req.Mode != "plan" && req.Mode != "apply" {
		req.Mode = "plan"
	}

	// V2 policy trigger
	if req.PolicyID != 0 {
		if req.Edge != "sleep" && req.Edge != "wake" {
			jsonError(w, "edge must be 'sleep' or 'wake'", http.StatusBadRequest)
			return
		}
		slog.Info("manual policy trigger requested", "policyID", req.PolicyID, "edge", req.Edge, "mode", req.Mode)
		execID, err := h.scheduler.RunNow(req.PolicyID, req.Edge, req.Mode)
		if err != nil {
			slog.Error("manual policy trigger failed", "policyID", req.PolicyID, "err", err)
			jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}
		slog.Info("manual policy trigger accepted", "policyID", req.PolicyID, "execID", execID, "mode", req.Mode)
		w.WriteHeader(http.StatusAccepted)
		jsonOK(w, triggerResponse{ExecutionID: execID})
		return
	}

	// V1 legacy schedule trigger
	if req.ScheduleID != 0 {
		slog.Info("manual legacy trigger requested", "scheduleID", req.ScheduleID, "mode", req.Mode)
		execID, err := h.scheduler.RunNowLegacy(req.ScheduleID, req.Mode)
		if err != nil {
			slog.Error("manual legacy trigger failed", "scheduleID", req.ScheduleID, "mode", req.Mode, "err", err)
			jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}
		slog.Info("manual legacy trigger accepted", "scheduleID", req.ScheduleID, "execID", execID, "mode", req.Mode)
		w.WriteHeader(http.StatusAccepted)
		jsonOK(w, triggerResponse{ExecutionID: execID})
		return
	}

	jsonError(w, "policyId or scheduleId is required", http.StatusBadRequest)
}
