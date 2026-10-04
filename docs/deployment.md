# Deployment Guide

Install a release into an existing cluster, then follow [Your first policy](first-policy.md) on disposable workloads. For a local development cluster and sample workloads, start with the [local development guide](local-development.md).

## Prerequisites

| Requirement | Minimum Version | Notes |
| :---------- | :-------------- | :---- |
| Kubernetes | 1.25+ | Minimum declared by `kubeVersion` in `helm/kube-phoenix/Chart.yaml` |
| Helm | 3.8+ | OCI support enabled by default; CI and chart publishing use 4.3.0 |
| PostgreSQL | 14+ | Bundled database defaults to 18.6; external instance recommended for production |

You also need `kubectl` configured for the intended cluster, permission to create the chart's cluster-wide RBAC resources, and a default StorageClass for the bundled database (or an explicit `postgresql.persistence.storageClass`). Verify `kubectl config current-context` before installation.

## Quick Install

For a local HTTP evaluation, create `values-local.yaml`. Replace the password placeholder before running Helm; admin credentials seed a fresh database only.

```yaml
# values-local.yaml
createNamespace: false
secret:
  adminUser: admin
  adminPassword: "replace-with-your-local-password"
session:
  cookieSecure: false
```

```bash
helm upgrade --install kube-phoenix oci://ghcr.io/macxsimilian/helm/kube-phoenix \
  --namespace kube-phoenix \
  --create-namespace \
  -f values-local.yaml \
  --wait --timeout 5m
```

```bash
kubectl port-forward -n kube-phoenix svc/kube-phoenix 8080:80
```

Keep the port-forward running, open `http://localhost:8080`, and log in as `admin` with the password from your values file. `session.cookieSecure=false` permits cookies over local HTTP. Use `true` with HTTPS. `createNamespace=false` lets Helm's `--create-namespace` handle namespace creation instead of also rendering the chart's Namespace resource.

New policies default to **plan mode**. Manual trigger dialogs offer an explicit **Apply (live)** override, so inspect the selected mode before confirming. Continue with [Your first policy](first-policy.md), which protects every node before any live scaling.

## Production Deployment

Keep a `values-production.yaml` file for deployment-specific settings and pass it on every install or upgrade. The examples below extend that same file. Configure real credentials through a [pre-existing Secret](#pre-existing-secret) or a local values file excluded from version control; do not use the chart's default bootstrap passwords.

```yaml
# values-production.yaml — base settings; add database and ingress settings below
createNamespace: false
session:
  cookieSecure: true
secret:
  adminUser: admin
  adminPassword: "replace-before-installing"
```

Use one application replica. The current scheduler and live execution-log broker operate within the application process; increasing `replicaCount` is not a documented high-availability setup. See [architecture](../ARCHITECTURE.md#why-sse-and-websocket).

### External Database

For production workloads, use a managed PostgreSQL instance (Amazon RDS, Aurora, Cloud SQL, Azure Database for PostgreSQL) instead of the bundled StatefulSet.

Add one of these alternatives to `values-production.yaml`, replacing the example host and credentials.

**Option A -- Full DSN:**

```yaml
postgresql:
  enabled: false
externalDatabase:
  url: "host=my-rds.example.com user=kube_phoenix password=replace-me dbname=kube_phoenix port=5432 sslmode=require"
```

**Option B -- Individual fields:**

```yaml
postgresql:
  enabled: false
externalDatabase:
  host: my-rds.example.com
  username: kube_phoenix
  password: "replace-me"
  database: kube_phoenix
  port: 5432
  sslmode: require
```

Persist the selected database settings in the values file used for installation and future upgrades. If you intentionally use the bundled database outside a disposable local environment, replace its default `postgresql.auth.password` and plan for persistent-volume backups.

The bundled PostgreSQL 18 image stores data under `/var/lib/postgresql/18/docker` on a volume mounted at `/var/lib/postgresql`. Existing PostgreSQL 17 volumes require a database migration to a fresh volume; changing the image tag does not convert their data. Follow [PostgreSQL 17 to 18 migration](postgresql-upgrade.md) before upgrading an existing bundled database. External PostgreSQL 14+ remains supported; use your database provider's upgrade procedure for a managed instance.

### Ingress with TLS

Add these settings to `values-production.yaml`. This example assumes an nginx ingress controller, cert-manager, and an existing `letsencrypt-prod` ClusterIssuer; the chart does not install them.

```yaml
# values-production.yaml
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
  host: kube-phoenix.example.com
  tls:
    - hosts:
        - kube-phoenix.example.com
      secretName: kube-phoenix-tls
```

```bash
helm upgrade --install kube-phoenix oci://ghcr.io/macxsimilian/helm/kube-phoenix \
  --namespace kube-phoenix \
  --create-namespace \
  -f values-production.yaml
```

### Pre-existing Secret

To manage credentials outside of Helm values, create a Secret in the application's namespace containing `DATABASE_URL`, `ADMIN_USER`, and `ADMIN_PASSWORD`, then reference it. Include `OIDC_CLIENT_SECRET` when using an OIDC confidential client. The chart uses the supplied Secret instead of generating an application Secret:

```yaml
postgresql:
  enabled: false
externalDatabase:
  host: my-rds.example.com
secret:
  existingSecret: my-kube-phoenix-secret
```

For an external database, the chart still requires `externalDatabase.host` or `externalDatabase.url` when `postgresql.enabled=false`, even with an existing Secret. Set the host to your actual database as shown above; the running application reads its full `DATABASE_URL` from the Secret. Changing bootstrap admin credentials does not reset an existing account's password. Local users change their own password through the authenticated `PUT /api/auth/password` endpoint with `currentPassword` and `newPassword`; see [API authentication](api.md#authentication).

### Security Hardening

The default Helm values include:

- Non-root container (`runAsUser: 65534`)
- Read-only root filesystem
- All capabilities dropped
- Seccomp profile set to `RuntimeDefault`
- Secure, HTTP-only, SameSite=Strict session cookies
- `app.kubernetes.io/part-of` and `app.kubernetes.io/version` labels on all resources
- Automatic rolling restart when the chart-generated application Secret changes

Updates to a separately managed `secret.existingSecret` do not change the chart's Secret checksum. Restart the Deployment after changing that Secret so the process receives the new environment values.

## AWS-Specific: ALB with TargetGroupBinding

`TargetGroupBinding` attaches kube-phoenix directly to an existing ALB target group without requiring a `LoadBalancer` service or Ingress controller. The AWS Load Balancer Controller registers pod IPs as they scale.

### Prerequisites

1. [AWS Load Balancer Controller](https://kubernetes-sigs.github.io/aws-load-balancer-controller) installed in the cluster
2. An ALB with an HTTPS listener (port 443)
3. A target group with: target type `ip`, protocol HTTP, port `8080`, health check path `/healthz`
4. A listener rule forwarding traffic to the target group
5. A DNS CNAME or alias pointing your domain to the ALB

### Configuration

```yaml
targetGroupBinding:
  enabled: true
  targetGroupARN: "arn:aws:elasticloadbalancing:eu-central-1:ACCOUNT:targetgroup/kube-phoenix/ID"
  targetType: ip
```

> **Tip:** Do not create a `LoadBalancer` service or Ingress on top of a TargetGroupBinding deployment. The chart deploys a `ClusterIP` service, which is sufficient.

## GitOps with ArgoCD

kube-phoenix is compatible with ArgoCD and other GitOps controllers, but it scales workloads by mutating `spec.replicas` on Deployments and StatefulSets via the Scale subresource. Any workload that ArgoCD also manages will go `OutOfSync` the moment a sleep window fires, and an auto-sync will rewrite the replicas back to the value in git -- waking the workload that kube-phoenix just put to sleep.

Pick one of the two patterns below for every Application whose workloads kube-phoenix manages.

### Option A -- Ignore replica drift (recommended)

Add `spec.replicas` to the Application's `ignoreDifferences` and enable `RespectIgnoreDifferences=true` so auto-sync also honours the rule. This is the same pattern HPA users already apply.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-workloads
spec:
  source:
    repoURL: https://github.com/example/manifests
    path: workloads
  destination:
    namespace: my-app
    server: https://kubernetes.default.svc
  ignoreDifferences:
    - group: apps
      kind: Deployment
      jsonPointers: ["/spec/replicas"]
    - group: apps
      kind: StatefulSet
      jsonPointers: ["/spec/replicas"]
  syncPolicy:
    automated:
      selfHeal: true
      prune: true
    syncOptions:
      - RespectIgnoreDifferences=true
```

> **Warning:** Without `RespectIgnoreDifferences=true`, auto-sync still rewrites `replicas` even though the diff view hides it. Both flags are required.

### Option B -- Strip replicas from git

Omit `spec.replicas` from the Deployment/StatefulSet manifests entirely. With no value in git, ArgoCD treats the field as unmanaged and never reconciles it. Cleaner long-term and matches HPA conventions, but requires every workload owner adopting kube-phoenix to update their manifests.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  # spec.replicas intentionally omitted -- managed by kube-phoenix
  selector:
    matchLabels: { app: my-app }
  template: { ... }
```

### Deploying kube-phoenix itself via ArgoCD

The chart works as a standard ArgoCD Helm Application. Use an external database in production and disable pruning of the database resources so a sync error cannot delete the PostgreSQL PVC.

Replace `<chart-version>` with a published version from [GitHub Releases](https://github.com/MacXsimilian/kube-phoenix/releases). Chart versions omit the Git tag's leading `v`; pin an exact version to control upgrades.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: kube-phoenix
  namespace: argocd
spec:
  project: default
  source:
    repoURL: ghcr.io/macxsimilian/helm
    chart: kube-phoenix
    targetRevision: "<chart-version>"
    helm:
      values: |
        createNamespace: false
        postgresql:
          enabled: false
        externalDatabase:
          host: my-rds.example.com
        secret:
          existingSecret: kube-phoenix-secret
  destination:
    namespace: kube-phoenix
    server: https://kubernetes.default.svc
  syncPolicy:
    automated:
      selfHeal: true
      prune: false
    syncOptions:
      - CreateNamespace=true
      - ServerSideApply=true
```

### Caveats

- **Node operations are out-of-band.** kube-phoenix cordons, drains, and deletes nodes during sleep cycles. These are not tracked in git. If cluster-autoscaler or Karpenter is itself ArgoCD-managed, there is no conflict; just be aware that node state during a sleep window will not match anything in a repo.
- **Bundled PostgreSQL StatefulSet.** If you keep `postgresql.enabled=true` under ArgoCD, set `prune: false` (or use `Prune=false` per-resource) so a sync failure cannot remove the PVC. For production, prefer an external managed database -- see [External Database](#external-database).
- **First-run admin secret.** Bootstrap credentials only seed a fresh database. Keep credentials out of plain-text Git manifests and provision the referenced Secret separately. Changing that Secret does not reset an existing user's password; local users can use the authenticated `PUT /api/auth/password` endpoint.

## Observability

kube-phoenix exposes Prometheus metrics at `/metrics` (unauthenticated, suitable for in-cluster scraping).

**Annotation-based scraping** is enabled by default (`metrics.podAnnotations.enabled: true`).

**ServiceMonitor** for Prometheus Operator users:

```yaml
metrics:
  serviceMonitor:
    enabled: true
    labels:
      release: kube-prometheus-stack
```

> **Warning:** The ServiceMonitor CRD must exist in the cluster before enabling this. See [Troubleshooting](troubleshooting.md#servicemonitor-crd-not-found) if the install fails.

## Upgrading

For an existing bundled PostgreSQL 17 database, complete the [database migration](postgresql-upgrade.md) before using the normal upgrade command below. The chart refuses legacy data directories to prevent an empty database from being initialized alongside them. GORM AutoMigrate updates application tables; it does not upgrade PostgreSQL's storage format.

```bash
helm upgrade kube-phoenix oci://ghcr.io/macxsimilian/helm/kube-phoenix \
  --namespace kube-phoenix \
  -f values-production.yaml
```

For the local HTTP installation, pass `values-local.yaml` instead. Keep the same database configuration and credentials when upgrading.

The deployment strategy defaults to `RollingUpdate` with `maxUnavailable: 0`. Database migrations run on startup via GORM AutoMigrate unless disabled. Changes to the chart-generated application Secret trigger a rollout through `checksum/secret`; changes to a separately managed existing Secret require a Deployment restart. These deployment mechanics do not rotate existing application or database passwords.

> **Tip:** Pin a full image version in production with `--set-string image.tag=<version>`. Using `--set-string` preserves numeric tags as strings, as required by the chart's values schema.

### Values Validation

The chart ships a `values.schema.json` that validates values at install/upgrade time. Invalid types, unknown keys, and out-of-range values are rejected before any resources are created.

## Uninstalling

The examples in this guide use `createNamespace=false`, so Helm leaves the namespace and the StatefulSet's database PVC behind. If an older release renders a chart-owned Namespace (`createNamespace=true`), uninstalling that Namespace also deletes its contents; check ownership and preserve required data before uninstalling.

```bash
helm uninstall kube-phoenix --namespace kube-phoenix
```

To deliberately remove the default release's database volume and namespace after uninstalling:

```bash
kubectl delete pvc -n kube-phoenix data-kube-phoenix-postgresql-0
kubectl delete namespace kube-phoenix
```

## Helm Values Reference

Use the chart's [commented values file](../helm/kube-phoenix/values.yaml) for current defaults and the [values schema](../helm/kube-phoenix/values.schema.json) for accepted types and ranges. For a published chart version, inspect its matching values with:

```bash
helm show values oci://ghcr.io/macxsimilian/helm/kube-phoenix --version '<chart-version>'
```

The sections below identify the main settings without duplicating every default. [Example overlays](../examples/) provide complete ingress, ALB, external-database, and monitoring configurations.

### General

`image.*` selects the application image; use `--set-string image.tag=...` for numeric-looking tags. Keep `replicaCount: 1` for normal operation; use `0` during database maintenance. `nameOverride`, `fullnameOverride`, and `namespaceOverride` change generated names. Set `createNamespace: false` when using Helm's `--create-namespace` or a namespace managed outside the chart.

### RBAC and Service Account

`rbac.create` and `serviceAccount.*` control cluster permissions and the ServiceAccount. The backend uses the mounted service-account token to call Kubernetes; keep `serviceAccount.automountServiceAccountToken` enabled for in-cluster operation. Review the generated [RBAC rules](../helm/kube-phoenix/templates/clusterrole.yaml) before deployment.

### Database

`postgresql.*` configures the bundled database, credentials, resources, and persistent storage. For an external database, disable `postgresql.enabled` and configure `externalDatabase.*` or supply `DATABASE_URL` through `secret.existingSecret`. `db.*` configures the application's connection pool. See [External Database](#external-database).

With persistence enabled, `postgresql.persistence.existingClaim` mounts an existing operator-managed PVC and omits the StatefulSet's `volumeClaimTemplates`. Create and retain that PVC separately; `size` and `storageClass` apply only to automatically generated claims. Switching an existing StatefulSet to a different claim requires recreating the StatefulSet while retaining its old PVC. The [PostgreSQL migration guide](postgresql-upgrade.md) covers that sequence and rollback.

### Secret and Auth

`secret.*` supplies bootstrap credentials or an existing Secret. `session.*` controls cookie security and session lifetimes; `auditRetentionDays` controls audit retention. `k8s.qps` and `k8s.burst` set the Kubernetes client's request limits. See the [authentication reference](configuration.md#authentication).

### OIDC

`oidc.*` configures the provider, client, callback, group mappings, and provider TLS trust. Enabling OIDC requires corresponding identity-provider setup; follow [Keycloak Client Setup](configuration.md#keycloak-client-setup).

### Networking

`service.*`, `ingress.*`, and `targetGroupBinding.*` control access to the application. Ingress and TargetGroupBinding require their respective controllers. `networkPolicy.enabled` assumes a CNI that enforces NetworkPolicy. The [example overlays](../examples/) show supported configurations.

The NetworkPolicy allows the bundled PostgreSQL port or `externalDatabase.port`, plus DNS and the standard HTTPS/Kubernetes API ports. Add custom OIDC or Kubernetes endpoint ports to `networkPolicy.extraEgressPorts`. When the database DSN comes from `externalDatabase.url`, an existing Secret, or an environment override, add its port to this list if it differs from the configured database rule. For example, `extraEgressPorts: [6543, 8443]` permits a database on 6543 and an identity provider on 8443.

### Resources and Scheduling

`resources`, probe settings, and `terminationGracePeriodSeconds` control application resource use and lifecycle. `nodeSelector`, `tolerations`, `affinity`, and `topologySpreadConstraints` place application pods; they do not configure the policy scaler's node-protection guardrails. `extraEnv` and `extraEnvFrom` add runtime configuration.

### Metrics

`metrics.podAnnotations` configures scrape annotations. `metrics.serviceMonitor` creates a ServiceMonitor when the Prometheus Operator CRD is already installed. See [Observability](#observability).

### Supply Chain Security

Released images are:

- **Digest-pinned** — the Dockerfile pins all base images (`node`, `golang`, `distroless`) by manifest digest, not mutable tags.
- **Signed** — each release image is signed with [cosign](https://github.com/sigstore/cosign) using keyless OIDC. Verify with: `cosign verify ghcr.io/macxsimilian/kube-phoenix:<tag> --certificate-identity-regexp='.*' --certificate-oidc-issuer-regexp='.*'`
- **SBOM attested** — Syft generates an SPDX SBOM, and Cosign signs an attestation attached to the image digest.
- **Image tags** — a stable Git release tag `vX.Y.Z` produces the full image tag `X.Y.Z` without the leading `v`. Guarded promotion advances `X.Y`, `X`, and `latest` only when the release is newer within each alias's scope; replaying an older release cannot move them backwards. Prereleases do not update stable aliases. Pin the full version or digest for reproducible deployments.
