package store

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

// ─── Policies ─────────────────────────────────────────────────────────────────

func (s *Store) ListPolicies() ([]Policy, error) {
	var policies []Policy
	return policies, s.db.Order("id asc").Find(&policies).Error
}

func (s *Store) GetPolicy(id uint) (*Policy, error) {
	var p Policy
	return &p, s.db.First(&p, id).Error
}

func (s *Store) CreatePolicy(p *Policy) error {
	return s.db.Create(p).Error
}

func (s *Store) UpdatePolicy(id uint, updates map[string]interface{}) (*Policy, error) {
	allowed := map[string]bool{
		"name": true, "description": true, "namespace_filter": true, "label_selector": true,
		"sleep_windows": true, "timezone": true,
		"mode": true, "enabled": true, "timeout_minutes": true,
	}
	for key := range updates {
		if !allowed[key] {
			delete(updates, key)
		}
	}
	if len(updates) == 0 {
		return s.GetPolicy(id)
	}
	keys := make([]string, 0, len(updates))
	for key := range updates {
		keys = append(keys, key)
	}
	if err := s.db.Model(&Policy{}).Where("id = ?", id).Select(keys).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("update policy %d: %w", id, err)
	}
	return s.GetPolicy(id)
}

func (s *Store) UpdatePolicyState(id uint, state string, nextTransition *time.Time) error {
	now := time.Now()
	updates := map[string]interface{}{
		"current_state":     state,
		"state_since":       now,
		"next_transition_at": nextTransition,
	}
	switch state {
	case PolicyStateSleeping:
		updates["last_sleep_at"] = now
	case PolicyStateAwake:
		updates["last_wake_at"] = now
	}
	return s.db.Model(&Policy{}).Where("id = ?", id).Updates(updates).Error
}

func (s *Store) SetPolicyTransitioning(id uint) error {
	return s.db.Model(&Policy{}).Where("id = ?", id).
		Update("current_state", PolicyStateTransitioning).Error
}

func (s *Store) DeletePolicy(id uint) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		// Check the policy exists first.
		var count int64
		if err := tx.Model(&Policy{}).Where("id = ?", id).Count(&count).Error; err != nil {
			return err
		}
		if count == 0 {
			return gorm.ErrRecordNotFound
		}
		// Delete related records that reference this policy.
		// PolicyLogLines cascade from PolicyExecution, so we only need to
		// delete executions, snapshots, overrides, and exceptions.
		for _, model := range []interface{}{
			&WorkloadSnapshot{},
			&PolicyOverride{},
			&ScheduledException{},
		} {
			if err := tx.Where("policy_id = ?", id).Delete(model).Error; err != nil {
				return err
			}
		}
		// Delete executions (log lines cascade via ON DELETE CASCADE).
		if err := tx.Where("policy_id = ?", id).Delete(&PolicyExecution{}).Error; err != nil {
			return err
		}
		// Delete the policy itself.
		return tx.Delete(&Policy{}, id).Error
	})
}

// HasApplyPolicyOverlap returns true when another enabled apply-mode policy
// could potentially overlap with the given targeting parameters. Used for
// conflict detection on save — blocks when overlap is likely.
//
// Overlap logic:
//   - If the new policy targets everything (both filters empty), any other
//     apply-mode policy is a conflict.
//   - If another policy targets everything, it conflicts with any new policy.
//   - If both policies share the same namespace scope (same filter or one is
//     empty/universal), they may overlap — we flag it.
//
// Label selector intersection is not computed exactly (would require a K8s API
// call); instead, same-namespace policies are treated as overlapping.
func (s *Store) HasApplyPolicyOverlap(excludeID uint, namespaceFilter, labelSelector string) (bool, error) {
	if namespaceFilter == "" && labelSelector == "" {
		// New policy targets everything — overlap with ANY other apply-mode policy.
		var count int64
		err := s.db.Model(&Policy{}).
			Where("id != ? AND enabled = true AND mode = 'apply'", excludeID).
			Count(&count).Error
		return count > 0, err
	}

	// Check for policies that could overlap:
	// 1. Another policy targets everything (namespace_filter = '' AND label_selector = '')
	// 2. Another policy targets the same namespace scope (namespace_filter matches or is universal)
	var count int64
	err := s.db.Model(&Policy{}).
		Where(`id != ? AND enabled = true AND mode = 'apply' AND (
			(namespace_filter = '' AND label_selector = '') OR
			namespace_filter = '' OR
			namespace_filter = ?
		)`, excludeID, namespaceFilter).
		Count(&count).Error
	return count > 0, err
}

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

func (s *Store) ListPolicyExecutions(f PolicyExecutionFilter) (*PolicyExecutionPage, error) {
	query := s.db.Model(&PolicyExecution{}).Preload("Policy")
	if f.PolicyID != nil {
		query = query.Where("policy_id = ?", *f.PolicyID)
	}
	if f.Status != "" {
		query = query.Where("status = ?", f.Status)
	}
	if f.Direction != "" {
		query = query.Where("direction = ?", f.Direction)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, fmt.Errorf("count policy executions: %w", err)
	}
	if f.PageSize <= 0 {
		f.PageSize = 20
	}
	offset := f.Page * f.PageSize
	var items []PolicyExecution
	if err := query.Order("started_at desc").Limit(f.PageSize).Offset(offset).Find(&items).Error; err != nil {
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
	res := s.db.Model(&PolicyExecution{}).
		Where("status = ?", ExecStatusRunning).
		Updates(map[string]interface{}{
			"status":      "interrupted",
			"finished_at": now,
		})
	return res.RowsAffected, res.Error
}

// ─── Policy Log Lines ─────────────────────────────────────────────────────────

func (s *Store) AppendPolicyLogLine(line *PolicyLogLine) error {
	return s.db.Create(line).Error
}

func (s *Store) GetPolicyLogLines(executionID uint) ([]PolicyLogLine, error) {
	var lines []PolicyLogLine
	return lines, s.db.Where("execution_id = ?", executionID).Order("seq asc").Find(&lines).Error
}

// ─── Workload Snapshots ───────────────────────────────────────────────────────

func (s *Store) CreateWorkloadSnapshot(snap *WorkloadSnapshot) error {
	return s.db.Create(snap).Error
}

// GetOpenSnapshots returns all snapshots for a policy that have not yet been
// consumed by a wake execution (WakeExecutionID IS NULL).
func (s *Store) GetOpenSnapshots(policyID uint) ([]WorkloadSnapshot, error) {
	var snaps []WorkloadSnapshot
	return snaps, s.db.
		Where("policy_id = ? AND wake_execution_id IS NULL AND was_deleted_at_wake = false", policyID).
		Find(&snaps).Error
}

// GetSnapshotsForExecution returns all snapshots created by a specific sleep execution.
func (s *Store) GetSnapshotsForExecution(sleepExecID uint) ([]WorkloadSnapshot, error) {
	var snaps []WorkloadSnapshot
	return snaps, s.db.Where("sleep_execution_id = ?", sleepExecID).Find(&snaps).Error
}

// GetSnapshotsForPolicy returns all snapshots for a policy (open and closed).
func (s *Store) GetSnapshotsForPolicy(policyID uint) ([]WorkloadSnapshot, error) {
	var snaps []WorkloadSnapshot
	return snaps, s.db.Where("policy_id = ?", policyID).Order("captured_at desc").Find(&snaps).Error
}

// CloseSnapshot marks a snapshot as restored by linking it to the wake execution.
func (s *Store) CloseSnapshot(id uint, wakeExecID uint, replicasRestored int32) error {
	now := time.Now()
	return s.db.Model(&WorkloadSnapshot{}).Where("id = ?", id).Updates(map[string]interface{}{
		"wake_execution_id": wakeExecID,
		"replicas_restored": replicasRestored,
		"restored_at":       now,
	}).Error
}

// MarkSnapshotDeletedAtWake marks a snapshot as deleted (workload gone at wake time).
func (s *Store) MarkSnapshotDeletedAtWake(id uint, wakeExecID uint) error {
	return s.db.Model(&WorkloadSnapshot{}).Where("id = ?", id).Updates(map[string]interface{}{
		"wake_execution_id":   wakeExecID,
		"was_deleted_at_wake": true,
	}).Error
}

// MarkSnapshotExternallyScaled flags that the workload was scaled while sleeping.
func (s *Store) MarkSnapshotExternallyScaled(id uint) error {
	return s.db.Model(&WorkloadSnapshot{}).Where("id = ?", id).
		Update("was_externally_scaled", true).Error
}

// DeleteWorkloadSnapshot removes a snapshot (used when a scale failed after snapshot was created).
func (s *Store) DeleteWorkloadSnapshot(id uint) error {
	return s.db.Delete(&WorkloadSnapshot{}, id).Error
}

// ─── Policy Overrides ─────────────────────────────────────────────────────────

func (s *Store) CreatePolicyOverride(o *PolicyOverride) error {
	return s.db.Create(o).Error
}

func (s *Store) GetPolicyOverride(id uint) (*PolicyOverride, error) {
	var o PolicyOverride
	return &o, s.db.First(&o, id).Error
}

func (s *Store) ListPolicyOverrides(policyID uint) ([]PolicyOverride, error) {
	var overrides []PolicyOverride
	return overrides, s.db.Where("policy_id = ?", policyID).Order("created_at desc").Find(&overrides).Error
}

// ListActiveOverrides returns overrides currently in effect for a policy.
func (s *Store) ListActiveOverrides(policyID uint, now time.Time) ([]PolicyOverride, error) {
	var overrides []PolicyOverride
	err := s.db.Where(
		"policy_id = ? AND ((override_type IN ('stay_awake','force_sleep') AND starts_at <= ? AND ends_at >= ?) OR override_type IN ('skip_sleep','skip_wake'))",
		policyID, now, now,
	).Find(&overrides).Error
	return overrides, err
}

func (s *Store) DeletePolicyOverride(id uint) error {
	result := s.db.Delete(&PolicyOverride{}, id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// ─── Scheduled Exceptions ────────────────────────────────────────────────────

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

func (s *Store) ListScheduledExceptions(f ScheduledExceptionFilter) ([]ScheduledException, error) {
	query := s.db.Model(&ScheduledException{})
	if f.PolicyID != nil {
		query = query.Where("policy_id = ?", *f.PolicyID)
	}
	if f.Status != "" {
		query = query.Where("status = ?", f.Status)
	}
	var items []ScheduledException
	return items, query.Order("starts_at asc").Find(&items).Error
}

// ListOpenExceptions returns all pending or active exceptions for scheduler evaluation.
func (s *Store) ListOpenExceptions() ([]ScheduledException, error) {
	var items []ScheduledException
	return items, s.db.Where("status IN (?,?)", ExceptionStatusPending, ExceptionStatusActive).Order("starts_at asc").Find(&items).Error
}

func (s *Store) UpdateScheduledExceptionStatus(id uint, status string) error {
	updates := map[string]interface{}{"status": status}
	if status == ExceptionStatusCancelled {
		updates["cancelled_at"] = time.Now()
	}
	return s.db.Model(&ScheduledException{}).Where("id = ?", id).Updates(updates).Error
}

// CancelScheduledException atomically sets status, cancelled_at, and cancel_reason in one write.
func (s *Store) CancelScheduledException(id uint, reason string) error {
	return s.db.Model(&ScheduledException{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":        ExceptionStatusCancelled,
		"cancelled_at":  time.Now(),
		"cancel_reason": reason,
	}).Error
}

func (s *Store) UpdateScheduledException(id uint, updates map[string]interface{}) (*ScheduledException, error) {
	allowed := map[string]bool{
		"exception_type": true, "starts_at": true, "ends_at": true,
		"ticket_ref": true, "reason": true, "sleep_on_end": true,
		"namespace_filter": true, "label_selector": true, "workload_targets": true,
	}
	filtered := make(map[string]interface{}, len(updates))
	for key, val := range updates {
		if allowed[key] {
			filtered[key] = val
		}
	}
	if len(filtered) == 0 {
		return s.GetScheduledException(id)
	}
	keys := make([]string, 0, len(filtered))
	for key := range filtered {
		keys = append(keys, key)
	}
	if err := s.db.Model(&ScheduledException{}).Where("id = ?", id).Select(keys).Updates(filtered).Error; err != nil {
		return nil, fmt.Errorf("update exception: %w", err)
	}
	return s.GetScheduledException(id)
}
