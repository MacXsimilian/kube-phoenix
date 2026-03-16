# API Reference

## Swagger UI

Interactive API documentation is available at **`/api/docs/`** (Swagger UI v5, embedded — no CDN). The raw OpenAPI 3.1 spec is served at **`/api/docs/openapi.yaml`**. Both are protected by Basic Auth when configured.

The canonical spec source is [`openapi.yaml`](../openapi.yaml) at the repo root.

---

All `/api/*` and `/ws/*` endpoints require Basic Auth when configured. `/healthz` is always open.

WebSocket connections authenticate via `?token=<base64(user:pass)>` — browsers cannot set `Authorization` headers on WebSocket upgrades.

## Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/healthz` | Health check (DB ping) |
| `GET` | `/api/schedules` | List all schedules ordered by position (includes `nextRun` per schedule) |
| `POST` | `/api/schedules` | Create schedule |
| `PUT` | `/api/schedules/reorder` | Reorder within a type — body: `{"type":"scale_down","ids":[3,1,2]}` |
| `GET` | `/api/schedules/:id` | Get schedule |
| `PUT` | `/api/schedules/:id` | Update schedule (`type` is immutable) |
| `DELETE` | `/api/schedules/:id` | Delete schedule |
| `GET` | `/api/executions` | List executions (filters: `schedule_id`, `status`, `page`, `page_size`) |
| `GET` | `/api/executions/:id` | Get execution |
| `GET` | `/api/executions/:id/logs` | Get all log lines for an execution |
| `GET` | `/ws/executions/:id/logs` | WebSocket — live log streaming |
| `GET` | `/api/cluster/stream` | SSE stream — pushed overview updates every ~10 s |
| `GET` | `/api/cluster/workloads` | List Deployments and StatefulSets |
| `GET` | `/api/cluster/nodes` | List nodes with protection status |
| `GET` | `/api/cluster/nodes/:name/pods` | List non-DaemonSet pods on a node |
| `GET` | `/api/cluster/pods/:namespace/:name` | Full pod detail — containers, conditions, events, labels, annotations |
| `GET` | `/api/cluster/workloads/:namespace/:kind/:name/pods` | List pods belonging to a Deployment or StatefulSet |
| `GET` | `/api/guardrails` | Get guardrails config |
| `PUT` | `/api/guardrails` | Update guardrails |
| `POST` | `/api/trigger` | Manually trigger a schedule — `{"scheduleId": 1, "mode": "plan"}` |
| `POST` | `/api/admin/reset-db` | Reset database — streams NDJSON progress; body: `{"confirm":"RESET DATABASE"}` |
