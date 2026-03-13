package api

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/macxsimilian/kube-phoenix/backend/internal/scheduler"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

// ─── Policy list ──────────────────────────────────────────────────────────────

type PolicySummary struct {
	store.SleepPolicy
	NextSleep    *time.Time `json:"nextSleep"`
	NextWake     *time.Time `json:"nextWake"`
	ConflictTags []string   `json:"conflictTags"`
}

func (h *Handler) listPolicies(w http.ResponseWriter, r *http.Request) {
	policies, err := h.store.ListSleepPolicies()
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Build next-event map from scheduler cache
	nextEvents := h.scheduler.NextEvents()
	nextSleepMap := map[uint]time.Time{}
	nextWakeMap := map[uint]time.Time{}
	for _, e := range nextEvents {
		switch e.Edge {
		case "sleep":
			if t, ok := nextSleepMap[e.PolicyID]; !ok || e.FireAt.Before(t) {
				nextSleepMap[e.PolicyID] = e.FireAt
			}
		case "wake":
			if t, ok := nextWakeMap[e.PolicyID]; !ok || e.FireAt.Before(t) {
				nextWakeMap[e.PolicyID] = e.FireAt
			}
		}
	}

	result := make([]PolicySummary, 0, len(policies))
	for _, p := range policies {
		ps := PolicySummary{SleepPolicy: p}

		if t, ok := nextSleepMap[p.ID]; ok {
			ps.NextSleep = &t
		}
		if t, ok := nextWakeMap[p.ID]; ok {
			ps.NextWake = &t
		}

		ps.ConflictTags = parseTags(p.ConflictTags)
		result = append(result, ps)
	}

	jsonOK(w, result)
}

// ─── Create policy ────────────────────────────────────────────────────────────

type createPolicyRequest struct {
	Name                string `json:"name"`
	Description         string `json:"description"`
	Tags                string `json:"tags"`
	Timezone            string `json:"timezone"`
	Mode                string `json:"mode"`
	NamespaceFilter     string `json:"namespaceFilter"`
	Enabled             *bool  `json:"enabled"`
	DriftCorrectionMode string `json:"driftCorrectionMode"`
	TimeoutMinutes      int    `json:"timeoutMinutes"`
}

func (h *Handler) createPolicy(w http.ResponseWriter, r *http.Request) {
	var req createPolicyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid body", http.StatusBadRequest)
		return
	}
	if req.Name == "" {
		jsonError(w, "name is required", http.StatusBadRequest)
		return
	}
	if req.Mode != "plan" && req.Mode != "apply" {
		req.Mode = "plan"
	}
	if req.Timezone == "" {
		req.Timezone = "UTC"
	}
	if _, err := time.LoadLocation(req.Timezone); err != nil {
		jsonError(w, "invalid timezone: "+req.Timezone, http.StatusBadRequest)
		return
	}
	if req.DriftCorrectionMode != "silent" {
		req.DriftCorrectionMode = "record"
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	policy := &store.SleepPolicy{
		Name:                req.Name,
		Description:         req.Description,
		Tags:                req.Tags,
		Timezone:            req.Timezone,
		Mode:                req.Mode,
		NamespaceFilter:     req.NamespaceFilter,
		Enabled:             enabled,
		DriftCorrectionMode: req.DriftCorrectionMode,
		TimeoutMinutes:      req.TimeoutMinutes,
	}

	if err := h.store.CreateSleepPolicy(policy); err != nil {
		slog.Error("create policy failed", "err", err)
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Run conflict detection
	h.runConflictDetectionAndTag(policy.ID)

	// Notify scheduler to recompute
	h.scheduler.Notify()

	// Reload the policy with associations
	created, err := h.store.GetSleepPolicy(policy.ID)
	if err != nil {
		jsonError(w, "policy created but fetch failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	slog.Info("policy created", "policyID", policy.ID, "name", policy.Name)
	w.WriteHeader(http.StatusCreated)
	jsonOK(w, created)
}

// ─── Get policy ───────────────────────────────────────────────────────────────

func (h *Handler) getPolicy(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id")
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}
	p, err := h.store.GetSleepPolicy(id)
	if err != nil {
		jsonError(w, "not found", http.StatusNotFound)
		return
	}
	jsonOK(w, p)
}

// ─── Update policy ────────────────────────────────────────────────────────────

func (h *Handler) updatePolicy(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id")
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}

	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "invalid body", http.StatusBadRequest)
		return
	}

	// Validate timezone if provided
	if tz, ok := body["timezone"].(string); ok && tz != "" {
		if _, err := time.LoadLocation(tz); err != nil {
			jsonError(w, "invalid timezone: "+tz, http.StatusBadRequest)
			return
		}
	}

	updates := map[string]interface{}{}
	fieldMap := map[string]string{
		"name": "name", "description": "description", "tags": "tags",
		"timezone": "timezone", "mode": "mode", "namespaceFilter": "namespace_filter",
		"enabled": "enabled", "driftCorrectionMode": "drift_correction_mode",
		"timeoutMinutes": "timeout_minutes",
	}
	for jsonKey, dbKey := range fieldMap {
		if v, ok := body[jsonKey]; ok {
			updates[dbKey] = v
		}
	}

	p, err := h.store.UpdateSleepPolicy(id, updates)
	if err != nil {
		slog.Error("update policy failed", "policyID", id, "err", err)
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Re-run conflict detection
	h.runConflictDetectionAndTag(id)
	h.scheduler.Notify()

	slog.Info("policy updated", "policyID", id)
	jsonOK(w, p)
}

// ─── Delete policy ────────────────────────────────────────────────────────────

func (h *Handler) deletePolicy(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id")
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}
	if err := h.store.DeleteSleepPolicy(id); err != nil {
		slog.Error("delete policy failed", "policyID", id, "err", err)
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	h.scheduler.Notify()
	slog.Info("policy deleted", "policyID", id)
	w.WriteHeader(http.StatusNoContent)
}

// ─── Policy Windows ───────────────────────────────────────────────────────────

func (h *Handler) listWindows(w http.ResponseWriter, r *http.Request) {
	policyID, err := parseID(r, "id")
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}
	windows, err := h.store.ListWindows(policyID)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if windows == nil {
		windows = []store.PolicyWindow{}
	}
	jsonOK(w, windows)
}

type createWindowRequest struct {
	DaysOfWeek    string          `json:"daysOfWeek"`
	SleepAt       string          `json:"sleepAt"`
	WakeAt        string          `json:"wakeAt"`
	AdvancedRules json.RawMessage `json:"advancedRules"`
}

func (h *Handler) createWindow(w http.ResponseWriter, r *http.Request) {
	policyID, err := parseID(r, "id")
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}

	var req createWindowRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid body", http.StatusBadRequest)
		return
	}

	if err := validateWindowTimes(req.SleepAt, req.WakeAt); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}

	win := &store.PolicyWindow{
		PolicyID:   policyID,
		DaysOfWeek: req.DaysOfWeek,
		SleepAt:    req.SleepAt,
		WakeAt:     req.WakeAt,
	}
	if len(req.AdvancedRules) > 0 && string(req.AdvancedRules) != "null" {
		win.AdvancedRules = []byte(req.AdvancedRules)
	}

	if err := h.store.CreateWindow(win); err != nil {
		slog.Error("create window failed", "policyID", policyID, "err", err)
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	h.runConflictDetectionAndTag(policyID)
	h.scheduler.Notify()

	w.WriteHeader(http.StatusCreated)
	jsonOK(w, win)
}

func (h *Handler) updateWindow(w http.ResponseWriter, r *http.Request) {
	policyID, err := parseID(r, "id")
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}
	windowID, err := parseID(r, "wid")
	if err != nil {
		jsonError(w, "invalid window id", http.StatusBadRequest)
		return
	}

	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "invalid body", http.StatusBadRequest)
		return
	}

	sleepAt, _ := body["sleepAt"].(string)
	wakeAt, _ := body["wakeAt"].(string)
	if sleepAt != "" || wakeAt != "" {
		if err := validateWindowTimes(sleepAt, wakeAt); err != nil {
			jsonError(w, err.Error(), http.StatusBadRequest)
			return
		}
	}

	updates := map[string]interface{}{}
	for jsonKey, dbKey := range map[string]string{
		"daysOfWeek": "days_of_week", "sleepAt": "sleep_at",
		"wakeAt": "wake_at", "advancedRules": "advanced_rules",
	} {
		if v, ok := body[jsonKey]; ok {
			updates[dbKey] = v
		}
	}

	win, err := h.store.UpdateWindow(windowID, updates)
	if err != nil {
		slog.Error("update window failed", "windowID", windowID, "err", err)
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	h.runConflictDetectionAndTag(policyID)
	h.scheduler.Notify()

	jsonOK(w, win)
}

func (h *Handler) deleteWindow(w http.ResponseWriter, r *http.Request) {
	_, err := parseID(r, "id")
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}
	windowID, err := parseID(r, "wid")
	if err != nil {
		jsonError(w, "invalid window id", http.StatusBadRequest)
		return
	}

	if err := h.store.DeleteWindow(windowID); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	h.scheduler.Notify()
	w.WriteHeader(http.StatusNoContent)
}

// ─── Per-policy Guardrails ────────────────────────────────────────────────────

func (h *Handler) getPolicyGuardrails(w http.ResponseWriter, r *http.Request) {
	policyID, err := parseID(r, "id")
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}
	g, err := h.store.GetPolicyGuardrails(policyID)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, g)
}

func (h *Handler) updatePolicyGuardrails(w http.ResponseWriter, r *http.Request) {
	policyID, err := parseID(r, "id")
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}

	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "invalid body", http.StatusBadRequest)
		return
	}

	updates := map[string]interface{}{}
	for jsonKey, dbKey := range map[string]string{
		"skipWorkloads": "skip_workloads", "skipNamespaces": "skip_namespaces",
		"skipNsNode": "skip_ns_node", "skipNodeLabels": "skip_node_labels",
		"skipNodeTaints": "skip_node_taints", "minReplicas": "min_replicas",
		"workloadOverrides": "workload_overrides",
	} {
		if v, ok := body[jsonKey]; ok {
			updates[dbKey] = v
		}
	}

	g, err := h.store.UpsertPolicyGuardrails(policyID, updates)
	if err != nil {
		slog.Error("update policy guardrails failed", "policyID", policyID, "err", err)
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	slog.Info("policy guardrails updated", "policyID", policyID)
	jsonOK(w, g)
}

// ─── Policy Overrides ─────────────────────────────────────────────────────────

type createOverrideRequest struct {
	OccurrenceDate string `json:"occurrenceDate"` // "YYYY-MM-DD"
	Edge           string `json:"edge"`           // "sleep" | "wake" | "both"
	Action         string `json:"action"`         // "skip" (default)
}

func (h *Handler) createOverride(w http.ResponseWriter, r *http.Request) {
	policyID, err := parseID(r, "id")
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}

	var req createOverrideRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid body", http.StatusBadRequest)
		return
	}

	if req.OccurrenceDate == "" {
		jsonError(w, "occurrenceDate is required (YYYY-MM-DD)", http.StatusBadRequest)
		return
	}
	if req.Edge != "sleep" && req.Edge != "wake" && req.Edge != "both" {
		jsonError(w, "edge must be sleep, wake, or both", http.StatusBadRequest)
		return
	}
	if req.Action == "" {
		req.Action = "skip"
	}

	date, err := time.Parse("2006-01-02", req.OccurrenceDate)
	if err != nil {
		jsonError(w, "occurrenceDate must be YYYY-MM-DD", http.StatusBadRequest)
		return
	}

	override := &store.PolicyOverride{
		PolicyID:       policyID,
		OccurrenceDate: date,
		Edge:           req.Edge,
		Action:         req.Action,
	}

	if err := h.store.CreatePolicyOverride(override); err != nil {
		slog.Error("create override failed", "policyID", policyID, "err", err)
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	h.scheduler.Notify()
	slog.Info("override created", "policyID", policyID, "date", req.OccurrenceDate, "edge", req.Edge)
	w.WriteHeader(http.StatusCreated)
	jsonOK(w, override)
}

func (h *Handler) deleteOverride(w http.ResponseWriter, r *http.Request) {
	policyID, err := parseID(r, "id")
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}

	date := chi.URLParam(r, "date")
	edge := chi.URLParam(r, "edge")

	if date == "" || edge == "" {
		jsonError(w, "date and edge are required", http.StatusBadRequest)
		return
	}

	if err := h.store.DeletePolicyOverride(policyID, date, edge); err != nil {
		slog.Error("delete override failed", "policyID", policyID, "err", err)
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	h.scheduler.Notify()
	slog.Info("override deleted", "policyID", policyID, "date", date, "edge", edge)
	w.WriteHeader(http.StatusNoContent)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// runConflictDetectionAndTag runs conflict detection for a policy and updates
// conflict_tags on all involved policies.
func (h *Handler) runConflictDetectionAndTag(policyID uint) {
	policy, err := h.store.GetSleepPolicy(policyID)
	if err != nil {
		slog.Warn("conflict detection: failed to load policy", "policyID", policyID, "err", err)
		return
	}

	allPolicies, err := h.store.ListSleepPolicies()
	if err != nil {
		slog.Warn("conflict detection: failed to list policies", "err", err)
		return
	}

	globalGuardrails, err := h.store.GetGuardrails()
	if err != nil {
		slog.Warn("conflict detection: failed to get guardrails", "err", err)
		return
	}

	// First, clear conflict tags on this policy
	if err := h.store.SetConflictTags(policyID, ""); err != nil {
		slog.Warn("conflict detection: failed to clear tags", "policyID", policyID, "err", err)
	}

	results := scheduler.DetectConflicts(*policy, allPolicies, *globalGuardrails)
	if len(results) == 0 {
		return
	}

	// Build tag sets per policy
	tagsByPolicy := map[uint][]string{}
	for _, r := range results {
		tag := strings.ToUpper(r.Type)
		tagsByPolicy[r.PolicyID] = appendUnique(tagsByPolicy[r.PolicyID], tag)
	}

	// Update tags for each affected policy
	for pid, tags := range tagsByPolicy {
		tagStr := strings.Join(tags, ",")
		if err := h.store.SetConflictTags(pid, tagStr); err != nil {
			slog.Warn("conflict detection: failed to update tags", "policyID", pid, "err", err)
		}
	}

	// Generate notifications
	notifySvc := scheduler.NewNotificationService(h.store)
	notifySvc.NotifyConflicts(results)

	slog.Info("conflict detection complete",
		"policyID", policyID, "results", len(results))
}

func parseTags(s string) []string {
	if s == "" {
		return []string{}
	}
	var tags []string
	for _, t := range strings.Split(s, ",") {
		t = strings.TrimSpace(t)
		if t != "" {
			tags = append(tags, t)
		}
	}
	return tags
}

func appendUnique(slice []string, s string) []string {
	for _, v := range slice {
		if v == s {
			return slice
		}
	}
	return append(slice, s)
}

func validateWindowTimes(sleepAt, wakeAt string) error {
	if sleepAt != "" {
		if len(sleepAt) != 5 || sleepAt[2] != ':' {
			return fmt.Errorf("sleepAt must be HH:MM, got: %s", sleepAt)
		}
	}
	if wakeAt != "" {
		if len(wakeAt) != 5 || wakeAt[2] != ':' {
			return fmt.Errorf("wakeAt must be HH:MM, got: %s", wakeAt)
		}
	}
	return nil
}

