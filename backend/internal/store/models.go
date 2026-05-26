// SPDX-License-Identifier: Apache-2.0

package store

import (
	"encoding/json"
	"fmt"
	"time"
)

type Guardrails struct {
	ID                  uint   `gorm:"primaryKey" json:"id"`
	ProtectedNamespaces string `gorm:"column:protected_namespaces" json:"protectedNamespaces"` // comma-separated — namespaces this app never scales down or drains; requires confirmation to remove
	SkipNsNode          string `json:"skipNsNode"`                                             // comma-separated — namespaces whose pods protect nodes
	SkipNodeLabels      string `json:"skipNodeLabels"`                                         // comma-separated key=value
	SkipNodeTaints      string `json:"skipNodeTaints"`                                         // comma-separated key=value:effect

	// Scaling priority — namespaces listed here are scaled first, in order.
	ScalingPriorityNamespaces string `json:"scalingPriorityNamespaces"` // comma-separated, ordered

	// Scheduler behaviour — configurable via the UI.
	SchedulerEvalInterval        string `gorm:"size:20;default:'30s'" json:"schedulerEvalInterval"`
	SchedulerAutoWake            bool   `gorm:"default:true" json:"schedulerAutoWake"`
	SchedulerReconcileWhileAwake bool   `gorm:"default:true" json:"schedulerReconcileWhileAwake"`
	SchedulerEnforceSleep        bool   `gorm:"default:true" json:"schedulerEnforceSleep"`
	ScalingConcurrency           int    `gorm:"default:10" json:"scalingConcurrency"`
	WakeWaveSize                 int    `gorm:"default:0" json:"wakeWaveSize"`                // workloads per wave during wake; 0 = disabled
	WakeWavePauseSeconds         int    `gorm:"default:90" json:"wakeWavePauseSeconds"`       // max seconds to wait for pod readiness between waves
	ProtectCriticalPodNodes      bool   `gorm:"default:false" json:"protectCriticalPodNodes"` // opt-in: protect nodes running non-DaemonSet system-node-critical / system-cluster-critical pods

	UpdatedAt time.Time `json:"updatedAt"`
}

const defaultSchedulerEvalInterval = 30 * time.Second

// ParseSchedulerEvalInterval parses SchedulerEvalInterval and falls back to
// the default if the value is empty, invalid, or non-positive.
func (g *Guardrails) ParseSchedulerEvalInterval() time.Duration {
	d, err := time.ParseDuration(g.SchedulerEvalInterval)
	if err != nil || d <= 0 {
		return defaultSchedulerEvalInterval
	}
	return d
}

// ─── User management ─────────────────────────────────────────────────────────

type User struct {
	ID              uint       `gorm:"primaryKey" json:"id"`
	Username        string     `gorm:"uniqueIndex:idx_users_username_source;size:255" json:"username"`
	GivenName       string     `gorm:"size:255" json:"givenName,omitempty"`
	FamilyName      string     `gorm:"size:255" json:"familyName,omitempty"`
	Email           string     `gorm:"size:255" json:"email,omitempty"`
	PasswordHash    string     `gorm:"column:password_hash;size:72" json:"-"`
	Role            string     `gorm:"size:20;default:viewer" json:"role"`                                        // admin | operator | viewer
	Source          string     `gorm:"uniqueIndex:idx_users_username_source;size:20;default:local" json:"source"` // local | oidc
	OIDCSubject     *string    `gorm:"column:oidc_subject;uniqueIndex;size:255" json:"-"`                         // OIDC sub claim
	Enabled         bool       `gorm:"default:true" json:"enabled"`
	DefaultTimezone string     `gorm:"size:64;default:'UTC'" json:"defaultTimezone"`
	CreatedAt       time.Time  `json:"createdAt"`
	UpdatedAt       time.Time  `json:"updatedAt"`
	LastLoginAt     *time.Time `json:"lastLoginAt,omitempty"`
}

type Session struct {
	ID           uint      `gorm:"primaryKey"`
	Token        string    `gorm:"uniqueIndex;size:64"`
	UserID       uint      `gorm:"index"`
	User         User      `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE"`
	IPAddress    string    `gorm:"size:45"`
	UserAgent    string    `gorm:"size:512"`
	ExpiresAt    time.Time `gorm:"index"` // sliding window
	MaxExpiresAt time.Time // absolute hard cap
	CreatedAt    time.Time
}

type AuditLog struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	UserID       *uint     `gorm:"index" json:"userId,omitempty"`
	User         *User     `gorm:"foreignKey:UserID;constraint:OnDelete:SET NULL" json:"-"`
	Username     string    `gorm:"size:255" json:"username"`
	Action       string    `gorm:"index;size:100" json:"action"`
	ResourceType string    `gorm:"size:50" json:"resourceType,omitempty"`
	ResourceID   *uint     `json:"resourceId,omitempty"`
	Before       string    `gorm:"type:jsonb" json:"before,omitempty"`
	After        string    `gorm:"type:jsonb" json:"after,omitempty"`
	IPAddress    string    `gorm:"size:45" json:"ipAddress,omitempty"`
	Timestamp    time.Time `gorm:"index" json:"timestamp"`
}

// ─── Policy model ─────────────────────────────────────────────────────────────

// WorkloadTarget identifies a specific Kubernetes workload.
type WorkloadTarget struct {
	Kind      string `json:"kind"` // "Deployment" | "StatefulSet"
	Namespace string `json:"namespace"`
	Name      string `json:"name"`
}

// Policy is a unified sleep/wake schedule that governs a set of workloads.
// It replaces the separate scale_down + scale_up schedule pair with a single
// entity that declares the awake window and tracks current state.
type Policy struct {
	ID              uint   `gorm:"primaryKey" json:"id"`
	Name            string `gorm:"size:255" json:"name"`
	Description     string `gorm:"size:1024" json:"description"`
	NamespaceFilter string `gorm:"size:4096" json:"namespaceFilter"` // comma-separated; empty = all
	LabelSelector   string `gorm:"size:4096" json:"labelSelector"`   // full k8s label selector syntax

	// Schedule — SleepWindows is the sole schedule source of truth.
	SleepWindows string `gorm:"type:text" json:"-"` // JSON array of policy.SleepWindow
	Timezone     string `gorm:"size:100" json:"timezone"`

	Mode           string `gorm:"size:10" json:"mode"` // "plan" | "apply"
	Enabled        bool   `gorm:"default:false" json:"enabled"`
	TimeoutMinutes int    `json:"timeoutMinutes"` // 0 = server default (120 min)

	// Derived state — cached after each execution, updated by the policy scheduler.
	CurrentState     string     `gorm:"size:20;default:unknown;index" json:"currentState"` // sleeping|awake|unknown|transitioning
	StateSince       *time.Time `json:"stateSince"`
	LastSleepAt      *time.Time `json:"lastSleepAt"`
	LastWakeAt       *time.Time `json:"lastWakeAt"`
	NextTransitionAt *time.Time `json:"nextTransitionAt"` // next predicted state flip

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// PolicyExecution records a single sleep or wake run driven by a Policy.
type PolicyExecution struct {
	ID         uint       `gorm:"primaryKey" json:"id"`
	PolicyID   uint       `gorm:"index;index:idx_pe_policy_started,priority:1" json:"policyId"`
	Policy     Policy     `gorm:"foreignKey:PolicyID;constraint:OnDelete:CASCADE" json:"policy"`
	Direction  string     `gorm:"size:10;index" json:"direction"` // "sleep" | "wake"
	Trigger    string     `gorm:"size:30" json:"trigger"`         // scheduled|manual_sleep|manual_wake|recovery|skip_applied|override_start|override_end|exception_start|exception_end
	StartedAt  time.Time  `gorm:"index;index:idx_pe_policy_started,priority:2,sort:desc" json:"startedAt"`
	FinishedAt *time.Time `json:"finishedAt"`
	Status     string     `gorm:"index;size:20" json:"status"` // running|success|failed|interrupted|skipped
	Mode       string     `gorm:"size:10" json:"mode"`         // "plan" | "apply"

	CountScaled    int `json:"countScaled"`
	CountSkipped   int `json:"countSkipped"`
	CountErrors    int `json:"countErrors"`
	CountProtected int `json:"countProtected"`
	CountDrained   int `json:"countDrained"`
	CountDeleted   int `json:"countDeleted"`
}

// PolicyLogLine is a structured log line for a PolicyExecution.
type PolicyLogLine struct {
	ID          uint            `gorm:"primaryKey" json:"id"`
	ExecutionID uint            `gorm:"index:idx_pll_exec_seq" json:"executionId"`
	Execution   PolicyExecution `gorm:"foreignKey:ExecutionID;constraint:OnDelete:CASCADE" json:"-"`
	Seq         int             `gorm:"index:idx_pll_exec_seq" json:"seq"`
	Level       string          `gorm:"size:10" json:"level"` // "info" | "ok" | "plan" | "error" | "warn"
	Message     string          `json:"message"`
	Timestamp   time.Time       `json:"timestamp"`
}

// WorkloadSnapshot records the replica count of a workload at sleep time.
// The wake execution reads from these rows instead of K8s annotations (which
// are also written as a belt-and-suspenders fallback).
type WorkloadSnapshot struct {
	ID               uint            `gorm:"primaryKey" json:"id"`
	PolicyID         uint            `gorm:"index;index:idx_ws_policy_wake,priority:1" json:"policyId"`
	Policy           Policy          `gorm:"foreignKey:PolicyID;constraint:OnDelete:CASCADE" json:"-"`
	SleepExecutionID uint            `gorm:"index" json:"sleepExecutionId"`
	SleepExecution   PolicyExecution `gorm:"foreignKey:SleepExecutionID;constraint:OnDelete:CASCADE" json:"-"`
	// WakeExecutionID is null while the workload is still sleeping.
	WakeExecutionID  *uint      `gorm:"index;index:idx_ws_policy_wake,priority:2" json:"wakeExecutionId"`
	Kind             string     `gorm:"size:50" json:"kind"`
	Namespace        string     `gorm:"size:63;index" json:"namespace"`
	Name             string     `gorm:"size:253" json:"name"`
	ReplicasBefore   int32      `json:"replicasBefore"`
	ReplicasRestored *int32     `json:"replicasRestored"` // nil until woken
	RestoredAt       *time.Time `json:"restoredAt"`

	// Edge case flags
	WasAlreadyZero   bool `json:"wasAlreadyZero"`   // was at 0 before we touched it
	WasDeletedAtWake bool `json:"wasDeletedAtWake"` // workload gone when we tried to restore
	// ExternallyScaled indicates the workload was scaled by an external actor during the sleep period.
	WasExternallyScaled bool `json:"wasExternallyScaled"`

	CapturedAt time.Time `gorm:"index" json:"capturedAt"`
}

// ScheduledException is a future one-time window that overrides normal sleep/wake
// behaviour for specific workloads. It supports the "ticket" use case: create now,
// executes automatically later.
type ScheduledException struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	PolicyID      *uint     `gorm:"index;index:idx_se_policy_status_window,priority:1" json:"policyId"` // optional — can be freestanding
	Policy        *Policy   `gorm:"foreignKey:PolicyID;constraint:OnDelete:CASCADE" json:"-"`
	ExceptionType string    `gorm:"size:20" json:"exceptionType"` // "stay_awake" | "force_sleep"
	StartsAt      time.Time `gorm:"index;index:idx_se_status_starts,priority:2;index:idx_se_policy_status_window,priority:3" json:"startsAt"`
	EndsAt        time.Time `gorm:"index:idx_se_status_ends;index:idx_se_policy_status_window,priority:4" json:"endsAt"`
	TicketRef     string    `gorm:"size:255" json:"ticketRef"` // JIRA-123, GH-456, etc.
	Reason        string    `gorm:"size:1024" json:"reason"`
	SleepOnEnd    *bool     `gorm:"default:true" json:"sleepOnEnd"` // return to policy state at EndsAt

	// Freestanding target (used when PolicyID is nil or for workload-level targeting)
	NamespaceFilter string `gorm:"size:4096" json:"namespaceFilter"`
	LabelSelector   string `gorm:"size:4096" json:"labelSelector"`

	// WorkloadTargets is a JSON array of WorkloadTarget for specific workload targeting.
	WorkloadTargets string `gorm:"type:jsonb;default:'[]'" json:"-"`

	// Lifecycle
	Status           string           `gorm:"index;size:20;default:pending;index:idx_se_status_starts,priority:1;index:idx_se_status_ends,priority:1;index:idx_se_policy_status_window,priority:2" json:"status"` // pending|active|completed|cancelled
	StartExecutionID *uint            `json:"startExecutionId"`
	StartExecution   *PolicyExecution `gorm:"foreignKey:StartExecutionID;constraint:OnDelete:SET NULL" json:"-"`
	EndExecutionID   *uint            `json:"endExecutionId"`
	EndExecution     *PolicyExecution `gorm:"foreignKey:EndExecutionID;constraint:OnDelete:SET NULL" json:"-"`
	CancelledAt      *time.Time       `json:"cancelledAt"`
	CancelReason     string           `gorm:"size:1024" json:"cancelReason"`

	CreatedBy string    `gorm:"size:255" json:"createdBy"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// HasTargetingFilters reports whether the exception narrows scope beyond
// the parent policy via namespace filter or label selector.
func (e *ScheduledException) HasTargetingFilters() bool {
	return e.NamespaceFilter != "" || e.LabelSelector != ""
}

// GetWorkloadTargets deserialises the JSON-stored workload targets.
func (e *ScheduledException) GetWorkloadTargets() ([]WorkloadTarget, error) {
	if e.WorkloadTargets == "" || e.WorkloadTargets == "[]" {
		return []WorkloadTarget{}, nil
	}
	var targets []WorkloadTarget
	if err := json.Unmarshal([]byte(e.WorkloadTargets), &targets); err != nil {
		return nil, fmt.Errorf("unmarshal workload targets for exception %d: %w", e.ID, err)
	}
	return targets, nil
}

// SetWorkloadTargets serialises workload targets to JSON for storage.
func (e *ScheduledException) SetWorkloadTargets(targets []WorkloadTarget) error {
	b, err := json.Marshal(targets)
	if err != nil {
		return err
	}
	e.WorkloadTargets = string(b)
	return nil
}
