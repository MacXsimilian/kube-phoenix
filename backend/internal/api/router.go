package api

import (
	"log/slog"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/macxsimilian/kube-phoenix/backend/internal/docs"
	"github.com/macxsimilian/kube-phoenix/backend/internal/k8s"
	authmw "github.com/macxsimilian/kube-phoenix/backend/internal/middleware"
	"github.com/macxsimilian/kube-phoenix/backend/internal/scheduler"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	"github.com/macxsimilian/kube-phoenix/backend/web"
	swguiv5 "github.com/swaggest/swgui/v5"
)

type Handler struct {
	store     *store.Store
	k8s       *k8s.Client
	scheduler *scheduler.Scheduler
	cache     *k8s.ClusterCache
}

func NewRouter(st *store.Store, k8sClient *k8s.Client, sched *scheduler.Scheduler, cache *k8s.ClusterCache) *chi.Mux {
	h := &Handler{store: st, k8s: k8sClient, scheduler: sched, cache: cache}

	r := chi.NewRouter()
	r.Use(chiMiddleware.RequestID) // injects X-Request-Id header; correlates log lines
	r.Use(authmw.RedactWSToken)   // must be before Logger — strips ?token= from URL before it is logged
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

		// Swagger UI — served at /api/docs/
		r.Get("/api/docs", func(w http.ResponseWriter, r *http.Request) {
			http.Redirect(w, r, "/api/docs/", http.StatusMovedPermanently)
		})
		r.Get("/api/docs/openapi.yaml", docs.SpecHandler().ServeHTTP)
		r.Mount("/api/docs/", swguiv5.NewHandler("kube-phoenix API", "/api/docs/openapi.yaml", "/api/docs/"))

		r.Route("/api", func(r chi.Router) {
			// Schedules — full CRUD
			r.Get("/schedules", h.listSchedules)
			r.Post("/schedules", h.createSchedule)
			r.Put("/schedules/reorder", h.reorderSchedules)
			r.Get("/schedules/{id}", h.getSchedule)
			r.Put("/schedules/{id}", h.updateSchedule)
			r.Delete("/schedules/{id}", h.deleteSchedule)

			// Guardrails
			r.Get("/guardrails", h.getGuardrails)
			r.Put("/guardrails", h.updateGuardrails)

			// Executions
			r.Get("/executions", h.listExecutions)
			r.Get("/executions/{id}", h.getExecution)
			r.Get("/executions/{id}/logs", h.getExecutionLogs)

			// Overview — pre-aggregated dashboard summary (reads from cache)
			r.Get("/overview", h.getOverview)
			r.Get("/cluster/stream", h.streamCluster)

			// Cluster state
			r.Get("/cluster/workloads", h.getWorkloads)
			r.Get("/cluster/nodes", h.getNodes)
			r.Get("/cluster/nodes/{name}/pods", h.getNodePods)
			r.Get("/cluster/pods/{namespace}/{name}", h.getPodDetail)
			r.Get("/cluster/workloads/{namespace}/{kind}/{name}/pods", h.getWorkloadPods)

			// Manual trigger
			r.Post("/trigger", h.trigger)

			// Admin — danger zone
			r.Post("/admin/reset-db", h.resetDB)
		})

		// WebSocket — live log streaming
		r.Get("/ws/executions/{id}/logs", h.wsExecutionLogs)
	})

	// Embedded Next.js static export — SPA fallback for all other routes
	r.Mount("/", web.SPAHandler())

	return r
}

// corsHandler returns a CORS middleware.
// In production (basic auth enabled) origins are restricted to the value of
// CORS_ALLOWED_ORIGIN. If that env var is unset, no cross-origin requests are
// allowed (same-origin only via empty AllowedOrigins).
// In dev mode (no auth) the wildcard is used for convenience.
func corsHandler() func(http.Handler) http.Handler {
	allowedOrigins := []string{"*"}
	if os.Getenv("BASIC_AUTH_USER") != "" {
		// Restrict to an explicit origin or deny all cross-origin requests.
		if origin := os.Getenv("CORS_ALLOWED_ORIGIN"); origin != "" {
			allowedOrigins = []string{origin}
		} else {
			allowedOrigins = []string{}
		}
	}
	return cors.Handler(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: false,
	})
}
