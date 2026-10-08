package scaler

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

type memorySnapshots struct {
	snaps      []store.WorkloadSnapshot
	createErr  error
	appliedErr error
	closeErr   error
}

func (m *memorySnapshots) GetGuardrails() (*store.Guardrails, error) {
	return &store.Guardrails{ScalingConcurrency: 1}, nil
}
func (m *memorySnapshots) GetOpenSnapshots(uint) ([]store.WorkloadSnapshot, error) {
	return m.snaps, nil
}
func (m *memorySnapshots) GetOpenSnapshotsForSleepReconcile(uint) ([]store.WorkloadSnapshot, error) {
	return m.snaps, nil
}
func (m *memorySnapshots) CreateWorkloadSnapshot(s *store.WorkloadSnapshot) error {
	if m.createErr != nil {
		return m.createErr
	}
	s.ID = uint(len(m.snaps) + 1)
	m.snaps = append(m.snaps, *s)
	return nil
}
func (m *memorySnapshots) MarkSnapshotApplied(uint) error             { return m.appliedErr }
func (m *memorySnapshots) CloseSnapshot(uint, uint, int32) error      { return m.closeErr }
func (m *memorySnapshots) MarkSnapshotDeletedAtWake(uint, uint) error { return nil }
func (m *memorySnapshots) MarkSnapshotExternallyScaled(uint) error    { return nil }
func (m *memorySnapshots) ListActiveExceptionsForPolicy(uint, time.Time) ([]store.ScheduledException, error) {
	return nil, nil
}

func TestSleepPersistsBeforeMutation(t *testing.T) {
	st := &memorySnapshots{createErr: errors.New("database unavailable")}
	r := &PolicyRunner{store: st}
	mutated := false
	e := workloadEntry{Kind: "Deployment", Namespace: "test", Name: "a", Replicas: 3,
		Scale: func(context.Context, string, string, int32) error { mutated = true; return nil }}
	p := sleepWorkloadParams{ctx: context.Background(), policy: store.Policy{ID: 1, Mode: "apply"}, counts: &Counts{}}
	scaled, _, failed := r.sleepWorkload(p, e)
	if mutated || scaled || !failed {
		t.Fatalf("mutated=%v scaled=%v failed=%v", mutated, scaled, failed)
	}
}

func TestSleepScaleFailureRetainsIntent(t *testing.T) {
	st := &memorySnapshots{}
	r := &PolicyRunner{store: st}
	e := workloadEntry{Kind: "Deployment", Namespace: "test", Name: "a", Replicas: 3,
		Scale: func(context.Context, string, string, int32) error { return errors.New("scale failed") }}
	p := sleepWorkloadParams{ctx: context.Background(), policy: store.Policy{ID: 1, Mode: "apply"}, counts: &Counts{}}
	_, _, failed := r.sleepWorkload(p, e)
	if !failed || len(st.snaps) != 1 || st.snaps[0].ReplicasBefore != 3 {
		t.Fatalf("failed=%v snapshots=%+v", failed, st.snaps)
	}
}

func TestSleepRestartPreservesBaseline(t *testing.T) {
	for _, replicas := range []int32{0, 3} {
		t.Run(string(rune('0'+replicas)), func(t *testing.T) {
			st := &memorySnapshots{snaps: []store.WorkloadSnapshot{{ID: 1, Kind: "Deployment", Namespace: "test", Name: "a", ReplicasBefore: 3, WorkloadUID: "original", Phase: "prepared"}}}
			r := &PolicyRunner{store: st}
			calls := 0
			e := workloadEntry{Kind: "Deployment", Namespace: "test", Name: "a", UID: "original", Replicas: replicas,
				Scale: func(context.Context, string, string, int32) error { calls++; return nil }}
			p := sleepWorkloadParams{ctx: context.Background(), policy: store.Policy{ID: 1, Mode: "apply"}, counts: &Counts{}, snapped: map[string]store.WorkloadSnapshot{workloadKey(e.Kind, e.Namespace, e.Name): st.snaps[0]}}
			_, _, failed := r.sleepWorkload(p, e)
			if failed || len(st.snaps) != 1 || st.snaps[0].ReplicasBefore != 3 {
				t.Fatalf("failed=%v snapshots=%+v", failed, st.snaps)
			}
			if (replicas == 0 && calls != 0) || (replicas > 0 && calls != 1) {
				t.Fatalf("calls=%d replicas=%d", calls, replicas)
			}
		})
	}
}

func TestSleepAppliedWriteFailureIsIncomplete(t *testing.T) {
	st := &memorySnapshots{appliedErr: errors.New("database unavailable")}
	r := &PolicyRunner{store: st}
	e := workloadEntry{Kind: "Deployment", Namespace: "test", Name: "a", Replicas: 3,
		Scale: func(context.Context, string, string, int32) error { return nil }}
	p := sleepWorkloadParams{ctx: context.Background(), policy: store.Policy{ID: 1, Mode: "apply"}, counts: &Counts{}}
	scaled, _, failed := r.sleepWorkload(p, e)
	if scaled || !failed || len(st.snaps) != 1 {
		t.Fatalf("scaled=%v failed=%v snapshots=%+v", scaled, failed, st.snaps)
	}
}
