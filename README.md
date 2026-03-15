# kube-phoenix 🐦‍🔥

[![Build Status](https://img.shields.io/github/actions/workflow/status/MacXsimilian/kube-phoenix/ci.yml?branch=master)](https://github.com/MacXsimilian/kube-phoenix/actions/workflows/ci.yml)
[![GitHub License](https://img.shields.io/badge/License-Apache%202.0-ff69b4.svg)](https://github.com/MacXsimilian/kube-phoenix/blob/master/LICENSE)
[![Go Report Card](https://goreportcard.com/badge/github.com/macxsimilian/kube-phoenix/backend)](https://goreportcard.com/report/github.com/macxsimilian/kube-phoenix/backend)
![GitHub stars](https://img.shields.io/github/stars/MacXsimilian/kube-phoenix)
![GitHub forks](https://img.shields.io/github/forks/MacXsimilian/kube-phoenix)
[![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/MacXsimilian/kube-phoenix/issues)

A hobby project — a self-hosted web app for managing Kubernetes cluster sleep/wake schedules. Built to replace a bash-based CronJob scaler with something actually usable.

Scale down your cluster at night, wake it up in the morning. No more paying for idle nodes.

---

## What it does

- **Overview** — cluster health at a glance: current scale state, pulsing live indicator, partial-sleep namespace breakdown, and live activity feed with inline log drawer
- **Cluster State** — live view of all Deployments, StatefulSets, and nodes with resizable drill-down detail drawers; pod detail includes live CPU/memory usage, annotations, node instance type, and Kubernetes events
- **Guardrails** — protect namespaces, node labels, and taints from ever being touched
- **Schedules** — multiple sleep and wake schedules with cron expressions, per-schedule timezones, and optional namespace filters for partial scale-down
- **History** — full execution log with live WebSocket streaming; scrollable run summary with jump-to-error navigation and error/workload count badges
- **Manual triggers** — run any schedule immediately in plan (dry-run) or apply mode
- **Settings** — danger zone with a double-confirmation Reset Database operation (drops all tables, reseeds defaults)

---

## Tech stack

| Layer | Tech |
|---|---|
| Backend | Go 1.25, chi v5.2, GORM v1.31, robfig/cron v3, client-go |
| Frontend | Next.js 15, React 19, Material UI v6, TanStack Query v5 |
| Database | PostgreSQL 16 |
| Deploy | Helm 4, GHCR image, GitHub Actions CI |

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

## Authentication

kube-phoenix uses a branded login screen backed by HTTP Basic Auth. Credentials are stored in `sessionStorage` and injected into every API call — no browser native auth dialog.

Set `BASIC_AUTH_USER` and `BASIC_AUTH_PASSWORD` to enable auth. Unset = auth disabled (dev mode).

WebSocket log streams authenticate via a `?token=` query parameter (browsers cannot set `Authorization` headers on WebSocket upgrades).

---

## Cluster State drill-down

The Cluster State page provides three levels of detail, all in resizable side drawers:

**Nodes tab**
- Click a node row → **Node detail drawer** — resource bars (CPU/mem), zone, instance type, cordon status, and a searchable pod list grouped by namespace
- Click a pod in the node drawer → content replaces in-place with **Pod detail** — a breadcrumb back button returns to the node view

**Workloads tab**
- Sortable table with a live row count footer and an "affected-only" filter that previews what the next sleep run would scale
- Click a workload row → **Workload detail drawer** — replica progress bar (ready/current/saved), kind and status chips, searchable pod list
- Click a pod in the workload drawer → **Pod detail drawer** opens alongside it

**Pod detail** shows:
- Phase, QoS class, node name, instance type, pod IP, host IP, age
- Per-container: image, ready indicator, restart count, live CPU/memory usage (via Metrics Server, degrades gracefully if absent), CPU/memory requests and limits, last terminated reason
- Pod conditions (Ready, ContainersReady, Initialized, PodScheduled) as colour-coded chips
- Kubernetes events (Warning events highlighted in red)
- Labels and annotations (collapsible)

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

WebSocket connections authenticate via `?token=<base64(user:pass)>` query parameter.

| Method | Path | Description |
|---|---|---|
| `GET` | `/healthz` | Health check (DB ping) |
| `GET` | `/api/schedules` | List all schedules (includes `nextRun` ISO timestamp per schedule) |
| `POST` | `/api/schedules` | Create schedule |
| `GET` | `/api/schedules/:id` | Get schedule |
| `PUT` | `/api/schedules/:id` | Update schedule (`type` is immutable) |
| `DELETE` | `/api/schedules/:id` | Delete schedule |
| `GET` | `/api/executions` | List executions (filters: `schedule_id`, `status`, `page`, `page_size`) |
| `GET` | `/api/executions/:id` | Get execution |
| `GET` | `/api/executions/:id/logs` | Get all log lines for an execution |
| `GET` | `/ws/executions/:id/logs` | WebSocket — live log streaming (`?token=` auth) |
| `GET` | `/api/cluster/workloads` | List Deployments and StatefulSets |
| `GET` | `/api/cluster/nodes` | List nodes with protection status |
| `GET` | `/api/cluster/nodes/:name/pods` | List non-DaemonSet pods on a node |
| `GET` | `/api/cluster/pods/:namespace/:name` | Full pod detail — containers (live usage + req/limit), conditions, K8s events, labels, annotations |
| `GET` | `/api/cluster/workloads/:namespace/:kind/:name/pods` | List pods belonging to a Deployment or StatefulSet |
| `GET` | `/api/guardrails` | Get guardrails config |
| `PUT` | `/api/guardrails` | Update guardrails |
| `POST` | `/api/trigger` | Manually trigger a schedule `{"scheduleId": 1, "mode": "plan"}` |
| `POST` | `/api/admin/reset-db` | Reset database — drops all tables, recreates schema, reseeds defaults; streams NDJSON progress events; body: `{"confirm":"RESET DATABASE"}` |

---

## Deployment

The Helm chart deploys the app, an in-cluster PostgreSQL StatefulSet, RBAC, and a dedicated namespace.

### Install

```bash
helm upgrade --install kube-phoenix helm/kube-phoenix \
  --namespace kube-phoenix \
  --create-namespace \
  --set image.tag=<git-sha> \
  --set secret.basicAuthPassword=<your-password>
```

### External database (RDS, Aurora, etc.)

```bash
helm upgrade --install kube-phoenix helm/kube-phoenix \
  --namespace kube-phoenix \
  --create-namespace \
  --set postgresql.enabled=false \
  --set externalDatabase.url="host=my-rds.example.com user=kube_phoenix password=secret dbname=kube_phoenix port=5432 sslmode=require"
```

Alternatively, populate the individual `externalDatabase.*` fields (`host`, `port`, `username`, `password`, `database`, `sslmode`) instead of a full DSN.

### Key values

| Value | Default | Description |
|---|---|---|
| `image.repository` | `ghcr.io/macxsimilian/kube-phoenix` | Image repository |
| `image.tag` | `latest` | Image tag to deploy |
| `replicaCount` | `1` | Number of app replicas |
| `postgresql.enabled` | `true` | Deploy in-cluster PostgreSQL StatefulSet |
| `postgresql.auth.username` | `kube_phoenix` | PostgreSQL username |
| `postgresql.auth.password` | `kube_phoenix` | PostgreSQL password — **change in production** |
| `postgresql.auth.database` | `kube_phoenix` | PostgreSQL database name |
| `postgresql.persistence.enabled` | `true` | Persist PostgreSQL data via a PVC |
| `postgresql.persistence.size` | `1Gi` | PVC size |
| `postgresql.persistence.storageClass` | `""` | StorageClass — `""` uses the cluster default |
| `externalDatabase.url` | `""` | Full DSN when `postgresql.enabled=false` |
| `secret.basicAuthUser` | `admin` | Basic Auth username |
| `secret.basicAuthPassword` | `kube-phoenix` | Basic Auth password — **change in production** |
| `secret.existingSecret` | `""` | Pre-existing K8s Secret (must contain `DATABASE_URL`, `BASIC_AUTH_USER`, `BASIC_AUTH_PASSWORD`) |
| `ingress.enabled` | `false` | Enable Kubernetes Ingress |
| `ingress.className` | `""` | Ingress class name (e.g. `nginx`, `alb`) |
| `ingress.annotations` | `{}` | Annotations to add to the Ingress resource |
| `ingress.host` | `""` | Hostname to expose the app on |
| `ingress.tls` | `[]` | TLS configuration for the Ingress |
| `targetGroupBinding.enabled` | `false` | Enable AWS TargetGroupBinding (EKS + ALB) — uses a `ClusterIP` service, no LoadBalancer or Ingress needed |
| `targetGroupBinding.targetGroupARN` | `""` | ARN of the **pre-created** AWS Target Group |
| `targetGroupBinding.targetType` | `ip` | `ip` (VPC CNI, recommended) or `instance` (NodePort) |
| `targetGroupBinding.vpcID` | `""` | VPC ID — only needed if the controller cannot auto-detect it |
| `resources.requests.cpu` | `50m` | CPU request for the app container |
| `resources.requests.memory` | `64Mi` | Memory request for the app container |
| `resources.limits.cpu` | `200m` | CPU limit for the app container |
| `resources.limits.memory` | `256Mi` | Memory limit for the app container |

Full reference: [helm/kube-phoenix/values.yaml](helm/kube-phoenix/values.yaml)

### Access via port-forward

```bash
kubectl port-forward -n kube-phoenix svc/kube-phoenix 8080:80
# Open http://localhost:8080
```

### Access via Kubernetes Ingress

Enable Ingress in your values file and set your hostname:

```yaml
ingress:
  enabled: true
  className: nginx          # or "alb", "traefik", etc.
  host: kube-phoenix.example.com
  tls:
    - hosts:
        - kube-phoenix.example.com
      secretName: kube-phoenix-tls
```

### Access via AWS ALB (EKS + TargetGroupBinding)

`TargetGroupBinding` (TGB) attaches the app directly to an existing ALB target group without a `LoadBalancer` service or Ingress controller. The AWS Load Balancer Controller registers and deregisters pod IPs automatically as pods scale.

**How it works:**
- The chart deploys a `ClusterIP` service — no `LoadBalancer` or `NodePort` needed.
- The `TargetGroupBinding` CR binds that service to the target group ARN.
- The ALB forwards traffic to the target group; the controller maps it to pods by IP or instance depending on `targetType`.

> Do **not** create a `LoadBalancer` service or Ingress on top of a TGB deployment — the service is intentionally `ClusterIP`.

**Prerequisites:**

1. [AWS Load Balancer Controller](https://kubernetes-sigs.github.io/aws-load-balancer-controller) installed in the cluster
2. An ALB with an HTTPS listener (port 443) already provisioned
3. A Target Group **created beforehand** with:
   - **Target type:** `ip` (VPC CNI, recommended for EKS) or `instance` (NodePort)
   - **Protocol:** HTTP
   - **Port:** `8080` (matches the container port)
   - **Health check:** path `/healthz`, interval 30 s, success code `200`
4. A listener rule forwarding traffic to the target group
5. A DNS CNAME / alias pointing your domain to the ALB

**Example values:**

```yaml
targetGroupBinding:
  enabled: true
  targetGroupARN: "arn:aws:elasticloadbalancing:eu-central-1:ACCOUNT:targetgroup/kube-phoenix/ID"
  targetType: ip
  # vpcID: "vpc-0abc123def456"  # omit if the controller auto-detects it
```

---

## Branching strategy

kube-phoenix uses **GitHub Flow** — a single protected `master` branch, short-lived feature branches, and pull requests.

```
master  (protected)
  ├── feat/emergency-wake    → PR → master
  ├── fix/activityfeed-jsx   → PR → master
  └── ci/add-govulncheck     → PR → master
```

### Rules

- `master` is always deployable — never push broken code directly
- Branch off `master` for any non-trivial change
- Small fixes (typos, one-liner patches) can be pushed directly if you have admin bypass enabled
- Never create tags manually — release-please owns all tags and releases

### Contributing

```bash
# 1. Branch off master
git checkout master && git pull
git checkout -b feat/your-feature

# 2. Make changes, commit with conventional prefix
git commit -m "feat: add emergency wake endpoint"

# 3. Push and open a PR against master
git push -u origin feat/your-feature
# → open PR on GitHub

# 4. CI runs automatically on the PR (frontend, backend, helm, secret scan)
# 5. Once approved and green, merge — release-please handles the rest
```

### Conventional commit prefixes

| Prefix | Version bump | Use for |
|---|---|---|
| `feat:` | minor | new feature |
| `fix:` | patch | bug fix |
| `perf:` | patch | performance improvement |
| `feat!:` / `BREAKING CHANGE:` | major | breaking API or behaviour change |
| `docs:` | none | documentation only |
| `ci:` | none | CI/CD changes |
| `chore:` | none | maintenance, deps, config |
| `refactor:` | none | code restructure, no behaviour change |

---

## CI/CD

Two GitHub Actions workflows handle all CI and release automation.

### How it works

```
Every push to master / PR           Release (on merge of Release PR)
──────────────────────────          ──────────────────────────────────────────
ci.yml                              release-please.yml
  ├── frontend build                  ├── release-please-action
  │     npm install                   │     reads conventional commits
  │     npm audit (high CVEs)         │     opens Release PR (CHANGELOG bump)
  │     npm run build                 │     on merge: creates tag + GH Release
  ├── backend build                   ├── docker build & push (semver tags)
  │     go vet / test / build         ├── trivy scan (CRITICAL/HIGH gate)
  │     govulncheck (Go CVE DB)       └── helm chart push to GHCR OCI
  │     golangci-lint + gosec (SAST)
  ├── helm lint
  └── secret scan (TruffleHog)
```

CI runs on every push to `master` and on all pull requests. Docker builds only happen on release — CI never pushes images.

### CI jobs

| Job | Trigger | What it does |
|---|---|---|
| **Frontend build** | push + PR | `npm install`, `npm audit` (high severity gate), `npm run build` |
| **Backend build** | push + PR | `go vet`, `go test` + coverage, `go build`, `govulncheck`, golangci-lint with gosec (SAST) |
| **Helm lint** | push + PR | `helm lint helm/kube-phoenix` |
| **Secret scan** | push + PR | TruffleHog scans the diff for verified leaked secrets |

### Release workflow

[release-please](https://github.com/googleapis/release-please) automates versioning, CHANGELOG generation, and image publishing. **Never create tags manually.**

| Job | Trigger | What it does |
|---|---|---|
| **release-please** | push to `master` | Opens/updates Release PR; on merge creates tag + GitHub Release |
| **Docker build & push** | release created | Builds and pushes semver-tagged image to GHCR |
| **Trivy scan** | after docker push | Scans released image — fails on CRITICAL/HIGH unfixed CVEs |
| **Helm push** | release created | Packages and pushes chart to `oci://ghcr.io/macxsimilian/helm` |

Images published on release:

```
ghcr.io/macxsimilian/kube-phoenix:0.1.36        # exact semver
ghcr.io/macxsimilian/kube-phoenix:latest         # latest release on master
```

### How to make a release

1. Merge one or more PRs to `master` using conventional commit messages.
2. release-please automatically opens a Release PR with the CHANGELOG diff and bumped version.
3. Review and merge the Release PR.
4. Docker image and Helm chart are built and published automatically.

No manual tagging. No manual CHANGELOG editing.

### One-time setup

Settings → Actions → General → Workflow permissions → **Read and write**.

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
│   │   ├── k8s/                    # Kubernetes client wrapper (incl. Metrics Server)
│   │   ├── store/                  # GORM models + queries
│   │   └── middleware/             # HTTP Basic Auth (header + WS query param)
│   └── web/
│       ├── embed.go                # //go:embed static (SPA handler with fallback)
│       └── static/                 # Next.js output — generated at build time
├── frontend/
│   └── src/
│       ├── app/                    # Pages: overview, cluster, guardrails, schedules, history, settings
│       ├── components/             # Reusable UI components
│       │   ├── auth/               # Login screen
│       │   ├── layout/             # AppShell, Sidebar (with logout)
│       │   └── ...
│       ├── lib/                    # API client (auth-aware), auth context, TypeScript types
│       └── theme/                  # Dark purple MUI theme
├── helm/kube-phoenix/
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/                  # namespace, sa, clusterrole, secret, deployment, service, ingress, postgresql, targetgroupbinding
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
