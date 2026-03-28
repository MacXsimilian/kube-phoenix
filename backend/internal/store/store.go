// Package store implements the PostgreSQL persistence layer via GORM,
// including models, queries, migrations, and snapshot accounting
// (CountOpenSnapshotsForRestore for scheduler drift detection).
package store

import (
	"encoding/json"
	"log/slog"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/policy"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

const (
	dbMaxOpenConns    = 10
	dbMaxIdleConns    = 5
	dbConnMaxLifetime = 5 * time.Minute
)

var allModels = []interface{}{
	&Guardrails{},
	&User{}, &Session{}, &AuditLog{},
	&Policy{}, &PolicyExecution{}, &PolicyLogLine{},
	&WorkloadSnapshot{}, &PolicyOverride{}, &ScheduledException{},
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
	sqlDB.SetMaxOpenConns(dbMaxOpenConns)
	sqlDB.SetMaxIdleConns(dbMaxIdleConns)
	sqlDB.SetConnMaxLifetime(dbConnMaxLifetime)

	if err := runMigrations(db); err != nil {
		return nil, err
	}

	return &Store{db: db}, nil
}

func runMigrations(db *gorm.DB) error {
	// Drop legacy unique index on username alone (replaced by composite username+source).
	db.Exec("DROP INDEX IF EXISTS idx_users_username")
	// Rename misnamed column from GORM's default naming convention (idempotent).
	db.Exec(`DO $$ BEGIN
		IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='o_id_c_subject') THEN
			ALTER TABLE users RENAME COLUMN o_id_c_subject TO oidc_subject;
		END IF;
	END $$`)
	db.Exec("DROP INDEX IF EXISTS idx_users_o_id_c_subject")

	if err := db.AutoMigrate(allModels...); err != nil {
		return err
	}
	// Add CHECK constraints for enum-like status fields (idempotent).
	db.Exec(`DO $$ BEGIN
		ALTER TABLE scheduled_exceptions ADD CONSTRAINT chk_exception_status
			CHECK (status IN ('pending','active','completed','cancelled'));
	EXCEPTION WHEN duplicate_object THEN NULL;
	END $$`)
	db.Exec(`DO $$ BEGIN
		ALTER TABLE policy_executions ADD CONSTRAINT chk_policy_execution_status
			CHECK (status IN ('running','success','failed','interrupted','skipped'));
	EXCEPTION WHEN duplicate_object THEN NULL;
	END $$`)

	slog.Info("store: schema migration complete")

	// Migrate legacy cron-only policies to window format.
	migrateWindowsFromCrons(db)

	// Drop legacy cron columns (idempotent).
	db.Exec("ALTER TABLE policies DROP COLUMN IF EXISTS sleep_cron")
	db.Exec("ALTER TABLE policies DROP COLUMN IF EXISTS wake_cron")
	db.Exec("ALTER TABLE policies DROP COLUMN IF EXISTS next_sleep_at")
	db.Exec("ALTER TABLE policies DROP COLUMN IF EXISTS next_wake_at")

	return nil
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

func (s *Store) Ping() error {
	db, err := s.db.DB()
	if err != nil {
		return err
	}
	return db.Ping()
}
