#!/usr/bin/env bash
#
# minikube-setup.sh — Provision a standardized minikube cluster for kube-phoenix
# development and testing. Idempotent: safe to re-run.
#
# Usage:
#   ./hack/minikube-setup.sh              # full setup (cluster + workloads + deploy app)
#   ./hack/minikube-setup.sh --workloads  # only create sample workloads (cluster already running)
#   ./hack/minikube-setup.sh --teardown   # destroy the cluster and all resources
#
set -euo pipefail

# ── Configuration ────────────────────────────────────────────────────────────
# Override these via environment variables if needed.
PROFILE="${MINIKUBE_PROFILE:-local-cluster}"
NODES="${MINIKUBE_NODES:-3}"
MEMORY="${MINIKUBE_MEMORY:-4096}"
CPUS="${MINIKUBE_CPUS:-2}"
K8S_VERSION="${MINIKUBE_K8S_VERSION:-stable}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-adminadmin}"

# ── Helpers ──────────────────────────────────────────────────────────────────
info()  { printf '\033[1;34m▸ %s\033[0m\n' "$*"; }
ok()    { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
warn()  { printf '\033[1;33m⚠ %s\033[0m\n' "$*"; }
error() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; }

require() {
  for cmd in "$@"; do
    if ! command -v "$cmd" &>/dev/null; then
      error "Required tool not found: $cmd"
      exit 1
    fi
  done
}

# apply_deployment creates a deployment with a lightweight busybox command
# that does something small (HTTP serve, log lines, compute, etc.) instead
# of just pausing. Each "role" maps to a different activity so `kubectl logs`
# and resource metrics look realistic during testing.
apply_deployment() {
  local ns="$1" name="$2" replicas="$3" role="${4:-default}"

  local image="busybox:1.37"
  local cmd

  case "$role" in
    http)
      # Serve a tiny health page on port 8080
      cmd='["sh","-c","while true; do echo -e \"HTTP/1.1 200 OK\\r\\nContent-Length: 2\\r\\n\\r\\nOK\" | nc -l -p 8080; done"]'
      ;;
    log)
      # Write a log line every 5 seconds
      cmd='["sh","-c","i=0; while true; do echo \"$(date -u +%FT%TZ) level=info msg=heartbeat seq=$i\"; i=$((i+1)); sleep 5; done"]'
      ;;
    compute)
      # Burn a tiny amount of CPU (checksum /dev/urandom in a loop with sleeps)
      cmd='["sh","-c","while true; do dd if=/dev/urandom bs=64 count=1 2>/dev/null | md5sum >/dev/null; sleep 3; done"]'
      ;;
    watch)
      # Watch /tmp for filesystem events (simulates a sidecar watcher)
      cmd='["sh","-c","mkdir -p /tmp/spool; while true; do touch /tmp/spool/$(date +%s); sleep 10; ls /tmp/spool | tail -5; find /tmp/spool -mmin +2 -delete 2>/dev/null; done"]'
      ;;
    cron)
      # Run a task every 30 seconds (simulates a lightweight cron job)
      cmd='["sh","-c","while true; do echo \"$(date -u +%FT%TZ) running batch task\"; seq 1 100 | md5sum >/dev/null; sleep 30; done"]'
      ;;
    dns)
      # Resolve a hostname every 10 seconds (simulates service discovery)
      cmd='["sh","-c","while true; do nslookup kubernetes.default.svc.cluster.local 2>&1 | head -4; sleep 10; done"]'
      ;;
    pause)
      # Do nothing — near-zero resource usage, like idle pods in a real cluster
      image="registry.k8s.io/pause:3.10"
      cmd='["/pause"]'
      ;;
    *)
      # Default: simple heartbeat loop
      cmd='["sh","-c","while true; do echo \"$(date -u +%FT%TZ) alive\"; sleep 15; done"]'
      ;;
  esac

  cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: $name
  namespace: $ns
spec:
  replicas: $replicas
  selector:
    matchLabels:
      app: $name
  template:
    metadata:
      labels:
        app: $name
    spec:
      containers:
      - name: $name
        image: $image
        command: $cmd
        resources:
          requests:
            cpu: 5m
            memory: 8Mi
          limits:
            cpu: 20m
            memory: 32Mi
EOF
}

# ── Preflight ────────────────────────────────────────────────────────────────
require minikube kubectl helm docker

# ── Cluster ──────────────────────────────────────────────────────────────────
#
# Node topology (3 nodes by default):
#
#   kube-phoenix         control-plane   Runs system pods + kube-phoenix itself
#   kube-phoenix-m02     worker          General workload node
#   kube-phoenix-m03     worker          General workload node
#
# The profile name "kube-phoenix" gives nodes deterministic, recognizable
# names. Two worker nodes allow testing node drain where workloads migrate
# from one worker to the other.

create_cluster() {
  if minikube status -p "$PROFILE" &>/dev/null; then
    ok "Cluster '$PROFILE' already running"
  else
    info "Starting minikube cluster ($NODES nodes, ${MEMORY}MB, $CPUS CPUs)"
    minikube start \
      --profile="$PROFILE" \
      --nodes="$NODES" \
      --memory="$MEMORY" \
      --cpus="$CPUS" \
      --kubernetes-version="$K8S_VERSION"
    ok "Cluster started"
  fi

  info "Enabling metrics-server addon"
  minikube addons enable metrics-server -p "$PROFILE"
  ok "Metrics server enabled"

  info "Labeling worker nodes"
  kubectl label node "${PROFILE}-m02" workload-tier=general --overwrite
  kubectl label node "${PROFILE}-m03" workload-tier=general --overwrite
  ok "Nodes labeled"
}

# ── Workloads ────────────────────────────────────────────────────────────────
#
# The test environment simulates a company with four teams, each owning a
# namespace. This structure exercises the main kube-phoenix features:
#
#   ┌──────────────────────────────────────────────────────────────────────────┐
#   │ Namespace     │ Pods │ What it tests                                   │
#   ├──────────────────────────────────────────────────────────────────────────┤
#   │ team-backend  │  30  │ Single-namespace policy. Exception: keep api.   │
#   │ team-web      │  25  │ Multi-deployment sleep. Exception: cdn-origin.  │
#   │ team-data     │  30  │ Cross-namespace policy (data + web).            │
#   │ team-qa       │  25  │ Nightly sleep. Guardrail: release freeze.       │
#   │ team-platform │  30  │ Infra/observability stack. Guardrail target.    │
#   │ team-ml       │  25  │ GPU-style workloads. Exception: model-serve.    │
#   │ team-mobile   │  25  │ Multi-service mobile backend. Bulk sleep/wake.  │
#   │ team-payments │  25  │ Compliance-sensitive. Guardrail: always protect. │
#   │ team-infra    │  25  │ Cluster services. Node drain testing.           │
#   ├──────────────────────────────────────────────────────────────────────────┤
#   │ TOTAL         │ 240  │ ~80 pods per node across 3 nodes                │
#   └──────────────────────────────────────────────────────────────────────────┘
#
# Suggested testing flow:
#
#   1. Create a policy targeting "team-backend" → sleep now → verify api,
#      worker, cron all scale to 0 → wake now → replicas restored.
#
#   2. Create a scheduled exception on "team-backend/api" → sleep now →
#      worker and cron scale to 0, api stays at 3.
#
#   3. Create a cross-namespace policy targeting "team-data,team-web" →
#      test multi-namespace sleep/wake.
#
#   4. Add "team-qa" to guardrails system-protected namespaces → verify
#      policies cannot scale it.
#
#   5. Sleep a policy with node drain enabled → verify worker nodes are
#      cordoned → wake → nodes uncordoned.
#

create_workloads() {
  info "Creating sample namespaces and workloads"

  for ns in team-backend team-web team-data team-qa team-platform team-ml team-mobile team-payments team-infra; do
    kubectl create namespace "$ns" --dry-run=client -o yaml | kubectl apply -f -
  done

  # ── team-backend (7 deployments, 9 pods) ──────────────────────────────────
  apply_deployment team-backend api           2 http
  apply_deployment team-backend worker        1 compute
  apply_deployment team-backend cron          1 cron
  apply_deployment team-backend gateway       2 http
  apply_deployment team-backend auth          1 http
  apply_deployment team-backend notifications 1 log
  apply_deployment team-backend cache         1 pause

  # ── team-web (5 deployments, 6 pods) ────────────────────────────────────
  apply_deployment team-web web        2 http
  apply_deployment team-web bff        1 http
  apply_deployment team-web assets     1 http
  apply_deployment team-web ssr        1 compute
  apply_deployment team-web analytics  1 log

  # ── team-data (6 deployments, 7 pods) ───────────────────────────────────
  apply_deployment team-data pipeline  2 compute
  apply_deployment team-data scheduler 1 cron
  apply_deployment team-data dashboard 1 http
  apply_deployment team-data etl       1 compute
  apply_deployment team-data warehouse 1 pause
  apply_deployment team-data metabase  1 http

  # ── team-qa (5 deployments, 5 pods) ─────────────────────────────────────
  apply_deployment team-qa test-runner 1 compute
  apply_deployment team-qa selenium    1 compute
  apply_deployment team-qa mock-api    1 http
  apply_deployment team-qa cypress     1 compute
  apply_deployment team-qa load-test   1 compute

  # ── team-platform (6 deployments, 6 pods) ───────────────────────────────
  apply_deployment team-platform vault        1 http
  apply_deployment team-platform prometheus   1 log
  apply_deployment team-platform grafana      1 http
  apply_deployment team-platform alertmanager 1 watch
  apply_deployment team-platform loki         1 log
  apply_deployment team-platform ingress      1 http

  # ── team-ml (4 deployments, 5 pods) ─────────────────────────────────────
  apply_deployment team-ml model-serve   2 http
  apply_deployment team-ml trainer       1 compute
  apply_deployment team-ml feature-store 1 http
  apply_deployment team-ml notebook      1 http

  # ── team-mobile (5 deployments, 5 pods) ─────────────────────────────────
  apply_deployment team-mobile push-service 1 http
  apply_deployment team-mobile media-api    1 http
  apply_deployment team-mobile chat-service 1 log
  apply_deployment team-mobile sync         1 cron
  apply_deployment team-mobile deeplink     1 http

  # ── team-payments (6 deployments, 6 pods) ───────────────────────────────
  apply_deployment team-payments ledger     1 log
  apply_deployment team-payments processor  1 compute
  apply_deployment team-payments fraud      1 compute
  apply_deployment team-payments invoicing  1 cron
  apply_deployment team-payments webhook    1 http
  apply_deployment team-payments reconciler 1 cron

  # ── team-infra (6 deployments, 6 pods) ──────────────────────────────────
  apply_deployment team-infra dns         1 dns
  apply_deployment team-infra log-shipper 1 log
  apply_deployment team-infra backup      1 watch
  apply_deployment team-infra registry    1 http
  apply_deployment team-infra scanner     1 watch
  apply_deployment team-infra policy-agent 1 dns

  ok "Sample workloads created"
  echo
  echo "  NAMESPACE       DEPLOYMENT       REPLICAS"
  echo "  ─────────────   ──────────────   ────────"
  kubectl get deployments -A --no-headers | grep -E "team-" | \
    awk '{printf "  %-15s %-16s %s\n", $1, $2, $3}' | sort
  echo
}

# ── Deploy app ───────────────────────────────────────────────────────────────
deploy_app() {
  local tag
  tag="$(git rev-parse --short HEAD)"

  info "Building Docker image (tag: $tag)"
  make docker-build TAG="$tag"
  ok "Image built"

  info "Loading image into minikube"
  minikube image load "ghcr.io/macxsimilian/kube-phoenix:$tag" -p "$PROFILE"
  ok "Image loaded"

  info "Deploying kube-phoenix via Helm"
  helm upgrade --install kube-phoenix helm/kube-phoenix \
    --namespace kube-phoenix \
    --create-namespace \
    --set-string image.tag="$tag" \
    --set image.pullPolicy=Never \
    --set secret.adminUser="$ADMIN_USER" \
    --set secret.adminPassword="$ADMIN_PASSWORD" \
    --set session.cookieSecure=false \
    --wait \
    --timeout=120s
  ok "kube-phoenix deployed"

  info "Waiting for pods to be ready"
  kubectl -n kube-phoenix wait --for=condition=ready pod --all --timeout=90s
  ok "All pods ready"
  echo
  kubectl -n kube-phoenix get pods
  echo

  info "Starting port-forward (background)"
  pkill -f "port-forward.*kube-phoenix" 2>/dev/null || true
  sleep 1
  kubectl port-forward -n kube-phoenix svc/kube-phoenix 8080:80 &>/dev/null &
  sleep 2

  info "Running smoke tests"
  local smoke_ok=true
  # 1. Health endpoint
  if ! curl -sf http://localhost:8080/healthz >/dev/null 2>&1; then
    warn "Smoke test FAILED: /healthz not reachable"
    smoke_ok=false
  fi
  # 2. API returns JSON (not blocked by CSP or middleware)
  if ! curl -sf http://localhost:8080/api/version 2>&1 | grep -q '"version"'; then
    warn "Smoke test FAILED: /api/version did not return JSON"
    smoke_ok=false
  fi
  # 3. Frontend serves HTML with scripts (CSP must allow inline scripts)
  local html
  html=$(curl -sf http://localhost:8080/ 2>&1)
  if ! echo "$html" | grep -q '<script'; then
    warn "Smoke test FAILED: frontend HTML missing <script> tags (possible CSP issue)"
    smoke_ok=false
  fi
  if [ "$smoke_ok" = true ]; then
    ok "Smoke tests passed"
  else
    warn "Some smoke tests failed — check browser console for errors"
  fi

  ok "kube-phoenix is running"
  echo
  echo "  URL:      http://localhost:8080"
  echo "  User:     $ADMIN_USER"
  echo "  Password: $ADMIN_PASSWORD"
  echo
}

# ── Teardown ─────────────────────────────────────────────────────────────────
teardown() {
  warn "Tearing down minikube cluster '$PROFILE'"
  pkill -f "port-forward.*kube-phoenix" 2>/dev/null || true
  helm uninstall kube-phoenix --namespace kube-phoenix 2>/dev/null || true
  minikube delete -p "$PROFILE"
  ok "Cluster destroyed"
}

# ── Main ─────────────────────────────────────────────────────────────────────
case "${1:-}" in
  --workloads)
    create_workloads
    ;;
  --teardown)
    teardown
    ;;
  --help|-h)
    echo "Usage: $0 [--workloads | --teardown | --help]"
    echo
    echo "  (no args)     Full setup: cluster + addons + workloads + build + deploy"
    echo "  --workloads   Create sample workloads only (cluster must be running)"
    echo "  --teardown    Destroy the minikube cluster"
    echo
    echo "Environment variables:"
    echo "  MINIKUBE_PROFILE      Minikube profile name    (default: local-cluster)"
    echo "  MINIKUBE_NODES        Number of nodes           (default: 3)"
    echo "  MINIKUBE_MEMORY       Memory per node in MB     (default: 4096)"
    echo "  MINIKUBE_CPUS         CPUs per node             (default: 2)"
    echo "  MINIKUBE_K8S_VERSION  Kubernetes version        (default: stable)"
    echo "  ADMIN_USER            App admin username         (default: admin)"
    echo "  ADMIN_PASSWORD        App admin password         (default: adminadmin)"
    ;;
  *)
    create_cluster
    create_workloads
    deploy_app
    ;;
esac
