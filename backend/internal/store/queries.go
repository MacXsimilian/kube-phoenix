package store

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

// ─── Schedules (v1 legacy) ────────────────────────────────────────────────────

func (s *Store) ListSchedules() ([]Schedule, error) {
	var schedules []Schedule
	return schedules, s.db.Find(&schedules).Error
}

func (s *Store) GetSchedule(id uint) (*Schedule, error) {
	var sc Schedule
	return &sc, s.db.First(&sc, id).Error
}

func (s *Store) CreateSchedule(sc *Schedule) error {
	return s.db.Create(sc).Error
}

func (s *Store) UpdateSchedule(id uint, updates map[string]interface{}) (*Schedule, error) {
	// "type" is intentionally excluded — schedule type is immutable after creation.
	allowed := map[string]bool{
		"name": true, "cron_expr": true, "timezone": true,
		"mode": true, "enabled": true, "namespace_filter": true,
	}
	for k := range updates {
		if !allowed[k] {
			delete(updates, k)
		}
	}
	if err := s.db.Model(&Schedule{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return nil, err
	}
	return s.GetSchedule(id)
}

func (s *Store) DeleteSchedule(id uint) error {
	return s.db.Delete(&Schedule{}, id).Error
}

// ─── Global Guardrails ────────────────────────────────────────────────────────

func (s *Store) GetGuardrails() (*GlobalGuardrails, error) {
	var g GlobalGuardrails
	return &g, s.db.First(&g).Error
}

func (s *Store) UpdateGuardrails(updates map[string]interface{}) (*GlobalGuardrails, error) {
	if err := s.db.Model(&GlobalGuardrails{}).Where("id = 1").Updates(updates).Error; err != nil {
		return nil, err
	}
	return s.GetGuardrails()
}

// ─── Executions ───────────────────────────────────────────────────────────────

func (s *Store) CreateExecution(e *Execution) error {
	return s.db.Create(e).Error
}

func (s *Store) UpdateExecution(id uint, updates map[string]interface{}) error {
	return s.db.Model(&Execution{}).Where("id = ?", id).Updates(updates).Error
}

func (s *Store) GetExecution(id uint) (*Execution, error) {
	var e Execution
	return &e, s.db.Preload("Schedule").Preload("Policy").First(&e, id).Error
}

type ExecutionFilter struct {
	ScheduleID    *uint
	PolicyID      *uint
	Status        string
	ExecutionType string
	Page          int
	PageSize      int
}

type ExecutionPage struct {
	Items []Execution `json:"items"`
	Total int64       `json:"total"`
}

func (s *Store) ListExecutions(f ExecutionFilter) (*ExecutionPage, error) {
	q := s.db.Model(&Execution{}).Preload("Schedule").Preload("Policy")
	if f.ScheduleID != nil {
		q = q.Where("schedule_id = ?", *f.ScheduleID)
	}
	if f.PolicyID != nil {
		q = q.Where("policy_id = ?", *f.PolicyID)
	}
	if f.Status != "" {
		q = q.Where("status = ?", f.Status)
	}
	if f.ExecutionType != "" {
		q = q.Where("execution_type = ?", f.ExecutionType)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, err
	}

	if f.PageSize <= 0 {
		f.PageSize = 20
	}
	offset := (f.Page) * f.PageSize

	var items []Execution
	if err := q.Order("started_at desc").Limit(f.PageSize).Offset(offset).Find(&items).Error; err != nil {
		return nil, err
	}
	return &ExecutionPage{Items: items, Total: total}, nil
}

func (s *Store) FinishExecution(id uint, status string, counts map[string]int) error {
	now := time.Now()
	return s.db.Model(&Execution{}).Where("id = ?", id).Updates(map[string]interface{}{
		"finished_at":   now,
		"status":        status,
		"count_scaled":  counts["scaled"],
		"count_drained": counts["drained"],
		"count_deleted": counts["deleted"],
		"count_skipped": counts["skipped"],
		"count_errors":  counts["errors"],
	}).Error
}

// ─── Log Lines ────────────────────────────────────────────────────────────────

func (s *Store) AppendLogLine(line *LogLine) error {
	return s.db.Create(line).Error
}

func (s *Store) GetLogLines(executionID uint) ([]LogLine, error) {
	var lines []LogLine
	return lines, s.db.Where("execution_id = ?", executionID).Order("seq asc").Find(&lines).Error
}

func (s *Store) CountLogLines(executionID uint) (int64, error) {
	var count int64
	return count, s.db.Model(&LogLine{}).Where("execution_id = ?", executionID).Count(&count).Error
}

// ─── Seeds ────────────────────────────────────────────────────────────────────

func (s *Store) SeedDefaults() error {
	// Seed v1 legacy schedules (kept for backward compat)
	var count int64
	if err := s.db.Model(&Schedule{}).Count(&count).Error; err != nil {
		return fmt.Errorf("seed: count schedules: %w", err)
	}
	if count == 0 {
		defaults := []Schedule{
			{Name: "Weekday Sleep", Type: "scale_down", CronExpr: "5 19 * * 1-5", Timezone: "Europe/Budapest", Mode: "plan", Enabled: false, NamespaceFilter: ""},
			{Name: "Weekday Wake", Type: "scale_up", CronExpr: "0 7 * * 1-5", Timezone: "Europe/Budapest", Mode: "plan", Enabled: false, NamespaceFilter: ""},
			{Name: "Weekend Sleep", Type: "scale_down", CronExpr: "0 0 * * 6,0", Timezone: "Europe/Budapest", Mode: "plan", Enabled: false, NamespaceFilter: ""},
			{Name: "Weekend Wake", Type: "scale_up", CronExpr: "0 7 * * 1", Timezone: "Europe/Budapest", Mode: "plan", Enabled: false, NamespaceFilter: ""},
		}
		if err := s.db.Create(&defaults).Error; err != nil {
			return err
		}
	}

	// Seed global guardrails (singleton ID=1)
	var gCount int64
	if err := s.db.Model(&GlobalGuardrails{}).Count(&gCount).Error; err != nil {
		return fmt.Errorf("seed: count guardrails: %w", err)
	}
	if gCount == 0 {
		g := GlobalGuardrails{
			ID:             1,
			SkipNamespaces: "kube-system,kube-phoenix",
		}
		if err := s.db.Create(&g).Error; err != nil {
			return err
		}
	}

	// Seed v2 "Business Hours" policy
	var pCount int64
	if err := s.db.Model(&SleepPolicy{}).Count(&pCount).Error; err != nil {
		return fmt.Errorf("seed: count sleep_policies: %w", err)
	}
	if pCount == 0 {
		policy := SleepPolicy{
			Name:                "Business Hours",
			Description:         "Sleeps the cluster Mon–Fri at 19:00 UTC and wakes at 06:00. Friday sleep carries through to Monday.",
			Timezone:            "UTC",
			Mode:                "plan",
			NamespaceFilter:     "",
			Enabled:             true,
			DriftCorrectionMode: "record",
		}
		if err := s.db.Create(&policy).Error; err != nil {
			return fmt.Errorf("seed: create business hours policy: %w", err)
		}

		// Create the window: Mon–Fri, sleep 19:00, wake 06:00
		window := PolicyWindow{
			PolicyID:   policy.ID,
			DaysOfWeek: `["mon","tue","wed","thu","fri"]`,
			SleepAt:    "19:00",
			WakeAt:     "06:00",
		}
		if err := s.db.Create(&window).Error; err != nil {
			return fmt.Errorf("seed: create business hours window: %w", err)
		}

		// Create empty policy guardrails row
		gr := PolicyGuardrails{PolicyID: policy.ID}
		if err := s.db.Create(&gr).Error; err != nil {
			return fmt.Errorf("seed: create business hours guardrails: %w", err)
		}
	}

	return nil
}

// ─── Transaction helper ───────────────────────────────────────────────────────

func (s *Store) Tx(fn func(*gorm.DB) error) error {
	return s.db.Transaction(fn)
}
