package api

import (
	"net/http"
	"net/url"
	"os"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/gorilla/websocket"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
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
		return
	}
	defer conn.Close()

	// Send existing log lines
	existing, err := h.store.GetLogLines(id)
	if err == nil {
		for _, line := range existing {
			if err := conn.WriteJSON(line); err != nil {
				return
			}
		}
	}

	// If finished, we're done
	if exec.Status != "running" {
		return
	}

	// Subscribe to live lines
	sub := h.scheduler.Broker.Subscribe(id)
	defer h.scheduler.Broker.Unsubscribe(id, sub)

	conn.SetWriteDeadline(time.Time{}) // no deadline for streaming

	for {
		select {
		case line, ok := <-sub:
			if !ok {
				return // broker closed — execution finished
			}
			if err := conn.WriteJSON(line); err != nil {
				return
			}
		case <-r.Context().Done():
			return
		}
	}
}
