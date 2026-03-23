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

	"github.com/macxsimilian/kube-phoenix/backend/internal/policy"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	"gorm.io/gorm"
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
	nt := h.policyScheduler.NextTransition(p.ID)
	windows := parseSleepWindows(p)
	return policyResponse{Policy: p, NextTransitionAt: nt, SleepWindows: windows}
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
	id, err := parseID(r, "id")
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}
	p, err := h.store.GetPolicy(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			jsonError(w, "not found", http.StatusNotFound)
		} else {
			jsonInternalError(w, err, "get policy failed")
		}
		return
	}
	jsonOK(w, h.policyResp(*p))
}

// createPolicyInput is the request body for creating a policy.
type createPolicyInput struct {
	store.Policy
	SleepWindows []policy.SleepWindow `json:"sleepWindows"`
}

func (h *Handler) createPolicy(w http.ResponseWriter, r *http.Request) {
	var input createPolicyInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		jsonError(w, "invalid body", http.StatusBadRequest)
		return
	}
	p := input.Policy
	if p.Name == "" {
		jsonError(w, "name is required", http.StatusBadRequest)
		return
	}

	if len(input.SleepWindows) == 0 {
		jsonError(w, "sleepWindows is required", http.StatusBadRequest)
		return
	}
	if err := policy.ValidateWindows(input.SleepWindows); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	windowsJSON, _ := json.Marshal(input.SleepWindows)
	p.SleepWindows = string(windowsJSON)

	if msg := validatePolicyFields(p); msg != "" {
		jsonError(w, msg, http.StatusBadRequest)
		return
	}
	if p.Timezone == "" {
		p.Timezone = "UTC"
	}
	if p.Mode == "" {
		p.Mode = "plan"
	}
	p.CurrentState = "unknown"

	if p.Mode == "apply" && p.Enabled {
		overlap, err := h.store.HasApplyPolicyOverlap(0, p.NamespaceFilter, p.LabelSelector)
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
		jsonInternalError(w, err, "create policy failed")
		return
	}
	slog.Info("policy created", "policyID", p.ID, "name", p.Name)
	h.audit(r, "policy.create", "policy", &p.ID, nil, p)
	if err := h.policyScheduler.Reload(); err != nil {
		slog.Error("policy scheduler reload after create failed", "err", err)
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(h.policyResp(p))
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

func (h *Handler) updatePolicy(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id")
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}
	old, err := h.store.GetPolicy(id)
	if err != nil {
		jsonError(w, "not found", http.StatusNotFound)
		return
	}

	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "invalid body", http.StatusBadRequest)
		return
	}

	updates := map[string]interface{}{}
	for jsonKey, dbCol := range policyFieldMap {
		if v, ok := body[jsonKey]; ok {
			updates[dbCol] = v
		}
	}

	if msg := applySleepWindowUpdates(body, updates); msg != "" {
		jsonError(w, msg, http.StatusBadRequest)
		return
	}
	if msg := validatePolicyUpdates(updates); msg != "" {
		jsonError(w, msg, http.StatusBadRequest)
		return
	}

	// Validate that the policy still has windows after update.
	finalWindows := old.SleepWindows
	if v, ok := updates["sleep_windows"]; ok {
		finalWindows = fmt.Sprintf("%v", v)
	}
	if finalWindows == "" || finalWindows == "[]" {
		jsonError(w, "policy must have at least one sleep window", http.StatusBadRequest)
		return
	}

	// Check for overlap BEFORE writing to the database.
	finalMode := old.Mode
	if v, ok := updates["mode"]; ok {
		finalMode = fmt.Sprintf("%v", v)
	}
	finalEnabled := old.Enabled
	if v, ok := updates["enabled"]; ok {
		if b, isBool := v.(bool); isBool {
			finalEnabled = b
		}
	}
	if finalMode == "apply" && finalEnabled {
		finalNS := old.NamespaceFilter
		if v, ok := updates["namespace_filter"]; ok {
			finalNS = fmt.Sprintf("%v", v)
		}
		finalLabel := old.LabelSelector
		if v, ok := updates["label_selector"]; ok {
			finalLabel = fmt.Sprintf("%v", v)
		}
		overlap, checkErr := h.store.HasApplyPolicyOverlap(id, finalNS, finalLabel)
		if checkErr != nil {
			jsonInternalError(w, checkErr, "conflict check failed")
			return
		}
		if overlap {
			jsonError(w, "an existing apply-mode policy may overlap with these targets; resolve the conflict before saving", http.StatusConflict)
			return
		}
	}

	p, err := h.store.UpdatePolicy(id, updates)
	if err != nil {
		jsonInternalError(w, err, "update policy failed")
		return
	}

	h.audit(r, "policy.update", "policy", &id, old, p)
	if err := h.policyScheduler.Reload(); err != nil {
		slog.Error("policy scheduler reload after update failed", "policyID", id, "err", err)
	}
	jsonOK(w, h.policyResp(*p))
}

func (h *Handler) deletePolicy(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id")
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}
	old, _ := h.store.GetPolicy(id)
	if err := h.store.DeletePolicy(id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			jsonError(w, "not found", http.StatusNotFound)
		} else {
			jsonInternalError(w, err, "delete policy failed")
		}
		return
	}
	slog.Info("policy deleted", "policyID", id)
	h.audit(r, "policy.delete", "policy", &id, old, nil)
	if err := h.policyScheduler.Reload(); err != nil {
		slog.Error("policy scheduler reload after delete failed", "policyID", id, "err", err)
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) triggerPolicySleep(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id")
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}
	if _, err := h.store.GetPolicy(id); err != nil {
		jsonError(w, "not found", http.StatusNotFound)
		return
	}
	execID, err := h.policyScheduler.RunSleepNow(id, "manual_sleep")
	if err != nil {
		if err.Error() == fmt.Sprintf("policy %d is already transitioning", id) {
			jsonError(w, "policy is already executing — wait for current run to finish", http.StatusConflict)
			return
		}
		jsonInternalError(w, err, "trigger policy sleep failed")
		return
	}
	slog.Info("policy manual sleep triggered", "policyID", id, "execID", execID)
	h.audit(r, "policy.sleep", "policy", &id, nil, nil)
	jsonOK(w, map[string]uint{"executionId": execID})
}

func (h *Handler) triggerPolicyWake(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id")
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}
	if _, err := h.store.GetPolicy(id); err != nil {
		jsonError(w, "not found", http.StatusNotFound)
		return
	}
	execID, err := h.policyScheduler.RunWakeNow(id, "manual_wake")
	if err != nil {
		if err.Error() == fmt.Sprintf("policy %d is already transitioning", id) {
			jsonError(w, "policy is already executing — wait for current run to finish", http.StatusConflict)
			return
		}
		jsonInternalError(w, err, "trigger policy wake failed")
		return
	}
	slog.Info("policy manual wake triggered", "policyID", id, "execID", execID)
	h.audit(r, "policy.wake", "policy", &id, nil, nil)
	jsonOK(w, map[string]uint{"executionId": execID})
}

// ─── Validation ───────────────────────────────────────────────────────────────

func validatePolicyFields(p store.Policy) string {
	if len(p.Name) > 255 {
		return "name must be 255 characters or fewer"
	}
	if p.TimeoutMinutes < 0 || p.TimeoutMinutes > 1440 {
		return "timeoutMinutes must be between 0 and 1440"
	}
	if p.Mode != "" && p.Mode != "plan" && p.Mode != "apply" {
		return "mode must be plan or apply"
	}
	if p.Timezone != "" {
		if _, err := time.LoadLocation(p.Timezone); err != nil {
			return "invalid timezone"
		}
	}
	if msg := validateNamespaceFilter(p.NamespaceFilter); msg != "" {
		return msg
	}
	return ""
}

func validatePolicyUpdates(updates map[string]interface{}) string {
	if v, ok := updates["timezone"]; ok {
		if _, err := time.LoadLocation(fmt.Sprintf("%v", v)); err != nil {
			return "invalid timezone"
		}
	}
	if v, ok := updates["mode"]; ok {
		if m := fmt.Sprintf("%v", v); m != "plan" && m != "apply" {
			return "mode must be plan or apply"
		}
	}
	if v, ok := updates["name"]; ok {
		if len(fmt.Sprintf("%v", v)) > 255 {
			return "name must be 255 characters or fewer"
		}
	}
	if v, ok := updates["timeout_minutes"]; ok {
		if f, ok := v.(float64); ok {
			if int(f) < 0 || int(f) > 1440 {
				return "timeoutMinutes must be between 0 and 1440"
			}
		}
	}
	if v, ok := updates["namespace_filter"]; ok {
		if msg := validateNamespaceFilter(fmt.Sprintf("%v", v)); msg != "" {
			return msg
		}
	}
	return ""
}
