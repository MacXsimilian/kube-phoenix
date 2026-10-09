// SPDX-License-Identifier: Apache-2.0

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

// hasActiveException checks exception precedence for the supplied intent scope.
// The scheduler passes only unscoped exceptions for baseline policy evaluation;
// workload-scoped exceptions are applied separately by the runner.
// Inputs are already filtered to active and time-bounded by the store query.
func hasActiveException(exceptions []store.ScheduledException, exType string) bool {
	for _, ex := range exceptions {
		if ex.ExceptionType == exType {
			return true
		}
	}
	return false
}

// StateInput holds the inputs needed to compute a policy's intended state.
// Either Timezone or Location may be set; Location takes precedence and lets
// hot paths skip the per-call time.LoadLocation.
type StateInput struct {
	Windows    []policy.SleepWindow
	Timezone   string
	Location   *time.Location
	Exceptions []store.ScheduledException
	Now        time.Time
}

// IntendedState computes the policy's intended state at the given time.
//
// Precedence (highest to lowest):
//  1. Active force_sleep exception   → sleeping
//  2. Active stay_awake exception    → awake
//  3. Window-based evaluation
//
// Within exceptions, force_sleep beats stay_awake.
func IntendedState(in StateInput) PolicyState {
	if hasActiveException(in.Exceptions, store.ExceptionTypeForceSleep) {
		return PolicyStateSleeping
	}
	if hasActiveException(in.Exceptions, store.ExceptionTypeStayAwake) {
		return PolicyStateAwake
	}
	if len(in.Windows) == 0 {
		return PolicyStateUnknown
	}
	state := evaluateWindows(in)
	if state == policy.StateSleeping {
		return PolicyStateSleeping
	}
	return PolicyStateAwake
}

func evaluateWindows(in StateInput) policy.IntendedState {
	if in.Location != nil {
		return policy.EvaluateInLocation(in.Windows, in.Location, in.Now)
	}
	return policy.Evaluate(in.Windows, in.Timezone, in.Now)
}
