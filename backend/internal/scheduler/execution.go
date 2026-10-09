// SPDX-License-Identifier: Apache-2.0

package scheduler

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/metrics"
	"github.com/macxsimilian/kube-phoenix/backend/internal/scaler"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

func (ps *PolicyScheduler) claimTransition(policyID uint) error {
	if err := ps.store.SetPolicyTransitioning(policyID); err != nil {
		if errors.Is(err, store.ErrTransitionAlreadyClaimed) {
			return fmt.Errorf("policy %d: %w", policyID, ErrPolicyTransitioning)
		}
		return fmt.Errorf("policy %d: set transitioning: %w", policyID, err)
	}
	now := time.Now()
	ps.mu.Lock()
	if cp, ok := ps.policies[policyID]; ok {
		cp.policy.CurrentState = store.PolicyStateTransitioning
		cp.policy.StateSince = &now
		ps.policies[policyID] = cp
	}
	ps.mu.Unlock()
	return nil
}

func (ps *PolicyScheduler) run(ctx context.Context, p store.Policy, direction, trigger string) (uint, error) {
	ps.mu.Lock()
	if _, running := ps.inflightPolicies[p.ID]; running {
		ps.mu.Unlock()
		return 0, fmt.Errorf("policy %d: %w", p.ID, ErrPolicyExecutionInflight)
	}
	ps.inflightPolicies[p.ID] = struct{}{}
	ps.mu.Unlock()

	if err := ps.claimTransition(p.ID); err != nil {
		ps.mu.Lock()
		delete(ps.inflightPolicies, p.ID)
		ps.mu.Unlock()
		return 0, err
	}

	exec := &store.PolicyExecution{
		PolicyID:  p.ID,
		Direction: direction,
		Trigger:   trigger,
		StartedAt: time.Now(),
		Status:    store.ExecStatusRunning,
		Mode:      p.Mode,
	}
	if err := ps.store.CreatePolicyExecution(exec); err != nil {
		slog.Error("policy scheduler: rollback transitioning after execution create failure",
			"policyID", p.ID, "err", err)
		if rbErr := ps.store.UpdatePolicyState(p.ID, store.PolicyStateUnknown, nil); rbErr != nil {
			slog.Error("policy scheduler: rollback state update failed", "policyID", p.ID, "err", rbErr)
		}
		rbNow := time.Now()
		ps.mu.Lock()
		if cp, ok := ps.policies[p.ID]; ok {
			cp.policy.CurrentState = store.PolicyStateUnknown
			cp.policy.StateSince = &rbNow
			ps.policies[p.ID] = cp
		}
		delete(ps.inflightPolicies, p.ID)
		ps.mu.Unlock()
		return 0, fmt.Errorf("create policy execution: %w", err)
	}
	execID := exec.ID
	slog.Info("policy scheduler: starting execution",
		"policyID", p.ID, "execID", execID, "direction", direction, "trigger", trigger)

	ps.inflight.Add(1)
	go func() {
		defer ps.inflight.Done()
		defer func() {
			ps.mu.Lock()
			delete(ps.inflightPolicies, p.ID)
			delete(ps.inflightCancels, p.ID)
			ps.mu.Unlock()
		}()
		defer func() {
			if r := recover(); r != nil {
				slog.Error("policy scheduler: panic in execution goroutine (recovered)",
					"policyID", p.ID, "execID", exec.ID, "panic", r)
				metrics.SchedulerPanicsTotal.Inc()
				// Best-effort: mark execution failed and reset policy state.
				_ = ps.store.FinishPolicyExecution(exec.ID, store.ExecStatusFailed, nil)
				ps.updatePolicyState(p.ID, direction, store.ExecStatusFailed)
			}
		}()
		ps.executeAndFinalize(ctx, p, direction, trigger, execID, exec.StartedAt)
	}()

	return execID, nil
}

// executeAndFinalize runs the scaler with a timeout context, drains logs,
// determines the final status, and persists the result.
func (ps *PolicyScheduler) executeAndFinalize(ctx context.Context, p store.Policy, direction, trigger string, execID uint, startedAt time.Time) {
	timeout := time.Duration(p.TimeoutMinutes) * time.Minute
	if timeout <= 0 {
		timeout = defaultExecutionTimeout
	}
	runCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	ps.mu.Lock()
	ps.inflightCancels[p.ID] = cancel
	ps.mu.Unlock()

	logCh := make(chan scaler.LogLine, execLogChannelBuffer)

	var logDrain sync.WaitGroup
	logDrain.Add(1)
	go func() {
		defer logDrain.Done()
		ps.drainLogChannel(execID, logCh)
	}()

	// Flush persisted logs and close subscribers even when the scaler panics.
	counts, runErr := func() (*scaler.Counts, error) {
		defer func() {
			close(logCh)
			logDrain.Wait()
			ps.Broker.Close(execID)
		}()
		return ps.executeScaler(runCtx, p, direction, trigger, execID, logCh)
	}()

	status := store.ExecStatusSuccess
	if runErr != nil {
		if runCtx.Err() != nil {
			status = store.ExecStatusInterrupted
			slog.Info("policy scheduler: execution interrupted", "execID", execID, "err", runErr)
		} else {
			status = store.ExecStatusFailed
			slog.Error("policy scheduler: execution failed", "execID", execID, "err", runErr)
		}
	}

	countMap := ps.finalizeExecution(execID, status, counts)
	recordExecutionMetrics(p.Mode, direction, status, time.Since(startedAt).Seconds(), counts)
	if p.ExceptionScope != nil {
		ps.restoreBaselineState(p, status)
	} else {
		ps.updatePolicyState(p.ID, direction, status)
	}

	slog.Info("policy scheduler: execution finished",
		"policyID", p.ID, "execID", execID, "direction", direction,
		"status", status, "scaled", countMap["scaled"], "errors", countMap["errors"])
}

func (ps *PolicyScheduler) restoreBaselineState(p store.Policy, status string) {
	state := p.CurrentState
	if status != store.ExecStatusSuccess || state == "" || state == store.PolicyStateTransitioning {
		state = store.PolicyStateUnknown
	}
	if err := ps.store.UpdatePolicyState(p.ID, state, ps.NextTransition(p.ID)); err != nil {
		slog.Error("restore baseline policy state after scoped execution", "policyID", p.ID, "err", err)
	}
	ps.mu.Lock()
	if cp, ok := ps.policies[p.ID]; ok {
		cp.policy.CurrentState = state
		ps.policies[p.ID] = cp
	}
	ps.mu.Unlock()
}

// drainLogChannel reads log lines from the scaler, publishes them to WebSocket
// subscribers in real time, and batches them for DB persistence.
func (ps *PolicyScheduler) drainLogChannel(execID uint, logCh <-chan scaler.LogLine) {
	const flushSize = 50
	buf := make([]store.PolicyLogLine, 0, flushSize)
	seq := 0

	flush := func() {
		if len(buf) == 0 {
			return
		}
		if err := ps.store.AppendPolicyLogLines(buf); err != nil {
			slog.Error("policy scheduler: log batch persist error", "execID", execID, "lines", len(buf), "err", err)
		}
		buf = buf[:0]
	}

	for line := range logCh {
		seq++
		dbLine := store.PolicyLogLine{
			ExecutionID: execID,
			Seq:         seq,
			Level:       line.Level,
			Message:     line.Message,
			Timestamp:   line.Time,
		}
		ps.Broker.Publish(execID, dbLine)
		buf = append(buf, dbLine)
		if len(buf) >= flushSize {
			flush()
		}
	}
	flush()
}

// executeScaler dispatches to the appropriate sleep or wake runner.
func (ps *PolicyScheduler) executeScaler(ctx context.Context, p store.Policy, direction, trigger string, execID uint, logCh chan<- scaler.LogLine) (*scaler.Counts, error) {
	if trigger == "enforce_sleep" && direction == directionSleep {
		return ps.runner.RunPolicySleepReconcile(ctx, p, execID, logCh)
	}
	switch direction {
	case directionSleep:
		return ps.runner.RunPolicySleep(ctx, p, execID, logCh)
	case directionWake:
		return ps.runner.RunPolicyWake(ctx, p, execID, logCh)
	default:
		return nil, fmt.Errorf("unknown direction: %s", direction)
	}
}

// finalizeExecution writes the completion status and counts to the database.
// It returns the count map so callers can reference it (e.g. for logging).
func (ps *PolicyScheduler) finalizeExecution(execID uint, status string, counts *scaler.Counts) map[string]int {
	countMap := map[string]int{}
	if counts != nil {
		countMap = map[string]int{
			"scaled":    counts.Scaled,
			"skipped":   counts.Skipped,
			"errors":    counts.Errors,
			"protected": counts.Protected,
			"drained":   counts.Drained,
			"deleted":   counts.Deleted,
			"requests":  counts.Requests,
		}
	}
	if err := ps.store.FinishPolicyExecution(execID, status, countMap); err != nil {
		slog.Error("policy scheduler: finish execution error", "execID", execID, "err", err)
	}
	return countMap
}

// recordExecutionMetrics records Prometheus metrics for a completed execution.
func recordExecutionMetrics(mode, direction, status string, duration float64, counts *scaler.Counts) {
	metrics.ExecutionsTotal.WithLabelValues(mode, direction, status).Inc()
	metrics.ExecutionDuration.WithLabelValues(mode, direction).Observe(duration)
	if counts != nil {
		metrics.WorkloadsScaledTotal.WithLabelValues(direction).Add(float64(counts.Scaled))
		metrics.NodesDrainedTotal.Add(float64(counts.Drained))
		metrics.NodesDeletedTotal.Add(float64(counts.Deleted))
	}
}

// updatePolicyState persists the new state to the DB and syncs the in-memory cache.
// On failure, records a backoff timestamp to prevent tight retry loops.
func (ps *PolicyScheduler) updatePolicyState(policyID uint, direction, status string) {
	nextTransition := ps.NextTransition(policyID)
	var newState string
	if status == store.ExecStatusSuccess {
		if direction == directionSleep {
			newState = store.PolicyStateSleeping
		} else {
			newState = store.PolicyStateAwake
		}
		ps.clearFailedTransition(policyID)
	} else {
		newState = store.PolicyStateUnknown
		ps.recordFailedTransition(policyID, time.Now())
	}
	if err := ps.store.UpdatePolicyState(policyID, newState, nextTransition); err != nil {
		slog.Error("policy scheduler: failed to update policy state after execution",
			"policyID", policyID, "newState", newState, "err", err)
	}

	now := time.Now()
	ps.mu.Lock()
	if cp, ok := ps.policies[policyID]; ok {
		cp.policy.CurrentState = newState
		cp.policy.StateSince = &now
		ps.policies[policyID] = cp
	}
	ps.mu.Unlock()
}
