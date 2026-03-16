# Deployment

The Helm chart deploys the application, an optional in-cluster PostgreSQL StatefulSet, RBAC resources, and a dedicated namespace.

## Helm install

```bash
helm upgrade --install kube-phoenix oci://ghcr.io/macxsimilian/helm/kube-phoenix \
  --namespace kube-phoenix \
  --create-namespace \
  --set secret.basicAuthPassword=<your-password>
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

| Value                                  | Default                              | Description                                                                              |
| :------------------------------------- | :----------------------------------- | :--------------------------------------------------------------------------------------- |
| `image.repository`                     | `ghcr.io/macxsimilian/kube-phoenix`  | Image repository                                                                         |
| `image.tag`                            | `latest`                             | Image tag to deploy                                                                      |
| `replicaCount`                         | `1`                                  | Number of app replicas                                                                   |
| `postgresql.enabled`                   | `true`                               | Deploy in-cluster PostgreSQL StatefulSet                                                 |
| `postgresql.auth.username`             | `kube_phoenix`                       | PostgreSQL username                                                                      |
| `postgresql.auth.password`             | `kube_phoenix`                       | PostgreSQL password — **change in production**                                           |
| `postgresql.auth.database`             | `kube_phoenix`                       | PostgreSQL database name                                                                 |
| `postgresql.persistence.enabled`       | `true`                               | Persist PostgreSQL data via a PVC                                                        |
| `postgresql.persistence.size`          | `1Gi`                                | PVC size                                                                                 |
| `postgresql.persistence.storageClass`  | `""`                                 | StorageClass — `""` uses the cluster default                                             |
| `externalDatabase.url`                 | `""`                                 | Full DSN when `postgresql.enabled=false`                                                 |
| `secret.basicAuthUser`                 | `admin`                              | Basic Auth username                                                                      |
| `secret.basicAuthPassword`             | `kube-phoenix`                       | Basic Auth password — **change in production**                                           |
| `secret.existingSecret`                | `""`                                 | Pre-existing Secret containing `DATABASE_URL`, `BASIC_AUTH_USER`, `BASIC_AUTH_PASSWORD` |
| `ingress.enabled`                      | `false`                              | Enable Kubernetes Ingress                                                                |
| `ingress.className`                    | `""`                                 | Ingress class name                                                                       |
| `ingress.annotations`                  | `{}`                                 | Ingress annotations                                                                      |
| `ingress.host`                         | `""`                                 | Hostname to expose the app on                                                            |
| `ingress.tls`                          | `[]`                                 | TLS configuration                                                                        |
| `targetGroupBinding.enabled`           | `false`                              | Enable AWS TargetGroupBinding                                                            |
| `targetGroupBinding.targetGroupARN`    | `""`                                 | ARN of the pre-created target group                                                      |
| `targetGroupBinding.targetType`        | `ip`                                 | `ip` or `instance`                                                                       |
| `targetGroupBinding.vpcID`             | `""`                                 | VPC ID — only needed if the controller cannot auto-detect it                             |
| `resources.requests.cpu`               | `50m`                                | CPU request                                                                              |
| `resources.requests.memory`            | `64Mi`                               | Memory request                                                                           |
| `resources.limits.cpu`                 | `200m`                               | CPU limit                                                                                |
| `resources.limits.memory`              | `256Mi`                              | Memory limit                                                                             |

Full source: [helm/kube-phoenix/values.yaml](../helm/kube-phoenix/values.yaml)
