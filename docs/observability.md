# Observability Center

## Overview

The Observability Center provides real-time system monitoring for operators and SREs running kube-phoenix in production. It is accessible at `/observability` in the web UI.

The page offers two complementary views:

- **Metrics Dashboard** -- Quantitative monitoring with live metric panels, a system overview card, configurable thresholds, and a live API call feed. Designed for at-a-glance health assessment and threshold-based alerting during sleep/wake operations.
- **API Rivers** -- A visual topology of the 15 Go backend components with animated particle flows proportional to real-time traffic. Designed for understanding request flow, identifying bottlenecks, and tracing dependency chains.

Both views share the same SSE data stream (`GET /api/observability/stream`), keeping all visualizations in sync without additional backend load. See [api.md](api.md) for endpoint details and [configuration.md](configuration.md) for threshold tuning.

---

## Metrics Dashboard

### Status Header

The header displays a live clock, system health indicator, and four KPI cards: throughput (with inline sparkline), P99 latency, DB pool utilization, and error rate. A freshness indicator shows time since the last SSE event. A time range selector allows switching between `1m`, `5m`, `15m`, `1h`, `6h`, `1d`, and `3d` windows.

### System Overview

A compact hero card with five sections:

| Section | Content |
| :------ | :------ |
| Request Flow | Distribution bar showing request breakdown across components |
| Latency Breakdown | Horizontal bars for P50, P95, and P99 latency |
| Component Health | 8-component grid with status indicators (ok/warn/crit) |
| Error Summary | Aggregated error counts (HTTP 5xx, scheduler panics, audit drops, rate limit hits) |
| Scheduler Health | Progress ring with current tick duration |

### Metric Panels

Six panels, each showing a live value, delta percentage, chart, threshold indicators (`WARN`/`CRIT`), min/max range, and inline legends for multiline charts. Click any panel to expand it fullscreen.

| Panel | Description | Unit |
| :---- | :---------- | :--- |
| HTTP Request Rate | Inbound requests per second | req/s |
| HTTP Latency | Response time distribution (P50, P95, P99) | ms |
| K8s API Calls | Calls to the Kubernetes API per minute (GET, PATCH, DELETE) | calls/min |
| WebSocket Connections | Active WebSocket connection count | connections |
| Pod Scale Operations | Scale-up and scale-down events | count |
| Error Rate | Errors per second across all components | errors/s |

### Live API Call Feed

A real-time table of HTTP requests flowing through the Chi router. Each row displays:

- Relative timestamp
- Method badge (GET, POST, PUT, DELETE)
- Route path
- HTTP status code
- Go function name (e.g., `h.listPolicies`)
- Component chip (e.g., `auth`, `handlers`)
- Duration bar

**Features:**
- Full-text search across path, function name, and component
- Category filtering by component
- Stream/grouped toggle (live stream vs. grouped by route)
- Expandable row detail with full request metadata and copy-as-cURL
- Auto-scroll with manual scroll lock

**Route mapping:** The Call Recorder maps 49 route patterns to their corresponding Go handler functions and backend components. Routes span auth (9), cluster (8), guardrails (2), policies (9), executions (4), exceptions (5), audit (1), users (4), admin (2), observability (4), and version (1).

**Skipped routes:** Five routes are excluded from recording because they are either long-lived streaming connections (where duration grows indefinitely) or infrastructure endpoints:

| Route | Reason |
| :---- | :----- |
| `/api/cluster/stream` | SSE streaming endpoint |
| `/api/observability/stream` | SSE streaming endpoint |
| `/healthz` | Infrastructure health check |
| `/metrics` | Prometheus scrape endpoint |
| `/*` | Static file serving (SPA) |

### Error Timeline

A horizontal timeline strip plotting incident events over an error rate area chart.

### Configurable Thresholds

Each metric panel has configurable warn/crit thresholds stored in the database via the `observability_thresholds` table. Defaults are seeded on first startup by `SeedDefaultThresholds()`. Thresholds can be updated at runtime via `PUT /api/observability/thresholds`.

| Panel Key | Panel | Default Warn | Default Crit |
| :-------- | :---- | :----------- | :----------- |
| `http_rate` | HTTP Request Rate | 150 req/s | 200 req/s |
| `latency_p99` | P99 Latency | 500 ms | 1000 ms |
| `k8s_api` | K8s API Calls | 100 /min | 120 /min |
| `ws_connections` | WS Connections | 50 | 80 |
| `error_rate` | Error Rate | 5 /s | 15 /s |
| `scheduler_health` | Scheduler Health | 200 ms | 500 ms |
| `policy_executions` | Policy Executions | 5 | 10 |

---

## API Rivers

### Topology

15 Go backend components are arranged across 6 tiers (Entry, Middleware, Handlers, Core Logic, Data & Cluster, External) and connected by 21 links with port-based bezier curve routing.

### Particle System

Animated particles flow along links proportional to real-time RPS from the SSE stream. Visual features include gradient trails with bloom glow, color variation, burst effects on scenario change, idle ambient particles, and error shockwaves.

### Interactions

- **Hover component** -- floating preview card with live metrics, runtime limits, and incoming/outgoing connections.
- **Click link** -- popover with Go function signature, live RPS/latency, and a "Trace this path" action.
- **Drag components** -- reposition nodes freely (persisted to `localStorage`).
- **Trace mode** -- click a component to highlight its downstream dependency chain with a breadcrumb trail.
- **Scenario filtering** -- Page Load, Sleep Execution, Wake Execution, WS Log Stream, All Flows.

### Controls

- Layout toggle (vertical / horizontal)
- Speed slider (`0.25x` -- `5x`)
- Particle density slider (`0.1x` -- `3x`)
- Zoom (scroll wheel with `Ctrl`/`Cmd`, or `+`/`-` buttons)
- Minimap with viewport indicator
- Fullscreen mode
- Critical path highlighting (slowest path auto-detected)

---

## Backend Architecture

### Metric Collector

A background goroutine (`Collector.Start`) self-scrapes the Prometheus default registry every 2 seconds, computes counter deltas and histogram quantiles, and writes `MetricSnapshot` rows to PostgreSQL.

**Collection cycle:**
1. Gather all metric families from the Prometheus registry.
2. Flatten counters, gauges, and histograms into a flat `map[string]float64` keyed by `name{labels}`.
3. Compute per-second rates by diffing against the previous tick's values.
4. Handle counter resets: when the current value is less than the previous value, treat the current value as the delta (the counter was reset between ticks).
5. Compute histogram quantiles (P50, P95, P99) by aggregating all label combinations and interpolating across bucket boundaries.
6. Write the `MetricSnapshot` to PostgreSQL.
7. Build the full SSE payload (snapshot + component metrics + link metrics + thresholds + recent calls) and store it in memory under a `sync.RWMutex`.

**Retention:** Snapshots older than 3 days are pruned hourly by a separate ticker. Pruning uses a simple `DELETE WHERE timestamp < cutoff` query.

**Write interval:** One row every 2 seconds = 43,200 rows/day, 129,600 rows at full 3-day retention.

### SSE Endpoint

`GET /api/observability/stream` reads the latest payload from the collector's in-memory buffer (not from the database), avoiding per-client DB queries. The payload is pushed every 2 seconds with 30-second keepalive comments. This design scales to many concurrent dashboard clients without increasing database load.

### History Endpoint

`GET /api/observability/history?range=1h` queries historical snapshots with SQL-level downsampling using `ROW_NUMBER() OVER (ORDER BY timestamp)` to select every Nth row, avoiding loading all rows into application memory for long time ranges.

| Range | Max Points | Resolution |
| :---- | :--------- | :--------- |
| 1m | 60 | 1s |
| 5m | 300 | 1s |
| 15m | 300 | 3s |
| 1h | 240 | 15s |
| 6h | 360 | 1m |
| 1d | 1440 | 1m |
| 3d | 864 | 5m |

### Call Recorder

A Chi middleware captures every HTTP request flowing through the router: method, route pattern, status code, and duration. The middleware checks `IsSkippedRoute()` before recording.

**Architecture:**
1. Middleware extracts the Chi route pattern (not the raw URL) and calls `CallRecorder.Record()`.
2. `Record()` maps the `"METHOD /pattern"` key to a `routeInfo` struct containing component name, Go function name, and category via a static lookup table (49 route patterns).
3. Each call is assigned a monotonically increasing ID via `atomic.Uint64`.
4. The call is written to a fixed-size ring buffer (100 entries) protected by a `sync.Mutex`.
5. The collector reads the latest 50 calls via `Recent(50)` and includes them in each SSE payload as `recentCalls`.

**Performance:** The critical section in `Record()` is a single array write and two integer updates -- approximately 1-2 microseconds per request. The `sync.Mutex` is used instead of `sync.RWMutex` because the write path is the hot path and there is only one concurrent reader (the collector goroutine every 2 seconds).

**Unknown routes:** Routes not present in the lookup table receive a default mapping to component `"handlers"` with function name `"unknown"`.

### Runtime Config

`GET /api/observability/config` returns live component limits read from three sources:

1. **Constants** -- hardcoded values (e.g., ring buffer size, collect interval)
2. **Environment variables** -- DB pool size, K8s QPS/burst
3. **Guardrails table** -- user-configurable values (scheduler eval interval, scaling concurrency)

---

## Data Model

### MetricSnapshot

One row per collection tick (every 2 seconds). Stored in the `metric_snapshots` table with a timestamp index.

| Field | Type | Unit | Description |
| :---- | :--- | :--- | :---------- |
| `httpRequestRate` | float64 | req/s | HTTP requests per second since last tick |
| `httpLatencyP50Ms` | float64 | ms | 50th percentile response time |
| `httpLatencyP95Ms` | float64 | ms | 95th percentile response time |
| `httpLatencyP99Ms` | float64 | ms | 99th percentile response time |
| `httpErrorRate` | float64 | errors/s | HTTP 5xx errors per second |
| `k8sGetRate` | float64 | calls/min | Kubernetes GET API calls per minute |
| `k8sPatchRate` | float64 | calls/min | Kubernetes PATCH API calls per minute |
| `k8sDeleteRate` | float64 | calls/min | Kubernetes DELETE API calls per minute |
| `wsActiveConnections` | int | connections | Current WebSocket connection count (gauge) |
| `cacheHitRate` | float64 | % | Derived cache rebuild rate (0--100) |
| `schedulerEvalRate` | float64 | evals/min | Scheduler evaluations per minute |
| `schedulerEvalDurationMs` | float64 | ms | Median scheduler evaluation duration |
| `workloadsScaledCount` | int | count | Workloads scaled in the tick window |
| `scaleOperationDurationMs` | float64 | ms | Median scale operation duration |
| `policySuccessCount` | int | count | Successful executions in the tick window |
| `policyFailedCount` | int | count | Failed executions in the tick window |
| `policySkippedCount` | int | count | Skipped executions in the tick window |
| `schedulerPanics` | int | count | Scheduler panics recovered in the tick window |
| `auditDrops` | int | count | Dropped audit log entries |
| `rateLimitHits` | int | count | Rate limit rejections |
| `totalErrorRate` | float64 | errors/s | Combined error rate (HTTP 5xx + scheduler panics) |

### ApiCall

In-memory only (not persisted to database). Transported via the SSE payload's `recentCalls` array.

| Field | Type | Description |
| :---- | :--- | :---------- |
| `id` | string | Monotonic ID (`"call-N"`) |
| `timestamp` | string | RFC3339Nano UTC timestamp |
| `method` | string | HTTP method |
| `path` | string | Chi route pattern (not raw URL) |
| `statusCode` | int | HTTP response status code |
| `durationMs` | float64 | Request duration in milliseconds |
| `component` | string | Backend component name |
| `goFunc` | string | Go handler function name |
| `category` | string | Call category (`"http"`) |

### ObservabilityThreshold

Stored in the `observability_thresholds` table with a unique index on `panelKey`.

| Field | Type | Description |
| :---- | :--- | :---------- |
| `panelKey` | string | Metric panel identifier (e.g., `"http_rate"`) |
| `warnVal` | float64 | Warning threshold value |
| `critVal` | float64 | Critical threshold value |

---

## Performance Characteristics

### Write Frequency

The collector writes one `MetricSnapshot` row to PostgreSQL every 2 seconds. At steady state this produces 43,200 rows per day. With 3-day retention, the table holds at most ~129,600 rows before pruning.

### Memory Footprint

- **SSE payload cache:** A single `ObservabilityStreamPayload` struct held under `sync.RWMutex`. Size varies with component count and recent call count but is typically under 50 KB.
- **Ring buffer:** Fixed 100-entry `[100]store.ApiCall` array. Each `ApiCall` is ~200 bytes, totaling ~20 KB.
- **Previous tick values:** A `map[string]float64` holding the previous tick's flattened metric values. Size is proportional to the number of Prometheus metric series (typically a few hundred entries).

### Connection Pool Impact

The collector uses a single database connection per write tick (one INSERT every 2 seconds). The hourly prune operation uses one DELETE query. History queries from the frontend use the shared connection pool. SSE clients do not consume database connections because the handler reads from the in-memory cache.

### Scaling Behavior

- **Dashboard clients:** Adding more concurrent SSE clients has zero database impact. Each client reads the same in-memory payload. The Go runtime handles the per-client SSE write.
- **Large clusters (100+ nodes):** The collector scrapes the local Prometheus registry, not remote endpoints. Collection time is bounded by the number of local metric series, not cluster size. Kubernetes API call rates will be higher, increasing the values in the snapshot but not the collection overhead.
- **Long time ranges:** The history endpoint uses SQL-level `ROW_NUMBER` downsampling. A 3-day query returns at most 864 points regardless of the number of stored rows.

### Known Limitations

- The `cacheHitRate` field in `MetricSnapshot` is derived from a heuristic based on cache rebuild counts, not actual cache hit/miss counters. It is a synthetic approximation.
- The Call Recorder ring buffer holds 100 entries. Under high request rates (>50 req/s), older calls rotate out within 2 seconds and may never appear in an SSE payload.
- The collector does not retry failed database writes. A failed tick is logged and skipped; the next tick will proceed normally.
- Component and link metrics in the API Rivers view are derived from the metric snapshot using scaling factors, not from direct per-component instrumentation.

---

## Keyboard Shortcuts

| Key | Action |
| :-- | :----- |
| `1` -- `7` | Switch time range (1m, 5m, 15m, 1h, 6h, 1d, 3d) |
| `t` | Toggle between Metrics Dashboard and API Rivers |
| `/` | Focus the search input |
| `Escape` | Close expanded panel or dialog |

## URL Parameters

The observability page syncs state to URL query parameters for bookmarkable views:

- `?tab=metrics` or `?tab=rivers` -- active view
- `?range=5m` -- selected time range

Example: `/observability?tab=rivers&range=1h`

---

## Mock Server

For frontend development without a backend, the mock server at `mock-api/routes/observability.mjs` provides:

- SSE stream with random-walk metric data
- Historical snapshot buffer (pre-seeded with 60 seconds)
- Realistic weighted API call generation (30 templates across HTTP, K8s, DB, scheduler, WS)
- Threshold CRUD
- Runtime config endpoint

Start with `make dev-mock`.
