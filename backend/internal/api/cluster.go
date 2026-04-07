// SPDX-License-Identifier: Apache-2.0

package api

import (
	"log/slog"
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

	saved := h.savedReplicasMap()

	// Cache-first: serve from in-memory snapshot when ready
	if h.cache != nil {
		if snap := h.cache.Snapshot(); snap.Ready() {
			jsonOK(w, buildWorkloadResponse(snap.Deployments, snap.StatefulSets, saved))
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

	jsonOK(w, buildWorkloadResponse(deployments, statefulsets, saved))
}

// savedReplicasMap returns a map of workloadKey ("Kind/Namespace/Name") → saved
// replica count, derived from open WorkloadSnapshot rows. This is the source of
// truth for "is this workload sleeping?" classification.
func (h *Handler) savedReplicasMap() map[string]int32 {
	if h.store == nil {
		return nil
	}
	snaps, err := h.store.GetAllOpenSnapshots()
	if err != nil {
		slog.Warn("savedReplicasMap: failed to list open snapshots", "err", err)
		return nil
	}
	out := make(map[string]int32, len(snaps))
	for _, s := range snaps {
		out[s.Kind+"/"+s.Namespace+"/"+s.Name] = s.ReplicasBefore
	}
	return out
}

// workloadMeta holds the kind-agnostic fields needed to build a WorkloadResponse.
type workloadMeta struct {
	Namespace     string
	Name          string
	Kind          string
	Replicas      *int32
	ReadyReplicas int32
}

// toWorkloadResponse converts a workloadMeta into a WorkloadResponse.
func toWorkloadResponse(m workloadMeta, saved map[string]int32) WorkloadResponse {
	current := int32(0)
	if m.Replicas != nil {
		current = *m.Replicas
	}
	savedPtr := lookupSaved(saved, m.Kind, m.Namespace, m.Name)
	return WorkloadResponse{
		Namespace:       m.Namespace,
		Name:            m.Name,
		Kind:            m.Kind,
		CurrentReplicas: current,
		SavedReplicas:   savedPtr,
		ReadyReplicas:   m.ReadyReplicas,
		Status:          workloadStatus(current, savedPtr),
	}
}

func lookupSaved(saved map[string]int32, kind, namespace, name string) *int32 {
	if saved == nil {
		return nil
	}
	v, ok := saved[kind+"/"+namespace+"/"+name]
	if !ok {
		return nil
	}
	return &v
}

func buildWorkloadResponse(deployments []appsv1.Deployment, statefulsets []appsv1.StatefulSet, saved map[string]int32) []WorkloadResponse {
	result := make([]WorkloadResponse, 0, len(deployments)+len(statefulsets))

	for _, d := range deployments {
		result = append(result, toWorkloadResponse(workloadMeta{
			Namespace: d.Namespace, Name: d.Name, Kind: "Deployment",
			Replicas:      d.Spec.Replicas,
			ReadyReplicas: d.Status.ReadyReplicas,
		}, saved))
	}
	for _, ss := range statefulsets {
		result = append(result, toWorkloadResponse(workloadMeta{
			Namespace: ss.Namespace, Name: ss.Name, Kind: "StatefulSet",
			Replicas:      ss.Spec.Replicas,
			ReadyReplicas: ss.Status.ReadyReplicas,
		}, saved))
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
