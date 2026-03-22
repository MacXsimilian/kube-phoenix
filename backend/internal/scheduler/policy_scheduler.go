package scheduler

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/k8s"
	"github.com/macxsimilian/kube-phoenix/backend/internal/scaler"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	"github.com/robfig/cron/v3"
)

// PolicyBroker is a separate Broker instance for policy executions.
// Kept separate from the schedule Broker to avoid ID collisions between
// the executions and policy_executions tables.
type PolicyBroker = Broker

// PolicyScheduler manages cron entries for all enabled policies.
// Each policy registers two cron entries (sleep + wake). It also runs
// a recovery pass on startup to catch any missed transitions.
type PolicyScheduler struct {
	store   *store.Store
	runner  *scaler.PolicyRunner
	Broker  *PolicyBroker

	mu      sync.Mutex
	cron    *cron.Cron
	// entryIDs maps policyID → [sleepEntryID, wakeEntryID]. A zero ID means
	// the policy has no cron registered in that direction.
	entryIDs map[uint][2]cron.EntryID
}

// NewPolicyScheduler creates a PolicyScheduler. Pass nil k8sClient in tests.
func NewPolicyScheduler(st *store.Store, k8sClient *k8s.Client) *PolicyScheduler {
	return &PolicyScheduler{
		store:    st,
		runner:   scaler.NewPolicyRunner(k8sClient, st),
		Broker:   NewBroker(),
		entryIDs: map[uint][2]cron.EntryID{},
	}
}

// Start loads all enabled policies and starts the cron engine.
func (ps *PolicyScheduler) Start(ctx context.Context) error {
	ps.mu.Lock()
	defer ps.mu.Unlock()
	ps.cron = cron.New()
	if err := ps.reload(); err != nil {
		return err
	}
	ps.cron.Start()
	slog.Info("policy scheduler started")
	return nil
}

// Stop gracefully shuts down the policy cron engine.
func (ps *PolicyScheduler) Stop() {
	if ps.cron != nil {
		ctx := ps.cron.Stop()
		<-ctx.Done()
	}
}

// Reload re-reads all policies from the DB and re-registers cron entries.
// Called after any policy CRUD operation.
func (ps *PolicyScheduler) Reload() error {
	ps.mu.Lock()
	defer ps.mu.Unlock()
	return ps.reload()
}

// Restart stops + recreates the cron engine. Used after a database reset.
func (ps *PolicyScheduler) Restart(ctx context.Context) error {
	ps.Stop()
	ps.mu.Lock()
	ps.cron = cron.New()
	ps.entryIDs = map[uint][2]cron.EntryID{}
	if err := ps.reload(); err != nil {
		ps.mu.Unlock()
		return err
	}
	ps.cron.Start()
	ps.mu.Unlock()
	return nil
}

// NextRuns returns the next scheduled sleep and wake times for a policy,
// or nil if not registered.
func (ps *PolicyScheduler) NextRuns(policyID uint) (nextSleep, nextWake *time.Time) {
	ps.mu.Lock()
	defer ps.mu.Unlock()
	if ps.cron == nil {
		return nil, nil
	}
	ids, ok := ps.entryIDs[policyID]
	if !ok {
		return nil, nil
	}
	if ids[0] != 0 {
		e := ps.cron.Entry(ids[0])
		if e.ID != 0 {
			t := e.Next
			nextSleep = &t
		}
	}
	if ids[1] != 0 {
		e := ps.cron.Entry(ids[1])
		if e.ID != 0 {
			t := e.Next
			nextWake = &t
		}
	}
	return nextSleep, nextWake
}

// RunSleepNow triggers an immediate sleep execution for a policy.
func (ps *PolicyScheduler) RunSleepNow(policyID uint, trigger string) (uint, error) {
	p, err := ps.store.GetPolicy(policyID)
	if err != nil {
		return 0, fmt.Errorf("policy %d not found: %w", policyID, err)
	}
	return ps.run(context.Background(), *p, "sleep", trigger)
}

// RunWakeNow triggers an immediate wake execution for a policy.
func (ps *PolicyScheduler) RunWakeNow(policyID uint, trigger string) (uint, error) {
	p, err := ps.store.GetPolicy(policyID)
	if err != nil {
		return 0, fmt.Errorf("policy %d not found: %w", policyID, err)
	}
	return ps.run(context.Background(), *p, "wake", trigger)
}

// RecoverPolicies compares each enabled policy's CurrentState against the
// cron-computed IntendedState and queues a recovery execution for any mismatch.
// Called once at startup after MarkInterruptedPolicyExecutions.
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
		overrides, _ := ps.store.ListActiveOverrides(p.ID, now)
		intended := IntendedState(p, overrides, now)
		if intended == PolicyStateUnknown {
			continue
		}
		actual := p.CurrentState
		if actual == string(intended) {
			continue
		}
		direction := "sleep"
		if intended == PolicyStateAwake {
			direction = "wake"
		}
		slog.Info("policy scheduler: recovery execution queued",
			"policyID", p.ID, "name", p.Name,
			"actual", actual, "intended", intended, "direction", direction)
		if _, err := ps.run(ctx, p, direction, "recovery"); err != nil {
			slog.Error("policy scheduler: recovery execution failed",
				"policyID", p.ID, "err", err)
		}
	}
	return nil
}

// ─── Exception ticker ─────────────────────────────────────────────────────────

// TickExceptions is called periodically (every minute) to start and end
// ScheduledExceptions whose windows are reached.
func (ps *PolicyScheduler) TickExceptions(ctx context.Context) {
	now := time.Now()
	exceptions, err := ps.store.ListPendingExceptions()
	if err != nil {
		slog.Error("policy scheduler: list pending exceptions failed", "err", err)
		return
	}
	for _, ex := range exceptions {
		ex := ex
		switch ex.Status {
		case "pending":
			if !now.Before(ex.StartsAt) {
				// Window has started — activate and wake the workloads
				if err := ps.store.UpdateScheduledExceptionStatus(ex.ID, "active"); err != nil {
					slog.Error("exception: set active failed", "exceptionID", ex.ID, "err", err)
					continue
				}
				slog.Info("exception started", "exceptionID", ex.ID, "ticketRef", ex.TicketRef)
				if ex.PolicyID != nil {
					if _, err := ps.RunWakeNow(*ex.PolicyID, "exception_start"); err != nil {
						slog.Error("exception: wake failed", "exceptionID", ex.ID, "err", err)
					}
				}
			}
		case "active":
			if now.After(ex.EndsAt) {
				// Window has ended — complete and optionally sleep the workloads
				if err := ps.store.UpdateScheduledExceptionStatus(ex.ID, "completed"); err != nil {
					slog.Error("exception: set completed failed", "exceptionID", ex.ID, "err", err)
					continue
				}
				slog.Info("exception ended", "exceptionID", ex.ID, "ticketRef", ex.TicketRef)
				if ex.SleepOnEnd && ex.PolicyID != nil {
					if _, err := ps.RunSleepNow(*ex.PolicyID, "exception_end"); err != nil {
						slog.Error("exception: sleep-on-end failed", "exceptionID", ex.ID, "err", err)
					}
				}
			}
		}
	}
}

// ─── Internal ─────────────────────────────────────────────────────────────────

func (ps *PolicyScheduler) reload() error {
	policies, err := ps.store.ListPolicies()
	if err != nil {
		return fmt.Errorf("reload policies: %w", err)
	}

	// Remove all existing entries
	for _, ids := range ps.entryIDs {
		if ids[0] != 0 {
			ps.cron.Remove(ids[0])
		}
		if ids[1] != 0 {
			ps.cron.Remove(ids[1])
		}
	}
	ps.entryIDs = map[uint][2]cron.EntryID{}

	for _, p := range policies {
		if !p.Enabled {
			continue
		}
		p := p // capture

		if _, err := time.LoadLocation(p.Timezone); err != nil {
			slog.Warn("policy scheduler: invalid timezone, skipping policy",
				"policyID", p.ID, "timezone", p.Timezone, "err", err)
			continue
		}

		var ids [2]cron.EntryID

		// Register sleep cron
		if p.SleepCron != "" {
			expr := "CRON_TZ=" + p.Timezone + " " + p.SleepCron
			eid, err := ps.cron.AddFunc(expr, func() {
				now := time.Now()
				overrides, _ := ps.store.ListActiveOverrides(p.ID, now)
				// Check for skip_sleep override
				if skip := HasSkipOverride(overrides, "sleep", now); skip != nil {
					slog.Info("policy scheduler: sleep skipped by override",
						"policyID", p.ID, "overrideID", skip.ID)
					_ = ps.store.DeletePolicyOverride(skip.ID)
					return
				}
				if _, err := ps.run(context.Background(), p, "sleep", "scheduled"); err != nil {
					slog.Error("policy scheduler: scheduled sleep failed",
						"policyID", p.ID, "err", err)
				}
			})
			if err != nil {
				slog.Error("policy scheduler: failed to register sleep cron",
					"policyID", p.ID, "cronExpr", p.SleepCron, "err", err)
			} else {
				ids[0] = eid
			}
		}

		// Register wake cron
		if p.WakeCron != "" {
			expr := "CRON_TZ=" + p.Timezone + " " + p.WakeCron
			eid, err := ps.cron.AddFunc(expr, func() {
				now := time.Now()
				overrides, _ := ps.store.ListActiveOverrides(p.ID, now)
				if skip := HasSkipOverride(overrides, "wake", now); skip != nil {
					slog.Info("policy scheduler: wake skipped by override",
						"policyID", p.ID, "overrideID", skip.ID)
					_ = ps.store.DeletePolicyOverride(skip.ID)
					return
				}
				if _, err := ps.run(context.Background(), p, "wake", "scheduled"); err != nil {
					slog.Error("policy scheduler: scheduled wake failed",
						"policyID", p.ID, "err", err)
				}
			})
			if err != nil {
				slog.Error("policy scheduler: failed to register wake cron",
					"policyID", p.ID, "cronExpr", p.WakeCron, "err", err)
			} else {
				ids[1] = eid
			}
		}

		ps.entryIDs[p.ID] = ids
		slog.Info("policy scheduler: registered policy",
			"policyID", p.ID, "name", p.Name,
			"sleepCron", p.SleepCron, "wakeCron", p.WakeCron)
	}

	return nil
}

func (ps *PolicyScheduler) run(ctx context.Context, p store.Policy, direction, trigger string) (uint, error) {
	// Guard: don't start if already transitioning
	if p.CurrentState == "transitioning" {
		return 0, fmt.Errorf("policy %d is already transitioning", p.ID)
	}

	exec := &store.PolicyExecution{
		PolicyID:  p.ID,
		Direction: direction,
		Trigger:   trigger,
		StartedAt: time.Now(),
		Status:    "running",
		Mode:      p.Mode,
	}
	if err := ps.store.CreatePolicyExecution(exec); err != nil {
		return 0, fmt.Errorf("create policy execution: %w", err)
	}
	execID := exec.ID

	_ = ps.store.SetPolicyTransitioning(p.ID)
	slog.Info("policy scheduler: starting execution",
		"policyID", p.ID, "execID", execID, "direction", direction, "trigger", trigger)

	go func() {
		timeout := time.Duration(p.TimeoutMinutes) * time.Minute
		if timeout <= 0 {
			timeout = 2 * time.Hour
		}
		runCtx, cancel := context.WithTimeout(ctx, timeout)
		defer cancel()

		logCh := make(chan scaler.LogLine, 512)
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
				// Publish as store.LogLine (same wire format) to the policy broker
				ps.Broker.Publish(execID, store.LogLine{
					ID:          dbLine.ID,
					ExecutionID: dbLine.ExecutionID,
					Seq:         dbLine.Seq,
					Level:       dbLine.Level,
					Message:     dbLine.Message,
					Timestamp:   dbLine.Timestamp,
				})
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

		status := "success"
		if runErr != nil {
			status = "failed"
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

		// Update policy's cached state
		nextSleep, nextWake := ps.NextRuns(p.ID)
		var newState string
		if status == "success" {
			if direction == "sleep" {
				newState = "sleeping"
			} else {
				newState = "awake"
			}
		} else {
			newState = "unknown"
		}
		_ = ps.store.UpdatePolicyState(p.ID, newState, nextSleep, nextWake)

		slog.Info("policy scheduler: execution finished",
			"policyID", p.ID, "execID", execID, "direction", direction,
			"status", status, "scaled", countMap["scaled"], "errors", countMap["errors"])
	}()

	return execID, nil
}
