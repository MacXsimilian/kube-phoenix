# Local Development Guide

This guide walks through setting up a complete local development environment for kube-phoenix, including a local Kubernetes cluster for testing policy-based scaling, scheduled exceptions, node draining, and live metrics.

## Development Modes

kube-phoenix supports three local development modes. Choose the one that fits your workflow.

| Mode | What it tests | Setup effort |
| :--- | :------------ | :----------- |
| [In-cluster (minikube)](#mode-1----in-cluster-with-minikube) | Everything -- scaling, node ops, metrics, exceptions, guardrails | Full |
| [Backend + frontend (no cluster)](#mode-2----backend--frontend-without-a-cluster) | API, scheduler logic, auth, audit log | Medium |
| [Frontend only (mock API)](#mode-3----frontend-only-mock-api) | UI components, layouts, client-side state | Minimal |

## Prerequisites

Run the examples from the repository root. All modes use Git and Make; install only the tools needed for your chosen mode. The install examples below use Homebrew on macOS. Linux users should install the corresponding versions through their package manager or the tool's official distribution.

| Mode | Required tools on the host |
| :--- | :------------------------- |
| In-cluster | Docker with Buildx, minikube, kubectl, Helm; Go and Node.js run inside the Docker build |
| Backend + frontend | Go, Node.js/npm, Docker Compose for PostgreSQL |
| Frontend only | Node.js/npm |

| Tool | Version | macOS install example |
| :--- | :------ | :-------------------- |
| Go | 1.27.2+; minimum from `backend/go.mod` | `brew install go` |
| Node.js | 26 (Current); use Node 26 on `PATH` to match Docker and CI | `brew install node` |
| Docker | Docker Engine/Desktop with Buildx and Compose | [Docker Desktop](https://docs.docker.com/desktop/install/mac-install/) |
| minikube | No repository pin | `brew install minikube` |
| kubectl | Within one minor version of the API server | `brew install kubectl` |
| Helm | 3.8+; CI uses 4.3.0 | `brew install helm` |
| golangci-lint | Optional for backend linting; v2.14.0 matches CI | `go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.14.0` |

---

## Mode 1 -- In-Cluster with minikube

This deploys kube-phoenix into minikube via Helm using the production serving model: one Go binary with an embedded frontend. Real scaling and node operations require cluster access.

### One-command setup

The setup script provisions the cluster, creates sample workloads, builds the image, and deploys kube-phoenix. Its original baseline is a 32 GB Mac with Docker Desktop, using three nodes with 4096 MiB and two CPUs per node. Allocate enough memory to Docker Desktop for the nodes and build processes.

```bash
make minikube-setup
```

Check that the application and database pods are ready and the port-forward is listening, then open `http://localhost:8080` and log in with `admin` / `adminadmin`.

The current script requires Docker and explicitly labels two worker nodes. Its environment overrides (`MINIKUBE_PROFILE`, `MINIKUBE_NODES`, `MINIKUBE_MEMORY`, `MINIKUBE_CPUS`, and `MINIKUBE_K8S_VERSION`) do not remove that worker-node assumption. On a smaller Linux host or with rootless Podman, cluster sizing, runtime setup, image loading, and deployment need manual coordination. A one-node cluster can run the application and sample workloads, but cannot exercise migration between worker nodes during drain tests. Resource tiers and portable runtime selection are separate future work.

When reusing an existing cluster, verify `kubectl config current-context` is `local-cluster` (or the selected profile). The setup script uses the current context for its kubectl and Helm commands.

To tear everything down:

```bash
make minikube-teardown
```

### What the script creates

**Cluster:** 3-node minikube with the profile name `local-cluster`:

| Node | Role | Labels |
| :--- | :--- | :----- |
| `local-cluster` | control-plane | _(default)_ |
| `local-cluster-m02` | worker | `workload-tier=general` |
| `local-cluster-m03` | worker | `workload-tier=general` |

Two worker nodes allow testing node drain where workloads migrate from one worker to the other.

**Addons:** metrics-server (for CPU/memory display in the cluster UI).

**Namespaces and workloads:** Nine team namespaces containing 50 Deployments and 55 desired replicas. These counts exclude Kubernetes system pods and the application's namespace. Most workloads use `busybox:1.37` with lightweight activity (HTTP serve, log lines, DNS lookups, compute, cron jobs, file watchers); two use `pause:3.10.2` for idle pods. Each container has resource requests (5m CPU / 8Mi mem) and limits (20m CPU / 32Mi mem).

| Namespace | Deployments | Desired pods | What it tests |
| :-------- | :---------: | :----------: | :------------ |
| `team-backend` | 7 | 9 | Single-namespace policy. Exception: keep `api`. |
| `team-web` | 5 | 6 | Multi-deployment sleep. Exception: `assets`. |
| `team-data` | 6 | 7 | Cross-namespace policy (data + web). |
| `team-qa` | 5 | 5 | Nightly sleep. Guardrail: release freeze. |
| `team-platform` | 6 | 6 | Infra/observability stack. Guardrail target. |
| `team-ml` | 4 | 5 | Model-serving fixtures. Exception: `model-serve`. |
| `team-mobile` | 5 | 5 | Multi-service mobile backend. Bulk sleep/wake. |
| `team-payments` | 6 | 6 | Compliance-sensitive. Guardrail: always protect. |
| `team-infra` | 6 | 6 | Cluster services. Node drain testing. |
| **Total** | **50** | **55** | |

### Suggested testing flow

Start with [Your first policy](first-policy.md), which protects every node before previewing and applying a sleep/wake cycle to `team-backend`. A namespace filter limits workload scaling; it does not limit the nodes considered for drain and deletion.

Use the [policy smoke checklist](testing/policy-smoke-test.md) to record a short verification run. The [policy scenario catalogue](test-plan-policy.md) covers exceptions, cross-namespace policies, guardrails, and separate destructive node-operation scenarios.

### Manual step-by-step setup

If you prefer to run each step individually instead of using the script:

#### 1. Start minikube

```bash
minikube start \
  --profile=local-cluster \
  --nodes=3 \
  --memory=4096 \
  --cpus=2 \
  --kubernetes-version=stable
```

#### 2. Enable the metrics server

```bash
minikube addons enable metrics-server -p local-cluster
```

Metrics take 60--90 seconds to populate after the addon starts.

#### 3. Create sample workloads

```bash
make minikube-workloads
```

Or create them manually (see `hack/minikube-setup.sh` for the full list).

#### 4. Build and load the Docker image

```bash
make docker-build
minikube image load ghcr.io/macxsimilian/kube-phoenix:$(git rev-parse --short HEAD) -p local-cluster
```

`minikube image load` transfers the image from your local Docker daemon into the minikube nodes. This avoids needing a registry.

#### 5. Deploy with Helm

```bash
helm upgrade --install kube-phoenix helm/kube-phoenix \
  --namespace kube-phoenix \
  --create-namespace \
  --set createNamespace=false \
  --set-string image.tag=$(git rev-parse --short HEAD) \
  --set image.pullPolicy=Never \
  --set secret.adminUser=admin \
  --set secret.adminPassword=adminadmin \
  --set session.cookieSecure=false
```

| Flag | Why |
| :--- | :-- |
| `image.pullPolicy=Never` | Use the locally loaded image instead of pulling from a registry |
| `createNamespace=false` | Let Helm's `--create-namespace` own namespace creation |
| `session.cookieSecure=false` | Allow session cookies over plain HTTP (no TLS on localhost) |

Wait for both pods to become ready:

```bash
kubectl -n kube-phoenix get pods -w
```

You should see two pods: `kube-phoenix-<hash>` (the application) and `kube-phoenix-postgresql-0` (the database). Wait for both to reach `Running` / `1/1`; initial image downloads and storage provisioning can take longer than 30 seconds.

#### 6. Access the UI

```bash
kubectl port-forward -n kube-phoenix svc/kube-phoenix 8080:80
```

Open `http://localhost:8080` and log in with `admin` / `adminadmin`.

The Go binary serves the embedded frontend -- no separate Next.js dev server or `.env.local` needed. This matches the production serving model.

### Redeploying after code changes

After modifying backend or frontend code:

```bash
make docker-build
minikube image load ghcr.io/macxsimilian/kube-phoenix:$(git rev-parse --short HEAD) -p local-cluster
helm upgrade kube-phoenix helm/kube-phoenix \
  --namespace kube-phoenix \
  --reuse-values \
  --set-string image.tag=$(git rev-parse --short HEAD) \
  --set image.pullPolicy=Never
kubectl -n kube-phoenix rollout restart deploy/kube-phoenix
kubectl -n kube-phoenix rollout status deploy/kube-phoenix
```

The Helm upgrade selects the new commit's image tag. The explicit restart also replaces pods when you rebuilt uncommitted changes under the same tag. Restart the port-forward if its selected pod was replaced.

---

## Mode 2 -- Backend + Frontend without a Cluster

Useful for backend development (API, database, scheduler logic) when Kubernetes access is not required. Requires three terminals.

```bash
make dev              # Terminal 1 -- start PostgreSQL via Docker Compose
```

```bash
ADMIN_USER=admin \
ADMIN_PASSWORD=adminadmin \
COOKIE_SECURE=false \
CORS_ALLOWED_ORIGIN=http://localhost:3000 \
make dev-backend      # Terminal 2 -- backend on :8080
```

Before starting the frontend, create or update `frontend/.env.local` with this entry, preserving any other settings in that file:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8080
```

```bash
make dev-frontend     # Terminal 3 -- frontend on :3000
```

`NEXT_PUBLIC_*` variables are read when the frontend starts; restart it after later changes to `.env.local`.

Without in-cluster credentials or a valid kubeconfig, the backend starts with a nil Kubernetes client. Cluster endpoints return HTTP 503 (`kubernetes client unavailable`) and scaling operations are skipped. The backend uses `client-go` directly; installing kubectl alone does not provide cluster access. Everything else -- policies, guardrails, audit log, authentication -- works as expected.

### Authentication

Authentication is always enforced. Set `ADMIN_USER` and `ADMIN_PASSWORD` to seed an admin account on first startup. Without them, a fresh database has no local account to log in with. Set `COOKIE_SECURE=false` for this HTTP-only development setup; HTTPS deployments retain the default `true`.

### CORS

The backend command above sets `ADMIN_USER`, so a separate frontend origin must be allowed with `CORS_ALLOWED_ORIGIN`. An explicit origin always takes precedence. If both variables are empty, the backend permits all origins for development; authentication is still enforced. See [configuration](configuration.md#backend-runtime).

---

## Mode 3 -- Frontend Only (Mock API)

For UI-only work without running the backend, database, or cluster:

```bash
make dev-mock
```

This starts a mock API server on port `4444` and the Next.js dev server on port `3000`. The mock includes realistic fixture data, full CRUD operations, and WebSocket streaming. It does not exercise real scaling logic.

**Mock API directory structure:**

```
frontend/mock-api/
  data.mjs          # Seed data: policies, workloads, users, executions, etc.
  server.mjs        # HTTP server entry point (Express-style, listens on port 4444)
  dev.mjs           # Combined launcher: mock API + Next.js dev server
  routes/
    *.mjs           # Route handler modules (one per resource: policies, exceptions, cluster, etc.)
```

### Mock data highlights

The seed data is designed to exercise every UI state:

| Entity | What it provides |
| :----- | :--------------- |
| Policies | 3 policies: one awake, one sleeping, one transitioning (shimmer visible on cards) |
| Executions | 7 completed + 1 running (shows progress bar, barberpole, and live log streaming) |
| Workloads | Running, sleeping, and partial statuses across dev/staging/monitoring namespaces |
| Pods | All lifecycle states: Running, Pending, CrashLoopBackOff, Failed, Succeeded, Terminating |
| Pod logs | Weighted random levels (INFO 50%, DEBUG 20%, WARN 15%, ERROR 15%) with realistic messages |
| Log streaming | Follow mode cycles through varied messages including error and warning lines |

---

## Testing Scaling End-to-End

Use [Your first policy](first-policy.md) for the complete plan → apply → sleep → wake walkthrough, including baseline capture, node protection, restoration, and cleanup. It uses the real `team-backend` fixtures and works on a prepared single-node or multi-node test cluster when every node is protected.

The [smoke checklist](testing/policy-smoke-test.md) is the short companion for recording results. The [scenario catalogue](test-plan-policy.md) covers scheduled exceptions and advanced cases. Mock mode can illustrate the UI but cannot verify real workload or node operations.

---

## Cluster Feature Matrix

What works in each local setup:

| Feature | Mode 1 (minikube) | Mode 2 (no cluster) | Mode 3 (mock) |
| :------ | :----------------: | :-----------------: | :-----------: |
| List deployments / statefulsets | Yes | -- | Fixture data |
| Scale to zero (sleep) | Yes | -- | Simulated |
| Restore replicas (wake) | Yes | -- | Simulated |
| Policy scheduling | Yes | Yes | Simulated |
| Scheduled exceptions | Yes | Yes | Simulated |
| Node cordon / drain | Yes | -- | -- |
| Node delete | Yes | -- | -- |
| Pod metrics (CPU / memory) | Yes | -- | Fixture data |
| Pod log streaming | Yes | -- | Simulated |
| Guardrails enforcement | Yes | Yes | Simulated |
| Audit log | Yes | Yes | Fixture data |
| Authentication / RBAC | Yes | Yes | Simulated |

---

## Environment Variables

| Variable | Default | Description |
| :------- | :------ | :---------- |
| `DATABASE_URL` | _(see Makefile)_ | PostgreSQL connection string |
| `ADMIN_USER` | _(empty)_ | Admin username -- seeds account on first startup |
| `ADMIN_PASSWORD` | _(empty)_ | Admin password (minimum 8 characters) |
| `CORS_ALLOWED_ORIGIN` | _(empty)_ | Allowed origin for CORS (required in Mode 2) |
| `CLUSTER_NAME` | _(empty)_ | Human-readable cluster name shown in `GET /api/cluster/info` |
| `NEXT_PUBLIC_API_URL` | `''` (empty string, same-origin) | Backend URL for the frontend dev server (build-time, Mode 2 only). `make dev-mock` sets this to `http://localhost:4444`. |
| `NEXT_PUBLIC_APP_VERSION` | Build-dependent | About modal version; standalone frontend builds fall back to `frontend/package.json` when unset. See [Application Build Versions](configuration.md#application-build-versions) for Docker and release builds. |

See [`.env.example`](../.env.example) for a template and the [configuration reference](configuration.md) for the complete runtime settings, including `COOKIE_SECURE`.

---

## Makefile Targets

| Target | Description |
| :----- | :---------- |
| `make dev` | Start PostgreSQL via Docker Compose |
| `make dev-backend` | Start Go backend with `go run` |
| `make dev-frontend` | Start Next.js dev server on `:3000` |
| `make dev-mock` | Start mock API (`:4444`) + Next.js (`:3000`) |
| `make test` | Run backend unit tests |
| `make lint` | Run golangci-lint (includes gosec) |
| `make build` | Full production build (frontend + backend binary) |
| `make docker-build` | Build Docker image |
| `make helm-install` | Install or upgrade Helm release |
| `make minikube-setup` | One-command: cluster + workloads + build + deploy |
| `make minikube-workloads` | Create sample workloads only |
| `make minikube-teardown` | Destroy the minikube cluster |

### Offline Rendering with Older Helm Clients

`make helm-template` renders locally without contacting a cluster. Helm 3.8.0 assumes Kubernetes 1.23.0 for this operation, which fails the chart's `>=1.25.0-0` requirement. Set the intended Kubernetes version explicitly when rendering with an older client; this example uses the chart's declared minimum:

```bash
helm template kube-phoenix helm/kube-phoenix \
  --namespace kube-phoenix \
  --kube-version 1.25.0
```

This override only supplies capabilities for local rendering. It does not change the Helm installation minimum or the version of a running cluster. CI uses Helm 4.3.0, whose default rendering capabilities satisfy the chart requirement.

---

## Troubleshooting

### PostgreSQL pod CrashLoopBackOff

**Symptom:** `kube-phoenix-postgresql-0` shows `CrashLoopBackOff` with `mkdir: can't create directory ... Permission denied` in logs.

**Cause:** The PVC was created with incorrect ownership from a previous deployment.

**Solution for disposable local data:** The commands below delete the database volume and its contents. If you need the data, back it up and repair the volume permissions before proceeding. For a fresh local database, delete the StatefulSet and PVC, then redeploy:

```bash
kubectl -n kube-phoenix delete statefulset kube-phoenix-postgresql --cascade=foreground
kubectl -n kube-phoenix delete pvc data-kube-phoenix-postgresql-0
helm upgrade kube-phoenix helm/kube-phoenix --namespace kube-phoenix --reuse-values
```

### Port 8080 already in use

**Symptom:** `listen tcp :8080: bind: address already in use`

**Cause:** A previous backend process or port-forward is still running.

**Solution:**

```bash
lsof -i :8080
kill <PID>
```

### Backend cannot reach minikube

**Symptom:** `WARNING: k8s client init failed: ...`

**Solution:** Verify minikube is running and the kubeconfig context is set:

```bash
minikube status -p local-cluster
kubectl config current-context   # should be "local-cluster"
```

### Port-forward drops with "connection refused"

**Symptom:** `kubectl port-forward` connects but immediately fails with `socat ... Connection refused`.

**Cause:** A stale port-forward is targeting a terminated pod. This can happen after a `rollout restart` or Helm upgrade.

**Solution:** Kill all port-forward processes and start a fresh one:

```bash
pkill -f "port-forward.*kube-phoenix"
kubectl port-forward -n kube-phoenix svc/kube-phoenix 8080:80
```

### Frontend shows "Backend unavailable"

**Symptom:** The UI renders but all API calls fail.

**Cause (Mode 1):** Port-forward is not running. Start it:

```bash
kubectl port-forward -n kube-phoenix svc/kube-phoenix 8080:80
```

**Cause (Mode 2):** `NEXT_PUBLIC_API_URL` is not set. The frontend defaults to calling itself (`:3000`) instead of the backend (`:8080`). Create `frontend/.env.local`:

```bash
echo 'NEXT_PUBLIC_API_URL=http://localhost:8080' > frontend/.env.local
```

Restart the frontend after creating the file.

**Cause (Mode 2):** `CORS_ALLOWED_ORIGIN` is not set. The backend rejects cross-origin requests. Restart with:

```bash
COOKIE_SECURE=false CORS_ALLOWED_ORIGIN=http://localhost:3000 make dev-backend
```

### Cannot log in -- no users exist

**Symptom:** Login screen appears but credentials are rejected. Backend log shows: `WARN: seed: no users in database and ADMIN_USER/ADMIN_PASSWORD not set`

**Cause:** Authentication is always enforced. Without `ADMIN_USER` / `ADMIN_PASSWORD`, no admin account is created and no one can log in.

**Solution (Mode 1):** Redeploy with credentials:

```bash
helm upgrade kube-phoenix helm/kube-phoenix \
  --namespace kube-phoenix \
  --set secret.adminUser=admin \
  --set secret.adminPassword=adminadmin \
  --reuse-values
```

**Solution (Mode 2):**

```bash
ADMIN_USER=admin ADMIN_PASSWORD=adminadmin COOKIE_SECURE=false make dev-backend
```

### Metrics columns are empty

Enable the metrics server addon. Metrics take 60--90 seconds to populate:

```bash
minikube addons enable metrics-server -p local-cluster
```

### Pod eviction timeout during drain

minikube nodes have limited resources. If draining hangs, check for pods with `PodDisruptionBudget` constraints or long `terminationGracePeriodSeconds` values:

```bash
kubectl get pdb --all-namespaces
```

### minikube node was deleted by a policy

kube-phoenix can delete Kubernetes node objects during sleep. minikube does not auto-replace them. Re-add with:

```bash
minikube node add -p local-cluster
```

Or recreate the cluster:

```bash
minikube delete -p local-cluster
minikube start -p local-cluster --nodes=3 --memory=4096 --cpus=2
```

---

## Cleanup

### Remove kube-phoenix from minikube

```bash
helm uninstall kube-phoenix --namespace kube-phoenix
kubectl delete namespace kube-phoenix
```

### Remove sample workloads

```bash
kubectl delete namespace team-backend team-web team-data team-qa team-platform team-ml team-mobile team-payments team-infra
```

### Stop minikube

```bash
minikube stop -p local-cluster       # pause the cluster (keeps state)
minikube delete -p local-cluster     # destroy the cluster entirely
```

### Stop local PostgreSQL (Mode 2)

```bash
docker compose down            # stop container, keep data
docker compose down -v         # stop container and delete data volume
```
