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

# Pause image — near-zero resource usage, ideal for test workloads.
PAUSE_IMAGE="registry.k8s.io/pause:3.10"

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

apply_deployment() {
  local ns="$1" name="$2" replicas="$3"
  kubectl -n "$ns" create deployment "$name" \
    --image="$PAUSE_IMAGE" --replicas="$replicas" \
    --dry-run=client -o yaml | kubectl apply -f -
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

  # ── team-backend (30 pods) ────────────────────────────────────────────────
  apply_deployment team-backend api          5
  apply_deployment team-backend worker       5
  apply_deployment team-backend cron         3
  apply_deployment team-backend gateway      5
  apply_deployment team-backend auth         4
  apply_deployment team-backend notifications 3
  apply_deployment team-backend cache        3
  apply_deployment team-backend search       2

  # ── team-web (25 pods) ──────────────────────────────────────────────────
  apply_deployment team-web web        5
  apply_deployment team-web bff        4
  apply_deployment team-web assets     3
  apply_deployment team-web ssr        4
  apply_deployment team-web cdn-origin 3
  apply_deployment team-web analytics  3
  apply_deployment team-web preview    3

  # ── team-data (30 pods) ─────────────────────────────────────────────────
  apply_deployment team-data pipeline    5
  apply_deployment team-data scheduler   3
  apply_deployment team-data dashboard   3
  apply_deployment team-data etl         4
  apply_deployment team-data warehouse   3
  apply_deployment team-data spark-driver 2
  apply_deployment team-data spark-worker 5
  apply_deployment team-data airflow     3
  apply_deployment team-data metabase    2

  # ── team-qa (25 pods) ───────────────────────────────────────────────────
  apply_deployment team-qa test-runner  5
  apply_deployment team-qa selenium     4
  apply_deployment team-qa mock-api     3
  apply_deployment team-qa cypress      4
  apply_deployment team-qa load-test    3
  apply_deployment team-qa coverage     3
  apply_deployment team-qa report       3

  # ── team-platform (30 pods) ─────────────────────────────────────────────
  apply_deployment team-platform consul        4
  apply_deployment team-platform vault         3
  apply_deployment team-platform prometheus     3
  apply_deployment team-platform grafana       2
  apply_deployment team-platform alertmanager  2
  apply_deployment team-platform loki          3
  apply_deployment team-platform tempo         3
  apply_deployment team-platform otel-collector 4
  apply_deployment team-platform cert-manager  3
  apply_deployment team-platform ingress       3

  # ── team-ml (25 pods) ───────────────────────────────────────────────────
  apply_deployment team-ml model-serve   5
  apply_deployment team-ml trainer       3
  apply_deployment team-ml feature-store 3
  apply_deployment team-ml notebook      4
  apply_deployment team-ml labeling      3
  apply_deployment team-ml inference     4
  apply_deployment team-ml vector-db     3

  # ── team-mobile (25 pods) ───────────────────────────────────────────────
  apply_deployment team-mobile push-service  4
  apply_deployment team-mobile media-api     3
  apply_deployment team-mobile chat-service  4
  apply_deployment team-mobile sync          3
  apply_deployment team-mobile deeplink      3
  apply_deployment team-mobile config-server 3
  apply_deployment team-mobile ab-testing    3
  apply_deployment team-mobile crash-report  2

  # ── team-payments (25 pods) ─────────────────────────────────────────────
  apply_deployment team-payments ledger     4
  apply_deployment team-payments processor  3
  apply_deployment team-payments fraud      3
  apply_deployment team-payments invoicing  3
  apply_deployment team-payments webhook    4
  apply_deployment team-payments reconciler 3
  apply_deployment team-payments pci-proxy  3
  apply_deployment team-payments audit      2

  # ── team-infra (25 pods) ────────────────────────────────────────────────
  apply_deployment team-infra dns          3
  apply_deployment team-infra ntp          2
  apply_deployment team-infra log-shipper  4
  apply_deployment team-infra backup       3
  apply_deployment team-infra registry     3
  apply_deployment team-infra artifact     3
  apply_deployment team-infra scanner      4
  apply_deployment team-infra policy-agent 3

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
    --set image.tag="$tag" \
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
