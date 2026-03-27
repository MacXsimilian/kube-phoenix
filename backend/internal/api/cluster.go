package api

import (
	"net/http"
	"sync"

	appsv1 "k8s.io/api/apps/v1"
)

type WorkloadResponse struct {
	Namespace       string `json:"namespace"`
	Name            string `json:"name"`
	Kind            string `json:"kind"`
	CurrentReplicas int32  `json:"currentReplicas"`
	SavedReplicas   *int32 `json:"savedReplicas"`
	ReadyReplicas   int32  `json:"readyReplicas"`
	Status          string `json:"status"` // "running" | "sleeping" | "partial"
}

// ── Workloads endpoint ────────────────────────────────────────────────────────

func (h *Handler) getWorkloads(w http.ResponseWriter, r *http.Request) {
	if h.k8s == nil {
		jsonError(w, "kubernetes client unavailable", http.StatusServiceUnavailable)
		return
	}

	// Cache-first: serve from in-memory snapshot when ready
	if h.cache != nil {
		if snap := h.cache.Snapshot(); snap.Ready() {
			jsonOK(w, buildWorkloadResponse(snap.Deployments, snap.StatefulSets))
			return
		}
	}

	// Fallback: fetch deployments and statefulsets in parallel
	ctx := r.Context()
	var (
		deployments  []appsv1.Deployment
		statefulsets []appsv1.StatefulSet
		dErr, ssErr  error
		wg           sync.WaitGroup
	)
	wg.Add(2)
	go func() { defer wg.Done(); deployments, dErr = h.k8s.ListDeployments(ctx, "") }()
	go func() { defer wg.Done(); statefulsets, ssErr = h.k8s.ListStatefulSets(ctx, "") }()
	wg.Wait()

	if dErr != nil {
		jsonInternalError(w, dErr, "list deployments failed")
		return
	}
	if ssErr != nil {
		jsonInternalError(w, ssErr, "list statefulsets failed")
		return
	}

	jsonOK(w, buildWorkloadResponse(deployments, statefulsets))
}

// workloadMeta holds the kind-agnostic fields needed to build a WorkloadResponse.
type workloadMeta struct {
	Namespace    string
	Name         string
	Kind         string
	Replicas     *int32
	Annotations  map[string]string
	ReadyReplicas int32
}

// toWorkloadResponse converts a workloadMeta into a WorkloadResponse.
func toWorkloadResponse(m workloadMeta) WorkloadResponse {
	current := int32(0)
	if m.Replicas != nil {
		current = *m.Replicas
	}
	saved := parseSavedReplicas(m.Annotations)
	return WorkloadResponse{
		Namespace:       m.Namespace,
		Name:            m.Name,
		Kind:            m.Kind,
		CurrentReplicas: current,
		SavedReplicas:   saved,
		ReadyReplicas:   m.ReadyReplicas,
		Status:          workloadStatus(current, saved),
	}
}

func buildWorkloadResponse(deployments []appsv1.Deployment, statefulsets []appsv1.StatefulSet) []WorkloadResponse {
	result := make([]WorkloadResponse, 0, len(deployments)+len(statefulsets))

	for _, d := range deployments {
		result = append(result, toWorkloadResponse(workloadMeta{
			Namespace: d.Namespace, Name: d.Name, Kind: "Deployment",
			Replicas: d.Spec.Replicas, Annotations: d.Annotations,
			ReadyReplicas: d.Status.ReadyReplicas,
		}))
	}
	for _, ss := range statefulsets {
		result = append(result, toWorkloadResponse(workloadMeta{
			Namespace: ss.Namespace, Name: ss.Name, Kind: "StatefulSet",
			Replicas: ss.Spec.Replicas, Annotations: ss.Annotations,
			ReadyReplicas: ss.Status.ReadyReplicas,
		}))
	}

	if len(result) == 0 {
		return []WorkloadResponse{}
	}
	return result
}

func workloadStatus(current int32, saved *int32) string {
	if saved != nil && current == 0 {
		return "sleeping"
	}
	if saved != nil && current > 0 && current < *saved {
		return "partial"
	}
	return "running"
}
