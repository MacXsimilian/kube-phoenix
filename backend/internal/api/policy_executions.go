package api

import (
	"log/slog"
	"net/http"
	"strconv"
	"sync/atomic"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/metrics"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

const maxWSConnections = 100

var wsConnectionCount atomic.Int64

func (h *Handler) listPolicyExecutions(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	filter := store.PolicyExecutionFilter{}

	if pid := query.Get("policy_id"); pid != "" {
		id, err := strconv.ParseUint(pid, 10, 64)
		if err == nil {
			uid := uint(id)
			filter.PolicyID = &uid
		}
	}
	if s := query.Get("status"); s != "" {
		if !validExecStatuses[s] {
			jsonError(w, "status must be running, success, failed, or interrupted", http.StatusBadRequest)
			return
		}
		filter.Status = s
	}
	if d := query.Get("direction"); d != "" {
		if d != "sleep" && d != "wake" {
			jsonError(w, "direction must be sleep or wake", http.StatusBadRequest)
			return
		}
		filter.Direction = d
	}
	if p := query.Get("page"); p != "" {
		page, _ := strconv.Atoi(p)
		if page < 0 {
			page = 0
		}
		filter.Page = page
	}
	filter.PageSize = parsePageSize(query, 20, 100)

	page, err := h.store.ListPolicyExecutions(filter)
	if err != nil {
		jsonInternalError(w, err, "list policy executions failed")
		return
	}
	jsonOK(w, page)
}

func (h *Handler) getPolicyExecution(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id")
	if err != nil {
		jsonError(w, ErrInvalidID, http.StatusBadRequest)
		return
	}
	exec, err := h.store.GetPolicyExecution(id)
	if err != nil {
		handleStoreError(w, err, ErrNotFound, "get policy execution failed")
		return
	}
	jsonOK(w, exec)
}

func (h *Handler) getPolicyExecutionLogs(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id")
	if err != nil {
		jsonError(w, ErrInvalidID, http.StatusBadRequest)
		return
	}
	lines, err := h.store.GetPolicyLogLines(id)
	if err != nil {
		jsonInternalError(w, err, "get policy execution logs failed")
		return
	}
	jsonOK(w, lines)
}

func (h *Handler) getPolicyExecutionSnapshots(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id")
	if err != nil {
		jsonError(w, ErrInvalidID, http.StatusBadRequest)
		return
	}
	snaps, err := h.store.GetSnapshotsForExecution(id)
	if err != nil {
		jsonInternalError(w, err, "get snapshots failed")
		return
	}
	jsonOK(w, snaps)
}

func (h *Handler) getPolicySnapshots(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id")
	if err != nil {
		jsonError(w, ErrInvalidID, http.StatusBadRequest)
		return
	}
	query := r.URL.Query()
	var snaps []store.WorkloadSnapshot
	var snapsErr error
	if query.Get("open") == "true" {
		snaps, snapsErr = h.store.GetOpenSnapshots(id)
	} else {
		snaps, snapsErr = h.store.GetSnapshotsForPolicy(id)
	}
	if snapsErr != nil {
		jsonInternalError(w, snapsErr, "get policy snapshots failed")
		return
	}
	jsonOK(w, snaps)
}

// wsPolicyExecutionLogs streams PolicyLogLine entries via WebSocket,
// following the same pattern as wsExecutionLogs.
func (h *Handler) wsPolicyExecutionLogs(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id")
	if err != nil {
		http.Error(w, ErrInvalidID, http.StatusBadRequest)
		return
	}

	exec, err := h.store.GetPolicyExecution(id)
	if err != nil {
		http.Error(w, ErrNotFound, http.StatusNotFound)
		return
	}

	// Atomically claim a connection slot to avoid TOCTOU race.
	for {
		cur := wsConnectionCount.Load()
		if cur >= maxWSConnections {
			http.Error(w, "too many WebSocket connections", http.StatusServiceUnavailable)
			return
		}
		if wsConnectionCount.CompareAndSwap(cur, cur+1) {
			break
		}
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		wsConnectionCount.Add(-1) // release the slot we claimed
		slog.Warn("ws policy: upgrade failed", "execID", id, "err", err)
		return
	}
	slog.Info("ws policy: client connected", "execID", id, "remote_addr", conn.RemoteAddr())
	metrics.WSConnectionsTotal.Inc()
	metrics.WSActiveConnections.Inc()

	done := wsReadPump(conn)
	defer func() { <-done }()
	defer func() {
		wsConnectionCount.Add(-1)
		metrics.WSActiveConnections.Dec()
		slog.Info("ws policy: client disconnected", "execID", id)
		_ = conn.Close()
	}()

	if exec.Status != store.ExecStatusRunning {
		// Execution already finished — send persisted lines and close.
		existing, err := h.store.GetPolicyLogLines(id)
		if err != nil {
			slog.Error("ws policy: failed to fetch existing log lines", "execID", id, "err", err)
		}
		wsSendLines(conn, existing)
		return
	}

	// Subscribe FIRST so the broker channel captures lines published while
	// the DB query runs. The replay buffer covers lines not yet flushed to
	// the database, closing the gap between persisted history and the live
	// stream. See docs/observability.md "Log Streaming Architecture".
	sub, replayLines := h.policyScheduler.Broker.Subscribe(id)
	if sub == nil {
		slog.Warn("ws policy: subscriber limit reached", "execID", id)
		return
	}
	defer h.policyScheduler.Broker.Unsubscribe(id, sub)

	// Fetch persisted lines from DB.
	existing, err := h.store.GetPolicyLogLines(id)
	if err != nil {
		slog.Error("ws policy: failed to fetch existing log lines", "execID", id, "err", err)
	}
	if !wsSendLines(conn, existing) {
		return
	}

	// Send replay lines that are not yet in the DB (dedup by seq on the
	// frontend handles any overlap with the DB result).
	maxDBSeq := 0
	for _, line := range existing {
		if line.Seq > maxDBSeq {
			maxDBSeq = line.Seq
		}
	}
	for _, line := range replayLines {
		if line.Seq <= maxDBSeq {
			continue
		}
		if err := conn.SetWriteDeadline(time.Now().Add(wsWriteTimeout)); err != nil {
			return
		}
		if err := conn.WriteJSON(line); err != nil {
			return
		}
	}

	// Re-check: may have finished between initial check and Subscribe.
	if fresh, err := h.store.GetPolicyExecution(id); err == nil && fresh.Status != store.ExecStatusRunning {
		wsDrainChannel(conn, sub)
		return
	}

	_ = conn.SetReadDeadline(time.Now().Add(wsPongTimeout))
	wsStreamLoop(conn, done, sub, r)
}
