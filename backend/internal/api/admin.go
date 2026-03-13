package api

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

// getVersion returns the running binary version.
// GET /api/version — no auth required.
func (h *Handler) getVersion(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]string{"version": h.version}); err != nil {
		slog.Error("version: encode failed", "err", err)
	}
}

// resetDB drops all tables, re-migrates, re-seeds, and reloads the scheduler.
// POST /api/admin/reset-db
func (h *Handler) resetDB(w http.ResponseWriter, r *http.Request) {
	slog.Warn("admin: database reset requested", "remote", r.RemoteAddr)
	if err := h.store.ResetDB(); err != nil {
		slog.Error("admin: reset-db failed", "err", err)
		http.Error(w, `{"error":"reset failed: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	h.scheduler.Notify()
	slog.Info("admin: database reset complete")
	w.WriteHeader(http.StatusNoContent)
}
