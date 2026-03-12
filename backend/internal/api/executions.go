package api

import (
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"time"

	"github.com/gorilla/websocket"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
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
	f.Status = q.Get("status")
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
			pageSize = 20
		}
		f.PageSize = pageSize
	}

	page, err := h.store.ListExecutions(f)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
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
		jsonError(w, "not found", http.StatusNotFound)
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
		jsonError(w, err.Error(), http.StatusInternalServerError)
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
	defer func() {
		slog.Info("ws: client disconnected", "execID", id, "remote_addr", conn.RemoteAddr())
		_ = conn.Close()
	}()

	// Read pump: consume incoming frames (pings, pong, close) so the TCP
	// buffer doesn't fill up and the connection can be cleanly torn down.
	// Without this goroutine, an ungraceful client disconnect leaks the
	// write-side goroutine until the next write times out.
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

	// Send existing log lines
	existing, err := h.store.GetLogLines(id)
	if err != nil {
		slog.Error("ws: failed to fetch existing log lines", "execID", id, "err", err)
	}
	for _, line := range existing {
		if err := conn.SetWriteDeadline(time.Now().Add(wsWriteTimeout)); err != nil {
			return
		}
		if err := conn.WriteJSON(line); err != nil {
			return
		}
	}

	// If finished, we're done
	if exec.Status != "running" {
		return
	}

	// Subscribe to live lines
	sub := h.scheduler.Broker.Subscribe(id)
	defer h.scheduler.Broker.Unsubscribe(id, sub)

	ping := time.NewTicker(wsPingInterval)
	defer ping.Stop()

	for {
		select {
		case <-done:
			return // client disconnected
		case line, ok := <-sub:
			if !ok {
				return // broker closed — execution finished
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
