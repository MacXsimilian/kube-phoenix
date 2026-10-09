// SPDX-License-Identifier: Apache-2.0

package scheduler

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	"gorm.io/gorm"
)

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

	execID, err := RunExceptionAction(ps, *ex.PolicyID, ex, "exception_start")
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
	if ex.SleepOnEnd != nil && *ex.SleepOnEnd && ex.PolicyID != nil {
		if _, err := RevertExceptionAction(ps, *ex.PolicyID, ex, "exception_end"); err != nil {
			slog.Error("exception: revert-on-end failed",
				"exceptionID", ex.ID, "type", ex.ExceptionType, "err", err)
		}
	}
}

// RunExceptionAction dispatches the initial action for an exception:
// stay_awake → wake, force_sleep → sleep. When the exception carries its own
// targeting filters, they intersect the parent policy boundary for this
// execution so only the targeted workloads are affected.
func RunExceptionAction(ps *PolicyScheduler, policyID uint, ex store.ScheduledException, trigger string) (uint, error) {
	if ex.ExceptionType == store.ExceptionTypeForceSleep {
		return ps.runExceptionScoped(policyID, ex, directionSleep, trigger)
	}
	return ps.runExceptionScoped(policyID, ex, directionWake, trigger)
}

// RevertExceptionAction determines the correct post-exception action by
// consulting the current schedule (IntendedState) rather than blindly
// inverting the exception type. This ensures that a force_sleep exception
// ending during a normal sleep window does not incorrectly wake workloads.
// When the exception has targeting filters, only the filtered workloads are
// reverted.
func RevertExceptionAction(ps *PolicyScheduler, policyID uint, ex store.ScheduledException, trigger string) (uint, error) {
	p, err := ps.store.GetPolicy(policyID)
	if err != nil {
		return 0, fmt.Errorf("revert exception: policy %d not found: %w", policyID, err)
	}
	now := time.Now()
	windows := parsePolicyWindows(*p)
	// Do NOT include exceptions — this is called as the exception ends,
	// so we want the schedule-only view.
	intended := IntendedState(StateInput{
		Windows: windows, Timezone: p.Timezone,
		Now: now,
	})

	direction := ""
	switch intended {
	case PolicyStateSleeping:
		direction = directionSleep
	case PolicyStateAwake:
		direction = directionWake
	default:
		slog.Info("exception revert: schedule says unknown, skipping", "policyID", policyID)
		return 0, nil
	}
	return ps.runExceptionScoped(policyID, ex, direction, trigger)
}

// runExceptionScoped attaches targeting filters for the runner to intersect
// with the policy boundary. The policy struct is passed by value so the stored
// copy is never mutated.
func (ps *PolicyScheduler) runExceptionScoped(policyID uint, ex store.ScheduledException, direction, trigger string) (uint, error) {
	p, err := ps.store.GetPolicy(policyID)
	if err != nil {
		return 0, fmt.Errorf("policy %d not found: %w", policyID, err)
	}
	if !p.Enabled {
		slog.Warn("skipping exception on disabled policy", "policyID", policyID, "direction", direction, "trigger", trigger)
		return 0, nil
	}
	if ex.HasTargetingFilters() {
		p.ExceptionScope = &ex
	}

	return ps.run(ps.execContext(), *p, direction, trigger)
}
