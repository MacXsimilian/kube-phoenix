package api

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"gorm.io/gorm"
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

	slog.Info("manual trigger requested", "scheduleID", req.ScheduleID, "mode", req.Mode)
	execID, err := h.scheduler.RunNow(req.ScheduleID, req.Mode)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			jsonError(w, "schedule not found", http.StatusNotFound)
		} else {
			jsonInternalError(w, err, "manual trigger failed")
		}
		return
	}
	slog.Info("manual trigger accepted", "scheduleID", req.ScheduleID, "execID", execID, "mode", req.Mode)
	w.WriteHeader(http.StatusAccepted)
	jsonOK(w, triggerResponse{ExecutionID: execID})
}
