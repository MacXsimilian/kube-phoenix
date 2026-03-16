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

Set `CORS_ALLOWED_ORIGIN=http://localhost:3000` on the backend process when running the frontend dev server separately from the backend.
