// SPDX-License-Identifier: Apache-2.0

// Package config centralizes all environment-variable parsing so that the
// rest of the codebase can rely on a typed, immutable AppConfig populated
// once at startup. Cohesive sub-configs (OIDC, scheduler) are intentionally
// kept in their own packages and not duplicated here.
package config

import (
	"errors"
	"log/slog"
	"os"
	"strconv"
	"time"
)

// Database connection pool defaults. Mirrored from store.DB* constants to
// avoid an import cycle; both must stay in sync.
const (
	defaultDBMaxOpenConns           = 10
	defaultDBMaxIdleConns           = 5
	defaultDBConnMaxLifetimeMinutes = 5
)

// Other startup defaults.
const (
	defaultAuditRetentionDays = 90
	defaultK8sQPS             = 100
	defaultK8sBurst           = 200
	defaultSessionIdleTimeout = 8 * time.Hour
	defaultSessionMaxLifetime = 24 * time.Hour
)

// AppConfig holds every process-wide setting parsed from the environment.
type AppConfig struct {
	// Database
	DatabaseURL              string
	DBMaxOpenConns           int
	DBMaxIdleConns           int
	DBConnMaxLifetimeMinutes int
	AutoMigrate              bool

	// HTTP / sessions
	CookieSecure       bool
	CORSAllowedOrigin  string
	SessionIdleTimeout time.Duration
	SessionMaxLifetime time.Duration

	// Kubernetes
	Kubeconfig  string
	ClusterName string
	K8sQPS      int
	K8sBurst    int

	// Admin / auth bootstrap
	AdminUser     string
	AdminPassword string

	// Maintenance
	AuditRetentionDays int
}

// Load parses the environment and returns a fully populated AppConfig.
// Returns an error only for fields without a sensible default (currently
// DATABASE_URL).
func Load() (*AppConfig, error) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		return nil, errors.New("DATABASE_URL environment variable is required")
	}
	return &AppConfig{
		DatabaseURL:              dsn,
		DBMaxOpenConns:           intEnvOr("DB_MAX_OPEN_CONNS", defaultDBMaxOpenConns),
		DBMaxIdleConns:           intEnvOr("DB_MAX_IDLE_CONNS", defaultDBMaxIdleConns),
		DBConnMaxLifetimeMinutes: intEnvOr("DB_CONN_MAX_LIFETIME_MIN", defaultDBConnMaxLifetimeMinutes),
		AutoMigrate:              os.Getenv("AUTO_MIGRATE") != "false",

		CookieSecure:       os.Getenv("COOKIE_SECURE") != "false",
		CORSAllowedOrigin:  os.Getenv("CORS_ALLOWED_ORIGIN"),
		SessionIdleTimeout: durationEnvOr("SESSION_IDLE_TIMEOUT", defaultSessionIdleTimeout),
		SessionMaxLifetime: durationEnvOr("SESSION_MAX_LIFETIME", defaultSessionMaxLifetime),

		Kubeconfig:  os.Getenv("KUBECONFIG"),
		ClusterName: os.Getenv("CLUSTER_NAME"),
		K8sQPS:      intEnvOr("K8S_QPS", defaultK8sQPS),
		K8sBurst:    intEnvOr("K8S_BURST", defaultK8sBurst),

		AdminUser:     os.Getenv("ADMIN_USER"),
		AdminPassword: os.Getenv("ADMIN_PASSWORD"),

		AuditRetentionDays: intEnvOr("AUDIT_RETENTION_DAYS", defaultAuditRetentionDays),
	}, nil
}

func intEnvOr(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		slog.Warn("invalid int env var, using default", "key", key, "value", v, "default", fallback)
		return fallback
	}
	return n
}

func durationEnvOr(key string, fallback time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		slog.Warn("invalid duration env var, using default", "key", key, "value", v, "default", fallback)
		return fallback
	}
	return d
}
