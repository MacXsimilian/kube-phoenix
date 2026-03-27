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
		filter.Status = s
	}
	if d := query.Get("direction"); d != "" {
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
		if errors.Is(err, gorm.ErrRecordNotFound) {
			jsonError(w, ErrNotFound, http.StatusNotFound)
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

	if exec.Status != store.ExecStatusRunning {
		return
	}

	sub := h.policyScheduler.Broker.Subscribe(id)
	defer h.policyScheduler.Broker.Unsubscribe(id, sub)

	// Re-check: may have finished between GetPolicyExecution and Subscribe
	if fresh, err := h.store.GetPolicyExecution(id); err == nil && fresh.Status != store.ExecStatusRunning {
		wsDrainChannel(conn, sub)
		return
	}

	_ = conn.SetReadDeadline(time.Now().Add(wsPongTimeout))
	wsStreamLoop(conn, done, sub, r)
}
