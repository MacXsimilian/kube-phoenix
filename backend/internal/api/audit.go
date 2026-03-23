package api

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/metrics"
	authmw "github.com/macxsimilian/kube-phoenix/backend/internal/middleware"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

// AuditWriter drains a buffered channel and persists audit entries in the background.
type AuditWriter struct {
	ch    chan *store.AuditLog
	store *store.Store
}

// NewAuditWriter creates an audit writer with the given buffer size.
func NewAuditWriter(s *store.Store, bufSize int) *AuditWriter {
	return &AuditWriter{
		ch:    make(chan *store.AuditLog, bufSize),
		store: s,
	}
}

// Start drains the channel and writes entries to the database. Blocks until ctx is cancelled.
func (aw *AuditWriter) Start(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			// Drain remaining entries before exiting.
			for {
				select {
				case entry := <-aw.ch:
					if err := aw.store.CreateAuditLog(entry); err != nil {
						slog.Error("audit-writer: flush failed", "action", entry.Action, "err", err)
					}
				default:
					return
				}
			}
		case entry := <-aw.ch:
			if err := aw.store.CreateAuditLog(entry); err != nil {
				slog.Error("audit-writer: write failed", "action", entry.Action, "err", err)
			}
		}
	}
}

// audit enqueues an audit log entry. Non-blocking — drops the entry if the
// buffer is full and increments the drop counter.
func (h *Handler) audit(r *http.Request, action, resourceType string, resourceID *uint, before, after interface{}) {
	user := authmw.UserFromContext(r.Context())
	username := "system"
	var userID *uint
	if user != nil {
		username = user.Username
		userID = &user.ID
	}

	var beforeJSON, afterJSON string
	if before != nil {
		if b, err := json.Marshal(before); err == nil {
			beforeJSON = string(b)
		}
	}
	if after != nil {
		if b, err := json.Marshal(after); err == nil {
			afterJSON = string(b)
		}
	}

	entry := &store.AuditLog{
		UserID:       userID,
		Username:     username,
		Action:       action,
		ResourceType: resourceType,
		ResourceID:   resourceID,
		Before:       beforeJSON,
		After:        afterJSON,
		IPAddress:    r.RemoteAddr,
		Timestamp:    time.Now(),
	}

	select {
	case h.auditWriter.ch <- entry:
	default:
		metrics.AuditDropsTotal.Inc()
		slog.Warn("audit-writer: buffer full, entry dropped", "action", action, "user", username)
	}

	metrics.UserActionsTotal.WithLabelValues(action, resourceType).Inc()
}
