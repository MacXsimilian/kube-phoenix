package scaler

import (
	"context"
	"testing"

	"github.com/macxsimilian/kube-phoenix/backend/internal/k8s"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestScopedSleepAndWake(t *testing.T) {
	ctx := context.Background()
	for _, scope := range []store.ScheduledException{
		{WorkloadTargets: `[{"kind":"Deployment","namespace":"test","name":"a"}]`},
		{NamespaceFilter: "test", LabelSelector: "app=a"},
		{NamespaceFilter: "test", LabelSelector: "app=a", WorkloadTargets: `[{"kind":"Deployment","namespace":"test","name":"a"}]`},
	} {
		a, b := recoveryDeployment("a", "a-id", 3), recoveryDeployment("b", "b-id", 5)
		a.Labels, b.Labels = map[string]string{"app": "a"}, map[string]string{"app": "b"}
		cs := recoveryClient(a, b)
		st := &memorySnapshots{}
		r := &PolicyRunner{base: New(k8s.NewForClientset(cs), nil), store: st}
		p := store.Policy{ID: 1, Mode: "apply", NamespaceFilter: "test", ExceptionScope: &scope}
		if _, err := r.RunPolicySleep(ctx, p, 1, nil); err != nil {
			t.Fatal(err)
		}
		liveB, _ := cs.AppsV1().Deployments("test").Get(ctx, "b", metav1.GetOptions{})
		if *liveB.Spec.Replicas != 5 || len(st.snaps) != 1 {
			t.Fatal("scoped sleep touched B")
		}
		// Both workloads have open snapshots; a scoped wake must still exclude B.
		zero := int32(0)
		liveB.Spec.Replicas = &zero
		_, _ = cs.AppsV1().Deployments("test").Update(ctx, liveB, metav1.UpdateOptions{})
		st.snaps = append(st.snaps, store.WorkloadSnapshot{ID: 2, Kind: "Deployment", Namespace: "test", Name: "b", WorkloadUID: "b-id", ReplicasBefore: 5})
		if _, err := r.RunPolicyWake(ctx, p, 2, nil); err != nil {
			t.Fatal(err)
		}
		liveB, _ = cs.AppsV1().Deployments("test").Get(ctx, "b", metav1.GetOptions{})
		if *liveB.Spec.Replicas != 0 {
			t.Fatal("scoped wake touched B")
		}
		// Corrective sleep must retain exactly the same explicit/label scope.
		five := int32(5)
		liveB.Spec.Replicas = &five
		_, _ = cs.AppsV1().Deployments("test").Update(ctx, liveB, metav1.UpdateOptions{})
		if _, err := r.RunPolicySleepReconcile(ctx, p, 3, nil); err != nil {
			t.Fatal(err)
		}
		liveB, _ = cs.AppsV1().Deployments("test").Get(ctx, "b", metav1.GetOptions{})
		if *liveB.Spec.Replicas != 5 {
			t.Fatal("corrective scoped sleep touched B")
		}
		// Full-policy wake ignores changed labels and restores owned recovery data.
		p.ExceptionScope = nil
		p.LabelSelector = "app=changed"
		if _, err := r.RunPolicyWake(ctx, p, 3, nil); err != nil {
			t.Fatal(err)
		}
		liveB, _ = cs.AppsV1().Deployments("test").Get(ctx, "b", metav1.GetOptions{})
		if *liveB.Spec.Replicas != 5 {
			t.Fatal("ordinary wake abandoned changed labels")
		}
	}
}
