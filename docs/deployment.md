# Deployment Guide

## Prerequisites

| Requirement | Minimum Version | Notes |
| :---------- | :-------------- | :---- |
| Kubernetes | 1.27+ | Any conformant distribution (EKS, GKE, AKS, kind, k3s) |
| Helm | 3.x | OCI registry support required |
| PostgreSQL | 14+ | Bundled in-cluster by default; external instance recommended for production |

## Quick Install

```bash
helm upgrade --install kube-phoenix oci://ghcr.io/macxsimilian/helm/kube-phoenix \
  --namespace kube-phoenix \
  --create-namespace \
  --set secret.adminPassword=<your-password>
```

```bash
kubectl port-forward -n kube-phoenix svc/kube-phoenix 8080:80
```

Open `http://localhost:8080` and log in with `admin` / `<your-password>`.

> **Tip:** New policies start in **plan mode** -- nothing scales until you explicitly switch a policy to `apply` mode.

## Production Deployment

### External Database

For production workloads, use a managed PostgreSQL instance (Amazon RDS, Aurora, Cloud SQL, Azure Database for PostgreSQL) instead of the bundled StatefulSet.

**Option A -- Full DSN:**

```bash
helm upgrade --install kube-phoenix oci://ghcr.io/macxsimilian/helm/kube-phoenix \
  --namespace kube-phoenix \
  --create-namespace \
  --set postgresql.enabled=false \
  --set externalDatabase.url="host=my-rds.example.com user=kube_phoenix password=secret dbname=kube_phoenix port=5432 sslmode=require"
```

**Option B -- Individual fields:**

```bash
helm upgrade --install kube-phoenix oci://ghcr.io/macxsimilian/helm/kube-phoenix \
  --namespace kube-phoenix \
  --create-namespace \
  --set postgresql.enabled=false \
  --set externalDatabase.host=my-rds.example.com \
  --set externalDatabase.password=secret
```

> **Warning:** The default in-cluster PostgreSQL password is `kube_phoenix`. Always change `postgresql.auth.password` or use an external database in non-local environments.

### Ingress with TLS

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
  -f values-production.yaml \
  --set secret.adminPassword=<your-password>
```

### Pre-existing Secret

To manage credentials outside of Helm values, create a Secret containing `DATABASE_URL`, `ADMIN_USER`, and `ADMIN_PASSWORD`, then reference it:

```yaml
secret:
  existingSecret: my-kube-phoenix-secret
```

### Security Hardening

The default Helm values include:

- Non-root container (`runAsUser: 65534`)
- Read-only root filesystem
- All capabilities dropped
- Seccomp profile set to `RuntimeDefault`
- Secure, HTTP-only, SameSite=Strict session cookies
- `app.kubernetes.io/part-of` and `app.kubernetes.io/version` labels on all resources
- Automatic rolling restart on secret changes (checksum annotation)

For multi-replica deployments, also enable:

```yaml
replicaCount: 2
podDisruptionBudget:
  enabled: true
  maxUnavailable: 1
topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: kubernetes.io/hostname
    whenUnsatisfiable: DoNotSchedule
    labelSelector:
      matchLabels: {}
```

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
    targetRevision: 0.3.19
    helm:
      values: |
        postgresql:
          enabled: false
        externalDatabase:
          host: my-rds.example.com
          password: ${DB_PASSWORD}
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
- **First-run admin secret.** `secret.adminPassword` only seeds the admin user on first startup. Storing it in git is acceptable for the bootstrap, but rotate it via the UI or a `secret.existingSecret` afterwards.

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

```bash
helm upgrade kube-phoenix oci://ghcr.io/macxsimilian/helm/kube-phoenix \
  --namespace kube-phoenix \
  --reuse-values
```

The deployment strategy defaults to `RollingUpdate` with `maxUnavailable: 0` for zero-downtime rollouts. Database migrations run automatically on startup via GORM AutoMigrate. Secret changes (password rotation, DB URL update) trigger an automatic rolling restart via the `checksum/secret` pod annotation — no manual restart needed.

> **Tip:** Pin a specific image tag in production with `--set image.tag=<version>` rather than relying on the chart's default `appVersion`.

### Values Validation

The chart ships a `values.schema.json` that validates values at install/upgrade time. Invalid types, unknown keys, and out-of-range values are rejected before any resources are created.

## Uninstalling

```bash
helm uninstall kube-phoenix --namespace kube-phoenix
```

This removes all chart-managed resources. The PostgreSQL PVC is **not** deleted automatically to prevent data loss. To remove it:

```bash
kubectl delete pvc -n kube-phoenix -l app.kubernetes.io/name=kube-phoenix-postgresql
kubectl delete namespace kube-phoenix
```

## Helm Values Reference

### General

| Value | Default | Description |
| :---- | :------ | :---------- |
| `nameOverride` | `""` | Override chart name |
| `fullnameOverride` | `""` | Override full release name |
| `image.repository` | `ghcr.io/macxsimilian/kube-phoenix` | Image repository |
| `image.tag` | `""` | Image tag (defaults to `Chart.AppVersion`) |
| `image.pullPolicy` | `IfNotPresent` | Image pull policy |
| `replicaCount` | `1` | Number of application replicas |
| `revisionHistoryLimit` | `2` | Number of old ReplicaSets to retain |
| `imagePullSecrets` | `[]` | Image pull secrets |
| `namespaceOverride` | `""` | Override deploy namespace |
| `createNamespace` | `true` | Create namespace via chart template |

> **Tip:** When using `helm --create-namespace`, set `createNamespace: false` to avoid a double-creation conflict.

### RBAC and Service Account

| Value | Default | Description |
| :---- | :------ | :---------- |
| `serviceAccount.create` | `true` | Create a ServiceAccount |
| `serviceAccount.name` | `""` | ServiceAccount name (defaults to release name) |
| `serviceAccount.annotations` | `{}` | Annotations (use for IRSA: `eks.amazonaws.com/role-arn`) |
| `serviceAccount.automountServiceAccountToken` | `true` | Mount the SA token into the pod. The app needs it to call the Kubernetes API; set `false` only if it no longer does. |
| `rbac.create` | `true` | Create ClusterRole and ClusterRoleBinding |

### Database

| Value | Default | Description |
| :---- | :------ | :---------- |
| `postgresql.enabled` | `true` | Deploy in-cluster PostgreSQL StatefulSet |
| `postgresql.image.repository` | `postgres` | PostgreSQL image |
| `postgresql.image.tag` | `17.10-alpine` | PostgreSQL version |
| `postgresql.auth.username` | `kube_phoenix` | PostgreSQL username |
| `postgresql.auth.password` | `kube_phoenix` | PostgreSQL password |
| `postgresql.auth.database` | `kube_phoenix` | PostgreSQL database name |
| `postgresql.persistence.enabled` | `true` | Persist data via PVC |
| `postgresql.persistence.size` | `1Gi` | PVC size |
| `postgresql.persistence.storageClass` | `""` | StorageClass (empty = cluster default) |
| `postgresql.resources.requests.cpu` | `100m` | CPU request |
| `postgresql.resources.requests.memory` | `128Mi` | Memory request |
| `postgresql.resources.limits.cpu` | `500m` | CPU limit |
| `postgresql.resources.limits.memory` | `512Mi` | Memory limit |
| `externalDatabase.url` | `""` | Full DSN (when `postgresql.enabled=false`) |
| `externalDatabase.host` | `""` | DB host (required when `postgresql.enabled=false` and `url` is empty) |
| `externalDatabase.port` | `5432` | DB port |
| `externalDatabase.username` | `kube_phoenix` | DB username |
| `externalDatabase.password` | `""` | DB password |
| `externalDatabase.database` | `kube_phoenix` | DB name |
| `externalDatabase.sslmode` | `require` | SSL mode |

### Secret and Auth

| Value | Default | Description |
| :---- | :------ | :---------- |
| `secret.existingSecret` | `""` | Pre-existing Secret name (must contain `DATABASE_URL`, `ADMIN_USER`, `ADMIN_PASSWORD`) |
| `secret.adminUser` | `admin` | Admin username (seeded on first startup) |
| `secret.adminPassword` | `kube-phoenix` | Admin password |
| `session.idleTimeout` | `8h` | Sliding-window session timeout |
| `session.maxLifetime` | `24h` | Absolute session hard cap |
| `session.cookieSecure` | `true` | Set `false` for HTTP-only environments |
| `auditRetentionDays` | `90` | Auto-delete audit entries older than this (0 = keep forever) |
| `k8s.qps` | `100` | Sustained K8s API requests per second (client-go default: 5) |
| `k8s.burst` | `200` | Short spike allowance above QPS (client-go default: 10) |

### OIDC

| Value | Default | Description |
| :---- | :------ | :---------- |
| `oidc.enabled` | `false` | Enable Keycloak OIDC SSO |
| `oidc.issuerURL` | `""` | Keycloak realm URL |
| `oidc.clientID` | `""` | OIDC client ID |
| `oidc.clientSecret` | `""` | OIDC client secret |
| `oidc.redirectURL` | `""` | OIDC callback URL |
| `oidc.groupsClaim` | `groups` | ID token claim for AD groups |
| `oidc.roleAdminGroups` | `""` | AD groups mapped to admin role |
| `oidc.roleOperatorGroups` | `""` | AD groups mapped to operator role |
| `oidc.skipTLSVerify` | `false` | Skip TLS verification (dev only) |
| `oidc.caConfigMap` | `""` | ConfigMap containing CA certificate |
| `oidc.caCertKey` | `cacert.pem` | Key in the ConfigMap holding the CA bundle |

### Networking

| Value | Default | Description |
| :---- | :------ | :---------- |
| `service.type` | `ClusterIP` | Service type |
| `service.port` | `80` | Service port |
| `service.targetPort` | `8080` | Container port |
| `ingress.enabled` | `false` | Enable Kubernetes Ingress |
| `ingress.className` | `""` | Ingress class name |
| `ingress.annotations` | `{}` | Ingress annotations |
| `ingress.host` | `""` | Hostname |
| `ingress.tls` | `[]` | TLS configuration |
| `targetGroupBinding.enabled` | `false` | Enable AWS TargetGroupBinding |
| `targetGroupBinding.targetGroupARN` | `""` | Target group ARN |
| `targetGroupBinding.targetType` | `ip` | `ip` or `instance` |
| `targetGroupBinding.vpcID` | `""` | VPC ID (if auto-detect fails) |
| `networkPolicy.enabled` | `false` | Enable NetworkPolicy |

### Resources and Scheduling

| Value | Default | Description |
| :---- | :------ | :---------- |
| `resources.requests.cpu` | `50m` | CPU request |
| `resources.requests.memory` | `64Mi` | Memory request |
| `resources.limits.cpu` | `200m` | CPU limit |
| `resources.limits.memory` | `256Mi` | Memory limit |
| `strategy.type` | `RollingUpdate` | Deployment strategy |
| `strategy.rollingUpdate.maxSurge` | `1` | Max pods above desired during rollout |
| `strategy.rollingUpdate.maxUnavailable` | `0` | Max unavailable during rollout (0 = zero-downtime) |
| `startupProbe.failureThreshold` | `30` | Startup probe failures before kill (30 x 5s = 150s max) |
| `startupProbe.periodSeconds` | `5` | Startup probe interval |
| `livenessProbe.initialDelaySeconds` | `15` | Liveness probe delay |
| `readinessProbe.initialDelaySeconds` | `5` | Readiness probe delay |
| `terminationGracePeriodSeconds` | `45` | Graceful shutdown timeout. Sized to fit `srv.Shutdown` (≤30s) + audit-writer drain (≤5s) + buffer. Lower values risk truncating the audit drain on busy shutdowns. |
| `nodeSelector` | `{}` | Node selector |
| `tolerations` | `[]` | Tolerations |
| `affinity` | `{}` | Affinity rules |
| `topologySpreadConstraints` | `[]` | Topology spread constraints |
| `priorityClassName` | `""` | Pod priority class |
| `podDisruptionBudget.enabled` | `false` | Enable PDB |
| `podDisruptionBudget.maxUnavailable` | `1` | Max unavailable pods |
| `podAnnotations` | `{}` | Extra pod annotations |
| `podLabels` | `{}` | Extra pod labels |
| `extraEnv` | `[]` | Extra environment variables |
| `extraEnvFrom` | `[]` | Extra envFrom sources |

### Metrics

| Value | Default | Description |
| :---- | :------ | :---------- |
| `metrics.podAnnotations.enabled` | `true` | Add `prometheus.io/*` annotations |
| `metrics.serviceMonitor.enabled` | `false` | Create ServiceMonitor CRD |
| `metrics.serviceMonitor.namespace` | `""` | ServiceMonitor namespace |
| `metrics.serviceMonitor.interval` | `30s` | Scrape interval |
| `metrics.serviceMonitor.scrapeTimeout` | `10s` | Scrape timeout |
| `metrics.serviceMonitor.labels` | `{}` | Labels to match Prometheus Operator selector |

Full source: [`helm/kube-phoenix/values.yaml`](../helm/kube-phoenix/values.yaml)

### Supply Chain Security

Released images are:

- **Digest-pinned** — the Dockerfile pins all base images (`node`, `golang`, `distroless`) by manifest digest, not mutable tags.
- **Signed** — each release image is signed with [cosign](https://github.com/sigstore/cosign) using keyless OIDC. Verify with: `cosign verify ghcr.io/macxsimilian/kube-phoenix:<tag> --certificate-identity-regexp='.*' --certificate-oidc-issuer-regexp='.*'`
- **SBOM attached** — a Syft-generated SPDX SBOM is attached to each image via `cosign attach sbom`.
- **Semver-only tags** — images are tagged with `v0.3.19`, `0.3`, and `0` only. No `latest` tag is published.
