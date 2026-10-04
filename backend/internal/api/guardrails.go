// SPDX-License-Identifier: Apache-2.0

package api

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/nodeutil"
	"github.com/macxsimilian/kube-phoenix/backend/internal/scheduler"
	"github.com/macxsimilian/kube-phoenix/backend/internal/stringutil"
)

func (h *Handler) getGuardrails(w http.ResponseWriter, r *http.Request) {
	guardrails, err := h.store.GetGuardrails()
	if err != nil {
		jsonInternalError(w, err, "get guardrails failed")
		return
	}
	jsonOK(w, guardrails)
}

func (h *Handler) updateGuardrails(w http.ResponseWriter, r *http.Request) {
	old, err := h.store.GetGuardrails()
	if err != nil {
		slog.Warn("could not fetch current guardrails for audit", "err", err)
	}

	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, ErrInvalidBody, http.StatusBadRequest)
		return
	}

	// Map camelCase JSON keys to snake_case GORM column names.
	fieldMap := map[string]string{
		"protectedNamespaces":          "protected_namespaces",
		"skipNsNode":                   "skip_ns_node",
		"skipNodeLabels":               "skip_node_labels",
		"skipNodeTaints":               "skip_node_taints",
		"schedulerEvalInterval":        "scheduler_eval_interval",
		"schedulerAutoWake":            "scheduler_auto_wake",
		"schedulerReconcileWhileAwake": "scheduler_reconcile_while_awake",
		"schedulerEnforceSleep":        "scheduler_enforce_sleep",
		"scalingPriorityNamespaces":    "scaling_priority_namespaces",
		"scalingConcurrency":           "scaling_concurrency",
		"wakeWaveSize":                 "wake_wave_size",
		"wakeWavePauseSeconds":         "wake_wave_pause_seconds",
		"protectCriticalPodNodes":      "protect_critical_pod_nodes",
	}
	updates := map[string]interface{}{}
	for jsonKey, dbCol := range fieldMap {
		if v, ok := body[jsonKey]; ok {
			updates[dbCol] = v
		}
	}

	if msg := validateGuardrailFields(body); msg != "" {
		jsonError(w, msg, http.StatusBadRequest)
		return
	}

	guardrails, err := h.store.UpdateGuardrails(updates)
	if err != nil {
		jsonInternalError(w, err, "update guardrails failed")
		return
	}
	slog.Info("guardrails updated")
	h.audit(r, "guardrail.update", "guardrail", nil, old, guardrails)

	if h.policyScheduler != nil {
		if err := h.policyScheduler.UpdateSettings(scheduler.SchedulerConfig{
			TickInterval:        guardrails.ParseSchedulerEvalInterval(),
			AutoWake:            guardrails.SchedulerAutoWake,
			ReconcileWhileAwake: guardrails.SchedulerReconcileWhileAwake,
			EnforceSleep:        guardrails.SchedulerEnforceSleep,
		}); err != nil {
			slog.Error("scheduler settings update failed", "err", err)
		}
	}

	jsonOK(w, guardrails)
}

// guardrailStringCheck defines a validation rule for a string-typed guardrail field.
type guardrailStringCheck struct {
	key      string
	validate func(string) string
}

// guardrailStringChecks lists all string-typed guardrail fields and their validators.
var guardrailStringChecks = []guardrailStringCheck{
	{"skipNodeLabels", validateSkipNodeLabels},
	{"skipNodeTaints", validateSkipNodeTaints},
	{"protectedNamespaces", validateProtectedNamespaces},
	{"skipNsNode", validateSkipNsNode},
	{"scalingPriorityNamespaces", validateScalingPriorityNamespaces},
	{"schedulerEvalInterval", validateSchedulerEvalInterval},
}

var guardrailIntChecks = []struct {
	key string
	min float64
	max float64
}{
	{"scalingConcurrency", 1, 50},
	{"wakeWaveSize", 0, 200},
	{"wakeWavePauseSeconds", 10, 600},
}

// validateGuardrailFields validates guardrail update fields. Returns an error message or "".
func validateGuardrailFields(body map[string]interface{}) string {
	for _, check := range guardrailStringChecks {
		v, ok := body[check.key]
		if !ok {
			continue
		}
		s, ok := v.(string)
		if !ok {
			return check.key + " must be a string"
		}
		if msg := check.validate(s); msg != "" {
			return msg
		}
	}
	for _, check := range guardrailIntChecks {
		if msg := validateBoundedWholeNumber(body, check.key, check.min, check.max); msg != "" {
			return msg
		}
	}
	return ""
}

// validateBoundedWholeNumber returns an error message when body[key] is present
// but not a whole number in [min, max], or "" when missing or valid.
func validateBoundedWholeNumber(body map[string]interface{}, key string, min, max float64) string {
	v, ok := body[key]
	if !ok {
		return ""
	}
	n, ok := v.(float64)
	if !ok || n < min || n > max || n != float64(int(n)) {
		return fmt.Sprintf("%s must be a whole number between %d and %d", key, int(min), int(max))
	}
	return ""
}

func validateSkipNodeLabels(s string) string {
	if err := nodeutil.ValidateLabels(s); err != nil {
		return err.Error()
	}
	return ""
}

func validateSkipNodeTaints(s string) string {
	if err := nodeutil.ValidateTaints(s); err != nil {
		return err.Error()
	}
	return ""
}

func validateProtectedNamespaces(s string) string {
	if len(stringutil.SplitCSV(s)) == 0 {
		return "protectedNamespaces cannot be empty"
	}
	return validateGuardrailNamespaces(s, "protectedNamespaces")
}

func validateSkipNsNode(s string) string {
	return validateGuardrailNamespaces(s, "skipNsNode")
}

func validateGuardrailNamespaces(s, field string) string {
	if msg := validateNamespaceFilter(s); msg != "" {
		return field + ": " + msg
	}
	return ""
}

func validateScalingPriorityNamespaces(s string) string {
	if msg := validateGuardrailNamespaces(s, "scalingPriorityNamespaces"); msg != "" {
		return msg
	}
	seen := map[string]bool{}
	for _, entry := range stringutil.SplitCSV(s) {
		if seen[entry] {
			return fmt.Sprintf("duplicate namespace %q in scalingPriorityNamespaces", entry)
		}
		seen[entry] = true
	}
	return ""
}

func validateSchedulerEvalInterval(s string) string {
	d, err := time.ParseDuration(strings.TrimSpace(s))
	if err != nil || d <= 0 {
		return "schedulerEvalInterval must be a valid positive duration (e.g. 30s, 1m)"
	}
	if d < 10*time.Second {
		return "schedulerEvalInterval must be at least 10s"
	}
	if d > 15*time.Minute {
		return "schedulerEvalInterval must not exceed 15m"
	}
	return ""
}
