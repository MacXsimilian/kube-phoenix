// SPDX-License-Identifier: Apache-2.0

package store

import (
	"time"
)

// GetAllOpenSnapshots returns every open snapshot across all policies that was
// actively scaled to zero (not already-zero, not deleted at wake). These are
// the workloads that need restoring during an emergency scale.
func (s *Store) GetAllOpenSnapshots() ([]WorkloadSnapshot, error) {
	var snapshots []WorkloadSnapshot
	return snapshots, s.db.
		Where("wake_execution_id IS NULL AND was_deleted_at_wake = false AND was_already_zero = false").
		Find(&snapshots).Error
}

// ─── Workload Snapshots ───────────────────────────────────────────────────────

func (s *Store) CreateWorkloadSnapshot(snapshot *WorkloadSnapshot) error {
	return s.db.Create(snapshot).Error
}

func (s *Store) MarkSnapshotApplied(id uint) error {
	return s.db.Model(&WorkloadSnapshot{}).Where("id = ? AND wake_execution_id IS NULL", id).
		Update("phase", "applied").Error
}

// GetOpenSnapshots returns all snapshots for a policy that have not yet been
// consumed by a wake execution (WakeExecutionID IS NULL).
func (s *Store) GetOpenSnapshots(policyID uint) ([]WorkloadSnapshot, error) {
	var snapshots []WorkloadSnapshot
	return snapshots, s.db.
		Where("policy_id = ? AND wake_execution_id IS NULL AND was_deleted_at_wake = false", policyID).
		Find(&snapshots).Error
}

// CountOpenSnapshotsForRestore returns the number of snapshots that still need
// restoring — open, not already-zero, not deleted. A non-zero count while a
// policy is awake indicates drift from a failed or partial wake.
func (s *Store) CountOpenSnapshotsForRestore(policyID uint) (int64, error) {
	var count int64
	return count, s.db.Model(&WorkloadSnapshot{}).
		Where("policy_id = ? AND wake_execution_id IS NULL AND was_deleted_at_wake = false AND was_already_zero = false", policyID).
		Count(&count).Error
}

// GetOpenSnapshotsForSleepReconcile returns open snapshots that were actively scaled
// to zero (not already-zero). Used by the enforce-sleep reconciler to detect drift.
func (s *Store) GetOpenSnapshotsForSleepReconcile(policyID uint) ([]WorkloadSnapshot, error) {
	var snapshots []WorkloadSnapshot
	return snapshots, s.db.
		Where("policy_id = ? AND wake_execution_id IS NULL AND was_deleted_at_wake = false AND was_already_zero = false", policyID).
		Find(&snapshots).Error
}

// GetSnapshotsForExecution returns all snapshots created by a specific sleep execution.
func (s *Store) GetSnapshotsForExecution(sleepExecID uint) ([]WorkloadSnapshot, error) {
	var snapshots []WorkloadSnapshot
	return snapshots, s.db.Where("sleep_execution_id = ?", sleepExecID).Find(&snapshots).Error
}

// GetSnapshotsForPolicy returns the most recent snapshots for a policy (open and closed).
// Capped at 5000 rows to prevent unbounded memory growth.
func (s *Store) GetSnapshotsForPolicy(policyID uint) ([]WorkloadSnapshot, error) {
	var snapshots []WorkloadSnapshot
	return snapshots, s.db.Where("policy_id = ?", policyID).Order("captured_at desc").Limit(5000).Find(&snapshots).Error
}

// CloseSnapshot marks a snapshot as restored by linking it to the wake execution.
func (s *Store) CloseSnapshot(id uint, wakeExecID uint, replicasRestored int32) error {
	now := time.Now()
	return s.db.Model(&WorkloadSnapshot{}).Where("id = ?", id).Updates(map[string]interface{}{
		"wake_execution_id": wakeExecID,
		"replicas_restored": replicasRestored,
		"restored_at":       now,
		"phase":             "restored",
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
