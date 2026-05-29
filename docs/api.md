# API Reference

## Swagger UI

Interactive API documentation is available at `/api/docs/` (embedded Swagger UI v5, no CDN dependency). The raw OpenAPI 3.1 specification is served at `/api/docs/openapi.yaml`.

The canonical spec source is [`openapi.yaml`](../openapi.yaml) at the repository root.

## Authentication

All `/api/*` and `/ws/*` endpoints require session-based authentication unless noted otherwise.

### Session Flow

1. **Login:** `POST /api/auth/login` with `{"username", "password"}`. Sets the `__kp_session` (HTTP-only) and `__kp_csrf` cookies.
2. **CSRF:** Include the value of the `__kp_csrf` cookie as the `X-CSRF-Token` header on all mutating requests (POST, PUT, DELETE).
3. **OIDC:** When configured, `GET /api/auth/oidc/login` redirects to Keycloak. The callback sets session cookies automatically.
4. **WebSocket:** Connections authenticate via the session cookie, sent automatically by the browser on same-origin upgrades.
5. **Logout:** `POST /api/auth/logout` destroys the session and clears cookies.

## Endpoints

### Health, Metrics, and Version (no auth required)

| Method | Path | Description |
| :----- | :--- | :---------- |
| `GET` | `/healthz` | Health check (verifies database connectivity) |
| `GET` | `/metrics` | Prometheus metrics endpoint |
| `GET` | `/api/version` | Build version, Go version, and server uptime |

### Authentication (no session required)

| Method | Path | Description |
| :----- | :--- | :---------- |
| `POST` | `/api/auth/login` | Username/password login (rate-limited) |
| `GET` | `/api/auth/oidc/config` | OIDC provider configuration status |
| `GET` | `/api/auth/oidc/login` | Initiate Keycloak OIDC flow (redirects to IdP) |
| `GET` | `/api/auth/oidc/callback` | OIDC redirect callback (sets session cookies) |

### Authentication (session required)

| Method | Path | Description |
| :----- | :--- | :---------- |
| `POST` | `/api/auth/logout` | Destroy session and clear cookies |
| `GET` | `/api/auth/me` | Current user info and permissions |
| `GET` | `/api/auth/sessions` | List active sessions for the current user |
| `PUT` | `/api/auth/password` | Change own password (local users only) |
| `PUT` | `/api/auth/settings` | Update user settings (e.g. default timezone) |

### Cluster -- viewer and above

| Method | Path | Description |
| :----- | :--- | :---------- |
| `GET` | `/api/overview` | Dashboard overview: next run, last execution, cluster stats |
| `GET` | `/api/cluster/stream` | SSE stream with pushed overview updates (~10s interval) |
| `GET` | `/api/cluster/workloads` | List Deployments and StatefulSets |
| `GET` | `/api/cluster/nodes` | List nodes with protection status |
| `GET` | `/api/cluster/nodes/{name}/pods` | List non-DaemonSet pods on a node |
| `GET` | `/api/cluster/pods/{namespace}/{name}` | Full pod detail: containers, conditions, events, labels, annotations |
| `GET` | `/api/cluster/pods/{namespace}/{name}/logs` | Stream container logs (query params: `container`, `tailLines` default 250, `follow`, `previous`). Sets `X-Accel-Buffering: no` when `follow=true`. |
| `GET` | `/api/cluster/workloads/{namespace}/{kind}/{name}/pods` | List pods belonging to a Deployment or StatefulSet |
| `GET` | `/api/cluster/info` | Kubernetes API server URL, version, auth mode, and cluster name |

### Guardrails -- viewer reads, operator writes

| Method | Path | Description |
| :----- | :--- | :---------- |
| `GET` | `/api/guardrails` | Get guardrails configuration |
| `PUT` | `/api/guardrails` | Update guardrails |
| `GET` | `/api/guardrails/export` | Export guardrails as a sanitised JSON envelope |
| `POST` | `/api/guardrails/import/preview` | Preview a guardrails import (returns before/after diff) |
| `POST` | `/api/guardrails/import/apply` | Apply a guardrails import (resolution: `overwrite` — only accepted value) |

### Policies -- viewer reads, operator writes

| Method | Path | Description |
| :----- | :--- | :---------- |
| `GET` | `/api/policies` | List all policies (includes computed `nextSleepAt` / `nextWakeAt`) |
| `GET` | `/api/policies/{id}` | Get a single policy |
| `POST` | `/api/policies` | Create a policy |
| `PUT` | `/api/policies/{id}` | Update a policy (partial update) |
| `DELETE` | `/api/policies/{id}` | Delete a policy |
| `GET` | `/api/policies/{id}/snapshots` | Workload snapshots for a policy (`?open=true` for un-restored only) |
| `GET` | `/api/policies/{id}/export` | Export a policy as a sanitised JSON envelope |
| `POST` | `/api/policies/import/preview` | Preview a policy import (reports name conflicts) |
| `POST` | `/api/policies/import/apply` | Apply a policy import (resolutions: `overwrite`, `rename` + `newName`). Forces `enabled=false` and `mode="plan"` on the resulting policy. Rejects invalid `mode` values with 400. |

### Policy Operations -- operator and above

| Method | Path | Description |
| :----- | :--- | :---------- |
| `POST` | `/api/policies/{id}/sleep` | Manually trigger a sleep run |
| `POST` | `/api/policies/{id}/wake` | Manually trigger a wake run |
| `POST` | `/api/policies/{id}/cancel` | Cancel a running execution (returns 409 if no execution is in flight) |

### Policy Executions -- viewer and above

| Method | Path | Description |
| :----- | :--- | :---------- |
| `GET` | `/api/policy-executions` | List executions (filters: `policy_id`, `status`, `direction`, `page`, `page_size` or `pageSize`) |
| `GET` | `/api/policy-executions/{id}` | Get a single execution |
| `GET` | `/api/policy-executions/{id}/logs` | Get log lines for an execution |
| `GET` | `/api/policy-executions/{id}/snapshots` | Workload snapshots for an execution |
| `GET` | `/ws/policy-executions/{id}/logs` | WebSocket for live execution log streaming |

### Scheduled Exceptions -- viewer reads, operator writes

| Method | Path | Description |
| :----- | :--- | :---------- |
| `GET` | `/api/exceptions` | List exceptions (filters: `policy_id`, `status`) |
| `GET` | `/api/exceptions/{id}` | Get a single exception |
| `POST` | `/api/exceptions` | Create an exception (`policyId` is required on this endpoint; the import flow accepts freestanding exceptions via `policyName: null`) |
| `PUT` | `/api/exceptions/{id}` | Update an exception (pending status only) |
| `DELETE` | `/api/exceptions/{id}` | Cancel an exception (triggers revert action if active with `sleepOnEnd`) |
| `GET` | `/api/exceptions/{id}/export` | Export an exception (references parent by `policyName`) |
| `POST` | `/api/exceptions/import/preview` | Preview an exception import (rejects with 422 when parent policy name is unresolved; rejects with 409 when the window overlaps an existing opposite-type exception on the same policy) |
| `POST` | `/api/exceptions/import/apply` | Apply an exception import (always creates a new row; same 422 and 409 rules as preview) |

### Audit Logs -- requires `audit.view` permission (viewer and above)

| Method | Path | Description |
| :----- | :--- | :---------- |
| `GET` | `/api/audit-logs` | List audit logs (filters: `user`, `action`, `from`, `to`, `page`, `pageSize`) |

**Filter notes:**
- `user` — case-insensitive partial match (e.g. `ali` matches `alice`).
- `pageSize` — default 50, max 1000. Use a high value with `page=0` to export all results.
- `from` / `to` — RFC3339 timestamps (e.g. `2024-01-15T00:00:00Z`).

**`after` field for auth actions:**
- `auth.login` — `{"username": "alice", "method": "local" | "oidc"}`
- `auth.login_failed` — `{"username": "alice", "reason": "unknown_user" | "bad_password" | "account_disabled"}`
- `auth.logout` — `{"method": "local" | "oidc"}`
- `auth.password_change` — `{"method": "self-service"}`
- `auth.denied` — `{"method": "GET", "path": "/api/users"}` (permission denied)
- `user.settings` — `{"defaultTimezone": "Europe/Berlin"}` (before/after)
- `policy.sleep` / `policy.wake` — `{"executionId": 42}`
- `policy.cancel` — logged when a running execution is cancelled

### Users -- admin only

| Method | Path | Description |
| :----- | :--- | :---------- |
| `GET` | `/api/users` | List all users |
| `POST` | `/api/users` | Create a local user |
| `PUT` | `/api/users/{id}` | Update a user (role, enabled). OIDC user roles are managed by AD groups. |
| `DELETE` | `/api/users/{id}` | Delete a user (cannot delete self) |

### Admin -- admin only

| Method | Path | Description |
| :----- | :--- | :---------- |
| `POST` | `/api/danger/reset-db` | Reset database. Streams NDJSON progress. Body: `{"confirm":"RESET DATABASE"}` |
| `POST` | `/api/danger/emergency-scale` | Emergency scale: disables all policies, cancels active exceptions, scales sleeping workloads to 1 replica. Streams NDJSON progress. Requires `admin.emergency_scale` permission. Body: `{"confirm":"EMERGENCY SCALE"}` |

### Observability -- viewer and above

| Method | Path | Description |
| :----- | :--- | :---------- |
| `GET` | `/api/observability/stream` | SSE stream with real-time metric snapshots, component health, link metrics, and recent API calls (2s interval) |
| `GET` | `/api/observability/history` | Historical metric snapshots (query params: `range` duration string e.g. `1h`, `3d`, or `from`/`to` as RFC3339) |
| `GET` | `/api/observability/thresholds` | List all configured warn/crit thresholds per metric panel |
| `PUT` | `/api/observability/thresholds` | Create or update a threshold (body: `{"panelKey", "warnVal", "critVal"}`) |
| `GET` | `/api/observability/config` | Runtime component limits (DB pool size, K8s QPS, rate limits, scheduler interval) |

#### SSE Stream Payload

The `/api/observability/stream` endpoint pushes JSON events in SSE format (`data: {...}\n\n`) every 2 seconds:

```json
{
  "snapshot": {
    "timestamp": "2024-01-15T14:32:05Z",
    "httpRequestRate": 120.5,
    "httpLatencyP50Ms": 25.0,
    "httpLatencyP95Ms": 85.0,
    "httpLatencyP99Ms": 250.0,
    "httpErrorRate": 1.2,
    "k8sGetRate": 65.0,
    "k8sPatchRate": 12.0,
    "k8sDeleteRate": 3.0,
    "wsActiveConnections": 8,
    "schedulerEvalRate": 2.0,
    "schedulerEvalDurationMs": 15.0,
    "policySuccessCount": 0,
    "policyFailedCount": 0,
    "policyInterruptedCount": 0,
    "workloadsScaledCount": 0,
    "scaleOperationDurationMs": 0.0,
    "schedulerPanics": 0,
    "auditDrops": 0,
    "rateLimitHits": 0,
    "totalErrorRate": 1.2
  },
  "components": [
    {"component": "router", "rpsIn": 120.5, "rpsOut": 120.5, "latencyMs": 25.0, "errorRate": 1.2, "status": "ok"}
  ],
  "links": [
    {"source": "router", "target": "auth", "rps": 120.5, "latencyMs": 2.0, "errorRate": 0, "category": "http"}
  ],
  "thresholds": [
    {"panelKey": "http_rate", "warnVal": 150, "critVal": 200}
  ],
  "recentCalls": [
    {"id": "call-1", "timestamp": "...", "method": "GET", "path": "/api/policies", "statusCode": 200, "durationMs": 8.2, "component": "handlers", "goFunc": "h.listPolicies", "category": "http"}
  ]
}
```

#### History Query

The `range` parameter supports: `1m`, `5m`, `15m`, `1h`, `6h`, `1d`, `3d`. Responses are automatically downsampled for longer ranges:

| Range | Resolution |
| :---- | :--------- |
| 1m | 1s (60 points) |
| 5m | 1s (300 points) |
| 15m | 3s (300 points) |
| 1h | 15s (240 points) |
| 6h | 1m (360 points) |
| 1d | 1m (1440 points) |
| 3d | 5m (864 points) |

## WebSocket Protocol

The live log streaming endpoint (`/ws/policy-executions/{id}/logs`) uses the following protocol:

- **Authentication:** Session cookie is sent automatically on the WebSocket upgrade request.
- **Close code 4401:** Returned when no valid session is present.
- **Messages:** Each message is a JSON-encoded log line with `timestamp`, `level`, and `message` fields.
- **Completion:** The server closes the connection when the execution finishes.

## Error Responses

All API errors follow a consistent JSON structure:

```json
{
  "error": "human-readable error message"
}
```

Common HTTP status codes:

| Status | Meaning |
| :----- | :------ |
| `400` | Invalid request body or parameters |
| `401` | Not authenticated |
| `403` | Insufficient permissions for the requested operation |
| `404` | Resource not found |
| `409` | Conflict (e.g. policy is already executing, or no execution to cancel) |
| `429` | Rate limit exceeded (login endpoints) |
| `500` | Internal server error |
