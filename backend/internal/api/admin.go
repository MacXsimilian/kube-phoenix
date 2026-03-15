package api

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

const resetConfirmPhrase = "RESET DATABASE"

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

	emit("step", "Stopping scheduler...")
	h.scheduler.Stop()

	emit("step", "Dropping all tables...")
	if err := h.store.DropAllTables(); err != nil {
		slog.Error("admin: drop tables failed", "err", err)
		emit("error", "Failed to drop tables: "+err.Error())
		return
	}

	emit("step", "Recreating schema...")
	if err := h.store.MigrateSchema(); err != nil {
		slog.Error("admin: migrate failed", "err", err)
		emit("error", "Failed to recreate schema: "+err.Error())
		return
	}

	emit("step", "Seeding default data...")
	if err := h.store.SeedDefaults(); err != nil {
		slog.Error("admin: seed failed", "err", err)
		emit("error", "Failed to seed defaults: "+err.Error())
		return
	}

	emit("step", "Restarting scheduler...")
	if err := h.scheduler.Restart(r.Context()); err != nil {
		slog.Error("admin: scheduler restart failed", "err", err)
		emit("error", "Failed to restart scheduler: "+err.Error())
		return
	}

	emit("done", "Database reset and reseeded successfully.")
}
