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
   - 4.4 [Scheduler](#44-scheduler)
   - 4.5 [Scaler](#45-scaler)
   - 4.6 [Kubernetes Client Wrapper](#46-kubernetes-client-wrapper)
   - 4.7 [Store / Database Layer](#47-store--database-layer)
   - 4.8 [WebSocket Log Broker](#48-websocket-log-broker)
   - 4.9 [SPA File Server](#49-spa-file-server)
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
8. [Authentication Architecture](#8-authentication-architecture)
9. [Scale-Down / Scale-Up Flows](#9-scale-down--scale-up-flows)
10. [Helm Chart & Kubernetes Deployment](#10-helm-chart--kubernetes-deployment)
11. [CI/CD Pipeline](#11-cicd-pipeline)
12. [Local Development Guide](#12-local-development-guide)
13. [Key Design Decisions](#13-key-design-decisions)
14. [Observability](#14-observability)

---

## 1. Project Overview

kube-phoenix is a web application that manages Kubernetes cluster **sleep/wake schedules**. Its purpose is to reduce cloud spend during off-hours by scaling workloads to zero replicas and draining nodes (which then get removed), then restoring them on schedule. It replaces a legacy `cronjob.yaml` bash script with a properly observable, configurable system.

### Core capabilities

| Capability               | Description                                                               |
| :----------------------- | :------------------------------------------------------------------------ |
| Schedule management      | CRUD for named cron schedules typed `scale_down` or `scale_up`            |
| Guardrails               | Configurable exclusion lists for namespaces, node labels, and node taints |
| Dry-run (plan) mode      | Every scale operation can be simulated before applying                    |
| Live log streaming       | WebSocket-based log fan-out during an active execution                    |
| Cluster state visibility | Real-time view of workloads and nodes with health metrics                 |
| History                  | Paginated execution history with per-execution log viewer                 |
| Self-hosted              | Single binary embeds the full Next.js SPA; no separate web server needed  |
| API documentation        | Swagger UI served at `/api/docs/`; raw OpenAPI 3.1 spec at `/api/docs/openapi.yaml` |

### Technology stack

| Layer                   | Technology                                               |
| :---------------------- | :------------------------------------------------------- |
| Backend language        | Go 1.26                                                  |
| HTTP router             | go-chi/chi v5.2                                          |
| Database                | PostgreSQL via GORM v1.31 (gorm.io/driver/postgres v1.6) |
| Scheduler               | robfig/cron v3 (5-field cron expressions)                |
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
                    Router["Chi Router<br/>+ BasicAuth middleware"]
                    Handlers["API Handlers<br/>/api/*  /ws/*"]
                    Scheduler["Scheduler<br/>(robfig/cron v3)"]
                    Scaler["Scaler Runner<br/>scale_down / scale_up"]
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
    Handlers --> Scheduler
    Handlers --> Store
    Scheduler --> Scaler
    Scaler --> K8sClient
    K8sClient --> K8sAPI
    Store --> PG
```

### Request flow summary

1. Browser loads the Next.js SPA from `GET /` (served by the Go binary from its embedded filesystem).
2. SPA calls `GET /api/*` endpoints (JSON over HTTP) for data.
3. For live log streaming, SPA opens `ws[s]://host/ws/executions/:id/logs`.
4. The Go binary calls the Kubernetes API Server directly using the pod's ServiceAccount token (in-cluster config).
5. The cron scheduler fires scale-down or scale-up jobs on schedule; results are persisted to PostgreSQL and streamed to subscribers.

---

## 3. Repository Layout

```
kube-phoenix/
│
├── Dockerfile                    # 3-stage build (node → golang → distroless)
├── Makefile                      # Developer workflow targets
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
│   │   │   ├── schedules.go      # CRUD for Schedule resources
│   │   │   ├── executions.go     # Execution list/get/logs + WebSocket
│   │   │   ├── cluster.go        # Cluster state (workloads, nodes, pods)
│   │   │   ├── guardrails.go     # Guardrails get/update
│   │   │   ├── trigger.go        # Manual run trigger
│   │   │   ├── admin.go          # DB reset (streamed NDJSON)
│   │   │   └── helpers.go        # jsonOK, jsonError, parseID, splitCSVLocal
│   │   │
│   │   ├── scheduler/
│   │   │   └── scheduler.go      # Cron wrapper + Broker pub/sub + run()
│   │   │
│   │   ├── scaler/
│   │   │   ├── scaler.go         # Types, helpers, Runner struct
│   │   │   ├── scale_down.go     # RunScaleDown implementation
│   │   │   └── scale_up.go       # RunScaleUp implementation
│   │   │
│   │   ├── k8s/
│   │   │   └── client.go         # Typed k8s API wrapper
│   │   │
│   │   ├── store/
│   │   │   ├── models.go         # GORM model structs
│   │   │   ├── store.go          # DB connection + AutoMigrate
│   │   │   └── queries.go        # All DB queries + SeedDefaults
│   │   │
│   │   └── middleware/
│   │       └── auth.go           # HTTP Basic Auth middleware
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
│       │   ├── providers.tsx      # QueryClient → Theme → Auth → AppShell
│       │   ├── overview/page.tsx
│       │   ├── cluster/page.tsx
│       │   ├── guardrails/page.tsx
│       │   ├── schedules/page.tsx
│       │   ├── history/page.tsx
│       │   └── settings/page.tsx
│       │
│       ├── components/
│       │   ├── layout/
│       │   │   ├── AppShell.tsx   # Main layout: Sidebar + main content area
│       │   │   └── Sidebar.tsx    # Navigation drawer (desktop permanent, mobile temporary)
│       │   ├── overview/
│       │   │   ├── ClusterStatusCard.tsx
│       │   │   ├── NextRunCard.tsx
│       │   │   └── ActivityFeed.tsx
│       │   ├── schedules/
│       │   │   ├── ScheduleCard.tsx
│       │   │   ├── ScheduleDialog.tsx
│       │   │   ├── CronBuilder.tsx    # visual cron builder (day/time picker + advanced raw cron toggle)
│       │   │   └── SchedulePanel.tsx
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
│       │   └── auth/
│       │       └── LoginScreen.tsx
│       │
│       ├── lib/
│       │   ├── api.ts             # All HTTP + WebSocket API calls
│       │   ├── auth.tsx           # AuthProvider, useAuth hook
│       │   ├── types.ts           # TypeScript interfaces
│       │   ├── queryClient.ts     # TanStack QueryClient singleton
│       │   └── cronToText.ts      # 5-field cron → human readable
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
│           └── postgresql.yaml    # Optional in-cluster PG StatefulSet
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
- **Cron scheduler** that fires scale-down and scale-up operations
- **Static file server** for the embedded Next.js SPA

### 4.1 Entry Point — cmd/server/main.go

`main.go` is the binary's bootstrap sequence. It is intentionally simple, delegating all complexity to the packages it instantiates.

```
main()
  │
  ├─ Read DATABASE_URL from env  ──► log.Fatal if empty
  │
  ├─ store.New(DATABASE_URL)     ──► Opens PostgreSQL, runs AutoMigrate, seeds defaults
  │
  ├─ k8s.New()                   ──► Tries InClusterConfig → kubeconfig fallback
  │   └─ if error: slog.Warn, k8s = nil (k8s operations disabled but server runs)
  │
  ├─ scheduler.New(store, k8s)
  │   └─ if k8s != nil: scheduler.Start()
  │   └─ if k8s == nil: scheduler created but not started (manual trigger blocked)
  │
  ├─ api.NewRouter(store, k8s, scheduler, cache)  ──► Returns http.Handler (Chi mux)
  │
  └─ http.Server{Addr: ":8080", WriteTimeout: 0}
      └─ WriteTimeout=0 is critical: allows WebSocket and SSE to stream indefinitely
      └─ ReadTimeout: 15s, IdleTimeout: 60s
      └─ Graceful shutdown: signal.NotifyContext(SIGINT, SIGTERM), 30s timeout
```

**Why WriteTimeout is zero:** Go's `http.Server` enforces `WriteTimeout` across the entire response, including streaming. Setting it to 0 disables it, which is required for WebSocket connections and the NDJSON admin/reset-db stream. Without this setting, long-running executions (which can take hours) would have their WebSocket connections forcefully closed mid-stream.

**Why k8s = nil is allowed:** The server starts and serves the frontend even if no Kubernetes cluster is reachable. This allows the UI to be accessible for read-only operations (checking history, viewing schedules) even during a cluster incident. Any endpoint that requires the k8s client returns a 503 with a clear error message.

**Structured logging:** The binary uses Go's `log/slog` with the default JSON handler. All log lines include `time`, `level`, `msg`, and context-specific key-value pairs. This is intentional — structured logs integrate directly with log aggregation systems (Loki, CloudWatch, Datadog) without additional parsing.

**Graceful shutdown sequence:**
1. OS sends SIGINT or SIGTERM.
2. `signal.Notify` delivers the signal to a buffered channel; `main` unblocks.
3. `server.Shutdown(ctx)` is called with a 30-second deadline.
4. In-flight HTTP requests are allowed to complete.
5. The scheduler's `Stop()` method halts the cron dispatcher (ongoing scale operations run to completion in their goroutines — they are not force-killed).
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
  2. authmw.RedactWSToken        — strips ?token= from URL before it reaches the logger
  3. middleware.Logger           — structured request log (method, path, status, latency)
  4. middleware.Recoverer        — catches panics, returns 500, logs stack trace
  5. cors.Handler                — sets CORS headers (see below)
  6. middleware.MaxBytesReader(1MB) — protects against large body attacks
```

**CORS policy:**

```go
// In dev (BASIC_AUTH_USER not set):
AllowedOrigins: []string{"*"}

// In production (BASIC_AUTH_USER set):
// If CORS_ALLOWED_ORIGIN is set, restrict to that origin.
// Otherwise, deny all cross-origin requests (same-origin only).
AllowedOrigins: []string{origin}  // or []string{} if CORS_ALLOWED_ORIGIN is unset
```

The wildcard in dev allows the Next.js dev server (typically `localhost:3000`) to call the backend without CORS errors. In production, cross-origin requests are restricted to the value of the `CORS_ALLOWED_ORIGIN` environment variable. If that variable is unset, no cross-origin requests are permitted — the application is same-origin only.

**Route groups:**

```
GET  /healthz                           ← unauthenticated, liveness probe

Group: /  (with BasicAuth middleware)
  ├─ GET  /api/docs            → 302 redirect to /api/docs/
  ├─ GET  /api/docs/openapi.yaml → embedded OpenAPI 3.1 spec (application/yaml)
  ├─ /*   /api/docs/           → Swagger UI (swaggest/swgui v5, embedded assets)
  ├─ /api/schedules           GET, POST
  ├─ /api/schedules/{id}      GET, PUT, DELETE
  ├─ /api/guardrails          GET, PUT
  ├─ /api/executions          GET
  ├─ /api/executions/{id}     GET
  ├─ /api/executions/{id}/logs GET
  ├─ /api/cluster/workloads   GET
  ├─ /api/cluster/nodes       GET
  ├─ /api/cluster/nodes/{node}/pods GET
  ├─ /api/cluster/pods/{ns}/{pod}   GET
  ├─ /api/cluster/workloads/{ns}/{kind}/{name}/pods GET
  ├─ /api/overview            GET  ← pre-aggregated dashboard summary (cache-backed)
  ├─ /api/cluster/stream      GET  ← SSE stream of overview updates (10 s cadence)
  ├─ /api/trigger             POST
  ├─ /api/admin/reset-db      POST
  └─ /ws/executions/{id}/logs GET (WebSocket upgrade)

SPA: everything else → web.SPAHandler (serves index.html for unknown paths)
```

**Why BasicAuth wraps /api/* and /ws/* but not /healthz:**

The `/healthz` endpoint must be reachable by the Kubernetes liveness probe. Kubernetes probes do not send Authorization headers, so if BasicAuth wrapped the health check, the pod would repeatedly fail its liveness probe and be restarted.

### 4.3 API Handlers

#### Schedules (`internal/api/schedules.go`)

**`listSchedules` (GET /api/schedules)**

Fetches all Schedule rows from PostgreSQL ordered by `position asc, id asc`, then for each schedule queries `scheduler.NextRun(id)` to get the next cron fire time. The NextRun is appended to the response JSON as a virtual field. This is a deliberate join-at-application-layer pattern rather than storing NextRun in the database, because it is always derived from the cron expression and cannot become stale.

**`reorderSchedules` (PUT /api/schedules/reorder)**

Accepts `{"type": "scale_down"|"scale_up", "ids": [...]}` and bulk-updates the `position` column for each ID within a single transaction. Only IDs matching the specified type are affected — the `WHERE id = ? AND type = ?` clause silently ignores any mismatched IDs, so it is not possible to cross-contaminate the sleep and wake orderings. Returns the full updated schedule list. The route is registered before `/{id}` in the router so chi does not interpret `"reorder"` as a numeric ID.

**`createSchedule` (POST /api/schedules)**

Validation steps:
1. `name` must be non-empty
2. `type` must be `scale_down` or `scale_up`
3. `cronExpr` is parsed with `robfig/cron/v3`'s `NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)` — a 5-field parser. Any invalid cron expression returns 400.
4. Defaults applied: `timezone = "UTC"`, `mode = "plan"` (safe: new schedules are dry-run by default).
5. Row inserted, then `scheduler.Reload()` is called to pick up the new schedule.
6. Returns 201 Created.

**`updateSchedule` (PUT /api/schedules/{id})**

Uses a `map[string]interface{}` partial-update pattern to only write provided fields. The `type` field is explicitly excluded from the allowed update map — you cannot change a `scale_down` schedule to `scale_up` after creation. This is a safety constraint: changing the type of a schedule would be semantically equivalent to deleting it and creating a new one, which is less confusing. After update, `scheduler.Reload()` is called.

> **GORM zero-value note:** GORM's `Updates(map)` silently skips map values that equal the Go zero value for their type — including `bool(false)`. This means sending `{"enabled": false}` alone would not persist the change. The store layer works around this by collecting the map keys and passing them to `Select(keys)` before `Updates(map)`, which forces GORM to write every specified column regardless of value.

**`deleteSchedule` (DELETE /api/schedules/{id})**

Hard deletes the row. Executions that reference the schedule will show `ScheduleID` with no preloaded `Schedule` (FK nullable in the execution query). After delete, `scheduler.Reload()` removes the cron entry.

#### Executions (`internal/api/executions.go`)

**`listExecutions` (GET /api/executions)**

Query parameters:
- `schedule_id` (uint): filter by schedule
- `status` (string): `running`, `success`, or `failed`
- `page` (int, default 1)
- `page_size` (int, default 20, max 100)

Returns a paginated JSON object:

```json
{
  "items": [...],
  "total": 142,
  "page": 1,
  "pageSize": 20
}
```

Items are ordered by `started_at DESC` (newest first).

**`getExecution` (GET /api/executions/{id})**

Returns a single execution with its associated Schedule preloaded (via GORM `Preload("Schedule")`).

**`getExecutionLogs` (GET /api/executions/{id}/logs)**

Returns all log lines for a completed execution ordered by `seq ASC`. This is used by the History page's log drawer for completed executions. For running executions, the frontend uses the WebSocket endpoint instead.

**`wsExecutionLogs` (GET /ws/executions/{id}/logs)**

This is the most complex handler. Its race-condition-free design is detailed in Section 7 (WebSocket Architecture).

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

Returns a pre-aggregated dashboard summary in one round-trip, replacing the three separate calls (`/cluster/workloads`, `/cluster/nodes`, `/api/schedules`) that the Overview page previously issued. Reads entirely from the `ClusterCache` snapshot and the in-memory scheduler — no K8s or DB I/O on the hot path (only a fast `store.ListSchedules()` for `nextRun`).

Response shape:
```json
{
  "clusterStatus": "awake" | "sleeping" | "partial",
  "runningCount": 42,
  "sleepingCount": 0,
  "nodeCount": 7,
  "sleepingByNs": [{ "namespace": "payments", "count": 3 }],
  "nextRun": { "name": "Weekday Sleep", "nextRun": "2026-03-16T19:05:00Z" },
  "cacheAgeMs": 3241
}
```

**`streamCluster` (GET /api/cluster/stream)**

Server-Sent Events endpoint. On connect, sends the current overview immediately. Then subscribes to `ClusterCache` refresh notifications and pushes a new `data:` event on every cache refresh (~10 s). The frontend uses this to update the Overview card in real time without polling.

Authentication: standard BasicAuth via the Authorization header (regular HTTP fetch, not EventSource, so headers work normally).

**`getNodePods` (GET /api/cluster/nodes/{node}/pods)**

Lists pods on a specific node. For each pod, resolves the owner chain: if a pod is owned by a ReplicaSet, it walks up to find the owning Deployment. This provides a human-readable "workload name" in the node detail drawer. Also calls `GetAllPodMetrics` to populate live CPU/memory usage per pod; degrades gracefully (shows `—`) if the Metrics Server is unavailable or returns a non-200 response.

**`getWorkloadPods` (GET /api/cluster/workloads/{ns}/{kind}/{name}/pods)**

Lists pods belonging to a Deployment or StatefulSet. Same owner-chain resolution and `GetAllPodMetrics` enrichment as `getNodePods`.

**`getPodDetail` (GET /api/cluster/pods/{ns}/{pod})**

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
- `skip_namespaces`
- `skip_ns_node`
- `skip_node_labels`
- `skip_node_taints`

All fields are stored as comma-separated strings in the database. The whitelist prevents callers from updating the `id` or `updated_at` fields directly.

#### Trigger (`internal/api/trigger.go`)

**`trigger` (POST /api/trigger)**

Body:
```json
{
  "scheduleId": 3,
  "mode": "plan"
}
```

Validates `mode` is `"plan"` or `"apply"`, then calls `scheduler.RunNow(scheduleId, mode)`. Returns:
```json
{
  "executionId": 42
}
```
with HTTP 202 Accepted. The execution runs asynchronously in a goroutine; the client can poll or subscribe to WebSocket to observe progress.

#### Admin (`internal/api/admin.go`)

**`resetDB` (POST /api/admin/reset-db)**

This is a destructive operation used for development and testing. It requires:
```json
{"confirm": "RESET DATABASE"}
```

The response is a **streaming NDJSON** (one JSON object per line, flushed immediately). Progress steps:
1. Stop scheduler
2. Drop all tables (Schedule, Guardrails, Execution, LogLine)
3. Run AutoMigrate to recreate schema
4. Seed default data
5. Restart scheduler

Each step emits a `{"step": "...", "status": "ok"}` or `{"step": "...", "status": "error", "message": "..."}` line. The header `X-Accel-Buffering: no` disables nginx's response buffering so the client receives lines in real time.

The frontend uses an async generator (`resetDatabaseStream()`) to iterate over these lines as they arrive, displaying progress in the Settings page UI.

#### Helpers (`internal/api/helpers.go`)

- `jsonOK(w, v)` — marshals v to JSON, sets Content-Type application/json, status 200
- `jsonError(w, status, msg)` — writes `{"error": "msg"}` with given status code
- `parseID(r, param)` — extracts Chi URL param as uint, returns error if not a positive integer
- `splitCSVLocal(s)` — splits comma-separated string into `map[string]bool` for O(1) lookup

### 4.4 Scheduler

The scheduler lives in `internal/scheduler/scheduler.go` and is the heart of the automation. It has two major responsibilities:

1. **Cron management** — wrapping robfig/cron v3 to add, remove, and reload cron entries dynamically.
2. **Pub/sub log broker** — fan-out of log lines from scale operations to all connected WebSocket clients.

#### Scheduler struct

```go
type Scheduler struct {
    cron    *cron.Cron
    entries map[uint]cron.EntryID  // scheduleID → cron entryID
    store   *store.Store
    k8s     *k8s.Client
    broker  *Broker
    mu      sync.Mutex
}
```

**`Start()`** — calls `cron.Start()`. The underlying cron library runs entries in goroutines.

**`Stop()`** — calls `cron.Stop()`, which returns a context that is done when all running jobs finish. The scheduler waits for this context before returning, ensuring no goroutines are orphaned.

**`Reload()`** — the critical hot-reload method. Acquires the mutex, removes all existing cron entries, queries the database for all enabled schedules, and adds each back with a fresh cron entry. This is called after every create/update/delete of a schedule. The CRON_TZ prefix is used for timezone support:

```
CRON_TZ=America/New_York 0 18 * * 1-5
```

robfig/cron v3 parses the `CRON_TZ=` prefix and sets the location on the entry's schedule, so the cron fires at the correct local time regardless of the server's system timezone.

**`NextRun(scheduleID uint) *time.Time`** — looks up the entry ID from the map, asks the cron library for the entry, and returns `entry.Next`. Returns nil if the schedule is not loaded (disabled or not found).

**`RunNow(scheduleID uint, mode string) (uint, error)`** — creates an Execution row and launches `run()` in a goroutine. Returns the execution ID immediately. This is what the trigger endpoint calls.

**`run(scheduleID uint, executionID uint, mode string)`** — the actual execution goroutine:

```
run()
  │
  ├─ Create logCh (chan store.LogLine, buffered 256)
  │
  ├─ goroutine: drain logCh → AppendLogLine (DB) + broker.Publish
  │   └─ WaitGroup to ensure all lines written before FinishExecution
  │
  ├─ Create runner (scaler.Runner{k8s, store})
  │
  ├─ ctx with timeout (schedule.TimeoutMinutes * time.Minute, default 120min)
  │
  ├─ if schedule.Type == "scale_down":
  │     counts, err = runner.RunScaleDown(ctx, schedule, mode, logCh)
  │   else:
  │     counts, err = runner.RunScaleUp(ctx, schedule, mode, logCh)
  │
  ├─ close(logCh)  ← signals drain goroutine to finish
  ├─ wg.Wait()    ← waits for all log lines to be written to DB
  │
  ├─ broker.Close(executionID)  ← signals all WebSocket subscribers that stream is done
  │
  └─ store.FinishExecution(executionID, counts, err)
      └─ sets Status = "success" or "failed"
      └─ sets FinishedAt = now()
      └─ sets CountScaled, CountDrained, CountDeleted, CountSkipped, CountErrors
```

#### Broker struct

```go
type Broker struct {
    mu   sync.Mutex
    subs map[uint][]chan store.LogLine
}
```

**`Subscribe(executionID uint) chan store.LogLine`** — creates a buffered channel of capacity 256, appends it to the subscriber list for that execution ID, returns the channel. The 256-capacity buffer means a slow WebSocket client can absorb bursts without blocking the scaler goroutine.

**`Unsubscribe(executionID uint, ch chan store.LogLine)`** — removes the channel from the subscriber list. Does NOT close the channel here (the reader closes it via `broker.Close`).

**`Publish(executionID uint, line store.LogLine)`** — fan-out under lock:
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

**`Close(executionID uint)`** — closes all subscriber channels for an execution. This causes the `range ch` loop in `wsExecutionLogs` to return, which causes the WebSocket handler to close the connection cleanly.

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
    Scaled   int
    Drained  int
    Deleted  int
    Skipped  int
    Errors   int
}

type Runner struct {
    k8s   *k8s.Client
    store *store.Store
}
```

**Log emission helpers:**
- `emit(ch, level, msg)` — sends a LogLine to the channel
- `info(ch, msg)` — emit with level "info"
- `ok(ch, msg)` — emit with level "success" (green in UI)
- `plan(ch, msg)` — emit with level "plan" (blue in UI, dry-run indicator)
- `errLog(ch, msg)` — emit with level "error"

**`namespaceAllowed(schedule, ns)`** — if `schedule.NamespaceFilter` is empty, all namespaces are allowed. Otherwise only the listed namespaces are processed. This is the per-schedule namespace scope.

**`isApply(mode)`** — returns `mode == "apply"`. All mutating operations are gated on this check.

#### scale_down.go — RunScaleDown

```
RunScaleDown(ctx, schedule, mode, logCh) → (Counts, error)
  │
  ├─ Load guardrails from store
  │
  ├─ skipNS = splitCSV(guardrails.SkipNamespaces)
  │
  ├─ List all Deployments
  │   └─ for each deployment:
  │       ├─ if namespace in skipNS → skip (emit plan/info)
  │       ├─ if !namespaceAllowed(schedule, ns) → skip
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
RunScaleUp(ctx, schedule, mode, logCh) → (Counts, error)
  │
  ├─ Load guardrails
  │
  ├─ List all Deployments
  │   └─ for each deployment:
  │       ├─ if namespace in skipNS → skip
  │       ├─ if !namespaceAllowed(schedule, ns) → skip
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
router = api.NewRouter(st, k8s, sched, cache)
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

**Schedule**
```go
type Schedule struct {
    ID              uint      `gorm:"primarykey"`
    Name            string    `gorm:"not null"`
    Type            string    `gorm:"not null"`          // "scale_down" | "scale_up"
    CronExpr        string    `gorm:"not null"`
    Timezone        string    `gorm:"default:'UTC'"`
    Mode            string    `gorm:"default:'plan'"`    // "plan" | "apply"
    Enabled         bool      `gorm:"default:true"`
    NamespaceFilter string    `gorm:"default:''"`        // CSV, empty = all
    TimeoutMinutes  int       `gorm:"default:120"`
    Position        int       // display order within each type group; lower = higher in list
    CreatedAt       time.Time
    UpdatedAt       time.Time
}
```

**Guardrails**
```go
type Guardrails struct {
    ID             uint      `gorm:"primarykey"`
    SkipNamespaces string    // CSV: "kube-system,monitoring"
    SkipNsNode     string    // CSV: namespaces that protect nodes
    SkipNodeLabels string    // CSV: "key=value" pairs
    SkipNodeTaints string    // CSV: "key=value:effect" pairs
    UpdatedAt      time.Time
}
```

**Execution**
```go
type Execution struct {
    ID           uint       `gorm:"primarykey"`
    ScheduleID   uint       `gorm:"index"`
    Schedule     *Schedule  `gorm:"foreignKey:ScheduleID"`
    StartedAt    time.Time  `gorm:"index"`
    FinishedAt   *time.Time
    Status       string     `gorm:"index"`  // "running" | "success" | "failed"
    Mode         string     // "plan" | "apply"
    CountScaled  int
    CountDrained int
    CountDeleted int
    CountSkipped int
    CountErrors  int
}
```

**LogLine**
```go
type LogLine struct {
    ID          uint      `gorm:"primarykey"`
    ExecutionID uint      `gorm:"index:idx_logline_exec_seq,priority:1"`
    Seq         int       `gorm:"index:idx_logline_exec_seq,priority:2"`
    Level       string
    Message     string
    Timestamp   time.Time
}
```

The composite index `idx_logline_exec_seq` on `(execution_id, seq)` ensures that fetching logs for an execution in order is a single index scan rather than a full table sort.

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
    db.AutoMigrate(&Schedule{}, &Guardrails{}, &Execution{}, &LogLine{})
    // Seed if empty
    SeedDefaults(db)
    return &Store{db: db}, nil
}
```

**Why silent GORM logger:** GORM's default logger prints every SQL statement to stdout. In production, this generates enormous log volume (hundreds of lines per execution). The silent mode suppresses routine queries. Errors are still propagated via return values.

**Connection pool rationale:**
- `MaxOpenConns: 10` — PostgreSQL handles ~100 connections by default; limiting to 10 leaves headroom for other clients and prevents connection exhaustion.
- `MaxIdleConns: 5` — keeps 5 connections warm to avoid connection establishment latency on bursty workloads.
- `ConnMaxLifetime: 5min` — rotates connections to prevent issues with network-level TCP session expiry (common in cloud environments with 5-minute NAT timeouts).

#### Queries (`internal/store/queries.go`)

**SeedDefaults** — runs only if the schedules table is empty. Seeds:
1. "Weekday Sleep" — `scale_down`, `5 19 * * 1-5`, Europe/Budapest, plan mode, disabled
2. "Weekday Wake" — `scale_up`, `0 7 * * 1-5`, Europe/Budapest, plan mode, disabled
3. "Weekend Sleep" — `scale_down`, `0 0 * * 6,0`, Europe/Budapest, plan mode, disabled
4. "Weekend Wake" — `scale_up`, `0 7 * * 1`, Europe/Budapest, plan mode, disabled

And one Guardrails row with sensible defaults:
- `SkipNamespaces`: `kube-system,kube-public,kube-node-lease,kube-phoenix`
- `SkipNsNode`: `kube-system`

**`UpdateSchedule(id, fields map[string]interface{}) error`** — does a partial update via GORM. The field whitelist is enforced in the API handler before calling this function, not here. To avoid GORM silently skipping zero-value booleans (e.g. `enabled=false`), the function collects the map keys and calls `Select(keys).Updates(map)` — the `Select` clause forces GORM to write every specified column regardless of value.

**`AppendLogLine(executionID uint, seq int, level, message string)`** — the `seq` field is a monotonically increasing integer per execution, managed by the caller (scheduler). It is not auto-incremented by the database to avoid a round-trip to determine the next sequence number. The scheduler tracks `seq` as a local variable incremented atomically.

### 4.8 WebSocket Log Broker

This section covers the pub/sub broker in detail. The broker solves the problem of delivering log lines from a scale operation to zero or more WebSocket clients that may connect at any time — including after the operation has started.

**The late-subscriber problem:** If a client connects 10 seconds into an execution, it needs to see all log lines from the beginning, not just new ones. The solution has two parts:
1. All log lines are persisted to the database immediately via `AppendLogLine`.
2. On WebSocket connect, `wsExecutionLogs` sends all existing lines from the DB before subscribing to the broker.

**The race condition:** Between step 1 (send existing lines) and step 2 (subscribe), new lines may be published to the broker and missed. The fix:

```go
// Step 1: Send existing lines
existingLines := store.GetLogLines(executionID)
for _, line := range existingLines {
    sendOverWebSocket(line)
}

// Step 2: Subscribe to broker
ch := broker.Subscribe(executionID)

// Step 3: Re-check status AFTER subscribing
// If status is now "success" or "failed", close the channel from the DB side
// because broker.Close() was already called before we subscribed
currentExecution := store.GetExecution(executionID)
if currentExecution.Status != "running" {
    broker.Unsubscribe(executionID, ch)
    // Send any lines written between step 1 and step 2
    newLines := store.GetLogLines(executionID)[len(existingLines):]
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
var static embed.FS

func SPAHandler() http.Handler {
    sub, _ := fs.Sub(static, "static")
    fileServer := http.FileServer(http.FS(sub))

    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Try to serve the requested path
        f, err := sub.Open(strings.TrimPrefix(r.URL.Path, "/"))
        if err != nil {
            // Path not found: serve index.html (SPA client-side routing)
            r = r.WithContext(r.Context())
            r.URL.Path = "/"
            fileServer.ServeHTTP(w, r)
            return
        }
        f.Close()
        fileServer.ServeHTTP(w, r)
    })
}
```

The `//go:embed all:static` directive embeds the entire `web/static/` directory into the binary at compile time. The `all:` prefix includes hidden files (dotfiles). At build time, the Dockerfile copies `frontend/out/` (Next.js static export output) to `backend/web/static/` before running `go build`.

The SPA handler serves actual files when they exist (JS chunks, CSS, images) and falls back to `index.html` for all other paths. This is required for Next.js client-side routing: when a user navigates directly to `/history/` or bookmarks `/cluster/`, the browser requests that path from the server, which must return `index.html` so React can boot and take over routing.

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
| success.main       | #22C55E | #22C55E | Success chips, status indicators     |
| warning.main       | #F59E0B | #F59E0B | Apply mode indicators, wake icons    |
| error.main         | #EF4444 | #EF4444 | Error chips, delete actions          |
| info.main          | #3B82F6 | #3B82F6 | Running status chips                 |

The `divider` token is computed from the mode: `rgba(255,255,255,0.07)` in dark, `rgba(0,0,0,0.09)` in light. All component borders use this token — **never hardcoded RGBA**.

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

`frontend/src/lib/auth.tsx` implements a React context-based authentication system.

**Storage:** `sessionStorage` (not `localStorage`). The key is `kube-phoenix-auth`. sessionStorage is scoped to the browser tab and is cleared when the tab is closed. This is intentional: credentials should not persist across browser sessions.

**Credential format:** `btoa(username + ':' + password)` — standard Base64 encoding of the HTTP Basic Auth `user:pass` string. Stored directly as the value that goes into the `Authorization: Basic <value>` header.

**Dev-mode detection:** On mount, `AuthProvider` fires a probe request to `/api/schedules` with no credentials. If the server returns 200 (because `BASIC_AUTH_USER` is unset), auth is in dev mode. The token is set to the sentinel value `__no_auth__`. The login screen is bypassed entirely.

**Login flow:**
1. User enters username and password in `LoginScreen`.
2. `login(user, pass)` function:
   a. Computes `token = btoa(user + ':' + pass)`.
   b. Makes a probe request to `/api/schedules` with `Authorization: Basic <token>`.
   c. If 200: stores token in sessionStorage, updates context state.
   d. If 401: throws an error, `LoginScreen` displays it.

**Auth header injection:** `getAuthHeader()` reads the token from sessionStorage at call time (not cached in closure). Returns `{}` if token is `__no_auth__` (dev mode, server ignores auth). Returns `{ Authorization: 'Basic <token>' }` otherwise.

**Logout:** Clears sessionStorage and resets context state to unauthenticated. The login screen re-renders.

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
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader(),
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
- All requests include the auth header.
- All non-2xx responses throw a consistent `Error` that TanStack Query's `onError` handlers can display.

**`wsLogsUrl(executionId)` — WebSocket URL construction:**
```ts
function wsLogsUrl(executionId: number): string {
    const base = (process.env.NEXT_PUBLIC_API_URL ?? window.location.origin)
        .replace(/^http/, 'ws')  // http: → ws:, https: → wss:

    const token = sessionStorage.getItem(STORAGE_KEY)
    const params = token && token !== '__no_auth__'
        ? `?token=${encodeURIComponent(token)}`
        : ''

    return `${base}/ws/executions/${executionId}/logs${params}`
}
```

Browsers cannot set the `Authorization` header on WebSocket connections (this is a browser security restriction, not an application-layer limit). The backend accepts credentials via `?token=<base64(user:pass)>` as an alternative, which is what this function produces.

**`resetDatabaseStream()` — async generator:**
```ts
async function* resetDatabaseStream(): AsyncGenerator<{step: string, status: string, message?: string}> {
    const res = await fetch(BASE + '/api/admin/reset-db', {
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
| `/`           | `page.tsx`      | Redirect to `/overview/`                      |
| `/overview/`  | `OverviewPage`  | Dashboard with status cards and activity feed |
| `/cluster/`   | `ClusterPage`   | Workloads table + Nodes table with drawers    |
| `/guardrails/` | `GuardrailsPage` | Exclusion list form                          |
| `/schedules/` | `SchedulesPage` | Schedule cards + create/edit dialog           |
| `/history/`   | `HistoryPage`   | Execution table + log drawer                  |
| `/settings/`  | `SettingsPage`  | DB reset panel                                |

**Key components:**

**`AppShell`** — responsible for the two-column layout (sidebar + content). Renders a `<AppBar>` for mobile with a hamburger menu button. Uses MUI `Drawer` in two configurations: permanent (desktop, `md+`) and temporary (mobile, slides in over content). The sidebar width is defined as a constant (240px) and passed as a prop.

**`Sidebar`** — navigation list with active state detection using `usePathname()`. Active items receive a primary-tinted background computed via MUI's `alpha(primary.main, 0.10)` — mode-aware and responsive to the actual primary color — and the primary color for text and icon. The logout button is pushed to the bottom using a flex spacer.

**`ClusterStatusCard`** — polls `getWorkloads()` every 30 seconds. Shows aggregate counts: total workloads, sleeping workloads, partial (waking). Uses a MUI `LinearProgress` to show the sleeping percentage.

**`NextRunCard`** — polls `getSchedules()` every 30 seconds. Sorts schedules by `nextRun` and renders each with a two-line next-run display:
- **Absolute time** (dimmed caption): locale-aware label derived from the schedule's own timezone — `today at 07:00`, `tomorrow at 07:00`, `Mon at 07:00`, or `Mar 15 at 07:00` depending on how far out the run is.
- **Relative countdown** (bold, color-coded): `in Xm`, `in Xh Ym`, `in Xd Yh`. Color shifts from schedule-type tint (>6 h) → `warning.main` (1–6 h) → `error.light` (<1 h). A pulsing red dot appears alongside the countdown when under one hour.

**`ActivityFeed`** — polls `getExecutions({ pageSize: 5 })` every 15 seconds. Shows the 5 most recent executions. Clicking a running execution opens `LogViewer` inline (WebSocket). Clicking a completed execution navigates to `/history?exec=<id>`.

**`WorkloadsTable`** — renders a MUI `Table` with rows for each workload. Clicking a row opens `WorkloadDetailDrawer`. Sleeping workloads show a moon icon; running show a checkmark. `partial` state shows a warning.

**`NodesTable`** — renders nodes with pod count, CPU/memory requests, and a protection badge. Clicking a row opens `NodeDetailDrawer`.

**`NodeDetailDrawer`** — MUI `Drawer` (right side, 480px). Shows node conditions, capacity, labels, taints, and a list of pods running on the node. Each pod is clickable, opening `PodDetailDrawer`.

**`PodDetailDrawer`** / **`PodDetailContent`** — shows container statuses, resource requests, conditions, events, and live metrics. Metrics are shown with MUI `LinearProgress` bars (CPU and memory usage vs requested).

**`ScheduleCard`** — displays a single schedule with type icon (moon/sun), cron expression rendered by `cronToText()`, mode badge, and an enabled toggle. The toggle uses an optimistic update — it flips immediately in local state via `useState`, fires `PUT /api/schedules/:id` with `{ enabled: <new value> }`, and reverts on error. Has edit and delete actions. The run button opens a mode selection dialog before calling the trigger API.

**`ScheduleDialog`** — form for creating or editing a schedule. Fields: name, type (toggle), cron timing (via `CronBuilder`), timezone, namespace filter, mode (toggle), enabled (switch). Validates cron via `isValidCron()` before enabling the save button.

**`CronBuilder`** — replaces the plain cron text input with a point-and-click builder. Visual mode shows a day-of-week chip row (Mon–Sun) and hour/minute dropdowns, with a live human-readable preview powered by `cronToText()`. An "Advanced raw cron" toggle in the header row swaps the picker for a raw 5-field text field (pre-seeded from the current visual state) and hides the preview. On open, existing cron expressions are parsed back into visual state if representable (fixed minute from the allowed set, `*` for dom and month); otherwise the dialog opens in advanced mode. Emits the cron string upward via `onChange` on every change.

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
| `['executions', 'feed']`     | 14s       | 15s             | Activity feed needs to be timely                                     |
| `['schedules']`              | 60s       | 60s             | Schedules rarely change; used only by trigger buttons on Overview    |
| `['guardrails']`             | —         | —               | Only refetch on mutation                                             |
| `['executions', id, 'logs']` | —         | —               | Uses WebSocket instead                                               |

The `['overview']` query is primarily kept fresh by the SSE stream (`/api/cluster/stream`) via `queryClient.setQueryData`. The `refetchInterval: 30_000` acts as a reconnect fallback if the SSE connection drops. With `staleTime: 25_000`, navigating away from and back to the Overview page renders the cached data instantly without a loading skeleton.

**SSE stream (`useClusterStream` hook in `ClusterStatusCard.tsx`):**

Opens a persistent `fetch` connection to `/api/cluster/stream`. On each `data:` line received, parses the JSON and calls `queryClient.setQueryData(['overview'], data)`, which triggers a React re-render with the latest cluster state. Reconnects automatically after errors with a 3 s backoff (5 s if the response itself was not OK).

**Mutation invalidation:** After every mutation (create/update/delete schedule, save guardrails), the mutation's `onSuccess` callback calls `queryClient.invalidateQueries` with the relevant query key. This triggers an immediate re-fetch and keeps the UI in sync.

### 5.7 WebSocket Integration in the Frontend

`LogViewer.tsx` manages the WebSocket lifecycle:

```ts
useEffect(() => {
    if (!execution || execution.status !== 'running') return

    const url = wsLogsUrl(execution.id)
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

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         PostgreSQL Schema                                │
└──────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────┐         ┌──────────────────────────────────────┐
│        schedules         │         │              executions               │
├─────────────────────────┤         ├──────────────────────────────────────┤
│ id             BIGINT PK │◄────────│ id              BIGINT PK            │
│ name           TEXT      │    1:N  │ schedule_id     BIGINT FK(schedules) │
│ type           TEXT      │         │ started_at      TIMESTAMPTZ  IDX     │
│ cron_expr      TEXT      │         │ finished_at     TIMESTAMPTZ  NULL    │
│ timezone       TEXT      │         │ status          TEXT         IDX     │
│ mode           TEXT      │         │ mode            TEXT                 │
│ enabled        BOOLEAN   │         │ count_scaled    INT                  │
│ namespace_filter TEXT    │         │ count_drained   INT                  │
│ timeout_minutes  INT     │         │ count_deleted   INT                  │
│ created_at     TIMESTAMPTZ│        │ count_skipped   INT                  │
│ updated_at     TIMESTAMPTZ│        │ count_errors    INT                  │
└─────────────────────────┘         └──────────────────────────────────────┘
                                                        │ 1
                                                        │
                                                        │ N
                                     ┌──────────────────────────────────────┐
                                     │              log_lines               │
                                     ├──────────────────────────────────────┤
                                     │ id             BIGINT PK             │
                                     │ execution_id   BIGINT FK(executions) │
                                     │ seq            INT   ─┐              │
                                     │ level          TEXT   │ COMPOSITE    │
                                     │ message        TEXT   │ INDEX        │
                                     │ timestamp      TIMESTAMPTZ ─┘        │
                                     └──────────────────────────────────────┘

┌─────────────────────────┐
│        guardrails        │
├─────────────────────────┤
│ id               BIGINT PK  (always 1)                                   │
│ skip_namespaces  TEXT    (CSV)                                            │
│ skip_ns_node     TEXT    (CSV)                                            │
│ skip_node_labels TEXT    (CSV, key=value pairs)                          │
│ skip_node_taints TEXT    (CSV, key=value:effect pairs)                   │
│ updated_at       TIMESTAMPTZ                                             │
└─────────────────────────┘
```

**Why CSV strings instead of normalized tables:**

Guardrail values are small lists (typically < 20 entries) that are always read and written as a whole. Normalizing them into a separate table (e.g., `guardrail_namespaces`) would add JOINs, migrations, and complexity without any benefit. The CSV approach is simpler and the data volume does not warrant normalization.

**Why `FinishedAt` is nullable:**

An execution that is currently `running` has not finished. A nullable `FinishedAt` is the natural representation of this state. PostgreSQL allows nullable timestamptz columns.

**Why LogLine uses a `seq` field instead of relying on `id`:**

Database auto-increment IDs are not guaranteed to be in insertion order under concurrent writes (PostgreSQL sequences allocate in order, but transactions can commit out of order). A `seq` field managed by the application ensures strict ordering within an execution.

---

## 7. WebSocket Architecture

```
Browser                    Go HTTP Handler                 Broker            Scaler
   │                              │                           │                  │
   │── GET /ws/executions/42/logs ─►│                          │                  │
   │                              │── Upgrade to WebSocket ──►│                  │
   │                              │                           │                  │
   │                              │── GetLogLines(42) ───────► DB               │
   │                              │◄── existing lines ─────── DB               │
   │◄── send existing lines ──────│                           │                  │
   │                              │                           │                  │
   │                              │── Subscribe(42) ─────────►│                  │
   │                              │                           │                  │
   │                              │── GetExecution(42) status check             │
   │                              │   if status != "running": unsubscribe, send │
   │                              │   any lines written in the gap, close       │
   │                              │                           │                  │
   │                              │                           │◄─ Publish(line) ─│
   │◄── send line ────────────────│◄── ch <- line ────────────│                  │
   │                              │                           │◄─ Publish(line) ─│
   │◄── send line ────────────────│◄── ch <- line ────────────│                  │
   │                              │                           │                  │
   │                              │  [ping ticker 30s]        │                  │
   │◄── Ping frame ───────────────│                           │                  │
   │── Pong frame ───────────────►│                           │                  │
   │                              │                           │                  │
   │                              │                           │◄─ Close(42) ─────│ (scaler done)
   │                              │◄── ch closed ─────────────│                  │
   │◄── WebSocket close (1000) ───│                           │                  │
   │                              │                           │                  │
```

**Concurrent WebSocket clients:** Multiple browser tabs can watch the same execution simultaneously. Each call to `broker.Subscribe(42)` creates a separate buffered channel. The broker fans out each log line to all subscriber channels independently. Slow clients receive lines at their own pace and are never blocked by other subscribers.

**Slow client protection:** The subscriber channel has capacity 256. If a subscriber falls more than 256 lines behind (e.g., network congestion), new publishes use `select/default` to skip the full channel, logging a warning. The slow client continues to receive lines; it just misses lines during the overflow period. This is an intentional trade-off: never blocking the scaler for a slow UI client.

**WebSocket vs Server-Sent Events:** WebSocket was chosen over SSE because:
1. It supports bidirectional communication (ping/pong).
2. It works through the same HTTP/1.1 connection without needing `Transfer-Encoding: chunked` special handling in all proxies.
3. The WebSocket library (`gorilla/websocket`) provides robust framing, masking, and connection management.
4. Authentication via `?token=` query param is straightforward with WebSocket.

---

## 8. Authentication Architecture

```
  ┌────────────────────────────────────────────────────────────────────┐
  │                     Authentication Decision Tree                   │
  └────────────────────────────────────────────────────────────────────┘

  Server startup:
    BASIC_AUTH_USER set?
      NO  → middleware returns next(handler) immediately (dev mode)
            logs: "basic-auth: credentials not configured — authentication disabled"
      YES → middleware active for all /api/* and /ws/* routes

  Request arrives at middleware:
    Is it a WebSocket upgrade? (Upgrade: websocket header)
      YES → check ?token=<base64(user:pass)> query param
              → base64 decode → split on ':' → extract user/pass
      NO  → check Authorization: Basic <base64(user:pass)> header

    Credentials extracted?
      NO  → 401 Unauthorized + WWW-Authenticate: Basic realm="kube-phoenix"
      YES → crypto/subtle.ConstantTimeCompare(user, BASIC_AUTH_USER)
                                 AND
            crypto/subtle.ConstantTimeCompare(pass, BASIC_AUTH_PASSWORD)
              Both equal? YES → next(handler)
                          NO  → 401 Unauthorized + log warning
```

**Why `crypto/subtle.ConstantTimeCompare`:** Regular string comparison (`==`) in Go short-circuits on the first mismatched byte. This creates a timing oracle: an attacker making thousands of requests can measure response times to discover the correct credentials byte by byte. `ConstantTimeCompare` always takes the same time regardless of where the mismatch occurs, eliminating the timing oracle.

**Frontend authentication flow:**

```
Browser                             Frontend                       Backend
   │                                    │                              │
   │── Open app ──────────────────────►│                              │
   │                                    │── probe GET /api/schedules ─►│
   │                                    │   (no Authorization header)  │
   │                                    │◄── 200 OK (dev mode) ─────────│
   │                                    │   token = "__no_auth__"       │
   │◄── render app directly ────────────│                              │
   │
   │   OR
   │
   │                                    │◄── 401 Unauthorized ──────────│
   │◄── render <LoginScreen> ───────────│                              │
   │                                    │                              │
   │── enter credentials ─────────────►│                              │
   │                                    │── probe GET /api/schedules ─►│
   │                                    │   Authorization: Basic ...    │
   │                                    │◄── 200 OK ─────────────────────│
   │                                    │   store token in sessionStorage│
   │◄── render app ─────────────────────│                              │
```

**Security considerations:**

1. **HTTP Basic Auth is not secure over plain HTTP.** In production, the application MUST be deployed behind HTTPS (enforced by the Ingress or ALB). The Helm chart's ingress template includes TLS configuration.

2. **sessionStorage vs localStorage:** sessionStorage credentials are cleared when the browser tab closes, preventing credential theft from shared computers. localStorage credentials persist indefinitely, which is inappropriate for admin credentials.

3. **Future: Keycloak OIDC.** The `middleware/auth.go` comment explicitly notes: "When Keycloak OIDC is integrated later, replace this middleware with an OIDC handler while keeping the same middleware slot in the router." The design was built with this swap in mind — auth is centralized in one middleware, not scattered across handlers.

---

## 9. Scale-Down / Scale-Up Flows

### Scale-Down Sequence

```
Trigger (cron or manual)
         │
         ▼
scheduler.run(scheduleID, executionID, "scale_down", mode)
         │
         ├─ Create Execution record (status=running)
         │
         ▼
scaler.RunScaleDown(ctx, schedule, mode, logCh)
         │
         ├─ Phase 1: Workloads
         │    ├─ List all Deployments
         │    │    for each:
         │    │      skip if: namespace in guardrails.SkipNamespaces
         │    │      skip if: namespace not in schedule.NamespaceFilter (if set)
         │    │      skip if: annotation "previous-replicas" already exists
         │    │      plan mode: log intent, counts.Skipped++
         │    │      apply mode:
         │    │        1. Annotate: previous-replicas = current replicas count
         │    │        2. Scale to 0
         │    │        3. counts.Scaled++
         │    │
         │    └─ Same for StatefulSets
         │
         ├─ Phase 2: Node Drain
         │    ├─ List all Nodes
         │    ├─ List all Pods (all namespaces)
         │    ├─ Build criticalNodes: node → bool (has pod in SkipNsNode)
         │    ├─ Build podCountPerNode: node → int (non-DaemonSet pods)
         │    │
         │    for each node:
         │      protected? (label match OR taint match OR critical namespace)
         │        YES → skip, counts.Skipped++
         │        NO  →
         │          drainTimeout = (podCount * 15 + 60) seconds
         │          plan mode: log intent
         │          apply mode:
         │            1. CordonNode (set Unschedulable=true)
         │            2. DrainNode (evict all non-DaemonSet pods, wait, fallback delete)
         │            3. DeleteNode (remove node object from API server)
         │            4. counts.Drained++
         │
         └─ Return Counts
                  │
                  ▼
         scheduler: close logCh, wait for drain goroutine
                  │
                  ▼
         broker.Close(executionID) → WebSocket subscribers see end of stream
                  │
                  ▼
         store.FinishExecution(executionID, counts, err)
              status = "success" or "failed"
              finished_at = now()
```

### Scale-Up Sequence

```
Trigger (cron or manual)
         │
         ▼
scheduler.run(scheduleID, executionID, "scale_up", mode)
         │
         ├─ Create Execution record (status=running)
         │
         ▼
scaler.RunScaleUp(ctx, schedule, mode, logCh)
         │
         ├─ Phase 1: Workloads (ONLY — no node operations)
         │    ├─ List all Deployments
         │    │    for each:
         │    │      skip if: namespace in guardrails.SkipNamespaces
         │    │      skip if: namespace not in schedule.NamespaceFilter (if set)
         │    │      skip if: annotation "previous-replicas" NOT present
         │    │      plan mode: log intent
         │    │      apply mode:
         │    │        1. Read savedReplicas from annotation
         │    │        2. Scale deployment to savedReplicas
         │    │        3. Remove annotation (cleanup)
         │    │        4. counts.Scaled++
         │    │
         │    └─ Same for StatefulSets
         │
         └─ Return Counts
                  │
                  ▼
         After scale-up, pods become Pending (no nodes yet)
         Karpenter detects unschedulable pods → provisions new nodes
         New nodes join cluster → pods scheduled → Running
```

### Plan vs Apply Mode

Every mutating operation is guarded by `isApply(mode)`. When `mode == "plan"`:
- All Kubernetes API calls that would modify state are skipped.
- Log lines with level "plan" describe what WOULD happen.
- Counts are still incremented (so the UI shows "would scale 12 deployments").
- The execution is recorded in the database with `mode = "plan"`.

This provides a safe preview before committing to a live scale operation. All schedules default to `mode = "plan"` at creation. An administrator must explicitly change to `mode = "apply"` to enable live operations.

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
    ├── secret.yaml            # DATABASE_URL, BASIC_AUTH_USER, BASIC_AUTH_PASSWORD
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
| `replicasets`        | get, list                                | Owner chain resolution for pod display  |
| `namespaces`         | list                                     | Namespace listing for UI                |
| `events`             | get, list                                | Pod events for detail drawer            |

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
  - name: BASIC_AUTH_USER
    valueFrom:
      secretKeyRef:
        name: {{ secretName }}
        key: BASIC_AUTH_USER
  - name: BASIC_AUTH_PASSWORD
    valueFrom:
      secretKeyRef:
        name: {{ secretName }}
        key: BASIC_AUTH_PASSWORD
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
3. A `StatefulSet` with a single PostgreSQL 16 replica and a `PersistentVolumeClaim` for data.

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
  - setup-node@v4 (node 24)
  - npm ci
  - npm audit --audit-level=high   (fail on high/critical CVEs in prod deps)
  - npm run build                  (Next.js static export → out/)
```

**Job: backend**
```
steps:
  - checkout
  - setup-go@v5 (go 1.26)
  - cp ../openapi.yaml internal/docs/openapi.yaml   (seed go:embed path — see note below)
  - diff ../openapi.yaml internal/docs/openapi.yaml (assert files are identical; fails build on drift)
  - go mod download
  - go vet ./...
  - go test -coverprofile=coverage.out ./...
  - go tool cover -func=coverage.out
  - go build ./...
  - govulncheck ./...          (checks actual call graph against Go vuln DB)
  - golangci-lint-action@v7    (gosec for SAST, errcheck, staticcheck, etc.)
```

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

**Job: secrets** (push and PR — scans the diff only, not the full repo)
```
steps:
  - checkout (full history, fetch-depth: 0)
  - trufflesecurity/trufflehog
      base: HEAD~1 (push) or PR base SHA (PR)
      head: HEAD   (push) or PR head SHA (PR)
      extra_args: --only-verified    (eliminates false positives)
```

On direct pushes, scans `HEAD~1..HEAD`. On PRs, scans the full PR diff. The `--only-verified` flag means TruffleHog only reports secrets it can actively verify against the upstream service — no noise from test fixtures or example configs.

---

### security.yml — Dedicated Security Scanning

Triggered on: `push` to `master`; `pull_request` targeting `master`; weekly schedule (Monday 06:00 UTC). No path filter — always runs on every push/PR to ensure security coverage is never skipped.

**Job: govulncheck**
```
steps:
  - checkout
  - setup-go@v5 (go 1.26)
  - cp ../openapi.yaml internal/docs/openapi.yaml
  - govulncheck ./...          (checks actual call graph against Go vuln DB)
```

**Job: npm-audit**
```
steps:
  - checkout
  - setup-node@v4 (node 24)
  - npm ci
  - npm audit --audit-level=high --omit=dev
```

**Job: trivy-image** (builds the Docker image locally and scans it)
```
steps:
  - checkout
  - docker build -t kube-phoenix:scan .
  - aquasecurity/trivy-action
      image-ref: kube-phoenix:scan
      severity: CRITICAL,HIGH
      exit-code: 1
      format: sarif → upload to GitHub Security tab
```

Builds and scans the image on every PR — catching vulnerabilities before merge rather than after release.

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

**Job: secrets** (identical to the secret scan in ci.yml — duplicated here so the security workflow is self-contained)
```
steps:
  - checkout (full history, fetch-depth: 0)
  - trufflesecurity/trufflehog
      base: HEAD~1 (push) or PR base SHA (PR)
      head: HEAD   (push) or PR head SHA (PR)
      extra_args: --only-verified
```

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
| Node.js | 22.x | Required for frontend |
| Go | 1.25+ | Required for backend |
| Docker | Latest | For container builds |
| kubectl | Latest | For k8s interaction |
| helm | 4.x | For Helm operations |
| PostgreSQL | 16+ | Local database |

> **Note:** Go is not installed on the project maintainer's machine at the time of writing. Backend changes must be built in CI or via Docker.

### Environment setup

**Backend environment variables:**

```bash
export DATABASE_URL="postgres://kube_phoenix:password@localhost:5432/kube_phoenix?sslmode=disable"
# Optional: set these to enable auth in dev
export BASIC_AUTH_USER="admin"
export BASIC_AUTH_PASSWORD="password"
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

Without a kubeconfig, the backend starts with `k8s = nil` (warning logged). All endpoints that don't require k8s (schedules, guardrails, history) continue to work.

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

**Changing the cron schedule logic:**
1. Modify `internal/scaler/scale_down.go` or `scale_up.go`.
2. Update the seed data in `internal/store/queries.go` if default schedules change.

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

### 13.7 Blocking cron (no concurrent runs)

**Decision:** robfig/cron v3 does not prevent concurrent execution by default. The scheduler does not implement a distributed lock.

**Current behavior:** If a scale operation is running when the cron fires again (e.g., a 2-hour execution that overlaps with the next day's schedule), a second execution will start. This is a known gap.

**Why accepted:** The default schedule cadence (once daily) and the 2-hour timeout make overlap extremely unlikely in practice. A distributed lock (Redis, PostgreSQL advisory lock) adds significant complexity for a rare edge case.

**Future fix:** Check `store.ListExecutions` for status=running before starting a new execution, returning early if one is already in progress.

### 13.8 HTTP Basic Auth with WebSocket token fallback

**Decision:** HTTP Basic Auth as the sole authentication mechanism, with a `?token=base64(user:pass)` fallback for WebSocket connections.

**Why:** Basic Auth is the simplest possible auth mechanism to implement and understand. It requires no state (no session store, no token management). The `?token=` fallback is required because browsers cannot set the `Authorization` header on WebSocket connections — this is a browser security restriction per the WebSocket specification.

**Security note:** The token appears in server access logs (as part of the URL query string). This is acceptable because: (a) the connection is HTTPS, so it's not visible in transit; (b) server logs should be access-controlled. For higher security, a short-lived signed token could be issued for WebSocket connections, but this adds significant complexity.

**Future:** The middleware slot in `router.go` is designed to be replaced with OIDC/Keycloak. The comment in `auth.go` explicitly documents this intent.

### 13.9 Pub/sub broker in-process (no Redis)

**Decision:** The log broker is implemented as an in-process Go struct with mutex and channels.

**Why:** The application is a single-replica deployment (it's a cluster management tool, not a horizontally scaled service). There is no need for a distributed pub/sub system. An in-process broker is faster (no network hop), simpler (no Redis dependency), and sufficient for the load pattern (one active execution at a time, a handful of WebSocket subscribers).

**Trade-off:** If the application is ever scaled to multiple replicas, the broker would not work across replicas (a client connected to replica A would not receive log lines from a scale operation running on replica B). At that point, a Redis pub/sub or NATS replacement would be needed.

### 13.10 Plan mode as default for all schedules

**Decision:** All schedules default to `mode: "plan"` at creation, including seeds.

**Why:** The scaler has real consequences — zeroing out all production deployments is a serious operation. Making plan mode the default means a newly created or freshly installed schedule cannot accidentally perform live operations. An administrator must consciously change to `mode: "apply"`.

**User experience:** The plan mode shows exactly what would happen (which workloads would be scaled, which nodes would be drained) without any risk. This allows teams to validate their schedule and guardrails configuration before enabling live mode.

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

The endpoint is registered outside the `BasicAuth` middleware group alongside `/healthz`, so it is always reachable by in-cluster scrapers without credentials.

### 14.2 Metrics reference

All metrics use the `kube_phoenix_` namespace prefix.

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `kube_phoenix_executions_total` | Counter | `status`, `mode`, `schedule_type` | Total completed executions. `status` is `success` or `failed`. `mode` is `plan` or `apply`. `schedule_type` is `scale_down` or `scale_up`. |
| `kube_phoenix_execution_duration_seconds` | Histogram | `mode`, `schedule_type`, `status` | Wall-clock duration of each execution in seconds. Buckets: 5, 15, 30, 60, 120, 300, 600, 1800. |
| `kube_phoenix_workloads_scaled_total` | Counter | `direction` | Workloads (Deployments + StatefulSets) scaled. `direction` is `down` or `up`. |
| `kube_phoenix_nodes_drained_total` | Counter | — | Nodes drained during scale-down executions (apply mode only). |
| `kube_phoenix_nodes_deleted_total` | Counter | — | Nodes deleted during scale-down executions (apply mode only). |
| `kube_phoenix_active_schedules` | Gauge | `schedule_type`, `mode` | Number of enabled schedules, reset and recomputed on every scheduler reload. |

In addition to these business metrics, the standard `prometheus/client_golang` process and Go runtime collectors are registered automatically:
- `go_*` — goroutines, GC duration, memory stats
- `process_*` — CPU time, open file descriptors, resident memory

### 14.3 Implementation

**Package:** `backend/internal/metrics/metrics.go`

All metrics are declared as package-level variables using `promauto`, which registers them with the default Prometheus registry at init time. No explicit `Register()` call is needed.

**Instrumentation points:**

| Location | What is recorded |
|----------|-----------------|
| `scheduler.go` `run()` goroutine (on completion) | `ExecutionsTotal`, `ExecutionDuration`, `WorkloadsScaledTotal`, `NodesDrainedTotal`, `NodesDeletedTotal` |
| `scheduler.go` `reload()` | `ActiveSchedules` — reset and recount on every cron reload |

**Router registration** (`api/router.go`):

```go
// Outside the BasicAuth group — no credentials required
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

# Total workloads scaled down this week
increase(kube_phoenix_workloads_scaled_total{direction="down"}[7d])

# Currently enabled schedules by type
kube_phoenix_active_schedules
```

---

*End of ARCHITECTURE.md*
*Document covers: 2 source code languages, 30+ source files, 4 database models, 20+ API routes, 6 frontend pages, 25+ React components, 3-stage Docker build, Helm chart with 10 templates, 3 GitHub Actions workflows.*
