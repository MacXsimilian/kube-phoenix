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

type mixedRunner struct {
	mockRunner
	awake map[string]bool
	wakes []store.Policy
}

func (r *mixedRunner) RunPolicyWake(_ context.Context, p store.Policy, _ uint, _ chan<- scaler.LogLine) (*scaler.Counts, error) {
	r.wakes = append(r.wakes, p)
	for _, ns := range []string{"a", "b"} {
		// Support the historical namespace override so this test also exposes
		// the original scheduler failure without depending on the new runner.
		if p.NamespaceFilter != "" && p.NamespaceFilter != "a,b" && p.NamespaceFilter != ns {
			continue
		}
		allowed, err := p.AllowsExceptionTarget("Deployment", ns, "app", nil)
		if err != nil {
			return nil, err
		}
		if allowed {
			r.awake[ns] = true
		}
	}
	return &scaler.Counts{Scaled: 1}, nil
}

func TestScopedExceptionDoesNotSuppressScheduledWake(t *testing.T) {
	now := time.Date(2026, 10, 8, 6, 0, 0, 0, time.UTC)
	windows := []policy.SleepWindow{{DaysOfWeek: []int{0, 1, 2, 3, 4, 5, 6}, StartTime: "22:00", EndTime: "07:00"}}
	encoded, _ := json.Marshal(windows)
	p := store.Policy{ID: 1, Enabled: true, Mode: "apply", Timezone: "UTC", NamespaceFilter: "a,b", SleepWindows: string(encoded), CurrentState: store.PolicyStateSleeping}
	st := &mockStore{policies: []store.Policy{p}, openSnapshotCount: 2}
	r := &mixedRunner{awake: map[string]bool{}}
	ps := newTestSchedulerWithRunner(st, r)
	ps.policies[1] = cachedPolicy{policy: p, windows: windows, loc: time.UTC}
	ex := store.ScheduledException{PolicyID: &p.ID, ExceptionType: store.ExceptionTypeStayAwake, NamespaceFilter: "a", StartsAt: now, EndsAt: now.Add(2 * time.Hour), Status: store.ExceptionStatusActive}
	if _, err := ps.runExceptionScoped(1, ex, directionWake, "exception_start"); err != nil {
		t.Fatal(err)
	}
	ps.inflight.Wait()
	if !r.awake["a"] || r.awake["b"] {
		t.Fatalf("06:00 awake=%v", r.awake)
	}
	// Exercise real reconciliation before and after the schedule boundary.
	for _, tick := range []time.Time{now.Add(10 * time.Minute), now.Add(time.Hour)} {
		ps.evaluatePolicy(ps.policies[1], evalContext{now: tick, autoWake: true, reconcileWhileAwake: true, exceptionsByPolicy: map[uint][]store.ScheduledException{1: {ex}}})
		ps.inflight.Wait()
	}
	if !r.awake["b"] {
		t.Fatalf("07:00 B remained asleep; wakes=%+v", r.wakes)
	}
}
