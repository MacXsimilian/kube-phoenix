// Package api provides the HTTP handler layer, including the Chi router,
// middleware stack, and REST/WebSocket endpoints.
package api

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/macxsimilian/kube-phoenix/backend/internal/auth"
	"github.com/macxsimilian/kube-phoenix/backend/internal/docs"
	"github.com/macxsimilian/kube-phoenix/backend/internal/k8s"
	"github.com/macxsimilian/kube-phoenix/backend/internal/metrics"
	authmw "github.com/macxsimilian/kube-phoenix/backend/internal/middleware"
	"github.com/macxsimilian/kube-phoenix/backend/internal/observability"
	"github.com/macxsimilian/kube-phoenix/backend/internal/scheduler"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	"github.com/macxsimilian/kube-phoenix/backend/web"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	swguiv5 "github.com/swaggest/swgui/v5"
)

// Rate limit settings for login endpoints.
const (
	rateLimitPerIP   = 10
	rateLimitPerUser = 5
	rateLimitWindow  = 15 * time.Minute
)

type Handler struct {
	store           *store.Store
	k8s             *k8s.Client
	policyScheduler *scheduler.PolicyScheduler
	cache           *k8s.ClusterCache
	obsCollector    *observability.Collector
	ipLimiter       *auth.RateLimiter
	userLimiter     *auth.RateLimiter
	idleTimeout     time.Duration
	maxLifetime     time.Duration
	auditWriter     *AuditWriter
	oidcProvider    *auth.OIDCProvider
	oidcCfg         *auth.OIDCConfig
	cookieSecure    bool
}

func NewRouter(ctx context.Context, st *store.Store, k8sClient *k8s.Client, policySched *scheduler.PolicyScheduler, cache *k8s.ClusterCache, obsCollector *observability.Collector) *chi.Mux {
	idleTimeout := parseDuration("SESSION_IDLE_TIMEOUT", 8*time.Hour)
	maxLifetime := parseDuration("SESSION_MAX_LIFETIME", 24*time.Hour)

	aw := NewAuditWriter(st, 4096)
	go aw.Start(ctx)

	// Initialize OIDC provider if configured.
	var oidcProv *auth.OIDCProvider
	oidcCfg := auth.OIDCConfigFromEnv()
	if oidcCfg != nil {
		if oidcCfg.SkipTLSVerify {
			slog.Warn("oidc: TLS verification is DISABLED (OIDC_SKIP_TLS_VERIFY=true) — this must not be used in production")
		}
		var err error
		oidcProv, err = auth.NewOIDCProvider(ctx, *oidcCfg)
		if err != nil {
			slog.Error("oidc: provider init failed — OIDC login will be unavailable", "err", err)
		} else {
			slog.Info("oidc: provider initialized", "issuer", oidcCfg.IssuerURL, "clientID", oidcCfg.ClientID)
		}
	}

	h := &Handler{
		store:           st,
		k8s:             k8sClient,
		policyScheduler: policySched,
		cache:           cache,
		obsCollector:    obsCollector,
		ipLimiter:       auth.NewRateLimiter(rateLimitPerIP, rateLimitWindow),
		userLimiter:     auth.NewRateLimiter(rateLimitPerUser, rateLimitWindow),
		idleTimeout:     idleTimeout,
		maxLifetime:     maxLifetime,
		auditWriter:     aw,
		oidcProvider:    oidcProv,
		oidcCfg:         oidcCfg,
		cookieSecure:    os.Getenv("COOKIE_SECURE") != "false",
	}

	r := chi.NewRouter()
	r.Use(chiMiddleware.RequestID)
	r.Use(chiMiddleware.Logger)
	r.Use(chiMiddleware.Recoverer)
	r.Use(prometheusMiddleware)
	r.Use(callRecorderMiddleware(obsCollector.CallRecorder()))
	r.Use(securityHeaders)
	r.Use(corsHandler())
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			req.Body = http.MaxBytesReader(w, req.Body, 1<<20) // 1 MB
			next.ServeHTTP(w, req)
		})
	})

	// Prometheus metrics — no auth, intended for in-cluster scraping
	r.Method(http.MethodGet, "/metrics", promhttp.Handler())

	// Health endpoint — no auth, used by K8s liveness/readiness probes
	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		if err := st.Ping(); err != nil {
			slog.Error("healthz: database ping failed", "err", err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte(`{"status":"error","error":"database unavailable"}`))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	// Version endpoint — no auth, lightweight build/uptime info
	r.Get("/api/version", h.getVersion)

	h.registerAuthRoutes(r)

	// ── Authenticated routes ─────────────────────────────────────────────
	r.Group(func(r chi.Router) {
		r.Use(authmw.SessionAuth(st, idleTimeout))
		r.Use(authmw.CSRFProtect)
		r.Use(h.auditDeniedMiddleware)

		// Auth endpoints (session-scoped)
		r.Post("/api/auth/logout", h.logout)
		r.Get("/api/auth/me", h.me)
		r.Get("/api/auth/sessions", h.listSessions)
		r.Put("/api/auth/password", h.changePassword)
		r.Put("/api/auth/settings", h.updateUserSettings)

		// Swagger UI
		r.Get("/api/docs", func(w http.ResponseWriter, r *http.Request) {
			http.Redirect(w, r, "/api/docs/", http.StatusFound)
		})
		r.Method(http.MethodGet, "/api/docs/openapi.yaml", docs.SpecHandler())
		r.Mount("/api/docs/", swguiv5.NewHandler("kube-phoenix API", "/api/docs/openapi.yaml", "/api/docs/"))

		r.Route("/api", func(r chi.Router) {
			h.registerClusterRoutes(r)
			h.registerPolicyRoutes(r)
			h.registerObservabilityRoutes(r)
			h.registerAdminRoutes(r)
		})

		// WebSocket — live log streaming (cookies sent automatically on upgrade)
		r.Get("/ws/policy-executions/{id}/logs", h.wsPolicyExecutionLogs)
	})

	// Embedded Next.js static export — SPA fallback for all other routes
	r.Mount("/", web.SPAHandler())

	return r
}

// registerAuthRoutes mounts unauthenticated auth and OIDC endpoints.
func (h *Handler) registerAuthRoutes(r chi.Router) {
	r.Post("/api/auth/login", h.login)
	r.Get("/api/auth/oidc/config", h.oidcConfig)
	r.Get("/api/auth/oidc/login", h.oidcLogin)
	r.Get("/api/auth/oidc/callback", h.oidcCallback)
}

// registerClusterRoutes mounts read-only cluster, guardrail, and audit endpoints.
//
// SECURITY: All routes in this function are accessible to any authenticated
// user (viewer, operator, admin). Mutation endpoints (POST/PUT/DELETE) MUST be
// wrapped in a RequirePermission group — never add a mutation at the top level.
func (h *Handler) registerClusterRoutes(r chi.Router) {
	r.Get("/guardrails", h.getGuardrails)
	r.Get("/overview", h.getOverview)
	r.Get("/cluster/stream", h.streamCluster)
	r.Get("/cluster/workloads", h.getWorkloads)
	r.Get("/cluster/info", h.getClusterInfo)
	r.Get("/cluster/nodes", h.getNodes)
	r.Get("/cluster/nodes/{name}/pods", h.getNodePods)
	r.Get("/cluster/pods/{namespace}/{name}", h.getPodDetail)
	r.Get("/cluster/pods/{namespace}/{name}/logs", h.getPodLogs)
	r.Get("/cluster/workloads/{namespace}/{kind}/{name}/pods", h.getWorkloadPods)

	r.Group(func(r chi.Router) {
		r.Use(authmw.RequirePermission(auth.PermAuditView))
		r.Get("/audit-logs", h.listAuditLogs)
	})

	r.Group(func(r chi.Router) {
		r.Use(authmw.RequirePermission(auth.PermGuardrailEdit))
		r.Put("/guardrails", h.updateGuardrails)
	})
}

// registerPolicyRoutes mounts policy read, mutation, and trigger endpoints.
//
// SECURITY: Top-level routes here are accessible to any authenticated user.
// All state-changing endpoints MUST be wrapped in a RequirePermission group.
func (h *Handler) registerPolicyRoutes(r chi.Router) {
	// Read-only (all authenticated users)
	r.Get("/policies", h.listPolicies)
	r.Get("/policies/{id}", h.getPolicy)
	r.Get("/policies/{id}/snapshots", h.getPolicySnapshots)
	r.Get("/policy-executions", h.listPolicyExecutions)
	r.Get("/policy-executions/{id}", h.getPolicyExecution)
	r.Get("/policy-executions/{id}/logs", h.getPolicyExecutionLogs)
	r.Get("/policy-executions/{id}/snapshots", h.getPolicyExecutionSnapshots)
	r.Get("/exceptions", h.listExceptions)
	r.Get("/exceptions/{id}", h.getException)

	// Mutations (admin + operator)
	r.Group(func(r chi.Router) {
		r.Use(authmw.RequirePermission(auth.PermScheduleEdit))
		r.Post("/policies", h.createPolicy)
		r.Put("/policies/{id}", h.updatePolicy)
		r.Delete("/policies/{id}", h.deletePolicy)
		r.Post("/exceptions", h.createException)
		r.Put("/exceptions/{id}", h.updateException)
		r.Delete("/exceptions/{id}", h.deleteException)
	})

	// Manual trigger (admin + operator)
	r.Group(func(r chi.Router) {
		r.Use(authmw.RequirePermission(auth.PermScheduleTrigger))
		r.Post("/policies/{id}/sleep", h.triggerPolicySleep)
		r.Post("/policies/{id}/wake", h.triggerPolicyWake)
		r.Post("/policies/{id}/cancel", h.cancelPolicyExecution)
	})
}

// registerAdminRoutes mounts user management and danger-zone endpoints.
//
// SECURITY: Every route here MUST be wrapped in a RequirePermission group.
func (h *Handler) registerAdminRoutes(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(authmw.RequirePermission(auth.PermUserManage))
		r.Get("/users", h.listUsers)
		r.Post("/users", h.createUser)
		r.Put("/users/{id}", h.updateUser)
		r.Delete("/users/{id}", h.deleteUser)
	})

	r.Group(func(r chi.Router) {
		r.Use(authmw.RequirePermission(auth.PermAdminResetDB))
		r.Post("/danger/reset-db", h.resetDB)
	})

	r.Group(func(r chi.Router) {
		r.Use(authmw.RequirePermission(auth.PermAdminEmergencyScale))
		r.Post("/danger/emergency-scale", h.emergencyScale)
	})
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:")
		next.ServeHTTP(w, r)
	})
}

func corsHandler() func(http.Handler) http.Handler {
	var allowedOrigins []string
	if origin := os.Getenv("CORS_ALLOWED_ORIGIN"); origin != "" {
		allowedOrigins = []string{origin}
	} else if os.Getenv("ADMIN_USER") != "" {
		// Production mode (ADMIN_USER is set) without an explicit CORS origin:
		// default to same-origin only (no origins allowed via CORS).
		slog.Warn("CORS_ALLOWED_ORIGIN is not set while ADMIN_USER is set — CORS will block all cross-origin requests (same-origin only). Set CORS_ALLOWED_ORIGIN if your frontend is served from a different origin.")
		allowedOrigins = []string{}
	} else {
		// Dev mode — allow all origins for convenience.
		allowedOrigins = []string{"*"}
	}
	return cors.Handler(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type", "X-CSRF-Token"},
		AllowCredentials: true,
	})
}

func prometheusMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := chiMiddleware.NewWrapResponseWriter(w, r.ProtoMajor)

		next.ServeHTTP(ww, r)

		routePattern := chi.RouteContext(r.Context()).RoutePattern()
		if routePattern == "" {
			routePattern = "unmatched"
		}

		if observability.IsSkippedMetricsRoute(routePattern) {
			return
		}

		status := strconv.Itoa(ww.Status())
		duration := time.Since(start).Seconds()

		metrics.HTTPRequestsTotal.WithLabelValues(r.Method, routePattern, status).Inc()
		metrics.HTTPRequestDuration.WithLabelValues(r.Method, routePattern).Observe(duration)
	})
}

func callRecorderMiddleware(recorder *observability.CallRecorder) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			ww := chiMiddleware.NewWrapResponseWriter(w, r.ProtoMajor)

			next.ServeHTTP(ww, r)

			routePattern := chi.RouteContext(r.Context()).RoutePattern()
			if routePattern == "" || observability.IsSkippedRecorderRoute(routePattern) {
				return
			}
			durationMs := float64(time.Since(start).Nanoseconds()) / 1e6
			recorder.Record(r.Method, routePattern, ww.Status(), durationMs)
		})
	}
}

func parseDuration(envKey string, fallback time.Duration) time.Duration {
	v := os.Getenv(envKey)
	if v == "" {
		return fallback
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		slog.Warn("invalid duration env var, using default", "key", envKey, "value", v, "default", fallback)
		return fallback
	}
	return d
}
