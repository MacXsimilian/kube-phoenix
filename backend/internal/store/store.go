// SPDX-License-Identifier: Apache-2.0

// Package store implements the PostgreSQL persistence layer via GORM,
// including models, queries, migrations, and snapshot accounting
// (CountOpenSnapshotsForRestore for scheduler drift detection).
package store

import (
	"encoding/json"
	"log/slog"
	"os"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/metrics"
	"github.com/macxsimilian/kube-phoenix/backend/internal/policy"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

const (
	DBMaxOpenConns    = 10
	DBMaxIdleConns    = 5
	DBConnMaxLifetime = 5 * time.Minute
)

var allModels = []interface{}{
	&Guardrails{},
	&User{}, &Session{}, &AuditLog{},
	&Policy{}, &PolicyExecution{}, &PolicyLogLine{},
	&WorkloadSnapshot{}, &ScheduledException{},
	&MetricSnapshot{}, &ObservabilityThreshold{},
}

type Store struct {
	db *gorm.DB
}

func New(dsn string) (*Store, error) {
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return nil, err
	}
	slog.Info("store: connected to database")

	// Configure the underlying connection pool to avoid exhausting PostgreSQL
	// max_connections (default: 100). Keep the pool small — this is a low-QPS
	// internal tool.
	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	sqlDB.SetMaxOpenConns(DBMaxOpenConns)
	sqlDB.SetMaxIdleConns(DBMaxIdleConns)
	sqlDB.SetConnMaxLifetime(DBConnMaxLifetime)
	sqlDB.SetConnMaxIdleTime(2 * time.Minute)

	if err := runMigrations(db); err != nil {
		return nil, err
	}

	return &Store{db: db}, nil
}

func runMigrations(db *gorm.DB) error {
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

	if os.Getenv("AUTO_MIGRATE") == "false" {
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
			CHECK (status IN ('running','success','failed','interrupted','skipped'));
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
	for _, col := range []string{"sleep_cron", "wake_cron", "next_sleep_at", "next_wake_at"} {
		if err := db.Exec("ALTER TABLE policies DROP COLUMN IF EXISTS " + col).Error; err != nil {
			slog.Warn("migration: drop legacy column failed (non-fatal)", "column", col, "err", err)
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
		j, _ := json.Marshal(windows)
		db.Exec("UPDATE policies SET sleep_windows = ? WHERE id = ?", string(j), p.ID)
		slog.Info("migration: converted cron policy to windows", "policyID", p.ID)
	}
}

func (s *Store) DB() *gorm.DB { return s.db }

func (s *Store) Close() {
	sqlDB, err := s.db.DB()
	if err != nil {
		slog.Warn("store: failed to get underlying DB for close", "err", err)
		return
	}
	if err := sqlDB.Close(); err != nil {
		slog.Warn("store: close failed", "err", err)
	} else {
		slog.Info("store: database connection closed")
	}
}

func (s *Store) Ping() error {
	db, err := s.db.DB()
	if err != nil {
		return err
	}
	return db.Ping()
}

// UpdatePoolMetrics publishes current sql.DBStats to Prometheus gauges.
func (s *Store) UpdatePoolMetrics() {
	sqlDB, err := s.db.DB()
	if err != nil {
		return
	}
	stats := sqlDB.Stats()
	metrics.DBPoolOpenConnections.Set(float64(stats.OpenConnections))
	metrics.DBPoolInUse.Set(float64(stats.InUse))
	metrics.DBPoolIdle.Set(float64(stats.Idle))
}
