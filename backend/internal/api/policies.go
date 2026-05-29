// SPDX-License-Identifier: Apache-2.0

package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/metrics"
	"github.com/macxsimilian/kube-phoenix/backend/internal/policy"
	"github.com/macxsimilian/kube-phoenix/backend/internal/scheduler"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

// policyResponse wraps Policy with computed next-transition time and parsed windows.
type policyResponse struct {
	store.Policy
	NextTransitionAt *time.Time           `json:"nextTransitionAt,omitempty"`
	SleepWindows     []policy.SleepWindow `json:"sleepWindows"`
}

func (h *Handler) policyResp(p store.Policy) policyResponse {
	nextTransition := h.policyScheduler.NextTransition(p.ID)
	return h.policyRespWithTransition(p, nextTransition)
}

// policyRespWithTransition builds a policy response using a precomputed next
// transition, avoiding a scheduler-mutex acquisition. Used by list handlers
// that batch-fetch transitions in a single lock acquisition.
func (h *Handler) policyRespWithTransition(p store.Policy, nextTransition *time.Time) policyResponse {
	windows := parseSleepWindows(p)
	return policyResponse{Policy: p, NextTransitionAt: nextTransition, SleepWindows: windows}
}

// parseSleepWindows deserializes stored windows.
func parseSleepWindows(p store.Policy) []policy.SleepWindow {
	if p.SleepWindows != "" {
		var w []policy.SleepWindow
		if err := json.Unmarshal([]byte(p.SleepWindows), &w); err != nil {
			slog.Warn("failed to parse sleepWindows JSON",
				"policyID", p.ID, "err", err)
		} else if len(w) > 0 {
			return w
		}
	}
	return nil
}

func (h *Handler) listPolicies(w http.ResponseWriter, r *http.Request) {
	policies, err := h.store.ListPolicies()
	if err != nil {
		jsonInternalError(w, err, "list policies failed")
		return
	}
	policyIDs := make([]uint, len(policies))
	for i, p := range policies {
		policyIDs[i] = p.ID
	}
	transitions := h.policyScheduler.NextTransitions(policyIDs)
	resp := make([]policyResponse, len(policies))
	for i, p := range policies {
		resp[i] = h.policyRespWithTransition(p, transitions[p.ID])
	}
	jsonOK(w, resp)
}

func (h *Handler) getPolicy(w http.ResponseWriter, r *http.Request) {
	p, ok := h.requirePolicy(w, r)
	if !ok {
		return
	}
	jsonOK(w, h.policyResp(*p))
}

// requirePolicy parses the policy ID from the URL, fetches the policy, and
// writes error responses on failure. Returns the policy and true on success.
func (h *Handler) requirePolicy(w http.ResponseWriter, r *http.Request) (*store.Policy, bool) {
	id, err := parseID(r, "id")
	if err != nil {
		jsonError(w, ErrInvalidID, http.StatusBadRequest)
		return nil, false
	}
	p, err := h.store.GetPolicy(id)
	if err != nil {
		handleStoreError(w, err, ErrNotFound, "get policy failed")
		return nil, false
	}
	return p, true
}

// createPolicyInput is the request body for creating a policy.
type createPolicyInput struct {
	store.Policy
	SleepWindows []policy.SleepWindow `json:"sleepWindows"`
}

func (h *Handler) createPolicy(w http.ResponseWriter, r *http.Request) {
	var input createPolicyInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		jsonError(w, ErrInvalidBody, http.StatusBadRequest)
		return
	}

	p, msg := validateAndPreparePolicy(input)
	if msg != "" {
		jsonError(w, msg, http.StatusBadRequest)
		return
	}

	if p.Mode == store.PolicyModeApply {
		overlap, err := h.store.HasApplyPolicyOverlap(0, p.NamespaceFilter)
		if err != nil {
			jsonInternalError(w, err, "conflict check failed")
			return
		}
		if overlap {
			jsonError(w, "an existing apply-mode policy may overlap with these targets; resolve the conflict before saving", http.StatusConflict)
			return
		}
	}

	if err := h.store.CreatePolicy(&p); err != nil {
		metrics.PolicyOperationsTotal.WithLabelValues("create", "error").Inc()
		jsonInternalError(w, err, "create policy failed")
		return
	}
	metrics.PolicyOperationsTotal.WithLabelValues("create", "success").Inc()
	slog.Info("policy created", "policyID", p.ID, "name", p.Name)
	h.audit(r, "policy.create", "policy", &p.ID, nil, policyAuditSnapshot(p))
	h.reloadScheduler(p.ID)
	jsonCreated(w, h.policyResp(p))
}

// policyFieldMap maps JSON field names to database column names.
var policyFieldMap = map[string]string{
	"name":            "name",
	"description":     "description",
	"namespaceFilter": "namespace_filter",
	"labelSelector":   "label_selector",
	"timezone":        "timezone",
	"mode":            "mode",
	"enabled":         "enabled",
	"timeoutMinutes":  "timeout_minutes",
}

// applySleepWindowUpdates validates sleep windows from the request body and
// merges them into the update map.
func applySleepWindowUpdates(body map[string]interface{}, updates map[string]interface{}) string {
	rawWindows, ok := body["sleepWindows"]
	if !ok {
		return ""
	}
	windowsJSON, err := json.Marshal(rawWindows)
	if err != nil {
		return "invalid sleepWindows"
	}
	var windows []policy.SleepWindow
	if err := json.Unmarshal(windowsJSON, &windows); err != nil {
		return "invalid sleepWindows format"
	}
	if len(windows) == 0 {
		return "sleepWindows must not be empty"
	}
	if err := policy.ValidateWindows(windows); err != nil {
		return err.Error()
	}
	updates["sleep_windows"] = string(windowsJSON)
	return ""
}

// buildPolicyUpdateMap extracts allowed fields from the raw JSON body, validates
// sleep windows, and returns the GORM update map. Returns an error message (for
// the client) if validation fails.
func buildPolicyUpdateMap(body map[string]interface{}) (map[string]interface{}, string) {
	updates := map[string]interface{}{}
	for jsonKey, dbCol := range policyFieldMap {
		if v, ok := body[jsonKey]; ok {
			updates[dbCol] = v
		}
	}
	if msg := applySleepWindowUpdates(body, updates); msg != "" {
		return nil, msg
	}
	if msg := validatePolicyUpdates(updates); msg != "" {
		return nil, msg
	}
	return updates, ""
}

func (h *Handler) updatePolicy(w http.ResponseWriter, r *http.Request) {
	old, ok := h.requirePolicy(w, r)
	if !ok {
		return
	}

	updates, msg := decodePolicyUpdates(r, old)
	if msg != "" {
		jsonError(w, msg, http.StatusBadRequest)
		return
	}

	id := old.ID
	if msg, err := h.checkPolicyOverlap(id, old, updates); err != nil {
		jsonInternalError(w, err, "conflict check failed")
		return
	} else if msg != "" {
		jsonError(w, msg, http.StatusConflict)
		return
	}

	p, err := h.store.UpdatePolicy(id, updates)
	if err != nil {
		metrics.PolicyOperationsTotal.WithLabelValues("update", "error").Inc()
		jsonInternalError(w, err, "update policy failed")
		return
	}
	metrics.PolicyOperationsTotal.WithLabelValues("update", "success").Inc()

	h.audit(r, "policy.update", "policy", &id, old, p)
	h.reloadScheduler(id)
	jsonOK(w, h.policyResp(*p))
}

// decodePolicyUpdates reads the request body, builds the update map, and
// validates that the resulting policy still has at least one sleep window.
// Returns the update map and an error message (empty on success).
func decodePolicyUpdates(r *http.Request, old *store.Policy) (map[string]interface{}, string) {
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		return nil, ErrInvalidBody
	}

	updates, msg := buildPolicyUpdateMap(body)
	if msg != "" {
		return nil, msg
	}

	finalWindows := old.SleepWindows
	if v, ok := updates["sleep_windows"]; ok {
		finalWindows = fmt.Sprintf("%v", v)
	}
	if finalWindows == "" || finalWindows == "[]" {
		return nil, "policy must have at least one sleep window"
	}

	return updates, ""
}

func (h *Handler) deletePolicy(w http.ResponseWriter, r *http.Request) {
	old, ok := h.requirePolicy(w, r)
	if !ok {
		return
	}
	id := old.ID
	if err := h.store.DeletePolicy(id); err != nil {
		metrics.PolicyOperationsTotal.WithLabelValues("delete", "error").Inc()
		handleStoreError(w, err, ErrNotFound, "delete policy failed")
		return
	}
	metrics.PolicyOperationsTotal.WithLabelValues("delete", "success").Inc()
	slog.Info("policy deleted", "policyID", id)
	h.audit(r, "policy.delete", "policy", &id, old, nil)
	h.reloadScheduler(id)
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) triggerPolicySleep(w http.ResponseWriter, r *http.Request) {
	h.triggerPolicyAction(w, r, "sleep", h.policyScheduler.RunSleepNow, "manual_sleep", "policy.sleep")
}

func (h *Handler) triggerPolicyWake(w http.ResponseWriter, r *http.Request) {
	h.triggerPolicyAction(w, r, "wake", h.policyScheduler.RunWakeNow, "manual_wake", "policy.wake")
}

// triggerPolicyAction is the shared implementation for manual sleep/wake triggers.
func (h *Handler) triggerPolicyAction(w http.ResponseWriter, r *http.Request, direction string, runFn func(uint, string, string) (uint, error), trigger, auditAction string) {
	p, ok := h.requirePolicy(w, r)
	if !ok {
		return
	}
	id := p.ID

	// Parse optional mode override from request body.
	var body struct {
		Mode string `json:"mode"`
	}
	// Body may be empty — that's fine, mode stays "".
	_ = json.NewDecoder(r.Body).Decode(&body)
	if body.Mode != "" && body.Mode != "plan" && body.Mode != "apply" {
		jsonError(w, "mode must be \"plan\" or \"apply\"", http.StatusBadRequest)
		return
	}

	execID, err := runFn(id, trigger, body.Mode)
	if err != nil {
		if scheduler.IsAlreadyRunning(err) {
			jsonError(w, "policy is already executing — wait for current run to finish", http.StatusConflict)
			return
		}
		jsonInternalError(w, err, "trigger policy "+direction+" failed")
		return
	}
	slog.Info("policy manual "+direction+" triggered", "policyID", id, "execID", execID)
	auditData := map[string]interface{}{"executionId": execID, "trigger": trigger}
	if body.Mode != "" {
		auditData["modeOverride"] = body.Mode
	}
	h.audit(r, auditAction, "policy", &id, nil, auditData)
	jsonOK(w, map[string]uint{"executionId": execID})
}

func (h *Handler) cancelPolicyExecution(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id")
	if err != nil {
		jsonError(w, ErrInvalidID, http.StatusBadRequest)
		return
	}
	if err := h.policyScheduler.CancelExecution(id); err != nil {
		if errors.Is(err, scheduler.ErrNoInflightExecution) {
			jsonError(w, "no running execution for this policy", http.StatusConflict)
			return
		}
		jsonInternalError(w, err, "cancel execution failed")
		return
	}
	slog.Info("policy execution cancelled", "policyID", id)
	h.audit(r, "policy.cancel", "policy", &id, nil, nil)
	jsonOK(w, map[string]string{"status": "cancelled"})
}

// policyAuditSnapshot builds a clean map for audit logs, omitting null/zero
// derived-state fields that carry no information on create events.
func policyAuditSnapshot(p store.Policy) map[string]interface{} {
	m := map[string]interface{}{
		"id":           p.ID,
		"name":         p.Name,
		"mode":         p.Mode,
		"enabled":      p.Enabled,
		"currentState": p.CurrentState,
		"timezone":     p.Timezone,
		"createdAt":    p.CreatedAt,
	}
	if p.Description != "" {
		m["description"] = p.Description
	}
	if p.NamespaceFilter != "" {
		m["namespaceFilter"] = p.NamespaceFilter
	}
	if p.LabelSelector != "" {
		m["labelSelector"] = p.LabelSelector
	}
	if p.TimeoutMinutes != 0 {
		m["timeoutMinutes"] = p.TimeoutMinutes
	}
	if p.StateSince != nil {
		m["stateSince"] = p.StateSince
	}
	if p.LastSleepAt != nil {
		m["lastSleepAt"] = p.LastSleepAt
	}
	if p.LastWakeAt != nil {
		m["lastWakeAt"] = p.LastWakeAt
	}
	return m
}
