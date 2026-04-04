# Observability Center

## Overview

The Observability Center is a dual-view page combining a real-time Metrics Dashboard and an animated API Rivers topology. It is accessible at `/observability` in the web UI. Both views share the same SSE data stream, keeping all visualizations in sync.

## Metrics Dashboard

### Status Header

The header displays a live clock, system health indicator, and four KPI cards: throughput (with inline sparkline), P99 latency, DB pool utilization, and error rate. A freshness indicator shows time since the last SSE event. A time range selector allows switching between `1m`, `5m`, `15m`, `1h`, `6h`, `1d`, and `3d` windows.

### System Overview

A compact hero card with five sections:

- **Request Flow** -- distribution bar showing request breakdown
- **Latency Breakdown** -- horizontal bars for P50, P95, and P99
- **Component Health** -- 8-component grid with status indicators
- **Error Summary** -- aggregated error counts
- **Scheduler Health** -- progress ring with current tick duration

### Metric Panels

Seven panels, each showing a live value, delta percentage, chart, threshold indicators (`WARN`/`CRIT`), min/max range, and inline legends for multiline charts. Click any panel to expand it fullscreen.

| Panel | Description |
| :---- | :---------- |
| HTTP Request Rate | Inbound requests per second |
| HTTP Latency | Response time distribution |
| K8s API Calls | Calls to the Kubernetes API per minute |
| WebSocket Connections | Active WebSocket connection count |
| Cache Hit Rate | Percentage of cache hits vs misses |
| Pod Scale Operations | Scale-up and scale-down events |
| Error Rate | Errors per second across all components |

### Live API Call Feed

A real-time table of API and function calls with relative timestamps, method badges, Go function names, component chips, and duration bars. Features include search, category filtering, a stream/grouped toggle, expandable rows with copy-as-cURL, and auto-scroll.

### Error Timeline

A horizontal timeline strip plotting incident events over an error rate area chart.

### Configurable Thresholds

Each panel has configurable warn/crit thresholds stored in the database. Defaults are seeded on first startup.

| Panel | Default Warn | Default Crit |
| :---- | :----------- | :----------- |
| HTTP Request Rate | 150 req/s | 200 req/s |
| P99 Latency | 500 ms | 1000 ms |
| K8s API Calls | 100 /min | 120 /min |
| WS Connections | 50 | 80 |
| Cache Hit Rate | < 90% | < 70% |
| Error Rate | 5 /s | 15 /s |
| Scheduler Health | 200 ms | 500 ms |

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

## Backend Architecture

### Metric Collector

A background goroutine self-scrapes the Prometheus default registry every 2 seconds, computes counter deltas and histogram quantiles, and writes `MetricSnapshot` rows to PostgreSQL. After each write, the collector builds the full SSE payload (snapshot + component metrics + link metrics + thresholds) and stores it in memory under a `sync.RWMutex`. Snapshots older than 3 days are pruned hourly. Counter resets are handled by treating the current value as the delta when the previous value exceeds the current.

### SSE Endpoint

`GET /api/observability/stream` reads the latest payload from the collector's in-memory buffer (not from the database), avoiding per-client DB queries. The payload is pushed every 2 seconds with 30-second keepalive comments. This design scales to many concurrent dashboard clients without increasing database load.

### History Endpoint

`GET /api/observability/history?range=1h` queries historical snapshots with SQL-level downsampling using `ROW_NUMBER() OVER (ORDER BY timestamp)` to select every Nth row, avoiding loading all rows into application memory for long time ranges.

### Runtime Config

`GET /api/observability/config` returns live component limits read from constants, environment variables, and the Guardrails table (the scheduler tick interval is user-configurable).

## Mock Server

For frontend development without a backend, the mock server at `mock-api/routes/observability.mjs` provides:

- SSE stream with random-walk metric data
- Historical snapshot buffer (pre-seeded with 60 seconds)
- Realistic weighted API call generation (30 templates across HTTP, K8s, DB, scheduler, WS)
- Threshold CRUD
- Runtime config endpoint

Start with `make dev-mock`.
