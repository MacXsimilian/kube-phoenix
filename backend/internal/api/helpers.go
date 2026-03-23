package api

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
)

func jsonOK(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("json encode response", "err", err)
	}
}

func jsonCreated(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("json encode response", "err", err)
	}
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	if err := json.NewEncoder(w).Encode(map[string]string{"error": msg}); err != nil {
		slog.Error("json encode error response", "err", err)
	}
}

func jsonInternalError(w http.ResponseWriter, err error, msg string) {
	slog.Error(msg, "err", err)
	jsonError(w, "internal server error", http.StatusInternalServerError)
}

func parseID(r *http.Request, param string) (uint, error) {
	id, err := strconv.ParseUint(chi.URLParam(r, param), 10, 64)
	return uint(id), err
}

func (h *Handler) reloadScheduler(policyID uint) {
	if err := h.policyScheduler.Reload(); err != nil {
		slog.Error("policy scheduler reload failed", "policyID", policyID, "err", err)
	}
}

