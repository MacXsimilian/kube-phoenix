package scheduler

import (
	"fmt"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/policy"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

// PolicyState is the intended state of a policy's workloads at a given time.
type PolicyState string

const (
	PolicyStateSleeping PolicyState = "sleeping"
	PolicyStateAwake    PolicyState = "awake"
	PolicyStateUnknown  PolicyState = "unknown"
)

// PolicyTransitioningError is returned when a scale operation is attempted on a
// policy that is already mid-transition. Callers should use errors.As to detect it.
type PolicyTransitioningError struct {
	PolicyID uint
}

func (e PolicyTransitioningError) Error() string {
	return fmt.Sprintf("policy %d is already transitioning", e.PolicyID)
}

// hasActiveWindowedOverride checks if any override of the given type is active at now.
func hasActiveWindowedOverride(overrides []store.PolicyOverride, overrideType string, now time.Time) bool {
	for _, o := range overrides {
		if o.OverrideType != overrideType || o.StartsAt == nil || o.EndsAt == nil {
			continue
		}
		if !now.Before(*o.StartsAt) && !now.After(*o.EndsAt) {
			return true
		}
	}
	return false
}

// IntendedState computes the policy's intended state at the given time.
//
// Override precedence (highest to lowest):
//  1. Active force_sleep override → sleeping
//  2. Active stay_awake override  → awake
//  3. Window-based evaluation
func IntendedState(windows []policy.SleepWindow, timezone string, overrides []store.PolicyOverride, now time.Time) PolicyState {
	if hasActiveWindowedOverride(overrides, "force_sleep", now) {
		return PolicyStateSleeping
	}
	if hasActiveWindowedOverride(overrides, "stay_awake", now) {
		return PolicyStateAwake
	}
	if len(windows) == 0 {
		return PolicyStateUnknown
	}
	state := policy.Evaluate(windows, timezone, now)
	if state == policy.StateSleeping {
		return PolicyStateSleeping
	}
	return PolicyStateAwake
}

// FindSkipOverride returns the first active skip_sleep or skip_wake override
// for the given direction, or nil if none exists. In the window-native model,
// skip overrides use a ValidUntil-style check: the override is consumed if the
// direction matches and the override hasn't expired.
func FindSkipOverride(overrides []store.PolicyOverride, direction string, now time.Time) *store.PolicyOverride {
	wantType := "skip_sleep"
	if direction == "wake" {
		wantType = "skip_wake"
	}
	for i := range overrides {
		o := &overrides[i]
		if o.OverrideType != wantType {
			continue
		}
		// TargetCronTime is reused as a "valid until" field.
		// Skip if expired.
		if o.TargetCronTime != nil && now.After(*o.TargetCronTime) {
			continue
		}
		return o
	}
	return nil
}

// recoveryAction describes what corrective execution, if any, a policy needs
// during startup recovery.
type recoveryAction string

const (
	recoveryNone  recoveryAction = ""
	recoverySleep recoveryAction = "sleep"
	recoveryWake  recoveryAction = "wake"
)

// determineRecoveryAction evaluates the policy's intended vs current state and
// returns the direction of the corrective execution required, or recoveryNone
// when no action is needed.
func determineRecoveryAction(p store.Policy, intended PolicyState) recoveryAction {
	if intended == PolicyStateUnknown {
		return recoveryNone
	}
	if p.CurrentState == string(intended) {
		return recoveryNone
	}
	if intended == PolicyStateAwake {
		return recoveryWake
	}
	return recoverySleep
}

// ActiveException returns the first ScheduledException that is currently active
// (status = pending/active and window contains now) for the given policy.
func ActiveException(exceptions []store.ScheduledException, policyID *uint, now time.Time) *store.ScheduledException {
	for i := range exceptions {
		e := &exceptions[i]
		if e.Status != store.ExceptionStatusPending && e.Status != store.ExceptionStatusActive {
			continue
		}
		if policyID != nil && e.PolicyID != nil && *e.PolicyID != *policyID {
			continue
		}
		if !now.Before(e.StartsAt) && !now.After(e.EndsAt) {
			return e
		}
	}
	return nil
}
