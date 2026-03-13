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

	if err := db.AutoMigrate(
		// v1 legacy tables
		&Schedule{},
		// v2 models
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

func (s *Store) Ping() error {
	db, err := s.db.DB()
	if err != nil {
		return err
	}
	return db.Ping()
}
