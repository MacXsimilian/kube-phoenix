package store

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

// ─── Schedules ────────────────────────────────────────────────────────────────

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

// ─── Guardrails ───────────────────────────────────────────────────────────────

func (s *Store) GetGuardrails() (*Guardrails, error) {
	var g Guardrails
	return &g, s.db.First(&g).Error
}

func (s *Store) UpdateGuardrails(updates map[string]interface{}) (*Guardrails, error) {
	if err := s.db.Model(&Guardrails{}).Where("id = 1").Updates(updates).Error; err != nil {
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
	return &e, s.db.Preload("Schedule").First(&e, id).Error
}

type ExecutionFilter struct {
	ScheduleID *uint
	Status     string
	Page       int
	PageSize   int
}

type ExecutionPage struct {
	Items []Execution `json:"items"`
	Total int64       `json:"total"`
}

func (s *Store) ListExecutions(f ExecutionFilter) (*ExecutionPage, error) {
	q := s.db.Model(&Execution{}).Preload("Schedule")
	if f.ScheduleID != nil {
		q = q.Where("schedule_id = ?", *f.ScheduleID)
	}
	if f.Status != "" {
		q = q.Where("status = ?", f.Status)
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

	var gCount int64
	if err := s.db.Model(&Guardrails{}).Count(&gCount).Error; err != nil {
		return fmt.Errorf("seed: count guardrails: %w", err)
	}
	if gCount == 0 {
		g := Guardrails{
			SkipNamespaces: "default,kube-system,kube-public,karpenter,vault,velero,istio-gateway,istio-system,kyverno,kyverno-notation-aws,victoriametrics,monitoring,gitlab",
			SkipNsNode:     "victoriametrics,karpenter",
			SkipNodeLabels: "karpenter.k8s.aws/ec2nodeclass=default",
			SkipNodeTaints: "karpenter-eks-base=true:NoSchedule",
		}
		if err := s.db.Create(&g).Error; err != nil {
			return err
		}
	}
	return nil
}

// ─── Transaction helper ───────────────────────────────────────────────────────

func (s *Store) Tx(fn func(*gorm.DB) error) error {
	return s.db.Transaction(fn)
}

// ─── Danger zone ──────────────────────────────────────────────────────────────

// DropAllTables drops all application tables in a single CASCADE statement.
func (s *Store) DropAllTables() error {
	if err := s.db.Exec("DROP TABLE IF EXISTS log_lines, executions, guardrails, schedules CASCADE").Error; err != nil {
		return fmt.Errorf("drop tables: %w", err)
	}
	return nil
}

// MigrateSchema recreates the schema from the current models.
func (s *Store) MigrateSchema() error {
	if err := s.db.AutoMigrate(&Schedule{}, &Guardrails{}, &Execution{}, &LogLine{}); err != nil {
		return fmt.Errorf("migrate: %w", err)
	}
	return nil
}
