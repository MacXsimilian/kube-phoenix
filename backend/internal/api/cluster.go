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

	savedReplicas := h.savedReplicasMap()

	// Cache-first: serve from in-memory snapshot when ready
	if h.cache != nil {
		if snapshot := h.cache.Snapshot(); snapshot.Ready() {
			jsonOK(w, buildWorkloadResponse(snapshot.Deployments, snapshot.StatefulSets, savedReplicas))
			return
		}
	}

	// Fallback: fetch deployments and statefulsets in parallel
	ctx := r.Context()
	var (
		deployments     []appsv1.Deployment
		statefulSets    []appsv1.StatefulSet
		deploymentsErr  error
		statefulSetsErr error
		wg              sync.WaitGroup
	)
	wg.Add(2)
	go func() {
		defer wg.Done()
		deployments, deploymentsErr = h.k8s.ListDeployments(ctx, "")
	}()
	go func() {
		defer wg.Done()
		statefulSets, statefulSetsErr = h.k8s.ListStatefulSets(ctx, "")
	}()
	wg.Wait()

	if deploymentsErr != nil {
		jsonInternalError(w, deploymentsErr, "list deployments failed")
		return
	}
	if statefulSetsErr != nil {
		jsonInternalError(w, statefulSetsErr, "list statefulsets failed")
		return
	}

	jsonOK(w, buildWorkloadResponse(deployments, statefulSets, savedReplicas))
}

// savedReplicasMap returns a map of workloadKey ("Kind/Namespace/Name") → saved
// replica count, derived from open WorkloadSnapshot rows. This is the source of
// truth for "is this workload sleeping?" classification.
func (h *Handler) savedReplicasMap() map[string]int32 {
	if h.store == nil {
		return nil
	}
	snapshots, err := h.store.GetAllOpenSnapshots()
	if err != nil {
		slog.Warn("savedReplicasMap: failed to list open snapshots", "err", err)
		return nil
	}
	savedReplicas := make(map[string]int32, len(snapshots))
	for _, snapshot := range snapshots {
		savedReplicas[snapshot.Kind+"/"+snapshot.Namespace+"/"+snapshot.Name] = snapshot.ReplicasBefore
	}
	return savedReplicas
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
func toWorkloadResponse(workload workloadMeta, saved map[string]int32) WorkloadResponse {
	currentReplicas := int32(0)
	if workload.Replicas != nil {
		currentReplicas = *workload.Replicas
	}
	savedReplicas := lookupSaved(saved, workload.Kind, workload.Namespace, workload.Name)
	return WorkloadResponse{
		Namespace:       workload.Namespace,
		Name:            workload.Name,
		Kind:            workload.Kind,
		CurrentReplicas: currentReplicas,
		SavedReplicas:   savedReplicas,
		ReadyReplicas:   workload.ReadyReplicas,
		Status:          workloadStatus(currentReplicas, savedReplicas),
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

func buildWorkloadResponse(deployments []appsv1.Deployment, statefulSets []appsv1.StatefulSet, saved map[string]int32) []WorkloadResponse {
	result := make([]WorkloadResponse, 0, len(deployments)+len(statefulSets))

	for _, deployment := range deployments {
		result = append(result, toWorkloadResponse(workloadMeta{
			Namespace:     deployment.Namespace,
			Name:          deployment.Name,
			Kind:          "Deployment",
			Replicas:      deployment.Spec.Replicas,
			ReadyReplicas: deployment.Status.ReadyReplicas,
		}, saved))
	}
	for _, statefulSet := range statefulSets {
		result = append(result, toWorkloadResponse(workloadMeta{
			Namespace:     statefulSet.Namespace,
			Name:          statefulSet.Name,
			Kind:          "StatefulSet",
			Replicas:      statefulSet.Spec.Replicas,
			ReadyReplicas: statefulSet.Status.ReadyReplicas,
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
