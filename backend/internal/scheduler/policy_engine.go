package scheduler

import (
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

// hasActiveException checks if any exception of the given type is in the slice.
// Exceptions passed here are already filtered to active + time-bounded by the
// store query, so no additional time check is needed.
func hasActiveException(exceptions []store.ScheduledException, exType string) bool {
	for _, ex := range exceptions {
		if ex.ExceptionType == exType {
			return true
		}
	}
	return false
}

// StateInput holds the inputs needed to compute a policy's intended state.
type StateInput struct {
	Windows    []policy.SleepWindow
	Timezone   string
	Overrides  []store.PolicyOverride
	Exceptions []store.ScheduledException
	Now        time.Time
}

// IntendedState computes the policy's intended state at the given time.
//
// Precedence (highest to lowest):
//  1. Active force_sleep override    → sleeping
//  2. Active stay_awake override     → awake
//  3. Active force_sleep exception   → sleeping
//  4. Active stay_awake exception    → awake
//  5. Window-based evaluation
//
// Overrides always outrank exceptions. Within each tier, force_sleep beats stay_awake.
func IntendedState(in StateInput) PolicyState {
	// Tier 1: overrides (operator-created, highest priority)
	if hasActiveWindowedOverride(in.Overrides, "force_sleep", in.Now) {
		return PolicyStateSleeping
	}
	if hasActiveWindowedOverride(in.Overrides, "stay_awake", in.Now) {
		return PolicyStateAwake
	}
	// Tier 2: exceptions (pre-scheduled, lower than overrides)
	if hasActiveException(in.Exceptions, store.ExceptionTypeForceSleep) {
		return PolicyStateSleeping
	}
	if hasActiveException(in.Exceptions, store.ExceptionTypeStayAwake) {
		return PolicyStateAwake
	}
	if len(in.Windows) == 0 {
		return PolicyStateUnknown
	}
	state := policy.Evaluate(in.Windows, in.Timezone, in.Now)
	if state == policy.StateSleeping {
		return PolicyStateSleeping
	}
	return PolicyStateAwake
}

// HasSkipOverride returns true if there is a skip_sleep or skip_wake override
// that is still valid. In the window-native model, skip overrides use a
// ValidUntil-style check: the override is consumed if the direction matches
// and the override hasn't expired.
func HasSkipOverride(overrides []store.PolicyOverride, direction string, now time.Time) *store.PolicyOverride {
	wantType := "skip_sleep"
	if direction == directionWake {
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
