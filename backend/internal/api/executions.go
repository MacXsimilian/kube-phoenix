package api

import (
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"time"

	"github.com/gorilla/websocket"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	"gorm.io/gorm"
)

const (
	wsWriteTimeout = 10 * time.Second
	wsPingInterval = 30 * time.Second
	wsPongTimeout  = 60 * time.Second
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		if os.Getenv("BASIC_AUTH_USER") == "" {
			return true // dev mode
		}
		origin := r.Header.Get("Origin")
		if origin == "" {
			return true // same-origin requests have no Origin header
		}
		u, err := url.Parse(origin)
		if err != nil {
			return false
		}
		return u.Host == r.Host
	},
}

func (h *Handler) listExecutions(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	f := store.ExecutionFilter{}

	if sid := q.Get("schedule_id"); sid != "" {
		id, err := strconv.ParseUint(sid, 10, 64)
		if err == nil {
			uid := uint(id)
			f.ScheduleID = &uid
		}
	}
	if s := q.Get("status"); s != "" {
		if s != "running" && s != "success" && s != "failed" {
			jsonError(w, "status must be running, success, or failed", http.StatusBadRequest)
			return
		}
		f.Status = s
	}
	if p := q.Get("page"); p != "" {
		page, _ := strconv.Atoi(p)
		if page < 0 {
			page = 0
		}
		f.Page = page
	}
	if ps := q.Get("page_size"); ps != "" {
		pageSize, _ := strconv.Atoi(ps)
		if pageSize > 100 {
			pageSize = 100
		}
		if pageSize < 1 {
			pageSize = 20
		}
		f.PageSize = pageSize
	}

	page, err := h.store.ListExecutions(f)
	if err != nil {
		jsonInternalError(w, err, "list executions failed")
		return
	}
	jsonOK(w, page)
}

func (h *Handler) getExecution(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id")
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}
	exec, err := h.store.GetExecution(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			jsonError(w, "not found", http.StatusNotFound)
		} else {
			jsonInternalError(w, err, "get execution failed")
		}
		return
	}
	jsonOK(w, exec)
}

func (h *Handler) getExecutionLogs(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id")
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}
	lines, err := h.store.GetLogLines(id)
	if err != nil {
		jsonInternalError(w, err, "get execution logs failed")
		return
	}
	jsonOK(w, lines)
}

// wsExecutionLogs streams log lines via WebSocket.
// For running executions: sends buffered lines then streams new ones.
// For finished executions: sends all lines then closes.
func (h *Handler) wsExecutionLogs(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id")
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	exec, err := h.store.GetExecution(id)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Warn("ws: upgrade failed", "execID", id, "err", err)
		return
	}
	slog.Info("ws: client connected", "execID", id, "remote_addr", conn.RemoteAddr())

	done := wsReadPump(conn)
	defer func() { <-done }()
	defer func() {
		slog.Info("ws: client disconnected", "execID", id, "remote_addr", conn.RemoteAddr())
		_ = conn.Close()
	}()

	// Send existing log lines
	existing, err := h.store.GetLogLines(id)
	if err != nil {
		slog.Error("ws: failed to fetch existing log lines", "execID", id, "err", err)
		_ = conn.SetWriteDeadline(time.Now().Add(wsWriteTimeout))
		_ = conn.WriteJSON(store.LogLine{
			Level:     "warn",
			Message:   "Could not load historical log lines — database error. Live lines will continue below.",
			Timestamp: time.Now(),
		})
	}
	if !wsSendLines(conn, existing) {
		return
	}

	// If finished, we're done
	if exec.Status != "running" {
		return
	}

	sub := h.scheduler.Broker.Subscribe(id)
	defer h.scheduler.Broker.Unsubscribe(id, sub)

	// Re-check: execution may have finished between the first GetExecution call
	// and Subscribe above.
	if fresh, err := h.store.GetExecution(id); err == nil && fresh.Status != "running" {
		wsDrainChannel(conn, sub)
		return
	}

	wsStreamLoop(conn, done, sub, r)
}

// wsReadPump consumes incoming frames (pings, pong, close) so the TCP
// buffer doesn't fill up. Returns a channel that closes when the read pump exits.
func wsReadPump(conn *websocket.Conn) <-chan struct{} {
	done := make(chan struct{})
	go func() {
		defer close(done)
		_ = conn.SetReadDeadline(time.Now().Add(wsPongTimeout))
		conn.SetPongHandler(func(string) error {
			return conn.SetReadDeadline(time.Now().Add(wsPongTimeout))
		})
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}()
	return done
}

// wsSendLines writes a slice of log lines to the WebSocket. Returns false if sending fails.
func wsSendLines(conn *websocket.Conn, lines []store.LogLine) bool {
	for _, line := range lines {
		if err := conn.SetWriteDeadline(time.Now().Add(wsWriteTimeout)); err != nil {
			return false
		}
		if err := conn.WriteJSON(line); err != nil {
			return false
		}
	}
	return true
}

// wsDrainChannel sends any remaining buffered lines from a subscription channel.
func wsDrainChannel(conn *websocket.Conn, sub <-chan store.LogLine) {
	for {
		select {
		case line, ok := <-sub:
			if !ok {
				return
			}
			if err := conn.SetWriteDeadline(time.Now().Add(wsWriteTimeout)); err != nil {
				return
			}
			if err := conn.WriteJSON(line); err != nil {
				return
			}
		default:
			return
		}
	}
}

// wsStreamLoop streams live log lines and sends periodic pings until the
// subscription closes, the client disconnects, or the request context ends.
func wsStreamLoop(conn *websocket.Conn, done <-chan struct{}, sub <-chan store.LogLine, r *http.Request) {
	ping := time.NewTicker(wsPingInterval)
	defer ping.Stop()

	for {
		select {
		case <-done:
			return
		case line, ok := <-sub:
			if !ok {
				return
			}
			if err := conn.SetWriteDeadline(time.Now().Add(wsWriteTimeout)); err != nil {
				return
			}
			if err := conn.WriteJSON(line); err != nil {
				return
			}
		case <-ping.C:
			if err := conn.SetWriteDeadline(time.Now().Add(wsWriteTimeout)); err != nil {
				return
			}
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		case <-r.Context().Done():
			return
		}
	}
}
