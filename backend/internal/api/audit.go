package api

import (
	"context"
	"encoding/json"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/metrics"
	authmw "github.com/macxsimilian/kube-phoenix/backend/internal/middleware"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

const systemUser = "system"

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

// marshalOrNull serialises v to a JSON string, or returns "null" if v is nil
// or marshalling fails.
func marshalOrNull(v interface{}) string {
	if v == nil {
		return "null"
	}
	b, err := json.Marshal(v)
	if err != nil {
		return "null"
	}
	return string(b)
}

// audit enqueues an audit log entry. Non-blocking — drops the entry if the
// buffer is full and increments the drop counter.
func (h *Handler) audit(r *http.Request, action, resourceType string, resourceID *uint, beforeState, afterState any) {
	user := authmw.UserFromContext(r.Context())
	username := systemUser
	var userID *uint
	if user != nil {
		username = user.Username
		userID = &user.ID
	}

	entry := &store.AuditLog{
		UserID:       userID,
		Username:     username,
		Action:       action,
		ResourceType: resourceType,
		ResourceID:   resourceID,
		Before:       marshalOrNull(beforeState),
		After:        marshalOrNull(afterState),
		IPAddress:    clientIP(r),
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

// clientIP extracts the real client IP from the request. It prefers
// X-Real-IP (set by nginx/ingress), falls back to the first entry of
// X-Forwarded-For, and finally strips the port from r.RemoteAddr.
func clientIP(r *http.Request) string {
	if ip := r.Header.Get("X-Real-IP"); ip != "" {
		return strings.TrimSpace(ip)
	}
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if i := strings.IndexByte(xff, ','); i >= 0 {
			return strings.TrimSpace(xff[:i])
		}
		return strings.TrimSpace(xff)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
