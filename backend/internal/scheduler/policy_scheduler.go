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
	"gorm.io/gorm"
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
	ListActiveOverrides(policyID uint, now time.Time) ([]store.PolicyOverride, error)
	ListActiveOverridesForPolicies(policyIDs []uint, now time.Time) (map[uint][]store.PolicyOverride, error)
	CountOpenSnapshotsForRestore(policyID uint) (int64, error)
	UpdatePolicyState(id uint, state string, nextTransition *time.Time) error
	SetPolicyTransitioning(id uint) error
	DeletePolicyOverride(id uint) error
	CreatePolicyExecution(exec *store.PolicyExecution) error
	FinishPolicyExecution(id uint, status string, counts map[string]int) error
	AppendPolicyLogLines(lines []store.PolicyLogLine) error
	ListOpenExceptions() ([]store.ScheduledException, error)
	UpdateScheduledExceptionStatus(id uint, expectedStatus, newStatus string) error
	ListActiveExceptionsForPolicies(policyIDs []uint, now time.Time) (map[uint][]store.ScheduledException, error)
	ListActiveExceptionsForPolicy(policyID uint, now time.Time) ([]store.ScheduledException, error)
}

// policyRunner abstracts the execution engine for sleep/wake operations.
type policyRunner interface {
	RunPolicySleep(ctx context.Context, p store.Policy, execID uint, logCh chan<- scaler.LogLine) (*scaler.Counts, error)
	RunPolicyWake(ctx context.Context, p store.Policy, execID uint, logCh chan<- scaler.LogLine) (*scaler.Counts, error)
}

// SchedulerConfig holds the runtime-tunable settings for the policy evaluation loop.
type SchedulerConfig struct {
	TickInterval        time.Duration
	AutoWake            bool
	ReconcileWhileAwake bool
}

// evalContext carries per-tick configuration into the evaluation functions,
// grouping values that would otherwise be passed as individual arguments.
type evalContext struct {
	now                  time.Time
	autoWake             bool
	reconcileWhileAwake  bool
	overridesByPolicy    map[uint][]store.PolicyOverride      // batch-fetched per tick
	exceptionsByPolicy   map[uint][]store.ScheduledException  // batch-fetched per tick
}

// cachedPolicy holds a parsed in-memory representation of a policy.
type cachedPolicy struct {
	policy  store.Policy
	windows []policy.SleepWindow
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
	parentCtx            context.Context
	policies             map[uint]cachedPolicy
	lastReconcileAttempt map[uint]time.Time
	lastFailedTransition map[uint]time.Time           // backoff for failed scheduled transitions
	inflightPolicies     map[uint]struct{}            // policies with a running execution
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
	ps.mu.Lock()
	ps.parentCtx = ctx
	tickCtx, cancel := context.WithCancel(ctx)
	ps.cancel = cancel
	if err := ps.reload(); err != nil {
		ps.mu.Unlock()
		return err
	}
	ps.mu.Unlock()

	// Recovery runs before the tick loop — no concurrent evaluation.
	if err := ps.RecoverPolicies(ctx); err != nil {
		slog.Error("policy scheduler: recovery failed (continuing)", "err", err)
	}

	interval := ps.cfg.TickInterval
	go ps.tickLoop(tickCtx, interval)
	slog.Info("policy scheduler started")
	return nil
}

// Stop gracefully shuts down the ticker and waits for in-flight executions.
func (ps *PolicyScheduler) Stop() {
	ps.mu.Lock()
	cancel := ps.cancel
	ps.mu.Unlock()
	if cancel != nil {
		cancel()
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
		return ps.Restart(parentCtx)
	}
	return nil
}

// Reload re-reads all policies from the DB. Called after any policy CRUD.
func (ps *PolicyScheduler) Reload() error {
	ps.mu.Lock()
	defer ps.mu.Unlock()
	return ps.reload()
}

// Restart stops and restarts the scheduler. Used after a database reset.
func (ps *PolicyScheduler) Restart(ctx context.Context) error {
	ps.Stop()
	return ps.Start(ctx)
}

// NextTransition returns the next predicted state change for a policy.
func (ps *PolicyScheduler) NextTransition(policyID uint) *time.Time {
	ps.mu.Lock()
	cp, ok := ps.policies[policyID]
	ps.mu.Unlock()
	if !ok {
		return nil
	}
	return policy.NextTransition(cp.windows, cp.policy.Timezone, time.Now())
}

// NextTransitions returns the next transition time for each requested policy
// in a single lock acquisition.
func (ps *PolicyScheduler) NextTransitions(policyIDs []uint) map[uint]*time.Time {
	ps.mu.Lock()
	type entry struct {
		id       uint
		windows  []policy.SleepWindow
		timezone string
	}
	entries := make([]entry, 0, len(policyIDs))
	for _, id := range policyIDs {
		if cp, ok := ps.policies[id]; ok {
			entries = append(entries, entry{id, cp.windows, cp.policy.Timezone})
		}
	}
	ps.mu.Unlock()

	now := time.Now()
	result := make(map[uint]*time.Time, len(entries))
	for _, e := range entries {
		result[e.id] = policy.NextTransition(e.windows, e.timezone, now)
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

// execContext returns a context for execution goroutines. It derives from the
// scheduler's parent context so Stop() can signal in-flight executions to abort,
// rather than hanging until the per-execution timeout (up to 2h) expires.
func (ps *PolicyScheduler) execContext() context.Context {
	ps.mu.Lock()
	ctx := ps.parentCtx
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
		overrides, err := ps.store.ListActiveOverrides(p.ID, now)
		if err != nil {
			slog.Warn("failed to list active overrides", "policyID", p.ID, "err", err)
			overrides = nil
		}
		exceptions, err := ps.store.ListActiveExceptionsForPolicy(p.ID, now)
		if err != nil {
			slog.Warn("failed to list active exceptions", "policyID", p.ID, "err", err)
			exceptions = nil
		}
		intended := IntendedState(StateInput{
			Windows: windows, Timezone: p.Timezone,
			Overrides: overrides, Exceptions: exceptions, Now: now,
		})
		if intended == PolicyStateUnknown {
			continue
		}
		if p.CurrentState == string(intended) {
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

// ─── Exception ticker ─────────────────────────────────────────────────────────

// TickExceptions is called periodically to start and end ScheduledExceptions.
func (ps *PolicyScheduler) TickExceptions(ctx context.Context) {
	now := time.Now()
	exceptions, err := ps.store.ListOpenExceptions()
	if err != nil {
		slog.Error("policy scheduler: list open exceptions failed", "err", err)
		return
	}
	for _, ex := range exceptions {
		switch ex.Status {
		case store.ExceptionStatusPending:
			ps.maybeStartException(ex, now)
		case store.ExceptionStatusActive:
			ps.maybeEndException(ex, now)
		}
	}
}

func (ps *PolicyScheduler) maybeStartException(ex store.ScheduledException, now time.Time) {
	if now.Before(ex.StartsAt) {
		return
	}
	if ex.PolicyID == nil {
		slog.Warn("exception: freestanding exceptions are not yet supported, skipping",
			"exceptionID", ex.ID, "ticketRef", ex.TicketRef)
		return
	}
	if err := ps.store.UpdateScheduledExceptionStatus(ex.ID, store.ExceptionStatusPending, store.ExceptionStatusActive); err != nil {
		// ErrRecordNotFound means another tick already transitioned it — not an error.
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			slog.Error("exception: set active failed", "exceptionID", ex.ID, "err", err)
		}
		return
	}
	slog.Info("exception started", "exceptionID", ex.ID, "type", ex.ExceptionType, "ticketRef", ex.TicketRef)

	execID, err := RunExceptionAction(ps, *ex.PolicyID, ex.ExceptionType, "exception_start")
	if err != nil {
		slog.Warn("exception: start execution failed, reverting to pending",
			"exceptionID", ex.ID, "type", ex.ExceptionType, "err", err)
		if rbErr := ps.store.UpdateScheduledExceptionStatus(ex.ID, store.ExceptionStatusActive, store.ExceptionStatusPending); rbErr != nil {
			slog.Error("exception: revert to pending failed",
				"exceptionID", ex.ID, "err", rbErr)
		}
		return
	}
	slog.Info("exception: execution started", "exceptionID", ex.ID, "execID", execID)
}

func (ps *PolicyScheduler) maybeEndException(ex store.ScheduledException, now time.Time) {
	if !now.After(ex.EndsAt) {
		return
	}
	if err := ps.store.UpdateScheduledExceptionStatus(ex.ID, store.ExceptionStatusActive, store.ExceptionStatusCompleted); err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			slog.Error("exception: set completed failed", "exceptionID", ex.ID, "err", err)
		}
		return
	}
	slog.Info("exception ended", "exceptionID", ex.ID, "type", ex.ExceptionType, "ticketRef", ex.TicketRef)
	if ex.SleepOnEnd && ex.PolicyID != nil {
		if _, err := RevertExceptionAction(ps, *ex.PolicyID, ex.ExceptionType, "exception_end"); err != nil {
			slog.Error("exception: revert-on-end failed",
				"exceptionID", ex.ID, "type", ex.ExceptionType, "err", err)
		}
	}
}

// RunExceptionAction dispatches the initial action for an exception:
// stay_awake → wake, force_sleep → sleep.
func RunExceptionAction(ps *PolicyScheduler, policyID uint, exType string, trigger string) (uint, error) {
	if exType == store.ExceptionTypeForceSleep {
		return ps.RunSleepNow(policyID, trigger, "")
	}
	return ps.RunWakeNow(policyID, trigger, "")
}

// RevertExceptionAction determines the correct post-exception action by
// consulting the current schedule (IntendedState) rather than blindly
// inverting the exception type. This ensures that a force_sleep exception
// ending during a normal sleep window does not incorrectly wake workloads.
func RevertExceptionAction(ps *PolicyScheduler, policyID uint, exType string, trigger string) (uint, error) {
	p, err := ps.store.GetPolicy(policyID)
	if err != nil {
		return 0, fmt.Errorf("revert exception: policy %d not found: %w", policyID, err)
	}
	now := time.Now()
	windows := parsePolicyWindows(*p)
	overrides, err := ps.store.ListActiveOverrides(policyID, now)
	if err != nil {
		slog.Warn("exception revert: failed to fetch overrides, proceeding without",
			"policyID", policyID, "err", err)
	}
	// Do NOT include exceptions — this is called as the exception ends,
	// so we want the schedule-only + override view.
	intended := IntendedState(StateInput{
		Windows: windows, Timezone: p.Timezone,
		Overrides: overrides, Now: now,
	})
	switch intended {
	case PolicyStateSleeping:
		return ps.RunSleepNow(policyID, trigger, "")
	case PolicyStateAwake:
		return ps.RunWakeNow(policyID, trigger, "")
	default:
		slog.Info("exception revert: schedule says unknown, skipping", "policyID", policyID)
		return 0, nil
	}
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
	reconcileBackoff       = 5 * time.Minute
	stuckTransitionTimeout = 10 * time.Minute
)

func (ps *PolicyScheduler) tickLoop(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
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
	}
	ps.mu.Unlock()

	// Batch-fetch overrides for all enabled policies in one query.
	overrideMap, err := ps.store.ListActiveOverridesForPolicies(policyIDs, start)
	if err != nil {
		slog.Warn("failed to batch-fetch active overrides", "err", err)
		overrideMap = map[uint][]store.PolicyOverride{}
	}
	ctx.overridesByPolicy = overrideMap

	// Batch-fetch active exceptions for all enabled policies in one query.
	exceptionMap, err := ps.store.ListActiveExceptionsForPolicies(policyIDs, start)
	if err != nil {
		slog.Warn("failed to batch-fetch active exceptions", "err", err)
		exceptionMap = map[uint][]store.ScheduledException{}
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
	overrides := ctx.overridesByPolicy[p.ID]
	exceptions := ctx.exceptionsByPolicy[p.ID]
	intended := IntendedState(StateInput{
		Windows: cp.windows, Timezone: p.Timezone,
		Overrides: overrides, Exceptions: exceptions, Now: ctx.now,
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

	ps.executeTransition(p, intended, overrides, ctx)
}

// reconcilePolicy checks whether a policy that is already in its intended
// state needs corrective action. Currently this only applies to awake
// policies when reconcileWhileAwake is enabled.
func (ps *PolicyScheduler) reconcilePolicy(p store.Policy, ctx evalContext) {
	if !ctx.reconcileWhileAwake {
		return
	}
	if p.CurrentState != store.PolicyStateAwake {
		return
	}
	ps.reconcileAwakePolicy(p, ctx.now)
}

// reconcileAwakePolicy detects drift from a failed or partial wake and runs a
// corrective wake to restore workloads that are still scaled to zero. It
// bypasses the autoWake gate and skip_wake overrides because this is a fix,
// not a scheduled transition.
func (ps *PolicyScheduler) reconcileAwakePolicy(p store.Policy, now time.Time) {
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

	slog.Info("policy scheduler: drift detected, running corrective wake",
		"policyID", p.ID, "openSnapshots", count)

	if _, err := ps.run(ps.execContext(), p, directionWake, "reconcile"); err != nil {
		if IsAlreadyRunning(err) {
			slog.Debug("policy scheduler: corrective wake skipped, already running",
				"policyID", p.ID)
		} else {
			slog.Error("policy scheduler: corrective wake failed",
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

// resetStuckTransition resets policies stuck in "transitioning" for longer
// than stuckTransitionTimeout back to "unknown" so the next tick re-evaluates.
func (ps *PolicyScheduler) resetStuckTransition(p store.Policy, now time.Time) {
	if p.StateSince == nil || now.Sub(*p.StateSince) <= stuckTransitionTimeout {
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
// the autoWake gate, skip overrides, and backs off after failed transitions.
func (ps *PolicyScheduler) executeTransition(p store.Policy, intended PolicyState, overrides []store.PolicyOverride, ctx evalContext) {
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

	if skip := FindSkipOverride(overrides, direction, ctx.now); skip != nil {
		slog.Info("policy scheduler: transition skipped by override",
			"policyID", p.ID, "overrideID", skip.ID, "direction", direction)
		if err := ps.store.DeletePolicyOverride(skip.ID); err != nil {
			slog.Error("policy scheduler: failed to delete skip override",
				"policyID", p.ID, "overrideID", skip.ID, "err", err)
		}
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

func (ps *PolicyScheduler) reload() error {
	policies, err := ps.store.ListEnabledPolicies()
	if err != nil {
		return fmt.Errorf("reload policies: %w", err)
	}

	ps.policies = map[uint]cachedPolicy{}
	modeCounts := map[string]float64{}

	for _, p := range policies {
		modeCounts[p.Mode]++

		if _, err := time.LoadLocation(p.Timezone); err != nil {
			slog.Warn("policy scheduler: invalid timezone, skipping policy",
				"policyID", p.ID, "timezone", p.Timezone, "err", err)
			continue
		}

		windows := parsePolicyWindows(p)
		ps.policies[p.ID] = cachedPolicy{policy: p, windows: windows}
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
		ps.executeAndFinalize(ctx, p, direction, execID, exec.StartedAt)
	}()

	return execID, nil
}

// executeAndFinalize runs the scaler with a timeout context, drains logs,
// determines the final status, and persists the result.
func (ps *PolicyScheduler) executeAndFinalize(ctx context.Context, p store.Policy, direction string, execID uint, startedAt time.Time) {
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

	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		ps.drainLogChannel(execID, logCh)
	}()

	counts, runErr := ps.executeScaler(runCtx, p, direction, execID, logCh)

	close(logCh)
	wg.Wait()
	ps.Broker.Close(execID)

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
	ps.updatePolicyState(p.ID, direction, status)

	slog.Info("policy scheduler: execution finished",
		"policyID", p.ID, "execID", execID, "direction", direction,
		"status", status, "scaled", countMap["scaled"], "errors", countMap["errors"])
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
func (ps *PolicyScheduler) executeScaler(ctx context.Context, p store.Policy, direction string, execID uint, logCh chan<- scaler.LogLine) (*scaler.Counts, error) {
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
	metrics.ExecutionDuration.WithLabelValues(mode, direction, status).Observe(duration)
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
