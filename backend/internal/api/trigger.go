package api

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

type triggerRequest struct {
	PolicyID uint   `json:"policyId"`
	Edge     string `json:"edge"` // "sleep" | "wake"
	Mode     string `json:"mode"` // "plan" | "apply"
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

	jsonError(w, "policyId is required", http.StatusBadRequest)
}
