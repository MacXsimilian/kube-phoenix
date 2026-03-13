package store

import (
	"fmt"

	"gorm.io/gorm"
)

// ─── Sleep Policies ───────────────────────────────────────────────────────────

func (s *Store) CreateSleepPolicy(p *SleepPolicy) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(p).Error; err != nil {
			return fmt.Errorf("create policy: %w", err)
		}
		// Automatically create an empty guardrails row
		gr := PolicyGuardrails{PolicyID: p.ID}
		if err := tx.Create(&gr).Error; err != nil {
			return fmt.Errorf("create policy guardrails: %w", err)
		}
		return nil
	})
}

func (s *Store) ListSleepPolicies() ([]SleepPolicy, error) {
	var policies []SleepPolicy
	return policies, s.db.Preload("Windows").Preload("Guardrails").Find(&policies).Error
}

func (s *Store) GetSleepPolicy(id uint) (*SleepPolicy, error) {
	var p SleepPolicy
	err := s.db.
		Preload("Windows").
		Preload("Guardrails").
		Preload("Overrides", func(db *gorm.DB) *gorm.DB {
			return db.Where("occurrence_date >= CURRENT_DATE")
		}).
		First(&p, id).Error
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (s *Store) UpdateSleepPolicy(id uint, updates map[string]interface{}) (*SleepPolicy, error) {
	allowed := map[string]bool{
		"name": true, "description": true, "tags": true,
		"timezone": true, "mode": true, "namespace_filter": true,
		"enabled": true, "drift_correction_mode": true,
		"timeout_minutes": true, "conflict_tags": true,
	}
	for k := range updates {
		if !allowed[k] {
			delete(updates, k)
		}
	}
	if err := s.db.Model(&SleepPolicy{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return nil, err
	}
	return s.GetSleepPolicy(id)
}

func (s *Store) DeleteSleepPolicy(id uint) error {
	return s.db.Delete(&SleepPolicy{}, id).Error
}

// SetConflictTags overwrites the conflict_tags column for a policy.
func (s *Store) SetConflictTags(id uint, tags string) error {
	return s.db.Model(&SleepPolicy{}).Where("id = ?", id).Update("conflict_tags", tags).Error
}

// ─── Policy Windows ───────────────────────────────────────────────────────────

func (s *Store) CreateWindow(w *PolicyWindow) error {
	return s.db.Create(w).Error
}

func (s *Store) ListWindows(policyID uint) ([]PolicyWindow, error) {
	var windows []PolicyWindow
	return windows, s.db.Where("policy_id = ?", policyID).Find(&windows).Error
}

func (s *Store) GetWindow(id uint) (*PolicyWindow, error) {
	var w PolicyWindow
	return &w, s.db.First(&w, id).Error
}

func (s *Store) UpdateWindow(id uint, updates map[string]interface{}) (*PolicyWindow, error) {
	allowed := map[string]bool{
		"days_of_week": true, "sleep_at": true, "wake_at": true, "advanced_rules": true,
	}
	for k := range updates {
		if !allowed[k] {
			delete(updates, k)
		}
	}
	if err := s.db.Model(&PolicyWindow{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return nil, err
	}
	return s.GetWindow(id)
}

func (s *Store) DeleteWindow(id uint) error {
	return s.db.Delete(&PolicyWindow{}, id).Error
}

// ─── Per-Policy Guardrails ────────────────────────────────────────────────────

func (s *Store) GetPolicyGuardrails(policyID uint) (*PolicyGuardrails, error) {
	var g PolicyGuardrails
	return &g, s.db.Where("policy_id = ?", policyID).First(&g).Error
}

// UpsertPolicyGuardrails creates or updates the guardrails row for a policy.
func (s *Store) UpsertPolicyGuardrails(policyID uint, updates map[string]interface{}) (*PolicyGuardrails, error) {
	allowed := map[string]bool{
		"skip_workloads": true, "skip_namespaces": true, "skip_ns_node": true,
		"skip_node_labels": true, "skip_node_taints": true,
		"min_replicas": true, "workload_overrides": true,
	}
	for k := range updates {
		if !allowed[k] {
			delete(updates, k)
		}
	}

	// Ensure a row exists first
	var g PolicyGuardrails
	err := s.db.Where("policy_id = ?", policyID).First(&g).Error
	if err == gorm.ErrRecordNotFound {
		g = PolicyGuardrails{PolicyID: policyID}
		if err := s.db.Create(&g).Error; err != nil {
			return nil, fmt.Errorf("upsert policy guardrails create: %w", err)
		}
	} else if err != nil {
		return nil, err
	}

	if len(updates) > 0 {
		if err := s.db.Model(&PolicyGuardrails{}).Where("policy_id = ?", policyID).Updates(updates).Error; err != nil {
			return nil, err
		}
	}
	return s.GetPolicyGuardrails(policyID)
}

// ─── Policy Overrides ─────────────────────────────────────────────────────────

func (s *Store) CreatePolicyOverride(o *PolicyOverride) error {
	return s.db.Create(o).Error
}

func (s *Store) ListPolicyOverrides(policyID uint) ([]PolicyOverride, error) {
	var overrides []PolicyOverride
	return overrides, s.db.Where("policy_id = ? AND occurrence_date >= CURRENT_DATE", policyID).Find(&overrides).Error
}

func (s *Store) DeletePolicyOverride(policyID uint, date string, edge string) error {
	return s.db.Where("policy_id = ? AND occurrence_date = ? AND edge = ?", policyID, date, edge).
		Delete(&PolicyOverride{}).Error
}

// PurgeExpiredOverrides deletes all overrides with occurrence_date < today.
func (s *Store) PurgeExpiredOverrides() error {
	return s.db.Where("occurrence_date < CURRENT_DATE").Delete(&PolicyOverride{}).Error
}

// HasOverride returns true if a skip override exists for the given policy, date, and edge.
func (s *Store) HasOverride(policyID uint, occurrenceDate string, edge string) (bool, error) {
	var count int64
	err := s.db.Model(&PolicyOverride{}).
		Where("policy_id = ? AND occurrence_date = ? AND (edge = ? OR edge = 'both') AND action = 'skip'",
			policyID, occurrenceDate, edge).
		Count(&count).Error
	return count > 0, err
}
