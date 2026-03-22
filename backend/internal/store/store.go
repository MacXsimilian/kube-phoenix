package store

import (
	"log/slog"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

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
	sqlDB.SetMaxOpenConns(10)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(5 * time.Minute)

	// Drop legacy unique index on username alone (replaced by composite username+source).
	db.Exec("DROP INDEX IF EXISTS idx_users_username")
	// Rename misnamed column from GORM's default naming convention (idempotent).
	db.Exec(`DO $$ BEGIN
		IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='o_id_c_subject') THEN
			ALTER TABLE users RENAME COLUMN o_id_c_subject TO oidc_subject;
		END IF;
	END $$`)
	db.Exec("DROP INDEX IF EXISTS idx_users_o_id_c_subject")

	if err := db.AutoMigrate(
		&Schedule{}, &Guardrails{}, &Execution{}, &LogLine{},
		&User{}, &Session{}, &AuditLog{},
		&Policy{}, &PolicyExecution{}, &PolicyLogLine{},
		&WorkloadSnapshot{}, &PolicyOverride{}, &ScheduledException{},
	); err != nil {
		return nil, err
	}
	slog.Info("store: schema migration complete")
	return &Store{db: db}, nil
}

func (s *Store) DB() *gorm.DB { return s.db }

func (s *Store) Ping() error {
	db, err := s.db.DB()
	if err != nil {
		return err
	}
	return db.Ping()
}
