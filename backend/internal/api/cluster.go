package api

import (
	"fmt"
	"log/slog"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
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

// validK8sName reports whether s is a valid Kubernetes resource name.
var validK8sName = regexp.MustCompile(`^[a-z0-9][a-z0-9\-\.]{0,252}[a-z0-9]$|^[a-z0-9]$`)

func isValidK8sName(s string) bool {
	return validK8sName.MatchString(s)
}

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

func buildWorkloadResponse(deployments []appsv1.Deployment, statefulsets []appsv1.StatefulSet) []WorkloadResponse {
	var result []WorkloadResponse

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
			ReadyReplicas:   d.Status.ReadyReplicas,
			Status:          workloadStatus(current, saved),
		})
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
			ReadyReplicas:   ss.Status.ReadyReplicas,
			Status:          workloadStatus(current, saved),
		})
	}

	if result == nil {
		result = []WorkloadResponse{}
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

func (h *Handler) getNodes(w http.ResponseWriter, r *http.Request) {
	if h.k8s == nil {
		jsonError(w, "kubernetes client unavailable", http.StatusServiceUnavailable)
		return
	}

	g, err := h.store.GetGuardrails()
	if err != nil {
		jsonInternalError(w, err, "get guardrails failed")
		return
	}

	var nodes []corev1.Node
	var allPods []corev1.Pod

	// Cache-first: serve from in-memory snapshot when ready
	if h.cache != nil {
		if snap := h.cache.Snapshot(); snap.Ready() {
			nodes = snap.Nodes
			allPods = snap.Pods
		}
	}

	if nodes == nil {
		// Fallback: fetch nodes and pods in parallel (previously serial)
		ctx := r.Context()
		var nErr, pErr error
		var wg sync.WaitGroup
		wg.Add(2)
		go func() { defer wg.Done(); nodes, nErr = h.k8s.ListNodes(ctx) }()
		go func() { defer wg.Done(); allPods, pErr = h.k8s.ListAllPods(ctx) }()
		wg.Wait()

		if nErr != nil {
			jsonInternalError(w, nErr, "list nodes failed")
			return
		}
		if pErr != nil {
			slog.Error("get nodes: failed to list pods — pod counts will be zero", "err", pErr)
			allPods = []corev1.Pod{}
		}
	}

	jsonOK(w, buildNodeResponse(nodes, allPods, g))
}

func buildNodeResponse(nodes []corev1.Node, allPods []corev1.Pod, g *store.Guardrails) []NodeResponse {
	// Pod counts per node (excluding daemonsets)
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
	return result
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
	if !isValidK8sName(nodeName) {
		jsonError(w, "invalid resource name", http.StatusBadRequest)
		return
	}
	ctx := r.Context()

	pods, err := h.k8s.ListPodsOnNode(ctx, nodeName)
	if err != nil {
		jsonInternalError(w, err, "list pods on node failed")
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

// ── Pod detail ────────────────────────────────────────────────────────────────

type ContainerDetailResponse struct {
	Name         string `json:"name"`
	Image        string `json:"image"`
	Ready        bool   `json:"ready"`
	RestartCount int32  `json:"restartCount"`
	CPURequest   int64  `json:"cpuRequest"` // millicores
	MemRequest   int64  `json:"memRequest"` // bytes
	CPULimit     int64  `json:"cpuLimit"`   // millicores, 0 = no limit set
	MemLimit     int64  `json:"memLimit"`   // bytes, 0 = no limit set
	CPUUsage     int64  `json:"cpuUsage"`   // millicores, 0 = unavailable
	MemUsage     int64  `json:"memUsage"`   // bytes, 0 = unavailable
	LastState    string `json:"lastState"`  // terminated reason or ""
}

type PodConditionResponse struct {
	Type   string `json:"type"`
	Status string `json:"status"` // "True" | "False" | "Unknown"
}

type PodEventResponse struct {
	Type     string `json:"type"` // "Normal" | "Warning"
	Reason   string `json:"reason"`
	Message  string `json:"message"`
	Count    int32  `json:"count"`
	LastSeen string `json:"lastSeen"` // RFC3339
}

type PodDetailResponse struct {
	Name             string                    `json:"name"`
	Namespace        string                    `json:"namespace"`
	Phase            string                    `json:"phase"`
	NodeName         string                    `json:"nodeName"`
	PodIP            string                    `json:"podIP"`
	HostIP           string                    `json:"hostIP"`
	QOSClass         string                    `json:"qosClass"`
	StartedAt        string                    `json:"startedAt"` // RFC3339 or ""
	NodeInstanceType string                    `json:"nodeInstanceType"`
	Labels           map[string]string         `json:"labels"`
	Annotations      map[string]string         `json:"annotations"`
	Containers       []ContainerDetailResponse `json:"containers"`
	Conditions       []PodConditionResponse    `json:"conditions"`
	Events           []PodEventResponse        `json:"events"`
}

func (h *Handler) getPodDetail(w http.ResponseWriter, r *http.Request) {
	if h.k8s == nil {
		jsonError(w, "kubernetes client unavailable", http.StatusServiceUnavailable)
		return
	}
	namespace := chi.URLParam(r, "namespace")
	name := chi.URLParam(r, "name")
	if !isValidK8sName(namespace) || !isValidK8sName(name) {
		jsonError(w, "invalid resource name", http.StatusBadRequest)
		return
	}
	ctx := r.Context()

	pod, err := h.k8s.GetPod(ctx, namespace, name)
	if err != nil {
		jsonInternalError(w, err, "get pod failed")
		return
	}

	csMap := map[string]corev1.ContainerStatus{}
	for _, cs := range pod.Status.ContainerStatuses {
		csMap[cs.Name] = cs
	}

	// Fetch live metrics — silently ignore errors (Metrics Server may be absent)
	metricsMap, _ := h.k8s.GetPodMetrics(ctx, namespace, name)

	var containers []ContainerDetailResponse
	for _, c := range pod.Spec.Containers {
		cs := csMap[c.Name]
		lastState := ""
		if cs.LastTerminationState.Terminated != nil {
			lastState = cs.LastTerminationState.Terminated.Reason
		}
		var cpuUsage, memUsage int64
		if m, ok := metricsMap[c.Name]; ok {
			cpuUsage = m.CPUMillis
			memUsage = m.MemBytes
		}
		containers = append(containers, ContainerDetailResponse{
			Name:         c.Name,
			Image:        c.Image,
			Ready:        cs.Ready,
			RestartCount: cs.RestartCount,
			CPURequest:   c.Resources.Requests.Cpu().MilliValue(),
			MemRequest:   c.Resources.Requests.Memory().Value(),
			CPULimit:     c.Resources.Limits.Cpu().MilliValue(),
			MemLimit:     c.Resources.Limits.Memory().Value(),
			CPUUsage:     cpuUsage,
			MemUsage:     memUsage,
			LastState:    lastState,
		})
	}

	var conditions []PodConditionResponse
	for _, cond := range pod.Status.Conditions {
		conditions = append(conditions, PodConditionResponse{
			Type:   string(cond.Type),
			Status: string(cond.Status),
		})
	}

	events, err := h.k8s.GetPodEvents(ctx, namespace, name)
	if err != nil {
		slog.Warn("getPodDetail: failed to get events", "err", err)
		events = []corev1.Event{}
	}
	var podEvents []PodEventResponse
	for _, e := range events {
		podEvents = append(podEvents, PodEventResponse{
			Type:     e.Type,
			Reason:   e.Reason,
			Message:  e.Message,
			Count:    e.Count,
			LastSeen: e.LastTimestamp.UTC().Format(time.RFC3339),
		})
	}

	startedAt := ""
	if pod.Status.StartTime != nil {
		startedAt = pod.Status.StartTime.UTC().Format(time.RFC3339)
	}
	labels := pod.Labels
	if labels == nil {
		labels = map[string]string{}
	}
	annotations := pod.Annotations
	if annotations == nil {
		annotations = map[string]string{}
	}

	nodeInstanceType := ""
	if pod.Spec.NodeName != "" {
		if node, err := h.k8s.GetNode(ctx, pod.Spec.NodeName); err == nil {
			nodeInstanceType = node.Labels["node.kubernetes.io/instance-type"]
			if nodeInstanceType == "" {
				nodeInstanceType = node.Labels["beta.kubernetes.io/instance-type"]
			}
		}
	}

	jsonOK(w, PodDetailResponse{
		Name:             pod.Name,
		Namespace:        pod.Namespace,
		Phase:            string(pod.Status.Phase),
		NodeName:         pod.Spec.NodeName,
		NodeInstanceType: nodeInstanceType,
		PodIP:            pod.Status.PodIP,
		HostIP:           pod.Status.HostIP,
		QOSClass:         string(pod.Status.QOSClass),
		StartedAt:        startedAt,
		Labels:           labels,
		Annotations:      annotations,
		Containers:       containers,
		Conditions:       conditions,
		Events:           podEvents,
	})
}

// ── Workload pods ─────────────────────────────────────────────────────────────

func (h *Handler) getWorkloadPods(w http.ResponseWriter, r *http.Request) {
	if h.k8s == nil {
		jsonError(w, "kubernetes client unavailable", http.StatusServiceUnavailable)
		return
	}
	namespace := chi.URLParam(r, "namespace")
	kind := chi.URLParam(r, "kind") // Deployment | StatefulSet
	name := chi.URLParam(r, "name")
	if !isValidK8sName(namespace) || !isValidK8sName(name) {
		jsonError(w, "invalid resource name", http.StatusBadRequest)
		return
	}
	ctx := r.Context()

	pods, err := h.k8s.ListPods(ctx, namespace)
	if err != nil {
		jsonInternalError(w, err, "list pods failed")
		return
	}

	rss, err := h.k8s.ListAllReplicaSets(ctx)
	if err != nil {
		slog.Warn("getWorkloadPods: failed to list replicasets", "err", err)
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
		for _, ref := range pod.OwnerReferences {
			ownerKind = ref.Kind
			ownerName = ref.Name
		}
		if ownerKind == "ReplicaSet" {
			if top, ok := rsOwner[pod.Namespace+"/"+ownerName]; ok {
				ownerKind = top.kind
				ownerName = top.name
			}
		}
		if !strings.EqualFold(ownerKind, kind) || ownerName != name {
			continue
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
