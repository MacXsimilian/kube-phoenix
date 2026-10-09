package scheduler

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/scaler"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

type partialRunner struct{ mockRunner }

func (*partialRunner) RunPolicySleep(context.Context, store.Policy, uint, chan<- scaler.LogLine) (*scaler.Counts, error) {
	return &scaler.Counts{Scaled: 1, Errors: 1}, errors.New("one target failed")
}

type finalizationStore struct {
	mockStore
	status string
	counts map[string]int
}

func (s *finalizationStore) FinishPolicyExecution(_ uint, status string, counts map[string]int) error {
	s.status = status
	s.counts = counts
	return nil
}

// One successful target cannot make a partial sleep successful overall. Keep the
// outcome unknown and allow retry after backoff because some workloads remain awake.
func TestPartialExecutionIsFailedAndEligibleForRetry(t *testing.T) {
	executionStore := &finalizationStore{}
	scheduler := newTestSchedulerWithRunner(executionStore, &partialRunner{})
	policyRecord := store.Policy{
		ID:           1,
		Mode:         store.PolicyModeApply,
		CurrentState: store.PolicyStateAwake,
	}
	scheduler.policies[1] = cachedPolicy{policy: policyRecord}

	scheduler.executeAndFinalize(context.Background(), policyRecord, directionSleep, "scheduled", 1, time.Now())

	if executionStore.status != store.ExecStatusFailed {
		t.Errorf("execution status = %q, want %q", executionStore.status, store.ExecStatusFailed)
	}
	if got := executionStore.counts["errors"]; got != 1 {
		t.Errorf("failed workload count = %d, want 1", got)
	}
	if got := executionStore.counts["scaled"]; got != 1 {
		t.Errorf("scaled workload count = %d, want 1", got)
	}
	if scheduler.policies[1].policy.CurrentState != store.PolicyStateUnknown {
		t.Fatal("partial execution recorded as sleeping")
	}
	// Check from the recorded failure time so the boundary does not depend on how
	// much real time elapses between finalization and these assertions.
	scheduler.mu.Lock()
	failedAt, recorded := scheduler.lastFailedTransition[policyRecord.ID]
	scheduler.mu.Unlock()
	if !recorded {
		t.Fatal("failed execution did not record a retry backoff")
	}
	retryChecks := []struct {
		name        string
		sinceFailed time.Duration
		wantRetry   bool
	}{
		{name: "immediately after failure", sinceFailed: 0, wantRetry: false},
		{name: "just before backoff expires", sinceFailed: reconcileBackoff - time.Nanosecond, wantRetry: false},
		{name: "at backoff expiry", sinceFailed: reconcileBackoff, wantRetry: true},
	}
	for _, check := range retryChecks {
		t.Run(check.name, func(t *testing.T) {
			got := scheduler.failedTransitionBackoffElapsed(policyRecord.ID, failedAt.Add(check.sinceFailed))
			if got != check.wantRetry {
				t.Errorf("retry eligible = %v, want %v", got, check.wantRetry)
			}
		})
	}
}

// A policy's sleeping baseline does not prove that an exception's targeted work
// completed. A failed exception-end sleep must leave the state unknown for retry.
func TestFailedScopedCompletionRemainsRetryable(t *testing.T) {
	executionStore := &finalizationStore{}
	scheduler := newTestSchedulerWithRunner(executionStore, &partialRunner{})
	policyRecord := store.Policy{
		ID:             1,
		Mode:           store.PolicyModeApply,
		CurrentState:   store.PolicyStateSleeping,
		ExceptionScope: &store.ScheduledException{NamespaceFilter: "a"},
	}
	scheduler.policies[1] = cachedPolicy{policy: policyRecord}

	scheduler.executeAndFinalize(context.Background(), policyRecord, directionSleep, "exception_end", 1, time.Now())

	if executionStore.status != store.ExecStatusFailed {
		t.Errorf("exception completion status = %q, want %q", executionStore.status, store.ExecStatusFailed)
	}
	if got := scheduler.policies[1].policy.CurrentState; got != store.PolicyStateUnknown {
		t.Errorf("policy state after failed exception completion = %q, want %q", got, store.PolicyStateUnknown)
	}
}
