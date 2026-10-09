// SPDX-License-Identifier: Apache-2.0

package store

import (
	"fmt"
	"time"
)

// ─── Policy Executions ────────────────────────────────────────────────────────

func (s *Store) CreatePolicyExecution(e *PolicyExecution) error {
	return s.db.Create(e).Error
}

func (s *Store) GetPolicyExecution(id uint) (*PolicyExecution, error) {
	var e PolicyExecution
	return &e, s.db.Preload("Policy").First(&e, id).Error
}

type PolicyExecutionFilter struct {
	PolicyID  *uint
	Status    string
	Direction string
	Page      int
	PageSize  int
}

type PolicyExecutionPage struct {
	Items []PolicyExecution `json:"items"`
	Total int64             `json:"total"`
}

func (s *Store) ListPolicyExecutions(filter PolicyExecutionFilter) (*PolicyExecutionPage, error) {
	query := s.db.Model(&PolicyExecution{}).Preload("Policy")
	if filter.PolicyID != nil {
		query = query.Where("policy_id = ?", *filter.PolicyID)
	}
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.Direction != "" {
		query = query.Where("direction = ?", filter.Direction)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, fmt.Errorf("count policy executions: %w", err)
	}
	if filter.PageSize <= 0 {
		filter.PageSize = 20
	}
	offset := filter.Page * filter.PageSize
	var items []PolicyExecution
	if err := query.Order("started_at desc").Limit(filter.PageSize).Offset(offset).Find(&items).Error; err != nil {
		return nil, fmt.Errorf("list policy executions: %w", err)
	}
	return &PolicyExecutionPage{Items: items, Total: total}, nil
}

func (s *Store) FinishPolicyExecution(id uint, status string, counts map[string]int) error {
	now := time.Now()
	return s.db.Model(&PolicyExecution{}).Where("id = ?", id).Updates(map[string]interface{}{
		"finished_at":     now,
		"status":          status,
		"count_scaled":    counts["scaled"],
		"count_skipped":   counts["skipped"],
		"count_errors":    counts["errors"],
		"count_protected": counts["protected"],
		"count_drained":   counts["drained"],
		"count_deleted":   counts["deleted"],
	}).Error
}

func (s *Store) MarkInterruptedPolicyExecutions() (int64, error) {
	now := time.Now()
	result := s.db.Model(&PolicyExecution{}).
		Where("status = ?", ExecStatusRunning).
		Updates(map[string]interface{}{
			"status":      ExecStatusInterrupted,
			"finished_at": now,
		})
	return result.RowsAffected, result.Error
}

// ResetStuckTransitioningPolicies moves any policy still in "transitioning"
// back to "unknown" so the scheduler can re-evaluate immediately after a
// crash. Returns the number of policies reset.
func (s *Store) ResetStuckTransitioningPolicies() (int64, error) {
	now := time.Now()
	result := s.db.Model(&Policy{}).
		Where("current_state = ?", PolicyStateTransitioning).
		Updates(map[string]interface{}{
			"current_state": PolicyStateUnknown,
			"state_since":   now,
		})
	return result.RowsAffected, result.Error
}

// ─── Retention ───────────────────────────────────────────────────────────────

// CleanOldExecutions deletes finished policy executions older than the given
// duration. Cascades to policy_log_lines and workload_snapshots via FK.
// Executions with open (un-restored) snapshots are preserved regardless of age.
func (s *Store) CleanOldExecutions(olderThan time.Duration) (int64, error) {
	cutoff := time.Now().Add(-olderThan)
	result := s.db.
		Where("finished_at < ? AND status != ? AND id NOT IN (?)",
			cutoff, ExecStatusRunning,
			s.db.Model(&WorkloadSnapshot{}).Select("DISTINCT sleep_execution_id").Where("wake_execution_id IS NULL"),
		).
		Delete(&PolicyExecution{})
	return result.RowsAffected, result.Error
}

// ─── Policy Log Lines ─────────────────────────────────────────────────────────

func (s *Store) AppendPolicyLogLine(line *PolicyLogLine) error {
	return s.db.Create(line).Error
}

// AppendPolicyLogLines inserts multiple log lines in a single batch.
func (s *Store) AppendPolicyLogLines(lines []PolicyLogLine) error {
	if len(lines) == 0 {
		return nil
	}
	return s.db.Create(&lines).Error
}

// maxLogLines caps the number of log lines returned per execution to prevent
// unbounded memory growth. Executions with more lines are truncated.
const maxLogLines = 5000

func (s *Store) GetPolicyLogLines(executionID uint) ([]PolicyLogLine, error) {
	var lines []PolicyLogLine
	return lines, s.db.Where("execution_id = ?", executionID).Order("seq asc").Limit(maxLogLines).Find(&lines).Error
}
