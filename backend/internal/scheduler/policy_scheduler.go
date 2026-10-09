// SPDX-License-Identifier: Apache-2.0

// Package scheduler runs the policy evaluation ticker that periodically
// triggers sleep and wake executions. The evaluation pipeline is decomposed
// into evaluatePolicy → reconcilePolicy / resetStuckTransition / executeTransition,
// with drift detection via reconcileAwakePolicy. Store and runner dependencies
// are held as interfaces (schedulerStore, policyRunner) for testability.
package scheduler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/k8s"
	"github.com/macxsimilian/kube-phoenix/backend/internal/metrics"
	"github.com/macxsimilian/kube-phoenix/backend/internal/policy"
	"github.com/macxsimilian/kube-phoenix/backend/internal/scaler"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

// ErrPolicyTransitioning is returned when a policy is already mid-transition.
var ErrPolicyTransitioning = errors.New("policy is already transitioning")

// ErrPolicyExecutionInflight is returned when an execution goroutine is
// already running for the policy.
var ErrPolicyExecutionInflight = errors.New("policy execution already in flight")

// ErrNoInflightExecution is returned when trying to cancel a policy that
// has no running execution.
var ErrNoInflightExecution = errors.New("no in-flight execution for policy")

// IsAlreadyRunning reports whether the error indicates a policy execution
// is already in progress (either transitioning or inflight).
func IsAlreadyRunning(err error) bool {
	return errors.Is(err, ErrPolicyTransitioning) || errors.Is(err, ErrPolicyExecutionInflight)
}

// schedulerStore abstracts the store methods the scheduler depends on,
// enabling test doubles.
type schedulerStore interface {
	GetPolicy(id uint) (*store.Policy, error)
	ListPolicies() ([]store.Policy, error)
	ListEnabledPolicies() ([]store.Policy, error)
	CountOpenSnapshotsForRestore(policyID uint) (int64, error)
	UpdatePolicyState(id uint, state string, nextTransition *time.Time) error
	SetPolicyTransitioning(id uint) error
	CreatePolicyExecution(exec *store.PolicyExecution) error
	FinishPolicyExecution(id uint, status string, counts map[string]int) error
	AppendPolicyLogLines(lines []store.PolicyLogLine) error
	ListOpenExceptions() ([]store.ScheduledException, error)
	UpdateScheduledExceptionStatus(id uint, expectedStatus, newStatus string) error
	ListActiveExceptionsForPolicies(policyIDs []uint, now time.Time) (map[uint][]store.ScheduledException, error)
	ListActiveExceptionsForPolicy(policyID uint, now time.Time) ([]store.ScheduledException, error)
	GetOpenSnapshotsForSleepReconcile(policyID uint) ([]store.WorkloadSnapshot, error)
}

// policyRunner abstracts the execution engine for sleep/wake operations.
type policyRunner interface {
	RunPolicySleep(ctx context.Context, p store.Policy, execID uint, logCh chan<- scaler.LogLine) (*scaler.Counts, error)
	RunPolicyWake(ctx context.Context, p store.Policy, execID uint, logCh chan<- scaler.LogLine) (*scaler.Counts, error)
	HasDriftedFromSleep(ctx context.Context, policyID uint) (bool, error)
	RunPolicySleepReconcile(ctx context.Context, p store.Policy, execID uint, logCh chan<- scaler.LogLine) (*scaler.Counts, error)
}

// SchedulerConfig holds the runtime-tunable settings for the policy evaluation loop.
type SchedulerConfig struct {
	TickInterval        time.Duration
	AutoWake            bool
	ReconcileWhileAwake bool
	EnforceSleep        bool
}

// evalContext carries per-tick configuration into the evaluation functions,
// grouping values that would otherwise be passed as individual arguments.
type evalContext struct {
	now                 time.Time
	autoWake            bool
	reconcileWhileAwake bool
	enforceSleep        bool
	exceptionsByPolicy  map[uint][]store.ScheduledException // batch-fetched per tick
}

// cachedPolicy holds a parsed in-memory representation of a policy. The
// location is preloaded so per-tick evaluation does not pay the
// time.LoadLocation cost.
type cachedPolicy struct {
	policy  store.Policy
	windows []policy.SleepWindow
	loc     *time.Location
}

// PolicyScheduler evaluates all enabled policies on a 30-second tick and
// triggers sleep/wake executions when the intended state differs from the
// current state.
type PolicyScheduler struct {
	store  schedulerStore
	runner policyRunner
	Broker *Broker
	cfg    SchedulerConfig

	mu                   sync.Mutex
	cancel               context.CancelFunc
	execCtx              context.Context
	execCancel           context.CancelFunc
	parentCtx            context.Context
	policies             map[uint]cachedPolicy
	lastReconcileAttempt map[uint]time.Time
	lastExceptionAttempt map[uint]time.Time
	lastFailedTransition map[uint]time.Time          // backoff for failed scheduled transitions
	inflightPolicies     map[uint]struct{}           // policies with a running execution
	inflightCancels      map[uint]context.CancelFunc // cancel funcs for running executions
	inflight             sync.WaitGroup              // tracks running execution goroutines
}

// NewPolicyScheduler creates a PolicyScheduler. Pass nil k8sClient in tests.
func NewPolicyScheduler(st *store.Store, k8sClient *k8s.Client, cfg SchedulerConfig) *PolicyScheduler {
	return &PolicyScheduler{
		store:                st,
		runner:               scaler.NewPolicyRunner(k8sClient, st),
		Broker:               NewBroker(),
		policies:             map[uint]cachedPolicy{},
		lastReconcileAttempt: map[uint]time.Time{},
		lastFailedTransition: map[uint]time.Time{},
		inflightPolicies:     map[uint]struct{}{},
		inflightCancels:      map[uint]context.CancelFunc{},
		cfg:                  cfg,
	}
}

// Start loads all enabled policies, runs startup recovery, and begins the
// evaluation ticker. Recovery runs synchronously before the tick loop starts
// to avoid race conditions between recovery and scheduled evaluations.
func (ps *PolicyScheduler) Start(ctx context.Context) error {
	return ps.start(ctx, true)
}

func (ps *PolicyScheduler) start(ctx context.Context, recover bool) error {
	ps.mu.Lock()
	ps.parentCtx = ctx
	tickCtx, cancel := context.WithCancel(ctx)
	ps.cancel = cancel
	execCtx, execCancel := context.WithCancel(ctx)
	ps.execCtx = execCtx
	ps.execCancel = execCancel
	if err := ps.reload(); err != nil {
		ps.mu.Unlock()
		return err
	}
	ps.mu.Unlock()

	if recover {
		if err := ps.RecoverPolicies(ctx); err != nil {
			slog.Error("policy scheduler: recovery failed (continuing)", "err", err)
		}
	}

	interval := ps.cfg.TickInterval
	go ps.tickLoop(tickCtx, interval)
	slog.Info("policy scheduler started")
	return nil
}

// Stop gracefully shuts down the ticker and the in-flight execution context,
// then waits for executions to unwind. Both contexts are cancelled before the
// wait so executeAndFinalize's runCtx (derived from execCtx) sees cancellation
// and does not block on per-execution timeouts (up to 2h).
func (ps *PolicyScheduler) Stop() {
	ps.mu.Lock()
	tickCancel := ps.cancel
	execCancel := ps.execCancel
	ps.mu.Unlock()
	if tickCancel != nil {
		tickCancel()
	}
	if execCancel != nil {
		execCancel()
	}
	ps.inflight.Wait()
}

// UpdateSettings applies new scheduler settings at runtime. If the eval
// interval changes the ticker loop is restarted automatically.
func (ps *PolicyScheduler) UpdateSettings(cfg SchedulerConfig) error {
	ps.mu.Lock()
	intervalChanged := ps.cfg.TickInterval != cfg.TickInterval
	ps.cfg = cfg
	parentCtx := ps.parentCtx
	ps.mu.Unlock()

	if intervalChanged && parentCtx != nil {
		return ps.Restart()
	}
	return nil
}

// Reload re-reads all policies from the DB. Called after any policy CRUD.
func (ps *PolicyScheduler) Reload() error {
	ps.mu.Lock()
	defer ps.mu.Unlock()
	return ps.reload()
}

// Restart stops and restarts the ticker loop without running recovery.
// Recovery is only needed on cold boot when state may be stale from a crash;
// a restart happens in a running process where the previous tick already
// left state consistent. The lifetime context established by Start is retained
// so finishing an administrative operation cannot stop the restarted scheduler.
func (ps *PolicyScheduler) Restart() error {
	ps.Stop()
	ps.mu.Lock()
	ctx := ps.parentCtx
	ps.mu.Unlock()
	if ctx == nil {
		ctx = context.Background()
	}
	return ps.start(ctx, false)
}

// NextTransition returns the next predicted state change for a policy.
func (ps *PolicyScheduler) NextTransition(policyID uint) *time.Time {
	ps.mu.Lock()
	cp, ok := ps.policies[policyID]
	ps.mu.Unlock()
	if !ok {
		return nil
	}
	return policy.NextTransitionInLocation(cp.windows, cp.loc, time.Now())
}

// NextTransitions returns the next transition time for each requested policy
// in a single lock acquisition.
func (ps *PolicyScheduler) NextTransitions(policyIDs []uint) map[uint]*time.Time {
	ps.mu.Lock()
	type entry struct {
		id      uint
		windows []policy.SleepWindow
		loc     *time.Location
	}
	entries := make([]entry, 0, len(policyIDs))
	for _, id := range policyIDs {
		if cp, ok := ps.policies[id]; ok {
			entries = append(entries, entry{id, cp.windows, cp.loc})
		}
	}
	ps.mu.Unlock()

	now := time.Now()
	result := make(map[uint]*time.Time, len(entries))
	for _, e := range entries {
		result[e.id] = policy.NextTransitionInLocation(e.windows, e.loc, now)
	}
	return result
}

// RunSleepNow triggers an immediate sleep execution for a policy.
// An optional modeOverride ("plan" or "apply") replaces the policy's default mode for this execution.
func (ps *PolicyScheduler) RunSleepNow(policyID uint, trigger string, modeOverride string) (uint, error) {
	return ps.runNow(policyID, directionSleep, trigger, modeOverride)
}

// RunWakeNow triggers an immediate wake execution for a policy.
// An optional modeOverride ("plan" or "apply") replaces the policy's default mode for this execution.
func (ps *PolicyScheduler) RunWakeNow(policyID uint, trigger string, modeOverride string) (uint, error) {
	return ps.runNow(policyID, directionWake, trigger, modeOverride)
}

// runNow fetches a policy by ID, warns if disabled, and delegates to run.
func (ps *PolicyScheduler) runNow(policyID uint, direction, trigger string, modeOverride string) (uint, error) {
	p, err := ps.store.GetPolicy(policyID)
	if err != nil {
		return 0, fmt.Errorf("policy %d not found: %w", policyID, err)
	}
	if !p.Enabled {
		slog.Warn("manual trigger on disabled policy", "policyID", policyID, "direction", direction, "trigger", trigger)
	}
	if modeOverride == "plan" || modeOverride == "apply" {
		p.Mode = modeOverride
	}
	return ps.run(ps.execContext(), *p, direction, trigger)
}

// execContext returns the cancellable context that scopes all in-flight
// executions. Stop() cancels it so executeAndFinalize's derived runCtx unwinds
// immediately, rather than hanging until the per-execution timeout (up to 2h)
// expires.
func (ps *PolicyScheduler) execContext() context.Context {
	ps.mu.Lock()
	ctx := ps.execCtx
	ps.mu.Unlock()
	if ctx != nil {
		return ctx
	}
	return context.Background()
}

// CancelExecution cancels a running execution for the given policy.
// Returns ErrNoInflightExecution if nothing is running.
func (ps *PolicyScheduler) CancelExecution(policyID uint) error {
	ps.mu.Lock()
	cancel, ok := ps.inflightCancels[policyID]
	ps.mu.Unlock()
	if !ok {
		return ErrNoInflightExecution
	}
	slog.Info("policy scheduler: execution cancelled by user", "policyID", policyID)
	cancel()
	return nil
}

// RecoverPolicies compares each enabled policy's CurrentState against the
// window-evaluated IntendedState and queues a recovery execution for any
// mismatch. Called once at startup.
func (ps *PolicyScheduler) RecoverPolicies(ctx context.Context) error {
	policies, err := ps.store.ListEnabledPolicies()
	if err != nil {
		return fmt.Errorf("recovery: list policies: %w", err)
	}
	now := time.Now()
	for _, p := range policies {
		windows := parsePolicyWindows(p)
		exceptions, err := ps.store.ListActiveExceptionsForPolicy(p.ID, now)
		if err != nil {
			return fmt.Errorf("recovery: read active exceptions for policy %d: %w", p.ID, err)
		}
		intended := IntendedState(StateInput{
			Windows: windows, Timezone: p.Timezone,
			Exceptions: policyWideExceptions(exceptions), Now: now,
		})
		if intended == PolicyStateUnknown {
			continue
		}
		if p.CurrentState == string(intended) {
			ps.reconcileScopedExceptions(p, evalContext{now: now, exceptionsByPolicy: map[uint][]store.ScheduledException{p.ID: exceptions}})
			continue
		}
		direction := directionSleep
		if intended == PolicyStateAwake {
			direction = directionWake
		}
		slog.Info("policy scheduler: recovery execution queued",
			"policyID", p.ID, "name", p.Name,
			"actual", p.CurrentState, "intended", intended, "direction", direction)
		if _, err := ps.run(ctx, p, direction, "recovery"); err != nil {
			slog.Error("policy scheduler: recovery execution failed",
				"policyID", p.ID, "err", err)
		}
	}
	return nil
}

// ─── Internal ─────────────────────────────────────────────────────────────────

const (
	directionSleep = "sleep"
	directionWake  = "wake"

	defaultExecutionTimeout = 2 * time.Hour
	execLogChannelBuffer    = 512

	// reconcileBackoff is the minimum interval between corrective-wake
	// attempts for the same policy. Prevents flooding history when failures
	// persist.
	reconcileBackoff            = 5 * time.Minute
	stuckTransitionTimeoutFloor = 15 * time.Minute
)

func (ps *PolicyScheduler) tickLoop(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			// Tick exceptions first so that pending→active transitions happen
			// before evaluateAll reads active exceptions. Otherwise the first
			// tick after an exception becomes due will not see it, allowing a
			// conflicting sleep/wake to fire before the exception takes effect.
			ps.TickExceptions(ctx)
			ps.safeEvaluateAll()
		}
	}
}

// safeEvaluateAll wraps evaluateAll with panic recovery so a single bad
// policy evaluation cannot kill the scheduler goroutine permanently.
func (ps *PolicyScheduler) safeEvaluateAll() {
	defer func() {
		if r := recover(); r != nil {
			slog.Error("policy scheduler: panic in evaluateAll (recovered)", "panic", r)
			metrics.SchedulerPanicsTotal.Inc()
		}
	}()
	ps.evaluateAll()
}

func (ps *PolicyScheduler) evaluateAll() {
	start := time.Now()

	ps.mu.Lock()
	snapshot := make([]cachedPolicy, 0, len(ps.policies))
	policyIDs := make([]uint, 0, len(ps.policies))
	for _, cp := range ps.policies {
		snapshot = append(snapshot, cp)
		if cp.policy.Enabled {
			policyIDs = append(policyIDs, cp.policy.ID)
		}
	}
	ctx := evalContext{
		now:                 start,
		autoWake:            ps.cfg.AutoWake,
		reconcileWhileAwake: ps.cfg.ReconcileWhileAwake,
		enforceSleep:        ps.cfg.EnforceSleep,
	}
	ps.mu.Unlock()

	// Batch-fetch active exceptions for all enabled policies in one query.
	exceptionMap, err := ps.store.ListActiveExceptionsForPolicies(policyIDs, start)
	if err != nil {
		slog.Warn("failed to batch-fetch active exceptions", "err", err)
		return
	}
	ctx.exceptionsByPolicy = exceptionMap

	for _, cp := range snapshot {
		ps.evaluatePolicy(cp, ctx)
	}

	metrics.SchedulerEvaluationsTotal.Inc()
	metrics.SchedulerEvaluationDuration.Observe(time.Since(start).Seconds())
}

func (ps *PolicyScheduler) evaluatePolicy(cp cachedPolicy, ctx evalContext) {
	p := cp.policy
	if !p.Enabled {
		return
	}
	exceptions := ctx.exceptionsByPolicy[p.ID]
	intended := IntendedState(StateInput{
		Windows: cp.windows, Location: cp.loc,
		Exceptions: policyWideExceptions(exceptions), Now: ctx.now,
	})

	if intended == PolicyStateUnknown {
		return
	}

	if p.CurrentState == string(intended) {
		ps.reconcilePolicy(p, ctx)
		return
	}

	if p.CurrentState == store.PolicyStateTransitioning {
		ps.resetStuckTransition(p, ctx.now)
		return
	}

	ps.executeTransition(p, intended, ctx)
}

// reconcilePolicy checks whether a policy that is already in its intended
// state needs corrective action. For awake policies it detects partial-wake
// drift; for sleeping policies it enforces sleep by scaling back workloads
// that were manually scaled up.
func (ps *PolicyScheduler) reconcilePolicy(p store.Policy, ctx evalContext) {
	if ps.reconcileScopedExceptions(p, ctx) {
		return
	}
	if ctx.reconcileWhileAwake && p.CurrentState == store.PolicyStateAwake {
		ps.reconcileAwakePolicy(p, ctx.exceptionsByPolicy[p.ID], ctx.now)
	}
	if ctx.enforceSleep && p.CurrentState == store.PolicyStateSleeping {
		ps.enforceSleepPolicy(p, ctx.exceptionsByPolicy[p.ID], ctx.now)
	}
}

// Scoped work has its own retry clock. Its success cannot stand in for the
// baseline schedule state of workloads outside the exception.
func (ps *PolicyScheduler) reconcileScopedExceptions(p store.Policy, ctx evalContext) bool {
	for _, ex := range ctx.exceptionsByPolicy[p.ID] {
		if !ex.HasTargetingFilters() {
			continue
		}
		ps.mu.Lock()
		if ps.lastExceptionAttempt == nil {
			ps.lastExceptionAttempt = map[uint]time.Time{}
		}
		last, attempted := ps.lastExceptionAttempt[ex.ID]
		if attempted && ctx.now.Sub(last) < reconcileBackoff {
			ps.mu.Unlock()
			continue
		}
		ps.lastExceptionAttempt[ex.ID] = ctx.now
		ps.mu.Unlock()
		direction := directionWake
		if ex.ExceptionType == store.ExceptionTypeForceSleep {
			direction = directionSleep
		}
		scoped := p
		scoped.ExceptionScope = &ex
		if _, err := ps.run(ps.execContext(), scoped, direction, "exception_reconcile"); err != nil {
			slog.Warn("scoped exception reconciliation deferred", "exceptionID", ex.ID, "err", err)
		}
		return true
	}
	return false
}

// reconcileAwakePolicy detects drift from a failed or partial wake and runs a
// corrective wake to restore workloads that are still scaled to zero. It
// bypasses the autoWake gate because this is a fix, not a scheduled transition.
//
// When the policy is awake due to a scoped exception, the corrective wake is
// limited to the exception's namespace/label filters so it doesn't wake
// workloads outside the exception's scope.
func (ps *PolicyScheduler) reconcileAwakePolicy(p store.Policy, exceptions []store.ScheduledException, now time.Time) {
	if !ps.reconcileBackoffElapsed(p.ID, now) {
		return
	}

	count, err := ps.store.CountOpenSnapshotsForRestore(p.ID)
	if err != nil {
		slog.Warn("policy scheduler: failed to count open snapshots",
			"policyID", p.ID, "err", err)
		return
	}
	if count == 0 {
		return
	}

	ps.recordReconcileAttempt(p.ID, now)

	scopedPolicy := p
	// During scheduled sleep, corrective exception wake must remain scoped.
	baseline := IntendedState(StateInput{Windows: parsePolicyWindows(p), Location: locationOrUTC(p.Timezone), Now: now})
	if baseline != PolicyStateAwake {
		for _, ex := range exceptions {
			if ex.ExceptionType == store.ExceptionTypeStayAwake && ex.HasTargetingFilters() {
				scopedPolicy.ExceptionScope = &ex
				break
			}
		}
	}

	slog.Info("policy scheduler: drift detected, running corrective wake",
		"policyID", p.ID, "openSnapshots", count)

	if _, err := ps.run(ps.execContext(), scopedPolicy, directionWake, "reconcile"); err != nil {
		if IsAlreadyRunning(err) {
			slog.Debug("policy scheduler: corrective wake skipped, already running",
				"policyID", p.ID)
		} else {
			slog.Error("policy scheduler: corrective wake failed",
				"policyID", p.ID, "err", err)
		}
	}
}

// enforceSleepPolicy detects workloads manually scaled up while a policy is
// sleeping and scales them back to zero. Uses the same backoff as reconcileAwakePolicy.
func (ps *PolicyScheduler) enforceSleepPolicy(p store.Policy, exceptions []store.ScheduledException, now time.Time) {
	if !ps.reconcileBackoffElapsed(p.ID, now) {
		return
	}

	drifted, err := ps.runner.HasDriftedFromSleep(ps.execContext(), p.ID)
	if err != nil {
		slog.Warn("policy scheduler: enforce sleep drift check failed",
			"policyID", p.ID, "err", err)
		return
	}
	if !drifted {
		return
	}

	ps.recordReconcileAttempt(p.ID, now)

	slog.Info("policy scheduler: drift detected during sleep, running enforce sleep",
		"policyID", p.ID)

	if _, err := ps.run(ps.execContext(), p, directionSleep, "enforce_sleep"); err != nil {
		if IsAlreadyRunning(err) {
			slog.Debug("policy scheduler: enforce sleep skipped, already running",
				"policyID", p.ID)
		} else {
			slog.Error("policy scheduler: enforce sleep failed",
				"policyID", p.ID, "err", err)
		}
	}
}

func (ps *PolicyScheduler) reconcileBackoffElapsed(policyID uint, now time.Time) bool {
	ps.mu.Lock()
	last, ok := ps.lastReconcileAttempt[policyID]
	ps.mu.Unlock()
	return !ok || now.Sub(last) >= reconcileBackoff
}

func (ps *PolicyScheduler) recordReconcileAttempt(policyID uint, now time.Time) {
	ps.mu.Lock()
	ps.lastReconcileAttempt[policyID] = now
	ps.mu.Unlock()
}

// failedTransitionBackoffElapsed returns true if enough time has passed since
// the last failed scheduled transition for this policy. Reuses the same 5-min
// backoff as reconciliation to avoid hammering a broken K8s API every 30s.
func (ps *PolicyScheduler) failedTransitionBackoffElapsed(policyID uint, now time.Time) bool {
	ps.mu.Lock()
	last, ok := ps.lastFailedTransition[policyID]
	ps.mu.Unlock()
	return !ok || now.Sub(last) >= reconcileBackoff
}

func (ps *PolicyScheduler) recordFailedTransition(policyID uint, now time.Time) {
	ps.mu.Lock()
	ps.lastFailedTransition[policyID] = now
	ps.mu.Unlock()
}

func (ps *PolicyScheduler) clearFailedTransition(policyID uint) {
	ps.mu.Lock()
	delete(ps.lastFailedTransition, policyID)
	ps.mu.Unlock()
}

// stuckTimeout returns the stuck-transition timeout for a policy, derived from
// the policy's own execution timeout plus a safety margin. This prevents
// legitimate long drains from being falsely reset.
func stuckTimeout(p store.Policy) time.Duration {
	t := time.Duration(p.TimeoutMinutes) * time.Minute
	if t <= 0 {
		t = defaultExecutionTimeout
	}
	// Add 5 minutes of grace on top of the execution timeout.
	t += 5 * time.Minute
	if t < stuckTransitionTimeoutFloor {
		t = stuckTransitionTimeoutFloor
	}
	return t
}

// resetStuckTransition resets policies stuck in "transitioning" for longer
// than their execution timeout back to "unknown" so the next tick re-evaluates.
func (ps *PolicyScheduler) resetStuckTransition(p store.Policy, now time.Time) {
	ps.mu.Lock()
	_, running := ps.inflightPolicies[p.ID]
	ps.mu.Unlock()
	if running {
		return
	}
	if p.StateSince == nil || now.Sub(*p.StateSince) <= stuckTimeout(p) {
		return
	}
	slog.Warn("policy scheduler: policy stuck in transitioning, resetting to unknown",
		"policyID", p.ID, "stuckSince", p.StateSince)
	if err := ps.store.UpdatePolicyState(p.ID, store.PolicyStateUnknown, nil); err != nil {
		slog.Error("policy scheduler: failed to reset stuck policy state",
			"policyID", p.ID, "err", err)
	}
	ps.mu.Lock()
	if cp, ok := ps.policies[p.ID]; ok {
		cp.policy.CurrentState = store.PolicyStateUnknown
		ps.policies[p.ID] = cp
	}
	ps.mu.Unlock()
}

// executeTransition handles the normal sleep/wake transition path. It respects
// the autoWake gate and backs off after failed transitions.
func (ps *PolicyScheduler) executeTransition(p store.Policy, intended PolicyState, ctx evalContext) {
	direction := directionSleep
	if intended == PolicyStateAwake {
		if !ctx.autoWake {
			return
		}
		direction = directionWake
	}

	// Back off after a failed transition to avoid hammering a broken K8s API.
	if !ps.failedTransitionBackoffElapsed(p.ID, ctx.now) {
		return
	}

	if _, err := ps.run(ps.execContext(), p, direction, "scheduled"); err != nil {
		if IsAlreadyRunning(err) {
			slog.Debug("policy scheduler: execution skipped, already running",
				"policyID", p.ID, "direction", direction)
		} else {
			slog.Error("policy scheduler: scheduled execution failed",
				"policyID", p.ID, "direction", direction, "err", err)
		}
	}
}

// reload refreshes the policy cache. The caller must hold ps.mu.
func (ps *PolicyScheduler) reload() error {
	policies, err := ps.store.ListEnabledPolicies()
	if err != nil {
		return fmt.Errorf("reload policies: %w", err)
	}

	ps.policies = map[uint]cachedPolicy{}
	modeCounts := map[string]float64{}

	for _, p := range policies {
		modeCounts[p.Mode]++

		loc, err := time.LoadLocation(p.Timezone)
		if err != nil {
			slog.Warn("policy scheduler: invalid timezone, skipping policy",
				"policyID", p.ID, "timezone", p.Timezone, "err", err)
			continue
		}

		windows := parsePolicyWindows(p)
		ps.policies[p.ID] = cachedPolicy{policy: p, windows: windows, loc: loc}
		slog.Info("policy scheduler: registered policy",
			"policyID", p.ID, "name", p.Name, "windowCount", len(windows))
	}

	metrics.ActivePolicies.Reset()
	for mode, count := range modeCounts {
		metrics.ActivePolicies.WithLabelValues(mode).Set(count)
	}

	return nil
}

// parsePolicyWindows deserializes the SleepWindows JSON from a policy.
func parsePolicyWindows(p store.Policy) []policy.SleepWindow {
	if p.SleepWindows == "" {
		return nil
	}
	var windows []policy.SleepWindow
	if err := json.Unmarshal([]byte(p.SleepWindows), &windows); err != nil {
		slog.Warn("policy scheduler: failed to parse windows JSON",
			"policyID", p.ID, "err", err)
		return nil
	}
	return windows
}

// locationOrUTC preserves the scheduler fallback for invalid timezone names.
func locationOrUTC(name string) *time.Location {
	loc, err := time.LoadLocation(name)
	if err != nil {
		return time.UTC
	}
	return loc
}

// policyWideExceptions supplies intent only for the baseline policy state.
// Scoped exceptions are reconciled separately against their workload targets.
func policyWideExceptions(exceptions []store.ScheduledException) []store.ScheduledException {
	var global []store.ScheduledException
	for _, ex := range exceptions {
		if !ex.HasTargetingFilters() {
			global = append(global, ex)
		}
	}
	return global
}
