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
	ExecStatusSkipped     = "skipped"
)

// Exception statuses.
const (
	ExceptionStatusPending   = "pending"
	ExceptionStatusActive    = "active"
	ExceptionStatusCompleted = "completed"
	ExceptionStatusCancelled = "cancelled"
)
