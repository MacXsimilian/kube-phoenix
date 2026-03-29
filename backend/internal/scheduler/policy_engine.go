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

// hasActiveException checks if any exception of the given type is in the slice.
// Both policy-wide and namespace-scoped exceptions hold the policy-level state
// to prevent the scheduler from overriding the exception's intent. Scoped
// exceptions limit their wake/sleep action to the filtered namespaces, but they
// still need to prevent the whole policy from transitioning against them.
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
	state := policy.Evaluate(in.Windows, in.Timezone, in.Now)
	if state == policy.StateSleeping {
		return PolicyStateSleeping
	}
	return PolicyStateAwake
}
