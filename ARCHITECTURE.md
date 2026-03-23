# kube-phoenix — Complete Architecture & Logic Reference

> **Audience:** Engineers who need to understand, extend, debug, or rebuild this system from scratch.
> This document is exhaustive. Every subsystem, data flow, API route, component, and design decision
> is explained in depth. Nothing is abbreviated or left as an exercise for the reader.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [High-Level Architecture Diagram](#2-high-level-architecture-diagram)
3. [Repository Layout](#3-repository-layout)
4. [Backend Deep Dive](#4-backend-deep-dive)
   - 4.1 [Entry Point — cmd/server/main.go](#41-entry-point--cmdservermainmaingo)
   - 4.2 [HTTP Router & Middleware Stack](#42-http-router--middleware-stack)
   - 4.3 [API Handlers](#43-api-handlers)
   - 4.4 [PolicyScheduler & Broker](#44-policyscheduler--broker)
   - 4.5 [Scaler](#45-scaler)
   - 4.6 [Kubernetes Client Wrapper](#46-kubernetes-client-wrapper)
   - 4.7 [Store / Database Layer](#47-store--database-layer)
   - 4.8 [WebSocket Log Broker](#48-websocket-log-broker)
   - 4.9 [SPA File Server](#49-spa-file-server)
   - 4.10 [Backend Class Diagram](#410-backend-class-diagram)
5. [Frontend Deep Dive](#5-frontend-deep-dive)
   - 5.1 [Next.js Configuration & Build Pipeline](#51-nextjs-configuration--build-pipeline)
   - 5.2 [Theme & Design System](#52-theme--design-system)
   - 5.3 [Auth System](#53-auth-system)
   - 5.4 [API Client Layer](#54-api-client-layer)
   - 5.5 [Page & Component Tree](#55-page--component-tree)
   - 5.6 [TanStack Query Strategy](#56-tanstack-query-strategy)
   - 5.7 [WebSocket Integration in the Frontend](#57-websocket-integration-in-the-frontend)
6. [Data Models & ER Diagram](#6-data-models--er-diagram)
7. [WebSocket Architecture](#7-websocket-architecture)
8. [Authentication & Authorization Architecture](#8-authentication--authorization-architecture)
9. [Scale-Down / Scale-Up Flows](#9-scale-down--scale-up-flows)
10. [Helm Chart & Kubernetes Deployment](#10-helm-chart--kubernetes-deployment)
11. [CI/CD Pipeline](#11-cicd-pipeline)
12. [Local Development Guide](#12-local-development-guide)
13. [Key Design Decisions](#13-key-design-decisions)
14. [Observability](#14-observability)

---

## 1. Project Overview

kube-phoenix is a web application that manages Kubernetes cluster **sleep/wake policies**. Its purpose is to reduce cloud spend during off-hours by scaling workloads to zero replicas and draining nodes (which then get removed), then restoring them on schedule. It replaces a legacy `cronjob.yaml` bash script with a properly observable, configurable system.

### Core capabilities

| Capability               | Description                                                               |
| :----------------------- | :------------------------------------------------------------------------ |
| Policy management        | CRUD for named sleep/wake policies with sleep windows                     |
| Guardrails               | Configurable exclusion lists for namespaces, node labels, and node taints |
| Dry-run (plan) mode      | Every scale operation can be simulated before applying                    |
| Live log streaming       | WebSocket-based log fan-out during an active execution                    |
| Cluster state visibility | Real-time view of workloads and nodes with health metrics                 |
| Pod log streaming        | Live container log viewer streamed directly from the K8s API (no DB)      |
| History                  | Paginated execution history with per-execution log viewer                 |
| User management          | Multi-user RBAC with three roles (admin, operator, viewer); bcrypt passwords |
| Session-based auth       | HTTP-only cookie sessions with CSRF double-submit protection              |
| Keycloak OIDC            | Authorization Code + PKCE flow, AD group-to-role mapping, account linking |
| Audit logging            | Async audit trail with before/after diffs and configurable retention      |
| Login rate limiting      | Per-IP (10/15 min) and per-username (5/15 min) throttling                 |
| Self-hosted              | Single binary embeds the full Next.js SPA; no separate web server needed  |
| API documentation        | Swagger UI served at `/api/docs/`; raw OpenAPI 3.1 spec at `/api/docs/openapi.yaml` |

### Technology stack

| Layer                   | Technology                                               |
| :---------------------- | :------------------------------------------------------- |
| Backend language        | Go 1.26                                                  |
| HTTP router             | go-chi/chi v5.2                                          |
| Database                | PostgreSQL via GORM v1.31 (gorm.io/driver/postgres v1.6) |
| Policy scheduler        | 30-second ticker with window evaluator                   |
| WebSocket               | gorilla/websocket                                        |
| Kubernetes SDK          | k8s.io/client-go                                         |
| Frontend framework      | Next.js 16 (static export)                               |
| UI component library    | Material UI v7                                           |
| Server state management | TanStack Query v5                                        |
| Containerization        | Docker multi-stage → distroless                          |
| Deployment              | Helm 4 chart                                             |
| CI/CD                   | GitHub Actions                                           |

---

## 2. High-Level Architecture Diagram

```mermaid
flowchart TB
    Browser["External Browser"]
    ALB["Ingress / ALB"]

    subgraph Cluster["Kubernetes Cluster"]
        subgraph NS["kube-phoenix namespace"]
            subgraph Pod["kube-phoenix Pod (single container)"]
                subgraph Binary["Go Binary — :8080"]
                    Router["Chi Router<br/>+ Session Auth middleware"]
                    Handlers["API Handlers<br/>/api/*  /ws/*"]
                    PolicyScheduler["PolicyScheduler<br/>(policies + exceptions)"]
                    PolicyEngine["PolicyEngine<br/>(IntendedState evaluation)"]
                    PolicyScaler["PolicyScaler<br/>(DB-backed snapshots)"]
                    Broker["Broker<br/>(WebSocket pub/sub)"]
                    Store["Store<br/>(GORM)"]
                    SPA["SPA Static<br/>(//go:embed)"]
                    K8sClient["k8s Client<br/>(client-go)"]
                end
            end
            PG[("PostgreSQL DB<br/>same namespace<br/>or external RDS")]
        end
        subgraph Workloads["Workload Namespaces"]
            K8sAPI["Kubernetes API Server<br/>(ClusterRole grants)<br/>Deployments · StatefulSets · Pods · Nodes"]
        end
    end

    Browser -- "HTTPS" --> ALB
    ALB -- "HTTP :80" --> Router
    Router --> Handlers
    Router --> SPA
    Handlers --> PolicyScheduler
    Handlers --> Store
    PolicyScheduler --> PolicyEngine
    PolicyScheduler --> PolicyScaler
    PolicyScheduler --> Broker
    PolicyScaler --> K8sClient
    K8sClient --> K8sAPI
    Store --> PG
```

### Request flow summary

1. Browser loads the Next.js SPA from `GET /` (served by the Go binary from its embedded filesystem).
2. SPA calls `GET /api/*` endpoints (JSON over HTTP) for data.
3. For live log streaming, SPA opens `ws[s]://host/ws/policy-executions/:id/logs`.
4. The Go binary calls the Kubernetes API Server directly using the pod's ServiceAccount token (in-cluster config).
5. The PolicyScheduler evaluates sleep windows on a 30-second tick cycle and triggers executions when the intended state differs from actual; results are persisted to PostgreSQL and streamed to subscribers.

---

## 3. Repository Layout

```
kube-phoenix/
│
├── Dockerfile                    # 3-stage build (node → golang → distroless)
├── Makefile                      # Developer workflow targets
├── openapi.yaml                  # OpenAPI 3.1 spec (canonical source)
├── ARCHITECTURE.md               # This document
│
├── backend/
│   ├── cmd/
│   │   └── server/
│   │       └── main.go           # Binary entry point
│   │
│   ├── internal/
│   │   ├── api/
│   │   │   ├── router.go         # Chi router construction + middleware
│   │   │   ├── cluster.go        # Cluster state (workloads, nodes, pods)
│   │   │   ├── guardrails.go     # Guardrails get/update
│   │   │   ├── admin.go          # DB reset (streamed NDJSON)
│   │   │   ├── auth.go           # Login, logout, me, password change, OIDC callbacks
│   │   │   ├── users.go          # User CRUD (admin only)
│   │   │   ├── audit.go          # Audit log listing
│   │   │   ├── policies.go       # Policy CRUD + sleep/wake triggers + overrides/snapshots
│   │   │   ├── policy_executions.go  # Policy execution list/get/logs/snapshots + WebSocket
│   │   │   ├── overrides.go      # Policy override create/delete
│   │   │   ├── exceptions.go     # Scheduled exception CRUD
│   │   │   ├── ws.go             # Extracted WebSocket helpers
│   │   │   └── helpers.go        # jsonOK, jsonError, parseID, splitCSVLocal
│   │   │
│   │   ├── scheduler/
│   │   │   ├── broker.go             # Extracted Broker type (pub/sub for WebSocket log fan-out)
│   │   │   ├── policy_scheduler.go   # PolicyScheduler: 30s ticker, recovery, exception tick
│   │   │   ├── policy_engine.go      # Pure evaluation: IntendedState, override precedence
│   │   │   └── policy_scaler.go      # DB-backed sleep/wake with WorkloadSnapshot persistence
│   │   │
│   │   ├── policy/
│   │   │   └── windows.go        # SleepWindow type, validation, and evaluator
│   │   │
│   │   ├── k8s/
│   │   │   ├── client.go         # Typed k8s API wrapper
│   │   │   └── cache.go          # ClusterCache — 10s background refresh
│   │   │
│   │   ├── docs/
│   │   │   ├── docs.go           # Embedded OpenAPI spec + Swagger UI handler
│   │   │   └── openapi.yaml      # Copy of root openapi.yaml (synced at build)
│   │   │
│   │   ├── metrics/
│   │   │   └── metrics.go        # Prometheus metrics registration
│   │   │
│   │   ├── store/
│   │   │   ├── models.go         # GORM model structs
│   │   │   ├── store.go          # DB connection + AutoMigrate
│   │   │   └── queries.go        # All DB queries + SeedDefaults
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.go           # Session-based auth middleware + CSRF protection
│   │   │   └── ratelimit.go      # Login rate limiting (per-IP, per-username)
│   │   │
│   │   └── audit/
│   │       └── writer.go         # Async audit log writer with before/after diffs
│   │
│   ├── web/
│   │   ├── embed.go              # //go:embed all:static + SPAHandler
│   │   └── static/               # Next.js out/ copied here at build time
│   │
│   └── go.mod                    # Module: github.com/macxsimilian/kube-phoenix/backend
│
├── frontend/
│   ├── next.config.mjs           # output:'export', trailingSlash:true
│   ├── package.json              # next@16, @mui/material@7, @tanstack/react-query@5
│   │
│   └── src/
│       ├── app/
│       │   ├── layout.tsx         # Inter font, <Providers> wrapper
│       │   ├── page.tsx           # Redirect → /overview/
│       │   ├── providers.tsx      # QueryClient → ThemeModeProvider → Theme → Auth → AppShell
│       │   ├── overview/page.tsx
│       │   ├── cluster/page.tsx
│       │   ├── guardrails/page.tsx
│       │   ├── history/page.tsx
│       │   ├── policies/
│       │   │   ├── page.tsx       # Policy list: cards, create/edit/delete, sleep/wake now
│       │   │   └── [id]/page.tsx  # Policy detail: overrides, exceptions, execution history
│       │   ├── exceptions/page.tsx # Scheduled exceptions list with status tabs
│       │   ├── users/page.tsx
│       │   ├── audit/page.tsx
│       │   └── settings/page.tsx
│       │
│       ├── components/
│       │   ├── layout/
│       │   │   ├── AppShell.tsx   # Main layout: Sidebar + main content area
│       │   │   ├── Sidebar.tsx    # Navigation drawer (desktop permanent, mobile temporary)
│       │   │   └── AboutModal.tsx # Version info modal
│       │   ├── overview/
│       │   │   ├── ClusterStatusCard.tsx
│       │   │   ├── NextRunCard.tsx
│       │   │   └── ActivityFeed.tsx
│       │   ├── cluster/
│       │   │   ├── WorkloadsTable.tsx
│       │   │   ├── NodesTable.tsx
│       │   │   ├── NodeDetailDrawer.tsx
│       │   │   ├── WorkloadDetailDrawer.tsx
│       │   │   ├── PodDetailDrawer.tsx
│       │   │   └── PodDetailContent.tsx
│       │   ├── history/
│       │   │   ├── ExecutionTable.tsx
│       │   │   └── LogViewer.tsx
│       │   ├── guardrails/
│       │   │   └── GuardrailsForm.tsx
│       │   ├── policies/
│       │   │   ├── PolicyCard.tsx       # State badge, sleep/wake buttons, edit/delete
│       │   │   ├── CreatePolicyDialog.tsx  # Create/edit form with WindowPicker and dashboard mini-card preview
│       │   │   ├── WindowPicker.tsx     # Day/time picker for SleepWindow objects
│       │   │   ├── MiniTimeline.tsx     # 24h SVG bar showing sleep/wake periods
│       │   │   ├── WeeklyTimeline.tsx   # 7-day SVG timeline visualisation
│       │   │   └── ExceptionDialog.tsx  # Create/edit scheduled exception
│       │   ├── users/
│       │   │   └── UsersTable.tsx
│       │   ├── audit/
│       │   │   └── AuditLogTable.tsx
│       │   └── auth/
│       │       └── LoginScreen.tsx
│       │
│       ├── lib/
│       │   ├── api.ts             # All HTTP + WebSocket API calls
│       │   ├── auth.tsx           # AuthProvider, useAuth hook
│       │   ├── types.ts           # TypeScript interfaces
│       │   ├── queryClient.ts     # TanStack QueryClient singleton
│       │   ├── cronToText.ts      # Legacy cron-to-text helper (retained for historical display)
│       │   ├── windowUtils.ts    # SleepWindow formatting helpers
│       │   ├── themeMode.tsx      # ThemeModeProvider + useThemeMode (light/dark/system)
│       │   ├── colors.ts          # useColors() hook — mode-aware semantic color palette
│       │   ├── constants.ts       # Shared constants
│       │   ├── formatters.ts      # Display formatting utilities
│       │   └── useDrawerResize.ts # Responsive drawer width hook
│       │
│       └── theme/
│           └── theme.ts           # MUI theme — dark (default) + light mode, createAppTheme(mode)
│
├── helm/
│   └── kube-phoenix/
│       ├── Chart.yaml             # Helm chart version and appVersion (managed by release-please)
│       ├── values.yaml            # All configurable defaults
│       └── templates/
│           ├── _helpers.tpl       # Named template helpers
│           ├── deployment.yaml    # Main workload + initContainer
│           ├── clusterrole.yaml   # RBAC permissions
│           ├── clusterrolebinding.yaml
│           ├── serviceaccount.yaml
│           ├── secret.yaml        # DATABASE_URL, auth credentials
│           ├── service.yaml       # ClusterIP :80 → :8080
│           ├── ingress.yaml       # Optional ingress
│           ├── targetgroupbinding.yaml  # Optional AWS ALB TGB
│           ├── postgresql.yaml    # Optional in-cluster PG StatefulSet
│           ├── networkpolicy.yaml # Optional pod-level firewall
│           ├── pdb.yaml           # Optional PodDisruptionBudget
│           ├── servicemonitor.yaml # Optional Prometheus ServiceMonitor
│           └── NOTES.txt          # Post-install instructions
│
└── .github/
    ├── workflows/
    │   ├── ci.yml                 # PR/push CI: build, test, lint, docker
    │   ├── security.yml           # Trivy, govulncheck, npm audit, TruffleHog
    │   └── release-please.yml    # Automated release + helm OCI push
    └── dependabot.yml             # Weekly dependency updates
```

---

## 4. Backend Deep Dive

The backend is a single Go binary that serves three roles simultaneously:
- **HTTP API server** for the frontend SPA
- **Policy scheduler** that evaluates sleep windows on a 30-second tick and fires sleep/wake operations when state diverges
- **Static file server** for the embedded Next.js SPA

### 4.1 Entry Point — cmd/server/main.go

`main.go` is the binary's bootstrap sequence. It is intentionally simple, delegating all complexity to the packages it instantiates.

```
main()
  │
  ├─ Read DATABASE_URL from env  ──► log.Fatal if empty
  │
  ├─ store.New(DATABASE_URL)     ──► Opens PostgreSQL, runs AutoMigrate, seeds defaults
  │   └─ Seeds admin user from ADMIN_USER / ADMIN_PASSWORD if no users exist
  │
  ├─ audit.NewWriter(store)      ──► Starts async audit log writer goroutine
  │   └─ Starts daily retention cleanup (AUDIT_RETENTION_DAYS)
  │
  ├─ k8s.New()                   ──► Tries InClusterConfig → kubeconfig fallback
  │   └─ if error: slog.Warn, k8s = nil (k8s operations disabled but server runs)
  │
  ├─ store.MarkInterruptedPolicyExecutions()  ──► sets status=interrupted for any running→interrupted rows
  │
  ├─ scheduler.NewPolicyScheduler(store, k8s)
  │   └─ if k8s != nil: policySched.Start(ctx)
  │   └─ if k8s != nil: policySched.RecoverPolicies(ctx)  ──► computes IntendedState(now) for each policy
  │   └─ if k8s != nil: go runTicker(ctx, 1m, "exception-tick", policySched.TickExceptions)
  │
  ├─ api.NewRouter(ctx, store, k8s, policySched, cache)  ──► Returns http.Handler (Chi mux)
  │
  └─ http.Server{Addr: ":8080", WriteTimeout: 0}
      └─ WriteTimeout=0 is critical: allows WebSocket and SSE to stream indefinitely
      └─ ReadTimeout: 15s, IdleTimeout: 60s
      └─ Graceful shutdown: signal.Notify(SIGINT, SIGTERM) with buffered channel, 30s timeout
```

**Why WriteTimeout is zero:** Go's `http.Server` enforces `WriteTimeout` across the entire response, including streaming. Setting it to 0 disables it, which is required for WebSocket connections and the NDJSON danger/reset-db stream. Without this setting, long-running executions (which can take hours) would have their WebSocket connections forcefully closed mid-stream.

**Why k8s = nil is allowed:** The server starts and serves the frontend even if no Kubernetes cluster is reachable. This allows the UI to be accessible for read-only operations (checking history, viewing policies) even during a cluster incident. Any endpoint that requires the k8s client returns a 503 with a clear error message.

**Structured logging:** The binary uses Go's `log/slog` with the default JSON handler. All log lines include `time`, `level`, `msg`, and context-specific key-value pairs. This is intentional — structured logs integrate directly with log aggregation systems (Loki, CloudWatch, Datadog) without additional parsing.

**Graceful shutdown sequence:**
1. OS sends SIGINT or SIGTERM.
2. `signal.Notify` delivers the signal to a buffered channel; `main` unblocks.
3. `server.Shutdown(ctx)` is called with a 30-second deadline.
4. In-flight HTTP requests are allowed to complete.
5. The PolicyScheduler's `Stop()` method cancels the evaluation ticker (ongoing scale operations run to completion in their goroutines — they are not force-killed).
6. The database connection pool is closed.

### 4.2 HTTP Router & Middleware Stack

The router is built with `go-chi/chi/v5`. Chi was chosen over `net/http` ServeMux because it provides:
- URL parameter extraction (`chi.URLParam`)
- Grouped routes with per-group middleware
- Composable middleware via `r.Use()`

**Middleware stack (applied in order):**

```
Every request passes through:
  1. middleware.RequestID        — generates/propagates X-Request-ID header
  2. middleware.Logger           — structured request log (method, path, status, latency)
  3. middleware.Recoverer        — catches panics, returns 500, logs stack trace
  4. cors.Handler                — sets CORS headers (see below)
  5. middleware.MaxBytesReader(1MB) — protects against large body attacks

Authenticated routes additionally pass through:
  6. authmw.SessionAuth          — validates session cookie, injects user into context
  7. authmw.CSRFProtect          — validates CSRF double-submit cookie on mutating requests
  8. authmw.RequireRole(roles)   — per-route RBAC enforcement (admin/operator/viewer)
```

**CORS policy:**

```go
// In dev (ADMIN_USER not set):
AllowedOrigins: []string{"*"}

// In production (ADMIN_USER set):
// If CORS_ALLOWED_ORIGIN is set, restrict to that origin.
// Otherwise, deny all cross-origin requests (same-origin only).
AllowedOrigins: []string{origin}  // or []string{} if CORS_ALLOWED_ORIGIN is unset
```

The wildcard in dev allows the Next.js dev server (typically `localhost:3000`) to call the backend without CORS errors. In production, cross-origin requests are restricted to the value of the `CORS_ALLOWED_ORIGIN` environment variable. If that variable is unset, no cross-origin requests are permitted — the application is same-origin only. `AllowCredentials` is always `true` so the session cookie is sent on cross-origin requests during development.

**Route groups:**

```
GET  /healthz                           ← unauthenticated, liveness probe
GET  /metrics                           ← unauthenticated, Prometheus scraping

Group: /api/auth  (public — no session required)
  ├─ POST /api/auth/login               ← username/password login (rate limited)
  ├─ POST /api/auth/logout              ← destroy session
  ├─ GET  /api/auth/me                  ← current user info (session required)
  ├─ PUT  /api/auth/password            ← change own password (session required)
  ├─ GET  /api/auth/oidc/login          ← initiate Keycloak OIDC flow
  └─ GET  /api/auth/oidc/callback       ← OIDC redirect callback

Group: /  (with SessionAuth + CSRF middleware)
  ├─ GET  /api/docs            → 302 redirect to /api/docs/
  ├─ GET  /api/docs/openapi.yaml → embedded OpenAPI 3.1 spec (application/yaml)
  ├─ /*   /api/docs/           → Swagger UI (swaggest/swgui v5, embedded assets)
  ├─ /api/guardrails          GET, PUT
  ├─ /api/cluster/workloads   GET
  ├─ /api/cluster/nodes       GET
  ├─ /api/cluster/nodes/{name}/pods GET
  ├─ /api/cluster/pods/{namespace}/{name}   GET
  ├─ /api/cluster/workloads/{ns}/{kind}/{name}/pods GET
  ├─ /api/overview            GET  ← pre-aggregated dashboard summary (cache-backed)
  ├─ /api/cluster/stream      GET  ← SSE stream of overview updates (10 s cadence)
  ├─ /api/danger/reset-db      POST (admin only)
  ├─ /api/users               GET, POST (admin only)
  ├─ /api/users/{id}          PUT, DELETE (admin only)
  ├─ /api/audit-logs          GET (all roles)
  ├─ /api/policies            GET, POST
  ├─ /api/policies/{id}       GET, PUT, DELETE
  ├─ /api/policies/{id}/sleep POST (operator+)
  ├─ /api/policies/{id}/wake  POST (operator+)
  ├─ /api/policies/{id}/snapshots     GET
  ├─ /api/policies/{id}/overrides     GET, POST (operator+)
  ├─ /api/policies/{id}/overrides/{oid} DELETE (operator+)
  ├─ /api/policy-executions           GET
  ├─ /api/policy-executions/{id}      GET
  ├─ /api/policy-executions/{id}/logs GET
  ├─ /api/policy-executions/{id}/snapshots GET
  ├─ /api/exceptions          GET, POST (operator+)
  ├─ /api/exceptions/{id}     GET, PUT (operator+), DELETE (operator+)
  └─ /ws/policy-executions/{id}/logs GET (WebSocket upgrade, session cookie auth)

SPA: everything else → web.SPAHandler (serves index.html for unknown paths)
```

**Why /healthz and /metrics are unauthenticated:**

The `/healthz` endpoint must be reachable by the Kubernetes liveness probe. Kubernetes probes do not send cookies, so if session auth wrapped the health check, the pod would repeatedly fail its liveness probe and be restarted. `/metrics` must be reachable by in-cluster Prometheus scrapers.

**Role-based access control on routes:**

| Route group | Allowed roles | Notes |
|---|---|---|
| `/api/auth/*` | Public | Login, logout, OIDC |
| `/api/users/*` | admin | User management |
| `/api/admin/*` | admin | DB reset |
| `/api/guardrails` (PUT) | admin, operator | Guardrails mutations |
| `/api/policies` (POST/PUT/DELETE), `/api/policies/{id}/overrides` (POST/DELETE), `/api/exceptions` (POST/PUT/DELETE) | admin, operator | Policy mutations |
| `/api/policies/{id}/sleep`, `/api/policies/{id}/wake` | admin, operator | Policy triggers |
| All other `/api/*` | admin, operator, viewer | Read-only access |

### 4.3 API Handlers

#### Cluster (`internal/api/cluster.go`)

**`getWorkloads` (GET /api/cluster/workloads)**

Cache-first: if the `ClusterCache` snapshot is ready, this handler reads Deployments and StatefulSets directly from memory with zero K8s API calls. Falls back to two parallel K8s list calls (`ListDeployments` + `ListStatefulSets` via goroutines) when the cache has not yet populated on startup.

Algorithm:
1. Check `ClusterCache.Snapshot().Ready()` — if true, use in-memory data.
2. For each deployment/statefulset, read the `previous-replicas` annotation.
3. Compute `status`:
   - If annotation present AND `replicas == 0` → `"sleeping"`
   - If annotation present AND `replicas > 0` → `"partial"` (waking up or scale error)
   - If annotation absent → `"running"`
4. Return combined list.

**`getNodes` (GET /api/cluster/nodes)**

Cache-first: if the `ClusterCache` snapshot is ready, nodes and pods are read from memory. Falls back to two **parallel** K8s list calls (previously serial) when the cache is cold.

Algorithm:
1. Check `ClusterCache.Snapshot().Ready()` — if true, use in-memory nodes + pods.
2. Load guardrails from the store (fast DB read).
3. For each node:
   - Count non-DaemonSet pods (pods whose ownerReference is not a DaemonSet).
   - Sum `requests.cpu` and `requests.memory` for all pods on the node.
   - Determine protection reasons by calling `nodeProtectionStatus(guardrails, node, criticalNodes)`.
4. Return augmented node list with `podCount`, `cpuRequested`, `memRequested`, `protected`, `protectionReason`.

**`getOverview` (GET /api/overview)**

Returns a pre-aggregated dashboard summary in one round-trip. Reads entirely from the `ClusterCache` snapshot and the in-memory PolicyScheduler — no K8s or DB I/O on the hot path.

Response shape:
```json
{
  "clusterStatus": "awake" | "sleeping" | "partial",
  "runningCount": 42,
  "sleepingCount": 0,
  "nodeCount": 7,
  "sleepingByNs": [{ "namespace": "payments", "count": 3 }],
  "nextRun": { "name": "Production Sleep", "nextRun": "2026-03-22T19:05:00Z" },
  "cacheAgeMs": 3241
}
```

**`streamCluster` (GET /api/cluster/stream)**

Server-Sent Events endpoint. On connect, sends the current overview immediately. Then subscribes to `ClusterCache` refresh notifications and pushes a new `data:` event on every cache refresh (~10 s). The frontend uses this to update the Overview card in real time without polling.

Authentication: standard session cookie auth (sent automatically by the browser on the fetch request).

**`getNodePods` (GET /api/cluster/nodes/{name}/pods)**

Lists pods on a specific node. For each pod, resolves the owner chain: if a pod is owned by a ReplicaSet, it walks up to find the owning Deployment. This provides a human-readable "workload name" in the node detail drawer. Also calls `GetAllPodMetrics` to populate live CPU/memory usage per pod; degrades gracefully (shows `—`) if the Metrics Server is unavailable or returns a non-200 response.

**`getWorkloadPods` (GET /api/cluster/workloads/{ns}/{kind}/{name}/pods)**

Lists pods belonging to a Deployment or StatefulSet. Same owner-chain resolution and `GetAllPodMetrics` enrichment as `getNodePods`.

**`getPodDetail` (GET /api/cluster/pods/{namespace}/{name})**

Returns comprehensive pod information:
- All containers (name, image, restartCount, ready state)
- All conditions (Ready, PodScheduled, etc.)
- Recent events (via `GetPodEvents`)
- Live CPU/memory usage from the Metrics Server API

The Metrics Server call (`GetPodMetrics`) can fail gracefully — if the Metrics Server is not installed, the metrics fields return null rather than causing a 500 error.

**`nodeProtectionStatus` (internal function)**

Checks three protection conditions in priority order:
1. **Label match:** If the node has any label that appears in `SkipNodeLabels` (key=value format), the node is protected.
2. **Taint match:** If the node has any taint matching an entry in `SkipNodeTaints` (key=value:effect format), the node is protected.
3. **Critical namespace:** If any non-DaemonSet pod on the node belongs to a namespace in `SkipNsNode`, the node is critical and will not be drained.

#### Guardrails (`internal/api/guardrails.go`)

**`getGuardrails` (GET /api/guardrails)**

Returns the single guardrails row (id=1 always, seeded at startup).

**`updateGuardrails` (PUT /api/guardrails)**

Accepts a JSON body and applies a field whitelist:
- `system_namespaces`
- `skip_namespaces`
- `skip_ns_node`
- `skip_node_labels`
- `skip_node_taints`

All fields are stored as comma-separated strings in the database. The whitelist prevents callers from updating the `id` or `updated_at` fields directly.

#### Admin (`internal/api/admin.go`)

**`resetDB` (POST /api/danger/reset-db)**

This is a destructive operation used for development and testing. It requires:
```json
{"confirm": "RESET DATABASE"}
```

The response is a **streaming NDJSON** (one JSON object per line, flushed immediately). Progress steps:
1. Stop PolicyScheduler
2. Drop all tables (Guardrails, Policy, PolicyExecution, PolicyLogLine, WorkloadSnapshot, etc.)
3. Run AutoMigrate to recreate schema
4. Seed default data (guardrails + admin user)
5. Restart PolicyScheduler

Each step emits a `{"step": "...", "status": "ok"}` or `{"step": "...", "status": "error", "message": "..."}` line. The header `X-Accel-Buffering: no` disables nginx's response buffering so the client receives lines in real time.

The frontend uses an async generator (`resetDatabaseStream()`) to iterate over these lines as they arrive, displaying progress in the Settings page UI.

#### Helpers (`internal/api/helpers.go`)

- `jsonOK(w, v)` — marshals v to JSON, sets Content-Type application/json, status 200
- `jsonError(w, status, msg)` — writes `{"error": "msg"}` with given status code
- `parseID(r, param)` — extracts Chi URL param as uint, returns error if not a positive integer
- `splitCSVLocal(s)` — splits comma-separated string into `map[string]bool` for O(1) lookup

### 4.4 PolicyScheduler & Broker

The policy scheduler lives in `internal/scheduler/policy_scheduler.go` and is the heart of the automation. The Broker lives in `internal/scheduler/broker.go`.

#### PolicyScheduler

The PolicyScheduler evaluates all enabled policies on a 30-second ticker. For each policy, it calls `Evaluate(windows, timezone, now)` to determine the intended state (sleeping or awake), compares it against the current state, and triggers an execution if they differ. Override precedence: force_sleep > stay_awake > window evaluation.

**Sleep windows:** Users define sleep periods as `SleepWindow` objects with `daysOfWeek` (e.g. `[1,2,3,4,5]`), `startTime` (e.g. `"19:00"`), and `endTime` (e.g. `"07:00"`). Windows are the sole schedule source of truth — the backend evaluates them directly via `internal/policy/windows.go`.

**Key methods:**

- **`Start(ctx)`** — loads all enabled policies, starts the 30-second evaluation ticker.
- **`Stop()`** — cancels the evaluation ticker; ongoing operations run to completion.
- **`RecoverPolicies(ctx)`** — called at startup. Computes `IntendedState(now)` for each enabled policy and reconciles if the cluster state diverges (e.g. pod was restarted mid-sleep).
- **`TickExceptions(ctx)`** — called every 60s by a background ticker. Checks for scheduled exceptions that have started or ended and triggers the appropriate sleep/wake transition.
- **`RunSleepNow(ctx, policyID, trigger)`** / **`RunWakeNow(ctx, policyID, trigger)`** — manual triggers. Creates a PolicyExecution and launches the operation in a goroutine.
- **`reloadPolicies()`** — reloads all enabled policies into the in-memory cache for the next tick evaluation.
- **`removeCachedPolicy(policyID)`** — removes a policy from the in-memory cache when it is disabled or deleted.

#### Broker (`internal/scheduler/broker.go`)

```go
type Broker struct {
    mu   sync.RWMutex
    subs map[uint][]chan store.PolicyLogLine
}
```

**`Subscribe(executionID uint) chan store.PolicyLogLine`** — creates a buffered channel of capacity 256, appends it to the subscriber list for that execution ID, returns the channel. The 256-capacity buffer means a slow WebSocket client can absorb bursts without blocking the scaler goroutine.

**`Unsubscribe(executionID uint, ch chan store.PolicyLogLine)`** — removes the channel from the subscriber list and closes it. Includes a guard against double-close panics.

**`Publish(executionID uint, line store.PolicyLogLine)`** — fan-out under lock:
```go
for _, ch := range subs[executionID] {
    select {
    case ch <- line:
    default:
        slog.Warn("broker: subscriber channel full, dropping line")
    }
}
```
The `select/default` ensures the scaler goroutine is never blocked by a slow subscriber. Lines dropped are logged at Warn level.

**`Close(executionID uint)`** — closes all subscriber channels for an execution. This causes the `range ch` loop in the WebSocket handler to return, closing the connection cleanly.

### 4.5 Scaler

The scaler lives in `internal/scaler/` and is split into three files.

#### scaler.go — Shared types and helpers

```go
const annotationKey = "previous-replicas"

type LogLine struct {
    Level   string
    Message string
    Time    time.Time
}

type Counts struct {
    Saved     int
    Scaled    int
    Drained   int
    Deleted   int
    Skipped   int
    Protected int
    Errors    int
}

type Runner struct {
    k8s   *k8s.Client
    store *store.Store
}
```

**Shared abstractions:**
- `workloadEntry` — a struct that unifies Deployments and StatefulSets into a common type with `Kind`, `Namespace`, `Name`, `Replicas`, and `SavedReplicas` fields. Both `RunScaleDown` and `RunScaleUp` build `[]workloadEntry` slices and delegate to shared helpers (`scaleDownWorkloads`, `restoreWorkloads`, `saveAnnotation`, `applyScale`).
- `mergeCSV(a, b string) []string` — combines two comma-separated lists (e.g., `SystemNamespaces` + `SkipNamespaces`) into a deduplicated slice. Used to build the full skip list before filtering workloads.

**Log emission helpers:**
- `emit(ch, level, msg)` — sends a LogLine to the channel
- `info(ch, msg)` — emit with level "info"
- `ok(ch, msg)` — emit with level "success" (green in UI)
- `plan(ch, msg)` — emit with level "plan" (blue in UI, dry-run indicator)
- `errLog(ch, msg)` — emit with level "error"

**`namespaceAllowed(policy, ns)`** — if `policy.NamespaceFilter` is empty, all namespaces are allowed. Otherwise only the listed namespaces are processed. This is the per-policy namespace scope.

**`isApply(mode)`** — returns `mode == "apply"`. All mutating operations are gated on this check.

#### scale_down.go — RunScaleDown

```
RunScaleDown(ctx, mode, namespaceFilter, logCh) → (*Counts, error)
  │
  ├─ Load guardrails from store
  │
  ├─ skipNS = splitCSV(guardrails.SkipNamespaces)
  │
  ├─ List all Deployments
  │   └─ for each deployment:
  │       ├─ if namespace in skipNS → skip (emit plan/info)
  │       ├─ if !namespaceAllowed(policy, ns) → skip
  │       ├─ if annotation "previous-replicas" already exists → skip (already sleeping)
  │       ├─ if isApply:
  │       │   ├─ AnnotateDeployment(name, ns, annotationKey, strconv.Itoa(replicas))
  │       │   └─ ScaleDeployment(name, ns, 0)
  │       └─ counts.Scaled++
  │
  ├─ List all StatefulSets (same logic as Deployments)
  │
  ├─ List all Nodes
  ├─ List all Pods (all namespaces)
  │
  ├─ Build criticalNodes map[string]bool:
  │   skipNsNode = splitCSV(guardrails.SkipNsNode)
  │   for each pod:
  │     if pod.Namespace in skipNsNode AND pod is not DaemonSet:
  │       criticalNodes[pod.Spec.NodeName] = true
  │
  ├─ Build podCountPerNode map[string]int:
  │   for each pod:
  │     if not DaemonSet: podCountPerNode[nodeName]++
  │
  ├─ Load skipLabels = splitCSV(guardrails.SkipNodeLabels)  (key=value format)
  │   Load skipTaints = splitCSV(guardrails.SkipNodeTaints) (key=value:effect format)
  │
  ├─ for each node:
  │   ├─ if nodeProtectionStatus(node, criticalNodes, skipLabels, skipTaints) → skip
  │   ├─ podCount = podCountPerNode[node.Name]
  │   ├─ drainTimeout = time.Duration(podCount*15+60) * time.Second
  │   ├─ if isApply:
  │   │   ├─ CordonNode(node.Name)
  │   │   ├─ DrainNode(ctx+drainTimeout, node.Name)
  │   │   └─ DeleteNode(node.Name)
  │   └─ counts.Drained++
  │
  └─ return counts, nil
```

**Dynamic drain timeout rationale:** Each pod needs approximately 15 seconds to finish graceful termination (respect `terminationGracePeriodSeconds` + propagation). A 60-second base covers overhead. Formula: `(podCount × 15) + 60` seconds. This is more robust than a hardcoded timeout.

**DrainNode implementation (k8s/client.go):**
1. Cordon the node (mark Unschedulable).
2. List all pods on the node (using fieldSelector `spec.nodeName=<name>`).
3. For each non-DaemonSet pod:
   a. Attempt Eviction via `PolicyV1().Evictions().Create()`.
   b. If eviction API returns 404 (pod gone) or 429 (budget exceeded): retry.
   c. If eviction API unavailable (older cluster): fall back to direct `Pods().Delete()`.
4. Poll until all pods are gone (check every 2s), with respect to drainTimeout.
5. Return nil if all pods terminated within timeout, error otherwise.

#### scale_up.go — RunScaleUp

```
RunScaleUp(ctx, mode, namespaceFilter, logCh) → (*Counts, error)
  │
  ├─ Load guardrails
  │
  ├─ List all Deployments
  │   └─ for each deployment:
  │       ├─ if namespace in skipNS → skip
  │       ├─ if !namespaceAllowed(policy, ns) → skip
  │       ├─ if annotation "previous-replicas" NOT present → skip (not sleeping)
  │       ├─ savedReplicas = strconv.Atoi(annotation value)
  │       ├─ if isApply:
  │       │   ├─ ScaleDeployment(name, ns, savedReplicas)
  │       │   └─ RemoveDeploymentAnnotation(name, ns, annotationKey)
  │       └─ counts.Scaled++
  │
  ├─ List all StatefulSets (same logic)
  │
  └─ return counts, nil
      Note: Nodes are NOT touched. Karpenter watches the pending pods
      created by restored deployments and provisions new nodes automatically.
```

**Why scale-up doesn't touch nodes:** The original bash script also did not restore nodes, relying on Karpenter to provision new nodes in response to unschedulable pods. This is the correct cloud-native approach: Karpenter is the authoritative source for node lifecycle. Trying to re-create nodes manually would conflict with Karpenter's internal state machine.

### 4.6 Kubernetes Client Wrapper

`internal/k8s/client.go` wraps `k8s.io/client-go` in a typed, domain-specific API. This keeps Kubernetes-specific code isolated from business logic.

### 4.6.1 ClusterCache

`internal/k8s/cache.go` — an in-memory mirror of cluster state that eliminates repeated K8s API calls on every HTTP request.

**Design:**
- A background goroutine fetches Nodes, Pods, Deployments, and StatefulSets **in parallel** every 10 s.
- Results are stored in a `CachedSnapshot` guarded by a `sync.RWMutex`.
- All four list operations run concurrently via goroutines; partial failures (e.g., pods unavailable) do not evict previously-good data for the other fields.
- On each successful refresh, registered subscriber channels receive a signal (buffered, non-blocking — slow consumers miss events but never stall the refresh loop).
- Handlers call `Snapshot().Ready()` to check if the cache has been populated. On cold start the initial refresh fires asynchronously; handlers fall back to direct K8s calls until the first snapshot arrives (typically < 1 s).

**Startup wiring (`cmd/server/main.go`):**
```go
cache = k8sclient.NewClusterCache(k8s)
cache.Start(context.Background())  // async — first refresh fires immediately in background
router = api.NewRouter(ctx, st, k8s, policySched, cache)
```

**Pub/sub (used by SSE stream):**
```go
ch := cache.Subscribe()
defer cache.Unsubscribe(ch)
for {
    select {
    case <-ctx.Done(): return
    case <-ch: // send SSE event
    }
}
```

**Client initialization:**

```go
func New() (*Client, error) {
    // 1. Try in-cluster config (uses /var/run/secrets/kubernetes.io/serviceaccount)
    cfg, err := rest.InClusterConfig()
    if err != nil {
        // 2. Fall back to $KUBECONFIG or ~/.kube/config
        cfg, err = clientcmd.BuildConfigFromFlags("", kubeconfigPath)
    }
    clientset, _ := kubernetes.NewForConfig(cfg)
    return &Client{clientset: clientset}, nil
}
```

**Key methods and their implementations:**

| Method                                      | Implementation detail                                                       |
| :------------------------------------------ | :-------------------------------------------------------------------------- |
| `ListDeployments(namespace)`                | `AppsV1().Deployments(ns).List(ctx, ListOptions{})`                         |
| `ScaleDeployment(name, ns, replicas)`       | `GetScale` → mutate `spec.replicas` → `UpdateScale`                         |
| `AnnotateDeployment(name, ns, key, value)`  | `Get` → add to `annotations` map → `Update`                                 |
| `RemoveDeploymentAnnotation(name, ns, key)` | `Get` → delete from `annotations` map → `Update`                            |
| `CordonNode(name)`                          | `Get` → `spec.unschedulable = true` → `Update`                              |
| `ListPodsOnNode(node)`                      | `fieldSelector: spec.nodeName=<node>`                                       |
| `GetPodMetrics(ns, pod)`                    | Raw REST call to `/apis/metrics.k8s.io/v1beta1/namespaces/{ns}/pods/{name}` |
| `GetPodEvents(ns, pod)`                     | `fieldSelector: involvedObject.name=<pod>`                                  |

**Why raw REST for Metrics Server:** The Metrics Server is an aggregated API server (non-standard API group not included in the generated client-go typed clients). The cleanest approach is a raw REST call using the existing kubeconfig credentials, parsing the JSON response manually. This avoids importing `k8s.io/metrics` as an additional dependency.

**Required RBAC for Metrics Server:** The SA must have `get` and `list` on the `metrics.k8s.io` API group (`pods` and `nodes` resources). Without this the call returns HTTP 403 and usage data degrades to `—`. This rule is included in the Helm ClusterRole.

**StatefulSet parity:** Every Deployment method has an identical StatefulSet counterpart. The code is nearly identical, differing only in the API call (`AppsV1().StatefulSets()` vs `AppsV1().Deployments()`). This duplication is intentional — in Go, generics over API types are not idiomatic, and the explicit duplication is easier to read and maintain.

### 4.7 Store / Database Layer

#### Models (`internal/store/models.go`)

**Guardrails**
```go
type Guardrails struct {
    ID               uint   `gorm:"primaryKey" json:"id"`
    SystemNamespaces string `json:"systemNamespaces"` // CSV — protected system defaults
    SkipNamespaces   string `json:"skipNamespaces"`   // CSV — user-managed skip list
    SkipNsNode       string `json:"skipNsNode"`       // CSV — namespaces whose pods protect nodes
    SkipNodeLabels   string `json:"skipNodeLabels"`   // CSV key=value
    SkipNodeTaints   string `json:"skipNodeTaints"`   // CSV key=value:effect

    UpdatedAt time.Time `json:"updatedAt"`
}
```

**User**
```go
type User struct {
    ID           uint       `gorm:"primaryKey" json:"id"`
    Username     string     `gorm:"uniqueIndex:idx_users_username_source;size:255" json:"username"`
    GivenName    string     `gorm:"size:255" json:"givenName,omitempty"`
    FamilyName   string     `gorm:"size:255" json:"familyName,omitempty"`
    Email        string     `gorm:"size:255" json:"email,omitempty"`
    PasswordHash string     `gorm:"column:password_hash;size:72" json:"-"`
    Role         string     `gorm:"size:20;default:viewer" json:"role"`                            // admin | operator | viewer
    Source       string     `gorm:"uniqueIndex:idx_users_username_source;size:20;default:local" json:"source"` // local | oidc
    OIDCSubject  *string    `gorm:"column:oidc_subject;uniqueIndex;size:255" json:"-"`
    Enabled      bool       `gorm:"default:true" json:"enabled"`
    CreatedAt    time.Time  `json:"createdAt"`
    UpdatedAt    time.Time  `json:"updatedAt"`
    LastLoginAt  *time.Time `json:"lastLoginAt,omitempty"`
}
```

Passwords are hashed with bcrypt (cost 12). The `PasswordHash` field (max 72 bytes for bcrypt) is excluded from JSON serialisation via `json:"-"`. The composite unique index `idx_users_username_source` allows the same username for both local and OIDC users. The optional `OIDCSubject` field links a user to a Keycloak identity. `GivenName` and `FamilyName` are synced from the standard OIDC `given_name` / `family_name` claims on every login. `Enabled` allows admins to deactivate accounts without deletion.

**Session**
```go
type Session struct {
    ID           uint      `gorm:"primaryKey"`
    Token        string    `gorm:"uniqueIndex;size:64"`
    UserID       uint      `gorm:"index"`
    User         User      `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE"`
    IPAddress    string    `gorm:"size:45"`
    UserAgent    string    `gorm:"size:512"`
    ExpiresAt    time.Time `gorm:"index"` // sliding window — extended on each request, used for idle timeout
    MaxExpiresAt time.Time // absolute hard cap
    CreatedAt    time.Time
}
```

Sessions are stored in PostgreSQL and identified by a cryptographically random token set as an HTTP-only, Secure, SameSite=Lax cookie. `ExpiresAt` implements a sliding window — extended by `SESSION_IDLE_TIMEOUT` (default 8h) on each request, capped at `MaxExpiresAt` which is set to `SESSION_MAX_LIFETIME` (default 24h) from session creation. The `OnDelete:CASCADE` FK ensures sessions are automatically cleaned up when a user is deleted.

**AuditLog**
```go
type AuditLog struct {
    ID           uint      `gorm:"primaryKey" json:"id"`
    UserID       *uint     `gorm:"index" json:"userId,omitempty"`
    User         *User     `gorm:"foreignKey:UserID;constraint:OnDelete:SET NULL" json:"-"`
    Username     string    `gorm:"size:255" json:"username"`     // denormalised for display
    Action       string    `gorm:"index;size:100" json:"action"` // e.g. "policy.update", "user.create"
    ResourceType string    `gorm:"size:50" json:"resourceType,omitempty"`
    ResourceID   *uint     `json:"resourceId,omitempty"`
    Before       string    `gorm:"type:jsonb" json:"before,omitempty"`
    After        string    `gorm:"type:jsonb" json:"after,omitempty"`
    IPAddress    string    `gorm:"size:45" json:"ipAddress,omitempty"`
    Timestamp    time.Time `gorm:"index" json:"timestamp"`
}
```

`UserID` is nullable with `OnDelete:SET NULL` — when a user is deleted, the audit entry is preserved with `userId` set to null (the denormalised `username` field retains attribution). Audit logs are written asynchronously via a buffered channel writer (`internal/audit/writer.go`) to avoid blocking API handlers. The writer batches inserts for efficiency. `AUDIT_RETENTION_DAYS` (default 90, 0 = keep forever) controls automatic cleanup of old records via a daily background goroutine.

#### Store (`internal/store/store.go`)

```go
func New(dsn string) (*Store, error) {
    db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
        Logger: logger.Default.LogMode(logger.Silent),
    })
    // Connection pool configuration
    sqlDB, _ := db.DB()
    sqlDB.SetMaxOpenConns(10)
    sqlDB.SetMaxIdleConns(5)
    sqlDB.SetConnMaxLifetime(5 * time.Minute)
    // Auto-migrate all models
    db.AutoMigrate(&Guardrails{}, &User{}, &Session{}, &AuditLog{}, &WorkloadTarget{},
        &Policy{}, &PolicyExecution{}, &PolicyLogLine{}, &WorkloadSnapshot{},
        &PolicyOverride{}, &ScheduledException{})
    return &Store{db: db}, nil
}
```

Note: `SeedDefaults()` is NOT called inside `New()`. It is called separately in `main.go` after `store.New()` returns:

```go
st, err := store.New(dsn)
// ...
if err := st.SeedDefaults(); err != nil {
    slog.Error("seed failed", "err", err)
    os.Exit(1)
}
```

**Why silent GORM logger:** GORM's default logger prints every SQL statement to stdout. In production, this generates enormous log volume (hundreds of lines per execution). The silent mode suppresses routine queries. Errors are still propagated via return values.

**Connection pool rationale:**
- `MaxOpenConns: 10` — PostgreSQL handles ~100 connections by default; limiting to 10 leaves headroom for other clients and prevents connection exhaustion.
- `MaxIdleConns: 5` — keeps 5 connections warm to avoid connection establishment latency on bursty workloads.
- `ConnMaxLifetime: 5min` — rotates connections to prevent issues with network-level TCP session expiry (common in cloud environments with 5-minute NAT timeouts).

#### Queries (`internal/store/queries.go`)

**SeedDefaults** — a method on `*Store`. Seeds the admin user from `ADMIN_USER` / `ADMIN_PASSWORD` env vars if no users exist. Seeds one Guardrails row (if not present) with production-ready defaults:
- `SystemNamespaces`: `kube-system,kube-public,kube-node-lease,kube-phoenix`
- `SkipNamespaces`: `default,karpenter,vault,velero,istio-gateway,istio-system,kyverno,kyverno-notation-aws,victoriametrics,monitoring,gitlab`
- `SkipNsNode`: `victoriametrics,karpenter`
- `SkipNodeLabels`: `karpenter.k8s.aws/ec2nodeclass=default`
- `SkipNodeTaints`: `karpenter-eks-base=true:NoSchedule`

### 4.8 WebSocket Log Broker

This section covers the pub/sub broker in detail. The broker (extracted to `internal/scheduler/broker.go`) solves the problem of delivering log lines from a policy scale operation to zero or more WebSocket clients that may connect at any time — including after the operation has started.

**The late-subscriber problem:** If a client connects 10 seconds into an execution, it needs to see all log lines from the beginning, not just new ones. The solution has two parts:
1. All log lines are persisted to the database immediately via `AppendPolicyLogLine`.
2. On WebSocket connect, the handler sends all existing lines from the DB before subscribing to the broker.

**The race condition:** Between step 1 (send existing lines) and step 2 (subscribe), new lines may be published to the broker and missed. The fix:

```go
// Step 1: Send existing lines
existingLines := store.GetPolicyLogLines(executionID)
for _, line := range existingLines {
    sendOverWebSocket(line)
}

// Step 2: Subscribe to broker
ch := broker.Subscribe(executionID)

// Step 3: Re-check status AFTER subscribing
// If status is now "success" or "failed", close the channel from the DB side
// because broker.Close() was already called before we subscribed
currentExecution := store.GetPolicyExecution(executionID)
if currentExecution.Status != "running" {
    broker.Unsubscribe(executionID, ch)
    // Send any lines written between step 1 and step 2
    newLines := store.GetPolicyLogLines(executionID)[len(existingLines):]
    for _, line := range newLines {
        sendOverWebSocket(line)
    }
    closeWebSocket()
    return
}

// Step 4: Stream new lines from broker channel
for line := range ch {
    sendOverWebSocket(line)
}
// Channel closed by broker.Close() → connection closes cleanly
```

**Ping/pong keepalive:** WebSocket connections through load balancers and proxies are often terminated after 60 seconds of silence. The handler starts a ticker that sends WebSocket Ping frames every 30 seconds. The client browser responds with Pong automatically (per the WebSocket protocol). A 60-second pong timeout is set: if no pong arrives within 60 seconds of a ping, the connection is considered dead and closed.

**Write deadline:** Each write to the WebSocket has a 10-second deadline. If the client is too slow to receive data (network congestion, paused browser tab), the write times out and the connection is closed, freeing server resources.

### 4.9 SPA File Server

`backend/web/embed.go`:

```go
//go:embed all:static
var staticFiles embed.FS

func SPAHandler() http.Handler {
    sub, _ := fs.Sub(static, "static")
    fileServer := http.FileServer(http.FS(sub))

    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Try to serve the requested path
        f, err := sub.Open(strings.TrimPrefix(r.URL.Path, "/"))
        if err != nil {
            // Path not found: serve index.html (SPA client-side routing)
            r2 := r.Clone(r.Context())
            r2.URL.Path = "/"
            fileServer.ServeHTTP(w, r2)
            return
        }
        f.Close()
        fileServer.ServeHTTP(w, r)
    })
}
```

The `//go:embed all:static` directive embeds the entire `web/static/` directory into the binary at compile time. The `all:` prefix includes hidden files (dotfiles). At build time, the Dockerfile copies `frontend/out/` (Next.js static export output) to `backend/web/static/` before running `go build`.

The SPA handler serves actual files when they exist (JS chunks, CSS, images) and falls back to `index.html` for all other paths. This is required for Next.js client-side routing: when a user navigates directly to `/history/` or bookmarks `/cluster/`, the browser requests that path from the server, which must return `index.html` so React can boot and take over routing.

### 4.10 Backend Class Diagram

```mermaid
classDiagram
    direction LR

    class Handler {
        -store *Store
        -k8s *Client
        -policyScheduler *PolicyScheduler
        -cache *ClusterCache
        +NewRouter() *chi.Mux
        +login()
        +logout()
        +me()
        +changePassword()
        +oidcConfig()
        +oidcLogin()
        +oidcCallback()
        +getOverview()
        +streamCluster()
        +getWorkloads()
        +getNodes()
        +getNodePods()
        +getPodDetail()
        +getPodLogs()
        +getWorkloadPods()
        +getGuardrails()
        +updateGuardrails()
        +listUsers()
        +createUser()
        +updateUser()
        +deleteUser()
        +listAuditLogs()
        +resetDB()
        +listPolicies()
        +getPolicy()
        +createPolicy()
        +updatePolicy()
        +deletePolicy()
        +triggerPolicySleep()
        +triggerPolicyWake()
        +listPolicyExecutions()
        +getPolicyExecution()
        +getPolicyExecutionLogs()
        +getPolicyExecutionSnapshots()
        +getPolicySnapshots()
        +listPolicyOverrides()
        +createPolicyOverride()
        +deletePolicyOverride()
        +listExceptions()
        +getException()
        +createException()
        +updateException()
        +deleteException()
        +wsPolicyExecutionLogs()
    }

    class PolicyScheduler {
        -store *Store
        -k8s *Client
        -mu sync.Mutex
        -policies map~uint, cachedPolicy~
        -cancel context.CancelFunc
        +PolicyBroker *Broker
        +Start(ctx)
        +Stop()
        +RecoverPolicies(ctx)
        +TickExceptions(ctx)
        +RunSleepNow(ctx, policyID, trigger) uint, error
        +RunWakeNow(ctx, policyID, trigger) uint, error
        -run(ctx, policyID, direction, trigger) uint, error
        -reloadPolicies()
        -removeCachedPolicy(policyID)
    }

    class PolicyEngine {
        +IntendedState(p Policy, overrides, now) string
        +Evaluate(windows, tz, now) IntendedState
        +NextTransition(windows, tz, now) *time.Time
    }

    class PolicyScaler {
        -store *Store
        -k8s *Client
        +RunSleep(ctx, p Policy, execID, mode, logCh) *Counts, error
        +RunWake(ctx, p Policy, execID, mode, logCh) *Counts, error
        -matchWorkloads(ctx, p Policy) []WorkloadTarget, error
        -saveSnapshot(execID, target, replicasBefore) error
        -restoreSnapshot(execID, snap) error
    }

    class Broker {
        -mu sync.RWMutex
        -subs map~uint, []chan PolicyLogLine~
        +Subscribe(execID) chan PolicyLogLine
        +Unsubscribe(execID, ch)
        +Publish(execID, line)
        +Close(execID)
    }

    class Store {
        -db *gorm.DB
        +New(dsn) *Store, error
        +DB() *gorm.DB
        +Ping() error
        +GetGuardrails() *Guardrails, error
        +UpdateGuardrails(fields) *Guardrails, error
        +SeedDefaults() error
        +Tx(fn) error
        +DropAllTables() error
        +MigrateSchema() error
        +CreateUser(u) error
        +GetUserByID(id) *User, error
        +GetUserByUsername(username) *User, error
        +GetOrCreateOIDCUser(sub, username, email, role, givenName, familyName) *User, error
        +ListUsers() []User, error
        +UpdateUser(id, fields) *User, error
        +DeleteUser(id) error
        +UpdateLastLogin(id) error
        +ChangePassword(id, newPassword) error
        +CreateSession(s) error
        +GetSession(token) *Session, error
        +ExtendSession(token, idleTimeout) error
        +DeleteSession(token) error
        +DeleteUserSessions(userID) error
        +CleanExpiredSessions() error
        +CreateAuditLog(a) error
        +ListAuditLogs(filter) *AuditLogPage, error
        +CleanOldAuditLogs(retentionDays) error
    }

    class Client {
        -cs *kubernetes.Clientset
        +New() *Client, error
        +ListDeployments(ctx, ns) []Deployment, error
        +ScaleDeployment(ctx, ns, name, replicas) error
        +AnnotateDeployment(ctx, ns, name, key, val) error
        +RemoveDeploymentAnnotation(ctx, ns, name, key) error
        +ListStatefulSets(ctx, ns) []StatefulSet, error
        +ScaleStatefulSet(ctx, ns, name, replicas) error
        +AnnotateStatefulSet(ctx, ns, name, key, val) error
        +RemoveStatefulSetAnnotation(ctx, ns, name, key) error
        +ListNodes(ctx) []Node, error
        +CordonNode(ctx, name) error
        +DrainNode(ctx, name, timeout) error
        +DeleteNode(ctx, name) error
        +CountNonDaemonSetPods(ctx, nodeName) int, error
        +ListPods(ctx, ns) []Pod, error
        +ListAllPods(ctx) []Pod, error
        +ListPodsOnNode(ctx, nodeName) []Pod, error
        +ListAllReplicaSets(ctx) []ReplicaSet, error
        +ListNamespaces(ctx) []Namespace, error
        +GetPod(ctx, ns, name) *Pod, error
        +GetNode(ctx, name) *Node, error
        +GetAllPodMetrics(ctx) map, error
        +GetPodMetrics(ctx, ns, name) map, error
        +GetPodEvents(ctx, ns, name) []Event, error
    }

    class ClusterCache {
        -client *Client
        -mu sync.RWMutex
        -snap CachedSnapshot
        -subs []chan struct
        +Start(ctx)
        +Snapshot() CachedSnapshot
        +Subscribe() chan struct
        +Unsubscribe(ch)
        -refresh(ctx)
        -notify()
    }

    class CachedSnapshot {
        +Nodes []Node
        +Pods []Pod
        +Deployments []Deployment
        +StatefulSets []StatefulSet
        +FetchedAt time.Time
        +Ready() bool
        +AgeMs() int64
    }

    class Counts {
        +Saved int
        +Scaled int
        +Drained int
        +Deleted int
        +Skipped int
        +Protected int
        +Errors int
    }

    Handler --> Store : queries DB
    Handler --> Client : direct k8s calls
    Handler --> PolicyScheduler : trigger sleep/wake
    Handler --> ClusterCache : read snapshots
    Handler --> Broker : subscribe WS clients
    PolicyScheduler --> PolicyEngine : evaluate IntendedState
    PolicyScheduler --> PolicyScaler : executes sleep/wake
    PolicyScheduler --> Broker : publishes policy log lines
    PolicyScheduler --> Store : creates policy executions
    PolicyScaler --> Client : k8s API calls
    PolicyScaler --> Store : reads/writes snapshots
    ClusterCache --> Client : refreshes every 10s
    ClusterCache --> CachedSnapshot : holds current state
```

---

## 5. Frontend Deep Dive

### 5.1 Next.js Configuration & Build Pipeline

`frontend/next.config.mjs`:

```js
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
}
```

**`output: 'export'`** — instructs Next.js to produce a fully static HTML/JS/CSS site in the `out/` directory. No Node.js server is needed to serve it. This is the key decision that allows the Go binary to embed and serve the frontend.

**`trailingSlash: true`** — every route produces a directory with an `index.html` file instead of a flat `route.html` file. So `/overview/` becomes `out/overview/index.html`. This is required for the Go SPA handler's fallback logic to work correctly.

**`images.unoptimized: true`** — Next.js's default image optimization requires a Node.js server at runtime. Since we're doing static export, image optimization is disabled. The app uses MUI icons (SVG) rather than raster images, so this is not a limitation in practice.

**Build pipeline in CI:**
```
npm ci → npm run build → out/ directory → copied to backend/web/static/ → go build
```

This tight coupling between frontend and backend builds is managed by the Dockerfile's multi-stage build.

### 5.2 Theme & Design System

`frontend/src/theme/theme.ts` defines a MUI v7 theme that supports **dark** (default), **light**, and **system** modes. The active mode is stored in `localStorage` via `useThemeMode()` and toggled from Settings → Appearance. `createAppTheme(mode)` is called with the resolved mode and the result is passed to MUI's `ThemeProvider`.

**Color palette (mode-aware values):**

| Token              | Dark    | Light   | Usage                                |
| :----------------- | :------ | :------ | :----------------------------------- |
| primary.main       | #7C3AED | #6D28D9 | Active nav items, buttons, accents   |
| primary.light      | #9D5FF5 | #7C3AED | Hover states                         |
| primary.dark       | #5B21B6 | #5B21B6 | Pressed states                       |
| background.default | #0F0F13 | #F5F5F7 | Page background, terminal panes      |
| background.paper   | #1A1A24 | #FFFFFF | Card, drawer, dialog backgrounds     |
| success.main       | #22C55E | #15803D | Success chips, status indicators     |
| warning.main       | #F59E0B | #92400E | Apply mode indicators, wake icons    |
| error.main         | #EF4444 | #B91C1C | Error chips, delete actions          |
| info.main          | #3B82F6 | #1D4ED8 | Running status chips                 |

The `divider` token is computed from the mode: `rgba(255,255,255,0.07)` in dark, `rgba(0,0,0,0.09)` in light. All component borders use this token — **never hardcoded RGBA**.

**Semantic colors (`frontend/src/lib/colors.ts`):** A centralized `useColors()` hook exposes mode-aware hex values and tinted rgba backgrounds (e.g. `colors.success`, `colors.successBg`). Components use this hook instead of hardcoding hex values, ensuring all status chips, progress bars, and indicators meet WCAG AA contrast (4.5:1+) in both modes. The `statusColors.ts` module similarly exports functions (`statusColors(isDark)`, `podStatusStyle(isDark)`, `nodeStatusMap(isDark)`) that return mode-appropriate chip color maps.

**Log level colors** are also mode-aware. `LogViewer` defines `LEVEL_COLORS_DARK` and `LEVEL_COLORS_LIGHT` and selects the set at render time via `useTheme().palette.mode`. The light set uses darker hues (e.g. `#0369A1` for info, `#15803D` for ok) to maintain readability against a light background.

**Border radius:** `10px` (MUI default is 4px). This gives cards and chips a softer, more modern appearance.

**Typography:** Inter font loaded via `next/font/google` in `layout.tsx`. Applied as the default font family in the theme.

**Component overrides:**
- `MuiCard` — adds a `1px solid divider` border (mode-aware; MUI's default has no border).
- `MuiPaper` — same border treatment.
- `MuiDrawer` — overrides background to `background.paper`.
- `MuiAppBar` — overrides background to `background.paper` (not the default primary color); border color uses the `divider` token.
- `MuiTableCell` — border color uses the `divider` token.

### 5.3 Auth System

`frontend/src/lib/auth.tsx` implements a React context-based authentication system using cookie-based sessions.

**Session management:** Authentication state is maintained by the server via HTTP-only cookies. The frontend does not store credentials or tokens in `sessionStorage` or `localStorage`. The `AuthProvider` context holds the current user object (username, role) and loading state.

**Dev-mode detection:** On mount, `AuthProvider` calls `GET /api/auth/me`. If the server returns 200 with a user object (dev mode auto-authenticates when `ADMIN_USER` is unset), the app renders directly. If 401, the login screen is shown.

**Login flow:**
1. User enters username and password in `LoginScreen`.
2. `login(user, pass)` function calls `POST /api/auth/login` with `{ username, password }`.
3. On success: the server sets `kube-phoenix-session` (HTTP-only) and `kube-phoenix-csrf` cookies. The response body contains the user object. `AuthProvider` updates context state.
4. On failure: the error message is displayed on `LoginScreen`.

**OIDC login:** A "Login with SSO" button (shown when the server indicates OIDC is configured) navigates to `GET /api/auth/oidc/login`, which redirects to Keycloak. After authentication, the callback sets session cookies and redirects to `/`.

**CSRF token injection:** The `api.ts` fetch wrapper reads the `kube-phoenix-csrf` cookie and includes it as the `X-CSRF-Token` header on all POST, PUT, and DELETE requests. All fetch calls include `credentials: 'include'` to ensure cookies are sent.

**Permission-based UI guards:** The `useAuth()` hook exposes `user.role`. Components check the role to conditionally render:
- The "Users" sidebar item and `/users` page are only visible to admins.
- Sleep/wake trigger buttons, policy create/edit/delete, and guardrails edit are hidden for viewers.
- The "Audit Log" sidebar item is visible to all authenticated users.

**Logout:** `POST /api/auth/logout` clears server-side session and cookies. Context state resets to unauthenticated.

### 5.4 API Client Layer

`frontend/src/lib/api.ts` is the single source of truth for all HTTP calls. No component makes raw `fetch` calls directly.

**Base URL:**
```ts
const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''
```

In production, `NEXT_PUBLIC_API_URL` is unset, so `BASE = ''`. All API calls go to the same origin, which means they go to the Go binary (no separate API server). In local development (Next.js dev server on port 3000, Go on port 8080), `NEXT_PUBLIC_API_URL = 'http://localhost:8080'` is set in `.env.local`.

**`req<T>(path, init?)` — the core fetch wrapper:**
```ts
async function req<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(BASE + path, {
        ...init,
        credentials: 'include',  // always send cookies
        headers: {
            'Content-Type': 'application/json',
            ...getCsrfHeader(init?.method),  // X-CSRF-Token on mutating requests
            ...init?.headers,
        },
    })
    if (!res.ok) {
        const body = await res.text()
        throw new Error(body || `HTTP ${res.status}`)
    }
    return res.json() as Promise<T>
}
```

Every API function is a thin wrapper over `req<T>`. This ensures:
- All requests include session cookies via `credentials: 'include'`.
- Mutating requests (POST, PUT, DELETE) include the `X-CSRF-Token` header read from the `kube-phoenix-csrf` cookie.
- All non-2xx responses throw a consistent `Error` that TanStack Query's `onError` handlers can display.

**`wsPolicyLogsUrl(executionId)` — WebSocket URL construction:**
```ts
function wsPolicyLogsUrl(executionId: number): string {
    const base = (process.env.NEXT_PUBLIC_API_URL ?? window.location.origin)
        .replace(/^http/, 'ws')  // http: → ws:, https: → wss:

    return `${base}/ws/policy-executions/${executionId}/logs`
}
```

WebSocket connections authenticate via the session cookie, which the browser sends automatically on the upgrade request. No query parameter token is needed.

**`resetDatabaseStream()` — async generator:**
```ts
async function* resetDatabaseStream(): AsyncGenerator<{step: string, status: string, message?: string}> {
    const res = await fetch(BASE + '/api/danger/reset-db', {
        method: 'POST',
        body: JSON.stringify({ confirm: 'RESET DATABASE' }),
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    })
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()!  // Keep incomplete line in buffer
        for (const line of lines) {
            if (line.trim()) yield JSON.parse(line)
        }
    }
}
```

The async generator pattern allows the Settings page component to use `for await (const event of resetDatabaseStream())` and update UI state incrementally as each step completes.

### 5.5 Page & Component Tree

**Application shell rendering:**

```
layout.tsx (Inter font, HTML skeleton)
└─ providers.tsx
   └─ QueryClientProvider (TanStack Query)
      └─ ThemeProvider (MUI dark theme)
         └─ CssBaseline (resets browser styles)
            └─ AuthProvider
               └─ AppContent
                  ├─ [checking] → null (blank screen during auth probe)
                  ├─ [!authenticated] → <LoginScreen />
                  └─ [authenticated] → <AppShell />
                     ├─ <Sidebar />
                     └─ <main> → page route content
```

**Page components:**

| Route         | Page Component  | Purpose                                       |
| :------------ | :-------------- | :-------------------------------------------- |
| `/`             | `page.tsx`      | Redirect to `/overview/`                        |
| `/overview/`    | `OverviewPage`  | Dashboard with status cards and activity feed   |
| `/cluster/`     | `ClusterPage`   | Workloads table + Nodes table with drawers      |
| `/guardrails/`  | `GuardrailsPage` | Exclusion list form                            |
| `/policies/`    | `PoliciesPage`  | Policy cards + create/edit dialog (sleep windows) |
| `/policies/:id` | `PolicyDetailPage` | Policy detail: overrides, exceptions, history |
| `/exceptions/`  | `ExceptionsPage` | Scheduled exception list with status tabs      |
| `/history/`     | `HistoryPage`   | Policy execution table + log drawer             |
| `/users/`       | `UsersPage`     | User CRUD table (admin only)                    |
| `/audit/`       | `AuditPage`     | Searchable audit log with diffs                 |
| `/settings/`    | `SettingsPage`  | Appearance, Account, OIDC status, Danger Zone   |

**Key components:**

**`AppShell`** — responsible for the two-column layout (sidebar + content). Renders a `<AppBar>` for mobile with a hamburger menu button. Uses MUI `Drawer` in two configurations: permanent (desktop, `md+`) and temporary (mobile, slides in over content). The sidebar width is defined as a constant (240px) and passed as a prop.

**`Sidebar`** — navigation list with active state detection using `usePathname()`. Items: Overview, Cluster State, Guardrails, Policies, Exceptions, History, Users, Audit Log, Settings. Active items receive a primary-tinted background computed via MUI's `alpha(primary.main, 0.10)` — mode-aware and responsive to the actual primary color — and the primary color for text and icon. The logout button is pushed to the bottom using a flex spacer.

**`ClusterStatusCard`** — polls `getWorkloads()` every 30 seconds. Shows aggregate counts: total workloads, sleeping workloads, partial (waking). Uses a MUI `LinearProgress` to show the sleeping percentage.

**`NextRunCard`** — polls policy data every 30 seconds. Sorts policies by next sleep/wake fire time and renders each with a two-line next-run display:
- **Absolute time** (dimmed caption): locale-aware label derived from the policy's own timezone — `today at 07:00`, `tomorrow at 07:00`, `Mon at 07:00`, or `Mar 15 at 07:00` depending on how far out the run is.
- **Relative countdown** (bold, color-coded): `in Xm`, `in Xh Ym`, `in Xd Yh`. Color shifts from policy-type tint (>6 h) → `warning.main` (1–6 h) → `error.light` (<1 h). A pulsing red dot appears alongside the countdown when under one hour.

**`ActivityFeed`** — polls `getExecutions({ pageSize: 5 })` every 15 seconds. Shows the 5 most recent executions. Clicking a running execution opens `LogViewer` inline (WebSocket). Clicking a completed execution navigates to `/history?exec=<id>`.

**`WorkloadsTable`** — renders a MUI `Table` with rows for each workload. Clicking a row opens `WorkloadDetailDrawer`. Sleeping workloads show a moon icon; running show a checkmark. `partial` state shows a warning.

**`NodesTable`** — renders nodes with pod count, CPU/memory requests, and a protection badge. Clicking a row opens `NodeDetailDrawer`.

**`NodeDetailDrawer`** — MUI `Drawer` (right side, 480px). Shows node conditions, capacity, labels, taints, and a list of pods running on the node. Each pod is clickable, opening `PodDetailDrawer`.

**`PodDetailContent`** — self-contained component that shows container statuses, resource requests, conditions, events, and live metrics. Manages its own detail↔logs view toggle internally — a "Logs" button in the overview row switches to `PodLogViewer` inline (back-arrow to return). Used by both `WorkloadDetailDrawer` and `NodeDetailDrawer` without any wrapper.

**`PodLogViewer`** — streams live container logs via a chunked HTTP response (`GET /api/cluster/pods/{ns}/{name}/logs?follow=true`). The streaming architecture:

```
Browser (fetch + ReadableStream)
    ↕ chunked HTTP (text/plain, no Content-Length)
Go handler (read 4KB chunks → Write → ResponseController.Flush)
    ↕ io.ReadCloser (K8s streaming API)
K8s API server → kubelet → container stdout/stderr
```

The backend proxies the K8s pod logs API directly with `Follow: true` and flushes each chunk via `http.ResponseController` (which traverses middleware wrapper chains). Headers `Cache-Control: no-cache` and `Connection: keep-alive` prevent intermediate proxy buffering. Zero database involvement — the Go handler is a stateless pipe.

Lifecycle: user opens logs → `fetch()` with `AbortController` → Go handler opens K8s stream → chunks flow until user navigates away → `AbortController.abort()` cancels the fetch → Go request context is cancelled → K8s stream closes.

Features: container selector (multi-container pods), search with match counter and up/down navigation (Enter/Shift+Enter keyboard support), current-match highlight with left accent border, copy-to-clipboard, download as `.log`, auto-scroll toggle (auto-disables when user scrolls up), and a "Load older logs" button at the top. When a container has a `lastState` (e.g. OOMKilled), a contextual banner offers "View previous logs" which fetches a one-shot snapshot of the terminated container's output.

**`PolicyCard`** — displays a single policy with state badge (awake/sleeping/unknown), sleep/wake action buttons, mode badge, and an enabled toggle. The toggle uses an optimistic update — it flips immediately in local state, fires `PUT /api/policies/:id` with `{ enabled: <new value> }`, and reverts on error. Has edit and delete actions.

**`CreatePolicyDialog`** — form for creating or editing a policy. The primary input is the `WindowPicker` for defining sleep windows. An "All Day" toggle marks the window as covering the full 24 hours. A **dashboard mini-card preview** shows the resulting schedule: a card header with timezone badge, the `WeeklyTimeline` grid with brand-purple sleep blocks and green awake rows, and a stats footer showing total weekly sleep/awake hours (via `computeWeeklyStats()`) with icons and a human-readable schedule summary. Also includes: name, description, timezone, namespace filter, label selector, mode, timeout, and enabled switch.

**`WindowPicker`** — the day/time picker for `SleepWindow` objects. Each window is an independent card with day-of-week buttons, an all-day slide toggle, and per-window sleep/wake time pickers. Preset buttons ("Weekday nights", "Weekends", "Nights + weekends", "Business hours") apply common patterns. A never-wake warning appears when all 7 days are set to all-day sleep. Windows are the sole schedule source of truth — the backend evaluates them directly.

**`GuardrailsForm`** — four `ChipInput` fields (Skip Namespaces, Critical Namespaces, Skip Node Labels, Skip Node Taints). The `ChipInput` component renders chips for each value with delete buttons, and an inline text input for adding new values. Pressing Enter or Tab, or blurring the input, adds the current value as a chip. Backspace on empty input removes the last chip.

**`ExecutionTable`** — paginated table of executions. Clicking a row opens `LogViewer`. The `exec` query parameter in the URL is used to pre-open a specific execution's logs (used by the ActivityFeed navigation).

**`LogViewer`** — right-side MUI `Drawer` with a scrollable log pane. The log container uses `background.default` (adapts to light/dark mode). For running executions, it opens a WebSocket and appends lines in real time. For completed executions, it fetches all lines via REST. Each log line is colored by level using mode-aware color sets (`LEVEL_COLORS_DARK` / `LEVEL_COLORS_LIGHT`) — darker hues are used in light mode for contrast. Auto-scrolls to bottom as new lines arrive, using a `useRef` on the scroll container.

### 5.6 TanStack Query Strategy

`frontend/src/lib/queryClient.ts`:

```ts
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,  // 30 seconds
            retry: 1,
        },
    },
})
```

**staleTime: 30s** — query results are considered fresh for 30 seconds. Navigating between pages does not re-fetch if data was fetched within the last 30 seconds. This reduces API load significantly.

**retry: 1** — failed queries retry once before showing an error state. One retry handles transient network blips without being overly aggressive.

**Per-query refetchInterval and staleTime overrides:**

| Query key                    | staleTime | refetchInterval | Reason                                                               |
| :--------------------------- | :-------- | :-------------- | :------------------------------------------------------------------- |
| `['overview']`               | 25s       | 30s (fallback)  | Primary dashboard card — fed by SSE stream, polling is fallback only |
| `['policy-executions', 'feed']` | 14s    | 15s             | Activity feed needs to be timely                                     |
| `['policies']`               | 60s       | 60s             | Policies rarely change; used by trigger buttons on Overview          |
| `['guardrails']`             | —         | —               | Only refetch on mutation                                             |
| `['policy-executions', id, 'logs']` | —  | —               | Uses WebSocket instead                                               |

The `['overview']` query is primarily kept fresh by the SSE stream (`/api/cluster/stream`) via `queryClient.setQueryData`. The `refetchInterval: 30_000` acts as a reconnect fallback if the SSE connection drops. With `staleTime: 25_000`, navigating away from and back to the Overview page renders the cached data instantly without a loading skeleton.

**SSE stream (`useClusterStream` hook in `ClusterStatusCard.tsx`):**

Opens a persistent `fetch` connection to `/api/cluster/stream`. On each `data:` line received, parses the JSON and calls `queryClient.setQueryData(['overview'], data)`, which triggers a React re-render with the latest cluster state. Reconnects automatically after errors with a 3 s backoff (5 s if the response itself was not OK).

**Mutation invalidation:** After every mutation (create/update/delete policy, save guardrails), the mutation's `onSuccess` callback calls `queryClient.invalidateQueries` with the relevant query key. This triggers an immediate re-fetch and keeps the UI in sync.

### 5.7 WebSocket Integration in the Frontend

`LogViewer.tsx` manages the WebSocket lifecycle:

```ts
useEffect(() => {
    if (!execution || execution.status !== 'running') return

    const url = wsPolicyLogsUrl(execution.id)
    const ws = new WebSocket(url)

    ws.onmessage = (event) => {
        const line: LogLine = JSON.parse(event.data)
        setLines(prev => [...prev, line])
        // Scroll to bottom
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
    }

    ws.onerror = () => setWsError(true)
    ws.onclose = () => setConnected(false)

    return () => ws.close()  // Cleanup on unmount
}, [execution?.id])
```

**Message format:** Each WebSocket message is a JSON-encoded `LogLine`:
```json
{
    "id": 123,
    "executionId": 42,
    "seq": 7,
    "level": "info",
    "message": "Scaling down deployment api-server in namespace production",
    "timestamp": "2025-03-14T18:30:45Z"
}
```

**Connection lifecycle:**
1. `LogViewer` mounts with a running `execution`.
2. `useEffect` opens WebSocket to `wsLogsUrl(execution.id)`.
3. Messages arrive → lines state grows → component re-renders with new log lines.
4. Execution finishes → backend broker closes channel → Go handler closes WebSocket with code 1000 (Normal Closure).
5. `ws.onclose` fires → `setConnected(false)` → "Execution complete" banner shown.
6. `LogViewer` unmounts (user closes dialog) → `useEffect` cleanup calls `ws.close()`.

---

## 6. Data Models & ER Diagram

```mermaid
erDiagram
    users ||--o{ sessions : "has many (CASCADE)"
    users ||--o{ audit_logs : "has many (SET NULL)"
    policies ||--o{ policy_executions : "has many"
    policies ||--o{ workload_snapshots : "has many"
    policies ||--o{ policy_overrides : "has many"
    policies ||--o{ scheduled_exceptions : "optional FK"
    policy_executions ||--o{ policy_log_lines : "has many (CASCADE)"
    policy_executions ||--o{ workload_snapshots : "sleep/wake ref"

    guardrails {
        bigint id PK "singleton, always 1"
        text system_namespaces "CSV, immutable defaults"
        text skip_namespaces "CSV, user-managed"
        text skip_ns_node "CSV, protects nodes"
        text skip_node_labels "CSV, key=value"
        text skip_node_taints "CSV, key=value:effect"
        timestamptz updated_at
    }

    users {
        bigint id PK
        varchar(255) username "unique(username,source)"
        varchar(255) given_name
        varchar(255) family_name
        varchar(255) email
        varchar(72) password_hash "bcrypt"
        varchar(20) role "admin | operator | viewer, default viewer"
        varchar(20) source "local | oidc, default local"
        varchar(255) oidc_subject "unique, nullable"
        boolean enabled "default true"
        timestamptz created_at
        timestamptz updated_at
        timestamptz last_login_at "nullable"
    }

    sessions {
        bigint id PK
        varchar(64) token "unique"
        bigint user_id FK "indexed, CASCADE"
        varchar(45) ip_address
        varchar(512) user_agent
        timestamptz expires_at "indexed, sliding window"
        timestamptz max_expires_at "absolute hard cap"
        timestamptz created_at
    }

    audit_logs {
        bigint id PK
        bigint user_id FK "indexed, nullable, SET NULL"
        varchar(255) username "denormalised"
        varchar(100) action "indexed"
        varchar(50) resource_type
        bigint resource_id "nullable"
        jsonb before "nullable"
        jsonb after "nullable"
        varchar(45) ip_address
        timestamptz timestamp "indexed"
    }

    policies {
        bigint id PK
        varchar(255) name "not null"
        varchar(1024) description
        jsonb sleep_windows "SleepWindow array; evaluated directly by ticker"
        varchar(100) timezone "default UTC"
        varchar(10) mode "plan | apply"
        boolean enabled "default true"
        int timeout_minutes "default 30"
        varchar(4096) namespace_filter "CSV; empty = all"
        varchar(4096) label_selector "k8s selector syntax"
        varchar(20) current_state "sleeping|awake|unknown|transitioning"
        timestamptz state_since "nullable"
        timestamptz last_sleep_at "nullable"
        timestamptz last_wake_at "nullable"
        timestamptz created_at
        timestamptz updated_at
    }

    policy_executions {
        bigint id PK
        bigint policy_id FK "indexed"
        varchar(10) direction "sleep | wake, indexed"
        varchar(30) trigger "scheduled|manual_sleep|manual_wake|recovery|..."
        timestamptz started_at "indexed"
        timestamptz finished_at "nullable"
        varchar(20) status "running|success|failed|interrupted|skipped, indexed"
        varchar(10) mode "plan | apply"
        int count_scaled
        int count_skipped
        int count_errors
        int count_protected
        int count_drained
        int count_deleted
    }

    policy_log_lines {
        bigint id PK
        bigint execution_id FK "composite index with seq, CASCADE"
        int seq "monotonic per execution"
        varchar(10) level "info | ok | plan | error | warn"
        text message
        timestamptz timestamp
    }

    workload_snapshots {
        bigint id PK
        bigint policy_id FK "indexed"
        bigint sleep_execution_id FK "indexed"
        bigint wake_execution_id FK "indexed, nullable"
        varchar(50) kind "Deployment | StatefulSet"
        varchar(63) namespace "indexed"
        varchar(253) name
        int replicas_before
        int replicas_restored "nullable"
        timestamptz restored_at "nullable"
        boolean was_already_zero
        boolean was_deleted_at_wake
        boolean was_externally_scaled
        timestamptz captured_at "indexed"
    }

    policy_overrides {
        bigint id PK
        bigint policy_id FK "indexed"
        varchar(30) override_type "stay_awake|force_sleep|skip_sleep|skip_wake"
        timestamptz starts_at "nullable (skip types)"
        timestamptz ends_at "nullable (skip types)"
        timestamptz target_cron_time "nullable; used as valid-until for skip overrides"
        varchar(1024) reason
        varchar(255) created_by
        timestamptz created_at
    }

    scheduled_exceptions {
        bigint id PK
        bigint policy_id FK "indexed, nullable"
        varchar(20) exception_type "stay_awake | force_sleep"
        timestamptz starts_at "indexed"
        timestamptz ends_at
        varchar(255) ticket_ref "JIRA-123, GH-456, etc."
        varchar(1024) reason
        boolean sleep_on_end "default true"
        varchar(4096) namespace_filter
        varchar(4096) label_selector
        jsonb workload_targets "JSON array"
        varchar(20) status "pending|active|completed|cancelled"
        bigint start_execution_id "nullable"
        bigint end_execution_id "nullable"
        timestamptz cancelled_at "nullable"
        varchar(1024) cancel_reason
        varchar(255) created_by
        timestamptz created_at
        timestamptz updated_at
    }
```

**Why CSV strings instead of normalized tables:**

Guardrail values are small lists (typically < 20 entries) that are always read and written as a whole. Normalizing them into a separate table (e.g., `guardrail_namespaces`) would add JOINs, migrations, and complexity without any benefit. The CSV approach is simpler and the data volume does not warrant normalization.

**Why `FinishedAt` is nullable:**

An execution that is currently `running` has not finished. A nullable `FinishedAt` is the natural representation of this state. PostgreSQL allows nullable timestamptz columns.

**Why LogLine uses a `seq` field instead of relying on `id`:**

Database auto-increment IDs are not guaranteed to be in insertion order under concurrent writes (PostgreSQL sequences allocate in order, but transactions can commit out of order). A `seq` field managed by the application ensures strict ordering within an execution.

---

## 7. WebSocket Architecture

```mermaid
sequenceDiagram
    participant B as Browser
    participant H as Go HTTP Handler
    participant DB as PostgreSQL
    participant Br as Broker
    participant S as PolicyScaler

    B->>H: GET /ws/policy-executions/42/logs
    H->>H: Upgrade to WebSocket

    rect rgba(100, 100, 100, 0.1)
        Note over H,DB: Step 1 — Replay existing logs
        H->>DB: GetPolicyLogLines(42)
        DB-->>H: existing lines
        H-->>B: send existing lines
    end

    rect rgba(100, 100, 100, 0.1)
        Note over H,Br: Step 2 — Subscribe to live stream
        H->>Br: Subscribe(42)
        Br-->>H: buffered channel (cap 256)
    end

    rect rgba(100, 100, 100, 0.1)
        Note over H,DB: Step 3 — Race condition check
        H->>DB: GetPolicyExecution(42).Status
        alt status != running
            H->>DB: GetPolicyLogLines(42) — fetch gap lines
            H-->>B: send any missed lines
            H-->>B: WebSocket close (1000)
        end
    end

    rect rgba(100, 100, 100, 0.1)
        Note over B,S: Step 4 — Live streaming
        S->>Br: Publish(42, logLine)
        Br->>H: ch <- logLine
        H-->>B: send logLine

        S->>Br: Publish(42, logLine)
        Br->>H: ch <- logLine
        H-->>B: send logLine

        loop Every 30s
            H-->>B: Ping frame
            B->>H: Pong frame
        end

        S->>Br: Close(42) — scaler done
        Br->>H: close(ch)
        H-->>B: WebSocket close (1000)
    end
```

**Concurrent WebSocket clients:** Multiple browser tabs can watch the same execution simultaneously. Each call to `broker.Subscribe(42)` creates a separate buffered channel. The broker fans out each log line to all subscriber channels independently. Slow clients receive lines at their own pace and are never blocked by other subscribers.

**Slow client protection:** The subscriber channel has capacity 256. If a subscriber falls more than 256 lines behind (e.g., network congestion), new publishes use `select/default` to skip the full channel, logging a warning. The slow client continues to receive lines; it just misses lines during the overflow period. This is an intentional trade-off: never blocking the scaler for a slow UI client.

**WebSocket vs Server-Sent Events:** WebSocket was chosen over SSE because:
1. It supports bidirectional communication (ping/pong).
2. It works through the same HTTP/1.1 connection without needing `Transfer-Encoding: chunked` special handling in all proxies.
3. The WebSocket library (`gorilla/websocket`) provides robust framing, masking, and connection management.
4. Session cookie authentication works seamlessly on the WebSocket upgrade request.

---

## 8. Authentication & Authorization Architecture

### 8.1 Session-Based Authentication

Authentication uses server-side sessions stored in PostgreSQL, identified by a secure random token delivered as an HTTP-only cookie.

```mermaid
flowchart TD
    Start["Request arrives"] --> AuthSet{"ADMIN_USER<br/>env var set?"}

    AuthSet -- "No" --> DevMode["Dev mode<br/>skip auth, call next handler"]

    AuthSet -- "Yes" --> HasCookie{"Session cookie<br/>present?"}

    HasCookie -- "No" --> Reject401["401 Unauthorized"]

    HasCookie -- "Yes" --> LookupSession["Look up session in DB"]

    LookupSession --> Valid{"Session valid?<br/>(not expired, not idle)"}

    Valid -- "No" --> DeleteSession["Delete session row"]
    DeleteSession --> Reject401

    Valid -- "Yes" --> ExtendExpiry["Extend session.ExpiresAt (sliding window)"]
    ExtendExpiry --> InjectUser["Inject User into request context"]
    InjectUser --> CheckCSRF{"Mutating request?<br/>(POST/PUT/DELETE)"}

    CheckCSRF -- "No" --> Allow["next(handler)"]
    CheckCSRF -- "Yes" --> CSRFValid{"CSRF token<br/>matches cookie?"}

    CSRFValid -- "Yes" --> Allow
    CSRFValid -- "No" --> Reject403["403 Forbidden"]
```

**Session lifecycle:**
- **Login:** `POST /api/auth/login` validates credentials (bcrypt compare), creates a Session row, sets the `kube-phoenix-session` HTTP-only cookie (Secure, SameSite=Lax) and a `kube-phoenix-csrf` non-HTTP-only cookie (readable by JS for the double-submit pattern).
- **Idle timeout:** `SESSION_IDLE_TIMEOUT` (default 8h). On each authenticated request, `ExpiresAt` is extended by the idle timeout (capped at `MaxExpiresAt`). If the session is not used within the window, it expires.
- **Max lifetime:** `SESSION_MAX_LIFETIME` (default 24h). Absolute upper bound regardless of activity.
- **Logout:** `POST /api/auth/logout` deletes the session row and clears both cookies.

**CSRF double-submit cookie protection:** On login, the server sets a random CSRF token in a non-HTTP-only cookie. The frontend reads this cookie and includes it in the `X-CSRF-Token` header on every mutating request (POST, PUT, DELETE). The server validates that the header matches the cookie value. This prevents cross-site request forgery because a third-party site cannot read the cookie value to set the header.

**WebSocket authentication:** WebSocket connections authenticate via the session cookie (sent automatically by the browser on upgrade). The `?token=` query parameter mechanism has been removed.

### 8.2 Login Rate Limiting

Login attempts are throttled to prevent brute-force attacks:

| Limiter | Limit | Window | Key |
|---|---|---|---|
| Per-IP | 10 attempts | 15 minutes | Client IP (respects X-Forwarded-For) |
| Per-username | 5 attempts | 15 minutes | Submitted username |

Rate-limited requests receive `429 Too Many Requests` with a `Retry-After` header. Both limiters use in-memory token bucket counters and are reset on successful login.

### 8.3 RBAC — Permission-Based Role System

Three roles with hierarchical permissions:

| Permission | admin | operator | viewer |
|---|---|---|---|
| View dashboard, cluster state, history | Yes | Yes | Yes |
| View audit logs | Yes | Yes | Yes |
| Trigger manual sleep/wake | Yes | Yes | No |
| Create/edit/delete policies | Yes | Yes | No |
| Create/edit/delete exceptions | Yes | Yes | No |
| Edit guardrails | Yes | Yes | No |
| Manage users | Yes | No | No |
| Reset database | Yes | No | No |

Roles are enforced at two levels:
1. **Backend:** `authmw.RequireRole(roles...)` middleware checks the user's role from the request context before the handler runs. Returns `403 Forbidden` if the role is insufficient.
2. **Frontend:** The `useAuth()` hook exposes the current user's role. Components and sidebar items are conditionally rendered based on permissions — e.g., the Users page and trigger buttons are hidden for viewers.

### 8.4 Keycloak OIDC Integration

Optional Keycloak integration is activated when `OIDC_ISSUER_URL` is set. It implements the Authorization Code flow with PKCE (S256). The Keycloak client must have **Proof Key for Code Exchange Code Challenge Method** set to `S256`.

```mermaid
sequenceDiagram
    participant U as Browser
    participant F as Frontend
    participant B as Backend
    participant K as Keycloak

    U->>F: Click "Login with SSO"
    F->>B: GET /api/auth/oidc/login
    B->>B: Generate state + PKCE verifier
    B-->>U: 302 Redirect to Keycloak authorize endpoint

    U->>K: Authenticate (AD credentials)
    K-->>U: 302 Redirect to /api/auth/oidc/callback?code=...&state=...

    U->>B: GET /api/auth/oidc/callback?code=...&state=...
    B->>K: Exchange code for tokens (with PKCE verifier)
    K-->>B: ID token + access token
    B->>B: Validate ID token, extract claims (sub, email, given_name, family_name, groups)
    B->>B: Map AD groups → role (via OIDC_ROLE_ADMIN_GROUPS / OIDC_ROLE_OPERATOR_GROUPS)
    B->>B: Upsert User by oidc_subject — sync role, email, given name, family name
    B->>B: Create session
    B-->>U: Set session cookie, redirect to /
```

**AD group-to-role mapping:**
- If the user's groups (from `OIDC_GROUPS_CLAIM`, default `"groups"`) include any group listed in `OIDC_ROLE_ADMIN_GROUPS` → role is `admin`.
- Else if groups include any in `OIDC_ROLE_OPERATOR_GROUPS` → role is `operator`.
- Otherwise → role is `viewer`.

**TLS options:** When the OIDC issuer uses an internal/self-signed CA, two options are available:
- **Custom CA cert (recommended):** In the Helm chart, set `oidc.caConfigMap` to mount a ConfigMap containing the CA bundle. The chart sets `SSL_CERT_FILE` pointing to the mounted cert, which Go's `crypto/tls` reads natively — no application code involved.
- **Skip TLS verification (dev only):** Set `OIDC_SKIP_TLS_VERIFY=true`. The backend creates an `http.Client` with `InsecureSkipVerify` and injects it into both the OIDC discovery and OAuth2 token exchange contexts. When enabled, the CA cert mount is not rendered. **Not recommended for production.**

**Account linking:** When an OIDC user logs in for the first time, a local User record is created with the OIDC subject stored in `oidc_subject`. On subsequent logins, the existing user is found by `oidc_subject` and their role, email, given name, and family name are updated from the current ID token claims.

### 8.5 Frontend Authentication Flow

```mermaid
sequenceDiagram
    participant U as Browser
    participant F as Frontend (React)
    participant B as Backend (Go)

    U->>F: Open app
    F->>B: GET /api/auth/me (with cookie)

    alt Dev mode (ADMIN_USER unset)
        B-->>F: 200 OK (dev user)
        F-->>U: render app directly
    else No session / expired
        B-->>F: 401 Unauthorized
        F-->>U: render LoginScreen

        U->>F: enter credentials
        F->>B: POST /api/auth/login {username, password}

        alt Credentials valid
            B-->>F: 200 OK + Set-Cookie (session + CSRF)
            F->>F: store user in context
            F-->>U: render app
        else Credentials invalid
            B-->>F: 401 Unauthorized
            F-->>U: show error on LoginScreen
        end
    end
```

**Cookie-based auth:** The frontend no longer stores credentials in `sessionStorage`. Authentication state is managed entirely via HTTP-only cookies, which are automatically included in all same-origin requests. The `api.ts` fetch wrapper includes `credentials: 'include'` and reads the CSRF token from the `kube-phoenix-csrf` cookie to set the `X-CSRF-Token` header on mutating requests.

**Security considerations:**

1. **HTTPS required in production.** Session cookies are set with `Secure=true` by default (`COOKIE_SECURE` env var). The Helm chart's ingress template includes TLS configuration.

2. **HTTP-only cookies** prevent XSS attacks from accessing the session token. The CSRF cookie is intentionally non-HTTP-only (must be readable by JS) but is a random value with no authentication power on its own.

3. **SameSite=Lax** prevents the cookie from being sent on cross-site POST requests, providing an additional layer of CSRF protection alongside the double-submit cookie.

---

## 9. Scale-Down / Scale-Up Flows

### Sleep Sequence (Policy-Based)

```
Trigger (scheduled (30s ticker), manual, or exception)
         │
         ▼
policyScheduler.run(ctx, policyID, "sleep", trigger)
         │
         ├─ Create PolicyExecution record (status=running, direction=sleep)
         │
         ▼
policyScaler.RunSleep(ctx, policy, execID, mode, logCh)
         │
         ├─ Phase 1: Match workloads
         │    ├─ matchWorkloads(policy) → filter by namespaceFilter + labelSelector
         │    │    for each matched workload:
         │    │      skip if: namespace in guardrails.SkipNamespaces
         │    │      skip if: already at 0 replicas
         │    │      plan mode: log intent
         │    │      apply mode:
         │    │        1. saveSnapshot(execID, target, replicasBefore) → DB
         │    │        2. Scale to 0
         │    │        3. counts.Scaled++
         │    │
         │    └─ Handles both Deployments and StatefulSets
         │
         └─ Return Counts
                  │
                  ▼
         policyScheduler: close logCh, wait for drain goroutine
                  │
                  ▼
         broker.Close(executionID) → WebSocket subscribers see end of stream
                  │
                  ▼
         store.FinishPolicyExecution(executionID, counts, err)
              status = "success" or "failed"
              finished_at = now()
              policy.current_state = "sleeping"
```

### Wake Sequence (Policy-Based)

```
Trigger (scheduled (30s ticker), manual, or exception end)
         │
         ▼
policyScheduler.run(ctx, policyID, "wake", trigger)
         │
         ├─ Create PolicyExecution record (status=running, direction=wake)
         │
         ▼
policyScaler.RunWake(ctx, policy, execID, mode, logCh)
         │
         ├─ Phase 1: Restore from snapshots (ONLY — no node operations)
         │    ├─ Load WorkloadSnapshots for this policy's most recent sleep
         │    │    for each snapshot:
         │    │      skip if: workload was already zero (was_already_zero)
         │    │      skip if: workload was deleted since sleep
         │    │      plan mode: log intent
         │    │      apply mode:
         │    │        1. restoreSnapshot(snap) → scale to replicas_before
         │    │        2. Update snapshot: replicas_restored, restored_at
         │    │        3. counts.Scaled++
         │    │
         │    └─ Handles both Deployments and StatefulSets
         │
         └─ Return Counts
                  │
                  ▼
         After wake, pods become Pending (no nodes yet)
         Karpenter detects unschedulable pods → provisions new nodes
         New nodes join cluster → pods scheduled → Running
         policy.current_state = "awake"
```

### Plan vs Apply Mode

Every mutating operation is guarded by `isApply(mode)`. When `mode == "plan"`:
- All Kubernetes API calls that would modify state are skipped.
- Log lines with level "plan" describe what WOULD happen.
- Counts are still incremented (so the UI shows "would scale 12 deployments").
- The execution is recorded in the database with `mode = "plan"`.

This provides a safe preview before committing to a live scale operation. All policies default to `mode = "plan"` at creation. An administrator must explicitly change to `mode = "apply"` to enable live operations.

### Policy Execution Lifecycle

```mermaid
stateDiagram-v2
    [*] --> running : PolicyScheduler.run() or RunSleepNow/RunWakeNow()

    running --> success : PolicyScaler completes without error
    running --> failed : PolicyScaler returns error or timeout
    running --> interrupted : server restart during execution
    running --> skipped : idempotent check (already in target state)

    success --> [*]
    failed --> [*]
    interrupted --> [*]
    skipped --> [*]

    state running {
        [*] --> Scaling
        Scaling --> [*] : workloads processed
    }

    note right of running
        logCh open → Broker.Publish()
        WebSocket clients receive live lines
    end note

    note right of success
        FinishedAt set, logCh closed
        Broker.Close() → WS clients disconnect
        policy.current_state updated
    end note
```

### Policy State

```mermaid
stateDiagram-v2
    direction LR

    state "Disabled" as dis
    state "Enabled (plan)" as plan
    state "Enabled (apply)" as apply

    [*] --> dis : created by user

    dis --> plan : toggle enabled ON
    dis --> apply : toggle enabled ON + set mode apply
    plan --> dis : toggle enabled OFF
    apply --> dis : toggle enabled OFF

    plan --> apply : set mode to apply
    apply --> plan : set mode to plan

    note right of plan
        Ticker detects mismatch → dry-run only
        Logs what WOULD happen
        No K8s mutations
    end note

    note right of apply
        Ticker detects mismatch → live execution
        Scales workloads to 0 (sleep) or restores snapshots (wake)
    end note

    note right of dis
        Policy removed from ticker cache
        Policy skipped
    end note
```

---

## 10. Helm Chart & Kubernetes Deployment

### Chart structure

```
helm/kube-phoenix/
├── Chart.yaml                 # chart version and appVersion (managed by release-please)
├── values.yaml                # all configurable defaults
└── templates/
    ├── _helpers.tpl           # named template helpers
    ├── namespace.yaml         # optional namespace creation
    ├── serviceaccount.yaml    # kube-phoenix service account
    ├── clusterrole.yaml       # RBAC rules
    ├── clusterrolebinding.yaml
    ├── secret.yaml            # DATABASE_URL, ADMIN_USER, ADMIN_PASSWORD, session/OIDC config
    ├── deployment.yaml        # main workload
    ├── service.yaml           # ClusterIP :80 → :8080
    ├── ingress.yaml           # optional ingress
    ├── targetgroupbinding.yaml # optional AWS ALB target group binding
    └── postgresql.yaml        # optional in-cluster PostgreSQL
```

### ClusterRole permissions

The application requires cluster-wide (not namespaced) RBAC because it manages resources across all namespaces:

| Resource             | Verbs                                    | Reason                                  |
| :------------------- | :--------------------------------------- | :-------------------------------------- |
| `nodes`              | get, list, watch, patch, update, delete  | Read node state, cordon, delete         |
| `pods`               | get, list, watch                         | Read pods for drain decisions           |
| `pods/eviction`      | create                                   | Evict pods during drain                 |
| `deployments`        | get, list, watch, update, patch          | Read replicas, scale, annotate          |
| `statefulsets`       | get, list, watch, update, patch          | Same as deployments                     |
| `deployments/scale`  | get, update                              | Read/write scale subresource            |
| `statefulsets/scale` | get, update                              | Same                                    |
| `replicasets`        | list                                     | Owner chain resolution for pod display  |
| `namespaces`         | list                                     | Namespace listing for UI                |
| ~~`events`~~         | ~~get, list~~                            | _(Not in ClusterRole — events are accessed via the pods API)_ |

### Deployment manifest

Key configuration:

```yaml
initContainers:
  - name: wait-for-postgresql
    image: busybox:1.36
    command: ['sh', '-c', 'until nc -z {{ postgresqlHost }} 5432; do sleep 2; done']
```

The `wait-for-postgresql` initContainer prevents the app from starting before PostgreSQL is ready. This is essential for the startup sequence where `store.New()` would fail immediately if called before the database accepts connections.

```yaml
env:
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: {{ secretName }}
        key: DATABASE_URL
  - name: ADMIN_USER
    valueFrom:
      secretKeyRef:
        name: {{ secretName }}
        key: ADMIN_USER
  - name: ADMIN_PASSWORD
    valueFrom:
      secretKeyRef:
        name: {{ secretName }}
        key: ADMIN_PASSWORD
  # Session configuration
  - name: SESSION_IDLE_TIMEOUT     # default 8h
  - name: SESSION_MAX_LIFETIME     # default 24h
  - name: COOKIE_SECURE            # default true
  - name: AUDIT_RETENTION_DAYS     # default 90, 0 = keep forever
  # Optional: Keycloak OIDC
  - name: OIDC_ISSUER_URL
  - name: OIDC_CLIENT_ID
  - name: OIDC_CLIENT_SECRET
  - name: OIDC_REDIRECT_URL
  - name: OIDC_GROUPS_CLAIM        # default "groups"
  - name: OIDC_ROLE_ADMIN_GROUPS
  - name: OIDC_ROLE_OPERATOR_GROUPS
  - name: OIDC_SKIP_TLS_VERIFY     # "true" to skip TLS verify (dev only)
```

All secrets are injected as environment variables from a Kubernetes Secret. Never committed to git.

```yaml
volumeMounts:
  - name: tmp
    mountPath: /tmp
volumes:
  - name: tmp
    emptyDir: {}
```

The distroless base image has a read-only filesystem. The `/tmp` emptyDir provides a writable scratch space, which Go's standard library and some dependencies require for temporary file operations.

### Helm helpers (`_helpers.tpl`)

| Helper                             | Returns                                    |
| :--------------------------------- | :----------------------------------------- |
| `kube-phoenix.fullname`            | `Release.Name-Chart.Name` (max 63 chars)   |
| `kube-phoenix.namespace`           | `Values.namespace` or `Release.Namespace`  |
| `kube-phoenix.serviceAccountName`  | Configurable SA name                       |
| `kube-phoenix.secretName`          | Configurable secret name                   |
| `kube-phoenix.postgresqlHost`      | Computed from values                       |
| `kube-phoenix.databaseUrl`         | Constructed DSN if in-cluster PG enabled   |
| `kube-phoenix.labels`              | Standard Helm labels block                 |

### In-cluster PostgreSQL (`postgresql.yaml`)

Controlled by `values.postgresql.enabled`. When enabled, creates:
1. A Kubernetes `Secret` with PostgreSQL credentials.
2. A `ClusterIP` Service (port 5432).
3. A `StatefulSet` with a single PostgreSQL 17 replica and a `PersistentVolumeClaim` for data.

This is suitable for development and small deployments. Production deployments should use Amazon RDS or similar managed PostgreSQL with automated backups, multi-AZ, and point-in-time recovery.

### AWS Target Group Binding (`targetgroupbinding.yaml`)

Controlled by `values.targetGroupBinding.enabled`. Creates an `elbv2.k8s.aws/v1beta1 TargetGroupBinding` CRD resource that connects the kube-phoenix Service to an AWS ALB Target Group. This is used when deploying behind an AWS Application Load Balancer with the AWS Load Balancer Controller.

---

## 11. CI/CD Pipeline

### Branching strategy

kube-phoenix uses **GitHub Flow**: a single protected `master` branch and short-lived feature branches merged via pull request.

```
master  (protected — always deployable)
  ├── feat/emergency-wake    → PR → master
  ├── fix/something          → PR → master
  └── ci/improvement         → PR → master
```

**Rules:**
- `master` is always in a releasable state
- All non-trivial changes go through a PR — CI must be green before merge
- Direct pushes to `master` are allowed only for admins on small one-liner fixes
- Tags and GitHub Releases are created exclusively by release-please — never manually

**Conventional commit → version bump:**

| Prefix                                | Bump  |
| :------------------------------------ | :---- |
| `feat:`                               | minor |
| `fix:`, `perf:`                       | patch |
| `feat!:` / `BREAKING CHANGE:`         | major |
| `docs:`, `ci:`, `chore:`, `refactor:` | none  |

### Design principles

Three workflows with distinct responsibilities:

| Workflow              | Trigger                              | Responsibility                                   |
| :-------------------- | :----------------------------------- | :----------------------------------------------- |
| `ci.yml`              | every push to `master` + PR          | Validate — fast feedback, no artifacts produced   |
| `security.yml`        | every push to `master` + PR + weekly | Security — vuln checks, image scan, secret scan   |
| `release-please.yml`  | push to `master`                     | Ship — Docker image, Helm chart, GitHub Release   |

Docker builds only happen on release. CI never pushes images. This keeps the registry clean and prevents every commit from producing a deployable artifact.

---

### ci.yml — Continuous Integration

Triggered on: `push` to `master`; `pull_request` targeting `master`. Path-filtered to `frontend/**`, `backend/**`, `Dockerfile`, `helm/**`, `.github/workflows/**`. Concurrency group cancels in-progress runs on the same ref.

**Job: frontend**
```
steps:
  - checkout
  - setup-node@v6 (node 24)
  - npm ci
  - npm run build                  (Next.js static export → out/)
  - Job Summary: node version, build duration, page count, export size
```

**Job: backend**
```
steps:
  - checkout
  - setup-go@v6 (go 1.26)
  - cp ../openapi.yaml internal/docs/openapi.yaml   (seed go:embed path — see note below)
  - diff ../openapi.yaml internal/docs/openapi.yaml (assert files are identical; fails build on drift)
  - go mod download
  - go vet ./...
  - go test -race -coverprofile=coverage.out ./...   (race detector enabled)
  - go tool cover -func=coverage.out
  - go build -o server ./cmd/server
  - golangci-lint-action@v9    (gosec for SAST, errcheck, staticcheck, etc.)
  - Job Summary: go version, test pass/fail, duration, coverage, binary size, lint status
```

Both jobs write a markdown table to `$GITHUB_STEP_SUMMARY` so the CI run page shows at-a-glance build metrics alongside the Docker build summary.

> **OpenAPI embed note:** `backend/internal/docs/openapi.yaml` is gitignored — it is a derived
> file, not a source file. The canonical spec is `openapi.yaml` at the repository root.
> CI copies it into the embed path before building so `//go:embed openapi.yaml` in
> `internal/docs/docs.go` resolves correctly, then immediately diffs the copy against the
> root to ensure they are byte-for-byte identical. Keeping only one committed copy
> prevents silent drift where the served spec and the documented spec diverge.
> goreportcard does not run CI steps, so it reports a warning for the missing embed file;
> this is a known and accepted cosmetic score hit.

**Job: helm**
```
steps:
  - checkout
  - helm lint helm/kube-phoenix/
```

> **Note:** Security-related checks (govulncheck, npm audit, secret scanning) have been moved to `security.yml` to avoid duplication. CI focuses purely on build validation.

---

### security.yml — Dedicated Security Scanning

Triggered on: `push` to `master`; `pull_request` targeting `master`; weekly schedule (Monday 06:00 UTC). No path filter — always runs on every push/PR to ensure security coverage is never skipped.

**Job: govulncheck**
```
steps:
  - checkout
  - setup-go@v6 (go 1.26)
  - cp ../openapi.yaml internal/docs/openapi.yaml
  - govulncheck ./...          (checks actual call graph against Go vuln DB)
```

**Job: npm-audit**
```
steps:
  - checkout
  - setup-node@v6 (node 24)
  - npm ci
  - npm audit --audit-level=high --omit=dev
```

**Job: trivy-image** (builds the Docker image with BuildKit + GHA cache, then scans it)
```
steps:
  - checkout
  - docker/setup-buildx-action
  - docker/build-push-action (load: true, cache-from/to: type=gha)
  - aquasecurity/trivy-action@v0.35.0
      image-ref: kube-phoenix:scan
      severity: CRITICAL,HIGH
      exit-code: 1
      format: sarif → upload to GitHub Security tab
```

Uses the same GHA cache as the release build, so subsequent runs reuse layers. Builds and scans the image on every PR — catching vulnerabilities before merge rather than after release.

**Job: trivy-fs** (filesystem scan for IaC misconfigurations and dependency vulnerabilities)
```
steps:
  - checkout
  - aquasecurity/trivy-action
      scan-type: fs
      scan-ref: .
      severity: CRITICAL,HIGH
      exit-code: 1
      format: sarif → upload to GitHub Security tab
```

Catches Dockerfile misconfigurations, Helm template issues, and dependency vulnerabilities without needing to build a container image. Complements the image scan.

**Job: secrets** (the single source of truth for secret scanning — removed from ci.yml to avoid duplication)
```
steps:
  - checkout (full history, fetch-depth: 0)
  - trufflesecurity/trufflehog
      base: HEAD~1 (push) or PR base SHA (PR)
      head: HEAD   (push) or PR head SHA (PR)
      extra_args: --only-verified
```

Every job writes a summary table to `$GITHUB_STEP_SUMMARY`: govulncheck (vulnerability count), npm audit (critical/high/moderate breakdown), Trivy image (pass/fail + SARIF link), Trivy filesystem (pass/fail + SARIF link), and TruffleHog (verified secret status).

> **Weekly schedule rationale:** New CVEs are disclosed continuously. The weekly Monday run ensures vulnerabilities introduced by upstream dependencies are caught even when no code changes are made.

> **SARIF uploads:** Both Trivy jobs upload results in SARIF format to GitHub's Security tab. This provides a unified view of all security findings alongside CodeQL results (if enabled). SARIF upload requires `security-events: write` permission.

---

### release-please.yml — Release Automation

Triggered on: `push` to `master`.

**How release-please works:**

1. After each push, release-please reads all conventional commits since the last release tag.
2. If releasable changes exist, it opens (or updates) a Release PR that contains:
   - Bumped version in `Chart.yaml` and `package.json`
   - Updated `CHANGELOG.md` with categorised commit entries
3. When the Release PR is merged, release-please creates a git tag (`v0.1.x`) and a GitHub Release.
4. The `docker`, `scan`, and `helm-publish` jobs are gated on `release_created == true` — they only fire after step 3.

**Conventional commit → version bump mapping:**

| Commit prefix                          | Version bump                  |
| :------------------------------------- | :---------------------------- |
| `feat:`                                | minor (`0.1.x` → `0.2.0`)    |
| `fix:`, `perf:`                        | patch (`0.1.x` → `0.1.x+1`)  |
| `feat!:` or `BREAKING CHANGE:` footer  | major                         |
| `docs:`, `ci:`, `chore:`, `refactor:`  | no bump                       |

**Job: docker** (only when `release_created == true`)
```
tags produced:
  - ghcr.io/macxsimilian/kube-phoenix:0.1.x      (exact semver)
  - ghcr.io/macxsimilian/kube-phoenix:0.1         (minor float)
  - ghcr.io/macxsimilian/kube-phoenix:0           (major float)
  - ghcr.io/macxsimilian/kube-phoenix:v0.1-latest (branch float)
  - ghcr.io/macxsimilian/kube-phoenix:latest      (master only)
```

**Job: helm-publish** (needs: release-please + docker, only when both succeed)
```
helm package helm/kube-phoenix/ --version 0.1.x --app-version 0.1.x
helm push kube-phoenix-0.1.x.tgz oci://ghcr.io/macxsimilian/helm
```

Installable with:
```
helm install kube-phoenix oci://ghcr.io/macxsimilian/helm/kube-phoenix --version 0.1.x
```

---

### dependabot.yml

Weekly Dependabot PRs across all three ecosystems. All update types (major, minor, patch) are enabled — security patches are never silently blocked.

```yaml
updates:
  - package-ecosystem: github-actions   # pinned action SHAs
    schedule: weekly

  - package-ecosystem: gomod            # backend Go dependencies
    directory: /backend
    schedule: weekly

  - package-ecosystem: npm              # frontend npm packages
    directory: /frontend
    schedule: weekly
```

Dependabot PRs go through the same CI pipeline as any other PR — secret scan, frontend build, backend lint/test — before they can be merged.

---

## 12. Local Development Guide

### Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 24.x | Required for frontend |
| Go | 1.26+ | Required for backend |
| Docker | Latest | For container builds |
| kubectl | Latest | For k8s interaction |
| helm | 4.x | For Helm operations |
| PostgreSQL | 17+ | Local database |

> **Note:** Go is not installed on the project maintainer's machine at the time of writing. Backend changes must be built in CI or via Docker.

### Environment setup

**Backend environment variables:**

```bash
export DATABASE_URL="postgres://kube_phoenix:password@localhost:5432/kube_phoenix?sslmode=disable"
# Optional: set these to enable auth in dev (seeds admin user on first run)
export ADMIN_USER="admin"
export ADMIN_PASSWORD="password"
# Optional: session configuration
export SESSION_IDLE_TIMEOUT="8h"
export SESSION_MAX_LIFETIME="24h"
export COOKIE_SECURE="false"          # set to false for local HTTP dev
export AUDIT_RETENTION_DAYS="90"
```

**Frontend environment variables (`frontend/.env.local`):**

```
NEXT_PUBLIC_API_URL=http://localhost:8080
```

Without this variable, the frontend assumes the API is on the same origin (correct for production but not for local development where Next.js dev server is on :3000 and Go is on :8080).

### Running locally

**Option 1: Full stack with Make**

```bash
# Terminal 1: Start frontend dev server
make dev-frontend
# Equivalent to: cd frontend && npm run dev

# Terminal 2: Start backend
make dev-backend
# Equivalent to: cd backend && go run ./cmd/server/

# Navigate to http://localhost:3000
```

**Option 2: Docker Compose**

A `docker-compose.yml` is included at the repository root. It provides a local PostgreSQL instance. Run `make dev` (equivalent to `docker compose up postgres -d`) before starting the backend.

**Option 3: Full Docker build**

```bash
make docker-build
# Equivalent to: docker build -t kube-phoenix:dev .

docker run -e DATABASE_URL="..." -p 8080:8080 kube-phoenix:dev
# Navigate to http://localhost:8080
```

### Database setup

```sql
CREATE DATABASE kube_phoenix;
CREATE USER kube_phoenix WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE kube_phoenix TO kube_phoenix;
```

On first startup, the Go binary runs `AutoMigrate` to create all tables and `SeedDefaults` to populate initial data. No manual schema migrations are needed.

### Running with a real Kubernetes cluster

For the k8s client to work locally, you need a valid kubeconfig:

```bash
# Point to your cluster
export KUBECONFIG=~/.kube/config

# Or for a local cluster (kind/minikube):
kind create cluster
```

Without a kubeconfig, the backend starts with `k8s = nil` (warning logged). All endpoints that don't require k8s (policies, guardrails, history) continue to work.

### Helm development

```bash
# Lint the chart
make helm-lint

# Template rendering (debug)
make helm-template

# Install to a local cluster
make helm-install

# Upgrade after changes
make helm-upgrade

# Uninstall
make helm-uninstall
```

The Makefile targets use the `helm/kube-phoenix/` chart and a values override file at `helm/values-local.yaml` (not tracked in git, created by the developer).

### Building the frontend for embedding

```bash
cd frontend
npm run build
# Copies out/ to ../backend/web/static/ automatically (configured in package.json postbuild script)

cd ../backend
go build ./cmd/server/
./server  # Serves the embedded SPA + API
```

### Common development tasks

**Adding a new API endpoint:**
1. Add the handler function to the appropriate `internal/api/*.go` file.
2. Register the route in `internal/api/router.go`.
3. Add the corresponding API function in `frontend/src/lib/api.ts`.
4. Add the TypeScript interface to `frontend/src/lib/types.ts`.

**Adding a new database model:**
1. Add the struct to `internal/store/models.go`.
2. Add it to the `AutoMigrate` call in `internal/store/store.go`.
3. Add CRUD functions to `internal/store/queries.go`.

**Changing the sleep/wake logic:**
1. Modify `internal/scheduler/policy_scaler.go` for sleep/wake execution changes.
2. Modify `internal/policy/windows.go` for sleep window validation changes.

**Changing the theme:**
1. Edit `frontend/src/theme/theme.ts`. The `createAppTheme(mode)` function receives `'light' | 'dark'` and must return correct palette values for both modes.
2. MUI component overrides live in the same file under `components:`. Use the `divider` local variable (already computed from mode) rather than hardcoded RGBA for any borders.
3. For components that embed terminal-style content (LogViewer, settings reset dialog), use `background.default` as the container background — it resolves to the appropriate off-white or near-black per mode.
4. Log level / status colors that need different values per mode should be defined as two constant maps and selected at render time via `useTheme().palette.mode`.

---

## 13. Key Design Decisions

### 13.1 Single binary embedding the frontend

**Decision:** The Next.js SPA is compiled to a static export and embedded into the Go binary using `//go:embed`.

**Why:** Simplifies deployment to a single container image with no external dependencies (no nginx, no CDN for the app shell). The Go binary is the complete application. This makes the Kubernetes deployment simpler (one container, one service) and eliminates the class of bugs that arise from frontend/backend version mismatches.

**Trade-off:** The Docker build is more complex (3 stages). Developers cannot update the frontend without rebuilding the Go binary. Local development requires the `NEXT_PUBLIC_API_URL` environment variable to point the SPA at the separate Go server.

### 13.2 Next.js static export (no SSR)

**Decision:** `output: 'export'` in `next.config.mjs` produces purely static HTML/JS.

**Why:** The app does not need server-side rendering. All data is loaded client-side from the Go API. SSR would require a Node.js server, which adds operational complexity and would need to be a separate container (cannot be embedded in Go). The static export is simpler and produces faster initial loads (the HTML shell is a static file, served from memory by the Go binary).

**Trade-off:** SEO is limited (though this is an internal tool, SEO is irrelevant). Dynamic routes must be pre-rendered (handled by `trailingSlash: true`).

### 13.3 PostgreSQL for persistence

**Decision:** PostgreSQL via GORM, not SQLite or an in-memory store.

**Why:** The application needs to persist execution history across pod restarts. SQLite in Kubernetes is problematic (file locking with ReadWriteOnce PVCs, no connection pooling). PostgreSQL is the standard for production Go applications and integrates naturally with managed cloud databases (RDS, Cloud SQL).

**Trade-off:** Adds an external dependency (PostgreSQL must exist before the app starts). Addressed by the Helm chart's optional in-cluster PostgreSQL and the `wait-for-postgresql` initContainer.

### 13.4 GORM AutoMigrate (no explicit migrations)

**Decision:** GORM's `AutoMigrate` is used instead of a migration tool (golang-migrate, Flyway, etc.).

**Why:** AutoMigrate handles the 90% case of adding new columns and tables without manual migration files. For an application with a small team and infrequent schema changes, the overhead of maintaining migration files is not justified.

**Trade-off:** AutoMigrate cannot drop columns, rename columns, or make complex schema changes. If a column needs to be dropped in a future version, a manual migration step or one-time script would be required. This is an accepted risk.

### 13.5 Scaler annotation for state persistence

**Decision:** The previous replica count is stored as a Kubernetes annotation on the Deployment/StatefulSet itself (`previous-replicas`).

**Why:** This makes the state self-contained in the Kubernetes resource. If the PostgreSQL database is unavailable, the state can still be read and restored. It also means the state is visible to operators using `kubectl describe deployment` without needing to query the application's database.

**Trade-off:** Annotations are application-managed state stored in etcd. If an operator manually removes the annotation, the scaler won't know the previous replica count and will skip that workload on scale-up (it only restores workloads with the annotation).

### 13.6 No scale-up node management (Karpenter delegation)

**Decision:** Scale-up does not provision new nodes. This is delegated entirely to Karpenter.

**Why:** Karpenter has sophisticated bin-packing logic and instance type selection. Replicating this in kube-phoenix would be both complex and fragile. By restoring pod replicas (which creates Pending pods) and letting Karpenter react, the system benefits from Karpenter's optimization logic without duplicating it.

**Trade-off:** Requires Karpenter to be installed and configured. A cluster without Karpenter (or Cluster Autoscaler) would leave pods pending indefinitely after scale-up.

### 13.7 Preventing concurrent runs (ticker model)

**Decision:** The 30-second evaluation ticker detects state mismatches (intended vs. actual) and triggers executions. The `transitioning` guard in `run()` prevents concurrent executions for the same policy.

**How it works:** When `run()` starts an execution, it sets the policy's `current_state` to `transitioning`. On each tick, the evaluator skips any policy whose state is `transitioning`. Once the execution completes, the state is updated to `sleeping` or `awake`, and subsequent ticks resume normal evaluation.

**Why this is sufficient:** The `transitioning` state acts as a per-policy mutex without requiring external coordination (Redis, PostgreSQL advisory locks). A distributed lock would add complexity for no benefit since the application runs as a single replica.

### 13.8 Session-based auth with CSRF protection

**Decision:** Server-side sessions in PostgreSQL with HTTP-only cookies, CSRF double-submit cookie, and optional Keycloak OIDC. Replaces the previous HTTP Basic Auth mechanism.

**Why:** Session-based auth is more secure than Basic Auth (credentials are not sent on every request), supports multi-user management with different roles, and enables proper session lifecycle (idle timeout, max lifetime, server-side revocation). HTTP-only cookies prevent XSS token theft. The CSRF double-submit pattern protects against cross-site request forgery without server-side CSRF token storage.

**Why not JWT:** JWTs cannot be revoked server-side without maintaining a blocklist (which is effectively a session store). Since we already have PostgreSQL, server-side sessions are simpler and more secure. Session revocation is immediate (delete the row).

**WebSocket auth:** WebSocket connections authenticate via the session cookie, which browsers send automatically on the upgrade request. This is simpler and more secure than the previous `?token=` query parameter approach, which leaked credentials in access logs and URL bars.

**Keycloak OIDC:** Optional integration using Authorization Code + PKCE. PKCE (Proof Key for Code Exchange) prevents authorization code interception attacks without requiring a client secret in the browser. AD group claims are mapped to local roles, so RBAC is consistent regardless of login method.

### 13.9 Pub/sub broker in-process (no Redis)

**Decision:** The log broker is implemented as an in-process Go struct with mutex and channels.

**Why:** The application is a single-replica deployment (it's a cluster management tool, not a horizontally scaled service). There is no need for a distributed pub/sub system. An in-process broker is faster (no network hop), simpler (no Redis dependency), and sufficient for the load pattern (one active execution at a time, a handful of WebSocket subscribers).

**Trade-off:** If the application is ever scaled to multiple replicas, the broker would not work across replicas (a client connected to replica A would not receive log lines from a scale operation running on replica B). At that point, a Redis pub/sub or NATS replacement would be needed.

### 13.10 Plan mode as default for all policies

**Decision:** All policies default to `mode: "plan"` at creation.

**Why:** The scaler has real consequences — zeroing out all production deployments is a serious operation. Making plan mode the default means a newly created policy cannot accidentally perform live operations. An administrator must consciously change to `mode: "apply"`.

**User experience:** The plan mode shows exactly what would happen (which workloads would be scaled) without any risk. This allows teams to validate their policy and guardrails configuration before enabling live mode.

### 13.11 Distroless base image

**Decision:** `gcr.io/distroless/static-debian13:nonroot` as the final container image.

**Why:**
1. **Security:** Distroless contains no shell, no package manager, no system utilities. There is nothing for an attacker to use if they gain code execution. The attack surface is minimal.
2. **Size:** The final image is typically 5-15 MB (Go binary + distroless base). Smaller images pull faster and have smaller registry storage footprints.
3. **Compliance:** Many security scanners and compliance frameworks require distroless or scratch-based images.

**Trade-off:** No debugging tools available inside the container. `kubectl exec` into the pod gives you nothing. All debugging must be done by analyzing logs or running a temporary debug sidecar. This is the correct trade-off for production security.

**`:nonroot` variant:** Runs as a non-root user (uid 65532). This prevents privilege escalation attacks that require root access. The Helm chart does not override the security context, so the container inherits the distroless nonroot user.

---

## 14. Observability

kube-phoenix exposes a Prometheus metrics endpoint at `/metrics`. The endpoint requires no authentication and is intended for in-cluster scraping by Prometheus or the Prometheus Operator.

### 14.1 Endpoint

| Path | Auth | Format |
|------|------|--------|
| `GET /metrics` | None | Prometheus text exposition format (OpenMetrics compatible) |

The endpoint is registered outside the session auth middleware group alongside `/healthz`, so it is always reachable by in-cluster scrapers without credentials.

### 14.2 Metrics reference

All metrics use the `kube_phoenix_` namespace prefix.

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `kube_phoenix_executions_total` | Counter | `status`, `mode`, `direction` | Total completed policy executions. `status` is `success` or `failed`. `mode` is `plan` or `apply`. `direction` is `sleep` or `wake`. |
| `kube_phoenix_execution_duration_seconds` | Histogram | `mode`, `direction`, `status` | Wall-clock duration of each execution in seconds. Buckets: 5, 15, 30, 60, 120, 300, 600, 1800. |
| `kube_phoenix_workloads_scaled_total` | Counter | `direction` | Workloads (Deployments + StatefulSets) scaled. `direction` is `sleep` or `wake`. |
| `kube_phoenix_nodes_drained_total` | Counter | — | Nodes drained during sleep executions (apply mode only). |
| `kube_phoenix_nodes_deleted_total` | Counter | — | Nodes deleted during sleep executions (apply mode only). |
| `kube_phoenix_active_policies` | Gauge | `mode` | Number of enabled policies, reset and recomputed on every PolicyScheduler reload. |
| `kube_phoenix_login_attempts_total` | Counter | `result` | Login attempts. `result` is `success` or `failed`. |
| `kube_phoenix_active_sessions` | Gauge | — | Currently active (non-expired) user sessions. |
| `kube_phoenix_auth_errors_total` | Counter | `reason` | Authentication failures. `reason` is `expired`, `invalid`, or `csrf`. |
| `kube_phoenix_audit_events_total` | Counter | `action` | Audit log events by action type (e.g. `policy.update`, `user.create`). |
| `kube_phoenix_rate_limit_rejections_total` | Counter | `limiter` | Rate limiter rejections. `limiter` is `ip` or `username`. |
| `kube_phoenix_oidc_logins_total` | Counter | `result` | OIDC login attempts. `result` is `success` or `failed`. |

In addition to these business metrics, the standard `prometheus/client_golang` process and Go runtime collectors are registered automatically:
- `go_*` — goroutines, GC duration, memory stats
- `process_*` — CPU time, open file descriptors, resident memory

### 14.3 Implementation

**Package:** `backend/internal/metrics/metrics.go`

All metrics are declared as package-level variables using `promauto`, which registers them with the default Prometheus registry at init time. No explicit `Register()` call is needed.

**Instrumentation points:**

| Location | What is recorded |
|----------|-----------------|
| `policy_scheduler.go` `run()` goroutine (on completion) | `ExecutionsTotal`, `ExecutionDuration`, `WorkloadsScaledTotal`, `NodesDrainedTotal`, `NodesDeletedTotal` |
| `policy_scheduler.go` `reloadPolicies()` | `ActivePolicies` — reset and recount on every reload |
| `api/auth.go` `login()` | `LoginAttemptsTotal`, `ActiveSessions` |
| `middleware/auth.go` session validation | `AuthErrorsTotal`, `ActiveSessions` |
| `middleware/ratelimit.go` | `RateLimitRejectionsTotal` |
| `audit/writer.go` | `AuditEventsTotal` |
| `api/auth.go` OIDC callback | `OIDCLoginsTotal` |

**Router registration** (`api/router.go`):

```go
// Outside the session auth group — no credentials required
r.Method(http.MethodGet, "/metrics", promhttp.Handler())
```

### 14.4 Helm — enabling Prometheus scraping

#### Option A: Pod annotations (no Prometheus Operator required)

Set `metrics.podAnnotations.enabled: true` (the default). The Helm chart adds the standard `prometheus.io/*` annotations to the Pod template, which any Prometheus instance using the [Kubernetes SD `pod` role](https://prometheus.io/docs/prometheus/latest/configuration/configuration/#pod) will honour automatically.

```yaml
# values.yaml
metrics:
  podAnnotations:
    enabled: true   # default — adds prometheus.io/* to the pod
```

Resulting pod annotations:
```yaml
prometheus.io/scrape: "true"
prometheus.io/path:   /metrics
prometheus.io/port:   "8080"
```

#### Option B: ServiceMonitor (Prometheus Operator / kube-prometheus-stack)

Set `metrics.serviceMonitor.enabled: true`. This creates a `ServiceMonitor` CRD that the Prometheus Operator picks up based on its `serviceMonitorSelector`.

```yaml
metrics:
  podAnnotations:
    enabled: false        # optional — disable pod annotations when using ServiceMonitor
  serviceMonitor:
    enabled: true
    interval: 30s         # scrape interval
    scrapeTimeout: 10s
    labels: {}            # add labels to match your Prometheus Operator's serviceMonitorSelector
```

#### Prometheus scrape config (without operator)

```yaml
scrape_configs:
  - job_name: kube-phoenix
    kubernetes_sd_configs:
      - role: pod
        namespaces:
          names: [kube-phoenix]
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: "true"
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        target_label: __metrics_path__
      - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
        action: replace
        regex: (.+):(?:\d+);(\d+)
        replacement: $1:$2
        target_label: __address__
```

### 14.5 Example Grafana queries

```promql
# Execution success rate (last 1h)
rate(kube_phoenix_executions_total{status="success"}[1h])
  /
rate(kube_phoenix_executions_total[1h])

# P95 execution duration
histogram_quantile(0.95, rate(kube_phoenix_execution_duration_seconds_bucket[1h]))

# Total workloads put to sleep this week
increase(kube_phoenix_workloads_scaled_total{direction="sleep"}[7d])

# Currently enabled policies
kube_phoenix_active_policies

# Failed login attempts in the last hour
increase(kube_phoenix_login_attempts_total{result="failed"}[1h])

# Rate limit rejections
rate(kube_phoenix_rate_limit_rejections_total[5m])
```

---

*End of ARCHITECTURE.md*
*Document covers: 2 source code languages, 35+ source files, 10 database models, 25+ API routes, 9 frontend pages, 30+ React components, 3-stage Docker build, Helm chart with 10 templates, 3 GitHub Actions workflows.*
