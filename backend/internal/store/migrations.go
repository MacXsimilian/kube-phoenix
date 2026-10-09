// SPDX-License-Identifier: Apache-2.0

package store

import (
	"encoding/json"
	"log/slog"

	"github.com/macxsimilian/kube-phoenix/backend/internal/policy"
	"gorm.io/gorm"
)

func runMigrations(db *gorm.DB, autoMigrate bool) error {
	// Drop legacy unique index on username alone (replaced by composite username+source).
	if err := db.Exec("DROP INDEX IF EXISTS idx_users_username").Error; err != nil {
		slog.Warn("migration: drop legacy username index failed (non-fatal)", "err", err)
	}
	// Rename misnamed column from GORM's default naming convention (idempotent).
	if err := db.Exec(`DO $$ BEGIN
		IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='o_id_c_subject') THEN
			ALTER TABLE users RENAME COLUMN o_id_c_subject TO oidc_subject;
		END IF;
	END $$`).Error; err != nil {
		slog.Warn("migration: rename oidc_subject column failed (non-fatal)", "err", err)
	}
	if err := db.Exec("DROP INDEX IF EXISTS idx_users_o_id_c_subject").Error; err != nil {
		slog.Warn("migration: drop legacy oidc index failed (non-fatal)", "err", err)
	}

	// Drop the legacy policy_overrides table (overrides were merged into exceptions).
	if err := db.Exec("DROP TABLE IF EXISTS policy_overrides CASCADE").Error; err != nil {
		slog.Warn("migration: drop policy_overrides table failed (non-fatal)", "err", err)
	}

	// Rename the misleading system_namespaces column. The list never represented
	// "Kubernetes system namespaces"; it has always been the operator's list of
	// namespaces this app must never scale or drain.
	if err := db.Exec(`DO $$ BEGIN
		IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='guardrails' AND column_name='system_namespaces')
		AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='guardrails' AND column_name='protected_namespaces') THEN
			ALTER TABLE guardrails RENAME COLUMN system_namespaces TO protected_namespaces;
		END IF;
	END $$`).Error; err != nil {
		slog.Warn("migration: rename system_namespaces column failed (non-fatal)", "err", err)
	}

	if !autoMigrate {
		slog.Info("store: auto-migration skipped (AUTO_MIGRATE=false)")
	} else {
		slog.Info("store: running auto-migration")
		if err := db.AutoMigrate(allModels...); err != nil {
			return err
		}
	}
	// Add CHECK constraints for enum-like status fields (idempotent).
	if err := db.Exec(`DO $$ BEGIN
		ALTER TABLE scheduled_exceptions ADD CONSTRAINT chk_exception_status
			CHECK (status IN ('pending','active','completed','cancelled'));
	EXCEPTION WHEN duplicate_object THEN NULL;
	END $$`).Error; err != nil {
		slog.Warn("migration: add exception status CHECK failed (non-fatal)", "err", err)
	}
	if err := db.Exec(`DO $$ BEGIN
		ALTER TABLE policy_executions ADD CONSTRAINT chk_policy_execution_status
			CHECK (status IN ('running','success','failed','interrupted'));
	EXCEPTION WHEN duplicate_object THEN NULL;
	END $$`).Error; err != nil {
		slog.Warn("migration: add execution status CHECK failed (non-fatal)", "err", err)
	}

	addEnumCheckConstraints(db)

	slog.Info("store: schema migration complete")

	// Seed default observability thresholds.
	st := &Store{db: db}
	if err := st.SeedDefaultThresholds(); err != nil {
		slog.Warn("migration: seed observability thresholds failed (non-fatal)", "err", err)
	}

	// Migrate legacy cron-only policies to window format.
	migrateWindowsFromCrons(db)

	// Drop legacy cron columns (idempotent).
	for _, column := range []string{"sleep_cron", "wake_cron", "next_sleep_at", "next_wake_at"} {
		if err := db.Exec("ALTER TABLE policies DROP COLUMN IF EXISTS " + column).Error; err != nil {
			slog.Warn("migration: drop legacy column failed (non-fatal)", "column", column, "err", err)
		}
	}

	return nil
}

// addEnumCheckConstraints adds CHECK constraints for all enum-like string
// columns. Each constraint is idempotent (duplicate_object is caught).
func addEnumCheckConstraints(db *gorm.DB) {
	checks := []struct{ table, name, expr string }{
		{"policies", "chk_policy_mode", "mode IN ('plan','apply')"},
		{"policies", "chk_policy_state", "current_state IN ('sleeping','awake','unknown','transitioning')"},
		{"policy_executions", "chk_policy_execution_direction", "direction IN ('sleep','wake')"},
		{"users", "chk_user_role", "role IN ('admin','operator','viewer')"},
		{"users", "chk_user_source", "source IN ('local','oidc')"},
	}
	for _, c := range checks {
		sql := "DO $$ BEGIN ALTER TABLE " + c.table + " ADD CONSTRAINT " + c.name + " CHECK (" + c.expr + "); EXCEPTION WHEN duplicate_object THEN NULL; END $$"
		if err := db.Exec(sql).Error; err != nil {
			slog.Warn("migration: add CHECK constraint failed (non-fatal)", "table", c.table, "constraint", c.name, "err", err)
		}
	}
}

// migrateWindowsFromCrons converts legacy cron-only policies to the window format.
func migrateWindowsFromCrons(db *gorm.DB) {
	// Check if the legacy columns still exist.
	var count int64
	db.Raw("SELECT COUNT(*) FROM information_schema.columns WHERE table_name='policies' AND column_name='sleep_cron'").Scan(&count)
	if count == 0 {
		return // Already migrated.
	}

	type legacyPolicy struct {
		ID           uint
		SleepWindows string
		SleepCron    string
		WakeCron     string
	}
	var policies []legacyPolicy
	db.Raw("SELECT id, sleep_windows, sleep_cron, wake_cron FROM policies WHERE (sleep_windows IS NULL OR sleep_windows = '' OR sleep_windows = '[]') AND (sleep_cron != '' OR wake_cron != '')").Scan(&policies)

	for _, p := range policies {
		windows, err := policy.CronsToWindows(p.SleepCron, p.WakeCron)
		if err != nil || windows == nil {
			slog.Warn("migration: could not reverse-compile crons, creating fallback all-day window",
				"policyID", p.ID, "sleepCron", p.SleepCron, "wakeCron", p.WakeCron)
			windows = []policy.SleepWindow{{
				DaysOfWeek: []int{0, 1, 2, 3, 4, 5, 6},
				AllDay:     true,
			}}
		}
		encodedWindows, _ := json.Marshal(windows)
		db.Exec("UPDATE policies SET sleep_windows = ? WHERE id = ?", string(encodedWindows), p.ID)
		slog.Info("migration: converted cron policy to windows", "policyID", p.ID)
	}
}
