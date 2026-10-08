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
func TestPartialExecutionIsFailedAndEligibleForRetry(t *testing.T) {
	st := &finalizationStore{}
	ps := newTestSchedulerWithRunner(st, &partialRunner{})
	p := store.Policy{ID: 1, Mode: "apply", CurrentState: store.PolicyStateAwake}
	ps.policies[1] = cachedPolicy{policy: p}
	ps.executeAndFinalize(context.Background(), p, directionSleep, "scheduled", 1, time.Now())
	if st.status != store.ExecStatusFailed || st.counts["errors"] != 1 || st.counts["scaled"] != 1 {
		t.Fatalf("status=%s counts=%v", st.status, st.counts)
	}
	if ps.policies[1].policy.CurrentState != store.PolicyStateUnknown {
		t.Fatal("partial execution recorded as sleeping")
	}
	if !ps.failedTransitionBackoffElapsed(1, time.Now().Add(reconcileBackoff)) {
		t.Fatal("failed execution never becomes retryable")
	}
}
