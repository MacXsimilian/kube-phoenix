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
	n := int32(5)
	meta := metav1.ObjectMeta{Name: "a", Namespace: "test", UID: "replacement", ResourceVersion: "2"}
	if kind == "Deployment" {
		return &appsv1.Deployment{ObjectMeta: meta, Spec: appsv1.DeploymentSpec{Replicas: &n}}
	}
	return &appsv1.StatefulSet{ObjectMeta: meta, Spec: appsv1.StatefulSetSpec{Replicas: &n}}
}

func TestSnapshotRecoveryUsesNames(t *testing.T) {
	for _, kind := range []string{"Deployment", "StatefulSet"} {
		for _, uid := range []string{"", "original"} {
			for _, action := range []string{"sleep", "wake", "reconcile"} {
				t.Run(kind+"/"+uid+"/"+action, func(t *testing.T) {
					cs := recoveryClient(namedWorkload(kind))
					st := &memorySnapshots{snaps: []store.WorkloadSnapshot{{ID: 1, Kind: kind, Namespace: "test", Name: "a", WorkloadUID: uid, ReplicasBefore: 3, Phase: "prepared"}}}
					r := &PolicyRunner{base: New(k8s.NewForClientset(cs), nil), store: st}
					p := store.Policy{ID: 1, Mode: "apply"}
					ctx := context.Background()
					var err error
					target := int32(0)
					switch action {
					case "sleep":
						_, err = r.RunPolicySleep(ctx, p, 2, nil)
					case "wake":
						_, err = r.RunPolicyWake(ctx, p, 2, nil)
						target = 3
					case "reconcile":
						_, err = r.RunPolicySleepReconcile(ctx, p, 2, nil)
					}
					if err != nil {
						t.Fatal(err)
					}
					live, err := r.lookupEntry(ctx, kind, "test", "a")
					if err != nil || live == nil || live.Replicas != target {
						t.Fatalf("live=%+v err=%v target=%d", live, err, target)
					}
				})
			}
		}
	}
}

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
