package scaler

import (
	"context"
	"errors"
	"testing"

	"github.com/macxsimilian/kube-phoenix/backend/internal/k8s"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	appsv1 "k8s.io/api/apps/v1"
	autoscalingv1 "k8s.io/api/autoscaling/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes/fake"
	ktesting "k8s.io/client-go/testing"
)

func recoveryDeployment(name, uid string, replicas int32) *appsv1.Deployment {
	return &appsv1.Deployment{ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "test", UID: types.UID(uid), ResourceVersion: "1"}, Spec: appsv1.DeploymentSpec{Replicas: &replicas}}
}

func TestPartialSleepRetriesAndWakeRestores(t *testing.T) {
	cs := recoveryClient(recoveryDeployment("a", "a-id", 3), recoveryDeployment("b", "b-id", 5))
	fail := true
	cs.PrependReactor("update", "deployments", func(a ktesting.Action) (bool, runtime.Object, error) {
		if fail && a.GetSubresource() == "scale" && a.(ktesting.UpdateAction).GetObject().(*autoscalingv1.Scale).Name == "b" {
			return true, nil, errors.New("injected scale failure")
		}
		return false, nil, nil
	})
	st := &memorySnapshots{}
	r := &PolicyRunner{base: New(k8s.NewForClientset(cs), nil), store: st}
	p := store.Policy{ID: 1, Mode: "apply"}
	counts, err := r.RunPolicySleep(context.Background(), p, 1, nil)
	if err == nil || counts.Scaled != 1 || counts.Errors != 1 || len(st.snaps) != 2 {
		t.Fatalf("counts=%+v err=%v snaps=%+v", counts, err, st.snaps)
	}
	for _, a := range cs.Actions() {
		if a.GetResource().Resource == "nodes" {
			t.Fatal("node phase ran after partial failure")
		}
	}
	fail = false
	// Reconstruct the runner to model a process restart with only durable state.
	r = &PolicyRunner{base: New(k8s.NewForClientset(cs), nil), store: st}
	if _, err := r.RunPolicySleep(context.Background(), p, 2, nil); err != nil {
		t.Fatal(err)
	}
	if len(st.snaps) != 2 {
		t.Fatalf("retry replaced baselines: %+v", st.snaps)
	}
	if _, err := r.RunPolicyWake(context.Background(), p, 3, nil); err != nil {
		t.Fatal(err)
	}
	for name, expected := range map[string]int32{"a": 3, "b": 5} {
		d, err := cs.AppsV1().Deployments("test").Get(context.Background(), name, metav1.GetOptions{})
		if err != nil || *d.Spec.Replicas != expected {
			t.Fatalf("%s: replicas=%v err=%v", name, d.Spec.Replicas, err)
		}
	}
}

func TestWakeRestoresByNameIncludingLegacyAndReplacement(t *testing.T) {
	for _, uid := range []string{"", "old-id", "live-id"} {
		t.Run("snapshot-"+uid, func(t *testing.T) {
			cs := recoveryClient(recoveryDeployment("a", "live-id", 0))
			st := &memorySnapshots{snaps: []store.WorkloadSnapshot{{ID: 1, Kind: "Deployment", Namespace: "test", Name: "a", WorkloadUID: uid, ReplicasBefore: 3, Phase: "prepared"}}}
			r := &PolicyRunner{base: New(k8s.NewForClientset(cs), nil), store: st}
			_, err := r.RunPolicyWake(context.Background(), store.Policy{ID: 1, Mode: "apply"}, 2, nil)
			if err != nil {
				t.Fatalf("UID=%q err=%v", uid, err)
			}
			d, err := cs.AppsV1().Deployments("test").Get(context.Background(), "a", metav1.GetOptions{})
			if err != nil || *d.Spec.Replicas != 3 {
				t.Fatalf("restore failed: workload=%+v snapshots=%+v err=%v", d, st.snaps, err)
			}
		})
	}
}

// The fake tracker does not implement the Kubernetes scale subresource.
func recoveryClient(objects ...runtime.Object) *fake.Clientset {
	cs := fake.NewClientset(objects...)
	cs.PrependReactor("*", "*", func(a ktesting.Action) (bool, runtime.Object, error) {
		if a.GetSubresource() != "scale" {
			return false, nil, nil
		}
		name := ""
		switch action := a.(type) {
		case ktesting.GetAction:
			name = action.GetName()
		case ktesting.UpdateAction:
			name = action.GetObject().(*autoscalingv1.Scale).Name
		default:
			return false, nil, nil
		}
		obj, err := cs.Tracker().Get(a.GetResource(), a.GetNamespace(), name)
		if err != nil {
			return true, nil, err
		}
		var replicas *int32
		var meta metav1.ObjectMeta
		switch workload := obj.(type) {
		case *appsv1.Deployment:
			replicas = workload.Spec.Replicas
			meta = workload.ObjectMeta
		case *appsv1.StatefulSet:
			replicas = workload.Spec.Replicas
			meta = workload.ObjectMeta
		default:
			return false, nil, nil
		}
		if action, ok := a.(ktesting.UpdateAction); ok {
			*replicas = action.GetObject().(*autoscalingv1.Scale).Spec.Replicas
			if err := cs.Tracker().Update(a.GetResource(), obj, a.GetNamespace()); err != nil {
				return true, nil, err
			}
		}
		return true, &autoscalingv1.Scale{ObjectMeta: meta, Spec: autoscalingv1.ScaleSpec{Replicas: *replicas}}, nil
	})
	return cs
}
