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

### Health and Metrics (no auth required)

| Method | Path | Description |
| :----- | :--- | :---------- |
| `GET` | `/healthz` | Health check (verifies database connectivity) |
| `GET` | `/metrics` | Prometheus metrics endpoint |

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
| `PUT` | `/api/auth/password` | Change own password (local users only) |

### Cluster -- viewer and above

| Method | Path | Description |
| :----- | :--- | :---------- |
| `GET` | `/api/overview` | Dashboard overview: next run, last execution, cluster stats |
| `GET` | `/api/cluster/stream` | SSE stream with pushed overview updates (~10s interval) |
| `GET` | `/api/cluster/workloads` | List Deployments and StatefulSets |
| `GET` | `/api/cluster/nodes` | List nodes with protection status |
| `GET` | `/api/cluster/nodes/{name}/pods` | List non-DaemonSet pods on a node |
| `GET` | `/api/cluster/pods/{namespace}/{name}` | Full pod detail: containers, conditions, events, labels, annotations |
| `GET` | `/api/cluster/pods/{namespace}/{name}/logs` | Stream container logs (query params: `container`, `tailLines`, `follow`, `previous`) |
| `GET` | `/api/cluster/workloads/{namespace}/{kind}/{name}/pods` | List pods belonging to a Deployment or StatefulSet |

### Guardrails -- viewer reads, operator writes

| Method | Path | Description |
| :----- | :--- | :---------- |
| `GET` | `/api/guardrails` | Get guardrails configuration |
| `PUT` | `/api/guardrails` | Update guardrails |

### Policies -- viewer reads, operator writes

| Method | Path | Description |
| :----- | :--- | :---------- |
| `GET` | `/api/policies` | List all policies (includes computed `nextSleepAt` / `nextWakeAt`) |
| `GET` | `/api/policies/{id}` | Get a single policy |
| `POST` | `/api/policies` | Create a policy |
| `PUT` | `/api/policies/{id}` | Update a policy (partial update) |
| `DELETE` | `/api/policies/{id}` | Delete a policy |
| `GET` | `/api/policies/{id}/snapshots` | Workload snapshots for a policy (`?open=true` for un-restored only) |
| `GET` | `/api/policies/{id}/overrides` | List overrides for a policy |
| `POST` | `/api/policies/{id}/overrides` | Create an override |
| `DELETE` | `/api/policies/{id}/overrides/{overrideId}` | Delete an override |

### Policy Operations -- operator and above

| Method | Path | Description |
| :----- | :--- | :---------- |
| `POST` | `/api/policies/{id}/sleep` | Manually trigger a sleep run |
| `POST` | `/api/policies/{id}/wake` | Manually trigger a wake run |

### Policy Executions -- viewer and above

| Method | Path | Description |
| :----- | :--- | :---------- |
| `GET` | `/api/policy-executions` | List executions (filters: `policy_id`, `status`, `page`, `page_size`) |
| `GET` | `/api/policy-executions/{id}` | Get a single execution |
| `GET` | `/api/policy-executions/{id}/logs` | Get log lines for an execution |
| `GET` | `/api/policy-executions/{id}/snapshots` | Workload snapshots for an execution |
| `GET` | `/ws/policy-executions/{id}/logs` | WebSocket for live execution log streaming |

### Scheduled Exceptions -- viewer reads, operator writes

| Method | Path | Description |
| :----- | :--- | :---------- |
| `GET` | `/api/exceptions` | List exceptions (filters: `policy_id`, `status`) |
| `GET` | `/api/exceptions/{id}` | Get a single exception |
| `POST` | `/api/exceptions` | Create an exception |
| `PUT` | `/api/exceptions/{id}` | Update an exception (pending status only) |
| `DELETE` | `/api/exceptions/{id}` | Cancel an exception (triggers sleep-on-end if active) |

### Audit Logs -- viewer and above

| Method | Path | Description |
| :----- | :--- | :---------- |
| `GET` | `/api/audit-logs` | List audit logs (filters: `user`, `action`, `from`, `to`, `page`, `pageSize`) |

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
| `429` | Rate limit exceeded (login endpoints) |
| `500` | Internal server error |
