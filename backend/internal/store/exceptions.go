// SPDX-License-Identifier: Apache-2.0

package store

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

// CancelAllOpenExceptions cancels all pending or active exceptions.
// Returns the number of exceptions that were cancelled.
func (s *Store) CancelAllOpenExceptions(reason string) (int64, error) {
	now := time.Now()
	result := s.db.Model(&ScheduledException{}).
		Where("status IN (?, ?)", ExceptionStatusPending, ExceptionStatusActive).
		Updates(map[string]interface{}{
			"status":        ExceptionStatusCancelled,
			"cancelled_at":  now,
			"cancel_reason": reason,
		})
	return result.RowsAffected, result.Error
}

// ─── Scheduled Exceptions ────────────────────────────────────────────────────

// HasOverlappingException returns true if an active or pending exception of a
// different type already covers part of the [startsAt, endsAt] window for the
// same policy. A nonzero excludeID omits the exception being updated.
func (s *Store) HasOverlappingException(policyID uint, exceptionType string, startsAt, endsAt time.Time, excludeID uint) (bool, error) {
	query := s.db.Model(&ScheduledException{}).
		Where("policy_id = ? AND exception_type != ? AND status IN (?, ?)",
			policyID, exceptionType, ExceptionStatusPending, ExceptionStatusActive).
		Where("starts_at < ? AND ends_at > ?", endsAt, startsAt)
	if excludeID != 0 {
		query = query.Where("id != ?", excludeID)
	}
	var count int64
	if err := query.Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func (s *Store) CreateScheduledException(e *ScheduledException) error {
	return s.db.Create(e).Error
}

func (s *Store) GetScheduledException(id uint) (*ScheduledException, error) {
	var e ScheduledException
	return &e, s.db.First(&e, id).Error
}

type ScheduledExceptionFilter struct {
	PolicyID *uint
	Status   string
}

func (s *Store) ListScheduledExceptions(filter ScheduledExceptionFilter) ([]ScheduledException, error) {
	query := s.db.Model(&ScheduledException{})
	if filter.PolicyID != nil {
		query = query.Where("policy_id = ?", *filter.PolicyID)
	}
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	var items []ScheduledException
	return items, query.Order("starts_at asc").Limit(500).Find(&items).Error
}

// ListActiveExceptionsForPolicies returns active exceptions for multiple policies
// in a single query, grouped by policy ID. Used by the scheduler's evaluateAll
// to avoid N+1 queries.
func (s *Store) ListActiveExceptionsForPolicies(policyIDs []uint, now time.Time) (map[uint][]ScheduledException, error) {
	if len(policyIDs) == 0 {
		return map[uint][]ScheduledException{}, nil
	}
	var exceptions []ScheduledException
	err := s.db.Where(
		"policy_id IN (?) AND status = ? AND starts_at <= ? AND ends_at >= ?",
		policyIDs, ExceptionStatusActive, now, now,
	).Find(&exceptions).Error
	if err != nil {
		return nil, err
	}
	result := make(map[uint][]ScheduledException, len(policyIDs))
	for i := range exceptions {
		if exceptions[i].PolicyID != nil {
			policyID := *exceptions[i].PolicyID
			result[policyID] = append(result[policyID], exceptions[i])
		}
	}
	return result, nil
}

// ListActiveExceptionsForPolicy returns active exceptions for a single policy.
// Used by RecoverPolicies at startup.
func (s *Store) ListActiveExceptionsForPolicy(policyID uint, now time.Time) ([]ScheduledException, error) {
	var exceptions []ScheduledException
	err := s.db.Where(
		"policy_id = ? AND status = ? AND starts_at <= ? AND ends_at >= ?",
		policyID, ExceptionStatusActive, now, now,
	).Find(&exceptions).Error
	return exceptions, err
}

// ListOpenExceptions returns all pending or active exceptions for scheduler evaluation.
func (s *Store) ListOpenExceptions() ([]ScheduledException, error) {
	var items []ScheduledException
	return items, s.db.Where("status IN (?,?)", ExceptionStatusPending, ExceptionStatusActive).Order("starts_at asc").Find(&items).Error
}

// UpdateScheduledExceptionStatus atomically transitions an exception from
// expectedStatus to newStatus. Returns ErrRecordNotFound if the row does not
// exist or is not in the expected state (prevents concurrent double-transitions).
func (s *Store) UpdateScheduledExceptionStatus(id uint, expectedStatus, newStatus string) error {
	updates := map[string]interface{}{"status": newStatus}
	if newStatus == ExceptionStatusCancelled {
		updates["cancelled_at"] = time.Now()
	}
	result := s.db.Model(&ScheduledException{}).
		Where("id = ? AND status = ?", id, expectedStatus).
		Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// CancelScheduledException atomically sets status, cancelled_at, and cancel_reason
// in one write. Only transitions from pending or active states.
func (s *Store) CancelScheduledException(id uint, reason string) error {
	result := s.db.Model(&ScheduledException{}).
		Where("id = ? AND status IN (?, ?)", id, ExceptionStatusPending, ExceptionStatusActive).
		Updates(map[string]interface{}{
			"status":        ExceptionStatusCancelled,
			"cancelled_at":  time.Now(),
			"cancel_reason": reason,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (s *Store) UpdateScheduledException(id uint, updates map[string]interface{}) (*ScheduledException, error) {
	allowed := map[string]bool{
		"exception_type": true, "starts_at": true, "ends_at": true,
		"ticket_ref": true, "reason": true, "sleep_on_end": true,
		"namespace_filter": true, "label_selector": true, "workload_targets": true,
	}
	e := &ScheduledException{}
	e.ID = id
	if err := selectiveUpdate(s.db, e, updates, allowed); err != nil {
		return nil, fmt.Errorf("update exception: %w", err)
	}
	return s.GetScheduledException(id)
}
