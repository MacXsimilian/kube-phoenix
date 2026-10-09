package scaler

import (
	"context"
	"testing"

	"github.com/macxsimilian/kube-phoenix/backend/internal/k8s"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	appsv1 "k8s.io/api/apps/v1"
	autoscalingv1 "k8s.io/api/autoscaling/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	ktesting "k8s.io/client-go/testing"
)

func namedWorkload(kind string) runtime.Object {
	replicas := int32(5)
	metadata := metav1.ObjectMeta{
		Name:            "a",
		Namespace:       "test",
		UID:             "replacement",
		ResourceVersion: "2",
	}
	if kind == "Deployment" {
		return &appsv1.Deployment{ObjectMeta: metadata, Spec: appsv1.DeploymentSpec{Replicas: &replicas}}
	}
	return &appsv1.StatefulSet{ObjectMeta: metadata, Spec: appsv1.StatefulSetSpec{Replicas: &replicas}}
}

// Both workload kinds use name-based recovery for sleep, wake, and reconciliation.
// The live replacement starts at five replicas, distinct from the saved three.
func TestSnapshotRecoveryUsesNames(t *testing.T) {
	identities := []struct {
		name string
		uid  string
	}{
		{name: "legacy snapshot without UID", uid: ""},
		{name: "replacement workload", uid: "original"},
	}
	for _, kind := range []string{"Deployment", "StatefulSet"} {
		for _, identity := range identities {
			for _, action := range []string{"sleep", "wake", "reconcile"} {
				t.Run(kind+"/"+identity.name+"/"+action, func(t *testing.T) {
					clientset := recoveryClient(namedWorkload(kind))
					snapshot := store.WorkloadSnapshot{
						ID:             1,
						PolicyID:       1,
						Kind:           kind,
						Namespace:      "test",
						Name:           "a",
						WorkloadUID:    identity.uid,
						ReplicasBefore: 3,
						Phase:          "prepared",
					}
					snapshots := &memorySnapshots{snaps: []store.WorkloadSnapshot{snapshot}}
					runner := newRecoveryRunner(clientset, snapshots)
					policy := store.Policy{ID: 1, Mode: store.PolicyModeApply}
					var err error
					wantReplicas := int32(0)
					switch action {
					case "sleep":
						_, err = runner.RunPolicySleep(t.Context(), policy, 2, nil)
					case "wake":
						_, err = runner.RunPolicyWake(t.Context(), policy, 2, nil)
						wantReplicas = 3
					case "reconcile":
						_, err = runner.RunPolicySleepReconcile(t.Context(), policy, 2, nil)
					}
					if err != nil {
						t.Fatalf("%s workload: %v", action, err)
					}
					live, err := runner.lookupEntry(t.Context(), kind, "test", "a")
					if err != nil {
						t.Fatalf("look up recovered workload: %v", err)
					}
					if live == nil {
						t.Fatal("recovered workload is missing")
					}
					if live.Replicas != wantReplicas {
						t.Errorf("replicas = %d, want %d", live.Replicas, wantReplicas)
					}
				})
			}
		}
	}
}

// A workload selected from an old listing may have a newer scale version.
// A conflict must trigger another read before retrying the update.
func TestNameScalingRetriesConcurrentUpdates(t *testing.T) {
	for _, kind := range []string{"Deployment", "StatefulSet"} {
		t.Run(kind, func(t *testing.T) {
			cs := recoveryClient(namedWorkload(kind))
			r := New(k8s.NewForClientset(cs), nil)
			// The listing that selected the workload may predate recreation or updates.
			old := namedWorkload(kind)
			var entry workloadEntry
			switch obj := old.(type) {
			case *appsv1.Deployment:
				obj.UID = "original"
				obj.ResourceVersion = "1"
				entry = r.deploymentToEntry(*obj)
			case *appsv1.StatefulSet:
				obj.UID = "original"
				obj.ResourceVersion = "1"
				entry = r.statefulSetToEntry(*obj)
			}
			attempts, reads := 0, 0
			cs.PrependReactor("get", "*", func(a ktesting.Action) (bool, runtime.Object, error) {
				if a.GetSubresource() == "scale" {
					reads++
				}
				return false, nil, nil
			})
			cs.PrependReactor("update", "*", func(a ktesting.Action) (bool, runtime.Object, error) {
				if a.GetSubresource() != "scale" {
					return false, nil, nil
				}
				attempts++
				scale := a.(ktesting.UpdateAction).GetObject().(*autoscalingv1.Scale)
				if scale.ResourceVersion != "2" {
					t.Errorf("did not re-read current scale: %+v", scale)
				}
				if attempts == 1 {
					// Reject the first update so the next attempt must fetch scale again.
					return true, nil, apierrors.NewConflict(schema.GroupResource{Group: "apps", Resource: a.GetResource().Resource}, "a", nil)
				}
				return false, nil, nil
			})
			if err := entry.Scale(context.Background(), "test", "a", 0); err != nil {
				t.Fatal(err)
			}
			if attempts != 2 || reads != 2 {
				t.Fatalf("attempts=%d reads=%d", attempts, reads)
			}
		})
	}
}
