package api

import (
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	corev1 "k8s.io/api/core/v1"
)

type WorkloadResponse struct {
	Namespace        string  `json:"namespace"`
	Name             string  `json:"name"`
	Kind             string  `json:"kind"`
	CurrentReplicas  int32   `json:"currentReplicas"`
	SavedReplicas    *int32  `json:"savedReplicas"`
	ReadyReplicas    int32   `json:"readyReplicas"`
	Status           string  `json:"status"`          // "running" | "sleeping" | "partial" | "unmanaged"
	GoverningPolicy  *string `json:"governingPolicy"` // policy name or nil
}

type NodeResponse struct {
	Name             string `json:"name"`
	InstanceType     string `json:"instanceType"`
	Zone             string `json:"zone"`
	PodCount         int    `json:"podCount"`
	Status           string `json:"status"` // "active" | "protected" | "would-drain"
	ProtectionReason string `json:"protectionReason"`
	CpuAllocatable   int64  `json:"cpuAllocatable"` // millicores
	CpuRequested     int64  `json:"cpuRequested"`   // millicores
	MemAllocatable   int64  `json:"memAllocatable"` // bytes
	MemRequested     int64  `json:"memRequested"`   // bytes
	CreatedAt        string `json:"createdAt"`      // RFC3339
	Cordoned         bool   `json:"cordoned"`
}

func (h *Handler) getWorkloads(w http.ResponseWriter, r *http.Request) {
	if h.k8s == nil {
		jsonError(w, "kubernetes client unavailable", http.StatusServiceUnavailable)
		return
	}
	ctx := r.Context()
	var result []WorkloadResponse

	// Load workload snapshots from DB (FR-95, §11.5)
	// This replaces annotation-based saved replicas for v2 workloads.
	snapMap, err := h.store.UnrestoredSnapshotMap()
	if err != nil {
		slog.Warn("getWorkloads: failed to load snapshots — saved replicas will be annotation-based", "err", err)
		snapMap = map[string]*store.WorkloadSnapshot{}
	}

	// Load governing policy names per workload key via DB JOIN
	policyNameMap, err := h.store.UnrestoredSnapshotPolicyNameMap()
	if err != nil {
		slog.Warn("getWorkloads: failed to load policy names", "err", err)
		policyNameMap = map[string]string{}
	}

	// Load all policies to determine which namespaces are managed
	policies, _ := h.store.ListSleepPolicies()

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

		key := d.Namespace + "/" + d.Name
		var saved *int32
		var governingPolicy *string

		// Prefer DB snapshot over annotation (v2 first, v1 fallback)
		if snap, ok := snapMap[key]; ok {
			n32 := int32(snap.ReplicasBefore)
			saved = &n32
		} else if v, ok := d.Annotations["previous-replicas"]; ok {
			if n, err := strconv.ParseInt(v, 10, 32); err == nil {
				n32 := int32(n)
				saved = &n32
			} else {
				slog.Warn("malformed previous-replicas annotation", "workload", key, "value", v)
			}
		}

		// Governing policy from DB JOIN snapshot map
		if name, ok := policyNameMap[key]; ok && name != "" {
			governingPolicy = &name
		}

		// Determine status — "unmanaged" if no policy governs this namespace (FR-99)
		status := workloadStatus(current, saved)
		if status == "running" && !isNamespaceManaged(d.Namespace, policies) {
			status = "unmanaged"
		}

		result = append(result, WorkloadResponse{
			Namespace:       d.Namespace,
			Name:            d.Name,
			Kind:            "Deployment",
			CurrentReplicas: current,
			SavedReplicas:   saved,
			ReadyReplicas:   d.Status.ReadyReplicas,
			Status:          status,
			GoverningPolicy: governingPolicy,
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

		key := ss.Namespace + "/" + ss.Name
		var saved *int32
		var governingPolicy *string

		if snap, ok := snapMap[key]; ok {
			n32 := int32(snap.ReplicasBefore)
			saved = &n32
		} else if v, ok := ss.Annotations["previous-replicas"]; ok {
			if n, err := strconv.ParseInt(v, 10, 32); err == nil {
				n32 := int32(n)
				saved = &n32
			} else {
				slog.Warn("malformed previous-replicas annotation", "workload", key, "value", v)
			}
		}

		if name, ok := policyNameMap[key]; ok && name != "" {
			governingPolicy = &name
		}

		status := workloadStatus(current, saved)
		if status == "running" && !isNamespaceManaged(ss.Namespace, policies) {
			status = "unmanaged"
		}

		result = append(result, WorkloadResponse{
			Namespace:       ss.Namespace,
			Name:            ss.Name,
			Kind:            "StatefulSet",
			CurrentReplicas: current,
			SavedReplicas:   saved,
			ReadyReplicas:   ss.Status.ReadyReplicas,
			Status:          status,
			GoverningPolicy: governingPolicy,
		})
	}

	if result == nil {
		result = []WorkloadResponse{}
	}
	jsonOK(w, result)
}

// isNamespaceManaged returns true if any enabled policy governs the given namespace.
func isNamespaceManaged(ns string, policies []store.SleepPolicy) bool {
	for _, p := range policies {
		if !p.Enabled {
			continue
		}
		if p.NamespaceFilter == "" {
			return true // all namespaces
		}
		for _, f := range strings.Split(p.NamespaceFilter, ",") {
			if strings.TrimSpace(f) == ns {
				return true
			}
		}
	}
	return false
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
		jsonError(w, "kubernetes client unavailable", http.StatusServiceUnavailable)
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
		slog.Error("get nodes: failed to list pods — pod counts will be zero", "err", err)
		allPods = []corev1.Pod{}
	}
	podCounts := map[string]int{}
	criticalNodes := map[string]bool{}
	cpuRequested := map[string]int64{}
	memRequested := map[string]int64{}
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
			for _, c := range pod.Spec.Containers {
				cpuRequested[pod.Spec.NodeName] += c.Resources.Requests.Cpu().MilliValue()
				memRequested[pod.Spec.NodeName] += c.Resources.Requests.Memory().Value()
			}
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
			CpuAllocatable:   node.Status.Allocatable.Cpu().MilliValue(),
			CpuRequested:     cpuRequested[node.Name],
			MemAllocatable:   node.Status.Allocatable.Memory().Value(),
			MemRequested:     memRequested[node.Name],
			CreatedAt:        node.CreationTimestamp.UTC().Format(time.RFC3339),
			Cordoned:         node.Spec.Unschedulable,
		})
	}

	if result == nil {
		result = []NodeResponse{}
	}
	jsonOK(w, result)
}

type NodePodResponse struct {
	Name            string `json:"name"`
	Namespace       string `json:"namespace"`
	OwnerKind       string `json:"ownerKind"`
	OwnerName       string `json:"ownerName"`
	Status          string `json:"status"` // Running | Pending | Failed | Succeeded | Unknown
	ReadyContainers int    `json:"readyContainers"`
	TotalContainers int    `json:"totalContainers"`
	CPURequest      int64  `json:"cpuRequest"` // millicores
	MemRequest      int64  `json:"memRequest"` // bytes
	StartedAt       string `json:"startedAt"`  // RFC3339 or ""
}

func (h *Handler) getNodePods(w http.ResponseWriter, r *http.Request) {
	if h.k8s == nil {
		jsonError(w, "kubernetes client unavailable", http.StatusServiceUnavailable)
		return
	}
	nodeName := chi.URLParam(r, "name")
	ctx := r.Context()

	pods, err := h.k8s.ListPodsOnNode(ctx, nodeName)
	if err != nil {
		jsonError(w, "failed to list pods: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Build ReplicaSet -> top-level owner map to resolve Deployment names
	rss, err := h.k8s.ListAllReplicaSets(ctx)
	if err != nil {
		slog.Warn("getNodePods: failed to list replicasets — owners will show as ReplicaSet", "err", err)
	}
	type ownerRef struct{ kind, name string }
	rsOwner := map[string]ownerRef{}
	for _, rs := range rss {
		for _, ref := range rs.OwnerReferences {
			rsOwner[rs.Namespace+"/"+rs.Name] = ownerRef{ref.Kind, ref.Name}
			break
		}
	}

	var result []NodePodResponse
	for _, pod := range pods {
		ownerKind, ownerName := "", ""
		isDaemon := false
		for _, ref := range pod.OwnerReferences {
			if ref.Kind == "DaemonSet" {
				isDaemon = true
				break
			}
			ownerKind = ref.Kind
			ownerName = ref.Name
		}
		if isDaemon {
			continue
		}

		// Resolve ReplicaSet -> Deployment (or other top-level owner)
		if ownerKind == "ReplicaSet" {
			if top, ok := rsOwner[pod.Namespace+"/"+ownerName]; ok {
				ownerKind = top.kind
				ownerName = top.name
			}
		}

		ready := 0
		for _, cs := range pod.Status.ContainerStatuses {
			if cs.Ready {
				ready++
			}
		}

		var cpuReq, memReq int64
		for _, c := range pod.Spec.Containers {
			cpuReq += c.Resources.Requests.Cpu().MilliValue()
			memReq += c.Resources.Requests.Memory().Value()
		}

		startedAt := ""
		if pod.Status.StartTime != nil {
			startedAt = pod.Status.StartTime.UTC().Format(time.RFC3339)
		}

		phase := string(pod.Status.Phase)
		if phase == "" {
			phase = "Unknown"
		}

		result = append(result, NodePodResponse{
			Name:            pod.Name,
			Namespace:       pod.Namespace,
			OwnerKind:       ownerKind,
			OwnerName:       ownerName,
			Status:          phase,
			ReadyContainers: ready,
			TotalContainers: len(pod.Spec.Containers),
			CPURequest:      cpuReq,
			MemRequest:      memReq,
			StartedAt:       startedAt,
		})
	}

	if result == nil {
		result = []NodePodResponse{}
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
