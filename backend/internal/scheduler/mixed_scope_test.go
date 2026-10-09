package scheduler

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/policy"
	"github.com/macxsimilian/kube-phoenix/backend/internal/scaler"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

// mixedRunner models wake effects in namespaces A and B without Kubernetes.
// Recorded policies expose whether the scheduler forwarded the exception scope.
type mixedRunner struct {
	mockRunner
	awake map[string]bool
	wakes []store.Policy
}

type activeExceptionStore struct {
	mockStore
	active []store.ScheduledException
}

func (s *activeExceptionStore) ListActiveExceptionsForPolicy(uint, time.Time) ([]store.ScheduledException, error) {
	return s.active, nil
}

// Restarting during an all-day sleep window must wake only the namespace covered
// by the active stay-awake exception, leaving the other namespace asleep.
func TestStartupRecoveryKeepsExceptionScoped(t *testing.T) {
	windows := []policy.SleepWindow{{
		DaysOfWeek: []int{0, 1, 2, 3, 4, 5, 6},
		AllDay:     true,
	}}
	encoded, err := json.Marshal(windows)
	if err != nil {
		t.Fatalf("encode sleep windows: %v", err)
	}
	policyRecord := store.Policy{
		ID:              1,
		Enabled:         true,
		Mode:            store.PolicyModeApply,
		Timezone:        "UTC",
		NamespaceFilter: "a,b",
		SleepWindows:    string(encoded),
		CurrentState:    store.PolicyStateSleeping,
	}
	exception := store.ScheduledException{
		ID:              1,
		PolicyID:        &policyRecord.ID,
		ExceptionType:   store.ExceptionTypeStayAwake,
		NamespaceFilter: "a",
		Status:          store.ExceptionStatusActive,
	}
	policyStore := &activeExceptionStore{
		mockStore: mockStore{policies: []store.Policy{policyRecord}},
		active:    []store.ScheduledException{exception},
	}
	runner := &mixedRunner{awake: map[string]bool{}}
	scheduler := newTestSchedulerWithRunner(policyStore, runner)
	scheduler.policies[1] = cachedPolicy{policy: policyRecord, windows: windows, loc: time.UTC}

	if err := scheduler.RecoverPolicies(t.Context()); err != nil {
		t.Fatalf("recover policies at startup: %v", err)
	}
	scheduler.inflight.Wait()
	if !runner.awake["a"] || runner.awake["b"] {
		t.Fatalf("startup broadened exception: awake=%v", runner.awake)
	}
}

func (runner *mixedRunner) RunPolicyWake(_ context.Context, policyRecord store.Policy, _ uint, _ chan<- scaler.LogLine) (*scaler.Counts, error) {
	runner.wakes = append(runner.wakes, policyRecord)
	for _, namespace := range []string{"a", "b"} {
		// Support the historical namespace override so this test also exposes
		// the original scheduler failure without depending on the new runner.
		if policyRecord.NamespaceFilter != "" && policyRecord.NamespaceFilter != "a,b" && policyRecord.NamespaceFilter != namespace {
			continue
		}
		allowed, err := policyRecord.AllowsExceptionTarget("Deployment", namespace, "app", nil)
		if err != nil {
			return nil, err
		}
		if allowed {
			runner.awake[namespace] = true
		}
	}
	return &scaler.Counts{Scaled: 1}, nil
}

// A's 06:00 exception overlaps the normal 07:00 wake for both namespaces. The
// exception must neither wake B early nor prevent B's scheduled wake at 07:00.
func TestScopedExceptionDoesNotSuppressScheduledWake(t *testing.T) {
	now := time.Date(2026, 10, 8, 6, 0, 0, 0, time.UTC)
	windows := []policy.SleepWindow{{
		DaysOfWeek: []int{0, 1, 2, 3, 4, 5, 6},
		StartTime:  "22:00",
		EndTime:    "07:00",
	}}
	encoded, err := json.Marshal(windows)
	if err != nil {
		t.Fatalf("encode sleep windows: %v", err)
	}
	policyRecord := store.Policy{
		ID:              1,
		Enabled:         true,
		Mode:            store.PolicyModeApply,
		Timezone:        "UTC",
		NamespaceFilter: "a,b",
		SleepWindows:    string(encoded),
		CurrentState:    store.PolicyStateSleeping,
	}
	policyStore := &mockStore{policies: []store.Policy{policyRecord}, openSnapshotCount: 2}
	runner := &mixedRunner{awake: map[string]bool{}}
	scheduler := newTestSchedulerWithRunner(policyStore, runner)
	scheduler.policies[1] = cachedPolicy{policy: policyRecord, windows: windows, loc: time.UTC}
	exception := store.ScheduledException{
		PolicyID:        &policyRecord.ID,
		ExceptionType:   store.ExceptionTypeStayAwake,
		NamespaceFilter: "a",
		StartsAt:        now,
		EndsAt:          now.Add(2 * time.Hour),
		Status:          store.ExceptionStatusActive,
	}

	if _, err := scheduler.runExceptionScoped(1, exception, directionWake, "exception_start"); err != nil {
		t.Fatal(err)
	}
	scheduler.inflight.Wait()
	if !runner.awake["a"] || runner.awake["b"] {
		t.Fatalf("06:00 awake=%v", runner.awake)
	}
	// Reconciliation at 06:10 keeps B asleep; the normal 07:00 wake restores B.
	ticks := []struct {
		name       string
		at         time.Time
		wantBAwake bool
	}{
		{name: "before scheduled wake", at: now.Add(10 * time.Minute), wantBAwake: false},
		{name: "at scheduled wake", at: now.Add(time.Hour), wantBAwake: true},
	}
	for _, tick := range ticks {
		scheduler.evaluatePolicy(scheduler.policies[1], evalContext{
			now:                 tick.at,
			autoWake:            true,
			reconcileWhileAwake: true,
			exceptionsByPolicy:  map[uint][]store.ScheduledException{1: {exception}},
		})
		scheduler.inflight.Wait()
		if got := runner.awake["b"]; got != tick.wantBAwake {
			t.Fatalf("%s: B awake = %v, want %v; wakes=%+v", tick.name, got, tick.wantBAwake, runner.wakes)
		}
	}
}
