# Backend Developer Guide

Use this page to get started in the Go backend and locate the code for a change. Read [architecture](../ARCHITECTURE.md) first for system boundaries. The detailed references are [policy execution](development/backend-policy-engine.md) and [data/transport flow](development/backend-data-flow.md).

## Develop Locally

Choose a mode in [local development](local-development.md). PostgreSQL is required. A real Kubernetes connection is needed to verify scaling; the application can start without one, but cluster operations will be unavailable.

`make dev-backend` uses the development PostgreSQL DSN specified in the Makefile. Set authentication and HTTP cookie options before starting. For a custom DSN, copy the spec and invoke the server directly:

```bash
make copy-spec
cd backend
export DATABASE_URL='host=localhost user=kube_phoenix password=kube_phoenix dbname=kube_phoenix port=5432 sslmode=disable'
export ADMIN_USER=admin
export ADMIN_PASSWORD='replace-with-a-local-password'
export COOKIE_SECURE=false
export CORS_ALLOWED_ORIGIN=http://localhost:3000
go run ./cmd/server/...
```

Seed credentials create an admin only when the users table is empty. For frontend development on another port, see the separate WebSocket origin constraint in [data flow](development/backend-data-flow.md#execution-logs). For a production-shaped same-origin test, use [the local cluster setup](local-development.md).

## Common Changes

| Change | Start here | Also check |
| :----- | :--------- | :--------- |
| Add or modify an endpoint | [API handlers/router](../backend/internal/api), [OpenAPI](../openapi.yaml) | Permission gates, CSRF, validation, frontend client and mock handler |
| Change a window rule | [policy](../backend/internal/policy) | Timezone, overnight, all-day, overlap and transition tests |
| Change scheduling or recovery | [scheduler](../backend/internal/scheduler) | Claims, cancellation, exceptions, drift correction, startup |
| Change replica restoration | [scaler](../backend/internal/scaler) | Partial failure, snapshot ownership/closure, external scaling |
| Add a stored field | [models](../backend/internal/store/models.go), store queries | Existing-data migration, explicit false/zero updates, API/export/import |
| Add a process setting | [config](../backend/internal/config/config.go) | Defaults, Helm values/schema/templates, [configuration](configuration.md) |
| Change cluster display data | [k8s](../backend/internal/k8s), cluster handlers | Cache readiness, live-read cost, metrics-server absence |
| Change monitoring | [metrics](../backend/internal/metrics), [observability](../backend/internal/observability) | [Alpha scope and estimates](observability.md) |

## Verification

Run focused tests for the behavior you changed, then the required repository checks. The current unit suite does not establish PostgreSQL integration coverage. Changes to models, migrations, or persistence need a check against a real database as well.

```bash
cd backend
go test ./internal/policy ./internal/scheduler ./internal/scaler
go test ./...
go test -race ./internal/scheduler
golangci-lint run
```

From the repository root, `make test` and `make lint` wrap backend checks. `make build` also builds the frontend and embeds it with the OpenAPI specification.

For changes that affect scaling, use the [short smoke test](testing/policy-smoke-test.md) on a disposable cluster. The [policy regression catalogue](test-plan-policy.md) supplies broader cases; it is not a record of checks that have already passed.

## Reference Map

The following sections retain the original guide's navigation anchors while pointing to smaller references.

### 1. Overview

The backend serves API, SSE, WebSocket, metrics, and embedded static pages from one HTTP listener. PostgreSQL stores configuration and recovery data. Kubernetes provides the live resource state. See [architecture](../ARCHITECTURE.md).

### 2. Package Map

| Package | Main responsibility |
| :------ | :------------------ |
| `cmd/server`, `internal/config` | Startup, lifecycle, environment settings |
| `internal/api`, `internal/middleware`, `internal/auth` | Requests, sessions, CSRF, permissions, OIDC |
| `internal/policy`, `internal/scheduler` | Time rules, intended state, execution coordination and broker |
| `internal/scaler`, `internal/k8s`, `internal/nodeutil` | Scaling, Kubernetes access/cache, node protection |
| `internal/store` | Database models, queries, migrations and recovery records |
| `internal/metrics`, `internal/observability` | Prometheus measurements and alpha dashboard collection |
| `internal/docs`, `web` | Embedded API reference and frontend |

Browse the [backend source](../backend) for file and function inventories. The references explain behavior and ownership rather than mirroring every declaration.

### 3. Data Model Deep Dive

Read [persistence and relationships](development/backend-data-flow.md#configuration-and-persistence) and [snapshot ownership](development/backend-policy-engine.md#sleep-and-snapshots). [Models](../backend/internal/store/models.go) are the field-level source; [OpenAPI](../openapi.yaml) defines public JSON.

### 4. Request Lifecycle

Read [HTTP request boundaries](development/backend-data-flow.md#http-request-boundary). Authentication, CSRF, and resource permissions are distinct checks. Public and protected routes belong in the correct router groups.

### 5. Policy Execution Engine

Read [the policy engine reference](development/backend-policy-engine.md). It covers intent, execution claims, sleep/wake, node operations, exceptions, and recovery.

### 6. Cluster Data Pipeline

Read [cluster cache and live reads](development/backend-data-flow.md#cluster-cache-and-live-reads). Inventory snapshots, metrics, pod events, and log requests use different data paths.

### 7. Real-Time Communication

Read [cluster SSE](development/backend-data-flow.md#cluster-sse) and [execution logs](development/backend-data-flow.md#execution-logs). Cache updates are event-driven; WebSocket replay subscribes before reading database history.

### 8. Observability

Read [audit and monitoring](development/backend-data-flow.md#audit-and-monitoring) for backend ownership and [observability](observability.md) for operator interpretation. API Rivers is cosmetic/mock; its animation is not a trace of requests.

### 9. Testing Guide

Use the [verification commands](#verification) above. Keep pure window cases independent of external systems, test handler authorization and validation, and exercise persistence failures when changing snapshot logic.

### 10. Common Patterns and Conventions

Reuse API error/ID/pagination helpers, store status constants, permission groups, and scheduler reload hooks. Preserve explicit zero values in partial updates and cancellation ownership in workers. Follow [the data-flow reference](development/backend-data-flow.md) for lifecycle constraints and [CONTRIBUTING.md](../CONTRIBUTING.md) for commit and review conventions.
