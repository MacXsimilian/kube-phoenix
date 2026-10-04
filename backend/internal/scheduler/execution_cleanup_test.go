// SPDX-License-Identifier: Apache-2.0

package scheduler

import (
	"context"
	"testing"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/scaler"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

type panicLogRunner struct{ mockRunner }

func (*panicLogRunner) RunPolicySleep(_ context.Context, _ store.Policy, _ uint, logCh chan<- scaler.LogLine) (*scaler.Counts, error) {
	logCh <- scaler.LogLine{Level: "info", Message: "before panic", Time: time.Now()}
	panic("runner failure")
}

type executionCleanupStore struct {
	mockStore
	logs          []store.PolicyLogLine
	finishedState string
}

func (m *executionCleanupStore) AppendPolicyLogLines(lines []store.PolicyLogLine) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.logs = append(m.logs, lines...)
	return nil
}

func (m *executionCleanupStore) FinishPolicyExecution(_ uint, status string, _ map[string]int) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.finishedState = status
	return nil
}

func TestRunnerPanicDrainsLogsAndClosesSubscribers(t *testing.T) {
	st := &executionCleanupStore{}
	ps := newTestSchedulerWithRunner(st, &panicLogRunner{})
	ch, _ := ps.Broker.Subscribe(1)
	p := store.Policy{ID: 7, Mode: store.PolicyModeApply}
	execID, err := ps.run(context.Background(), p, directionSleep, "manual")
	if err != nil {
		t.Fatal(err)
	}
	if execID != 1 {
		t.Fatalf("unexpected execution ID: %d", execID)
	}
	done := make(chan struct{})
	go func() {
		ps.inflight.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("panic recovery did not complete")
	}

	st.mu.Lock()
	defer st.mu.Unlock()
	if st.finishedState != store.ExecStatusFailed {
		t.Fatalf("panic execution status = %q, want failed", st.finishedState)
	}
	if len(st.logs) != 1 || st.logs[0].Message != "before panic" {
		t.Fatalf("queued logs were not drained and persisted: %+v", st.logs)
	}
	select {
	case line, open := <-ch:
		if !open || line.Message != "before panic" {
			t.Fatalf("subscriber did not receive final queued line: %+v, open=%v", line, open)
		}
	default:
		t.Fatal("subscriber log was not published before cleanup")
	}
	select {
	case _, open := <-ch:
		if open {
			t.Fatal("subscriber remains open after recovered runner panic")
		}
	default:
		t.Fatal("subscriber remains open after recovered runner panic")
	}
	if len(ps.Broker.subs) != 0 || len(ps.Broker.replay) != 0 {
		t.Fatal("panic retained broker execution resources")
	}
}
