# kube-phoenix 🐦‍🔥

A hobby project — a self-hosted web app for managing Kubernetes cluster sleep/wake schedules. Built to replace a bash-based CronJob scaler with something actually usable.

Scale down your cluster at night, wake it up in the morning. No more paying for idle nodes.

---

## What it does

- **Sleep Policies** — express your full sleep/wake intent in a single policy: pick days of the week, set a sleep time and optional wake time, support overnight windows (e.g. sleep at 19:00, wake at 06:00 the next morning). Multiple policies for multiple team schedules. Conflict detection flags overlapping policies.
- **Per-policy guardrails** — skip specific workloads or namespaces, enforce a minimum replica floor, all layered on top of global guardrails.
- **Policy overrides** — skip the next sleep or wake edge for a specific policy without disabling it.
- **Global guardrails** — protect namespaces, node labels, and taints cluster-wide.
- **Notifications** — in-app bell with conflict alerts, execution failures, and drift corrections.
- **Cluster State** — live view of all Deployments, StatefulSets, and nodes, with the governing policy shown per workload.
- **History** — full execution log (scheduled, manual, drift correction, skipped) with live WebSocket streaming.
- **Manual triggers** — run any policy's sleep or wake edge immediately in plan (dry-run) or apply mode.

---

## Tech stack

| Layer | Tech |
|---|---|
| Backend | Go 1.22, chi, GORM, native time.Timer scheduler, client-go |
| Frontend | Next.js 15, React 19, Material UI v6, TanStack Query v5 |
| Database | PostgreSQL 16 |
| Deploy | Helm 3, GHCR image, GitHub Actions CI |

The Go backend embeds the Next.js static export — one binary, one container, no separate nginx.

---

## How the scaler works

**Scale down:**
1. Saves current replica counts to `workload_snapshots` in PostgreSQL (no more K8s annotations)
2. Scales all matching workloads to 0, respecting per-policy and global guardrails
3. Cordons nodes, evicts/deletes pods, deletes the nodes

**Scale up:**
1. Reads replica counts from the latest unrestored `workload_snapshots` entry and marks it restored
2. Falls back to the legacy `previous-replicas` annotation if no snapshot exists (migration compat)
3. Uncordons nodes; Karpenter (or your CA) provisions new nodes as pods become pending

Both operations support **plan mode** (logs what it would do, no changes) and **apply mode** (executes).

**Desired-state engine:**
- Startup reconciliation corrects drift immediately on boot
- Periodic drift correction every 15 minutes catches any missed events
- Drift correction mode is configurable per policy: `record` (creates an execution entry) or `silent`

---

## Getting started

### Prerequisites

- Go 1.22+
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

### v2 — Sleep Policies (current)

| Method | Path | Description |
|---|---|---|
| `GET` | `/healthz` | Health check (DB ping) |
| `GET` | `/api/policies` | List sleep policies |
| `POST` | `/api/policies` | Create policy |
| `GET` | `/api/policies/:id` | Get policy |
| `PUT` | `/api/policies/:id` | Update policy |
| `DELETE` | `/api/policies/:id` | Delete policy |
| `GET` | `/api/policies/:id/windows` | List time windows for a policy |
| `POST` | `/api/policies/:id/windows` | Add a time window |
| `PUT` | `/api/policies/:id/windows/:wid` | Update a time window |
| `DELETE` | `/api/policies/:id/windows/:wid` | Delete a time window |
| `GET` | `/api/policies/:id/guardrails` | Get per-policy guardrails |
| `PUT` | `/api/policies/:id/guardrails` | Update per-policy guardrails |
| `POST` | `/api/policies/:id/overrides` | Skip next occurrence `{"date":"2025-06-01","edge":"sleep"}` |
| `DELETE` | `/api/policies/:id/overrides/:date/:edge` | Remove an override |
| `GET` | `/api/guardrails` | Get global guardrails |
| `PUT` | `/api/guardrails` | Update global guardrails |
| `GET` | `/api/executions` | List executions (filters: `policy_id`, `status`, `page`, `page_size`) |
| `GET` | `/api/executions/:id` | Get execution |
| `GET` | `/api/executions/:id/logs` | Get log lines for an execution |
| `GET` | `/ws/executions/:id/logs` | WebSocket — live log streaming |
| `GET` | `/api/cluster/workloads` | List Deployments and StatefulSets with governing policy |
| `GET` | `/api/cluster/nodes` | List nodes with protection status |
| `GET` | `/api/notifications` | List notifications |
| `PATCH` | `/api/notifications/:id` | Mark notification read/dismissed |
| `DELETE` | `/api/notifications` | Dismiss all notifications |
| `POST` | `/api/trigger` | Manual trigger `{"policyId": 1, "edge": "sleep", "mode": "plan"}` |

### v1 — Schedules (deprecated)

The `/api/schedules` endpoints still work but return `X-Deprecated: true` headers. They will be removed in a future release. Use `/api/policies` instead. Existing v1 schedule rows are automatically migrated to sleep policies on startup.

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

### External database (RDS, Cloud SQL, etc.)

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

> The chart speaks plain HTTP on port 8080. For TLS between the ALB and pods, set the target group protocol to `HTTPS` and configure certs accordingly.

**Example values:**

```yaml
targetGroupBinding:
  enabled: true
  targetGroupARN: "arn:aws:elasticloadbalancing:eu-central-1:ACCOUNT:targetgroup/kube-phoenix/ID"
  targetType: ip        # use "instance" for NodePort-based setups
  # vpcID: "vpc-0abc123def456"  # omit if the controller auto-detects it
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
├── Dockerfile                      # 3-stage: node:22 → golang:1.22 → distroless
├── Makefile
├── docker-compose.yml              # Local dev PostgreSQL
├── docs/PRD.md                     # Product Requirements Document
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                  # Main CI pipeline
│   │   └── release-please.yml      # Auto-versioning
│   └── dependabot.yml              # Security update PRs (actions, gomod, npm)
├── backend/
│   ├── cmd/server/main.go          # Entry point, graceful shutdown
│   ├── internal/
│   │   ├── api/                    # HTTP handlers + Chi router
│   │   │   ├── policies.go         # v2 policy/window/guardrail/override handlers
│   │   │   ├── notifications.go    # Notification handlers
│   │   │   ├── schedules.go        # v1 legacy handlers (deprecated)
│   │   │   └── router.go
│   │   ├── scheduler/              # Native Go event loop + reconciler + conflict detection
│   │   │   ├── scheduler.go        # Timer-based event loop, Start/Stop lifecycle
│   │   │   ├── reconciler.go       # Startup + periodic drift correction
│   │   │   ├── conflicts.go        # Conflict detection engine
│   │   │   └── notifications.go    # Notification generation helpers
│   │   ├── scaler/                 # Scale-down / scale-up logic (snapshot-based)
│   │   ├── k8s/                    # Kubernetes client wrapper
│   │   ├── store/                  # GORM models + queries
│   │   │   ├── models.go           # SleepPolicy, PolicyWindow, WorkloadSnapshot, Notification, …
│   │   │   ├── policy_store.go     # Policy CRUD + override management
│   │   │   ├── snapshot_store.go   # Workload replica snapshot store
│   │   │   ├── notification_store.go
│   │   │   └── queries.go          # v1→v2 migration, seed helpers
│   │   └── middleware/             # HTTP Basic Auth
│   └── web/
│       ├── embed.go                # //go:embed static (SPA handler with fallback)
│       └── static/                 # Next.js output — generated at build time
├── frontend/
│   └── src/
│       ├── app/                    # Pages: overview, policies, cluster, guardrails, history
│       ├── components/
│       │   ├── policies/           # PolicyCard, PolicyDialog, RunPolicyDialog
│       │   ├── notifications/      # NotificationDrawer (bell icon + drawer)
│       │   ├── cluster/            # WorkloadsTable (with governing policy column)
│       │   ├── history/            # ExecutionTable (with type column)
│       │   └── layout/             # Sidebar (with notification badge)
│       ├── lib/                    # API client, TypeScript types
│       └── theme/                  # Dark purple MUI theme
├── helm/kube-phoenix/
│   ├── Chart.yaml                  # v0.2.0
│   ├── values.yaml
│   └── templates/                  # namespace, sa, clusterrole, secret, deployment, service, ingress, postgresql, targetgroupbinding
└── k8s/                            # Legacy raw manifests (superseded by Helm)
```

---

## Default seed

On first startup, two sleep policies are seeded in **plan mode** — switch to apply when you're ready:

| Policy | Sleep | Wake | Days |
|---|---|---|---|
| Weekday Nights | 19:00 | 06:00 | Mon–Fri |
| Weekends | 00:00 | — | Sat–Sun |

Both cover the same intent as the original four cron schedules. Any existing v1 schedule rows are automatically paired into sleep policies on startup (idempotent migration).

---

## Upgrading from v0.1.x

v0.2.0 introduces the Sleep Policy model. No manual migration is needed — the backend pairs your existing `scale_down` / `scale_up` schedule rows into sleep policies automatically on startup. The `/api/schedules` endpoints continue to work with a deprecation warning. Switch to `/api/policies` at your own pace.

---

## Roadmap

- [ ] Keycloak OIDC (replace basic auth)
- [ ] Slack / email notification delivery
- [ ] Multi-cluster support

---

> Hobby project by [@MacXsimilian](https://github.com/MacXsimilian). It drains nodes — use plan mode first.
