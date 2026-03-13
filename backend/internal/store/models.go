package store

import (
	"time"
)

// ─── Legacy v1 models (kept for backward compatibility) ───────────────────────

type Schedule struct {
	ID              uint   `gorm:"primaryKey" json:"id"`
	Name            string `json:"name"`
	Type            string `json:"type"` // "scale_down" | "scale_up"
	CronExpr        string `json:"cronExpr"`
	Timezone        string `json:"timezone"`
	Mode            string `json:"mode"` // "plan" | "apply"
	Enabled         bool   `json:"enabled"`
	NamespaceFilter string `json:"namespaceFilter"` // comma-separated; empty = all namespaces
	TimeoutMinutes  int    `json:"timeoutMinutes"`  // 0 = use server default (120 min)

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// Guardrails is the legacy name; GlobalGuardrails is the canonical v2 name.
// Both map to the same table (global_guardrails) via GORM tag.
type Guardrails = GlobalGuardrails

// ─── Global guardrails (singleton, id=1) ─────────────────────────────────────

type GlobalGuardrails struct {
	ID             uint   `gorm:"primaryKey;check:id = 1" json:"id"`
	SkipNamespaces string `json:"skipNamespaces"` // comma-separated
	SkipNsNode     string `json:"skipNsNode"`     // comma-separated — namespaces whose pods protect nodes
	SkipNodeLabels string `json:"skipNodeLabels"` // comma-separated key=value
	SkipNodeTaints string `json:"skipNodeTaints"` // comma-separated key=value:effect

	UpdatedAt time.Time `json:"updatedAt"`
}

func (GlobalGuardrails) TableName() string { return "global_guardrails" }

// ─── Sleep Policies (v2) ──────────────────────────────────────────────────────

type SleepPolicy struct {
	ID                  uint   `gorm:"primaryKey" json:"id"`
	Name                string `gorm:"not null" json:"name"`
	Description         string `json:"description"`
	Tags                string `gorm:"not null;default:''" json:"tags"`                               // comma-separated free-text labels
	Timezone            string `gorm:"not null;default:'UTC'" json:"timezone"`                        // IANA timezone
	Mode                string `gorm:"not null;default:'plan'" json:"mode"`                           // "plan" | "apply"
	NamespaceFilter     string `gorm:"not null;default:''" json:"namespaceFilter"`                    // comma-separated; empty = all
	Enabled             bool   `gorm:"not null;default:true" json:"enabled"`
	DriftCorrectionMode string `gorm:"not null;default:'record'" json:"driftCorrectionMode"`           // "record" | "silent"
	TimeoutMinutes      int    `gorm:"not null;default:0" json:"timeoutMinutes"`                      // 0 = use 120 min default

	// Conflict detection tags (set by conflict detector, not user)
	ConflictTags string `gorm:"not null;default:''" json:"conflictTags"` // comma-separated: CONFLICT, ABSORBED, NO-OP, GUARDRAIL_SHADOW

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`

	// Associations (not stored in this table)
	Windows    []PolicyWindow    `gorm:"foreignKey:PolicyID" json:"windows,omitempty"`
	Guardrails *PolicyGuardrails `gorm:"foreignKey:PolicyID" json:"guardrails,omitempty"`
	Overrides  []PolicyOverride  `gorm:"foreignKey:PolicyID" json:"overrides,omitempty"`
}

// ─── Policy Windows ───────────────────────────────────────────────────────────

type PolicyWindow struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	PolicyID  uint   `gorm:"not null;index" json:"policyId"`
	DaysOfWeek string `gorm:"not null" json:"daysOfWeek"` // JSON array: ["mon","tue","wed","thu","fri"]
	SleepAt   string `gorm:"not null" json:"sleepAt"`    // "HH:MM"
	WakeAt    string `json:"wakeAt"`                     // "HH:MM" or "" = sleep-only

	// Advanced rules (null in simple mode)
	// Schema: {"date_ranges": [{"from": "YYYY-MM-DD", "to": "YYYY-MM-DD"}], "exceptions": ["YYYY-MM-DD"]}
	AdvancedRules []byte `gorm:"type:jsonb" json:"advancedRules,omitempty"`

	CreatedAt time.Time `json:"createdAt"`
}

// ─── Per-Policy Guardrails ────────────────────────────────────────────────────

type PolicyGuardrails struct {
	ID               uint   `gorm:"primaryKey" json:"id"`
	PolicyID         uint   `gorm:"not null;uniqueIndex" json:"policyId"`
	SkipWorkloads    string `gorm:"not null;default:''" json:"skipWorkloads"`   // comma-separated Deployment/StatefulSet names
	SkipNamespaces   string `gorm:"not null;default:''" json:"skipNamespaces"`  // additional namespace exclusions
	SkipNsNode       string `gorm:"not null;default:''" json:"skipNsNode"`      // comma-separated namespaces whose pods protect nodes
	SkipNodeLabels   string `gorm:"not null;default:''" json:"skipNodeLabels"`  // key=value,...
	SkipNodeTaints   string `gorm:"not null;default:''" json:"skipNodeTaints"`  // key=value:effect,...
	MinReplicas      int    `gorm:"not null;default:0" json:"minReplicas"`      // floor replica count; 0 = full sleep
	WorkloadOverrides []byte `gorm:"type:jsonb" json:"workloadOverrides,omitempty"` // reserved for future per-workload min_replicas

	UpdatedAt time.Time `json:"updatedAt"`
}

// ─── Policy Overrides (skip next occurrence) ─────────────────────────────────

type PolicyOverride struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	PolicyID       uint      `gorm:"not null;index:idx_policy_override_date" json:"policyId"`
	OccurrenceDate time.Time `gorm:"not null;index:idx_policy_override_date;type:date" json:"occurrenceDate"`
	Edge           string    `gorm:"not null" json:"edge"`                      // "sleep" | "wake" | "both"
	Action         string    `gorm:"not null;default:'skip'" json:"action"`     // extensible: "skip" | "extend_until"
	CreatedAt      time.Time `json:"createdAt"`
}

func (PolicyOverride) TableName() string { return "policy_overrides" }

// ─── Workload Snapshots (replaces previous-replicas annotations) ──────────────

type WorkloadSnapshot struct {
	ID               uint       `gorm:"primaryKey" json:"id"`
	SleepExecutionID uint       `gorm:"not null;index" json:"sleepExecutionId"`
	WakeExecutionID  *uint      `gorm:"index" json:"wakeExecutionId"`
	PolicyID         *uint      `gorm:"index" json:"policyId"`
	Namespace        string     `gorm:"not null;index:idx_snapshot_workload" json:"namespace"`
	WorkloadName     string     `gorm:"not null;index:idx_snapshot_workload" json:"workloadName"`
	WorkloadKind     string     `gorm:"not null" json:"workloadKind"` // "Deployment" | "StatefulSet"
	ReplicasBefore   int        `gorm:"not null" json:"replicasBefore"`
	ReplicasRestored *int       `json:"replicasRestored"` // null until restored
	SnapshottedAt    time.Time  `gorm:"not null;index:idx_snapshot_workload" json:"snapshottedAt"`
	RestoredAt       *time.Time `gorm:"index:idx_snapshot_workload" json:"restoredAt"` // null until restored
}

// ─── Executions (updated v2) ──────────────────────────────────────────────────

type Execution struct {
	ID            uint       `gorm:"primaryKey" json:"id"`
	ScheduleID    *uint      `gorm:"index" json:"scheduleId"` // kept for v1 backward compat
	Schedule      *Schedule  `gorm:"foreignKey:ScheduleID" json:"schedule,omitempty"`
	PolicyID      *uint      `gorm:"index" json:"policyId"`   // v2 policy reference
	Policy        *SleepPolicy `gorm:"foreignKey:PolicyID" json:"policy,omitempty"`
	ExecutionType string     `gorm:"not null;default:'scheduled';index" json:"executionType"` // "scheduled" | "manual" | "drift_correction" | "skipped"
	Action        string     `gorm:"not null;default:''" json:"action"`                       // "scale_down" | "scale_up" | "" (skipped/unknown)
	StartedAt     time.Time  `gorm:"index" json:"startedAt"`
	FinishedAt    *time.Time `json:"finishedAt"`
	Status        string     `gorm:"index" json:"status"` // "running" | "success" | "failed" | "skipped"
	Mode          string     `json:"mode"`                // "plan" | "apply"

	CountScaled  int `json:"countScaled"`
	CountDrained int `json:"countDrained"`
	CountDeleted int `json:"countDeleted"`
	CountSkipped int `json:"countSkipped"`
	CountErrors  int `json:"countErrors"`
}

// ─── Log Lines ────────────────────────────────────────────────────────────────

type LogLine struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	ExecutionID uint      `gorm:"index:idx_logline_exec_seq" json:"executionId"`
	Seq         int       `gorm:"index:idx_logline_exec_seq" json:"seq"`
	Level       string    `json:"level"` // "info" | "ok" | "plan" | "error" | "warn"
	Message     string    `json:"message"`
	Timestamp   time.Time `json:"timestamp"`
}

// ─── Notifications ────────────────────────────────────────────────────────────

type Notification struct {
	ID          uint       `gorm:"primaryKey" json:"id"`
	PolicyID    *uint      `gorm:"index" json:"policyId"`    // null for cluster-level notifications
	ExecutionID *uint      `gorm:"index" json:"executionId"` // null for non-execution notifications
	Type        string     `gorm:"not null" json:"type"`     // "conflict" | "no_op" | "absorbed" | "execution_failed" | "drift_corrected" | "guardrail_shadow"
	Severity    string     `gorm:"not null" json:"severity"` // "error" | "warning" | "info"
	Message     string     `gorm:"not null" json:"message"`
	Detail      []byte     `gorm:"type:jsonb" json:"detail,omitempty"` // structured data (conflicting policy IDs, etc.)
	Read        bool       `gorm:"not null;default:false" json:"read"`
	CreatedAt   time.Time  `gorm:"index" json:"createdAt"`
	DismissedAt *time.Time `json:"dismissedAt"` // null until dismissed
}
