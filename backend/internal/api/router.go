package api

import (
	"log/slog"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/macxsimilian/kube-phoenix/backend/internal/k8s"
	authmw "github.com/macxsimilian/kube-phoenix/backend/internal/middleware"
	"github.com/macxsimilian/kube-phoenix/backend/internal/scheduler"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	"github.com/macxsimilian/kube-phoenix/backend/web"
)

type Handler struct {
	store     *store.Store
	k8s       *k8s.Client
	scheduler *scheduler.Scheduler
}

func NewRouter(st *store.Store, k8sClient *k8s.Client, sched *scheduler.Scheduler) *chi.Mux {
	h := &Handler{store: st, k8s: k8sClient, scheduler: sched}

	r := chi.NewRouter()
	r.Use(chiMiddleware.RequestID) // injects X-Request-Id header; correlates log lines
	r.Use(chiMiddleware.Logger)
	r.Use(chiMiddleware.Recoverer)
	r.Use(corsHandler())
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1 MB
			next.ServeHTTP(w, r)
		})
	})

	// Health endpoint — no auth, used by K8s liveness/readiness probes
	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		if err := st.Ping(); err != nil {
			slog.Error("healthz: database ping failed", "err", err)
			http.Error(w, `{"error":"database unavailable"}`, http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
	})

	// All routes below require basic auth
	r.Group(func(r chi.Router) {
		r.Use(authmw.BasicAuth)

		r.Route("/api", func(r chi.Router) {
			// ── V2: Sleep Policies ─────────────────────────────────────────────
			r.Get("/policies", h.listPolicies)
			r.Post("/policies", h.createPolicy)
			r.Get("/policies/{id}", h.getPolicy)
			r.Put("/policies/{id}", h.updatePolicy)
			r.Delete("/policies/{id}", h.deletePolicy)

			// Policy windows
			r.Get("/policies/{id}/windows", h.listWindows)
			r.Post("/policies/{id}/windows", h.createWindow)
			r.Put("/policies/{id}/windows/{wid}", h.updateWindow)
			r.Delete("/policies/{id}/windows/{wid}", h.deleteWindow)

			// Per-policy guardrails
			r.Get("/policies/{id}/guardrails", h.getPolicyGuardrails)
			r.Put("/policies/{id}/guardrails", h.updatePolicyGuardrails)

			// Policy overrides (skip next occurrence)
			r.Post("/policies/{id}/overrides", h.createOverride)
			r.Delete("/policies/{id}/overrides/{date}/{edge}", h.deleteOverride)

			// ── V1 Legacy: Schedules — deprecated, use /api/policies ──────────
			r.Group(func(r chi.Router) {
				r.Use(func(next http.Handler) http.Handler {
					return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						w.Header().Set("X-Deprecated", "true")
						w.Header().Set("X-Deprecated-Message", "Use /api/policies. Schedule endpoints will be removed in a future release.")
						next.ServeHTTP(w, r)
					})
				})
				r.Get("/schedules", h.listSchedules)
				r.Post("/schedules", h.createSchedule)
				r.Get("/schedules/{id}", h.getSchedule)
				r.Put("/schedules/{id}", h.updateSchedule)
				r.Delete("/schedules/{id}", h.deleteSchedule)
			})

			// ── Guardrails (global) ────────────────────────────────────────────
			r.Get("/guardrails", h.getGuardrails)
			r.Put("/guardrails", h.updateGuardrails)

			// ── Executions ────────────────────────────────────────────────────
			r.Get("/executions", h.listExecutions)
			r.Get("/executions/{id}", h.getExecution)
			r.Get("/executions/{id}/logs", h.getExecutionLogs)

			// ── Cluster state ─────────────────────────────────────────────────
			r.Get("/cluster/workloads", h.getWorkloads)
			r.Get("/cluster/nodes", h.getNodes)
			r.Get("/cluster/nodes/{name}/pods", h.getNodePods)

			// ── Notifications ─────────────────────────────────────────────────
			r.Get("/notifications", h.listNotifications)
			r.Patch("/notifications/{id}", h.patchNotification)
			r.Delete("/notifications", h.dismissAllNotifications)

			// ── Manual trigger (v2 + v1 compat) ───────────────────────────────
			r.Post("/trigger", h.trigger)
		})

		// WebSocket — live log streaming
		r.Get("/ws/executions/{id}/logs", h.wsExecutionLogs)
	})

	// Embedded Next.js static export — SPA fallback for all other routes
	r.Mount("/", web.SPAHandler())

	return r
}

// corsHandler returns a CORS middleware.
// In production (basic auth enabled) only same-origin requests are allowed.
// In dev mode (no auth) the wildcard is used for convenience.
func corsHandler() func(http.Handler) http.Handler {
	allowedOrigins := []string{"*"}
	if os.Getenv("BASIC_AUTH_USER") != "" {
		// Restrict to same-origin. Adjust if you deploy behind a different hostname.
		allowedOrigins = []string{"https://*", "http://*"}
	}
	return cors.Handler(cors.Options{
		AllowedOrigins: allowedOrigins,
		AllowedMethods: []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"Accept", "Authorization", "Content-Type"},
	})
}
