# API Guide

Use this guide to authenticate a client and choose the right resource. The complete endpoint, request, response, and parameter reference lives in the canonical [OpenAPI specification](../openapi.yaml).

For an operator walkthrough, start with [your first policy](first-policy.md). For portable configuration, see [export and import](config-export-import.md).

## Swagger UI

Sign in to the running application, then open `/api/docs/` for the embedded Swagger UI. The same authenticated session can fetch `/api/docs/openapi.yaml`. The UI ships with the application and does not require a CDN.

### Version Numbers

The `openapi` field describes the specification format; `info.version` describes the API document version. Application releases have a separate version: `GET /api/version` returns the build tag, Go runtime version, and uptime. Unversioned backend builds report `dev`. See [application build versions](configuration.md#application-build-versions).

## Authentication

The API uses PostgreSQL-backed sessions. Protected requests require the `__kp_session` cookie. Mutating requests also require `X-CSRF-Token` to match the `__kp_csrf` cookie. The login endpoint does not require an existing session or CSRF token.

### Session Flow

1. Send `POST /api/auth/login` with a JSON body such as:

   ```json
   {"username": "admin", "password": "replace-with-your-password"}
   ```

2. Retain both cookies returned by the server. The session cookie is HTTP-only; the CSRF cookie is readable by the browser.
3. Send both cookies on subsequent requests. For POST, PUT, and DELETE requests, copy the CSRF cookie value to `X-CSRF-Token`, including import previews and logout.
4. Use `GET /api/auth/me` to read the current account and permission list. Use `POST /api/auth/logout` to end the session.

When OIDC is configured, `/api/auth/oidc/login` starts the Authorization Code flow and its callback sets the application cookies. See [authentication configuration](configuration.md#authentication).

For a local HTTP backend configured with `COOKIE_SECURE=false`, this example logs in and reads policies. Replace the sample credentials; the cookie jar contains session credentials, so remove it when finished.

```bash
api_url=http://localhost:8080
cookie_jar=$(mktemp)
chmod 600 "$cookie_jar"
curl --fail --silent --show-error -c "$cookie_jar" \
  -H 'Content-Type: application/json' \
  --data '{"username":"admin","password":"replace-with-your-password"}' \
  "$api_url/api/auth/login"
curl --fail --silent --show-error -b "$cookie_jar" "$api_url/api/policies"
rm "$cookie_jar"
```

For browser development, [CORS precedence](configuration.md#cors) and Secure cookies are separate settings. `NEXT_PUBLIC_API_URL` chooses the frontend's API address; it does not bypass backend authentication, CORS, or WebSocket origin checks.

## Endpoints

These groups are a navigation aid. Consult [OpenAPI](../openapi.yaml) for the exact routes, schemas, pagination, and status codes.

| Resource | Entry points | Access |
| :------- | :----------- | :----- |
| Health, metrics, version | `/healthz`, `/metrics`, `/api/version` | No session required; health checks database connectivity |
| Login and OIDC | `/api/auth/login`, `/api/auth/oidc/*` | No existing session required |
| Account and sessions | `/api/auth/me`, `/api/auth/sessions`, `/api/auth/password`, `/api/auth/settings`, `/api/auth/logout` | Authenticated account; password change applies to local accounts |
| Cluster | `/api/overview`, `/api/cluster/*` | All authenticated roles |
| Guardrails | `/api/guardrails` | All roles read; `guardrail.edit` for updates |
| Policies | `/api/policies`, `/api/policies/{id}/snapshots` | All roles read; `schedule.edit` for create, update, delete |
| Manual policy operations | `/api/policies/{id}/sleep`, `/wake`, `/cancel` | `schedule.trigger` |
| Execution history and logs | `/api/policy-executions`, `/ws/policy-executions/{id}/logs` | All authenticated roles |
| Exceptions | `/api/exceptions` | All roles read; `schedule.edit` for mutations |
| Configuration export/import | Resource `/export`, `/import/preview`, `/import/apply` routes | All roles export; both preview and apply require the resource's edit permission |
| Audit logs | `/api/audit-logs` | `audit.view`, granted to viewer, operator, and admin |
| Users | `/api/users` | `user.manage` (admin) |
| Database reset and emergency scale | `/api/danger/*` | Respective admin permission; explicit confirmation body required |
| Observability | `/api/observability/*` | All authenticated roles; see [alpha feature scope](observability.md) |

The role-to-permission mapping is in [configuration](configuration.md#rbac-roles-and-permissions). Export/import conflict resolution and validation are explained in the [operator guide](config-export-import.md).

### Policy Responses

Policies return `sleepWindows` as an array and `nextTransitionAt` as the next predicted state change. Scheduling uses days, times, and a timezone. The API does not accept cron expressions for current policy scheduling. Read [window semantics](window-native-scheduling.md) for overnight and all-day windows.

### Pagination and Filters

Audit logs use a zero-based `page` and a `pageSize` capped at 1,000. `page=0` fetches only the first page. Continue through pages until all `total` matches have been read. Audit usernames are case-insensitive substring matches; actions are exact matches; `from` and `to` use RFC3339 timestamps.

Execution and exception filters have their own contract; use the corresponding operations in [OpenAPI](../openapi.yaml) rather than assuming every list uses the same parameters.

## Streaming

### Cluster SSE

`GET /api/cluster/stream` sends the current overview immediately, then an overview event when the cluster cache rebuilds after informer changes. It sends keepalive comments every 30 seconds. This is event-driven, so an unchanged cluster need not produce regular data events.

### WebSocket Protocol

`/ws/policy-executions/{id}/logs` authenticates the upgrade request with the session cookie. Missing or expired sessions receive HTTP 401 before the upgrade. A browser's `Origin` host must match the request host; use a same-origin deployment or development proxy for live logs.

Messages contain JSON log records, including their sequence, timestamp, level, and message. The server replays persisted history and the broker tail before live delivery, and closes normally when the execution finishes. Clients should deduplicate by sequence and reconcile with the HTTP log endpoint after reconnecting. See the [backend stream design](development/backend-data-flow.md).

### Observability SSE

`/api/observability/stream` delivers snapshots at a two-second cadence. Its history, threshold, and runtime configuration endpoints are documented in OpenAPI. The dashboard is alpha, and API Rivers is a cosmetic visualization with mock scenarios; read [observability](observability.md) before interpreting it as operational evidence.

## Error Responses

Handlers generally return an `error` field:

```json
{"error": "human-readable error message"}
```

Authentication/CSRF middleware and streaming failures can use different content types or terminate a stream, so clients should also inspect the HTTP status and stream lifecycle.

| Status | Typical meaning |
| :----- | :-------------- |
| `400` | Invalid body or parameters |
| `401` | Missing, expired, or invalid authentication |
| `403` | Disabled account, missing permission, failed CSRF, or rejected WebSocket origin |
| `404` | Resource not found |
| `409` | Conflicting policy targets, overlapping opposite-type exceptions, or conflicting execution state |
| `422` | Exception validation failure, such as an unresolved imported parent or a start time in the past |
| `429` | Login rate limit exceeded |
| `500` | Internal failure |

For troubleshooting a running application, see [troubleshooting](troubleshooting.md).
