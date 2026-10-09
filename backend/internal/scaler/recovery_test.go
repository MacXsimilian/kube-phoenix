package scaler

import (
	"context"
	"errors"
	"testing"

	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

// Scaling to zero removes the live replica baseline. If saving that baseline
// fails, sleep must leave the workload untouched so a later wake remains possible.
func TestSleepPersistsBeforeMutation(t *testing.T) {
	snapshots := &memorySnapshots{createErr: errors.New("database unavailable")}
	runner := &PolicyRunner{store: snapshots}
	mutated := false
	workload := workloadEntry{
		Kind:      "Deployment",
		Namespace: "test",
		Name:      "a",
		Replicas:  3,
		Scale: func(context.Context, string, string, int32) error {
			mutated = true
			return nil
		},
	}
	params := sleepWorkloadParams{
		ctx:    t.Context(),
		policy: store.Policy{ID: 1, Mode: store.PolicyModeApply},
		counts: &Counts{},
	}

	scaled, _, failed := runner.sleepWorkload(params, workload)

	if mutated {
		t.Error("workload was mutated despite failed snapshot persistence")
	}
	if scaled {
		t.Error("workload was reported as scaled despite failed snapshot persistence")
	}
	if !failed {
		t.Error("snapshot persistence failure should fail the sleep operation")
	}
}

// A failed Kubernetes update must leave its saved intent available for retry.
// The snapshot retains the replica count observed before the failed sleep.
func TestSleepScaleFailureRetainsIntent(t *testing.T) {
	snapshots := &memorySnapshots{}
	runner := &PolicyRunner{store: snapshots}
	workload := workloadEntry{
		Kind:      "Deployment",
		Namespace: "test",
		Name:      "a",
		Replicas:  3,
		Scale: func(context.Context, string, string, int32) error {
			return errors.New("scale failed")
		},
	}
	params := sleepWorkloadParams{
		ctx:    t.Context(),
		policy: store.Policy{ID: 1, Mode: store.PolicyModeApply},
		counts: &Counts{},
	}

	_, _, failed := runner.sleepWorkload(params, workload)

	if !failed {
		t.Error("scale failure should fail the sleep operation")
	}
	if len(snapshots.snaps) != 1 {
		t.Fatalf("snapshot count = %d, want 1 retained recovery intent", len(snapshots.snaps))
	}
	if got := snapshots.snaps[0].ReplicasBefore; got != 3 {
		t.Errorf("saved replica baseline = %d, want 3", got)
	}
}

// A process can stop before or after scaling, with the same prepared snapshot.
// Retrying either state must reuse the original baseline instead of replacing it.
func TestSleepRestartPreservesBaseline(t *testing.T) {
	tests := []struct {
		name           string
		liveReplicas   int32
		wantScaleCalls int
	}{
		{name: "restart after scaling to zero", liveReplicas: 0, wantScaleCalls: 0},
		{name: "restart before scaling to zero", liveReplicas: 3, wantScaleCalls: 1},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			snapshot := store.WorkloadSnapshot{
				ID:             1,
				PolicyID:       1,
				Kind:           "Deployment",
				Namespace:      "test",
				Name:           "a",
				ReplicasBefore: 3,
				WorkloadUID:    "original",
				Phase:          "prepared",
			}
			snapshots := &memorySnapshots{snaps: []store.WorkloadSnapshot{snapshot}}
			runner := &PolicyRunner{store: snapshots}
			scaleCalls := 0
			workload := workloadEntry{
				Kind:      "Deployment",
				Namespace: "test",
				Name:      "a",
				UID:       "original",
				Replicas:  tt.liveReplicas,
				Scale: func(context.Context, string, string, int32) error {
					scaleCalls++
					return nil
				},
			}
			params := sleepWorkloadParams{
				ctx:     t.Context(),
				policy:  store.Policy{ID: 1, Mode: store.PolicyModeApply},
				counts:  &Counts{},
				snapped: map[string]store.WorkloadSnapshot{workloadKey(workload.Kind, workload.Namespace, workload.Name): snapshot},
			}

			_, _, failed := runner.sleepWorkload(params, workload)

			if failed {
				t.Fatal("sleep retry failed")
			}
			if len(snapshots.snaps) != 1 {
				t.Fatalf("snapshot count = %d, want 1 original recovery intent", len(snapshots.snaps))
			}
			if got := snapshots.snaps[0].ReplicasBefore; got != 3 {
				t.Errorf("saved replica baseline = %d, want 3", got)
			}
			if got := snapshots.snaps[0].Phase; got != "applied" {
				t.Errorf("snapshot phase = %q, want applied after retry", got)
			}
			if scaleCalls != tt.wantScaleCalls {
				t.Errorf("scale calls = %d, want %d", scaleCalls, tt.wantScaleCalls)
			}
		})
	}
}

// Kubernetes may accept the scale while the database fails to record completion.
// Keep the recovery intent and report failure rather than claiming sleep completed.
func TestSleepAppliedWriteFailureIsIncomplete(t *testing.T) {
	snapshots := &memorySnapshots{appliedErr: errors.New("database unavailable")}
	runner := &PolicyRunner{store: snapshots}
	workload := workloadEntry{
		Kind:      "Deployment",
		Namespace: "test",
		Name:      "a",
		Replicas:  3,
		Scale:     func(context.Context, string, string, int32) error { return nil },
	}
	params := sleepWorkloadParams{
		ctx:    t.Context(),
		policy: store.Policy{ID: 1, Mode: store.PolicyModeApply},
		counts: &Counts{},
	}

	scaled, _, failed := runner.sleepWorkload(params, workload)

	if scaled {
		t.Error("sleep was reported as complete despite failed snapshot bookkeeping")
	}
	if !failed {
		t.Error("snapshot bookkeeping failure should fail the sleep operation")
	}
	if len(snapshots.snaps) != 1 {
		t.Errorf("snapshot count = %d, want 1 retained recovery intent", len(snapshots.snaps))
	}
}
