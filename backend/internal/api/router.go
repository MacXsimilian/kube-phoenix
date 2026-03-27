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
	authmw "github.com/macxsimilian/kube-phoenix/backend/internal/middleware"
	"github.com/macxsimilian/kube-phoenix/backend/internal/scheduler"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	"github.com/macxsimilian/kube-phoenix/backend/web"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	swguiv5 "github.com/swaggest/swgui/v5"
)

// Rate limit settings for login endpoints.
const (
	rateLimitPerIP       = 10
	rateLimitPerUser     = 5
	rateLimitWindow      = 15 * time.Minute
)

type Handler struct {
	store           *store.Store
	k8s             *k8s.Client
	policyScheduler *scheduler.PolicyScheduler
	cache           *k8s.ClusterCache
	ipLimiter       *auth.RateLimiter
	userLimiter     *auth.RateLimiter
	idleTimeout     time.Duration
	maxLifetime     time.Duration
	auditWriter     *AuditWriter
	oidcProvider    *auth.OIDCProvider
	oidcCfg         *auth.OIDCConfig
}

func NewRouter(ctx context.Context, st *store.Store, k8sClient *k8s.Client, policySched *scheduler.PolicyScheduler, cache *k8s.ClusterCache) *chi.Mux {
	idleTimeout := parseDuration("SESSION_IDLE_TIMEOUT", 8*time.Hour)
	maxLifetime := parseDuration("SESSION_MAX_LIFETIME", 24*time.Hour)

	aw := NewAuditWriter(st, 1024)
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
		ipLimiter:       auth.NewRateLimiter(rateLimitPerIP, rateLimitWindow),
		userLimiter:     auth.NewRateLimiter(rateLimitPerUser, rateLimitWindow),
		idleTimeout:     idleTimeout,
		maxLifetime:     maxLifetime,
		auditWriter:     aw,
		oidcProvider:    oidcProv,
		oidcCfg:         oidcCfg,
	}

	r := chi.NewRouter()
	r.Use(chiMiddleware.RequestID)
	r.Use(chiMiddleware.Logger)
	r.Use(chiMiddleware.Recoverer)
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

	// ── Unauthenticated auth routes ──────────────────────────────────────
	r.Post("/api/auth/login", h.login)
	r.Get("/api/auth/oidc/config", h.oidcConfig)
	r.Get("/api/auth/oidc/login", h.oidcLogin)
	r.Get("/api/auth/oidc/callback", h.oidcCallback)

	// ── Authenticated routes ─────────────────────────────────────────────
	r.Group(func(r chi.Router) {
		r.Use(authmw.SessionAuth(st, idleTimeout))
		r.Use(authmw.CSRFProtect)

		// Auth endpoints
		r.Post("/api/auth/logout", h.logout)
		r.Get("/api/auth/me", h.me)
		r.Put("/api/auth/password", h.changePassword)

		// Swagger UI
		r.Get("/api/docs", func(w http.ResponseWriter, r *http.Request) {
			http.Redirect(w, r, "/api/docs/", http.StatusFound)
		})
		r.Method(http.MethodGet, "/api/docs/openapi.yaml", docs.SpecHandler())
		r.Mount("/api/docs/", swguiv5.NewHandler("kube-phoenix API", "/api/docs/openapi.yaml", "/api/docs/"))

		r.Route("/api", func(r chi.Router) {
			// ── Read-only routes (all authenticated users) ───────────
			r.Get("/guardrails", h.getGuardrails)
			r.Get("/overview", h.getOverview)
			r.Get("/cluster/stream", h.streamCluster)
			r.Get("/cluster/workloads", h.getWorkloads)
			r.Get("/cluster/nodes", h.getNodes)
			r.Get("/cluster/nodes/{name}/pods", h.getNodePods)
			r.Get("/cluster/pods/{namespace}/{name}", h.getPodDetail)
			r.Get("/cluster/pods/{namespace}/{name}/logs", h.getPodLogs)
			r.Get("/cluster/workloads/{namespace}/{kind}/{name}/pods", h.getWorkloadPods)

			// ── Audit logs ───────────────────────────────────────────
			r.Group(func(r chi.Router) {
				r.Use(authmw.RequirePermission(auth.PermAuditView))
				r.Get("/audit-logs", h.listAuditLogs)
			})

			// ── Policy read routes (all authenticated users) ──────────
			r.Get("/policies", h.listPolicies)
			r.Get("/policies/{id}", h.getPolicy)
			r.Get("/policies/{id}/snapshots", h.getPolicySnapshots)
			r.Get("/policies/{id}/overrides", h.listPolicyOverrides)
			r.Get("/policy-executions", h.listPolicyExecutions)
			r.Get("/policy-executions/{id}", h.getPolicyExecution)
			r.Get("/policy-executions/{id}/logs", h.getPolicyExecutionLogs)
			r.Get("/policy-executions/{id}/snapshots", h.getPolicyExecutionSnapshots)
			r.Get("/exceptions", h.listExceptions)
			r.Get("/exceptions/{id}", h.getException)

			r.Group(func(r chi.Router) {
				r.Use(authmw.RequirePermission(auth.PermGuardrailEdit))
				r.Put("/guardrails", h.updateGuardrails)
			})

			// ── Policy mutations (admin + operator) ───────────────────
			r.Group(func(r chi.Router) {
				r.Use(authmw.RequirePermission(auth.PermScheduleEdit))
				r.Post("/policies", h.createPolicy)
				r.Put("/policies/{id}", h.updatePolicy)
				r.Delete("/policies/{id}", h.deletePolicy)
				r.Post("/policies/{id}/overrides", h.createPolicyOverride)
				r.Delete("/policies/{id}/overrides/{overrideId}", h.deletePolicyOverride)
				r.Post("/exceptions", h.createException)
				r.Put("/exceptions/{id}", h.updateException)
				r.Delete("/exceptions/{id}", h.deleteException)
			})

			// ── Manual trigger (admin + operator) ────────────────────
			r.Group(func(r chi.Router) {
				r.Use(authmw.RequirePermission(auth.PermScheduleTrigger))
				r.Post("/policies/{id}/sleep", h.triggerPolicySleep)
				r.Post("/policies/{id}/wake", h.triggerPolicyWake)
			})

			// ── User management (admin only) ─────────────────────────
			r.Group(func(r chi.Router) {
				r.Use(authmw.RequirePermission(auth.PermUserManage))
				r.Get("/users", h.listUsers)
				r.Post("/users", h.createUser)
				r.Put("/users/{id}", h.updateUser)
				r.Delete("/users/{id}", h.deleteUser)
			})

			// ── Admin danger zone ────────────────────────────────────
			r.Group(func(r chi.Router) {
				r.Use(authmw.RequirePermission(auth.PermAdminResetDB))
				r.Post("/danger/reset-db", h.resetDB)
			})
		})

		// WebSocket — live log streaming (cookies sent automatically on upgrade)
		r.Get("/ws/policy-executions/{id}/logs", h.wsPolicyExecutionLogs)
	})

	// Embedded Next.js static export — SPA fallback for all other routes
	r.Mount("/", web.SPAHandler())

	return r
}

// ─── Audit log endpoint (thin handler, store does the work) ──────────────────

func (h *Handler) listAuditLogs(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	filter := store.AuditLogFilter{
		Username: query.Get("user"),
		Action:   query.Get("action"),
	}
	if v := query.Get("page"); v != "" {
		p, err := strconv.Atoi(v)
		if err != nil {
			jsonError(w, "invalid page parameter", http.StatusBadRequest)
			return
		}
		filter.Page = p
	}
	filter.PageSize = parsePageSize(query, 50, 1000)
	if v := query.Get("from"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			jsonError(w, "invalid 'from' timestamp — expected RFC3339 format", http.StatusBadRequest)
			return
		}
		filter.From = &t
	}
	if v := query.Get("to"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			jsonError(w, "invalid 'to' timestamp — expected RFC3339 format", http.StatusBadRequest)
			return
		}
		filter.To = &t
	}

	page, err := h.store.ListAuditLogs(filter)
	if err != nil {
		jsonInternalError(w, err, "list audit logs failed")
		return
	}
	jsonOK(w, page)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
