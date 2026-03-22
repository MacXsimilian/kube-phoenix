package store

import (
	"fmt"
	"log/slog"
	"os"
	"time"

	"gorm.io/gorm"
)

// ─── Schedules ────────────────────────────────────────────────────────────────

func (s *Store) ListSchedules() ([]Schedule, error) {
	var schedules []Schedule
	return schedules, s.db.Order("position asc, id asc").Find(&schedules).Error
}

// ReorderSchedules sets the position of each schedule ID within the given type.
// All provided IDs must belong to the specified type; the WHERE clause filters
// out any mismatches so other schedules are never affected.
func (s *Store) ReorderSchedules(scheduleType string, ids []uint) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		for pos, id := range ids {
			if err := tx.Model(&Schedule{}).
				Where("id = ? AND type = ?", id, scheduleType).
				Update("position", pos).Error; err != nil {
				return fmt.Errorf("reorder schedule %d: %w", id, err)
			}
		}
		return nil
	})
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
		"timeout_minutes": true,
	}
	for k := range updates {
		if !allowed[k] {
			delete(updates, k)
		}
	}
	if len(updates) == 0 {
		return s.GetSchedule(id)
	}
	// Pass keys to Select so GORM writes every specified column including
	// zero-value booleans (e.g. enabled=false) which Updates() skips otherwise.
	keys := make([]string, 0, len(updates))
	for k := range updates {
		keys = append(keys, k)
	}
	if err := s.db.Model(&Schedule{}).Where("id = ?", id).Select(keys).Updates(updates).Error; err != nil {
		return nil, err
	}
	return s.GetSchedule(id)
}

func (s *Store) DeleteSchedule(id uint) error {
	result := s.db.Delete(&Schedule{}, id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// ─── Guardrails ───────────────────────────────────────────────────────────────

func (s *Store) GetGuardrails() (*Guardrails, error) {
	var g Guardrails
	return &g, s.db.First(&g).Error
}

func (s *Store) UpdateGuardrails(updates map[string]interface{}) (*Guardrails, error) {
	keys := make([]string, 0, len(updates))
	for k := range updates {
		keys = append(keys, k)
	}
	if err := s.db.Model(&Guardrails{}).Where("id = 1").Select(keys).Updates(updates).Error; err != nil {
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

// MarkInterruptedExecutions marks any executions still in "running" state as
// "interrupted". Called at startup to recover from ungraceful pod terminations.
func (s *Store) MarkInterruptedExecutions() (int64, error) {
	now := time.Now()
	res := s.db.Model(&Execution{}).
		Where("status = ?", "running").
		Updates(map[string]interface{}{
			"status":      "interrupted",
			"finished_at": now,
		})
	return res.RowsAffected, res.Error
}

func (s *Store) FinishExecution(id uint, status string, counts map[string]int) error {
	now := time.Now()
	return s.db.Model(&Execution{}).Where("id = ?", id).Updates(map[string]interface{}{
		"finished_at":     now,
		"status":          status,
		"count_scaled":    counts["scaled"],
		"count_drained":   counts["drained"],
		"count_deleted":   counts["deleted"],
		"count_skipped":   counts["skipped"],
		"count_errors":    counts["errors"],
		"count_saved":     counts["saved"],
		"count_protected": counts["protected"],
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
			SystemNamespaces: "kube-system,kube-public,kube-node-lease,kube-phoenix",
			SkipNamespaces:   "default,karpenter,vault,velero,istio-gateway,istio-system,kyverno,kyverno-notation-aws,victoriametrics,monitoring,gitlab",
			SkipNsNode:       "victoriametrics,karpenter",
			SkipNodeLabels:   "karpenter.k8s.aws/ec2nodeclass=default",
			SkipNodeTaints:   "karpenter-eks-base=true:NoSchedule",
		}
		if err := s.db.Create(&g).Error; err != nil {
			return err
		}
	}

	// ── Seed admin user ──────────────────────────────────────────────────
	var userCount int64
	if err := s.db.Model(&User{}).Count(&userCount).Error; err != nil {
		return fmt.Errorf("seed: count users: %w", err)
	}
	if userCount == 0 {
		adminUser := os.Getenv("ADMIN_USER")
		adminPass := os.Getenv("ADMIN_PASSWORD")
		if adminUser != "" && adminPass != "" {
			hash, err := HashPassword(adminPass)
			if err != nil {
				return fmt.Errorf("seed: hash admin password: %w", err)
			}
			admin := User{
				Username:     adminUser,
				PasswordHash: hash,
				Role:         "admin",
				Source:       "local",
				Enabled:      true,
			}
			if err := s.db.Create(&admin).Error; err != nil {
				return fmt.Errorf("seed: create admin user: %w", err)
			}
			slog.Info("seed: admin user created from environment variables", "username", adminUser)
		} else {
			slog.Warn("seed: no users in database and ADMIN_USER/ADMIN_PASSWORD not set — no one can log in")
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
	if err := s.db.Exec(`DROP TABLE IF EXISTS
		workload_snapshots, policy_log_lines, policy_executions,
		policy_overrides, scheduled_exceptions, policies,
		sessions, users, log_lines, executions, guardrails, schedules,
		audit_logs CASCADE`).Error; err != nil {
		return fmt.Errorf("drop tables: %w", err)
	}
	return nil
}

// MigrateSchema recreates the schema from the current models.
func (s *Store) MigrateSchema() error {
	if err := s.db.AutoMigrate(
		&Schedule{}, &Guardrails{}, &Execution{}, &LogLine{},
		&User{}, &Session{}, &AuditLog{},
		&Policy{}, &PolicyExecution{}, &PolicyLogLine{},
		&WorkloadSnapshot{}, &PolicyOverride{}, &ScheduledException{},
	); err != nil {
		return fmt.Errorf("migrate: %w", err)
	}
	// Backfill positions for existing rows after the column is first added.
	// When ALL schedules have position=0 it means the column was just created;
	// we assign positions by type + id order so the list stays stable.
	var total, zeroCount int64
	s.db.Model(&Schedule{}).Count(&total)
	s.db.Model(&Schedule{}).Where("position = 0").Count(&zeroCount)
	if total > 0 && total == zeroCount {
		var schedules []Schedule
		s.db.Order("type asc, id asc").Find(&schedules)
		typePos := map[string]int{}
		for _, sc := range schedules {
			pos := typePos[sc.Type]
			s.db.Model(&Schedule{}).Where("id = ?", sc.ID).Update("position", pos)
			typePos[sc.Type]++
		}
	}
	return nil
}
