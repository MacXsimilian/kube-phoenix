package api

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

func (h *Handler) listNotifications(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	f := store.NotificationFilter{}

	if readStr := q.Get("read"); readStr != "" {
		readBool, err := strconv.ParseBool(readStr)
		if err == nil {
			f.Read = &readBool
		}
	}

	// dismissed query param: "false" = only active (not dismissed), "true" = only dismissed
	if dismissedStr := q.Get("dismissed"); dismissedStr != "" {
		dismissedBool, err := strconv.ParseBool(dismissedStr)
		if err == nil {
			f.Dismissed = &dismissedBool
		}
	} else {
		// Default: only show non-dismissed notifications
		notDismissed := false
		f.Dismissed = &notDismissed
	}

	if severity := q.Get("severity"); severity != "" {
		f.Severity = severity
	}
	if p := q.Get("page"); p != "" {
		page, _ := strconv.Atoi(p)
		f.Page = page
	}
	if ps := q.Get("page_size"); ps != "" {
		pageSize, _ := strconv.Atoi(ps)
		if pageSize > 100 {
			pageSize = 100
		}
		if pageSize < 1 {
			pageSize = 50
		}
		f.PageSize = pageSize
	}

	items, total, err := h.store.ListNotifications(f)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if items == nil {
		items = []store.Notification{}
	}

	jsonOK(w, map[string]interface{}{
		"items": items,
		"total": total,
	})
}

type patchNotificationRequest struct {
	Read      *bool `json:"read"`
	Dismissed *bool `json:"dismissed"`
}

func (h *Handler) patchNotification(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id")
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}

	var req patchNotificationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid body", http.StatusBadRequest)
		return
	}

	if req.Read != nil && *req.Read {
		if err := h.store.MarkNotificationRead(id); err != nil {
			slog.Error("mark notification read failed", "id", id, "err", err)
			jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}

	if req.Dismissed != nil && *req.Dismissed {
		if err := h.store.DismissNotification(id); err != nil {
			slog.Error("dismiss notification failed", "id", id, "err", err)
			jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}

	n, err := h.store.GetNotification(id)
	if err != nil {
		jsonError(w, "not found", http.StatusNotFound)
		return
	}
	jsonOK(w, n)
}

func (h *Handler) dismissAllNotifications(w http.ResponseWriter, r *http.Request) {
	if err := h.store.DismissAllNotifications(); err != nil {
		slog.Error("dismiss all notifications failed", "err", err)
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	slog.Info("all notifications dismissed")
	w.WriteHeader(http.StatusNoContent)
}
