package api

import (
	"log/slog"
	"net/http"
	"regexp"
	"sync"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/nodeutil"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	"github.com/macxsimilian/kube-phoenix/backend/internal/stringutil"
	corev1 "k8s.io/api/core/v1"
)

type NodeTaintResponse struct {
	Key    string `json:"key"`
	Value  string `json:"value"`
	Effect string `json:"effect"`
}

type NodeResponse struct {
	Name             string              `json:"name"`
	InstanceType     string              `json:"instanceType"`
	Zone             string              `json:"zone"`
	PodCount         int                 `json:"podCount"`
	Status           string              `json:"status"` // "active" | "protected" | "would-drain"
	ProtectionReason string              `json:"protectionReason"`
	CpuAllocatable   int64               `json:"cpuAllocatable"` // millicores
	CpuRequested     int64               `json:"cpuRequested"`   // millicores
	MemAllocatable   int64               `json:"memAllocatable"` // bytes
	MemRequested     int64               `json:"memRequested"`   // bytes
	CreatedAt        string              `json:"createdAt"`      // RFC3339
	Cordoned         bool                `json:"cordoned"`
	Labels           map[string]string   `json:"labels"`
	Taints           []NodeTaintResponse `json:"taints"`
}

// validK8sName reports whether s is a valid Kubernetes resource name.
var validK8sName = regexp.MustCompile(`^[a-z0-9][a-z0-9\-\.]{0,252}[a-z0-9]$|^[a-z0-9]$`)

func isValidK8sName(s string) bool {
	return validK8sName.MatchString(s)
}

// ── Nodes endpoint ────────────────────────────────────────────────────────────

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
		// Fallback: fetch nodes and pods in parallel
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
	skipNsNode := stringutil.SplitCSVSet(g.SkipNsNode)

	for _, pod := range allPods {
		if !isDaemonOwned(pod.OwnerReferences) {
			podCounts[pod.Spec.NodeName]++
			cpu, mem := podResources(pod.Spec.Containers)
			cpuRequested[pod.Spec.NodeName] += cpu
			memRequested[pod.Spec.NodeName] += mem
		}
		if skipNsNode[pod.Namespace] {
			criticalNodes[pod.Spec.NodeName] = true
		}
		if g.ProtectCriticalPodNodes && nodeutil.IsCriticalPod(pod.Spec.PriorityClassName) {
			criticalNodes[pod.Spec.NodeName] = true
		}
	}

	var result []NodeResponse
	for _, node := range nodes {
		instanceType := nodeLabel(node, "node.kubernetes.io/instance-type", "beta.kubernetes.io/instance-type")
		zone := nodeLabel(node, "topology.kubernetes.io/zone", "failure-domain.beta.kubernetes.io/zone")

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
			Labels:           nonNilMap(node.Labels),
			Taints:           convertTaints(node.Spec.Taints),
		})
	}

	if result == nil {
		result = []NodeResponse{}
	}
	return result
}

// nodeLabel returns the first non-empty label value from the given keys.
func nodeLabel(node corev1.Node, keys ...string) string {
	for _, k := range keys {
		if v := node.Labels[k]; v != "" {
			return v
		}
	}
	return ""
}


// convertTaints maps Kubernetes taints to their API response representation.
func convertTaints(taints []corev1.Taint) []NodeTaintResponse {
	out := make([]NodeTaintResponse, 0, len(taints))
	for _, t := range taints {
		out = append(out, NodeTaintResponse{
			Key:    t.Key,
			Value:  t.Value,
			Effect: string(t.Effect),
		})
	}
	return out
}

func nodeProtectionStatus(nodeName string, labels map[string]string, taints []corev1.Taint, skipLabels, skipTaints string, criticalNodes map[string]bool) (string, string) {
	if m := nodeutil.MatchLabel(labels, skipLabels); m != "" {
		return "protected", "label: " + m
	}
	if m := nodeutil.MatchTaint(taints, skipTaints); m != "" {
		return "protected", "taint: " + m
	}
	if criticalNodes[nodeName] {
		return "protected", "running critical workload"
	}
	return "would-drain", ""
}
