# Configuration Reference

## Environment Variables

### Backend Runtime

| Variable | Default | Required | Description |
| :------- | :------ | :------- | :---------- |
| `DATABASE_URL` | -- | Yes | PostgreSQL DSN (e.g., `host=localhost user=kube_phoenix password=secret dbname=kube_phoenix port=5432 sslmode=disable`) |
| `ADMIN_USER` | -- | No | Username for the seeded admin account (first startup only). When unset, authentication is disabled (dev mode). |
| `ADMIN_PASSWORD` | -- | No | Password for the seeded admin account (first startup only) |
| `SESSION_IDLE_TIMEOUT` | `8h` | No | Sliding-window session timeout, extended on each request |
| `SESSION_MAX_LIFETIME` | `24h` | No | Absolute session hard cap, regardless of activity |
| `AUDIT_RETENTION_DAYS` | `90` | No | Auto-delete audit entries older than this many days (`0` = keep forever) |
| `COOKIE_SECURE` | `true` | No | Set to `false` for HTTP-only dev environments |
| `CORS_ALLOWED_ORIGIN` | -- | No | Allowed CORS origin (e.g., `https://kube-phoenix.example.com`). Unset = same-origin only. In dev mode, CORS allows all origins. |
| `KUBECONFIG` | -- | No | Path to kubeconfig file. Fallback when in-cluster config is unavailable. |
| `CLUSTER_NAME` | -- | No | Human-readable cluster name returned by `GET /api/cluster/info`. When unset, the endpoint omits the field. |
| `K8S_QPS` | `100` | No | Sustained K8s API requests per second (client-go default: 5). Higher values speed up large scaling events but increase control plane load. |
| `K8S_BURST` | `200` | No | Short spike allowance above `K8S_QPS` (client-go default: 10). The K8s API server's own APF throttling acts as a server-side safety net. |

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

### Frontend Build-Time Variables

These are Next.js build-time variables baked into the static export, not backend runtime variables.

| Variable | Default | Description |
| :------- | :------ | :---------- |
| `NEXT_PUBLIC_API_URL` | `""` | API base URL for dev mode (empty = same-origin) |
| `NEXT_PUBLIC_APP_VERSION` | `""` | Version string shown in the About modal |
| `NEXT_PUBLIC_PROTOTYPES` | `""` | Set to `1` to enable the `/prototypes` route and sidebar link. Automatically set by `make dev-mock`. When unset, prototype pages are excluded from the build entirely. |

## Authentication

kube-phoenix uses session-based authentication with HTTP-only cookies. Sessions are stored in PostgreSQL with dual expiry: a sliding idle timeout and an absolute hard cap.

### Authentication Modes

**Local login.** Username and password via `POST /api/auth/login`. Passwords are bcrypt-hashed. Rate-limited to 10 attempts per IP and 5 per username per 15-minute window.

**Keycloak OIDC.** Set `OIDC_ISSUER_URL` to enable SSO. Uses Authorization Code flow with PKCE (S256). AD groups from the ID token are mapped to application roles via `OIDC_ROLE_ADMIN_GROUPS` and `OIDC_ROLE_OPERATOR_GROUPS`. Unmatched users default to `viewer`. OIDC users are auto-provisioned on first login.

When neither `ADMIN_USER` nor `ADMIN_PASSWORD` is set, the application runs without authentication (dev mode).

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

### OIDC TLS Options

**Custom CA certificate (recommended):** Mount a CA bundle via ConfigMap. In the Helm chart, set `oidc.caConfigMap` to the ConfigMap name and `oidc.caCertKey` to the key (default `cacert.pem`). This sets `SSL_CERT_FILE` so the Go TLS stack trusts the internal CA.

**Skip TLS verification (dev only):** Set `OIDC_SKIP_TLS_VERIFY=true` to bypass certificate verification entirely. When enabled, the custom CA cert mount is ignored.

> **Warning:** Do not use `OIDC_SKIP_TLS_VERIFY=true` in production. Use a proper CA certificate instead.

### Session Security

- Session tokens are stored in HTTP-only, Secure, SameSite=Strict cookies (immune to XSS).
- CSRF protection uses the double-submit cookie pattern: `__kp_csrf` cookie + `X-CSRF-Token` header on all mutating requests (POST, PUT, DELETE).
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
| Sleep Windows | JSON array | Array of sleep window objects (1--10). Each window specifies days of week, start/end time, and optional all-day flag. |
| Timezone | string | IANA timezone (e.g., `Europe/Budapest`). Defaults to `UTC`. |
| Mode | enum | `plan` (dry-run, logs only) or `apply` (executes scaling operations) |
| Enabled | bool | Whether the policy fires on schedule. Manual triggers work regardless. |
| Namespace Filter | string | Comma-separated namespace names. Empty = all namespaces. |
| Label Selector | string | Standard Kubernetes label selector syntax (e.g., `app=api,tier!=db`) |
| Timeout Minutes | int | Max execution duration, 0--1440. Defaults to 30. |

### Policy States

| State | Meaning |
| :---- | :------ |
| `awake` | Workloads are running normally |
| `sleeping` | Workloads are scaled to zero |
| `transitioning` | A sleep or wake execution is in progress (can be cancelled via `POST /api/policies/{id}/cancel`) |
| `unknown` | State not yet determined (new policy or indeterminate recovery) |

### Scheduled Exceptions

> **Note:** Active exceptions take precedence over the normal sleep window schedule.

Exceptions are one-time windows for planned events such as release weekends or on-call periods.

| Field | Description |
| :---- | :---------- |
| Exception Type | `stay_awake` or `force_sleep` |
| Starts At / Ends At | Window boundaries (must be in the future at creation) |
| Ticket Ref | External ticket reference (e.g., `JIRA-1234`, `GH#567`) |
| Reason | Free-text reason |
| Sleep on End | If true (default), triggers a sleep run when the window ends |
| Namespace Filter / Label Selector | Optional narrowing filters; defaults to the policy's own targeting |

**Lifecycle:** `pending` -> `active` (when `startsAt` is reached) -> `completed` (when `endsAt` is reached). Deleting an active exception with `sleepOnEnd=true` triggers an immediate sleep run.

## Recovery and State Transitions

On startup, kube-phoenix evaluates each policy's sleep windows and active exceptions to compute the **intended state** at the current time. If this differs from the persisted `currentState`, a recovery execution is queued automatically.

Key behaviors:

- A fresh policy (no sleep windows) starts with `currentState: unknown` and stays there until a manual trigger or evaluation tick fires.
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
| Protect Critical Pod Nodes | When enabled (default), nodes running system-critical priority pods are never drained. |
| Scheduler Eval Interval | How often all enabled policies are evaluated. Accepts Go duration strings (`30s`, `1m`, `2m`). Changes take effect immediately — the ticker restarts with the new interval. |
| Auto Wake | When disabled, the scheduler will only trigger sleep executions automatically. Wake transitions must be triggered manually. |
| Reconcile While Awake | When enabled (default), the scheduler detects drift from failed or partial wake executions — workloads left at zero despite the policy being awake — and runs a corrective wake to restore them. Corrective wakes back off at 5-minute intervals per policy and bypass the Auto Wake gate. When disabled, the scheduler skips reconciliation for policies already awake, reducing database load between sleep windows. |
| Enforce Sleep | When enabled (default), the scheduler detects workloads manually scaled up during a sleep window and scales them back to zero. Uses targeted K8s GETs against open snapshots to detect drift, then runs a corrective sleep. Backs off at 5-minute intervals per policy. Respects system namespace guardrails and active stay_awake exceptions. |

> **Tip:** Scheduler settings take effect immediately on save — no server restart required.

> **Tip:** Guardrails are evaluated at execution time, not at policy creation time. Adding a namespace to Skip Namespaces immediately protects it from all future executions.
