# Local Development Guide

This guide walks through setting up a complete local development environment for kube-phoenix, including a local Kubernetes cluster for testing policy-based scaling, scheduled exceptions, node draining, and live metrics.

## Prerequisites

| Tool | Version | Install | Purpose |
| :--- | :------ | :------ | :------ |
| Go | 1.26+ | `brew install go` | Backend compilation |
| Node.js | 24+ | `brew install node` | Frontend build (Next.js) |
| Docker | any | [Docker Desktop](https://docs.docker.com/desktop/install/mac-install/) | Image builds, local PostgreSQL |
| minikube | latest | `brew install minikube` | Local Kubernetes cluster |
| kubectl | any | `brew install kubectl` | Cluster interaction |
| Helm | 3.x | `brew install helm` | In-cluster deployment |
| golangci-lint | v2+ | `go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest` | Backend linting (optional) |

---

## Development Modes

kube-phoenix supports three local development modes. Choose the one that fits your workflow.

| Mode | What it tests | Setup effort |
| :--- | :------------ | :----------- |
| [In-cluster (minikube)](#mode-1----in-cluster-with-minikube) | Everything -- scaling, node ops, metrics, exceptions, guardrails | Full |
| [Backend + frontend (no cluster)](#mode-2----backend--frontend-without-a-cluster) | API, scheduler logic, auth, audit log | Medium |
| [Frontend only (mock API)](#mode-3----frontend-only-mock-api) | UI components, layouts, client-side state | Minimal |

---

## Mode 1 -- In-Cluster with minikube

This deploys kube-phoenix into minikube via Helm, exactly as it runs in production. It is the only mode that exercises real scaling, node draining, and scheduled exceptions.

### One-command setup

The setup script provisions the cluster, creates sample workloads, builds the image, and deploys kube-phoenix:

```bash
make minikube-setup
```

When it finishes, open `http://localhost:8080` and log in with `admin` / `adminadmin`.

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

**Namespaces and workloads:** Nine namespaces simulating team-owned environments (~240 pods across ~70 deployments). Most workloads use `busybox` with lightweight activity (HTTP serve, log lines, DNS lookups, compute, cron jobs, file watchers); a handful use `pause` for idle pods. Each container has resource requests (5m CPU / 8Mi mem) and limits (20m CPU / 32Mi mem).

| Namespace | Pods | What it tests |
| :-------- | :--: | :------------ |
| `team-backend` | 30 | Single-namespace policy. Exception: keep `api`. |
| `team-web` | 25 | Multi-deployment sleep. Exception: `cdn-origin`. |
| `team-data` | 30 | Cross-namespace policy (data + web). |
| `team-qa` | 25 | Nightly sleep. Guardrail: release freeze. |
| `team-platform` | 30 | Infra/observability stack. Guardrail target. |
| `team-ml` | 25 | GPU-style workloads. Exception: `model-serve`. |
| `team-mobile` | 25 | Multi-service mobile backend. Bulk sleep/wake. |
| `team-payments` | 25 | Compliance-sensitive. Guardrail: always protect. |
| `team-infra` | 25 | Cluster services. Node drain testing. |

### Suggested testing flow

1. **Basic policy:** Create a policy targeting `team-backend`. Sleep now. Verify `api`, `worker`, `cron` all scale to 0. Wake now. Replicas restored.

2. **Scheduled exception:** Create a scheduled exception on `team-backend/api`. Sleep the policy. `worker` and `cron` scale to 0 but `api` stays at 3.

3. **Cross-namespace policy:** Create a policy targeting `team-data,team-web`. Test multi-namespace sleep/wake in a single operation.

4. **Guardrails:** Add `team-qa` to guardrails system-protected namespaces. Verify policies cannot scale it.

5. **Node drain:** Sleep a policy with node drain enabled. Verify worker nodes are cordoned (`SchedulingDisabled`). Wake. Nodes uncordoned.

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
  --set image.tag=$(git rev-parse --short HEAD) \
  --set image.pullPolicy=Never \
  --set secret.adminUser=admin \
  --set secret.adminPassword=adminadmin \
  --set session.cookieSecure=false
```

| Flag | Why |
| :--- | :-- |
| `image.pullPolicy=Never` | Use the locally loaded image instead of pulling from a registry |
| `session.cookieSecure=false` | Allow session cookies over plain HTTP (no TLS on localhost) |

Wait for both pods to become ready:

```bash
kubectl -n kube-phoenix get pods -w
```

You should see two pods: `kube-phoenix-<hash>` (the application) and `kube-phoenix-postgresql-0` (the database). Both should reach `Running` / `1/1` within 30 seconds.

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
kubectl -n kube-phoenix rollout restart deploy/kube-phoenix
```

---

## Mode 2 -- Backend + Frontend without a Cluster

Useful for backend development (API, database, scheduler logic) when Kubernetes access is not required. Requires three terminals.

```bash
make dev              # Terminal 1 -- start PostgreSQL via Docker Compose
```

```bash
ADMIN_USER=admin \
ADMIN_PASSWORD=adminadmin \
CORS_ALLOWED_ORIGIN=http://localhost:3000 \
make dev-backend      # Terminal 2 -- backend on :8080
```

```bash
make dev-frontend     # Terminal 3 -- frontend on :3000
```

The frontend needs a `.env.local` file to know where the backend is:

```bash
echo 'NEXT_PUBLIC_API_URL=http://localhost:8080' > frontend/.env.local
```

> **Important:** `NEXT_PUBLIC_*` variables are baked in at startup. Restart the frontend after creating or changing `.env.local`.

The backend starts with a nil Kubernetes client. Cluster endpoints return empty data and scaling operations are skipped. Everything else -- policies, guardrails, audit log, authentication -- works as expected.

### Authentication

Authentication is always enforced. Set `ADMIN_USER` and `ADMIN_PASSWORD` to seed an admin account on first startup. Without them, the backend starts but no one can log in.

### CORS

When the frontend (`:3000`) and backend (`:8080`) run on different origins, `CORS_ALLOWED_ORIGIN` must be set. Without it, the browser blocks all API requests.

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

### Animation prototypes

`dev-mock` automatically sets `NEXT_PUBLIC_PROTOTYPES=1`, which enables the `/prototypes` route and adds a "Prototypes" link in the sidebar. This route hosts interactive animation demos for evaluating proposed UI animations before implementing them in production.

Prototype pages use the `.proto.tsx` file extension (e.g., `page.proto.tsx`). Next.js only recognizes this extension when `NEXT_PUBLIC_PROTOTYPES=1` is set. In production builds, these files are completely excluded -- no routes, no HTML, no JavaScript bundles are generated.

```
frontend/src/app/prototypes/
  page.proto.tsx              # Index page with card grid of all prototypes
  layout.proto.tsx            # Shared layout wrapper
  phoenix-rise/page.proto.tsx # A1: Skeleton screen → staggered reveal
  staggered-reveal/...        # A3: Dashboard card cascade
  heartbeat-pulse/...         # B1: Cluster status pulse with health states
  stream-glow/...             # B2: Real-time metric bar updates
  log-waterfall/...           # B4: Log stream with slide-in and error highlighting
  phoenix-lifecycle/...       # C1: Pod state machine (Pending, Running, CrashLoopBackOff, ...)
  rollout-wave/...            # C3: Execution progress bar with barberpole and glow tip
  sleep-wake-morph/...        # C4: Policy state transitions with shimmer
  drawer-slide/...            # D4: Spring physics drawer with staggered content
  sidebar-morph/...           # D5: Collapsible sidebar with label fade
```

To add a new prototype, create a directory under `prototypes/` with a `page.proto.tsx` file and add an entry to the `PROTOTYPES` array in `page.proto.tsx`.

---

## Testing Scaling End-to-End

With Mode 1 running, walk through a complete sleep/wake cycle. See also the [suggested testing flow](#suggested-testing-flow) above for a structured sequence.

### Create a policy

1. Open `http://localhost:8080` and navigate to **Policies**.
2. Create a new policy targeting the `team-backend` namespace.
3. Add a sleep window (e.g., a cron expression that fires in a few minutes).
4. The policy starts in **plan mode** -- executions are logged but nothing scales.

### Execute manually

1. On the policy card, select **Sleep Now**.
2. The `team-backend` deployments scale to zero. Verify:

```bash
kubectl -n team-backend get deployments
# All replicas should be 0
```

3. Select **Wake Now**. Replicas restore to their previous counts.

### Test scheduled exceptions

Exceptions allow specific workloads to be excluded from a policy during a time window.

1. Create a policy targeting `team-web` and switch it to **apply** mode.
2. Create a scheduled exception that exempts `team-web/assets` from sleep.
3. Trigger a sleep. The `web` and `bff` deployments scale to zero, but `assets` remains running.

### Verify node operations

With multi-node minikube, test node draining:

1. Check node status before and after a sleep:

```bash
kubectl get nodes
```

2. After a policy sleeps workloads and drains nodes, cordoned nodes appear as `SchedulingDisabled`.

> **Note:** minikube does not auto-replace deleted nodes. If a policy deletes a node, re-add it with `minikube node add -p local-cluster` or recreate the cluster.

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
| Animation prototypes | -- | -- | Yes |

---

## Environment Variables

| Variable | Default | Description |
| :------- | :------ | :---------- |
| `DATABASE_URL` | _(see Makefile)_ | PostgreSQL connection string |
| `ADMIN_USER` | _(empty)_ | Admin username -- seeds account on first startup |
| `ADMIN_PASSWORD` | _(empty)_ | Admin password (minimum 8 characters) |
| `CORS_ALLOWED_ORIGIN` | _(empty)_ | Allowed origin for CORS (required in Mode 2) |
| `CLUSTER_NAME` | _(empty)_ | Human-readable cluster name shown in `GET /api/cluster/info` |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080` | Backend URL for the frontend dev server (build-time, Mode 2 only) |
| `NEXT_PUBLIC_APP_VERSION` | `dev` | Version string shown in the About modal |
| `NEXT_PUBLIC_PROTOTYPES` | _(empty)_ | Set to `1` to enable `/prototypes` route (auto-set by `make dev-mock`) |

See `.env.example` for a copy-paste template.

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

---

## Troubleshooting

### PostgreSQL pod CrashLoopBackOff

**Symptom:** `kube-phoenix-postgresql-0` shows `CrashLoopBackOff` with `mkdir: can't create directory ... Permission denied` in logs.

**Cause:** The PVC was created with incorrect ownership from a previous deployment.

**Solution:** Delete the StatefulSet and PVC, then redeploy:

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
CORS_ALLOWED_ORIGIN=http://localhost:3000 make dev-backend
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
ADMIN_USER=admin ADMIN_PASSWORD=adminadmin make dev-backend
```

### Metrics columns are empty

Enable the metrics server addon. Metrics take 60--90 seconds to populate:

```bash
minikube addons enable metrics-server
```

### Pod eviction timeout during drain

minikube nodes have limited resources. If draining hangs, check for pods with `PodDisruptionBudget` constraints or long `terminationGracePeriodSeconds` values:

```bash
kubectl get pdb --all-namespaces
```

### minikube node was deleted by a policy

kube-phoenix can delete Kubernetes node objects during sleep. minikube does not auto-replace them. Re-add with:

```bash
minikube node add
```

Or recreate the cluster:

```bash
minikube delete && minikube start --nodes=3 --memory=4096 --cpus=2
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
kubectl delete namespace team-backend team-web team-data team-qa
```

### Stop minikube

```bash
minikube stop       # pause the cluster (keeps state)
minikube delete     # destroy the cluster entirely
```

### Stop local PostgreSQL (Mode 2)

```bash
docker compose down            # stop container, keep data
docker compose down -v         # stop container and delete data volume
```
