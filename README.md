# kube-phoenix

A self-hosted web app for managing Kubernetes cluster sleep/wake schedules. Replaces a bash-based CronJob scaler with a proper UI and audit trail.

Scale down your cluster at night, wake it up in the morning. No more paying for idle nodes.

---

## What it does

- **Schedules** — multiple sleep and wake schedules with cron expressions, per-schedule timezones, and optional namespace filters for partial scale-down
- **Guardrails** — protect namespaces, node labels, and taints from ever being touched
- **Cluster State** — live view of all Deployments, StatefulSets, and nodes
- **History** — full execution log with live WebSocket streaming
- **Manual triggers** — run any schedule immediately in plan (dry-run) or apply mode

---

## Tech stack

| Layer | Tech |
|---|---|
| Backend | Go 1.25, chi, GORM, robfig/cron v3, client-go |
| Frontend | Next.js 15, React 19, Material UI v6, TanStack Query v5 |
| Database | PostgreSQL 16 |
| Deploy | Helm 3, GHCR image, GitHub Actions CI |

The Go backend embeds the Next.js static export — one binary, one container, no separate nginx.

---

## How the scaler works

**Scale down:**
1. Saves current replica count in a `previous-replicas` annotation on each Deployment/StatefulSet
2. Scales all matching workloads to 0
3. Cordons nodes, evicts/deletes pods (respecting guardrails), deletes the nodes

**Scale up:**
1. Restores replicas from the `previous-replicas` annotation and removes it
2. Uncordons nodes; Karpenter (or your CA) provisions new nodes as pods become pending

Both operations support **plan mode** (logs what it would do, no changes) and **apply mode** (executes).

---

## Getting started

### Prerequisites

- Go 1.25+
- Node.js 22+
- Docker (for local PostgreSQL)
- `kubectl` configured against your cluster (the backend still starts without it — cluster endpoints return empty data)

### Local development

```bash
# 1. Start PostgreSQL
make dev

# 2. Backend (separate terminal) — http://localhost:8080
make dev-backend

# 3. Frontend (separate terminal) — http://localhost:3000
make dev-frontend
```

No `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` set → auth is disabled in dev mode.

### Full production build

```bash
make build
# Builds frontend → copies to backend/web/static → compiles Go binary
# Output: bin/kube-phoenix
```

### Docker

```bash
make docker-build
# Builds ghcr.io/macxsimilian/kube-phoenix:<git-sha>
```

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL DSN — e.g. `host=localhost user=kube_phoenix password=kube_phoenix dbname=kube_phoenix port=5432 sslmode=disable` |
| `BASIC_AUTH_USER` | No | HTTP Basic Auth username. Unset = auth disabled (dev mode). |
| `BASIC_AUTH_PASSWORD` | No | HTTP Basic Auth password. |

---

## API

All `/api/*` and `/ws/*` endpoints require Basic Auth when configured. `/healthz` is always open.

| Method | Path | Description |
|---|---|---|
| `GET` | `/healthz` | Health check (DB ping) |
| `GET` | `/api/schedules` | List all schedules |
| `POST` | `/api/schedules` | Create schedule |
| `GET` | `/api/schedules/:id` | Get schedule |
| `PUT` | `/api/schedules/:id` | Update schedule (`type` is immutable) |
| `DELETE` | `/api/schedules/:id` | Delete schedule |
| `GET` | `/api/executions` | List executions (filters: `schedule_id`, `status`, `page`, `page_size`) |
| `GET` | `/api/executions/:id` | Get execution |
| `GET` | `/api/executions/:id/logs` | Get all log lines for an execution |
| `GET` | `/ws/executions/:id/logs` | WebSocket — live log streaming |
| `GET` | `/api/cluster/workloads` | List Deployments and StatefulSets |
| `GET` | `/api/cluster/nodes` | List nodes with protection status |
| `GET` | `/api/guardrails` | Get guardrails config |
| `PUT` | `/api/guardrails` | Update guardrails |
| `POST` | `/api/trigger` | Manually trigger a schedule `{"scheduleId": 1, "mode": "plan"}` |

---

## Deployment

The Helm chart deploys the app, an in-cluster PostgreSQL StatefulSet, RBAC, and a namespace.

### Install

```bash
helm upgrade --install kube-phoenix helm/kube-phoenix \
  --namespace kube-phoenix \
  --create-namespace \
  --set image.tag=<git-sha> \
  --set secret.basicAuthPassword=<your-password>
```

### External database (RDS, Cloud SQL, etc.)

```bash
helm upgrade --install kube-phoenix helm/kube-phoenix \
  --namespace kube-phoenix \
  --create-namespace \
  --set postgresql.enabled=false \
  --set externalDatabase.url="host=my-rds.example.com user=kube_phoenix password=secret dbname=kube_phoenix port=5432 sslmode=require"
```

### Key values

| Value | Default | Description |
|---|---|---|
| `image.repository` | `ghcr.io/macxsimilian/kube-phoenix` | Image repository |
| `image.tag` | `latest` | Image tag to deploy |
| `postgresql.enabled` | `true` | Deploy in-cluster PostgreSQL |
| `postgresql.auth.password` | `kube_phoenix` | **Change in production** |
| `postgresql.persistence.size` | `1Gi` | PVC size for PostgreSQL |
| `externalDatabase.url` | `""` | Full DSN when `postgresql.enabled=false` |
| `secret.basicAuthUser` | `admin` | Basic Auth username |
| `secret.basicAuthPassword` | `kube-phoenix` | **Change in production** |
| `secret.existingSecret` | `""` | Use a pre-existing K8s Secret (must contain `DATABASE_URL`, `BASIC_AUTH_USER`, `BASIC_AUTH_PASSWORD`) |
| `ingress.enabled` | `false` | Enable Ingress |
| `ingress.host` | `""` | Hostname |

Full reference: [helm/kube-phoenix/values.yaml](helm/kube-phoenix/values.yaml)

### Access

```bash
# Port-forward
kubectl port-forward -n kube-phoenix svc/kube-phoenix 8080:80

# Or enable ingress in values.yaml
```

---

## CI/CD

GitHub Actions runs on every push to `master` and on pull requests (build only, no push).

| Job | What it does |
|---|---|
| **Frontend build** | `npm install`, `npm audit` (high severity gate), `npm run build` |
| **Backend build** | `go vet`, `go test` with coverage report, `go build`, golangci-lint v2 |
| **Helm lint** | `helm lint helm/kube-phoenix` |
| **Docker build & push** | Builds `linux/amd64`, pushes to GHCR on merge, Trivy scan (fails on CRITICAL/HIGH) |
| **Helm package & push** | Packages and pushes chart to `oci://ghcr.io/macxsimilian/helm` (master only) |

Images published to GHCR:

```
ghcr.io/macxsimilian/kube-phoenix:<short-sha>
ghcr.io/macxsimilian/kube-phoenix:<semver>      # when a release tag exists
ghcr.io/macxsimilian/kube-phoenix:latest         # master only
```

[release-please](https://github.com/googleapis/release-please) automates semver tagging, GitHub Releases, CHANGELOG generation, and `helm/kube-phoenix/Chart.yaml` `appVersion` bumps from [conventional commits](https://www.conventionalcommits.org/).

**One-time setup:** Settings → Actions → General → Workflow permissions → **Read and write**.

---

## Project structure

```
kube-phoenix/
├── Dockerfile                      # 3-stage: node:22 → golang:1.25 → distroless
├── Makefile
├── docker-compose.yml              # Local dev PostgreSQL
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                  # Main CI pipeline
│   │   └── release-please.yml      # Auto-versioning
│   └── dependabot.yml              # Security update PRs (actions, gomod, npm)
├── backend/
│   ├── cmd/server/main.go          # Entry point, graceful shutdown
│   ├── internal/
│   │   ├── api/                    # HTTP handlers + Chi router
│   │   ├── scheduler/              # robfig/cron wrapper + WebSocket log broker
│   │   ├── scaler/                 # Scale-down / scale-up logic
│   │   ├── k8s/                    # Kubernetes client wrapper
│   │   ├── store/                  # GORM models + queries
│   │   └── middleware/             # HTTP Basic Auth
│   └── web/
│       ├── embed.go                # //go:embed static (SPA handler with fallback)
│       └── static/                 # Next.js output — generated at build time
├── frontend/
│   └── src/
│       ├── app/                    # Pages: overview, schedules, cluster, guardrails, history
│       ├── components/             # Reusable UI components
│       ├── lib/                    # API client, TypeScript types, cron formatter
│       └── theme/                  # Dark purple MUI theme
├── helm/kube-phoenix/
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/                  # namespace, sa, clusterrole, secret, deployment, service, ingress, postgresql
└── k8s/                            # Legacy raw manifests (superseded by Helm)
```

---

## Default schedules

Four schedules are seeded on first startup, all in **plan mode** — switch to apply when you're ready:

| Name | Cron | Type |
|---|---|---|
| Weekday Scale Down | `0 0 * * 1-5` | scale\_down |
| Weekday Scale Up | `0 8 * * 1-5` | scale\_up |
| Weekend Scale Down | `0 0 * * 0,6` | scale\_down |
| Weekend Scale Up | `0 8 * * 0,6` | scale\_up |

---

## Roadmap

- [ ] Keycloak OIDC (replace basic auth)
- [ ] Slack / email notifications
- [ ] Multi-cluster support

---

> Hobby project by [@MacXsimilian](https://github.com/MacXsimilian). It drains nodes — use plan mode first.
