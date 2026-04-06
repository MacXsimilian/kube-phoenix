// SPDX-License-Identifier: Apache-2.0

package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/metrics"
	"github.com/macxsimilian/kube-phoenix/backend/internal/policy"
	"github.com/macxsimilian/kube-phoenix/backend/internal/scheduler"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"

	"k8s.io/apimachinery/pkg/labels"
)

// reNamespace matches valid Kubernetes namespace names (RFC 1123 DNS label).
var reNamespace = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`)

func validateNamespaceFilter(filter string) string {
	if filter == "" {
		return ""
	}
	for _, ns := range strings.Split(filter, ",") {
		ns = strings.TrimSpace(ns)
		if ns == "" {
			continue
		}
		if len(ns) > 63 {
			return fmt.Sprintf("namespace %q exceeds the 63-character limit", ns)
		}
		if !reNamespace.MatchString(ns) {
			return fmt.Sprintf("%q is not a valid namespace name (lowercase alphanumeric and hyphens only, must start and end with alphanumeric)", ns)
		}
	}
	return ""
}

// policyResponse wraps Policy with computed next-transition time and parsed windows.
type policyResponse struct {
	store.Policy
	NextTransitionAt *time.Time           `json:"nextTransitionAt,omitempty"`
	SleepWindows     []policy.SleepWindow `json:"sleepWindows"`
}

func (h *Handler) policyResp(p store.Policy) policyResponse {
	nextTransition := h.policyScheduler.NextTransition(p.ID)
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
	resp := make([]policyResponse, len(policies))
	for i, p := range policies {
		resp[i] = h.policyResp(p)
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

// validateAndPreparePolicy validates the input, serialises sleep windows, and
// applies defaults (timezone, mode, initial state). Returns the prepared policy
// and an error message (empty on success).
func validateAndPreparePolicy(input createPolicyInput) (store.Policy, string) {
	p := input.Policy
	if p.Name == "" {
		return p, "name is required"
	}
	if len(input.SleepWindows) == 0 {
		return p, "sleepWindows is required"
	}
	if err := policy.ValidateWindows(input.SleepWindows); err != nil {
		return p, err.Error()
	}
	windowsJSON, err := json.Marshal(input.SleepWindows)
	if err != nil {
		return p, "failed to marshal sleep windows"
	}
	p.SleepWindows = string(windowsJSON)

	if msg := validatePolicyFields(p); msg != "" {
		return p, msg
	}
	if p.Timezone == "" {
		p.Timezone = "UTC"
	}
	if p.Mode == "" {
		p.Mode = "plan"
	}

	now := time.Now()
	initialState := scheduler.IntendedState(scheduler.StateInput{
		Windows: input.SleepWindows, Timezone: p.Timezone, Now: now,
	})
	p.CurrentState = string(initialState)
	p.StateSince = &now

	return p, ""
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

// checkPolicyOverlap verifies that an apply-mode policy won't conflict with
// existing policies. Returns an error message if overlap is detected, or "".
func (h *Handler) checkPolicyOverlap(id uint, old *store.Policy, updates map[string]interface{}) (string, error) {
	finalMode := old.Mode
	if v, ok := updates["mode"]; ok {
		finalMode = fmt.Sprintf("%v", v)
	}
	if finalMode != store.PolicyModeApply {
		return "", nil
	}
	finalNS := old.NamespaceFilter
	if v, ok := updates["namespace_filter"]; ok {
		finalNS = fmt.Sprintf("%v", v)
	}
	overlap, err := h.store.HasApplyPolicyOverlap(id, finalNS)
	if err != nil {
		return "", err
	}
	if overlap {
		return "an existing apply-mode policy may overlap with these targets; resolve the conflict before saving", nil
	}
	return "", nil
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

// ─── Validation ───────────────────────────────────────────────────────────────

// validatePolicyMode checks that mode is a recognised value.
func validatePolicyMode(mode string) string {
	if mode != "" && mode != store.PolicyModePlan && mode != store.PolicyModeApply {
		return "mode must be plan or apply"
	}
	return ""
}

// validatePolicyTimezone checks that tz is a valid IANA timezone.
func validatePolicyTimezone(tz string) string {
	if tz != "" {
		if _, err := time.LoadLocation(tz); err != nil {
			return "invalid timezone"
		}
	}
	return ""
}

// validatePolicyName returns an error message if the name is too long.
func validatePolicyName(name string) string {
	if len(name) > maxNameLen {
		return "name must be 255 characters or fewer"
	}
	return ""
}

// validatePolicyDescription returns an error message if the description is too long.
func validatePolicyDescription(desc string) string {
	if len(desc) > maxDescriptionLen {
		return "description must be 1024 characters or fewer"
	}
	return ""
}

// validatePolicyLabelSelector returns an error message if the label selector is
// too long or syntactically invalid.
func validatePolicyLabelSelector(sel string) string {
	if len(sel) > maxLabelSelectorLen {
		return "labelSelector must be 4096 characters or fewer"
	}
	if sel != "" {
		if _, err := labels.Parse(sel); err != nil {
			return fmt.Sprintf("invalid labelSelector: %v", err)
		}
	}
	return ""
}

// validatePolicyTimeout returns an error message if the timeout is out of range.
func validatePolicyTimeout(minutes int) string {
	if minutes < 0 || minutes > 1440 {
		return "timeoutMinutes must be between 0 and 1440"
	}
	return ""
}

func validatePolicyFields(p store.Policy) string {
	validators := []string{
		validatePolicyName(p.Name),
		validatePolicyDescription(p.Description),
		validatePolicyLabelSelector(p.LabelSelector),
		validatePolicyTimeout(p.TimeoutMinutes),
		validatePolicyMode(p.Mode),
		validatePolicyTimezone(p.Timezone),
		validateNamespaceFilter(p.NamespaceFilter),
	}
	for _, msg := range validators {
		if msg != "" {
			return msg
		}
	}
	return ""
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

func validatePolicyUpdates(updates map[string]interface{}) string {
	if v, ok := updates["name"]; ok {
		if msg := validatePolicyName(fmt.Sprintf("%v", v)); msg != "" {
			return msg
		}
	}
	if v, ok := updates["timeout_minutes"]; ok {
		if f, ok := v.(float64); ok {
			if msg := validatePolicyTimeout(int(f)); msg != "" {
				return msg
			}
		}
	}
	if v, ok := updates["mode"]; ok {
		if msg := validatePolicyMode(fmt.Sprintf("%v", v)); msg != "" {
			return msg
		}
	}
	if v, ok := updates["timezone"]; ok {
		if msg := validatePolicyTimezone(fmt.Sprintf("%v", v)); msg != "" {
			return msg
		}
	}
	if v, ok := updates["namespace_filter"]; ok {
		if msg := validateNamespaceFilter(fmt.Sprintf("%v", v)); msg != "" {
			return msg
		}
	}
	if v, ok := updates["description"]; ok {
		if msg := validatePolicyDescription(fmt.Sprintf("%v", v)); msg != "" {
			return msg
		}
	}
	if v, ok := updates["label_selector"]; ok {
		if msg := validatePolicyLabelSelector(fmt.Sprintf("%v", v)); msg != "" {
			return msg
		}
	}
	return ""
}
