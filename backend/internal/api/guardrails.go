package api

import (
	"encoding/json"
	"net/http"
)

func (h *Handler) getGuardrails(w http.ResponseWriter, r *http.Request) {
	g, err := h.store.GetGuardrails()
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
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
	for _, f := range []string{"skip_namespaces", "skip_ns_node", "skip_node_labels", "skip_node_taints"} {
		if v, ok := body[f]; ok {
			updates[f] = v
		}
	}

	g, err := h.store.UpdateGuardrails(updates)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, g)
}
