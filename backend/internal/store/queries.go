// SPDX-License-Identifier: Apache-2.0

package store

import (
	"fmt"
	"log/slog"

	"gorm.io/gorm"
)

// ─── Guardrails ───────────────────────────────────────────────────────────────

func (s *Store) GetGuardrails() (*Guardrails, error) {
	var g Guardrails
	if err := s.db.First(&g).Error; err != nil {
		return nil, fmt.Errorf("get guardrails: %w", err)
	}
	return &g, nil
}

func (s *Store) UpdateGuardrails(updates map[string]interface{}) (*Guardrails, error) {
	existing, err := s.GetGuardrails()
	if err != nil {
		return nil, fmt.Errorf("get existing guardrails: %w", err)
	}
	keys := make([]string, 0, len(updates))
	for key := range updates {
		keys = append(keys, key)
	}
	if err := s.db.Model(existing).Select(keys).Updates(updates).Error; err != nil {
		return nil, err
	}
	return s.GetGuardrails()
}

// ─── Seeds ────────────────────────────────────────────────────────────────────

func (s *Store) SeedDefaults(adminUser, adminPass string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		var gCount int64
		if err := tx.Model(&Guardrails{}).Count(&gCount).Error; err != nil {
			return fmt.Errorf("seed: count guardrails: %w", err)
		}
		if gCount == 0 {
			g := Guardrails{
				ProtectedNamespaces:          "default,istio-gateway,istio-system,karpenter,kube-node-lease,kube-phoenix,kube-public,kube-system,kyverno,kyverno-notation-aws,monitoring,vault,velero,victoriametrics,gitlab",
				SkipNsNode:                   "victoriametrics,karpenter",
				SkipNodeLabels:               "karpenter.k8s.aws/ec2nodeclass=default",
				SkipNodeTaints:               "karpenter-eks-base=true:NoSchedule",
				SchedulerEvalInterval:        "30s",
				SchedulerAutoWake:            true,
				SchedulerReconcileWhileAwake: true,
				ScalingConcurrency:           10,
				WakeWaveSize:                 0,
				WakeWavePauseSeconds:         90,
				ProtectCriticalPodNodes:      false,
			}
			if err := tx.Create(&g).Error; err != nil {
				return fmt.Errorf("seed: create guardrails: %w", err)
			}
		}

		var userCount int64
		if err := tx.Model(&User{}).Count(&userCount).Error; err != nil {
			return fmt.Errorf("seed: count users: %w", err)
		}
		if userCount == 0 {
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
				if err := tx.Create(&admin).Error; err != nil {
					return fmt.Errorf("seed: create admin user: %w", err)
				}
				slog.Info("seed: admin user created from environment variables", "username", adminUser)
			} else {
				slog.Warn("seed: no users in database and ADMIN_USER/ADMIN_PASSWORD not set — no one can log in")
			}
		}

		return nil
	})
}

// ─── Danger zone ──────────────────────────────────────────────────────────────

// DropAllTables drops all application tables in a single CASCADE statement.
func (s *Store) DropAllTables() error {
	if err := s.db.Exec(`DROP TABLE IF EXISTS
		workload_snapshots, policy_log_lines, policy_executions,
		scheduled_exceptions, policies,
		sessions, users, guardrails,
		audit_logs CASCADE`).Error; err != nil {
		return fmt.Errorf("drop tables: %w", err)
	}
	return nil
}

// MigrateSchema recreates the schema from the current models.
func (s *Store) MigrateSchema() error {
	if err := s.db.AutoMigrate(allModels...); err != nil {
		return fmt.Errorf("migrate: %w", err)
	}
	return nil
}
