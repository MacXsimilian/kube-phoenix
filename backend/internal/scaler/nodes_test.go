// SPDX-License-Identifier: Apache-2.0

package scaler

import (
	"testing"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func pod(name, namespace, nodeName, priorityClass string, daemon bool) corev1.Pod {
	p := corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: namespace},
		Spec: corev1.PodSpec{
			NodeName:          nodeName,
			PriorityClassName: priorityClass,
		},
	}
	if daemon {
		p.OwnerReferences = []metav1.OwnerReference{{Kind: "DaemonSet", Name: "ds"}}
	}
	return p
}

func TestClassifyNodes_IgnoresDaemonSetPodsForCriticality(t *testing.T) {
	pods := []corev1.Pod{
		pod("kube-proxy", "kube-system", "node-a", "system-node-critical", true),
		pod("cni", "kube-system", "node-a", "system-node-critical", true),
	}

	critical, podCount := classifyNodes(pods, map[string]bool{"kube-system": true}, true)

	if critical["node-a"] {
		t.Errorf("node-a should not be critical when only DaemonSet pods are present, got critical=%v", critical)
	}
	if podCount["node-a"] != 0 {
		t.Errorf("podCount[node-a] = %d, want 0 (DaemonSets excluded)", podCount["node-a"])
	}
}

func TestClassifyNodes_MarksCriticalForNonDaemonCriticalPriority(t *testing.T) {
	pods := []corev1.Pod{
		pod("kube-proxy", "kube-system", "node-a", "system-node-critical", true),
		pod("coredns", "kube-system", "node-a", "system-cluster-critical", false),
	}

	critical, podCount := classifyNodes(pods, map[string]bool{}, true)

	if !critical["node-a"] {
		t.Errorf("node-a should be critical due to non-DaemonSet critical-priority pod")
	}
	if podCount["node-a"] != 1 {
		t.Errorf("podCount[node-a] = %d, want 1", podCount["node-a"])
	}
}

func TestClassifyNodes_MarksCriticalForProtectedNamespace(t *testing.T) {
	pods := []corev1.Pod{
		pod("vmselect", "victoriametrics", "node-a", "", false),
	}

	critical, _ := classifyNodes(pods, map[string]bool{"victoriametrics": true}, false)

	if !critical["node-a"] {
		t.Errorf("node-a should be critical when running a pod in a protected namespace")
	}
}

func TestClassifyNodes_RespectsProtectCriticalPodNodesFlag(t *testing.T) {
	pods := []corev1.Pod{
		pod("coredns", "kube-system", "node-a", "system-cluster-critical", false),
	}

	critical, _ := classifyNodes(pods, map[string]bool{}, false)

	if critical["node-a"] {
		t.Errorf("node-a should not be critical when ProtectCriticalPodNodes is false")
	}
}

func TestClassifyNodes_UnprotectedNodeIsDrainable(t *testing.T) {
	pods := []corev1.Pod{
		pod("app", "default", "node-a", "", false),
		pod("worker", "default", "node-a", "", false),
	}

	critical, podCount := classifyNodes(pods, map[string]bool{"kube-system": true}, true)

	if critical["node-a"] {
		t.Errorf("node-a should not be critical when running only ordinary pods")
	}
	if podCount["node-a"] != 2 {
		t.Errorf("podCount[node-a] = %d, want 2", podCount["node-a"])
	}
}
