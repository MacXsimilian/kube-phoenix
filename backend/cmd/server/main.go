package main

import (
	"context"
	"flag"
	"fmt"
	"log"
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

func main() {
	port := flag.Int("port", 8080, "HTTP listen port")
	flag.Parse()

	// ── Store (PostgreSQL) ────────────────────────────────────────────────
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL environment variable is required")
	}
	st, err := store.New(dsn)
	if err != nil {
		log.Fatalf("store: %v", err)
	}
	if err := st.SeedDefaults(); err != nil {
		log.Fatalf("seed: %v", err)
	}

	// ── Kubernetes client ─────────────────────────────────────────────────
	k8s, err := k8sclient.New()
	if err != nil {
		log.Printf("WARNING: k8s client unavailable (%v) — cluster endpoints will be non-functional", err)
		k8s = nil
	}

	// ── Scheduler ─────────────────────────────────────────────────────────
	sched := scheduler.New(st, k8s)
	if k8s != nil {
		if err := sched.Start(context.Background()); err != nil {
			log.Fatalf("scheduler: %v", err)
		}
		defer sched.Stop()
	}

	// ── HTTP server ───────────────────────────────────────────────────────
	router := api.NewRouter(st, k8s, sched)
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", *port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 0, // disabled for WebSocket streaming
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("kube-phoenix listening on :%d", *port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server: %v", err)
		}
	}()

	// ── Graceful shutdown ─────────────────────────────────────────────────
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("shutdown error: %v", err)
	}
	log.Println("bye")
}
