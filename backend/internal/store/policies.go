// SPDX-License-Identifier: Apache-2.0

package store

import (
	"fmt"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/stringutil"
	"gorm.io/gorm"
)

// ─── Policies ─────────────────────────────────────────────────────────────────

func (s *Store) ListPolicies() ([]Policy, error) {
	var policies []Policy
	return policies, s.db.Order("id asc").Find(&policies).Error
}

// ListEnabledPolicies returns only enabled policies, avoiding fetching
// disabled policies that will be filtered out in-memory anyway.
func (s *Store) ListEnabledPolicies() ([]Policy, error) {
	var policies []Policy
	return policies, s.db.Where("enabled = true").Order("id asc").Find(&policies).Error
}

func (s *Store) GetPolicy(id uint) (*Policy, error) {
	var p Policy
	return &p, s.db.First(&p, id).Error
}

// GetPolicyByName returns the policy with the given name. Used by the import
// flow to resolve cross-environment policy references that travel by name
// rather than FK ID.
func (s *Store) GetPolicyByName(name string) (*Policy, error) {
	var p Policy
	return &p, s.db.Where("name = ?", name).First(&p).Error
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
	p := &Policy{}
	p.ID = id
	if err := selectiveUpdate(s.db, p, updates, allowed); err != nil {
		return nil, fmt.Errorf("update policy %d: %w", id, err)
	}
	return s.GetPolicy(id)
}

func (s *Store) UpdatePolicyState(id uint, state string, nextTransition *time.Time) error {
	now := time.Now()
	updates := map[string]interface{}{
		"current_state":      state,
		"state_since":        now,
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

// ErrTransitionAlreadyClaimed is returned by SetPolicyTransitioning when a
// concurrent caller already moved the policy into the transitioning state.
var ErrTransitionAlreadyClaimed = fmt.Errorf("transition already claimed by another caller")

// SetPolicyTransitioning atomically claims the transition. Returns
// ErrTransitionAlreadyClaimed when another caller won the race.
func (s *Store) SetPolicyTransitioning(id uint) error {
	now := time.Now()
	result := s.db.Model(&Policy{}).
		Where("id = ? AND current_state != ?", id, PolicyStateTransitioning).
		Updates(map[string]interface{}{
			"current_state": PolicyStateTransitioning,
			"state_since":   now,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrTransitionAlreadyClaimed
	}
	return nil
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
		// delete executions, snapshots, and exceptions.
		for _, model := range []interface{}{
			&WorkloadSnapshot{},
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

// HasApplyPolicyOverlap returns true when another apply-mode policy could
// potentially overlap with the given namespace scope. Used for conflict
// detection on save — blocks when overlap is likely.
//
// Both enabled and disabled policies are checked, because a disabled policy can
// be enabled at any time and would then silently conflict. Label selector
// intersection is not computed (would require a K8s API call); same-namespace
// policies are treated as overlapping.
func (s *Store) HasApplyPolicyOverlap(excludeID uint, namespaceFilter string) (bool, error) {
	if namespaceFilter == "" {
		var count int64
		err := s.db.Model(&Policy{}).
			Where("id != ? AND mode = 'apply'", excludeID).
			Count(&count).Error
		return count > 0, err
	}

	var others []Policy
	err := s.db.Model(&Policy{}).
		Where("id != ? AND mode = 'apply'", excludeID).
		Find(&others).Error
	if err != nil {
		return false, err
	}

	namespaces := stringutil.SplitCSVSet(namespaceFilter)
	for _, other := range others {
		if other.NamespaceFilter == "" {
			return true, nil
		}
		if namespacesOverlap(namespaces, stringutil.SplitCSVSet(other.NamespaceFilter)) {
			return true, nil
		}
	}
	return false, nil
}

func namespacesOverlap(a, b map[string]bool) bool {
	if len(a) > len(b) {
		a, b = b, a
	}
	for ns := range a {
		if b[ns] {
			return true
		}
	}
	return false
}

// DisableAllPolicies sets enabled=false on all currently enabled policies.
// Returns the number of policies that were disabled.
func (s *Store) DisableAllPolicies() (int64, error) {
	result := s.db.Model(&Policy{}).Where("enabled = true").Update("enabled", false)
	return result.RowsAffected, result.Error
}
