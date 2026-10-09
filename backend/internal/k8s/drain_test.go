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

// Sleep draining intentionally falls back to direct deletion after an eviction
// error. The delete must use zero grace and the observed pod UID.
func TestEvictionFailureFallsBackToZeroGraceDeletion(t *testing.T) {
	for name, evictionErr := range map[string]error{
		"budget":    apierrors.NewTooManyRequests("PDB denied eviction", 0),
		"forbidden": apierrors.NewForbidden(schema.GroupResource{Resource: "pods/eviction"}, "p", errors.New("RBAC denied")),
		"transient": apierrors.NewServiceUnavailable("temporarily unavailable"),
		"other":     errors.New("eviction failed"),
	} {
		t.Run(name, func(t *testing.T) {
			cs := fake.NewClientset(
				&corev1.Node{ObjectMeta: metav1.ObjectMeta{Name: "n", UID: "node-id"}},
				&corev1.Pod{ObjectMeta: metav1.ObjectMeta{Name: "p", Namespace: "test", UID: "pod-id"}, Spec: corev1.PodSpec{NodeName: "n"}},
			)
			cs.PrependReactor("create", "pods", func(ktesting.Action) (bool, runtime.Object, error) {
				return true, nil, evictionErr
			})
			if err := NewForClientset(cs).DrainNode(context.Background(), "n", time.Second); err != nil {
				t.Fatal(err)
			}
			deletes := 0
			for _, action := range cs.Actions() {
				if action.GetVerb() != "delete" || action.GetResource().Resource != "pods" {
					continue
				}
				deletes++
				opts := action.(ktesting.DeleteAction).GetDeleteOptions()
				if opts.GracePeriodSeconds == nil || *opts.GracePeriodSeconds != 0 {
					t.Fatal("fallback did not request zero grace")
				}
				if opts.Preconditions == nil || opts.Preconditions.UID == nil || *opts.Preconditions.UID != "pod-id" {
					t.Fatal("fallback must target the observed pod UID")
				}
			}
			if deletes != 1 {
				t.Fatalf("pod deletions=%d, want 1", deletes)
			}
		})
	}
}

// When both pod removal paths fail, undo only the cordon added by this drain.
// A node already cordoned by another actor must remain cordoned.
func TestFailedEvictionAndDeletionRecoversOnlyOwnedCordon(t *testing.T) {
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
			cs.PrependReactor("delete", "pods", func(ktesting.Action) (bool, runtime.Object, error) {
				return true, nil, apierrors.NewForbidden(schema.GroupResource{Resource: "pods"}, "p", errors.New("delete denied"))
			})
			err := NewForClientset(cs).DrainNode(context.Background(), "n", time.Second)
			if err == nil {
				t.Fatal("drain succeeded despite rejection")
			}
			if !strings.Contains(err.Error(), "delete on core pods") {
				t.Fatalf("not actionable: %v", err)
			}
			deleted := false
			for _, a := range cs.Actions() {
				if a.GetVerb() == "delete" && a.GetResource().Resource == "pods" {
					deleted = true
				}
			}
			if !deleted {
				t.Fatal("direct deletion fallback was not attempted")
			}
			n, _ := cs.CoreV1().Nodes().Get(context.Background(), "n", metav1.GetOptions{})
			if n.Spec.Unschedulable != precordoned {
				t.Fatalf("prior cordon=%v final=%v", precordoned, n.Spec.Unschedulable)
			}
		}
	}
}

// Cancellation after an eviction error must stop the operation before the
// destructive deletion fallback, even when eviction was rejected by a budget.
func TestEvictionCancellationPreventsDeletionFallback(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	cs := fake.NewClientset()
	cs.PrependReactor("create", "pods", func(ktesting.Action) (bool, runtime.Object, error) {
		cancel()
		return true, nil, apierrors.NewTooManyRequests("PDB denied eviction", 0)
	})
	err := NewForClientset(cs).evictPods(ctx, "n", []corev1.Pod{{ObjectMeta: metav1.ObjectMeta{Name: "p", Namespace: "test", UID: "pod-id"}}})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("err=%v", err)
	}
	for _, action := range cs.Actions() {
		if action.GetVerb() == "delete" {
			t.Fatal("cancelled drain attempted deletion")
		}
	}
}

// An accepted eviction needs no deletion fallback. DaemonSet pods are
// excluded because their controller would recreate them on the node.
func TestSuccessfulEvictionSkipsDirectDeletionAndDaemonSets(t *testing.T) {
	cs := fake.NewClientset()
	evictions := 0
	cs.PrependReactor("create", "pods", func(ktesting.Action) (bool, runtime.Object, error) {
		evictions++
		return true, nil, nil
	})
	pods := []corev1.Pod{
		{ObjectMeta: metav1.ObjectMeta{Name: "p", Namespace: "test", UID: "pod-id"}},
		{ObjectMeta: metav1.ObjectMeta{Name: "daemon", Namespace: "test", OwnerReferences: []metav1.OwnerReference{{Kind: "DaemonSet"}}}},
	}
	if err := NewForClientset(cs).evictPods(context.Background(), "n", pods); err != nil {
		t.Fatal(err)
	}
	if evictions != 1 {
		t.Fatalf("evictions=%d, want 1", evictions)
	}
	for _, action := range cs.Actions() {
		if action.GetVerb() == "delete" {
			t.Fatal("successful eviction triggered direct deletion")
		}
	}
}

// A pod can disappear between listing and fallback deletion. NotFound means
// there is nothing left to remove and must not fail the drain.
func TestDeletionNotFoundIsAlreadyDrained(t *testing.T) {
	cs := fake.NewClientset()
	cs.PrependReactor("create", "pods", func(ktesting.Action) (bool, runtime.Object, error) {
		return true, nil, apierrors.NewTooManyRequests("PDB denied eviction", 0)
	})
	// The pod disappeared after listing: the fake client's delete returns NotFound.
	err := NewForClientset(cs).evictPods(context.Background(), "n", []corev1.Pod{{ObjectMeta: metav1.ObjectMeta{Name: "gone", Namespace: "test", UID: "old-id"}}})
	if err != nil {
		t.Fatal(err)
	}
}

// The scheduler may lose database ownership after trying eviction. Check
// ownership again before deletion so a stale process cannot keep mutating pods.
func TestOwnershipLossPreventsDeletionFallback(t *testing.T) {
	cs := fake.NewClientset()
	cs.PrependReactor("create", "pods", func(ktesting.Action) (bool, runtime.Object, error) {
		return true, nil, apierrors.NewTooManyRequests("PDB denied eviction", 0)
	})
	c := NewForClientset(cs)
	checks := 0
	lost := errors.New("ownership lost")
	c.SetMutationGuard(func(context.Context) error {
		checks++
		if checks > 1 {
			return lost
		}
		return nil
	})
	err := c.evictPods(context.Background(), "n", []corev1.Pod{{ObjectMeta: metav1.ObjectMeta{Name: "p", Namespace: "test", UID: "pod-id"}}})
	if !errors.Is(err, lost) {
		t.Fatalf("err=%v", err)
	}
	for _, action := range cs.Actions() {
		if action.GetVerb() == "delete" {
			t.Fatal("lost owner attempted deletion")
		}
	}
}

// An already-absent pod is harmless, while a cancelled context must stop
// eviction work and return the caller's cancellation error.
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

// After an interrupted run, only nodes carrying our ownership marker should
// be uncordoned. Unmarked external cordons must survive startup recovery.
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
