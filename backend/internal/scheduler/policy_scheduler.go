package scheduler

import (
	"context"
	"encoding/json"
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

// PolicyBroker is an alias for Broker, used for policy executions.
type PolicyBroker = Broker

// SchedulerConfig holds the runtime-tunable settings for the policy evaluation loop.
type SchedulerConfig struct {
	TickInterval        time.Duration
	AutoWake            bool
	ReconcileWhileAwake bool
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
	store  *store.Store
	runner *scaler.PolicyRunner
	Broker *PolicyBroker
	cfg    SchedulerConfig

	mu        sync.Mutex
	cancel    context.CancelFunc
	parentCtx context.Context
	policies  map[uint]cachedPolicy
}

// NewPolicyScheduler creates a PolicyScheduler. Pass nil k8sClient in tests.
func NewPolicyScheduler(st *store.Store, k8sClient *k8s.Client, cfg SchedulerConfig) *PolicyScheduler {
	return &PolicyScheduler{
		store:    st,
		runner:   scaler.NewPolicyRunner(k8sClient, st),
		Broker:   NewBroker(),
		policies: map[uint]cachedPolicy{},
		cfg:      cfg,
	}
}

// Start loads all enabled policies and begins the evaluation ticker.
func (ps *PolicyScheduler) Start(ctx context.Context) error {
	ps.mu.Lock()
	defer ps.mu.Unlock()
	ps.parentCtx = ctx
	ctx, ps.cancel = context.WithCancel(ctx)
	if err := ps.reload(); err != nil {
		return err
	}
	interval := ps.cfg.TickInterval
	go ps.tickLoop(ctx, interval)
	slog.Info("policy scheduler started")
	return nil
}

// Stop gracefully shuts down the ticker.
func (ps *PolicyScheduler) Stop() {
	ps.mu.Lock()
	cancel := ps.cancel
	ps.mu.Unlock()
	if cancel != nil {
		cancel()
	}
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

// RunSleepNow triggers an immediate sleep execution for a policy.
func (ps *PolicyScheduler) RunSleepNow(policyID uint, trigger string) (uint, error) {
	p, err := ps.store.GetPolicy(policyID)
	if err != nil {
		return 0, fmt.Errorf("policy %d not found: %w", policyID, err)
	}
	if !p.Enabled {
		slog.Warn("manual trigger on disabled policy", "policyID", policyID, "direction", "sleep", "trigger", trigger)
	}
	return ps.run(context.Background(), *p, "sleep", trigger)
}

// RunWakeNow triggers an immediate wake execution for a policy.
func (ps *PolicyScheduler) RunWakeNow(policyID uint, trigger string) (uint, error) {
	p, err := ps.store.GetPolicy(policyID)
	if err != nil {
		return 0, fmt.Errorf("policy %d not found: %w", policyID, err)
	}
	if !p.Enabled {
		slog.Warn("manual trigger on disabled policy", "policyID", policyID, "direction", "wake", "trigger", trigger)
	}
	return ps.run(context.Background(), *p, "wake", trigger)
}

// RecoverPolicies compares each enabled policy's CurrentState against the
// window-evaluated IntendedState and queues a recovery execution for any
// mismatch. Called once at startup.
func (ps *PolicyScheduler) RecoverPolicies(ctx context.Context) error {
	policies, err := ps.store.ListPolicies()
	if err != nil {
		return fmt.Errorf("recovery: list policies: %w", err)
	}
	now := time.Now()
	for _, p := range policies {
		if !p.Enabled {
			continue
		}
		windows := parsePolicyWindows(p)
		overrides, err := ps.store.ListActiveOverrides(p.ID, now)
		if err != nil {
			slog.Warn("failed to list active overrides", "policyID", p.ID, "err", err)
			overrides = nil
		}
		intended := IntendedState(windows, p.Timezone, overrides, now)
		if intended == PolicyStateUnknown {
			continue
		}
		if p.CurrentState == string(intended) {
			continue
		}
		direction := "sleep"
		if intended == PolicyStateAwake {
			direction = "wake"
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
	if err := ps.store.UpdateScheduledExceptionStatus(ex.ID, store.ExceptionStatusActive); err != nil {
		slog.Error("exception: set active failed", "exceptionID", ex.ID, "err", err)
		return
	}
	slog.Info("exception started", "exceptionID", ex.ID, "ticketRef", ex.TicketRef)
	if ex.PolicyID != nil {
		if _, err := ps.RunWakeNow(*ex.PolicyID, "exception_start"); err != nil {
			slog.Error("exception: wake failed", "exceptionID", ex.ID, "err", err)
		}
	}
}

func (ps *PolicyScheduler) maybeEndException(ex store.ScheduledException, now time.Time) {
	if !now.After(ex.EndsAt) {
		return
	}
	if err := ps.store.UpdateScheduledExceptionStatus(ex.ID, store.ExceptionStatusCompleted); err != nil {
		slog.Error("exception: set completed failed", "exceptionID", ex.ID, "err", err)
		return
	}
	slog.Info("exception ended", "exceptionID", ex.ID, "ticketRef", ex.TicketRef)
	if ex.SleepOnEnd && ex.PolicyID != nil {
		if _, err := ps.RunSleepNow(*ex.PolicyID, "exception_end"); err != nil {
			slog.Error("exception: sleep-on-end failed", "exceptionID", ex.ID, "err", err)
		}
	}
}

// ─── Internal ─────────────────────────────────────────────────────────────────

const (
	defaultExecutionTimeout = 2 * time.Hour
	execLogChannelBuffer    = 512
)

func (ps *PolicyScheduler) tickLoop(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			ps.evaluateAll()
		}
	}
}

func (ps *PolicyScheduler) evaluateAll() {
	ps.mu.Lock()
	snapshot := make([]cachedPolicy, 0, len(ps.policies))
	for _, cp := range ps.policies {
		snapshot = append(snapshot, cp)
	}
	autoWake := ps.cfg.AutoWake
	reconcileWhileAwake := ps.cfg.ReconcileWhileAwake
	ps.mu.Unlock()

	now := time.Now()
	for _, cp := range snapshot {
		ps.evaluatePolicy(cp, now, autoWake, reconcileWhileAwake)
	}
}

func (ps *PolicyScheduler) evaluatePolicy(cp cachedPolicy, now time.Time, autoWake bool, reconcileWhileAwake bool) {
	p := cp.policy
	if !p.Enabled {
		return
	}
	if !reconcileWhileAwake && p.CurrentState == store.PolicyStateAwake {
		return
	}

	overrides, err := ps.store.ListActiveOverrides(p.ID, now)
	if err != nil {
		slog.Warn("failed to list active overrides", "policyID", p.ID, "err", err)
		overrides = nil
	}
	intended := IntendedState(cp.windows, p.Timezone, overrides, now)

	if intended == PolicyStateUnknown {
		return
	}
	if p.CurrentState == string(intended) || p.CurrentState == store.PolicyStateTransitioning {
		return
	}

	direction := "sleep"
	if intended == PolicyStateAwake {
		if !autoWake {
			return
		}
		direction = "wake"
	}

	// Check for skip override.
	if skip := HasSkipOverride(overrides, direction, now); skip != nil {
		slog.Info("policy scheduler: transition skipped by override",
			"policyID", p.ID, "overrideID", skip.ID, "direction", direction)
		_ = ps.store.DeletePolicyOverride(skip.ID)
		return
	}

	if _, err := ps.run(context.Background(), p, direction, "scheduled"); err != nil {
		slog.Error("policy scheduler: scheduled execution failed",
			"policyID", p.ID, "direction", direction, "err", err)
	}
}

func (ps *PolicyScheduler) reload() error {
	policies, err := ps.store.ListPolicies()
	if err != nil {
		return fmt.Errorf("reload policies: %w", err)
	}

	ps.policies = map[uint]cachedPolicy{}
	modeCounts := map[string]float64{}

	for _, p := range policies {
		if !p.Enabled {
			continue
		}
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

func (ps *PolicyScheduler) run(ctx context.Context, p store.Policy, direction, trigger string) (uint, error) {
	ps.mu.Lock()
	fresh, err := ps.store.GetPolicy(p.ID)
	if err != nil {
		ps.mu.Unlock()
		return 0, fmt.Errorf("policy %d lookup: %w", p.ID, err)
	}
	if fresh.CurrentState == store.PolicyStateTransitioning {
		ps.mu.Unlock()
		return 0, fmt.Errorf("policy %d is already transitioning", p.ID)
	}
	_ = ps.store.SetPolicyTransitioning(p.ID)
	ps.mu.Unlock()

	exec := &store.PolicyExecution{
		PolicyID:  p.ID,
		Direction: direction,
		Trigger:   trigger,
		StartedAt: time.Now(),
		Status:    store.ExecStatusRunning,
		Mode:      p.Mode,
	}
	if err := ps.store.CreatePolicyExecution(exec); err != nil {
		return 0, fmt.Errorf("create policy execution: %w", err)
	}
	execID := exec.ID
	slog.Info("policy scheduler: starting execution",
		"policyID", p.ID, "execID", execID, "direction", direction, "trigger", trigger)

	go func() {
		timeout := time.Duration(p.TimeoutMinutes) * time.Minute
		if timeout <= 0 {
			timeout = defaultExecutionTimeout
		}
		runCtx, cancel := context.WithTimeout(ctx, timeout)
		defer cancel()

		logCh := make(chan scaler.LogLine, execLogChannelBuffer)
		seq := 0

		var wg sync.WaitGroup
		wg.Add(1)
		go func() {
			defer wg.Done()
			for line := range logCh {
				seq++
				dbLine := store.PolicyLogLine{
					ExecutionID: execID,
					Seq:         seq,
					Level:       line.Level,
					Message:     line.Message,
					Timestamp:   line.Time,
				}
				if err := ps.store.AppendPolicyLogLine(&dbLine); err != nil {
					slog.Error("policy scheduler: log persist error", "execID", execID, "err", err)
				}
				ps.Broker.Publish(execID, dbLine)
			}
		}()

		var counts *scaler.Counts
		var runErr error

		switch direction {
		case "sleep":
			counts, runErr = ps.runner.RunPolicySleep(runCtx, p, execID, logCh)
		case "wake":
			counts, runErr = ps.runner.RunPolicyWake(runCtx, p, execID, logCh)
		default:
			runErr = fmt.Errorf("unknown direction: %s", direction)
		}

		close(logCh)
		wg.Wait()
		ps.Broker.Close(execID)

		status := store.ExecStatusSuccess
		if runErr != nil {
			status = store.ExecStatusFailed
			slog.Error("policy scheduler: execution failed", "execID", execID, "err", runErr)
		}

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

		// Record Prometheus metrics
		duration := time.Since(exec.StartedAt).Seconds()
		metrics.ExecutionsTotal.WithLabelValues(status, p.Mode, direction).Inc()
		metrics.ExecutionDuration.WithLabelValues(p.Mode, direction, status).Observe(duration)
		if counts != nil {
			metrics.WorkloadsScaledTotal.WithLabelValues(direction).Add(float64(counts.Scaled))
			metrics.NodesDrainedTotal.Add(float64(counts.Drained))
			metrics.NodesDeletedTotal.Add(float64(counts.Deleted))
		}

		// Update policy's cached state
		nextTransition := ps.NextTransition(p.ID)
		var newState string
		if status == store.ExecStatusSuccess {
			if direction == "sleep" {
				newState = store.PolicyStateSleeping
			} else {
				newState = store.PolicyStateAwake
			}
		} else {
			newState = store.PolicyStateUnknown
		}
		_ = ps.store.UpdatePolicyState(p.ID, newState, nextTransition)

		slog.Info("policy scheduler: execution finished",
			"policyID", p.ID, "execID", execID, "direction", direction,
			"status", status, "scaled", countMap["scaled"], "errors", countMap["errors"])
	}()

	return execID, nil
}
