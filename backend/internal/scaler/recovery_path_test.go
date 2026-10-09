package scaler

import (
	"errors"
	"testing"

	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	autoscalingv1 "k8s.io/api/autoscaling/v1"
	"k8s.io/apimachinery/pkg/runtime"
	ktesting "k8s.io/client-go/testing"
)

// Exercise sleep, restart, retry, and wake together using the production runner
// with fake Kubernetes. A failure for B must preserve both replica baselines.
func TestPartialSleepRetriesAndWakeRestores(t *testing.T) {
	clientset := recoveryClient(
		recoveryDeployment("a", "a-id", 3),
		recoveryDeployment("b", "b-id", 5),
	)
	failScaleB := true
	clientset.PrependReactor("update", "deployments", func(action ktesting.Action) (bool, runtime.Object, error) {
		if action.GetSubresource() != "scale" {
			return false, nil, nil
		}
		scale := action.(ktesting.UpdateAction).GetObject().(*autoscalingv1.Scale)
		if failScaleB && scale.Name == "b" {
			return true, nil, errors.New("injected scale failure")
		}
		return false, nil, nil
	})
	snapshots := &memorySnapshots{}
	runner := newRecoveryRunner(clientset, snapshots)
	policy := store.Policy{ID: 1, Mode: store.PolicyModeApply}

	// The first sleep succeeds for A and retains B's failed recovery intent.
	counts, err := runner.RunPolicySleep(t.Context(), policy, 1, nil)
	if err == nil {
		t.Fatal("sleep should fail when B cannot be scaled")
	}
	if counts == nil {
		t.Fatal("partial sleep should return operation counts")
	}
	if counts.Scaled != 1 || counts.Errors != 1 {
		t.Errorf("sleep counts = %+v, want 1 scaled and 1 error", counts)
	}
	if len(snapshots.snaps) != 2 {
		t.Fatalf("snapshot count = %d, want 2 retained recovery intents", len(snapshots.snaps))
	}
	for _, action := range clientset.Actions() {
		if action.GetResource().Resource == "nodes" {
			t.Fatal("node phase ran after a partial sleep failure")
		}
	}

	// Reconstruct the runner to retry from durable state after a process restart.
	failScaleB = false
	runner = newRecoveryRunner(clientset, snapshots)
	if _, err := runner.RunPolicySleep(t.Context(), policy, 2, nil); err != nil {
		t.Fatalf("retry sleep: %v", err)
	}
	if len(snapshots.snaps) != 2 {
		t.Fatalf("retry snapshot count = %d, want 2 original baselines", len(snapshots.snaps))
	}

	if _, err := runner.RunPolicyWake(t.Context(), policy, 3, nil); err != nil {
		t.Fatalf("wake after retry: %v", err)
	}
	assertDeploymentReplicas(t, clientset, "a", 3)
	assertDeploymentReplicas(t, clientset, "b", 5)
	// Restored rows must be consumed so a later wake cannot replay them.
	for _, snapshot := range snapshots.snaps {
		if snapshot.WakeExecutionID == nil || *snapshot.WakeExecutionID != 3 {
			t.Errorf("snapshot %s wake execution = %v, want 3", snapshot.Name, snapshot.WakeExecutionID)
		}
		if snapshot.ReplicasRestored == nil || *snapshot.ReplicasRestored != snapshot.ReplicasBefore {
			t.Errorf("snapshot %s restored replicas = %v, want %d", snapshot.Name, snapshot.ReplicasRestored, snapshot.ReplicasBefore)
		}
		if snapshot.Phase != "restored" {
			t.Errorf("snapshot %s phase = %q, want restored", snapshot.Name, snapshot.Phase)
		}
	}
	open, err := snapshots.GetOpenSnapshots(policy.ID)
	if err != nil {
		t.Fatalf("get remaining recovery intents: %v", err)
	}
	if len(open) != 0 {
		t.Errorf("open snapshot count after wake = %d, want 0", len(open))
	}
}

// Recovery identifies workloads by kind, namespace, and name. Legacy snapshots
// and same-name replacements must restore even when their recorded UIDs differ.
func TestWakeRestoresByNameIncludingLegacyAndReplacement(t *testing.T) {
	tests := []struct {
		name        string
		snapshotUID string
	}{
		{name: "legacy snapshot without UID", snapshotUID: ""},
		{name: "replacement workload with different UID", snapshotUID: "old-id"},
		{name: "original workload with matching UID", snapshotUID: "live-id"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			clientset := recoveryClient(recoveryDeployment("a", "live-id", 0))
			snapshot := store.WorkloadSnapshot{
				ID:             1,
				PolicyID:       1,
				Kind:           "Deployment",
				Namespace:      "test",
				Name:           "a",
				WorkloadUID:    tt.snapshotUID,
				ReplicasBefore: 3,
				Phase:          "prepared",
			}
			snapshots := &memorySnapshots{snaps: []store.WorkloadSnapshot{snapshot}}
			runner := newRecoveryRunner(clientset, snapshots)
			policy := store.Policy{ID: 1, Mode: store.PolicyModeApply}

			if _, err := runner.RunPolicyWake(t.Context(), policy, 2, nil); err != nil {
				t.Fatalf("wake workload: %v", err)
			}
			assertDeploymentReplicas(t, clientset, "a", 3)
		})
	}
}

// Kubernetes can restore replicas before the database records completion.
// Retrying must close the retained intent without issuing another scale update.
func TestWakeCompletionFailureRetainsIntent(t *testing.T) {
	clientset := recoveryClient(recoveryDeployment("a", "a-id", 0))
	snapshots := &memorySnapshots{
		snaps: []store.WorkloadSnapshot{{
			ID:             1,
			PolicyID:       1,
			Kind:           "Deployment",
			Namespace:      "test",
			Name:           "a",
			WorkloadUID:    "a-id",
			ReplicasBefore: 3,
			Phase:          "applied",
		}},
		closeErr: errors.New("database unavailable"),
	}
	policy := store.Policy{ID: 1, Mode: store.PolicyModeApply}
	runner := newRecoveryRunner(clientset, snapshots)

	if _, err := runner.RunPolicyWake(t.Context(), policy, 2, nil); err == nil {
		t.Fatal("wake should fail when completion cannot be saved")
	}
	assertDeploymentReplicas(t, clientset, "a", 3)
	if snapshots.snaps[0].WakeExecutionID != nil || snapshots.snaps[0].Phase != "applied" {
		t.Fatal("failed completion consumed the recovery intent")
	}
	open, err := snapshots.GetOpenSnapshots(policy.ID)
	if err != nil {
		t.Fatalf("get retained recovery intent: %v", err)
	}
	if len(open) != 1 {
		t.Fatalf("open snapshot count after failed completion = %d, want 1", len(open))
	}

	// A new runner discovers that replicas are already restored and finishes bookkeeping.
	snapshots.closeErr = nil
	runner = newRecoveryRunner(clientset, snapshots)
	if _, err := runner.RunPolicyWake(t.Context(), policy, 3, nil); err != nil {
		t.Fatalf("retry wake completion: %v", err)
	}
	if wakeID := snapshots.snaps[0].WakeExecutionID; wakeID == nil || *wakeID != 3 {
		t.Errorf("snapshot wake execution = %v, want 3", wakeID)
	}
	if got := snapshots.snaps[0].Phase; got != "restored" {
		t.Errorf("snapshot phase = %q, want restored", got)
	}
	open, err = snapshots.GetOpenSnapshots(policy.ID)
	if err != nil {
		t.Fatalf("get remaining recovery intents: %v", err)
	}
	if len(open) != 0 {
		t.Errorf("open snapshot count after retry = %d, want 0", len(open))
	}
	scaleUpdates := 0
	for _, action := range clientset.Actions() {
		if action.GetVerb() == "update" && action.GetSubresource() == "scale" {
			scaleUpdates++
		}
	}
	if scaleUpdates != 1 {
		t.Errorf("scale update count = %d, want 1 across wake and retry", scaleUpdates)
	}
}
