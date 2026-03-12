# kube-phoenix 🐦‍🔥

A hobby project — a self-hosted web app for managing Kubernetes cluster sleep/wake schedules. Built to replace a bash-based CronJob scaler with something actually usable.

Scale down your cluster at night, wake it up in the morning. No more paying for idle nodes.

---

## What it does

- **Schedules** — define multiple sleep and wake schedules with cron expressions, timezones, and optional namespace filters (partial wake/sleep)
- **Guardrails** — configure namespaces, node labels, and taints that should never be touched
- **Cluster State** — live view of all workloads and nodes, what's running, what's sleeping
- **History** — full execution log with live WebSocket streaming
- **Manual triggers** — run a sleep or wake immediately in plan (dry-run) or apply mode

## Tech stack

| Layer | Tech |
|---|---|
| Backend | Go 1.22, chi, GORM, robfig/cron v3, client-go |
| Frontend | Next.js 14, Material UI v6, TanStack Query v5 |
| Database | PostgreSQL 16 |
| Deploy | Helm chart, GHCR image, GitHub Actions CI |

The Go backend embeds the Next.js static export as a single binary — one container, no separate nginx.

---

## Getting started

### Prerequisites

- Docker + Docker Compose
- Go 1.22+
- Node.js 20+
- A kubeconfig pointing at your cluster (for the backend to actually do anything)

### Local development

```bash
# 1. Start postgres
make dev

# 2. Backend (in a separate terminal)
make dev-backend

# 3. Frontend (in a separate terminal)
make dev-frontend
```

Frontend runs at http://localhost:3000, backend at http://localhost:8080.

The backend runs without a kubeconfig too — cluster endpoints will return empty data but everything else works.

---

## Deployment

The chart deploys everything: the app, an in-cluster PostgreSQL StatefulSet, RBAC, and a namespace.

### Install

```bash
helm upgrade --install kube-phoenix helm/kube-phoenix \
  --namespace kube-phoenix \
  --create-namespace \
  --set image.tag=<git-sha> \
  --set secret.basicAuthPassword=<your-password>
```

### Use an external database (RDS, etc.)

```bash
helm upgrade --install kube-phoenix helm/kube-phoenix \
  --set postgresql.enabled=false \
  --set externalDatabase.url="host=my-rds.example.com user=kube_phoenix password=secret dbname=kube_phoenix port=5432 sslmode=require"
```

### Key values

| Value | Default | Description |
|---|---|---|
| `image.tag` | `latest` | Image tag to deploy |
| `postgresql.enabled` | `true` | Deploy in-cluster postgres |
| `postgresql.auth.password` | `kube_phoenix` | Change in production |
| `externalDatabase.url` | `""` | Full DSN when using external DB |
| `secret.basicAuthUser` | `admin` | Basic auth username |
| `secret.basicAuthPassword` | `kube-phoenix` | Basic auth password — change this |
| `ingress.enabled` | `false` | Enable ingress |
| `ingress.host` | `""` | Hostname for ingress |

Full list: [helm/kube-phoenix/values.yaml](helm/kube-phoenix/values.yaml)

---

## CI/CD

GitHub Actions builds and pushes the image to GHCR on every merge to `master`:

```
ghcr.io/macxsimilian/kube-phoenix:<short-sha>
ghcr.io/macxsimilian/kube-phoenix:latest
```

PRs get a build-only check (no push). No secrets needed — uses `GITHUB_TOKEN` automatically.

One setup step required: **Settings → Actions → General → Workflow permissions → Read and write**.

---

## How the scaler works

On scale-down:
1. Saves current replica count in a `previous-replicas` annotation on each Deployment/StatefulSet
2. Scales to 0
3. Cordons and drains nodes (respecting guardrail skip lists), then deletes them

On scale-up:
1. Restores replicas from the `previous-replicas` annotation
2. Karpenter provisions new nodes as pods become pending

---

## Project structure

```
kube-phoenix/
├── backend/                  # Go backend
│   ├── cmd/server/main.go
│   ├── internal/
│   │   ├── api/              # HTTP handlers + router
│   │   ├── scheduler/        # cron job management
│   │   ├── scaler/           # scale-down / scale-up logic
│   │   ├── k8s/              # Kubernetes client wrapper
│   │   ├── store/            # PostgreSQL models + queries
│   │   └── middleware/       # basic auth
│   └── web/                  # Go embed for Next.js static output
├── frontend/                 # Next.js 14 frontend
│   └── src/
│       ├── app/              # pages: overview, schedules, cluster, guardrails, history
│       ├── components/
│       └── lib/              # API client, types
├── helm/kube-phoenix/        # Helm chart
├── .github/workflows/ci.yml  # GitHub Actions
├── docker-compose.yml        # local postgres for development
└── Dockerfile                # multi-stage: node → go → distroless
```

---

## Roadmap

- [ ] Keycloak OIDC (replace basic auth)
- [ ] Slack / email notifications
- [ ] Multi-cluster support

---

> Hobby project by [@MacXsimilian](https://github.com/MacXsimilian). Use at your own risk in production — it drains nodes.
