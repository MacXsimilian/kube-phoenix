package store

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

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
	return &e, s.db.Preload("Policy").First(&e, id).Error
}

type ExecutionFilter struct {
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
	q := s.db.Model(&Execution{}).Preload("Policy")
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

	// Seed default sleep policies
	var pCount int64
	if err := s.db.Model(&SleepPolicy{}).Count(&pCount).Error; err != nil {
		return fmt.Errorf("seed: count policies: %w", err)
	}
	if pCount == 0 {
		defaults := []struct {
			name    string
			days    string
			sleepAt string
			wakeAt  string
		}{
			{"Weekday", `["mon","tue","wed","thu","fri"]`, "19:05", "07:00"},
			{"Weekend", `["sat","sun"]`, "00:00", "07:00"},
		}
		for _, d := range defaults {
			policy := SleepPolicy{
				Name:                d.name,
				Timezone:            "Europe/Budapest",
				Mode:                "plan",
				Enabled:             false,
				DriftCorrectionMode: "record",
			}
			if err := s.db.Transaction(func(tx *gorm.DB) error {
				if err := tx.Create(&policy).Error; err != nil {
					return err
				}
				window := PolicyWindow{
					PolicyID:   policy.ID,
					DaysOfWeek: d.days,
					SleepAt:    d.sleepAt,
					WakeAt:     d.wakeAt,
				}
				if err := tx.Create(&window).Error; err != nil {
					return err
				}
				gr := PolicyGuardrails{PolicyID: policy.ID}
				return tx.Create(&gr).Error
			}); err != nil {
				return fmt.Errorf("seed: create policy %s: %w", d.name, err)
			}
		}
	}

	return nil
}

// ─── Transaction helper ───────────────────────────────────────────────────────

func (s *Store) Tx(fn func(*gorm.DB) error) error {
	return s.db.Transaction(fn)
}
