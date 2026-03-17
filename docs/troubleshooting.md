# Troubleshooting

## A schedule ran but nothing was scaled

1. Check the execution log in the **History** page — every skip is logged with a reason.
2. Confirm the schedule is in **apply** mode, not **plan** mode. All default schedules start in plan mode.
3. Confirm the schedule is **enabled** — the toggle on the Schedules page.
4. Check that the target namespaces are not in **Guardrails → Skip Namespaces**.

## The backend crashes on startup

The most common cause is a missing or malformed `DATABASE_URL`.

```
FATAL: DATABASE_URL is required
```

Check that the environment variable is set and the PostgreSQL instance is reachable from the pod. Run `kubectl logs -n kube-phoenix deployment/kube-phoenix` for the full error.

## Cluster State shows no workloads or nodes

The Kubernetes client uses the pod's ServiceAccount token (in-cluster config). Possible causes:

- **Running locally without a cluster:** expected — cluster endpoints return empty data, not an error.
- **RBAC not applied:** verify the ClusterRole and ClusterRoleBinding exist: `kubectl get clusterrolebinding kube-phoenix`.
- **Cache not yet populated:** on cold start the ClusterCache populates asynchronously. Wait a few seconds and refresh.

## A workload is stuck with the `previous-replicas` annotation

This happens when a scale-up run was interrupted or partially failed. The workload has `replicas=0` and the annotation present, so it looks sleeping but the wake didn't complete.

Fix manually:

```bash
# Restore replicas (replace <n> with the saved value from the annotation)
kubectl scale deployment <name> -n <namespace> --replicas=<n>

# Remove the annotation
kubectl annotate deployment <name> -n <namespace> previous-replicas-
```

Then recheck the History log for the failed execution to understand why the wake failed.

## Metrics Server data is missing in pod detail

kube-phoenix calls the Kubernetes Metrics Server API for live CPU/memory. If the Metrics Server is not installed in your cluster, usage values will show as `—` rather than causing an error. Install it with:

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

## WebSocket log streaming disconnects immediately

WebSocket connections authenticate via `?token=<base64(user:pass)>`. If credentials are wrong, the connection is closed with `4401`. Verify your browser is sending the correct base64 token — the kube-phoenix UI handles this automatically when you log in through the login screen.

## CORS errors in the browser during local development

Set `CORS_ALLOWED_ORIGIN=http://localhost:3000` on the backend process when running the frontend dev server separately from the backend. Note: in dev mode (auth disabled), CORS allows all origins automatically.

## Image pull errors (ImagePullBackOff)

The pod is stuck in `ImagePullBackOff` or `ErrImagePull`.

1. Verify the image exists: `docker pull <image>` from a machine with registry access.
2. Check that `image.tag` in your Helm values matches an existing tag.
3. If using a private registry, ensure `imagePullSecrets` are configured on the ServiceAccount or pod.
4. Check pod events: `kubectl describe pod -n kube-phoenix <pod-name>`.

## PostgreSQL PVC stuck in Pending

The PostgreSQL StatefulSet pod stays in `Pending` because the PVC cannot be bound.

1. Check if a default StorageClass exists: `kubectl get sc`. If not, create one or set `postgresql.persistence.storageClass` explicitly.
2. Verify the StorageClass supports the requested access mode and size.
3. Check PVC events: `kubectl describe pvc -n kube-phoenix`.

## Init container waiting for PostgreSQL

The main pod is stuck in `Init:0/1` — the init container is waiting for PostgreSQL to become ready.

1. Check the PostgreSQL pod is running: `kubectl get pods -n kube-phoenix`.
2. Check PostgreSQL logs: `kubectl logs -n kube-phoenix <postgresql-pod>`.
3. Verify the `DATABASE_URL` or internal service DNS resolves correctly.
4. If using an external database, ensure it is reachable from the cluster.

## Pod OOMKilled

The pod restarts with reason `OOMKilled` — it exceeded its memory limit.

1. Check: `kubectl describe pod -n kube-phoenix <pod-name>` — look for `Last State: Terminated, Reason: OOMKilled`.
2. Increase `resources.limits.memory` in Helm values (default is `256Mi`). For clusters with many workloads (500+), `512Mi` or more may be needed.
3. Monitor memory usage via Prometheus: `container_memory_working_set_bytes{container="kube-phoenix"}`.

## NetworkPolicy blocking traffic

With `networkPolicy.enabled=true`, traffic between services may be blocked.

1. Verify your cluster's CNI supports NetworkPolicy (e.g., Calico, Cilium). If not, set `networkPolicy.enabled=false`.
2. If using an external database on a non-standard port, the default egress rules (port 5432) may not cover it. Disable the NetworkPolicy or customize egress rules.
3. Check: `kubectl describe networkpolicy -n kube-phoenix`.

## ServiceMonitor CRD not found

Helm install fails with: `no matches for kind "ServiceMonitor" in version "monitoring.coreos.com/v1"`.

1. The Prometheus Operator CRDs are not installed. Install them first, or set `metrics.serviceMonitor.enabled=false`.
2. If using kube-prometheus-stack, the CRDs are included automatically.

## Database connection lost at runtime

The API returns 500 errors and `/healthz` fails after the app was previously running fine.

1. Check PostgreSQL pod/RDS status — is it running and accepting connections?
2. Check network connectivity from the app pod: `kubectl exec -n kube-phoenix <pod> -- /bin/sh -c "nc -zv <db-host> 5432"` (only works with non-distroless images).
3. The app will auto-recover when the database becomes available again — GORM reconnects automatically. The pod will become ready once `/healthz` succeeds.

---

## See also

- [Configuration](configuration.md) — environment variables and schedule setup
- [Deployment](deployment.md) — Helm installation and values reference
- [API Reference](api.md) — endpoint documentation
