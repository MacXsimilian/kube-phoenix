# Configuration

## Environment variables

| Variable              | Required | Description                                                                                                                                                                               |
| :-------------------- | :------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`        | Yes      | PostgreSQL DSN — e.g. `host=localhost user=kube_phoenix password=kube_phoenix dbname=kube_phoenix port=5432 sslmode=disable`                                                              |
| `BASIC_AUTH_USER`     | No       | HTTP Basic Auth username. Unset = auth disabled (dev mode).                                                                                                                               |
| `BASIC_AUTH_PASSWORD` | No       | HTTP Basic Auth password.                                                                                                                                                                 |
| `CORS_ALLOWED_ORIGIN` | No       | Allowed CORS origin (e.g. `https://kube-phoenix.example.com`). Unset = no cross-origin requests permitted. Useful when the frontend is served from a different origin during development. |

## Authentication

kube-phoenix uses a branded login screen backed by HTTP Basic Auth. Credentials are stored in `sessionStorage` and injected into every API request — no browser native auth dialog.

Set `BASIC_AUTH_USER` and `BASIC_AUTH_PASSWORD` to enable authentication. When both are unset the application runs without authentication (dev mode).

WebSocket log streams authenticate via a `?token=<base64(user:pass)>` query parameter — browsers cannot set `Authorization` headers on WebSocket upgrades.

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
