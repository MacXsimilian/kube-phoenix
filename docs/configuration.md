# Configuration

## Environment variables

| Variable              | Required | Description                                                                                                                                                                               |
| :-------------------- | :------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`        | Yes      | PostgreSQL DSN — e.g. `host=localhost user=kube_phoenix password=kube_phoenix dbname=kube_phoenix port=5432 sslmode=disable`                                                              |
| `ADMIN_USER`          | No       | Username for the seeded admin account (first startup only). Unset = auth disabled (dev mode).                                                                                             |
| `ADMIN_PASSWORD`      | No       | Password for the seeded admin account (first startup only).                                                                                                                               |
| `SESSION_IDLE_TIMEOUT`| No       | Sliding-window session timeout (default `8h`). Extended on each request.                                                                                                                  |
| `SESSION_MAX_LIFETIME`| No       | Absolute session hard cap (default `24h`). Session dies regardless of activity.                                                                                                           |
| `AUDIT_RETENTION_DAYS`| No       | Auto-delete audit log entries older than this many days (default `90`, `0` = keep forever).                                                                                               |
| `COOKIE_SECURE`       | No       | Set to `false` for HTTP-only dev environments (default `true`).                                                                                                                           |
| `CORS_ALLOWED_ORIGIN` | No       | Allowed CORS origin (e.g. `https://kube-phoenix.example.com`). Unset = same-origin only. In dev mode: CORS allows all origins (`*`).                                                     |
| `KUBECONFIG`          | No       | Path to kubeconfig file. Used as fallback when in-cluster config is unavailable (e.g. running locally).                                                                                   |
| `OIDC_ISSUER_URL`     | No       | Keycloak realm URL (e.g. `https://keycloak.example.com/realms/your-realm`). Enables OIDC SSO when set.                                                                                   |
| `OIDC_CLIENT_ID`      | No       | Keycloak client ID (e.g. `kube-phoenix`).                                                                                                                                                 |
| `OIDC_CLIENT_SECRET`  | No       | Keycloak client secret (leave empty for PKCE-only public clients).                                                                                                                        |
| `OIDC_REDIRECT_URL`   | No       | Callback URL (e.g. `https://kube-phoenix.example.com/api/auth/oidc/callback`).                                                                                                            |
| `OIDC_GROUPS_CLAIM`   | No       | ID token claim name containing AD groups (default `groups`).                                                                                                                              |
| `OIDC_ROLE_ADMIN_GROUPS`   | No  | Comma-separated AD group names that map to the `admin` role.                                                                                                                              |
| `OIDC_ROLE_OPERATOR_GROUPS`| No  | Comma-separated AD group names that map to the `operator` role. Unmatched users default to `viewer`.                                                                                      |
| `OIDC_SKIP_TLS_VERIFY`    | No  | Set to `true` to skip TLS certificate verification for the OIDC provider (e.g. self-signed certs). **Not recommended for production.**                                                    |

### CLI flags

| Flag    | Default | Description          |
| :------ | :------ | :------------------- |
| `-port` | `8080`  | Server listen port   |

### Frontend build-time variables

These are Next.js build-time variables, not backend runtime variables.

| Variable                 | Default | Description                                          |
| :----------------------- | :------ | :--------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`    | `""`    | API base URL for dev mode (empty = same-origin)      |
| `NEXT_PUBLIC_APP_VERSION`| `""`    | Version string shown in About modal (set in Docker build) |

## Authentication

kube-phoenix uses session-based authentication with HTTP-only cookies. Sessions are stored in PostgreSQL with dual expiry (idle timeout + absolute hard cap).

Set `ADMIN_USER` and `ADMIN_PASSWORD` to seed the first admin account on startup. When neither is set the application runs without authentication (dev mode).

### Auth methods

- **Local login** — username/password via `POST /api/auth/login`. Passwords are bcrypt-hashed. Rate-limited: 10 attempts per IP / 5 per username per 15-minute window.
- **Keycloak OIDC** — set `OIDC_ISSUER_URL` to enable SSO. Uses Authorization Code flow with PKCE (S256). AD groups from the ID token are mapped to roles (admin/operator/viewer) via `OIDC_ROLE_ADMIN_GROUPS` / `OIDC_ROLE_OPERATOR_GROUPS`. Unmatched users default to viewer. OIDC users are auto-provisioned on first login. The standard claims `preferred_username`, `email`, `given_name`, and `family_name` are synced to the user profile on every login.

  **Keycloak client setup:**
  1. Create an **OpenID Connect** client with **Client ID** `kube-phoenix` (or your preferred name).
  2. Set **Client authentication** to `On` (confidential client).
  3. Enable **Standard flow** only. Disable Direct access grants, Implicit flow, and Device Authorization Grant.
  4. Set **Valid redirect URIs** to `https://<your-domain>/api/auth/oidc/callback`.
  5. Set **Web origins** to `https://<your-domain>`.
  6. Under the **Advanced** tab, set **Proof Key for Code Exchange Code Challenge Method** to `S256`.
  7. Copy the **Client secret** from the **Credentials** tab → set as `OIDC_CLIENT_SECRET`.
  8. Set **Valid post logout redirect URIs** to `https://<your-domain>/`. This is required for the Sign Out button to fully terminate the Keycloak SSO session and redirect the browser back to the login page.
  9. To include AD groups in the ID token: create a **Client scope** named `groups`, add a **Group Membership** mapper with **Token Claim Name** = `groups`, **Add to ID token** = `On`, **Full group path** = `Off`. Add this scope to the client as a **Default** scope.

  **TLS options for OIDC discovery/token exchange:**
  - **Custom CA certificate (recommended):** set `OIDC_SKIP_TLS_VERIFY` to `false` (default) and mount a CA bundle. In the Helm chart, set `oidc.caConfigMap` to the name of a ConfigMap containing the CA cert and `oidc.caCertKey` to the key name (default `cacert.pem`). This sets `SSL_CERT_FILE` so Go's TLS stack trusts the internal CA.
  - **Skip TLS verification (dev only):** set `OIDC_SKIP_TLS_VERIFY=true` to bypass certificate verification entirely. Useful for dev environments with self-signed certificates. **Not recommended for production.** When enabled, the custom CA cert mount is ignored.

### Roles

| Role | Permissions |
|---|---|
| **admin** | Full access: manage users, edit policies/guardrails, trigger, reset DB, view audit |
| **operator** | Edit policies/guardrails, trigger executions, view audit |
| **viewer** | Read-only: view overview, policies, and history |

### Security

- Session tokens are stored in HTTP-only, Secure, SameSite=Strict cookies (immune to XSS)
- CSRF protection via double-submit cookie pattern (`__kp_csrf` cookie + `X-CSRF-Token` header)
- WebSocket auth uses cookies automatically on same-origin upgrade (no query param needed)

## Policies

A **Policy** is the recommended way to configure sleep/wake scheduling. Unlike the legacy Schedule model (two separate `scale_down` / `scale_up` entries), a policy declares both the sleep and wake crons in one place.

### Policy fields

| Field | Description |
| :---- | :---------- |
| **Name** | Human-readable label (max 255 chars) |
| **Description** | Optional longer description (max 1024 chars) |
| **Sleep Cron** | 5-field cron for when workloads should scale to 0. Optional if Wake Cron is set. |
| **Wake Cron** | 5-field cron for when workloads should be restored. Optional if Sleep Cron is set. |
| **Timezone** | IANA timezone — e.g. `Europe/Budapest`. Defaults to `UTC`. |
| **Mode** | `plan` — dry-run, logs only; `apply` — executes for real |
| **Enabled** | Whether the policy fires on its cron schedule. Manual triggers always work regardless. |
| **Namespace Filter** | Comma-separated namespace names. Leave empty to target all namespaces. Each name must be a valid Kubernetes DNS label: lowercase alphanumeric and hyphens only, must start and end with alphanumeric, max 63 characters. |
| **Label Selector** | Standard Kubernetes label selector syntax (e.g. `app=api,tier!=db`). Evaluated via `k8s.io/apimachinery/pkg/labels`. |
| **Timeout Minutes** | Max execution duration in minutes (0–1440). Defaults to 30. |

### Policy state

A policy tracks its `currentState`:

| State | Meaning |
|---|---|
| `awake` | Workloads are running normally |
| `sleeping` | Workloads are scaled to 0 |
| `transitioning` | A sleep or wake run is currently in progress |
| `unknown` | State has not been determined yet (fresh policy or after a restart) |

On startup, the intended state at `now` is computed from the cron schedule and override stack. If it differs from `currentState`, a **recovery execution** is queued automatically.

### Overrides

Overrides take precedence over the normal cron schedule for a policy:

| Type | Description |
|---|---|
| `stay_awake` | Windowed override — keep workloads running between `startsAt` and `endsAt`, even during a normal sleep window |
| `force_sleep` | Windowed override — keep workloads at 0 between `startsAt` and `endsAt`, even during a normal wake window |
| `skip_sleep` | Skip exactly one sleep cron tick (identified by `targetCronTime`) |
| `skip_wake` | Skip exactly one wake cron tick (identified by `targetCronTime`) |

Precedence order (highest to lowest): `force_sleep` > `stay_awake` > skip overrides > cron schedule.

### Scheduled Exceptions

Exceptions are one-time windows — useful for release weekends or on-call periods — that can be scheduled in advance.

| Field | Description |
|---|---|
| **Exception Type** | `stay_awake` or `force_sleep` |
| **Starts At / Ends At** | The window boundaries (must be in the future at creation) |
| **Ticket Ref** | External ticket reference (e.g. `JIRA-1234`, `GH#567`) |
| **Reason** | Free-text reason |
| **Sleep on End** | If true (default), immediately trigger a sleep run when the window ends |
| **Namespace Filter / Label Selector** | Optional overrides; defaults to the policy's own targeting |

**Lifecycle:** `pending` → `active` (when `startsAt` is reached) → `completed` (when `endsAt` is reached). Deleting a pending or active exception cancels it; if active and `sleepOnEnd` is true, a sleep run fires immediately.

The exception tick loop runs every minute and transitions exceptions between states automatically.

---

## Recovery & state transitions

On startup, kube-phoenix evaluates each policy's cron schedule and override stack to compute the **intended state** at the current time. If this differs from the policy's `currentState`, a recovery execution is queued automatically.

- A fresh policy (or one with no cron expressions) starts with `currentState: unknown` and stays there until a manual trigger or a cron tick fires.
- If recovery cannot determine the intended state (no `sleepCron` or `wakeCron` configured, or no past fire times), the state remains `unknown`. Use **Sleep Now** or **Wake Now** to set a known state.
- Verify guardrails and namespace filters before switching a policy from `plan` to `apply` mode — recovery runs respect the current mode.

See [Troubleshooting](troubleshooting.md#a-policy-shows-unknown-currentstate-after-startup) for more detail on `unknown` states.

---

## See also

- [Deployment](deployment.md) — Helm installation and values reference
- [Troubleshooting](troubleshooting.md) — common issues and fixes
- [API Reference](api.md) — endpoint documentation
