package api

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"

	"github.com/go-chi/chi/v5"
	authmw "github.com/macxsimilian/kube-phoenix/backend/internal/middleware"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	"gorm.io/gorm"
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
	if err != nil {
		return 0, err
	}
	if id == 0 {
		return 0, strconv.ErrRange
	}
	return uint(id), nil
}

func (h *Handler) reloadScheduler(policyID uint) {
	if err := h.policyScheduler.Reload(); err != nil {
		slog.Error("policy scheduler reload failed", "policyID", policyID, "err", err)
	}
}

// handleStoreError writes a 404 if the error is gorm.ErrRecordNotFound,
// otherwise a 500 internal server error. logMsg is used for server-side logging.
func handleStoreError(w http.ResponseWriter, err error, notFoundMsg, logMsg string) {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		jsonError(w, notFoundMsg, http.StatusNotFound)
	} else {
		jsonInternalError(w, err, logMsg)
	}
}

// requireUser extracts the authenticated user from the request context. If no
// user is present it writes a 401 response and returns nil.
func requireUser(w http.ResponseWriter, r *http.Request) *store.User {
	user := authmw.UserFromContext(r.Context())
	if user == nil {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return nil
	}
	return user
}

// nonNilMap returns m, or an empty map if m is nil (ensures JSON "{}").
func nonNilMap(m map[string]string) map[string]string {
	if m == nil {
		return map[string]string{}
	}
	return m
}

// parsePageSize extracts a page size from query parameters, checking both
// snake_case and camelCase variants. Clamps to [1, maxVal] with a default.
func parsePageSize(query url.Values, defaultVal, maxVal int) int {
	raw := query.Get("page_size")
	if raw == "" {
		raw = query.Get("pageSize")
	}
	if raw == "" {
		return defaultVal
	}
	ps, err := strconv.Atoi(raw)
	if err != nil || ps < 1 {
		return defaultVal
	}
	if ps > maxVal {
		return maxVal
	}
	return ps
}
