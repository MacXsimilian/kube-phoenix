# Deployment

The Helm chart deploys the application, an optional in-cluster PostgreSQL StatefulSet, RBAC resources, and a dedicated namespace.

## Helm install

```bash
helm upgrade --install kube-phoenix oci://ghcr.io/macxsimilian/helm/kube-phoenix \
  --namespace kube-phoenix \
  --create-namespace \
  --set secret.adminPassword=<your-password>
```

Then access the UI:

```bash
kubectl port-forward -n kube-phoenix svc/kube-phoenix 8080:80
# Open http://localhost:8080
```

All schedules are seeded **disabled** in **plan mode** — nothing will scale until you explicitly enable a schedule and switch it to `apply` mode.

## External database

To use an existing PostgreSQL instance (RDS, Aurora, Cloud SQL, etc.):

```bash
helm upgrade --install kube-phoenix oci://ghcr.io/macxsimilian/helm/kube-phoenix \
  --namespace kube-phoenix \
  --create-namespace \
  --set postgresql.enabled=false \
  --set externalDatabase.url="host=my-rds.example.com user=kube_phoenix password=secret dbname=kube_phoenix port=5432 sslmode=require"
```

Alternatively, set the individual `externalDatabase.*` fields (`host`, `port`, `username`, `password`, `database`, `sslmode`) instead of a full DSN.

## Kubernetes Ingress

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

## AWS ALB (TargetGroupBinding)

`TargetGroupBinding` (TGB) attaches the application directly to an existing ALB target group without a `LoadBalancer` service or Ingress controller. The AWS Load Balancer Controller registers and deregisters pod IPs as pods scale.

The chart deploys a `ClusterIP` service. The `TargetGroupBinding` CR binds it to the target group ARN. Do not create a `LoadBalancer` service or Ingress on top of a TGB deployment.

**Prerequisites:**

1. [AWS Load Balancer Controller](https://kubernetes-sigs.github.io/aws-load-balancer-controller) installed in the cluster
2. An ALB with an HTTPS listener (port 443) already provisioned
3. A target group created with: target type `ip`, protocol HTTP, port `8080`, health check path `/healthz`
4. A listener rule forwarding traffic to the target group
5. A DNS CNAME or alias pointing your domain to the ALB

**Example values:**

```yaml
targetGroupBinding:
  enabled: true
  targetGroupARN: "arn:aws:elasticloadbalancing:eu-central-1:ACCOUNT:targetgroup/kube-phoenix/ID"
  targetType: ip
  # vpcID: "vpc-0abc123def456"  # omit if the controller auto-detects it
```

## Helm values reference

> **Note:** The Helm install command uses `--create-namespace` (Helm-managed). The chart also has `createNamespace: true` which creates a Namespace resource via template. To avoid a double-creation conflict, set `createNamespace: false` when using `--create-namespace`.

### General

| Value | Default | Description |
| :---- | :------ | :---------- |
| `nameOverride` | `""` | Override chart name |
| `fullnameOverride` | `""` | Override full release name |
| `image.repository` | `ghcr.io/macxsimilian/kube-phoenix` | Image repository |
| `image.tag` | `""` | Image tag (defaults to Chart.AppVersion) |
| `image.pullPolicy` | `IfNotPresent` | Image pull policy |
| `replicaCount` | `1` | Number of app replicas |
| `revisionHistoryLimit` | `2` | Number of old ReplicaSets to retain |
| `imagePullSecrets` | `[]` | Image pull secrets (e.g. `[{name: my-registry-secret}]`) |
| `namespaceOverride` | `""` | Override deploy namespace |
| `createNamespace` | `true` | Create namespace via chart template |

### RBAC & Service Account

| Value | Default | Description |
| :---- | :------ | :---------- |
| `serviceAccount.create` | `true` | Create a ServiceAccount |
| `serviceAccount.name` | `""` | SA name (defaults to release name) |
| `serviceAccount.annotations` | `{}` | Annotations added to the ServiceAccount — use for IRSA (`eks.amazonaws.com/role-arn: ...`) or Workload Identity |
| `rbac.create` | `true` | Create ClusterRole + ClusterRoleBinding |

### Database

| Value | Default | Description |
| :---- | :------ | :---------- |
| `postgresql.enabled` | `true` | Deploy in-cluster PostgreSQL StatefulSet |
| `postgresql.image.repository` | `postgres` | PostgreSQL image |
| `postgresql.image.tag` | `17.7-alpine` | PostgreSQL version |
| `postgresql.image.pullPolicy` | `IfNotPresent` | PostgreSQL pull policy |
| `postgresql.auth.username` | `kube_phoenix` | PostgreSQL username |
| `postgresql.auth.password` | `kube_phoenix` | PostgreSQL password — **change in production** |
| `postgresql.auth.database` | `kube_phoenix` | PostgreSQL database name |
| `postgresql.persistence.enabled` | `true` | Persist data via PVC |
| `postgresql.persistence.size` | `1Gi` | PVC size |
| `postgresql.persistence.storageClass` | `""` | StorageClass (`""` = cluster default) |
| `postgresql.resources.requests.cpu` | `100m` | PostgreSQL CPU request |
| `postgresql.resources.requests.memory` | `128Mi` | PostgreSQL memory request |
| `postgresql.resources.limits.cpu` | `500m` | PostgreSQL CPU limit |
| `postgresql.resources.limits.memory` | `512Mi` | PostgreSQL memory limit |
| `externalDatabase.url` | `""` | Full DSN when `postgresql.enabled=false` |
| `externalDatabase.host` | `""` | DB host — **required** when `postgresql.enabled=false` and `url` is empty |
| `externalDatabase.port` | `5432` | DB port |
| `externalDatabase.username` | `kube_phoenix` | DB username |
| `externalDatabase.password` | `""` | DB password |
| `externalDatabase.database` | `kube_phoenix` | DB name |
| `externalDatabase.sslmode` | `require` | SSL mode |

### Secret / Auth

| Value | Default | Description |
| :---- | :------ | :---------- |
| `secret.existingSecret` | `""` | Pre-existing Secret (must contain `DATABASE_URL`, `ADMIN_USER`, `ADMIN_PASSWORD`) |
| `secret.adminUser` | `admin` | Admin username (seeded on first startup) |
| `secret.adminPassword` | `kube-phoenix` | Admin password — **change in production** |
| `session.idleTimeout` | `8h` | Session sliding-window timeout |
| `session.maxLifetime` | `24h` | Session absolute hard cap |
| `session.cookieSecure` | `true` | Set `false` for HTTP-only environments |
| `auditRetentionDays` | `90` | Auto-delete audit entries older than this (0 = keep forever) |
| `oidc.enabled` | `false` | Enable Keycloak OIDC SSO |
| `oidc.issuerURL` | `""` | Keycloak realm URL |
| `oidc.clientID` | `""` | OIDC client ID |
| `oidc.clientSecret` | `""` | OIDC client secret |
| `oidc.redirectURL` | `""` | OIDC callback URL |
| `oidc.groupsClaim` | `groups` | ID token claim for AD groups |
| `oidc.roleAdminGroups` | `""` | AD groups mapping to admin role |
| `oidc.roleOperatorGroups` | `""` | AD groups mapping to operator role |

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

### Resources & Scheduling

| Value | Default | Description |
| :---- | :------ | :---------- |
| `resources.requests.cpu` | `50m` | CPU request |
| `resources.requests.memory` | `64Mi` | Memory request |
| `resources.limits.cpu` | `200m` | CPU limit |
| `resources.limits.memory` | `256Mi` | Memory limit |
| `strategy.type` | `RollingUpdate` | Deployment strategy type |
| `strategy.rollingUpdate.maxSurge` | `1` | Max pods above desired during rollout |
| `strategy.rollingUpdate.maxUnavailable` | `0` | Max unavailable pods during rollout (0 = zero-downtime) |
| `podSecurityContext.runAsNonRoot` | `true` | Run as non-root |
| `podSecurityContext.runAsUser` | `65534` | UID |
| `containerSecurityContext.allowPrivilegeEscalation` | `false` | Block privilege escalation |
| `containerSecurityContext.readOnlyRootFilesystem` | `true` | Read-only root FS |
| `startupProbe.failureThreshold` | `30` | Startup probe failure threshold (30 × 5s = 150s max startup time) |
| `startupProbe.periodSeconds` | `5` | Startup probe interval |
| `livenessProbe.initialDelaySeconds` | `15` | Liveness probe delay |
| `readinessProbe.initialDelaySeconds` | `5` | Readiness probe delay |
| `terminationGracePeriodSeconds` | `30` | Graceful shutdown timeout |
| `nodeSelector` | `{}` | Node selector |
| `tolerations` | `[]` | Tolerations |
| `affinity` | `{}` | Affinity rules |
| `topologySpreadConstraints` | `[]` | Topology spread constraints — use to spread replicas across nodes/zones |
| `priorityClassName` | `""` | Pod priority class (e.g. `system-cluster-critical`) |
| `podDisruptionBudget.enabled` | `false` | Enable PDB |
| `podDisruptionBudget.maxUnavailable` | `1` | Max unavailable pods |
| `podAnnotations` | `{}` | Extra pod annotations |
| `podLabels` | `{}` | Extra pod labels |
| `extraEnv` | `[]` | Extra environment variables injected into the app container |
| `extraEnvFrom` | `[]` | Extra envFrom sources (ConfigMaps or Secrets) injected into the app container |

### Metrics (Prometheus)

| Value | Default | Description |
| :---- | :------ | :---------- |
| `metrics.podAnnotations.enabled` | `true` | Add `prometheus.io/*` annotations |
| `metrics.serviceMonitor.enabled` | `false` | Create ServiceMonitor CRD |
| `metrics.serviceMonitor.namespace` | `""` | ServiceMonitor namespace |
| `metrics.serviceMonitor.interval` | `30s` | Scrape interval |
| `metrics.serviceMonitor.scrapeTimeout` | `10s` | Scrape timeout |
| `metrics.serviceMonitor.labels` | `{}` | Labels to match Prometheus Operator selector |

Full source: [helm/kube-phoenix/values.yaml](../helm/kube-phoenix/values.yaml)

---

## See also

- [Configuration](configuration.md) — environment variables and schedule setup
- [Troubleshooting](troubleshooting.md) — common issues and fixes
- [API Reference](api.md) — endpoint documentation
