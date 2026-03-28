package api

import (
	"context"
	"encoding/json"
	"log/slog"
	"net"
	"net/http"
	"strconv"
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
// Recovers from panics to prevent a single bad entry from killing the audit pipeline.
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
			aw.safeWrite(entry)
		}
	}
}

func (aw *AuditWriter) safeWrite(entry *store.AuditLog) {
	defer func() {
		if r := recover(); r != nil {
			slog.Error("audit-writer: panic during write (recovered)", "action", entry.Action, "panic", r)
		}
	}()
	if err := aw.store.CreateAuditLog(entry); err != nil {
		slog.Error("audit-writer: write failed", "action", entry.Action, "err", err)
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

// audit enqueues an audit log entry. Non-blocking on first attempt; blocks up
// to 500ms before dropping if the buffer is full.
func (h *Handler) audit(r *http.Request, action, resourceType string, resourceID *uint, before, after any) {
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
		Before:       marshalOrNull(before),
		After:        marshalOrNull(after),
		IPAddress:    clientIP(r),
		Timestamp:    time.Now(),
	}

	select {
	case h.auditWriter.ch <- entry:
	default:
		// Buffer full — block briefly before dropping to improve delivery guarantees.
		select {
		case h.auditWriter.ch <- entry:
		case <-time.After(500 * time.Millisecond):
			metrics.AuditDropsTotal.Inc()
			slog.Error("audit-writer: buffer full after 500ms, entry dropped", "action", action, "user", username)
		}
	}

	metrics.UserActionsTotal.WithLabelValues(action, resourceType).Inc()
}

// auditDeniedMiddleware logs an audit entry when a request receives a 403 Forbidden
// response (e.g. from RequirePermission). Must be placed after SessionAuth so that
// the user context is available.
func (h *Handler) auditDeniedMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capture := &statusCapture{ResponseWriter: w}
		next.ServeHTTP(capture, r)
		if capture.code == http.StatusForbidden {
			h.audit(r, "auth.denied", "permission", nil, nil, map[string]string{
				"method": r.Method,
				"path":   r.URL.Path,
			})
		}
	})
}

// statusCapture wraps http.ResponseWriter to capture the status code.
type statusCapture struct {
	http.ResponseWriter
	code    int
	written bool
}

func (w *statusCapture) WriteHeader(code int) {
	if !w.written {
		w.code = code
		w.written = true
	}
	w.ResponseWriter.WriteHeader(code)
}

func (w *statusCapture) Write(b []byte) (int, error) {
	if !w.written {
		w.code = http.StatusOK
		w.written = true
	}
	return w.ResponseWriter.Write(b)
}

func (w *statusCapture) Flush() {
	if f, ok := w.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func (w *statusCapture) Unwrap() http.ResponseWriter {
	return w.ResponseWriter
}

// clientIP extracts the real client IP from the request. It trusts
// X-Real-IP and X-Forwarded-For headers because the app runs behind a
// Kubernetes ingress controller that overwrites these headers. If the
// app were ever exposed directly to the internet without a reverse proxy,
// these headers would be spoofable and this function should be revised.
//
// Priority: X-Real-IP > X-Forwarded-For (first entry) > r.RemoteAddr.
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

// ─── Audit log endpoint (thin handler, store does the work) ──────────────────

func (h *Handler) listAuditLogs(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	filter := store.AuditLogFilter{
		Username: query.Get("user"),
		Action:   query.Get("action"),
	}
	if v := query.Get("page"); v != "" {
		p, err := strconv.Atoi(v)
		if err != nil {
			jsonError(w, "invalid page parameter", http.StatusBadRequest)
			return
		}
		if p < 0 {
			p = 0
		}
		filter.Page = p
	}
	filter.PageSize = parsePageSize(query, 50, 1000)
	if v := query.Get("from"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			jsonError(w, "invalid 'from' timestamp — expected RFC3339 format", http.StatusBadRequest)
			return
		}
		filter.From = &t
	}
	if v := query.Get("to"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			jsonError(w, "invalid 'to' timestamp — expected RFC3339 format", http.StatusBadRequest)
			return
		}
		filter.To = &t
	}

	page, err := h.store.ListAuditLogs(filter)
	if err != nil {
		jsonInternalError(w, err, "list audit logs failed")
		return
	}
	jsonOK(w, page)
}
