# kube-phoenix 🐦‍🔥

[![Build Status](https://img.shields.io/github/actions/workflow/status/MacXsimilian/kube-phoenix/ci.yml?branch=master)](https://github.com/MacXsimilian/kube-phoenix/actions/workflows/ci.yml)
[![Latest Release](https://img.shields.io/github/v/release/MacXsimilian/kube-phoenix?label=release&logo=github)](https://github.com/MacXsimilian/kube-phoenix/releases/latest)
[![Go Report Card](https://goreportcard.com/badge/github.com/macxsimilian/kube-phoenix/backend?cache=v2)](https://goreportcard.com/report/github.com/macxsimilian/kube-phoenix/backend)
[![Go Version](https://img.shields.io/badge/go-1.26-00ADD8?logo=go&logoColor=white)](backend/go.mod)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)](frontend/package.json)
[![OpenAPI](https://img.shields.io/badge/OpenAPI-3.1-6BA539?logo=openapiinitiative&logoColor=white)](openapi.yaml)
[![Security Scan](https://img.shields.io/github/actions/workflow/status/MacXsimilian/kube-phoenix/security.yml?branch=master&label=security&logo=shieldsdotio&logoColor=white)](https://github.com/MacXsimilian/kube-phoenix/actions/workflows/security.yml)
[![Docker](https://img.shields.io/badge/ghcr.io-kube--phoenix-2496ED?logo=docker&logoColor=white)](https://github.com/MacXsimilian/kube-phoenix/pkgs/container/kube-phoenix)
[![Helm Chart](https://img.shields.io/badge/helm-oci%3A%2F%2Fghcr.io-0F1689?logo=helm&logoColor=white)](https://github.com/MacXsimilian/kube-phoenix/pkgs/container/helm%2Fkube-phoenix)
[![Prometheus](https://img.shields.io/badge/metrics-prometheus-E6522C?logo=prometheus&logoColor=white)](#observability)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://github.com/MacXsimilian/kube-phoenix/blob/master/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/MacXsimilian/kube-phoenix)](https://github.com/MacXsimilian/kube-phoenix/stargazers)
[![Contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/MacXsimilian/kube-phoenix/issues)

**Scheduled sleep and wake for Kubernetes clusters.**

kube-phoenix replaces ad-hoc cron scripts with a proper operator for scheduling cluster downtime. Define sleep windows like "Mon--Fri 7 PM -- 7 AM," and kube-phoenix scales workloads to zero, drains nodes, and restores everything on schedule. A single Go binary serves both the API and a full-featured web UI -- deploy with one Helm command.

---

## Key Features

- **Policy-based scheduling** -- Declare sleep windows with cron expressions, namespace filters, and label selectors. Plan mode lets you verify before anything scales.
- **DB-backed replica snapshots** -- Replica counts are persisted in PostgreSQL, not just annotations. Restores are reliable even if annotations are overwritten.
- **Startup recovery** -- On restart, the intended state is recomputed and any mismatch triggers automatic correction.
- **Overrides and scheduled exceptions** -- Time-windowed overrides (`stay_awake`, `force_sleep`) and future exception windows with ticket references for release weekends or on-call periods.
- **Live cluster visibility** -- Real-time view of deployments, stateful sets, nodes, pod metrics, Kubernetes events, and streaming container logs with search.
- **Guardrails** -- Protect namespaces, node labels, and taints from the scaler. Priority namespace scaling ensures critical workloads are processed first.
- **RBAC and OIDC** -- Session-based auth with admin/operator/viewer roles. Optional Keycloak SSO with AD group-to-role mapping.
- **Prometheus metrics** -- Built-in `/metrics` endpoint with 24 metrics covering HTTP requests, K8s API calls, policy executions, CRUD operations, scheduler health, WebSocket connections, auth, and caching.

---

## How It Works

A **policy** declares when workloads should sleep using sleep windows -- human-readable time ranges evaluated on a 30-second tick loop. When the intended state (sleeping or awake) differs from the actual state, kube-phoenix executes a transition: scaling deployments and stateful sets to zero and draining nodes on sleep, or restoring saved replica counts and uncordoning nodes on wake. Overrides and scheduled exceptions take precedence over the normal schedule when active.

```
  Sleep                                Wake
  ─────                                ────
  Save replica counts (DB + annotation)   Read saved replica counts
  Scale replicas to 0                     Restore replicas
  Cordon nodes                            Uncordon nodes
  Evict pods                              (Autoscaler provisions new nodes
  Delete nodes                             as pending pods appear)
```

---

## Quick Start

Requires Helm 3+ and a Kubernetes cluster (v1.25+).

```bash
helm upgrade --install kube-phoenix oci://ghcr.io/macxsimilian/helm/kube-phoenix \
  --namespace kube-phoenix --create-namespace \
  --set secret.adminUser=admin \
  --set secret.adminPassword=changeme
```

```bash
kubectl port-forward -n kube-phoenix svc/kube-phoenix 8080:80
```

Open `http://localhost:8080`. New policies start in **plan mode** -- nothing scales until you switch to `apply`.

See [docs/deployment.md](docs/deployment.md) for production setup with external PostgreSQL, Ingress, and AWS ALB.

---

## Documentation

| Topic | Link |
| :-- | :-- |
| Deployment guide | [docs/deployment.md](docs/deployment.md) |
| Configuration reference | [docs/configuration.md](docs/configuration.md) |
| API reference and Swagger UI | [docs/api.md](docs/api.md) |
| Architecture and system design | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Troubleshooting | [docs/troubleshooting.md](docs/troubleshooting.md) |
| Changelog | [CHANGELOG.md](CHANGELOG.md) |

---

## Community and Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, branching conventions, and the PR checklist.

- [Open an issue](https://github.com/MacXsimilian/kube-phoenix/issues/new)
- [Browse open issues](https://github.com/MacXsimilian/kube-phoenix/issues)

---

## License

Apache License 2.0 -- see [LICENSE](LICENSE) for details.
