package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/api"
	k8sclient "github.com/macxsimilian/kube-phoenix/backend/internal/k8s"
	"github.com/macxsimilian/kube-phoenix/backend/internal/scheduler"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

// version is set at build time via:
//
//	go build -ldflags "-X main.version=x.y.z"
var version = "dev"

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

	// ── Kubernetes client ─────────────────────────────────────────────────
	k8s, err := k8sclient.New()
	if err != nil {
		slog.Warn("k8s client unavailable — cluster endpoints will be non-functional", "err", err)
		k8s = nil
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

	// ── HTTP server ───────────────────────────────────────────────────────
	router := api.NewRouter(st, k8s, sched, version)
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

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("shutdown error", "err", err)
	}
	slog.Info("bye")
}
