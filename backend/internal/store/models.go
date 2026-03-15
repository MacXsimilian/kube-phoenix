package store

import "time"

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
	Position        int    `json:"position"`        // display order within each type group

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type Guardrails struct {
	ID               uint   `gorm:"primaryKey" json:"id"`
	SystemNamespaces string `json:"systemNamespaces"` // comma-separated — protected system defaults, requires confirmation to remove
	SkipNamespaces   string `json:"skipNamespaces"`   // comma-separated — user-managed skip list
	SkipNsNode       string `json:"skipNsNode"`       // comma-separated — namespaces whose pods protect nodes
	SkipNodeLabels   string `json:"skipNodeLabels"`   // comma-separated key=value
	SkipNodeTaints   string `json:"skipNodeTaints"`   // comma-separated key=value:effect

	UpdatedAt time.Time `json:"updatedAt"`
}

type Execution struct {
	ID         uint       `gorm:"primaryKey" json:"id"`
	ScheduleID uint       `gorm:"index" json:"scheduleId"`
	Schedule   Schedule   `gorm:"foreignKey:ScheduleID" json:"schedule"`
	StartedAt  time.Time  `gorm:"index" json:"startedAt"`
	FinishedAt *time.Time `json:"finishedAt"`
	Status     string     `gorm:"index" json:"status"` // "running" | "success" | "failed"
	Mode       string     `json:"mode"`                // "plan" | "apply"

	CountScaled    int `json:"countScaled"`
	CountDrained   int `json:"countDrained"`
	CountDeleted   int `json:"countDeleted"`
	CountSkipped   int `json:"countSkipped"`
	CountErrors    int `json:"countErrors"`
	CountSaved     int `json:"countSaved"`
	CountProtected int `json:"countProtected"`
}

type LogLine struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	ExecutionID uint      `gorm:"index:idx_logline_exec_seq" json:"executionId"`
	Seq         int       `gorm:"index:idx_logline_exec_seq" json:"seq"`
	Level       string    `json:"level"` // "info" | "ok" | "plan" | "error" | "warn"
	Message     string    `json:"message"`
	Timestamp   time.Time `json:"timestamp"`
}
