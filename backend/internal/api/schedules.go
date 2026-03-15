package api

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	"github.com/robfig/cron/v3"
)

type scheduleResponse struct {
	store.Schedule
	NextRun *time.Time `json:"nextRun,omitempty"`
}

func (h *Handler) listSchedules(w http.ResponseWriter, r *http.Request) {
	schedules, err := h.store.ListSchedules()
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	resp := make([]scheduleResponse, len(schedules))
	for i, sc := range schedules {
		resp[i] = scheduleResponse{Schedule: sc, NextRun: h.scheduler.NextRun(sc.ID)}
	}
	jsonOK(w, resp)
}

func (h *Handler) getSchedule(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id")
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}
	sc, err := h.store.GetSchedule(id)
	if err != nil {
		jsonError(w, "not found", http.StatusNotFound)
		return
	}
	jsonOK(w, sc)
}

func (h *Handler) createSchedule(w http.ResponseWriter, r *http.Request) {
	var sc store.Schedule
	if err := json.NewDecoder(r.Body).Decode(&sc); err != nil {
		jsonError(w, "invalid body", http.StatusBadRequest)
		return
	}
	if sc.Name == "" || sc.Type == "" || sc.CronExpr == "" {
		jsonError(w, "name, type and cronExpr are required", http.StatusBadRequest)
		return
	}
	if sc.Type != "scale_down" && sc.Type != "scale_up" {
		jsonError(w, "type must be scale_down or scale_up", http.StatusBadRequest)
		return
	}
	parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	if _, err := parser.Parse(sc.CronExpr); err != nil {
		jsonError(w, "invalid cron expression", http.StatusBadRequest)
		return
	}
	if sc.Timezone == "" {
		sc.Timezone = "UTC"
	}
	if sc.Mode == "" {
		sc.Mode = "plan"
	}
	if err := h.store.CreateSchedule(&sc); err != nil {
		slog.Error("create schedule failed", "name", sc.Name, "err", err)
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	slog.Info("schedule created", "scheduleID", sc.ID, "name", sc.Name, "type", sc.Type, "cronExpr", sc.CronExpr)
	if err := h.scheduler.Reload(); err != nil {
		slog.Error("scheduler reload after create failed", "err", err)
		jsonError(w, "schedule saved but scheduler reload failed", http.StatusInternalServerError)
		return
	}
	// Set Content-Type before WriteHeader so the header is actually sent.
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(sc); err != nil {
		slog.Error("json encode created schedule", "err", err)
	}
}

func (h *Handler) updateSchedule(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id")
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}

	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "invalid body", http.StatusBadRequest)
		return
	}

	updates := map[string]interface{}{}
	// Note: "type" is intentionally excluded — schedule type is immutable after creation
	// to preserve the semantic integrity of historical executions.
	for _, f := range []string{"name", "cron_expr", "timezone", "mode", "enabled", "namespace_filter", "timeout_minutes"} {
		if v, ok := body[f]; ok {
			updates[f] = v
		}
	}

	sc, err := h.store.UpdateSchedule(id, updates)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if err := h.scheduler.Reload(); err != nil {
		slog.Error("scheduler reload after update failed", "scheduleID", id, "err", err)
		jsonError(w, "schedule saved but scheduler reload failed", http.StatusInternalServerError)
		return
	}
	jsonOK(w, sc)
}

func (h *Handler) deleteSchedule(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id")
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}
	if err := h.store.DeleteSchedule(id); err != nil {
		slog.Error("delete schedule failed", "scheduleID", id, "err", err)
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	slog.Info("schedule deleted", "scheduleID", id)
	if err := h.scheduler.Reload(); err != nil {
		slog.Error("scheduler reload after delete failed", "scheduleID", id, "err", err)
		jsonError(w, "schedule deleted but scheduler reload failed", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
