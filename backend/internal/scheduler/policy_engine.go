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

// HasSkipOverride returns true if there is a skip_sleep or skip_wake override
// that is still valid. In the window-native model, skip overrides use a
// ValidUntil-style check: the override is consumed if the direction matches
// and the override hasn't expired.
func HasSkipOverride(overrides []store.PolicyOverride, direction string, now time.Time) *store.PolicyOverride {
	wantType := "skip_sleep"
	if direction == DirectionWake {
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
