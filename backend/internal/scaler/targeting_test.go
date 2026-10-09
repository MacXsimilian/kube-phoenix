package scaler

import (
	"testing"

	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

// Each targeting form selects A while excluding B. Corrective sleep uses an open
// sleep intent; wake consumes that intent so it cannot be reconciled again.
func TestScopedSleepAndWake(t *testing.T) {
	tests := []struct {
		name  string
		scope store.ScheduledException
	}{
		{
			name: "explicit workload target",
			scope: store.ScheduledException{
				WorkloadTargets: `[{"kind":"Deployment","namespace":"test","name":"a"}]`,
			},
		},
		{
			name: "namespace and label selector",
			scope: store.ScheduledException{
				NamespaceFilter: "test",
				LabelSelector:   "app=a",
			},
		},
		{
			name: "intersection of all filters",
			scope: store.ScheduledException{
				NamespaceFilter: "test",
				LabelSelector:   "app=a",
				WorkloadTargets: `[{"kind":"Deployment","namespace":"test","name":"a"}]`,
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			targeted := recoveryDeployment("a", "a-id", 3)
			untargeted := recoveryDeployment("b", "b-id", 5)
			targeted.Labels = map[string]string{"app": "a"}
			untargeted.Labels = map[string]string{"app": "b"}
			clientset := recoveryClient(targeted, untargeted)
			snapshots := &memorySnapshots{}
			runner := newRecoveryRunner(clientset, snapshots)
			policy := store.Policy{
				ID:              1,
				Mode:            store.PolicyModeApply,
				NamespaceFilter: "test",
				ExceptionScope:  &tt.scope,
			}

			// Scoped sleep affects A and leaves B at its original replica count.
			if _, err := runner.RunPolicySleep(t.Context(), policy, 1, nil); err != nil {
				t.Fatalf("scoped sleep: %v", err)
			}
			assertDeploymentReplicas(t, clientset, "a", 0)
			assertDeploymentReplicas(t, clientset, "b", 5)
			if len(snapshots.snaps) != 1 {
				t.Fatalf("snapshot count = %d, want 1 targeted workload", len(snapshots.snaps))
			}

			// Simulate drift while sleeping. Reconciliation restores zero only for A.
			setDeploymentReplicas(t, clientset, "a", 3)
			if _, err := runner.RunPolicySleepReconcile(t.Context(), policy, 2, nil); err != nil {
				t.Fatalf("corrective scoped sleep: %v", err)
			}
			assertDeploymentReplicas(t, clientset, "a", 0)
			assertDeploymentReplicas(t, clientset, "b", 5)

			// B also has recovery data, but scoped wake must restore only A.
			setDeploymentReplicas(t, clientset, "b", 0)
			snapshots.snaps = append(snapshots.snaps, store.WorkloadSnapshot{
				ID:             2,
				PolicyID:       policy.ID,
				Kind:           "Deployment",
				Namespace:      "test",
				Name:           "b",
				WorkloadUID:    "b-id",
				ReplicasBefore: 5,
			})
			if _, err := runner.RunPolicyWake(t.Context(), policy, 3, nil); err != nil {
				t.Fatalf("scoped wake: %v", err)
			}
			assertDeploymentReplicas(t, clientset, "a", 3)
			assertDeploymentReplicas(t, clientset, "b", 0)
			if wakeID := snapshots.snaps[0].WakeExecutionID; wakeID == nil || *wakeID != 3 {
				t.Errorf("A's snapshot wake execution = %v, want 3", wakeID)
			}
			if snapshots.snaps[1].WakeExecutionID != nil {
				t.Error("scoped wake consumed B's excluded recovery intent")
			}

			// A's restored snapshot is closed; B's remaining intent is outside scope.
			setDeploymentReplicas(t, clientset, "b", 5)
			if _, err := runner.RunPolicySleepReconcile(t.Context(), policy, 4, nil); err != nil {
				t.Fatalf("reconcile after scoped wake: %v", err)
			}
			assertDeploymentReplicas(t, clientset, "a", 3)
			assertDeploymentReplicas(t, clientset, "b", 5)
		})
	}
}

// A full policy wake follows saved recovery data even if live labels have changed.
// Starting B at zero makes a skipped restore observable in the final replica count.
func TestOrdinaryWakeRestoresAfterLabelChanges(t *testing.T) {
	deployment := recoveryDeployment("b", "b-id", 0)
	deployment.Labels = map[string]string{"app": "b"}
	clientset := recoveryClient(deployment)
	snapshot := store.WorkloadSnapshot{
		ID:             1,
		PolicyID:       1,
		Kind:           "Deployment",
		Namespace:      "test",
		Name:           "b",
		WorkloadUID:    "b-id",
		ReplicasBefore: 5,
	}
	snapshots := &memorySnapshots{snaps: []store.WorkloadSnapshot{snapshot}}
	runner := newRecoveryRunner(clientset, snapshots)
	policy := store.Policy{
		ID:              1,
		Mode:            store.PolicyModeApply,
		NamespaceFilter: "test",
		LabelSelector:   "app=changed",
	}

	// Ordinary wake restores owned snapshots even when labels no longer match.
	if _, err := runner.RunPolicyWake(t.Context(), policy, 3, nil); err != nil {
		t.Fatalf("wake after label change: %v", err)
	}
	assertDeploymentReplicas(t, clientset, "b", 5)
}
