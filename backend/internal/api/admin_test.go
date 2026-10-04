// SPDX-License-Identifier: Apache-2.0

package api

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type emergencyExecutionResult struct {
	status string
	counts map[string]int
}

type emergencyStoreStub struct {
	nextID       uint
	open         map[uint]bool
	created      map[uint][]store.PolicyExecution
	finished     map[uint]emergencyExecutionResult
	states       map[uint]string
	closed       map[uint]int32
	deleted      map[uint]bool
	createErrors map[uint]error
	closeErrors  map[uint]error
	deleteErrors map[uint]error
	stateErrors  map[uint]error
	finishErrors map[uint]error
}

func newEmergencyStoreStub(snapshots []store.WorkloadSnapshot) *emergencyStoreStub {
	s := &emergencyStoreStub{
		open: make(map[uint]bool), created: make(map[uint][]store.PolicyExecution),
		finished: make(map[uint]emergencyExecutionResult), states: make(map[uint]string),
		closed: make(map[uint]int32), deleted: make(map[uint]bool),
		createErrors: make(map[uint]error), closeErrors: make(map[uint]error),
		deleteErrors: make(map[uint]error), stateErrors: make(map[uint]error),
		finishErrors: make(map[uint]error),
	}
	for _, snap := range snapshots {
		s.open[snap.ID] = true
	}
	return s
}

func (s *emergencyStoreStub) CreatePolicyExecution(exec *store.PolicyExecution) error {
	s.created[exec.PolicyID] = append(s.created[exec.PolicyID], *exec)
	if err := s.createErrors[exec.PolicyID]; err != nil {
		return err
	}
	s.nextID++
	exec.ID = s.nextID
	return nil
}

func (s *emergencyStoreStub) FinishPolicyExecution(id uint, status string, counts map[string]int) error {
	if err := s.finishErrors[id]; err != nil {
		return err
	}
	s.finished[id] = emergencyExecutionResult{status, counts}
	return nil
}

func (s *emergencyStoreStub) UpdatePolicyState(id uint, state string, _ *time.Time) error {
	if err := s.stateErrors[id]; err != nil {
		return err
	}
	s.states[id] = state
	return nil
}

func (s *emergencyStoreStub) CloseSnapshot(id uint, _ uint, replicas int32) error {
	if err := s.closeErrors[id]; err != nil {
		return err
	}
	s.open[id] = false
	s.closed[id] = replicas
	return nil
}

func (s *emergencyStoreStub) MarkSnapshotDeletedAtWake(id uint, _ uint) error {
	if err := s.deleteErrors[id]; err != nil {
		return err
	}
	s.open[id] = false
	s.deleted[id] = true
	return nil
}

type emergencyScaleCall struct {
	kind, namespace, name string
	replicas              int32
}

type emergencyScalerStub struct {
	errors map[string]error
	calls  []emergencyScaleCall
}

func (s *emergencyScalerStub) scale(kind, namespace, name string, replicas int32) error {
	s.calls = append(s.calls, emergencyScaleCall{kind, namespace, name, replicas})
	return s.errors[name]
}

func (s *emergencyScalerStub) ScaleDeployment(_ context.Context, namespace, name string, replicas int32) error {
	return s.scale("Deployment", namespace, name, replicas)
}

func (s *emergencyScalerStub) ScaleStatefulSet(_ context.Context, namespace, name string, replicas int32) error {
	return s.scale("StatefulSet", namespace, name, replicas)
}

func ignoreEmergencyProgress(_, _ string) {}

func emergencySnapshot(id, policyID uint, kind, name string) store.WorkloadSnapshot {
	return store.WorkloadSnapshot{ID: id, PolicyID: policyID, Kind: kind, Namespace: "team", Name: name, ReplicasBefore: 7}
}

func TestEmergencyScaleSnapshotsRetainsRetryableErrors(t *testing.T) {
	resource := schema.GroupResource{Group: "apps", Resource: "deployments"}
	for name, scaleErr := range map[string]error{
		"timeout":     apierrors.NewTimeoutError("API unavailable", 1),
		"forbidden":   apierrors.NewForbidden(resource, "app", errors.New("not permitted")),
		"conflict":    apierrors.NewConflict(resource, "app", errors.New("stale version")),
		"cancelled":   context.Canceled,
		"deadline":    context.DeadlineExceeded,
		"plain error": errors.New("connection refused"),
		"unsupported": nil,
	} {
		t.Run(name, func(t *testing.T) {
			kind := "Deployment"
			if name == "unsupported" {
				kind = "Job"
			}
			snapshots := []store.WorkloadSnapshot{emergencySnapshot(1, 10, kind, "app")}
			st := newEmergencyStoreStub(snapshots)
			client := &emergencyScalerStub{errors: map[string]error{"app": scaleErr}}
			got := emergencyScaleSnapshots(context.Background(), st, client, snapshots, ignoreEmergencyProgress)
			if got != (emergencyScaleCounts{failed: 1}) {
				t.Fatalf("result = %+v, want one failure", got)
			}
			if !st.open[1] || len(st.deleted) != 0 || len(st.closed) != 0 {
				t.Fatalf("failed workload lost retryable snapshot: open=%v deleted=%v closed=%v", st.open, st.deleted, st.closed)
			}
			want := emergencyExecutionResult{store.ExecStatusFailed, map[string]int{"scaled": 0, "skipped": 0, "errors": 1}}
			if !reflect.DeepEqual(st.finished[1], want) || st.states[10] != store.PolicyStateUnknown {
				t.Errorf("execution=%+v state=%q, want failed/unknown", st.finished[1], st.states[10])
			}
		})
	}
}

func TestEmergencyScaleSnapshotsTracksEachPolicySeparately(t *testing.T) {
	snapshots := []store.WorkloadSnapshot{
		emergencySnapshot(1, 10, "Deployment", "healthy"),
		emergencySnapshot(2, 10, "StatefulSet", "gone"),
		emergencySnapshot(3, 20, "Deployment", "timeout"),
		emergencySnapshot(4, 30, "StatefulSet", "partial-success"),
		emergencySnapshot(5, 30, "Deployment", "forbidden"),
	}
	st := newEmergencyStoreStub(snapshots)
	client := &emergencyScalerStub{errors: map[string]error{
		"gone":      fmt.Errorf("scale: %w", apierrors.NewNotFound(schema.GroupResource{Group: "apps", Resource: "statefulsets"}, "gone")),
		"timeout":   apierrors.NewTimeoutError("API unavailable", 1),
		"forbidden": apierrors.NewForbidden(schema.GroupResource{Group: "apps", Resource: "deployments"}, "forbidden", errors.New("not permitted")),
	}}
	got := emergencyScaleSnapshots(context.Background(), st, client, snapshots, ignoreEmergencyProgress)
	if got != (emergencyScaleCounts{scaled: 2, skipped: 1, failed: 2}) {
		t.Fatalf("result = %+v, want two scaled, one missing, two failed", got)
	}
	wantFinished := map[uint]emergencyExecutionResult{
		1: {store.ExecStatusSuccess, map[string]int{"scaled": 1, "skipped": 1, "errors": 0}},
		2: {store.ExecStatusFailed, map[string]int{"scaled": 0, "skipped": 0, "errors": 1}},
		3: {store.ExecStatusFailed, map[string]int{"scaled": 1, "skipped": 0, "errors": 1}},
	}
	if !reflect.DeepEqual(st.finished, wantFinished) {
		t.Errorf("finished executions = %+v, want %+v", st.finished, wantFinished)
	}
	wantStates := map[uint]string{10: store.PolicyStateAwake, 20: store.PolicyStateUnknown, 30: store.PolicyStateUnknown}
	if !reflect.DeepEqual(st.states, wantStates) {
		t.Errorf("policy states = %v, want %v", st.states, wantStates)
	}
	if !reflect.DeepEqual(st.open, map[uint]bool{1: false, 2: false, 3: true, 4: false, 5: true}) {
		t.Errorf("snapshot ownership = %v", st.open)
	}
	if !reflect.DeepEqual(st.deleted, map[uint]bool{2: true}) {
		t.Errorf("deleted snapshots = %v, want only the missing StatefulSet", st.deleted)
	}
	for _, call := range client.calls {
		if call.replicas != 1 {
			t.Errorf("emergency target = %d, want intentional minimum of one", call.replicas)
		}
	}
}

func TestEmergencyScaleSnapshotsRecordsPersistenceFailures(t *testing.T) {
	for _, name := range []string{"create", "close", "delete", "state", "finish"} {
		t.Run(name, func(t *testing.T) {
			snapshots := []store.WorkloadSnapshot{emergencySnapshot(1, 10, "Deployment", "app")}
			st := newEmergencyStoreStub(snapshots)
			client := &emergencyScalerStub{errors: make(map[string]error)}
			dbErr := errors.New("database unavailable")
			switch name {
			case "create":
				st.createErrors[10] = dbErr
			case "close":
				st.closeErrors[1] = dbErr
			case "delete":
				st.deleteErrors[1] = dbErr
				client.errors["app"] = apierrors.NewNotFound(schema.GroupResource{Group: "apps", Resource: "deployments"}, "app")
			case "state":
				st.stateErrors[10] = dbErr
			case "finish":
				st.finishErrors[1] = dbErr
			}
			var progress []string
			got := emergencyScaleSnapshots(context.Background(), st, client, snapshots, func(_, msg string) { progress = append(progress, msg) })
			if got.failed != 1 {
				t.Fatalf("result = %+v, want persistence error", got)
			}
			if name == "create" || name == "close" || name == "delete" {
				if !st.open[1] {
					t.Fatal("snapshot closed despite failed recovery bookkeeping")
				}
			}
			if name == "create" && len(client.calls) != 0 {
				t.Fatal("scaled a workload without an emergency execution record")
			}
			if name != "finish" && name != "create" && st.finished[1].status != store.ExecStatusFailed {
				t.Fatalf("persistence failure execution = %+v, want failed", st.finished[1])
			}
			if len(progress) == 0 || !strings.Contains(progress[len(progress)-1], "1 errors") {
				t.Errorf("missing failure summary: %v", progress)
			}
		})
	}
}

func TestEmergencyScaleSnapshotsCreatesOneExecutionPerPolicy(t *testing.T) {
	snapshots := []store.WorkloadSnapshot{
		emergencySnapshot(1, 10, "Deployment", "one"),
		emergencySnapshot(2, 10, "StatefulSet", "two"),
	}
	st := newEmergencyStoreStub(snapshots)
	st.createErrors[10] = errors.New("cannot create execution")
	client := &emergencyScalerStub{}
	got := emergencyScaleSnapshots(context.Background(), st, client, snapshots, ignoreEmergencyProgress)
	if got.failed != 2 || len(st.created[10]) != 1 || len(client.calls) != 0 {
		t.Fatalf("result=%+v creations=%d scales=%d, want one failed creation and no mutations", got, len(st.created[10]), len(client.calls))
	}
}

func TestEmergencyScaleSnapshotsCanRetryFailedRestore(t *testing.T) {
	snapshots := []store.WorkloadSnapshot{emergencySnapshot(1, 10, "Deployment", "app")}
	st := newEmergencyStoreStub(snapshots)
	client := &emergencyScalerStub{errors: map[string]error{"app": context.DeadlineExceeded}}
	first := emergencyScaleSnapshots(context.Background(), st, client, snapshots, ignoreEmergencyProgress)
	if first.failed != 1 || !st.open[1] {
		t.Fatalf("first attempt = %+v, snapshot open = %v", first, st.open[1])
	}

	delete(client.errors, "app")
	second := emergencyScaleSnapshots(context.Background(), st, client, snapshots, ignoreEmergencyProgress)
	if second != (emergencyScaleCounts{scaled: 1}) || st.open[1] {
		t.Fatalf("retry = %+v, snapshot open = %v", second, st.open[1])
	}
	if st.finished[2].status != store.ExecStatusSuccess || st.states[10] != store.PolicyStateAwake {
		t.Fatalf("retry execution = %+v, state = %q", st.finished[2], st.states[10])
	}
	if snapshots[0].ReplicasBefore != 7 || st.closed[1] != 1 {
		t.Fatalf("baseline = %d, restored = %d; emergency must retain its original baseline and target one", snapshots[0].ReplicasBefore, st.closed[1])
	}
}
