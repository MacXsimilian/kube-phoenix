// SPDX-License-Identifier: Apache-2.0

package api

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/macxsimilian/kube-phoenix/backend/internal/k8s"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// ── Shared pod helpers ────────────────────────────────────────────────────────

type ownerRef struct{ Kind, Name string }

// isDaemonOwned returns true if any owner reference is a DaemonSet.
func isDaemonOwned(refs []metav1.OwnerReference) bool {
	for _, ref := range refs {
		if ref.Kind == "DaemonSet" {
			return true
		}
	}
	return false
}

// resolveOwner returns the effective owner kind and name for a pod.
// If the owner is a ReplicaSet, it resolves to the top-level owner (e.g. Deployment).
func resolveOwner(refs []metav1.OwnerReference, namespace string, rsOwner map[string]ownerRef) (string, string) {
	kind, name := "", ""
	for _, ref := range refs {
		kind = ref.Kind
		name = ref.Name
		break
	}
	if kind == "ReplicaSet" {
		if top, ok := rsOwner[namespace+"/"+name]; ok {
			return top.Kind, top.Name
		}
	}
	return kind, name
}

// buildRSOwnerMap builds a map from "namespace/rsName" -> top-level owner for ReplicaSets.
func buildRSOwnerMap(rss []appsv1.ReplicaSet) map[string]ownerRef {
	m := map[string]ownerRef{}
	for _, rs := range rss {
		for _, ref := range rs.OwnerReferences {
			m[rs.Namespace+"/"+rs.Name] = ownerRef{ref.Kind, ref.Name}
			break
		}
	}
	return m
}

// podResources sums CPU and memory requests across all containers in a pod.
func podResources(containers []corev1.Container) (cpuReq, memReq int64) {
	for _, c := range containers {
		cpuReq += c.Resources.Requests.Cpu().MilliValue()
		memReq += c.Resources.Requests.Memory().Value()
	}
	return
}

// readyCount returns the number of ready containers.
func readyCount(statuses []corev1.ContainerStatus) int {
	n := 0
	for _, cs := range statuses {
		if cs.Ready {
			n++
		}
	}
	return n
}

// podPhase returns the pod phase string, defaulting to "Unknown".
func podPhase(pod corev1.Pod) string {
	if phase := string(pod.Status.Phase); phase != "" {
		return phase
	}
	return "Unknown"
}

// podStartTime returns RFC3339 start time or "".
func podStartTime(pod corev1.Pod) string {
	if pod.Status.StartTime != nil {
		return pod.Status.StartTime.UTC().Format(time.RFC3339)
	}
	return ""
}

// buildNodePodResponse converts a pod into a NodePodResponse.
func buildNodePodResponse(pod corev1.Pod, ownerKind, ownerName string, metrics k8s.ContainerMetrics) NodePodResponse {
	cpuReq, memReq := podResources(pod.Spec.Containers)
	return NodePodResponse{
		Name:            pod.Name,
		Namespace:       pod.Namespace,
		OwnerKind:       ownerKind,
		OwnerName:       ownerName,
		Status:          podPhase(pod),
		ReadyContainers: readyCount(pod.Status.ContainerStatuses),
		TotalContainers: len(pod.Spec.Containers),
		CPURequest:      cpuReq,
		MemRequest:      memReq,
		CPUUsage:        metrics.CPUMillis,
		MemUsage:        metrics.MemBytes,
		StartedAt:       podStartTime(pod),
	}
}

// ── Node pods endpoint ────────────────────────────────────────────────────────

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
	CPUUsage        int64  `json:"cpuUsage"`   // millicores — 0 if metrics unavailable
	MemUsage        int64  `json:"memUsage"`   // bytes     — 0 if metrics unavailable
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

	podMetrics, err := h.k8s.GetAllPodMetrics(ctx)
	if err != nil {
		slog.Warn("getNodePods: pod metrics unavailable", "err", err)
	}
	rsOwner := h.fetchRSOwnerMap(ctx, "getNodePods")

	result := filterAndBuildPodResponses(pods, podMetrics, rsOwner, nil)
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

	metricsMap, _ := h.k8s.GetPodMetrics(ctx, namespace, name)
	containers := buildContainerDetails(pod.Spec.Containers, pod.Status.ContainerStatuses, metricsMap)
	conditions := buildConditions(pod.Status.Conditions)
	events := h.fetchPodEvents(ctx, namespace, name)

	nodeInstanceType := h.resolveNodeInstanceType(ctx, pod.Spec.NodeName)

	jsonOK(w, PodDetailResponse{
		Name:             pod.Name,
		Namespace:        pod.Namespace,
		Phase:            string(pod.Status.Phase),
		NodeName:         pod.Spec.NodeName,
		NodeInstanceType: nodeInstanceType,
		PodIP:            pod.Status.PodIP,
		HostIP:           pod.Status.HostIP,
		QOSClass:         string(pod.Status.QOSClass),
		StartedAt:        podStartTime(*pod),
		Labels:           nonNilMap(pod.Labels),
		Annotations:      nonNilMap(pod.Annotations),
		Containers:       containers,
		Conditions:       conditions,
		Events:           events,
	})
}

func buildContainerDetails(specs []corev1.Container, statuses []corev1.ContainerStatus, metricsMap map[string]k8s.ContainerMetrics) []ContainerDetailResponse {
	csMap := map[string]corev1.ContainerStatus{}
	for _, cs := range statuses {
		csMap[cs.Name] = cs
	}

	var containers []ContainerDetailResponse
	for _, c := range specs {
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
	return containers
}

func buildConditions(conditions []corev1.PodCondition) []PodConditionResponse {
	result := make([]PodConditionResponse, len(conditions))
	for i, cond := range conditions {
		result[i] = PodConditionResponse{
			Type:   string(cond.Type),
			Status: string(cond.Status),
		}
	}
	return result
}

func (h *Handler) fetchPodEvents(ctx context.Context, namespace, name string) []PodEventResponse {
	events, err := h.k8s.GetPodEvents(ctx, namespace, name)
	if err != nil {
		slog.Warn("getPodDetail: failed to get events", "err", err)
		return []PodEventResponse{}
	}
	result := make([]PodEventResponse, len(events))
	for i, e := range events {
		result[i] = PodEventResponse{
			Type:     e.Type,
			Reason:   e.Reason,
			Message:  e.Message,
			Count:    e.Count,
			LastSeen: e.LastTimestamp.UTC().Format(time.RFC3339),
		}
	}
	return result
}

func (h *Handler) resolveNodeInstanceType(ctx context.Context, nodeName string) string {
	if nodeName == "" {
		return ""
	}
	node, err := h.k8s.GetNode(ctx, nodeName)
	if err != nil {
		return ""
	}
	return nodeLabel(*node, "node.kubernetes.io/instance-type", "beta.kubernetes.io/instance-type")
}

// ── Pod logs (streamed from K8s API — no DB) ─────────────────────────────────

func (h *Handler) getPodLogs(w http.ResponseWriter, r *http.Request) {
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

	logOpts := parsePodLogParams(r)

	stream, err := h.k8s.GetPodLogs(r.Context(), namespace, name, logOpts)
	if err != nil {
		jsonInternalError(w, err, "get pod logs failed")
		return
	}
	defer func() { _ = stream.Close() }()

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")

	if !logOpts.Follow {
		if _, err := io.Copy(w, stream); err != nil {
			slog.Warn("getPodLogs: stream copy error", "err", err)
		}
		return
	}

	streamPodLogs(w, stream)
}

// streamPodLogs reads from the log stream and flushes each chunk to the client
// in real time. It returns when the stream is exhausted or a write/flush error
// occurs.
func streamPodLogs(w http.ResponseWriter, stream io.Reader) {
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	rc := http.NewResponseController(w)

	buf := make([]byte, 4096)
	for {
		n, readErr := stream.Read(buf)
		if n > 0 {
			if _, writeErr := w.Write(buf[:n]); writeErr != nil {
				return
			}
			if flushErr := rc.Flush(); flushErr != nil {
				slog.Warn("getPodLogs: flush error", "err", flushErr)
				return
			}
		}
		if readErr != nil {
			return
		}
	}
}

// parsePodLogParams extracts and sanitises pod log query parameters.
func parsePodLogParams(r *http.Request) k8s.PodLogOptions {
	query := r.URL.Query()
	opts := k8s.PodLogOptions{
		Container: query.Get("container"),
		TailLines: 500,
		Previous:  query.Get("previous") == "true",
		Follow:    query.Get("follow") == "true",
	}

	if v := query.Get("tailLines"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil && n > 0 && n <= 10000 {
			opts.TailLines = n
		}
	}

	// Cannot stream previous (terminated) container logs.
	if opts.Previous {
		opts.Follow = false
	}
	return opts
}

// ── Workload pods ─────────────────────────────────────────────────────────────

// podFilter optionally filters pods by owner. If nil, all non-daemon pods are included.
type podFilter struct {
	Kind string
	Name string
}

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

	podMetrics, err := h.k8s.GetAllPodMetrics(ctx)
	if err != nil {
		slog.Warn("getWorkloadPods: pod metrics unavailable", "err", err)
	}
	rsOwner := h.fetchRSOwnerMap(ctx, "getWorkloadPods")

	result := filterAndBuildPodResponses(pods, podMetrics, rsOwner, &podFilter{Kind: kind, Name: name})
	jsonOK(w, result)
}

// fetchRSOwnerMap fetches ReplicaSets and builds the owner resolution map.
func (h *Handler) fetchRSOwnerMap(ctx context.Context, caller string) map[string]ownerRef {
	rss, err := h.k8s.ListAllReplicaSets(ctx)
	if err != nil {
		slog.Warn(caller+": failed to list replicasets — owners will show as ReplicaSet", "err", err)
	}
	return buildRSOwnerMap(rss)
}

// filterAndBuildPodResponses converts pods to NodePodResponse, filtering daemonset pods
// and optionally filtering by owner.
func filterAndBuildPodResponses(pods []corev1.Pod, podMetrics map[string]k8s.ContainerMetrics, rsOwner map[string]ownerRef, filter *podFilter) []NodePodResponse {
	var result []NodePodResponse
	for _, pod := range pods {
		if isDaemonOwned(pod.OwnerReferences) {
			continue
		}
		ownerKind, ownerName := resolveOwner(pod.OwnerReferences, pod.Namespace, rsOwner)

		if filter != nil {
			if !strings.EqualFold(ownerKind, filter.Kind) || ownerName != filter.Name {
				continue
			}
		}

		m := podMetrics[pod.Namespace+"/"+pod.Name]
		result = append(result, buildNodePodResponse(pod, ownerKind, ownerName, m))
	}

	if result == nil {
		result = []NodePodResponse{}
	}
	return result
}
