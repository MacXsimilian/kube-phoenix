# API Reference

## Swagger UI

Interactive API documentation is available at **`/api/docs/`** (Swagger UI v5, embedded — no CDN). The raw OpenAPI 3.1 spec is served at **`/api/docs/openapi.yaml`**.

The canonical spec source is [`openapi.yaml`](../openapi.yaml) at the repo root.

---

## Authentication

All `/api/*` and `/ws/*` endpoints require session-based authentication via HTTP-only cookies, except where noted below.

- **Login:** `POST /api/auth/login` with `{"username","password"}`. Sets `__kp_session` (HTTP-only) and `__kp_csrf` cookies.
- **CSRF:** Include the `__kp_csrf` cookie value as the `X-CSRF-Token` header on all mutating requests (POST/PUT/DELETE).
- **OIDC:** When configured, `GET /api/auth/oidc/login` redirects to Keycloak. The callback sets session cookies automatically.
- **WebSocket:** Connections authenticate via the session cookie (sent automatically by the browser on same-origin upgrades).

## Endpoints

### Public (no auth required)

| Method | Path | Description |
| :----- | :--- | :---------- |
| `GET` | `/healthz` | Health check (DB ping) |
| `GET` | `/metrics` | Prometheus metrics |

### Auth (unauthenticated)

| Method | Path | Description |
| :----- | :--- | :---------- |
| `POST` | `/api/auth/login` | Username/password login (rate limited) |
| `GET` | `/api/auth/oidc/config` | OIDC provider configuration status |
| `GET` | `/api/auth/oidc/login` | Initiate Keycloak OIDC flow (redirects to IdP) |
| `GET` | `/api/auth/oidc/callback` | OIDC redirect callback (sets session cookies) |

### Auth (session required)

| Method | Path | Description |
| :----- | :--- | :---------- |
| `POST` | `/api/auth/logout` | Destroy session and clear cookies |
| `GET` | `/api/auth/me` | Current user info + permissions |
| `PUT` | `/api/auth/password` | Change own password (local users only) |

### Schedules (viewer+)

| Method | Path | Description |
| :----- | :--- | :---------- |
| `GET` | `/api/schedules` | List all schedules ordered by position (includes `nextRun`) |
| `GET` | `/api/schedules/{id}` | Get schedule |

### Schedules (operator+)

| Method | Path | Description |
| :----- | :--- | :---------- |
| `POST` | `/api/schedules` | Create schedule |
| `PUT` | `/api/schedules/reorder` | Reorder within a type — body: `{"type":"scale_down","ids":[3,1,2]}` |
| `PUT` | `/api/schedules/{id}` | Update schedule (`type` is immutable) |
| `DELETE` | `/api/schedules/{id}` | Delete schedule |

### Executions (viewer+)

| Method | Path | Description |
| :----- | :--- | :---------- |
| `GET` | `/api/executions` | List executions (filters: `schedule_id`, `status`, `page`, `page_size`) |
| `GET` | `/api/executions/{id}` | Get execution |
| `GET` | `/api/executions/{id}/logs` | Get all log lines for an execution |
| `GET` | `/ws/executions/{id}/logs` | WebSocket — live log streaming |

### Cluster (viewer+)

| Method | Path | Description |
| :----- | :--- | :---------- |
| `GET` | `/api/overview` | Dashboard overview — next run, last execution, cluster stats |
| `GET` | `/api/cluster/stream` | SSE stream — pushed overview updates every ~10 s |
| `GET` | `/api/cluster/workloads` | List Deployments and StatefulSets |
| `GET` | `/api/cluster/nodes` | List nodes with protection status |
| `GET` | `/api/cluster/nodes/{name}/pods` | List non-DaemonSet pods on a node |
| `GET` | `/api/cluster/pods/{namespace}/{name}` | Full pod detail — containers, conditions, events, labels, annotations |
| `GET` | `/api/cluster/pods/{namespace}/{name}/logs` | Stream container logs (query: `container`, `tailLines`, `follow`, `previous`) |
| `GET` | `/api/cluster/workloads/{namespace}/{kind}/{name}/pods` | List pods belonging to a Deployment or StatefulSet |

### Guardrails (viewer+ read, operator+ write)

| Method | Path | Description |
| :----- | :--- | :---------- |
| `GET` | `/api/guardrails` | Get guardrails config |
| `PUT` | `/api/guardrails` | Update guardrails |

### Policies (viewer+ read, operator+ write)

| Method | Path | Description |
| :----- | :--- | :---------- |
| `GET` | `/api/policies` | List all policies (includes computed `nextSleepAt` / `nextWakeAt`) |
| `GET` | `/api/policies/{id}` | Get policy |
| `POST` | `/api/policies` | Create policy |
| `PUT` | `/api/policies/{id}` | Update policy (partial) |
| `DELETE` | `/api/policies/{id}` | Delete policy |
| `GET` | `/api/policies/{id}/snapshots` | Workload snapshots for a policy (`?open=true` = only un-restored) |
| `GET` | `/api/policies/{id}/overrides` | List overrides for a policy |
| `POST` | `/api/policies/{id}/overrides` | Create an override (`stay_awake`, `force_sleep`, `skip_sleep`, `skip_wake`) |
| `DELETE` | `/api/policies/{id}/overrides/{overrideId}` | Delete an override |

### Policy operations (operator+)

| Method | Path | Description |
| :----- | :--- | :---------- |
| `POST` | `/api/policies/{id}/sleep` | Manually trigger a sleep run |
| `POST` | `/api/policies/{id}/wake` | Manually trigger a wake run |

### Policy executions (viewer+)

| Method | Path | Description |
| :----- | :--- | :---------- |
| `GET` | `/api/policy-executions` | List policy executions (filters: `policy_id`, `status`, `page`, `page_size`) |
| `GET` | `/api/policy-executions/{id}` | Get execution |
| `GET` | `/api/policy-executions/{id}/logs` | Get log lines for an execution |
| `GET` | `/api/policy-executions/{id}/snapshots` | Workload snapshots for an execution |
| `GET` | `/ws/policy-executions/{id}/logs` | WebSocket — live policy execution log streaming |

### Scheduled Exceptions (viewer+ read, operator+ write)

| Method | Path | Description |
| :----- | :--- | :---------- |
| `GET` | `/api/exceptions` | List exceptions (filters: `policy_id`, `status`) |
| `GET` | `/api/exceptions/{id}` | Get exception |
| `POST` | `/api/exceptions` | Create exception |
| `PUT` | `/api/exceptions/{id}` | Update exception (pending only) |
| `DELETE` | `/api/exceptions/{id}` | Cancel exception (triggers sleep-on-end if active) |

### Operations (operator+)

| Method | Path | Description |
| :----- | :--- | :---------- |
| `POST` | `/api/trigger` | Manually trigger a legacy schedule — `{"scheduleId": 1, "mode": "plan"}` |

### Audit logs (viewer+)

| Method | Path | Description |
| :----- | :--- | :---------- |
| `GET` | `/api/audit-logs` | List audit logs (filters: `user`, `action`, `from`, `to`, `page`, `pageSize`) |

### Users (admin only)

| Method | Path | Description |
| :----- | :--- | :---------- |
| `GET` | `/api/users` | List all users |
| `POST` | `/api/users` | Create local user — `{"username","email","password","role"}` |
| `PUT` | `/api/users/{id}` | Update user (role, enabled). OIDC users: role is read-only (managed by AD groups). |
| `DELETE` | `/api/users/{id}` | Delete user (cannot delete self) |

### Admin (admin only)

| Method | Path | Description |
| :----- | :--- | :---------- |
| `POST` | `/api/danger/reset-db` | Reset database — streams NDJSON progress; body: `{"confirm":"RESET DATABASE"}` |

---

## See also

- [Configuration](configuration.md) — environment variables and authentication setup
- [Deployment](deployment.md) — Helm installation and cluster setup
- [Troubleshooting](troubleshooting.md) — common issues and fixes
- [OpenAPI spec](../openapi.yaml) — machine-readable API definition
