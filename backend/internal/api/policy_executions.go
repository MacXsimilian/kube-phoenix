package api

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	"gorm.io/gorm"
)

func (h *Handler) listPolicyExecutions(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	f := store.PolicyExecutionFilter{}

	if pid := q.Get("policy_id"); pid != "" {
		id, err := strconv.ParseUint(pid, 10, 64)
		if err == nil {
			uid := uint(id)
			f.PolicyID = &uid
		}
	}
	if s := q.Get("status"); s != "" {
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

	page, err := h.store.ListPolicyExecutions(f)
	if err != nil {
		jsonInternalError(w, err, "list policy executions failed")
		return
	}
	jsonOK(w, page)
}

func (h *Handler) getPolicyExecution(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id")
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}
	exec, err := h.store.GetPolicyExecution(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			jsonError(w, "not found", http.StatusNotFound)
		} else {
			jsonInternalError(w, err, "get policy execution failed")
		}
		return
	}
	jsonOK(w, exec)
}

func (h *Handler) getPolicyExecutionLogs(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id")
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
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
		jsonError(w, "invalid id", http.StatusBadRequest)
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
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}
	q := r.URL.Query()
	var snaps []store.WorkloadSnapshot
	var snapsErr error
	if q.Get("open") == "true" {
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
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	exec, err := h.store.GetPolicyExecution(id)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Warn("ws policy: upgrade failed", "execID", id, "err", err)
		return
	}
	slog.Info("ws policy: client connected", "execID", id, "remote_addr", conn.RemoteAddr())

	done := wsReadPump(conn)
	defer func() { <-done }()
	defer func() {
		slog.Info("ws policy: client disconnected", "execID", id)
		_ = conn.Close()
	}()

	// Send existing log lines
	existing, err := h.store.GetPolicyLogLines(id)
	if err != nil {
		slog.Error("ws policy: failed to fetch existing log lines", "execID", id, "err", err)
	}
	if !wsSendLines(conn, existing) {
		return
	}

	if exec.Status != "running" {
		return
	}

	sub := h.policyScheduler.Broker.Subscribe(id)
	defer h.policyScheduler.Broker.Unsubscribe(id, sub)

	// Re-check: may have finished between GetPolicyExecution and Subscribe
	if fresh, err := h.store.GetPolicyExecution(id); err == nil && fresh.Status != "running" {
		wsDrainChannel(conn, sub)
		return
	}

	_ = conn.SetReadDeadline(time.Now().Add(wsPongTimeout))
	wsStreamLoop(conn, done, sub, r)
}
