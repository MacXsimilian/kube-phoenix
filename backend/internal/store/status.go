// SPDX-License-Identifier: Apache-2.0

package store

// Policy states.
const (
	PolicyStateSleeping      = "sleeping"
	PolicyStateAwake         = "awake"
	PolicyStateUnknown       = "unknown"
	PolicyStateTransitioning = "transitioning"
)

// Policy modes.
const (
	PolicyModeApply = "apply"
	PolicyModePlan  = "plan"
)

// Execution statuses.
const (
	ExecStatusRunning     = "running"
	ExecStatusSuccess     = "success"
	ExecStatusFailed      = "failed"
	ExecStatusInterrupted = "interrupted"
)

// Exception statuses.
const (
	ExceptionStatusPending   = "pending"
	ExceptionStatusActive    = "active"
	ExceptionStatusCompleted = "completed"
	ExceptionStatusCancelled = "cancelled"
)

// Exception types.
const (
	ExceptionTypeStayAwake  = "stay_awake"
	ExceptionTypeForceSleep = "force_sleep"
)
