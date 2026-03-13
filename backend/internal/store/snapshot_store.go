package store

import "time"

// ─── Workload Snapshots ───────────────────────────────────────────────────────

func (s *Store) CreateWorkloadSnapshot(snap *WorkloadSnapshot) error {
	return s.db.Create(snap).Error
}

// GetLatestUnrestored returns the oldest unrestored snapshot for a workload
// (oldest first so that if two sleeps fired before a wake, the original replica
// count is restored).
func (s *Store) GetLatestUnrestored(namespace, workloadName string) (*WorkloadSnapshot, error) {
	var snap WorkloadSnapshot
	err := s.db.
		Where("namespace = ? AND workload_name = ? AND restored_at IS NULL", namespace, workloadName).
		Order("snapshotted_at ASC").
		First(&snap).Error
	if err != nil {
		return nil, err
	}
	return &snap, nil
}

// MarkSnapshotRestored sets restored_at, replicas_restored, and wake_execution_id.
func (s *Store) MarkSnapshotRestored(id uint, wakeExecID uint, replicasRestored int) error {
	now := time.Now()
	return s.db.Model(&WorkloadSnapshot{}).Where("id = ?", id).Updates(map[string]interface{}{
		"wake_execution_id": wakeExecID,
		"replicas_restored": replicasRestored,
		"restored_at":       now,
	}).Error
}

// ListUnrestoredSnapshots returns all snapshots that have not been restored.
// Used by the cluster state endpoint to determine sleeping workloads.
func (s *Store) ListUnrestoredSnapshots() ([]WorkloadSnapshot, error) {
	var snaps []WorkloadSnapshot
	return snaps, s.db.Where("restored_at IS NULL").Find(&snaps).Error
}

// UnrestoredSnapshotMap returns a map of "namespace/workloadName" → WorkloadSnapshot
// for all unrestored snapshots, ordered by snapshotted_at ASC so the oldest entry wins.
func (s *Store) UnrestoredSnapshotMap() (map[string]*WorkloadSnapshot, error) {
	var snaps []WorkloadSnapshot
	if err := s.db.Where("restored_at IS NULL").Order("snapshotted_at ASC").Find(&snaps).Error; err != nil {
		return nil, err
	}
	m := make(map[string]*WorkloadSnapshot, len(snaps))
	for i := range snaps {
		key := snaps[i].Namespace + "/" + snaps[i].WorkloadName
		if _, exists := m[key]; !exists {
			// Keep the oldest (first) entry since we ORDER BY snapshotted_at ASC
			snap := snaps[i]
			m[key] = &snap
		}
	}
	return m, nil
}

// WorkloadPolicyName is a lightweight projection used by the cluster state endpoint.
type WorkloadPolicyName struct {
	Namespace    string
	WorkloadName string
	PolicyName   string // empty if policy was deleted
}

// UnrestoredSnapshotPolicyNameMap returns a map of "namespace/workloadName" → policy name
// for all unrestored snapshots, using a LEFT JOIN to sleep_policies.
func (s *Store) UnrestoredSnapshotPolicyNameMap() (map[string]string, error) {
	var rows []WorkloadPolicyName
	err := s.db.Raw(`
		SELECT ws.namespace, ws.workload_name, COALESCE(sp.name, '') AS policy_name
		FROM workload_snapshots ws
		LEFT JOIN sleep_policies sp ON sp.id = ws.policy_id
		WHERE ws.restored_at IS NULL
		ORDER BY ws.snapshotted_at ASC
	`).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	m := make(map[string]string, len(rows))
	for _, row := range rows {
		key := row.Namespace + "/" + row.WorkloadName
		if _, exists := m[key]; !exists {
			// Keep oldest (first) entry
			m[key] = row.PolicyName
		}
	}
	return m, nil
}
