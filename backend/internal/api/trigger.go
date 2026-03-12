package api

import (
	"encoding/json"
	"net/http"
)

type triggerRequest struct {
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
	if req.ScheduleID == 0 {
		jsonError(w, "scheduleId is required", http.StatusBadRequest)
		return
	}
	if req.Mode != "plan" && req.Mode != "apply" {
		jsonError(w, "mode must be plan or apply", http.StatusBadRequest)
		return
	}

	execID, err := h.scheduler.RunNow(r.Context(), req.ScheduleID, req.Mode)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusAccepted)
	jsonOK(w, triggerResponse{ExecutionID: execID})
}
