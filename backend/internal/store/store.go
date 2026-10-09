// SPDX-License-Identifier: Apache-2.0

// Package store implements the PostgreSQL persistence layer via GORM,
// including models, queries, migrations, and snapshot accounting
// (CountOpenSnapshotsForRestore for scheduler drift detection).
package store

import (
	"context"
	"log/slog"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/metrics"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Defaults for the database connection pool. These values keep the pool small
// because kube-phoenix is a low-QPS internal tool; operators can override them
// via DB_MAX_OPEN_CONNS, DB_MAX_IDLE_CONNS, and DB_CONN_MAX_LIFETIME_MIN
// (parsed once by the config package and passed in via PoolConfig).
const (
	DBMaxOpenConns           = 10
	DBMaxIdleConns           = 5
	DBConnMaxLifetimeMinutes = 5
)

// PoolConfig groups the connection-pool tunables that callers may override.
type PoolConfig struct {
	MaxOpenConns           int
	MaxIdleConns           int
	ConnMaxLifetimeMinutes int
	AutoMigrate            bool
}

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

func New(dsn string, pool PoolConfig) (*Store, error) {
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return nil, err
	}
	slog.Info("store: connected to database")

	// Configure the underlying connection pool to avoid exhausting PostgreSQL
	// max_connections (default: 100). Keep the pool small — this is a low-QPS
	// internal tool. Tunables come from PoolConfig (populated by the config
	// package from env vars at startup).
	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	sqlDB.SetMaxOpenConns(pool.MaxOpenConns)
	sqlDB.SetMaxIdleConns(pool.MaxIdleConns)
	sqlDB.SetConnMaxLifetime(time.Duration(pool.ConnMaxLifetimeMinutes) * time.Minute)
	sqlDB.SetConnMaxIdleTime(2 * time.Minute)

	if err := runMigrations(db, pool.AutoMigrate); err != nil {
		return nil, err
	}

	return &Store{db: db}, nil
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

func (s *Store) Ping() error { return s.PingContext(context.Background()) }
func (s *Store) PingContext(ctx context.Context) error {
	db, err := s.db.DB()
	if err != nil {
		return err
	}
	return db.PingContext(ctx)
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
