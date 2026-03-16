package api

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
)

func (h *Handler) getGuardrails(w http.ResponseWriter, r *http.Request) {
	g, err := h.store.GetGuardrails()
	if err != nil {
		jsonInternalError(w, err, "get guardrails failed")
		return
	}
	jsonOK(w, g)
}

func (h *Handler) updateGuardrails(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "invalid body", http.StatusBadRequest)
		return
	}

	updates := map[string]interface{}{}
	for _, f := range []string{"system_namespaces", "skip_namespaces", "skip_ns_node", "skip_node_labels", "skip_node_taints"} {
		if v, ok := body[f]; ok {
			updates[f] = v
		}
	}

	if msg := validateGuardrailFields(body); msg != "" {
		jsonError(w, msg, http.StatusBadRequest)
		return
	}

	g, err := h.store.UpdateGuardrails(updates)
	if err != nil {
		jsonInternalError(w, err, "update guardrails failed")
		return
	}
	slog.Info("guardrails updated")
	jsonOK(w, g)
}

// validateGuardrailFields validates guardrail update fields. Returns an error message or "".
func validateGuardrailFields(body map[string]interface{}) string {
	if v, ok := body["skip_node_labels"]; ok {
		if msg := validateCSVEntries(fmt.Sprintf("%v", v), "=", 1,
			func(entry string) string { return fmt.Sprintf("invalid node label %q: must be key=value", entry) }); msg != "" {
			return msg
		}
	}
	if v, ok := body["skip_node_taints"]; ok {
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
	if v, ok := body["system_namespaces"]; ok {
		if strings.TrimSpace(fmt.Sprintf("%v", v)) == "" {
			return "system_namespaces cannot be empty"
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
