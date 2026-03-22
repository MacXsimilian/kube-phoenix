package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/api"
	k8sclient "github.com/macxsimilian/kube-phoenix/backend/internal/k8s"
	"github.com/macxsimilian/kube-phoenix/backend/internal/metrics"
	"github.com/macxsimilian/kube-phoenix/backend/internal/scheduler"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

func main() {
	// Structured JSON logging — compatible with Kubernetes log aggregators.
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))

	port := flag.Int("port", 8080, "HTTP listen port")
	flag.Parse()

	// ── Store (PostgreSQL) ────────────────────────────────────────────────
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		slog.Error("DATABASE_URL environment variable is required")
		os.Exit(1)
	}
	st, err := store.New(dsn)
	if err != nil {
		slog.Error("store init failed", "err", err)
		os.Exit(1)
	}
	if err := st.SeedDefaults(); err != nil {
		slog.Error("seed failed", "err", err)
		os.Exit(1)
	}
	if n, err := st.MarkInterruptedExecutions(); err != nil {
		slog.Error("startup: failed to mark interrupted executions", "err", err)
	} else if n > 0 {
		slog.Warn("startup: marked executions as interrupted (pod was restarted mid-run)", "count", n)
	}

	// ── Kubernetes client ─────────────────────────────────────────────────
	k8s, err := k8sclient.New()
	if err != nil {
		slog.Warn("k8s client unavailable — cluster endpoints will be non-functional", "err", err)
		k8s = nil
	}

	// ── Cluster cache ─────────────────────────────────────────────────────
	var cache *k8sclient.ClusterCache
	if k8s != nil {
		cache = k8sclient.NewClusterCache(k8s)
		cache.Start(context.Background())
	}

	// ── Scheduler ─────────────────────────────────────────────────────────
	sched := scheduler.New(st, k8s)
	if k8s != nil {
		if err := sched.Start(context.Background()); err != nil {
			slog.Error("scheduler failed to start", "err", err)
			os.Exit(1)
		}
		defer sched.Stop()
	}

	// ── Background maintenance tickers ────────────────────────────────────
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	retentionDays := parseIntEnv("AUDIT_RETENTION_DAYS", 90)
	startMaintenanceTickers(ctx, st, retentionDays)

	// ── HTTP server ───────────────────────────────────────────────────────
	router := api.NewRouter(ctx, st, k8s, sched, cache)
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", *port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 0, // disabled for WebSocket streaming
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		slog.Info("kube-phoenix listening", "port", *port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "err", err)
			os.Exit(1)
		}
	}()

	// ── Graceful shutdown ─────────────────────────────────────────────────
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	slog.Info("shutting down...")
	cancel() // stop background tickers

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("shutdown error", "err", err)
	}
	slog.Info("bye")
}

func startMaintenanceTickers(ctx context.Context, st *store.Store, retentionDays int) {
	// Session cleanup — every 15 minutes.
	go runTicker(ctx, 15*time.Minute, "session-cleanup", func() {
		deleted, err := st.CleanExpiredSessions()
		if err != nil {
			slog.Error("session-cleanup failed", "err", err)
			return
		}
		if deleted > 0 {
			slog.Info("session-cleanup: expired sessions removed", "count", deleted)
		}
		if count, err := st.CountActiveSessions(); err == nil {
			metrics.ActiveSessions.Set(float64(count))
		}
	})

	// Audit log retention — daily.
	if retentionDays > 0 {
		go runTicker(ctx, 24*time.Hour, "audit-retention", func() {
			deleted, err := st.CleanOldAuditLogs(time.Duration(retentionDays) * 24 * time.Hour)
			if err != nil {
				slog.Error("audit-retention failed", "err", err)
				return
			}
			if deleted > 0 {
				slog.Info("audit-retention: old entries removed", "count", deleted, "retentionDays", retentionDays)
			}
		})
	}
}

func runTicker(ctx context.Context, interval time.Duration, name string, fn func()) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			fn()
		}
	}
}

func parseIntEnv(key string, fallback int) int {
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
