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
  8. To include AD groups in the ID token: create a **Client scope** named `groups`, add a **Group Membership** mapper with **Token Claim Name** = `groups`, **Add to ID token** = `On`, **Full group path** = `Off`. Add this scope to the client as a **Default** scope.

  **TLS options for OIDC discovery/token exchange:**
  - **Custom CA certificate (recommended):** set `OIDC_SKIP_TLS_VERIFY` to `false` (default) and mount a CA bundle. In the Helm chart, set `oidc.caConfigMap` to the name of a ConfigMap containing the CA cert and `oidc.caCertKey` to the key name (default `cacert.pem`). This sets `SSL_CERT_FILE` so Go's TLS stack trusts the internal CA.
  - **Skip TLS verification (dev only):** set `OIDC_SKIP_TLS_VERIFY=true` to bypass certificate verification entirely. Useful for dev environments with self-signed certificates. **Not recommended for production.** When enabled, the custom CA cert mount is ignored.

### Roles

| Role | Permissions |
|---|---|
| **admin** | Full access: manage users, edit schedules/guardrails, trigger, reset DB, view audit |
| **operator** | Edit schedules/guardrails, trigger executions, view audit |
| **viewer** | Read-only: view overview, schedules, and history |

### Security

- Session tokens are stored in HTTP-only, Secure, SameSite=Strict cookies (immune to XSS)
- CSRF protection via double-submit cookie pattern (`__kp_csrf` cookie + `X-CSRF-Token` header)
- WebSocket auth uses cookies automatically on same-origin upgrade (no query param needed)

## Schedules

Each schedule defines when the scaler fires, how it fires, and which namespaces it targets.

### Schedule fields

| Field                | Description                                                                         |
| :------------------- | :---------------------------------------------------------------------------------- |
| **Name**             | Human-readable label                                                                |
| **Type**             | `scale_down` (sleep) or `scale_up` (wake) — immutable after creation               |
| **Cron expression**  | Standard 5-field cron (`minute hour dom month dow`)                                 |
| **Timezone**         | IANA timezone — e.g. `Europe/Budapest`. Defaults to `UTC`.                          |
| **Mode**             | `plan` — logs what would happen, no changes; `apply` — executes for real           |
| **Namespace filter** | Comma-separated namespace names to target. Leave empty to target all namespaces.    |
| **Enabled**          | Whether the schedule is active. Disabled schedules are skipped by the cron engine.  |
| **Position**         | Display order within each type group. Set automatically; updated via drag-and-drop. |

The toggle switch on each schedule card persists the change immediately — no need to open the edit dialog. The switch shows an optimistic update while the request is in flight and reverts automatically on failure.

Cards within each section (Sleep / Wake) can be reordered by dragging the handle on the right edge. The new order is persisted to the database and shared across all users — dragging in one section never affects the other.

### Default schedules

Four schedules are seeded on first startup, all in **plan mode** and **disabled**. Enable and switch to `apply` when you are confident the guardrails and namespace filters are correct. All default schedules use the `Europe/Budapest` timezone — adjust to your own timezone after installation.

| Name          | Cron            | Type         | When (Europe/Budapest) |
| :------------ | :-------------- | :----------- | :--------------------- |
| Weekday Sleep | `5 19 * * 1-5`  | `scale_down` | Mon–Fri 19:05          |
| Weekday Wake  | `0 7 * * 1-5`   | `scale_up`   | Mon–Fri 07:00          |
| Weekend Sleep | `0 0 * * 6,0`   | `scale_down` | Sat–Sun 00:00          |
| Weekend Wake  | `0 7 * * 1`     | `scale_up`   | Mon 07:00              |

---

## See also

- [Deployment](deployment.md) — Helm installation and values reference
- [Troubleshooting](troubleshooting.md) — common issues and fixes
- [API Reference](api.md) — endpoint documentation
