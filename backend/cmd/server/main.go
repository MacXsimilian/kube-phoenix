// SPDX-License-Identifier: Apache-2.0

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
	"sync"
	"syscall"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/api"
	k8sclient "github.com/macxsimilian/kube-phoenix/backend/internal/k8s"
	"github.com/macxsimilian/kube-phoenix/backend/internal/metrics"
	"github.com/macxsimilian/kube-phoenix/backend/internal/observability"
	"github.com/macxsimilian/kube-phoenix/backend/internal/scheduler"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

const (
	httpReadTimeout        = 15 * time.Second
	httpIdleTimeout        = 60 * time.Second
	shutdownTimeout        = 30 * time.Second
	sessionCleanupInterval = 15 * time.Minute
	auditRetentionInterval = 24 * time.Hour
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
	defer st.Close()
	if err := st.SeedDefaults(); err != nil {
		slog.Error("seed failed", "err", err)
		os.Exit(1)
	}
	recoverInterruptedState(st)

	// ── Kubernetes client ─────────────────────────────────────────────────
	k8s, err := k8sclient.New()
	if err != nil {
		slog.Warn("k8s client unavailable — cluster endpoints will be non-functional", "err", err)
		k8s = nil
	}

	// Two contexts so HTTP shutdown can finish (handlers may still produce
	// audit entries) before we cancel the AuditWriter and let it drain.
	bgCtx, bgCancel := context.WithCancel(context.Background())
	defer bgCancel()
	auditCtx, auditCancel := context.WithCancel(context.Background())
	defer auditCancel()

	// Single WaitGroup tracks every background goroutine so shutdown can wait
	// for all of them — including the AuditWriter drain — before closing the
	// store. New workers must register here, never via bare `go fn(ctx)`.
	var wg sync.WaitGroup

	// ── Cluster cache ─────────────────────────────────────────────────────
	var cache *k8sclient.ClusterCache
	if k8s != nil {
		cache = k8sclient.NewClusterCache(k8s.Clientset())
		cache.Start(bgCtx)
		defer cache.Stop()
	}

	// ── Policy scheduler ──────────────────────────────────────────────────
	g, err := st.GetGuardrails()
	if err != nil {
		slog.Error("failed to load guardrails", "err", err)
		os.Exit(1)
	}
	policySched := scheduler.NewPolicyScheduler(st, k8s, scheduler.SchedulerConfig{
		TickInterval:        g.ParseSchedulerEvalInterval(),
		AutoWake:            g.SchedulerAutoWake,
		ReconcileWhileAwake: g.SchedulerReconcileWhileAwake,
		EnforceSleep:        g.SchedulerEnforceSleep,
	})
	if k8s != nil {
		if err := policySched.Start(bgCtx); err != nil {
			slog.Error("policy scheduler failed to start", "err", err)
			os.Exit(1)
		}
		defer policySched.Stop()
	}

	// ── Observability collector ───────────────────────────────────────────
	obsCollector, err := observability.NewCollector(st)
	if err != nil {
		slog.Error("observability collector init failed", "err", err)
		os.Exit(1)
	}
	runTracked(&wg, "observability-collector", func() { obsCollector.Start(bgCtx) })

	if k8s != nil {
		k8s.SetCallRecorder(obsCollector.CallRecorder())
	}

	// ── Audit writer (separate ctx — must drain after HTTP shutdown) ──────
	auditWriter := api.NewAuditWriter(st, 4096)
	runTracked(&wg, "audit-writer", func() { auditWriter.Start(auditCtx) })

	retentionDays := parseIntEnv("AUDIT_RETENTION_DAYS", 90)
	startMaintenanceTickers(bgCtx, st, retentionDays, &wg)

	// ── HTTP server ───────────────────────────────────────────────────────
	router := api.NewRouter(bgCtx, st, k8s, policySched, cache, obsCollector, auditWriter)
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", *port),
		Handler:      router,
		ReadTimeout:  httpReadTimeout,
		WriteTimeout: 0, // disabled for WebSocket streaming
		IdleTimeout:  httpIdleTimeout,
	}

	go func() {
		slog.Info("kube-phoenix listening", "port", *port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "err", err)
			os.Exit(1)
		}
	}()

	// ── Graceful shutdown ─────────────────────────────────────────────────
	// Order matters:
	//   1. Stop accepting new requests; let in-flight handlers finish (they
	//      may still enqueue audit entries on the writer's channel).
	//   2. Cancel background workers (collector, scheduler, tickers).
	//   3. Cancel the audit writer last so its drain loop sees every entry
	//      produced during step 1.
	//   4. wg.Wait, then defer st.Close() — only safe to drop the DB now.
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("shutdown: stopping HTTP server")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer shutdownCancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("shutdown: HTTP server error", "err", err)
	}

	slog.Info("shutdown: stopping background workers")
	bgCancel()

	slog.Info("shutdown: draining audit writer")
	auditCancel()

	wg.Wait()
	slog.Info("bye")
}

// runTracked launches fn in a goroutine bound to wg, recovering from panics so
// a crash in any worker can never leak a WaitGroup count.
func runTracked(wg *sync.WaitGroup, name string, fn func()) {
	wg.Add(1)
	go func() {
		defer wg.Done()
		defer func() {
			if r := recover(); r != nil {
				slog.Error("background worker panicked (recovered)", "worker", name, "panic", r)
			}
		}()
		fn()
	}()
}

// recoverInterruptedState clears any policy executions and transitions left
// hanging by a previous crash or unclean shutdown.
func recoverInterruptedState(st *store.Store) {
	if n, err := st.MarkInterruptedPolicyExecutions(); err != nil {
		slog.Error("startup: failed to mark interrupted policy executions", "err", err)
	} else if n > 0 {
		slog.Warn("startup: marked policy executions as interrupted", "count", n)
	}
	if n, err := st.ResetStuckTransitioningPolicies(); err != nil {
		slog.Error("startup: failed to reset stuck transitioning policies", "err", err)
	} else if n > 0 {
		slog.Warn("startup: reset stuck transitioning policies to unknown", "count", n)
	}
}

func startMaintenanceTickers(ctx context.Context, st *store.Store, retentionDays int, wg *sync.WaitGroup) {
	// Session cleanup — every 15 minutes.
	wg.Add(1)
	go func() {
		defer wg.Done()
		runTicker(ctx, sessionCleanupInterval, "session-cleanup", func() {
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
	}()

	// Data retention — daily (audit logs, old executions, expired overrides).
	if retentionDays > 0 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			retention := time.Duration(retentionDays) * 24 * time.Hour
			runTicker(ctx, auditRetentionInterval, "data-retention", func() {
				if n, err := st.CleanOldAuditLogs(retention); err != nil {
					slog.Error("retention: audit logs failed", "err", err)
				} else if n > 0 {
					slog.Info("retention: old audit logs removed", "count", n)
				}
				if n, err := st.CleanOldExecutions(retention); err != nil {
					slog.Error("retention: old executions failed", "err", err)
				} else if n > 0 {
					slog.Info("retention: old executions removed (cascades to log lines + snapshots)", "count", n)
				}
			})
		}()
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
			safeTick(name, fn)
		}
	}
}

func safeTick(name string, fn func()) {
	defer func() {
		if r := recover(); r != nil {
			slog.Error("panic in background ticker (recovered)", "ticker", name, "panic", r)
		}
	}()
	fn()
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
