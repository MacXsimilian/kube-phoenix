// SPDX-License-Identifier: Apache-2.0

package scheduler

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/policy"
	"github.com/macxsimilian/kube-phoenix/backend/internal/scaler"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

// ─── Test doubles ─────────────────────────────────────────────────────────────

type mockStore struct {
	openSnapshotCount int64
	policies          []store.Policy

	// Stubbed errors — set before calling to inject failures.
	transitionErr error

	// Spy fields — record calls for assertions.
	mu                  sync.Mutex
	createdExecutions   []store.PolicyExecution
	stateUpdates        []stateUpdate
	transitioningClaims []uint
}

type stateUpdate struct {
	policyID uint
	state    string
}

func (m *mockStore) GetPolicy(id uint) (*store.Policy, error) {
	for _, p := range m.policies {
		if p.ID == id {
			return &p, nil
		}
	}
	return &store.Policy{ID: id, Enabled: true}, nil
}
func (m *mockStore) ListPolicies() ([]store.Policy, error) { return m.policies, nil }
func (m *mockStore) ListEnabledPolicies() ([]store.Policy, error) {
	var enabled []store.Policy
	for _, p := range m.policies {
		if p.Enabled {
			enabled = append(enabled, p)
		}
	}
	return enabled, nil
}
func (m *mockStore) CountOpenSnapshotsForRestore(_ uint) (int64, error) {
	return m.openSnapshotCount, nil
}
func (m *mockStore) UpdatePolicyState(id uint, state string, _ *time.Time) error {
	m.mu.Lock()
	m.stateUpdates = append(m.stateUpdates, stateUpdate{id, state})
	m.mu.Unlock()
	return nil
}
func (m *mockStore) SetPolicyTransitioning(id uint) error {
	m.mu.Lock()
	m.transitioningClaims = append(m.transitioningClaims, id)
	err := m.transitionErr
	m.mu.Unlock()
	return err
}
func (m *mockStore) CreatePolicyExecution(exec *store.PolicyExecution) error {
	m.mu.Lock()
	exec.ID = uint(len(m.createdExecutions) + 1)
	m.createdExecutions = append(m.createdExecutions, *exec)
	m.mu.Unlock()
	return nil
}
func (m *mockStore) FinishPolicyExecution(_ uint, _ string, _ map[string]int) error { return nil }
func (m *mockStore) AppendPolicyLogLines(_ []store.PolicyLogLine) error             { return nil }
func (m *mockStore) ListOpenExceptions() ([]store.ScheduledException, error) {
	return nil, nil
}
func (m *mockStore) UpdateScheduledExceptionStatus(_ uint, _, _ string) error { return nil }
func (m *mockStore) ListActiveExceptionsForPolicies(_ []uint, _ time.Time) (map[uint][]store.ScheduledException, error) {
	return map[uint][]store.ScheduledException{}, nil
}
func (m *mockStore) ListActiveExceptionsForPolicy(_ uint, _ time.Time) ([]store.ScheduledException, error) {
	return nil, nil
}
func (m *mockStore) GetOpenSnapshotsForSleepReconcile(_ uint) ([]store.WorkloadSnapshot, error) {
	return nil, nil
}

type mockRunner struct {
	hasDriftedFromSleep bool

	// Executions run in goroutines, so call counts must support concurrent updates.
	sleepCalls          atomic.Int64
	wakeCalls           atomic.Int64
	sleepReconcileCalls atomic.Int64
}

func (m *mockRunner) RunPolicySleep(_ context.Context, _ store.Policy, _ uint, logCh chan<- scaler.LogLine) (*scaler.Counts, error) {
	m.sleepCalls.Add(1)
	return &scaler.Counts{}, nil
}
func (m *mockRunner) RunPolicyWake(_ context.Context, _ store.Policy, _ uint, logCh chan<- scaler.LogLine) (*scaler.Counts, error) {
	m.wakeCalls.Add(1)
	return &scaler.Counts{Scaled: 1}, nil
}
func (m *mockRunner) HasDriftedFromSleep(_ context.Context, _ uint) (bool, error) {
	return m.hasDriftedFromSleep, nil
}
func (m *mockRunner) RunPolicySleepReconcile(_ context.Context, _ store.Policy, _ uint, logCh chan<- scaler.LogLine) (*scaler.Counts, error) {
	m.sleepReconcileCalls.Add(1)
	return &scaler.Counts{}, nil
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func newTestSchedulerWithRunner(st schedulerStore, r policyRunner) *PolicyScheduler {
	return &PolicyScheduler{
		store:                st,
		runner:               r,
		Broker:               NewBroker(),
		policies:             map[uint]cachedPolicy{},
		lastReconcileAttempt: map[uint]time.Time{},
		lastFailedTransition: map[uint]time.Time{},
		inflightPolicies:     map[uint]struct{}{},
		inflightCancels:      map[uint]context.CancelFunc{},
		cfg: SchedulerConfig{
			TickInterval: 30 * time.Second,
		},
	}
}

func newTestScheduler(st schedulerStore) *PolicyScheduler {
	return newTestSchedulerWithRunner(st, &mockRunner{})
}

func awakePolicy(id uint) cachedPolicy {
	return cachedPolicy{
		policy: store.Policy{
			ID:           id,
			Enabled:      true,
			CurrentState: store.PolicyStateAwake,
			Timezone:     "UTC",
			Mode:         "apply",
		},
		windows: []policy.SleepWindow{{
			DaysOfWeek: []int{0, 1, 2, 3, 4, 5, 6},
			StartTime:  "23:00",
			EndTime:    "05:00",
		}},
	}
}

func waitForExecution(t *testing.T, ms *mockStore) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		ms.mu.Lock()
		n := len(ms.createdExecutions)
		ms.mu.Unlock()
		if n > 0 {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
}

// ─── Backoff tests ────────────────────────────────────────────────────────────

// Repeated corrective attempts must wait five minutes per policy.
// A policy without a previous attempt is immediately eligible.
func TestReconcileBackoffElapsed(t *testing.T) {
	ps := &PolicyScheduler{
		lastReconcileAttempt: map[uint]time.Time{},
	}
	now := time.Date(2024, 3, 13, 12, 0, 0, 0, time.UTC)

	if !ps.reconcileBackoffElapsed(1, now) {
		t.Error("expected backoff elapsed when no prior attempt exists")
	}

	ps.recordReconcileAttempt(1, now)
	if ps.reconcileBackoffElapsed(1, now) {
		t.Error("expected backoff NOT elapsed immediately after attempt")
	}

	if ps.reconcileBackoffElapsed(1, now.Add(4*time.Minute)) {
		t.Error("expected backoff NOT elapsed after 4 minutes")
	}

	if !ps.reconcileBackoffElapsed(1, now.Add(5*time.Minute)) {
		t.Error("expected backoff elapsed after 5 minutes")
	}

	if !ps.reconcileBackoffElapsed(2, now) {
		t.Error("expected backoff elapsed for untracked policy")
	}
}

// ─── Routing tests ────────────────────────────────────────────────────────────

// An awake policy outside its sleep window should remain idle when
// corrective wake reconciliation is disabled.
func TestEvaluatePolicy_ReconcileOff_AwakeStaysAwake_NoExecution(t *testing.T) {
	ms := &mockStore{}
	ps := newTestScheduler(ms)
	cp := awakePolicy(1)
	ctx := evalContext{
		now:                 time.Date(2024, 3, 13, 12, 0, 0, 0, time.UTC),
		autoWake:            true,
		reconcileWhileAwake: false,
	}

	ps.evaluatePolicy(cp, ctx)

	ms.mu.Lock()
	defer ms.mu.Unlock()
	if len(ms.createdExecutions) != 0 {
		t.Errorf("expected no execution, got %d", len(ms.createdExecutions))
	}
}

// Enabling reconciliation should not create redundant wake executions
// when no open recovery snapshots indicate unfinished restoration.
func TestEvaluatePolicy_ReconcileOn_NoDrift_NoExecution(t *testing.T) {
	ms := &mockStore{openSnapshotCount: 0}
	ps := newTestScheduler(ms)
	cp := awakePolicy(1)
	ctx := evalContext{
		now:                 time.Date(2024, 3, 13, 12, 0, 0, 0, time.UTC),
		autoWake:            true,
		reconcileWhileAwake: true,
	}

	ps.evaluatePolicy(cp, ctx)

	ms.mu.Lock()
	defer ms.mu.Unlock()
	if len(ms.createdExecutions) != 0 {
		t.Errorf("expected no execution when no drift, got %d", len(ms.createdExecutions))
	}
}

// Open snapshots indicate workloads still need restoration even though the
// policy says awake. Route that correction as a wake with a reconcile trigger.
func TestEvaluatePolicy_ReconcileOn_DriftDetected_CorrectiveWake(t *testing.T) {
	ms := &mockStore{openSnapshotCount: 3}
	ps := newTestScheduler(ms)
	cp := awakePolicy(1)
	ps.policies[1] = cp
	ctx := evalContext{
		now:                 time.Date(2024, 3, 13, 12, 0, 0, 0, time.UTC),
		autoWake:            true,
		reconcileWhileAwake: true,
	}

	ps.evaluatePolicy(cp, ctx)
	waitForExecution(t, ms)

	ms.mu.Lock()
	defer ms.mu.Unlock()
	if len(ms.createdExecutions) != 1 {
		t.Fatalf("expected 1 execution, got %d", len(ms.createdExecutions))
	}
	exec := ms.createdExecutions[0]
	if exec.Direction != directionWake {
		t.Errorf("expected direction=%q, got %q", directionWake, exec.Direction)
	}
	if exec.Trigger != "reconcile" {
		t.Errorf("expected trigger=%q, got %q", "reconcile", exec.Trigger)
	}
}

// Persistent drift must not launch corrective wake on every tick.
// A recent attempt suppresses another execution until backoff expires.
func TestEvaluatePolicy_ReconcileOn_BackoffNotElapsed_NoExecution(t *testing.T) {
	ms := &mockStore{openSnapshotCount: 3}
	ps := newTestScheduler(ms)
	cp := awakePolicy(1)
	now := time.Date(2024, 3, 13, 12, 0, 0, 0, time.UTC)

	// Simulate a recent reconcile attempt.
	ps.recordReconcileAttempt(1, now.Add(-2*time.Minute))

	ctx := evalContext{
		now:                 now,
		autoWake:            true,
		reconcileWhileAwake: true,
	}

	ps.evaluatePolicy(cp, ctx)

	ms.mu.Lock()
	defer ms.mu.Unlock()
	if len(ms.createdExecutions) != 0 {
		t.Errorf("expected no execution during backoff, got %d", len(ms.createdExecutions))
	}
}

// Corrective wake repairs an already-awake policy, so disabling automatic
// scheduled wake must not block this separate reconciliation path.
func TestEvaluatePolicy_ReconcileOn_BypassesAutoWakeGate(t *testing.T) {
	ms := &mockStore{openSnapshotCount: 2}
	ps := newTestScheduler(ms)
	cp := awakePolicy(1)
	ps.policies[1] = cp
	ctx := evalContext{
		now:                 time.Date(2024, 3, 13, 12, 0, 0, 0, time.UTC),
		autoWake:            false, // autoWake OFF — should NOT block corrective wake
		reconcileWhileAwake: true,
	}

	ps.evaluatePolicy(cp, ctx)
	waitForExecution(t, ms)

	ms.mu.Lock()
	defer ms.mu.Unlock()
	if len(ms.createdExecutions) != 1 {
		t.Fatalf("corrective wake should bypass autoWake gate, got %d executions", len(ms.createdExecutions))
	}
}

// A normal sleeping-to-awake schedule transition must honor autoWake=false.
// This differs from repairing drift in an already-awake policy.
func TestEvaluatePolicy_ScheduledTransition_RespectsAutoWake(t *testing.T) {
	ms := &mockStore{}
	ps := newTestScheduler(ms)
	// Policy is sleeping but windows say awake — needs a scheduled wake.
	cp := cachedPolicy{
		policy: store.Policy{
			ID:           1,
			Enabled:      true,
			CurrentState: store.PolicyStateSleeping,
			Timezone:     "UTC",
			Mode:         "apply",
		},
		windows: []policy.SleepWindow{{
			DaysOfWeek: []int{0, 1, 2, 3, 4, 5, 6},
			StartTime:  "23:00",
			EndTime:    "05:00",
		}},
	}
	ctx := evalContext{
		now:                 time.Date(2024, 3, 13, 12, 0, 0, 0, time.UTC),
		autoWake:            false, // autoWake OFF — should block scheduled wake
		reconcileWhileAwake: false,
	}

	ps.evaluatePolicy(cp, ctx)

	ms.mu.Lock()
	defer ms.mu.Unlock()
	if len(ms.createdExecutions) != 0 {
		t.Errorf("scheduled wake should respect autoWake=false, got %d executions", len(ms.createdExecutions))
	}
}

// ─── Transition claim tests ──────────────────────────────────────────────────

// A rejected database claim means another transition owns the policy.
// Expose that conflict without creating a competing execution.
func TestClaimTransition_AlreadyClaimed_ReturnsErrPolicyTransitioning(t *testing.T) {
	ms := &mockStore{
		transitionErr: store.ErrTransitionAlreadyClaimed,
	}
	ps := newTestScheduler(ms)

	err := ps.claimTransition(1)

	if err == nil {
		t.Fatal("expected error when transition already claimed")
	}
	if !errors.Is(err, ErrPolicyTransitioning) {
		t.Errorf("expected ErrPolicyTransitioning, got %v", err)
	}

	ms.mu.Lock()
	defer ms.mu.Unlock()
	if len(ms.createdExecutions) != 0 {
		t.Error("no execution should be created when claim fails")
	}
}

// A successful database claim must also mark the cached policy transitioning
// so later evaluations observe that work is already in progress.
func TestClaimTransition_Success_UpdatesCache(t *testing.T) {
	ms := &mockStore{}
	ps := newTestScheduler(ms)
	ps.policies[1] = awakePolicy(1)

	err := ps.claimTransition(1)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	ps.mu.Lock()
	cp := ps.policies[1]
	ps.mu.Unlock()
	if cp.policy.CurrentState != store.PolicyStateTransitioning {
		t.Errorf("expected cache state=%q, got %q", store.PolicyStateTransitioning, cp.policy.CurrentState)
	}

	ms.mu.Lock()
	defer ms.mu.Unlock()
	if len(ms.transitioningClaims) != 1 || ms.transitioningClaims[0] != 1 {
		t.Errorf("expected transitioning claim for policy 1, got %v", ms.transitioningClaims)
	}
}

// ─── Enforce sleep tests ─────────────────────────────────────────────────────

func sleepingPolicy(id uint) cachedPolicy {
	return cachedPolicy{
		policy: store.Policy{
			ID:           id,
			Enabled:      true,
			CurrentState: store.PolicyStateSleeping,
			Timezone:     "UTC",
			Mode:         "apply",
		},
		windows: []policy.SleepWindow{{
			DaysOfWeek: []int{0, 1, 2, 3, 4, 5, 6},
			StartTime:  "00:00",
			EndTime:    "23:59",
		}},
	}
}

// When workloads drift awake during a sleep window, enforceSleep should
// use reconciliation rather than ordinary sleep, which can select new workloads
// and run node operations. The execution must also carry its own trigger.
func TestEvaluatePolicy_EnforceSleep_DriftDetected_CorrectiveSleep(t *testing.T) {
	ms := &mockStore{}
	mr := &mockRunner{hasDriftedFromSleep: true}
	ps := newTestSchedulerWithRunner(ms, mr)
	cp := sleepingPolicy(1)
	ps.policies[1] = cp
	ctx := evalContext{
		now:          time.Date(2024, 3, 13, 12, 0, 0, 0, time.UTC),
		autoWake:     true,
		enforceSleep: true,
	}

	ps.evaluatePolicy(cp, ctx)
	// Creating the execution record precedes runner dispatch. Wait for the runner
	// to finish before checking which operation actually handled the correction.
	ps.inflight.Wait()

	if got := mr.sleepReconcileCalls.Load(); got != 1 {
		t.Errorf("sleep reconciliation calls = %d, want 1", got)
	}
	if got := mr.sleepCalls.Load(); got != 0 {
		t.Errorf("ordinary sleep calls = %d, want 0", got)
	}
	if got := mr.wakeCalls.Load(); got != 0 {
		t.Errorf("wake calls = %d, want 0", got)
	}

	ms.mu.Lock()
	defer ms.mu.Unlock()
	if len(ms.createdExecutions) != 1 {
		t.Fatalf("expected 1 execution, got %d", len(ms.createdExecutions))
	}
	exec := ms.createdExecutions[0]
	if exec.Direction != directionSleep {
		t.Errorf("expected direction=%q, got %q", directionSleep, exec.Direction)
	}
	if exec.Trigger != "enforce_sleep" {
		t.Errorf("expected trigger=%q, got %q", "enforce_sleep", exec.Trigger)
	}
}

// Sleep enforcement must stay idle when the runner reports no replica drift,
// avoiding unnecessary executions for workloads already asleep.
func TestEvaluatePolicy_EnforceSleep_NoDrift_NoExecution(t *testing.T) {
	ms := &mockStore{}
	mr := &mockRunner{hasDriftedFromSleep: false}
	ps := newTestSchedulerWithRunner(ms, mr)
	cp := sleepingPolicy(1)
	ps.policies[1] = cp
	ctx := evalContext{
		now:          time.Date(2024, 3, 13, 12, 0, 0, 0, time.UTC),
		autoWake:     true,
		enforceSleep: true,
	}

	ps.evaluatePolicy(cp, ctx)

	ms.mu.Lock()
	defer ms.mu.Unlock()
	if len(ms.createdExecutions) != 0 {
		t.Errorf("expected no execution when no drift, got %d", len(ms.createdExecutions))
	}
}

// Detected drift alone must not enable sleep enforcement; the guardrail
// controls whether a corrective sleep execution may be created.
func TestEvaluatePolicy_EnforceSleepDisabled_NoExecution(t *testing.T) {
	ms := &mockStore{}
	mr := &mockRunner{hasDriftedFromSleep: true}
	ps := newTestSchedulerWithRunner(ms, mr)
	cp := sleepingPolicy(1)
	ps.policies[1] = cp
	ctx := evalContext{
		now:          time.Date(2024, 3, 13, 12, 0, 0, 0, time.UTC),
		autoWake:     true,
		enforceSleep: false,
	}

	ps.evaluatePolicy(cp, ctx)

	ms.mu.Lock()
	defer ms.mu.Unlock()
	if len(ms.createdExecutions) != 0 {
		t.Errorf("expected no execution when enforce sleep disabled, got %d", len(ms.createdExecutions))
	}
}
