package api

import (
	"log/slog"
	"net/http"
)

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
