package api

import "net/http"

func (h *Handler) getClusterInfo(w http.ResponseWriter, r *http.Request) {
	if h.k8s == nil {
		jsonError(w, "kubernetes client unavailable", http.StatusServiceUnavailable)
		return
	}
	info, err := h.k8s.ClusterInfo(r.Context())
	if err != nil {
		jsonInternalError(w, err, "get cluster info failed")
		return
	}
	jsonOK(w, info)
}
