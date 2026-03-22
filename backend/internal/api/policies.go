package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	"github.com/robfig/cron/v3"
	"gorm.io/gorm"
)

// policyResponse wraps Policy with computed next-run times.
type policyResponse struct {
	store.Policy
	NextSleepAt *time.Time `json:"nextSleepAt,omitempty"`
	NextWakeAt  *time.Time `json:"nextWakeAt,omitempty"`
}

func (h *Handler) policyResp(p store.Policy) policyResponse {
	ns, nw := h.policyScheduler.NextRuns(p.ID)
	return policyResponse{Policy: p, NextSleepAt: ns, NextWakeAt: nw}
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

func (h *Handler) createPolicy(w http.ResponseWriter, r *http.Request) {
	var p store.Policy
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		jsonError(w, "invalid body", http.StatusBadRequest)
		return
	}
	if p.Name == "" {
		jsonError(w, "name is required", http.StatusBadRequest)
		return
	}
	if p.SleepCron == "" && p.WakeCron == "" {
		jsonError(w, "at least one of sleepCron or wakeCron is required", http.StatusBadRequest)
		return
	}
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

	// Conflict check for apply-mode policies
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

	fieldMap := map[string]string{
		"name":            "name",
		"description":     "description",
		"namespaceFilter": "namespace_filter",
		"labelSelector":   "label_selector",
		"sleepCron":       "sleep_cron",
		"wakeCron":        "wake_cron",
		"timezone":        "timezone",
		"mode":            "mode",
		"enabled":         "enabled",
		"timeoutMinutes":  "timeout_minutes",
	}
	updates := map[string]interface{}{}
	for jsonKey, dbCol := range fieldMap {
		if v, ok := body[jsonKey]; ok {
			updates[dbCol] = v
		}
	}

	if msg := validatePolicyUpdates(updates); msg != "" {
		jsonError(w, msg, http.StatusBadRequest)
		return
	}

	p, err := h.store.UpdatePolicy(id, updates)
	if err != nil {
		jsonInternalError(w, err, "update policy failed")
		return
	}

	// Conflict check after update if mode is apply
	if p.Mode == "apply" && p.Enabled {
		overlap, checkErr := h.store.HasApplyPolicyOverlap(id, p.NamespaceFilter, p.LabelSelector)
		if checkErr != nil {
			slog.Warn("policy conflict check failed after update", "err", checkErr)
		} else if overlap {
			jsonError(w, "an existing apply-mode policy may overlap with these targets; resolve the conflict before saving", http.StatusConflict)
			return
		}
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
	parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	if p.SleepCron != "" {
		if _, err := parser.Parse(p.SleepCron); err != nil {
			return "invalid sleepCron expression"
		}
	}
	if p.WakeCron != "" {
		if _, err := parser.Parse(p.WakeCron); err != nil {
			return "invalid wakeCron expression"
		}
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
	parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	if v, ok := updates["sleep_cron"]; ok && fmt.Sprintf("%v", v) != "" {
		if _, err := parser.Parse(fmt.Sprintf("%v", v)); err != nil {
			return "invalid sleepCron expression"
		}
	}
	if v, ok := updates["wake_cron"]; ok && fmt.Sprintf("%v", v) != "" {
		if _, err := parser.Parse(fmt.Sprintf("%v", v)); err != nil {
			return "invalid wakeCron expression"
		}
	}
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
