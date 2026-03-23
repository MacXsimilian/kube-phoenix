# kube-phoenix

**Scheduled sleep and wake for Kubernetes clusters.**

[![Go Version](https://img.shields.io/badge/go-1.26-00ADD8?logo=go&logoColor=white)](backend/go.mod)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/MacXsimilian/kube-phoenix?logo=github)](https://github.com/MacXsimilian/kube-phoenix/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/MacXsimilian/kube-phoenix/ci.yml?branch=master&label=CI)](https://github.com/MacXsimilian/kube-phoenix/actions/workflows/ci.yml)
[![Go Report Card](https://goreportcard.com/badge/github.com/macxsimilian/kube-phoenix/backend?cache=v2)](https://goreportcard.com/report/github.com/macxsimilian/kube-phoenix/backend)
[![OpenSSF Scorecard](https://img.shields.io/ossf-scorecard/github.com/MacXsimilian/kube-phoenix?label=OpenSSF)](https://scorecard.dev/viewer/?uri=github.com/MacXsimilian/kube-phoenix)

kube-phoenix replaces ad-hoc cron scripts with a proper operator for scheduling cluster downtime. Define sleep windows like "Mon--Fri 7 PM -- 7 AM," and kube-phoenix scales workloads to zero, drains nodes, and restores everything on schedule. A single Go binary serves both the API and a full-featured web UI -- deploy with one Helm command.

---

## Key Features

- **Policy-based scheduling** -- Declare sleep windows with cron expressions, namespace filters, and label selectors. Plan mode lets you verify before anything scales.
- **DB-backed replica snapshots** -- Replica counts are persisted in PostgreSQL, not just annotations. Restores are reliable even if annotations are overwritten.
- **Startup recovery** -- On restart, the intended state is recomputed and any mismatch triggers automatic correction.
- **Overrides and scheduled exceptions** -- Time-windowed overrides (`stay_awake`, `force_sleep`) and future exception windows with ticket references for release weekends or on-call periods.
- **Live cluster visibility** -- Real-time view of deployments, stateful sets, nodes, pod metrics, Kubernetes events, and streaming container logs with search.
- **Guardrails** -- Protect namespaces, node labels, and taints from ever being touched by the scaler.
- **RBAC and OIDC** -- Session-based auth with admin/operator/viewer roles. Optional Keycloak SSO with AD group-to-role mapping.
- **Prometheus metrics** -- Built-in `/metrics` endpoint with counters for executions, workloads scaled, nodes drained, auth attempts, and more.

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

## Screenshots

<!-- TODO: Add screenshots of the overview dashboard, policy detail page, and cluster state view. -->

---

## Roadmap

| Feature | Status |
| :-- | :-- |
| Policy model with overrides, exceptions, DB snapshots, recovery | Done |
| Multi-user RBAC (admin / operator / viewer) | Done |
| Keycloak OIDC with AD group mapping | Done |
| Scheduled exceptions with ticket references | Done |
| OpenAPI 3.1 spec and Swagger UI | Done |
| Slack / email notifications | Planned |
| Multi-cluster support | Planned |
| Emergency wake button | Planned |

---

## Community and Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, branching conventions, and the PR checklist.

- [Open an issue](https://github.com/MacXsimilian/kube-phoenix/issues/new)
- [Browse open issues](https://github.com/MacXsimilian/kube-phoenix/issues)

---

## License

Apache License 2.0 -- see [LICENSE](LICENSE) for details.
