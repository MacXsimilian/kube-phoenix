package api

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/robfig/cron/v3"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

func (h *Handler) listSchedules(w http.ResponseWriter, r *http.Request) {
	schedules, err := h.store.ListSchedules()
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, schedules)
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
		http.Error(w, `{"error":"type must be scale_down or scale_up"}`, http.StatusBadRequest)
		return
	}
	parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	if _, err := parser.Parse(sc.CronExpr); err != nil {
		http.Error(w, `{"error":"invalid cron expression"}`, http.StatusBadRequest)
		return
	}
	if sc.Timezone == "" {
		sc.Timezone = "UTC"
	}
	if sc.Mode == "" {
		sc.Mode = "plan"
	}
	if err := h.store.CreateSchedule(&sc); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if err := h.scheduler.Reload(); err != nil {
		log.Printf("scheduler reload: %v", err)
		http.Error(w, `{"error":"schedule saved but scheduler reload failed"}`, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	jsonOK(w, sc)
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
	for _, f := range []string{"name", "cron_expr", "timezone", "mode", "enabled", "namespace_filter"} {
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
		log.Printf("scheduler reload: %v", err)
		http.Error(w, `{"error":"schedule saved but scheduler reload failed"}`, http.StatusInternalServerError)
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
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if err := h.scheduler.Reload(); err != nil {
		log.Printf("scheduler reload: %v", err)
		http.Error(w, `{"error":"schedule saved but scheduler reload failed"}`, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
