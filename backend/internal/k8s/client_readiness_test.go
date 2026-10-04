// SPDX-License-Identifier: Apache-2.0

package k8s

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

func TestCountReadyPodsUsesCompleteWorkloadSelector(t *testing.T) {
	selector := &metav1.LabelSelector{
		MatchLabels: map[string]string{"tier": "backend"},
		MatchExpressions: []metav1.LabelSelectorRequirement{
			{Key: "app", Operator: metav1.LabelSelectorOpIn, Values: []string{"api"}},
			{Key: "stage", Operator: metav1.LabelSelectorOpNotIn, Values: []string{"retired"}},
			{Key: "managed", Operator: metav1.LabelSelectorOpExists},
			{Key: "excluded", Operator: metav1.LabelSelectorOpDoesNotExist},
		},
	}
	pods := []corev1.Pod{
		readinessPod("api-pending", map[string]string{"tier": "backend", "app": "api", "stage": "live", "managed": "yes"}, false),
		readinessPod("other-ready", map[string]string{"tier": "backend", "app": "db", "stage": "live", "managed": "yes"}, true),
		readinessPod("retired-ready", map[string]string{"tier": "backend", "app": "api", "stage": "retired", "managed": "yes"}, true),
		readinessPod("unmanaged-ready", map[string]string{"tier": "backend", "app": "api", "stage": "live"}, true),
		readinessPod("excluded-ready", map[string]string{"tier": "backend", "app": "api", "stage": "live", "managed": "yes", "excluded": "yes"}, true),
	}
	for _, tc := range []struct {
		name         string
		selector     *metav1.LabelSelector
		pods         []corev1.Pod
		ready, total int
	}{
		{name: "matching pod pending", selector: selector, pods: pods, ready: 0, total: 1},
		{
			name:     "matching pod ready",
			selector: selector,
			pods: append(pods, readinessPod("api-ready", map[string]string{
				"tier": "backend", "app": "api", "stage": "live", "managed": "yes",
			}, true)),
			ready: 1, total: 2,
		},
		{
			name:     "expression-only selector",
			selector: &metav1.LabelSelector{MatchExpressions: selector.MatchExpressions},
			pods: append(pods, readinessPod("api-ready-without-tier", map[string]string{
				"app": "api", "stage": "live", "managed": "yes",
			}, true)),
			ready: 1, total: 2,
		},
	} {
		for _, kind := range []string{"Deployment", "StatefulSet"} {
			t.Run(tc.name+"/"+kind, func(t *testing.T) {
				client := readinessTestClient(t, kind, tc.selector, tc.pods, nil)
				ready, total, err := client.CountReadyPods(context.Background(), kind, "test", "api")
				if err != nil {
					t.Fatal(err)
				}
				if ready != tc.ready || total != tc.total {
					t.Fatalf("ready=%d total=%d, want %d/%d matching pods", ready, total, tc.ready, tc.total)
				}
			})
		}
	}
}

func TestCountReadyPodsRejectsInvalidWorkloadSelector(t *testing.T) {
	for _, tc := range []struct {
		name     string
		selector *metav1.LabelSelector
	}{
		{name: "missing"},
		{name: "empty", selector: &metav1.LabelSelector{}},
		{name: "invalid expression", selector: &metav1.LabelSelector{MatchExpressions: []metav1.LabelSelectorRequirement{
			{Key: "app", Operator: "Unknown", Values: []string{"api"}},
		}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var listedPods atomic.Bool
			client := readinessTestClient(t, "Deployment", tc.selector, nil, &listedPods)
			_, _, err := client.CountReadyPods(context.Background(), "Deployment", "test", "api")
			if err == nil || !strings.Contains(err.Error(), "selector") {
				t.Fatalf("expected selector error, got %v", err)
			}
			if listedPods.Load() {
				t.Fatal("invalid selector must not list namespace pods")
			}
		})
	}
}

func readinessPod(name string, podLabels map[string]string, ready bool) corev1.Pod {
	status := corev1.ConditionFalse
	if ready {
		status = corev1.ConditionTrue
	}
	return corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "test", Labels: podLabels},
		Status:     corev1.PodStatus{Conditions: []corev1.PodCondition{{Type: corev1.PodReady, Status: status}}},
	}
}

// The HTTP fixture applies the transmitted selector like the API server does.
// This exercises selector serialization through the real client-go client.
func readinessTestClient(t *testing.T, kind string, selector *metav1.LabelSelector, pods []corev1.Pod, listedPods *atomic.Bool) *Client {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		var response any
		switch r.URL.Path {
		case "/apis/apps/v1/namespaces/test/deployments/api":
			response = &appsv1.Deployment{
				TypeMeta: metav1.TypeMeta{APIVersion: "apps/v1", Kind: "Deployment"},
				Spec:     appsv1.DeploymentSpec{Selector: selector},
			}
		case "/apis/apps/v1/namespaces/test/statefulsets/api":
			response = &appsv1.StatefulSet{
				TypeMeta: metav1.TypeMeta{APIVersion: "apps/v1", Kind: "StatefulSet"},
				Spec:     appsv1.StatefulSetSpec{Selector: selector},
			}
		case "/api/v1/namespaces/test/pods":
			if listedPods != nil {
				listedPods.Store(true)
			}
			parsed, err := labels.Parse(r.URL.Query().Get("labelSelector"))
			if err != nil {
				t.Errorf("invalid transmitted selector: %v", err)
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			matching := []corev1.Pod{}
			for _, pod := range pods {
				if parsed.Matches(labels.Set(pod.Labels)) {
					matching = append(matching, pod)
				}
			}
			response = &corev1.PodList{TypeMeta: metav1.TypeMeta{APIVersion: "v1", Kind: "PodList"}, Items: matching}
		default:
			t.Errorf("unexpected %s request: %s", kind, r.URL.Path)
			http.NotFound(w, r)
			return
		}
		if err := json.NewEncoder(w).Encode(response); err != nil {
			t.Errorf("encode API response: %v", err)
		}
	}))
	t.Cleanup(server.Close)
	clientset, err := kubernetes.NewForConfig(&rest.Config{Host: server.URL})
	if err != nil {
		t.Fatal(err)
	}
	return &Client{cs: clientset}
}
