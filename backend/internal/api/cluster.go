package api

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	corev1 "k8s.io/api/core/v1"
)

type WorkloadResponse struct {
	Namespace       string  `json:"namespace"`
	Name            string  `json:"name"`
	Kind            string  `json:"kind"`
	CurrentReplicas int32   `json:"currentReplicas"`
	SavedReplicas   *int32  `json:"savedReplicas"`
	Status          string  `json:"status"` // "running" | "sleeping" | "partial"
}

type NodeResponse struct {
	Name             string `json:"name"`
	InstanceType     string `json:"instanceType"`
	Zone             string `json:"zone"`
	PodCount         int    `json:"podCount"`
	Status           string `json:"status"` // "active" | "protected" | "would-drain"
	ProtectionReason string `json:"protectionReason"`
}

func (h *Handler) getWorkloads(w http.ResponseWriter, r *http.Request) {
	if h.k8s == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]string{"error": "kubernetes client unavailable"})
		return
	}
	ctx := r.Context()
	var result []WorkloadResponse

	// Deployments
	deployments, err := h.k8s.ListDeployments(ctx, "")
	if err != nil {
		jsonError(w, "failed to list deployments: "+err.Error(), http.StatusInternalServerError)
		return
	}
	for _, d := range deployments {
		current := int32(0)
		if d.Spec.Replicas != nil {
			current = *d.Spec.Replicas
		}
		var saved *int32
		if v, ok := d.Annotations["previous-replicas"]; ok {
			if n, err := strconv.ParseInt(v, 10, 32); err == nil {
				n32 := int32(n)
				saved = &n32
			} else {
				slog.Warn("malformed previous-replicas annotation", "workload", d.Namespace+"/"+d.Name, "value", v)
			}
		}
		result = append(result, WorkloadResponse{
			Namespace:       d.Namespace,
			Name:            d.Name,
			Kind:            "Deployment",
			CurrentReplicas: current,
			SavedReplicas:   saved,
			Status:          workloadStatus(current, saved),
		})
	}

	// StatefulSets
	statefulsets, err := h.k8s.ListStatefulSets(ctx, "")
	if err != nil {
		jsonError(w, "failed to list statefulsets: "+err.Error(), http.StatusInternalServerError)
		return
	}
	for _, ss := range statefulsets {
		current := int32(0)
		if ss.Spec.Replicas != nil {
			current = *ss.Spec.Replicas
		}
		var saved *int32
		if v, ok := ss.Annotations["previous-replicas"]; ok {
			if n, err := strconv.ParseInt(v, 10, 32); err == nil {
				n32 := int32(n)
				saved = &n32
			} else {
				slog.Warn("malformed previous-replicas annotation", "workload", ss.Namespace+"/"+ss.Name, "value", v)
			}
		}
		result = append(result, WorkloadResponse{
			Namespace:       ss.Namespace,
			Name:            ss.Name,
			Kind:            "StatefulSet",
			CurrentReplicas: current,
			SavedReplicas:   saved,
			Status:          workloadStatus(current, saved),
		})
	}

	if result == nil {
		result = []WorkloadResponse{}
	}
	jsonOK(w, result)
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

func (h *Handler) getNodes(w http.ResponseWriter, r *http.Request) {
	if h.k8s == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]string{"error": "kubernetes client unavailable"})
		return
	}
	ctx := r.Context()

	g, err := h.store.GetGuardrails()
	if err != nil {
		jsonError(w, "guardrails: "+err.Error(), http.StatusInternalServerError)
		return
	}

	nodes, err := h.k8s.ListNodes(ctx)
	if err != nil {
		jsonError(w, "failed to list nodes: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Pod counts per node (excluding daemonsets)
	allPods, err := h.k8s.ListAllPods(ctx)
	if err != nil {
		allPods = []corev1.Pod{}
	}
	podCounts := map[string]int{}
	criticalNodes := map[string]bool{}
	skipNsNode := splitCSVLocal(g.SkipNsNode)

	for _, pod := range allPods {
		isDaemon := false
		for _, ref := range pod.OwnerReferences {
			if ref.Kind == "DaemonSet" {
				isDaemon = true
				break
			}
		}
		if !isDaemon {
			podCounts[pod.Spec.NodeName]++
		}
		if skipNsNode[pod.Namespace] {
			criticalNodes[pod.Spec.NodeName] = true
		}
	}

	var result []NodeResponse
	for _, node := range nodes {
		instanceType := node.Labels["node.kubernetes.io/instance-type"]
		if instanceType == "" {
			instanceType = node.Labels["beta.kubernetes.io/instance-type"]
		}
		zone := node.Labels["topology.kubernetes.io/zone"]
		if zone == "" {
			zone = node.Labels["failure-domain.beta.kubernetes.io/zone"]
		}

		status, reason := nodeProtectionStatus(node.Name, node.Labels, node.Spec.Taints, g.SkipNodeLabels, g.SkipNodeTaints, criticalNodes)

		result = append(result, NodeResponse{
			Name:             node.Name,
			InstanceType:     instanceType,
			Zone:             zone,
			PodCount:         podCounts[node.Name],
			Status:           status,
			ProtectionReason: reason,
		})
	}

	if result == nil {
		result = []NodeResponse{}
	}
	jsonOK(w, result)
}

func nodeProtectionStatus(nodeName string, labels map[string]string, taints []corev1.Taint, skipLabels, skipTaints string, criticalNodes map[string]bool) (string, string) {
	for _, kv := range strings.Split(skipLabels, ",") {
		kv = strings.TrimSpace(kv)
		parts := strings.SplitN(kv, "=", 2)
		if len(parts) != 2 {
			continue
		}
		if v, ok := labels[parts[0]]; ok && v == parts[1] {
			return "protected", "label: " + kv
		}
	}
	for _, kv := range strings.Split(skipTaints, ",") {
		kv = strings.TrimSpace(kv)
		for _, t := range taints {
			if fmt.Sprintf("%s=%s:%s", t.Key, t.Value, t.Effect) == kv {
				return "protected", "taint: " + kv
			}
		}
	}
	if criticalNodes[nodeName] {
		return "protected", "running critical workload"
	}
	return "would-drain", ""
}
