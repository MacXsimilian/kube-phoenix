# Configuration Reference

This page owns runtime defaults, authentication settings, policy fields, and guardrail behavior. For Helm values and installation, use [deployment](deployment.md); for a local environment, use [local development](local-development.md). The full API schemas live in [OpenAPI](../openapi.yaml).

## Choose Where to Configure

| Setting | Where it takes effect |
| :------ | :-------------------- |
| Backend environment variables and CLI flags | Process startup; restart after a change |
| Helm values | Deployment configuration; upgrade the release to apply changes |
| Frontend `NEXT_PUBLIC_*` variables | Build time; rebuild the static export |
| Policies and guardrails | Database-backed settings edited in the application; scheduler settings reload on save |

## Environment Variables

### Backend Runtime

| Variable | Default | Required | Description |
| :------- | :------ | :------- | :---------- |
| `DATABASE_URL` | -- | Yes | PostgreSQL DSN (e.g., `host=localhost user=kube_phoenix password=secret dbname=kube_phoenix port=5432 sslmode=disable`) |
| `ADMIN_USER` | -- | No | Seed admin username, used with `ADMIN_PASSWORD` only when the users table is empty |
| `ADMIN_PASSWORD` | -- | No | Seed admin password; changing it does not reset an existing account |
| `SESSION_IDLE_TIMEOUT` | `8h` | No | Sliding-window session timeout, extended on each request |
| `SESSION_MAX_LIFETIME` | `24h` | No | Absolute session hard cap, regardless of activity |
| `AUDIT_RETENTION_DAYS` | `90` | No | Auto-delete audit entries older than this many days (`0` = keep forever) |
| `COOKIE_SECURE` | `true` | No | Set to `false` for HTTP-only dev environments |
| `CORS_ALLOWED_ORIGIN` | -- | No | Explicit allowed origin, e.g. `http://localhost:3000`; takes precedence over the fallback described under [CORS](#cors) |
| `KUBECONFIG` | -- | No | Path to kubeconfig file. Fallback when in-cluster config is unavailable. |
| `CLUSTER_NAME` | -- | No | Human-readable cluster name returned by `GET /api/cluster/info`. When unset, the endpoint omits the field. |
| `K8S_QPS` | `100` | No | Sustained K8s API requests per second (client-go default: 5). Higher values speed up large scaling events but increase control plane load. |
| `K8S_BURST` | `200` | No | Short spike allowance above `K8S_QPS` (client-go default: 10). The K8s API server's own APF throttling acts as a server-side safety net. |
| `AUTO_MIGRATE` | `true` | No | Set to `false` to skip startup AutoMigrate. The database schema must already match the application; this flag does not provide a separate migration workflow. |
| `DB_MAX_OPEN_CONNS` | `10` | No | Maximum number of open database connections. Raise for clusters with many parallel policies or large workload counts. |
| `DB_MAX_IDLE_CONNS` | `5` | No | Maximum number of idle database connections retained in the pool. |
| `DB_CONN_MAX_LIFETIME_MIN` | `5` | No | Connection maximum lifetime in minutes. Connections older than this are closed and replaced. |

### OIDC Variables

| Variable | Default | Required | Description |
| :------- | :------ | :------- | :---------- |
| `OIDC_ISSUER_URL` | -- | No | Keycloak realm URL. Enables OIDC SSO when set. |
| `OIDC_CLIENT_ID` | -- | No | Keycloak client ID |
| `OIDC_CLIENT_SECRET` | -- | No | Keycloak client secret (leave empty for PKCE-only public clients) |
| `OIDC_REDIRECT_URL` | -- | No | Callback URL (e.g., `https://kube-phoenix.example.com/api/auth/oidc/callback`) |
| `OIDC_GROUPS_CLAIM` | `groups` | No | ID token claim name containing AD groups |
| `OIDC_ROLE_ADMIN_GROUPS` | -- | No | Comma-separated AD group names mapped to the `admin` role |
| `OIDC_ROLE_OPERATOR_GROUPS` | -- | No | Comma-separated AD group names mapped to the `operator` role. Unmatched users default to `viewer`. |
| `OIDC_SKIP_TLS_VERIFY` | `false` | No | Skip TLS verification for the OIDC provider (dev only) |

### CLI Flags

| Flag | Default | Description |
| :--- | :------ | :---------- |
| `-port` | `8080` | Server listen port |
| `-healthcheck` | `false` | Probe `/healthz` on the loopback listen port and exit with status 0 or 1; used by the container health check |

### Frontend Build-Time Variables

These are Next.js build-time variables baked into the static export, not backend runtime variables.

| Variable | Default | Description |
| :------- | :------ | :---------- |
| `NEXT_PUBLIC_API_URL` | `""` | API base URL for dev mode (empty = same-origin) |
| `NEXT_PUBLIC_APP_VERSION` | Build-dependent; see below | Version string used by the About modal; Docker builds also inject it into the backend binary |

### Application Build Versions

| Build mode | Version source |
| :--------- | :------------- |
| Standalone frontend (`make dev-frontend`, `make dev-mock`, or `npm run build`) | When `NEXT_PUBLIC_APP_VERSION` is unset, the About modal falls back to `version` in `frontend/package.json` |
| Direct Docker build without a version build argument | The Dockerfile defaults `NEXT_PUBLIC_APP_VERSION` to `dev` |
| `make docker-build` | Passes `TAG` as `NEXT_PUBLIC_APP_VERSION`; `TAG` defaults to the short Git commit hash and can be overridden |
| Release workflow | Passes the release tag, such as `vX.Y.Z`, as `NEXT_PUBLIC_APP_VERSION` |

An explicitly empty `NEXT_PUBLIC_APP_VERSION` does not trigger the frontend fallback. Setting it to `dev`, as in `.env.example`, is an explicit override.

Docker builds embed the same supplied value in the backend's `GET /api/version` response through Go linker flags. A backend started with `go run` or built without those flags reports `dev`; setting a runtime environment variable does not change that embedded value.

## Authentication

kube-phoenix uses session-based authentication with HTTP-only cookies. Sessions are stored in PostgreSQL with dual expiry: a sliding idle timeout and an absolute hard cap.

### Authentication Modes

**Local login.** Username and password via `POST /api/auth/login`. Passwords are bcrypt-hashed. Rate-limited to 10 attempts per IP and 5 per username per 15-minute window.

**Keycloak OIDC.** Set `OIDC_ISSUER_URL` to enable SSO. Uses Authorization Code flow with PKCE (S256). AD groups from the ID token are mapped to application roles via `OIDC_ROLE_ADMIN_GROUPS` and `OIDC_ROLE_OPERATOR_GROUPS`. Unmatched users default to `viewer`. OIDC users are auto-provisioned on first login.

Both seed variables are needed to create an admin when the users table is empty. Omitting them skips seeding; it does not disable authentication or existing local accounts. OIDC can also provision users when configured.

### CORS

The backend chooses allowed origins in this order:

1. A non-empty `CORS_ALLOWED_ORIGIN` permits that explicit origin, regardless of `ADMIN_USER`.
2. With no explicit origin and a non-empty `ADMIN_USER`, cross-origin API requests are not allowed; use the same origin as the application.
3. With both variables empty, the CORS configuration permits all origins. Authentication still applies.

For separate local frontend/backend processes, set `CORS_ALLOWED_ORIGIN=http://localhost:3000` and `COOKIE_SECURE=false` on the backend. Live log WebSockets additionally require a matching origin host; use a same-origin proxy if needed. See [local development](local-development.md) for complete startup commands.

### Keycloak Client Setup

1. Create an **OpenID Connect** client with Client ID `kube-phoenix` (or your preferred name).
2. Set **Client authentication** to `On` (confidential client).
3. Enable **Standard flow** only. Disable Direct access grants, Implicit flow, and Device Authorization Grant.
4. Set **Valid redirect URIs** to `https://<your-domain>/api/auth/oidc/callback`.
5. Set **Web origins** to `https://<your-domain>`.
6. Under the **Advanced** tab, set **Proof Key for Code Exchange Code Challenge Method** to `S256`.
7. Copy the **Client secret** from the **Credentials** tab and set it as `OIDC_CLIENT_SECRET`.
8. Set **Valid post logout redirect URIs** to `https://<your-domain>/`. Required for the Sign Out button to fully terminate the Keycloak session.
9. To include AD groups in the ID token: create a **Client scope** named `groups`, add a **Group Membership** mapper with **Token Claim Name** = `groups`, **Add to ID token** = `On`, **Full group path** = `Off`. Add this scope to the client as a **Default** scope.

Role mapping uses only the claim configured by `OIDC_GROUPS_CLAIM` (default `groups`). A missing claim assigns the viewer role; a present claim must be an array of strings or login is rejected. When using a custom claim, verify its identity-provider mapping before upgrading: standard `groups` membership no longer supplies fallback privileges.

### OIDC TLS Options

**Custom CA certificate (recommended):** Mount a CA bundle via ConfigMap. In the Helm chart, set `oidc.caConfigMap` to the ConfigMap name and `oidc.caCertKey` to the key (default `cacert.pem`). This sets `SSL_CERT_FILE` so the Go TLS stack trusts the internal CA.

**Skip TLS verification (dev only):** Set `OIDC_SKIP_TLS_VERIFY=true` to bypass certificate verification entirely. When enabled, the custom CA cert mount is ignored.

> **Warning:** Do not use `OIDC_SKIP_TLS_VERIFY=true` in production. Use a proper CA certificate instead.

### Session Security

- Session cookies are HTTP-only, Secure by default, and SameSite=Strict. HTTP-only prevents scripts from reading the session cookie; it does not prevent all consequences of script injection.
- CSRF protection uses the double-submit cookie pattern: `__kp_csrf` cookie + `X-CSRF-Token` header on authenticated mutating requests (POST, PUT, DELETE). Login starts a session without an existing CSRF token.
- WebSocket connections authenticate via cookies automatically on same-origin upgrades.

## RBAC Roles and Permissions

| Capability | admin | operator | viewer |
| :--------- | :---: | :------: | :----: |
| View overview, cluster state, history | Yes | Yes | Yes |
| View policies and guardrails | Yes | Yes | Yes |
| View audit logs | Yes | Yes | Yes |
| Create, edit, delete policies | Yes | Yes | No |
| Edit guardrails | Yes | Yes | No |
| Trigger Sleep Now / Wake Now / Cancel | Yes | Yes | No |
| Manage exceptions | Yes | Yes | No |
| Manage users | Yes | No | No |
| Reset database | Yes | No | No |
| Emergency scale (disable policies, wake sleeping workloads) | Yes | No | No |

## Policy Configuration

A **Policy** declares when workloads should sleep and wake. Unlike legacy per-schedule entries, a policy combines both sleep and wake timing in one resource.

### Policy Fields

| Field | Type | Description |
| :---- | :--- | :---------- |
| Name | string | Human-readable label (max 255 characters) |
| Description | string | Optional longer description (max 1024 characters) |
| Sleep Windows | JSON array | Required array of 1–10 windows, using days of week, start/end times, and an all-day flag. |
| Timezone | string | IANA timezone (e.g., `Europe/Budapest`). Defaults to `UTC`. |
| Mode | enum | `plan` (dry-run, logs only) or `apply` (executes scaling operations) |
| Enabled | bool | Whether the policy fires on schedule. Manual triggers work regardless. |
| Namespace Filter | string | Comma-separated namespace names. Empty = all namespaces. |
| Label Selector | string | Standard Kubernetes label selector syntax (e.g., `app=api,tier!=db`) |
| Timeout Minutes | int | Max execution duration, 0--1440. `0` uses the server's two-hour execution timeout. |

### Policy States

| State | Meaning |
| :---- | :------ |
| `awake` | Recorded awake scheduler state |
| `sleeping` | Recorded sleeping scheduler state |
| `transitioning` | A sleep or wake execution is in progress (can be cancelled via `POST /api/policies/{id}/cancel`) |
| `unknown` | Intended state could not be determined, or an execution/recovery left state uncertain |

These are scheduler states, initialized from the current windows on creation and updated by executions. They are not pod-readiness checks. Plan executions can update policy state while leaving Kubernetes resources unchanged. Verify live replicas and execution mode when assessing an operation.

### Scheduled Exceptions

> **Note:** Active exceptions take precedence over the normal sleep window schedule.

Exceptions are one-time windows for planned events such as release weekends or on-call periods.

| Field | Description |
| :---- | :---------- |
| Exception Type | `stay_awake` or `force_sleep` |
| Exception Window | Start and end of the window (must be in the future at creation). Picked from an inline two-month calendar with hour:minute steppers; times are in the browser's local timezone. |
| Ticket Ref | External ticket reference (e.g., `JIRA-1234`, `GH#567`) |
| Reason | Free-text reason |
| Sleep on End | If true (default), re-evaluates the normal schedule when the window ends and triggers sleep or wake accordingly |
| Namespace Filter / Label Selector | Optional narrowing filters; defaults to the policy's own targeting |

**Lifecycle:** `pending` -> `active` (when `startsAt` is reached) -> `completed` (when `endsAt` is reached). Deleting an active exception with `sleepOnEnd=true` also requests a return to the schedule's current intended state. The return action is skipped for a disabled parent or an unknown intended state.

## Recovery and State Transitions

On startup, kube-phoenix evaluates each enabled policy's sleep windows and active exceptions to compute the **intended state** at the current time. If this differs from the persisted `currentState`, a recovery execution is queued automatically.

Key behaviors:

- Legacy or malformed stored policies without sleep windows have no window-derived intended state. Current create/import endpoints require windows.
- If recovery cannot determine the intended state, the state remains `unknown`. Use **Sleep Now** or **Wake Now** to set a known state.
- Recovery runs respect the current mode (`plan` or `apply`). Verify guardrails and namespace filters before switching to `apply` mode.

## Guardrails

Guardrails protect critical resources from being touched by the scaler. Configure them via the UI or the `PUT /api/guardrails` endpoint.

| Guardrail | Description |
| :-------- | :---------- |
| Skip Namespaces | Namespaces excluded from all sleep operations (e.g., `kube-system`, `monitoring`) |
| Skip Node Labels | Nodes with these labels are never cordoned, drained, or deleted |
| Skip Node Taints | Nodes with these taints are never cordoned, drained, or deleted |
| Scaling Priority Namespaces | Ordered list of namespaces that are scaled first during sleep and wake runs. Workloads in these namespaces are processed before all others, in list order. Empty by default (no priority). |
| Scaling Concurrency | Max workloads scaled in parallel during sleep/wake (1–50, default 10). Higher values increase throughput but generate more concurrent K8s API calls. |
| Protect Critical Pod Nodes | Opt-in, off by default. Protects nodes running non-DaemonSet pods with system-node-critical or system-cluster-critical priority. |
| Scheduler Eval Interval | How often all enabled policies are evaluated. Accepts Go duration strings (`30s`, `1m`, `2m`). Changes take effect immediately — the ticker restarts with the new interval. |
| Auto Wake | When disabled, the scheduler will only trigger sleep executions automatically. Wake transitions must be triggered manually. |
| Reconcile While Awake | When enabled (default), the scheduler detects drift from failed or partial wake executions — workloads left at zero despite the policy being awake — and runs a corrective wake to restore them. Corrective wakes back off at 5-minute intervals per policy and bypass the Auto Wake gate. When disabled, the scheduler skips reconciliation for policies already awake, reducing database load between sleep windows. |
| Enforce Sleep | When enabled (default), the scheduler detects workloads manually scaled up during a sleep window and scales them back to zero. Uses targeted K8s GETs against open snapshots to detect drift, then runs a corrective sleep. Backs off at 5-minute intervals per policy. Respects system namespace guardrails and active stay_awake exceptions. |

> **Tip:** Scheduler settings take effect immediately on save — no server restart required.

> **Tip:** Guardrails are evaluated at execution time, not at policy creation time. Adding a namespace to Skip Namespaces protects it from future sleep/scaling-down operations. Wake still restores existing snapshots in that namespace.

Namespace and workload selectors scope workload scaling. They do not limit the node-drain phase to those namespaces: configure node protection separately. Wake restores replica counts from open database snapshots; it does not uncordon or recreate nodes. If sleep removed capacity, an external autoscaler must supply it. Follow the [first-policy walkthrough](first-policy.md) for a disposable-cluster exercise with explicit node protection.

Implementation defaults: [runtime configuration](../backend/internal/config/config.go), [seeded guardrails](../backend/internal/store/queries.go), [guardrail model defaults](../backend/internal/store/models.go), and [role permissions](../backend/internal/auth/permissions.go).
