package k8s

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/kubernetes/fake"
	ktesting "k8s.io/client-go/testing"
)

func TestDrainFailurePreservesPDBAndRecoversOnlyOwnedCordon(t *testing.T) {
	for _, precordoned := range []bool{false, true} {
		for _, budget := range []bool{false, true} {
			cs := fake.NewClientset(&corev1.Node{ObjectMeta: metav1.ObjectMeta{Name: "n", UID: "node-id"}, Spec: corev1.NodeSpec{Unschedulable: precordoned}},
				&corev1.Pod{ObjectMeta: metav1.ObjectMeta{Name: "p", Namespace: "test", UID: "pod-id"}, Spec: corev1.PodSpec{NodeName: "n"}})
			cs.PrependReactor("create", "pods", func(a ktesting.Action) (bool, runtime.Object, error) {
				if budget {
					return true, nil, apierrors.NewTooManyRequests("PDB denied eviction", 0)
				}
				return true, nil, apierrors.NewForbidden(schema.GroupResource{Resource: "pods/eviction"}, "p", errors.New("RBAC denied"))
			})
			err := NewForClientset(cs).DrainNode(context.Background(), "n", 20*time.Millisecond)
			if err == nil {
				t.Fatal("drain succeeded despite rejection")
			}
			if !budget && !strings.Contains(err.Error(), "pods/eviction") {
				t.Fatalf("not actionable: %v", err)
			}
			for _, a := range cs.Actions() {
				if a.GetVerb() == "delete" && a.GetResource().Resource == "pods" {
					t.Fatal("PDB bypass via direct deletion")
				}
			}
			n, _ := cs.CoreV1().Nodes().Get(context.Background(), "n", metav1.GetOptions{})
			if n.Spec.Unschedulable != precordoned {
				t.Fatalf("prior cordon=%v final=%v", precordoned, n.Spec.Unschedulable)
			}
		}
	}
}

func TestEvictionNotFoundAndCancellation(t *testing.T) {
	cs := fake.NewClientset()
	cs.PrependReactor("create", "pods", func(ktesting.Action) (bool, runtime.Object, error) {
		return true, nil, apierrors.NewNotFound(schema.GroupResource{Resource: "pods"}, "p")
	})
	c := NewForClientset(cs)
	pods := []corev1.Pod{{ObjectMeta: metav1.ObjectMeta{Name: "p", Namespace: "test"}}}
	if err := c.evictPods(context.Background(), "n", pods); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := c.evictPods(ctx, "n", pods); !errors.Is(err, context.Canceled) {
		t.Fatalf("err=%v", err)
	}
}

func TestStartupRecoversOnlyMarkedCordons(t *testing.T) {
	cs := fake.NewClientset(
		&corev1.Node{ObjectMeta: metav1.ObjectMeta{Name: "owned", Annotations: map[string]string{cordonOwnerAnnotation: "interrupted-run"}}, Spec: corev1.NodeSpec{Unschedulable: true}},
		&corev1.Node{ObjectMeta: metav1.ObjectMeta{Name: "external"}, Spec: corev1.NodeSpec{Unschedulable: true}},
	)
	if err := NewForClientset(cs).RecoverOwnedCordons(context.Background()); err != nil {
		t.Fatal(err)
	}
	for name, want := range map[string]bool{"owned": false, "external": true} {
		n, err := cs.CoreV1().Nodes().Get(context.Background(), name, metav1.GetOptions{})
		if err != nil || n.Spec.Unschedulable != want {
			t.Fatalf("%s: node=%+v err=%v", name, n, err)
		}
	}
}
