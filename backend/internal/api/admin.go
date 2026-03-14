package api

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

const resetConfirmPhrase = "RESET DATABASE"

// resetDB drops all tables, recreates the schema, reseeds defaults, and
// reloads the scheduler. Requires {"confirm": "RESET DATABASE"} in the body.
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

	slog.Warn("admin: database reset requested — stopping scheduler")
	h.scheduler.Stop()

	slog.Warn("admin: dropping all tables and reseeding")
	if err := h.store.ResetAndReseed(); err != nil {
		slog.Error("admin: reset failed", "err", err)
		// Attempt to restart the scheduler even on failure so the app stays functional
		if reloadErr := h.scheduler.Reload(); reloadErr != nil {
			slog.Error("admin: scheduler reload after failed reset also failed", "err", reloadErr)
		}
		jsonError(w, "reset failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	slog.Warn("admin: restarting scheduler after reset")
	if err := h.scheduler.Reload(); err != nil {
		slog.Error("admin: scheduler reload after reset failed", "err", err)
		// Non-fatal — DB is clean, schedules are seeded, scheduler will pick up on next restart
	}

	slog.Warn("admin: database reset complete")
	jsonOK(w, map[string]string{"status": "ok", "message": "database reset and reseeded"})
}
