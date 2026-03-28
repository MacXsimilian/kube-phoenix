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

// validateGuardrailFields validates guardrail update fields. Returns an error message or "".
func validateGuardrailFields(body map[string]interface{}) string {
	if v, ok := body["skipNodeLabels"]; ok {
		if msg := validateCSVEntries(fmt.Sprintf("%v", v), "=", 1,
			func(entry string) string { return fmt.Sprintf("invalid node label %q: must be key=value", entry) }); msg != "" {
			return msg
		}
	}
	if v, ok := body["skipNodeTaints"]; ok {
		for _, entry := range strings.Split(fmt.Sprintf("%v", v), ",") {
			entry = strings.TrimSpace(entry)
			if entry == "" {
				continue
			}
			parts := strings.SplitN(entry, ":", 2)
			if len(parts) != 2 || !strings.Contains(parts[0], "=") {
				return fmt.Sprintf("invalid node taint %q: must be key=value:effect", entry)
			}
		}
	}
	if v, ok := body["systemNamespaces"]; ok {
		if strings.TrimSpace(fmt.Sprintf("%v", v)) == "" {
			return "systemNamespaces cannot be empty"
		}
	}
	if v, ok := body["scalingPriorityNamespaces"]; ok {
		seen := map[string]bool{}
		for _, entry := range strings.Split(fmt.Sprintf("%v", v), ",") {
			entry = strings.TrimSpace(entry)
			if entry == "" {
				continue
			}
			if seen[entry] {
				return fmt.Sprintf("duplicate namespace %q in scalingPriorityNamespaces", entry)
			}
			seen[entry] = true
		}
	}
	if v, ok := body["scalingConcurrency"]; ok {
		n, ok := v.(float64)
		if !ok || n < 1 || n > 50 || n != float64(int(n)) {
			return "scalingConcurrency must be a whole number between 1 and 50"
		}
	}
	if v, ok := body["schedulerEvalInterval"]; ok {
		s := strings.TrimSpace(fmt.Sprintf("%v", v))
		d, err := time.ParseDuration(s)
		if err != nil || d <= 0 {
			return "schedulerEvalInterval must be a valid positive duration (e.g. 30s, 1m)"
		}
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
