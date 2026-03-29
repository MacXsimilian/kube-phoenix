package api

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/scheduler"
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
		"systemNamespaces":             "system_namespaces",
		"skipNsNode":                   "skip_ns_node",
		"skipNodeLabels":               "skip_node_labels",
		"skipNodeTaints":               "skip_node_taints",
		"schedulerEvalInterval":        "scheduler_eval_interval",
		"schedulerAutoWake":            "scheduler_auto_wake",
		"schedulerReconcileWhileAwake": "scheduler_reconcile_while_awake",
		"scalingPriorityNamespaces":    "scaling_priority_namespaces",
		"scalingConcurrency":           "scaling_concurrency",
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
	{"systemNamespaces", validateSystemNamespaces},
	{"scalingPriorityNamespaces", validateScalingPriorityNamespaces},
	{"schedulerEvalInterval", validateSchedulerEvalInterval},
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
	if v, ok := body["scalingConcurrency"]; ok {
		n, ok := v.(float64)
		if !ok || n < 1 || n > 50 || n != float64(int(n)) {
			return "scalingConcurrency must be a whole number between 1 and 50"
		}
	}
	return ""
}

func validateSkipNodeLabels(s string) string {
	return validateCSVEntries(s, "=", 1,
		func(entry string) string { return fmt.Sprintf("invalid node label %q: must be key=value", entry) })
}

func validateSkipNodeTaints(s string) string {
	for _, entry := range strings.Split(s, ",") {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}
		parts := strings.SplitN(entry, ":", 2)
		if len(parts) != 2 || !strings.Contains(parts[0], "=") {
			return fmt.Sprintf("invalid node taint %q: must be key=value:effect", entry)
		}
	}
	return ""
}

func validateSystemNamespaces(s string) string {
	if strings.TrimSpace(s) == "" {
		return "systemNamespaces cannot be empty"
	}
	return ""
}

func validateScalingPriorityNamespaces(s string) string {
	seen := map[string]bool{}
	for _, entry := range strings.Split(s, ",") {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}
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

// validateCSVEntries checks that each comma-separated entry contains exactly
// expectedCount occurrences of sep. Returns an error message via msgFn or "".
func validateCSVEntries(csv, sep string, expectedCount int, msgFn func(string) string) string {
	for _, entry := range strings.Split(csv, ",") {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}
		if strings.Count(entry, sep) != expectedCount {
			return msgFn(entry)
		}
	}
	return ""
}
