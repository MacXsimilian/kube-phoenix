package store

import (
	"fmt"
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

	if err := db.AutoMigrate(
		&GlobalGuardrails{},
		&SleepPolicy{},
		&PolicyWindow{},
		&PolicyGuardrails{},
		&PolicyOverride{},
		&Execution{},
		&WorkloadSnapshot{},
		&LogLine{},
		&Notification{},
	); err != nil {
		return nil, err
	}
	slog.Info("store: schema migration complete")
	return &Store{db: db}, nil
}

func (s *Store) DB() *gorm.DB { return s.db }

// ResetDB drops all application tables, re-runs AutoMigrate, and seeds defaults.
// Intended for development and disaster recovery.
func (s *Store) ResetDB() error {
	tables := []interface{}{
		&LogLine{}, &WorkloadSnapshot{}, &Notification{},
		&PolicyOverride{}, &PolicyGuardrails{}, &PolicyWindow{},
		&Execution{}, &SleepPolicy{}, &GlobalGuardrails{},
	}
	if err := s.db.Migrator().DropTable(tables...); err != nil {
		return fmt.Errorf("reset: drop tables: %w", err)
	}
	// Re-create in dependency order (same as AutoMigrate)
	if err := s.db.AutoMigrate(
		&GlobalGuardrails{},
		&SleepPolicy{},
		&PolicyWindow{},
		&PolicyGuardrails{},
		&PolicyOverride{},
		&Execution{},
		&WorkloadSnapshot{},
		&LogLine{},
		&Notification{},
	); err != nil {
		return fmt.Errorf("reset: migrate: %w", err)
	}
	if err := s.SeedDefaults(); err != nil {
		return fmt.Errorf("reset: seed: %w", err)
	}
	slog.Info("store: database reset complete")
	return nil
}

func (s *Store) Ping() error {
	db, err := s.db.DB()
	if err != nil {
		return err
	}
	return db.Ping()
}
