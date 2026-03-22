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

## An execution is stuck in the `running` state

On startup, kube-phoenix automatically marks any executions left in `running` as `interrupted`. This covers the case where the pod was killed mid-run (OOMKill, node eviction, deployment rollout).

If you see an execution marked `interrupted` in the History page, it means the run did not complete cleanly. Check whether workloads were partially scaled:

```bash
# List deployments with the previous-replicas annotation (scaled down, not yet woken)
kubectl get deployments -A -o json | \
  jq '.items[] | select(.metadata.annotations["kube-phoenix/previous-replicas"]) | .metadata.namespace + "/" + .metadata.name'
```

Trigger the corresponding scale-up schedule manually from the **History** or **Schedules** page to restore those workloads.

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

WebSocket connections authenticate via the session cookie sent automatically by the browser on same-origin upgrades. If the connection closes immediately:

1. Verify you are logged in — the session cookie (`__kp_session`) must be present.
2. Confirm the WebSocket URL is same-origin as the page. In development, set `NEXT_PUBLIC_API_URL` so the frontend knows the backend URL.
3. Check browser devtools → Network → WS for the close code. `4401` means no valid session.

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

## A policy ran but nothing was scaled

1. Check the policy execution log in **History** — every skip is logged with a reason.
2. Confirm the policy is in **apply** mode. New policies default to plan mode.
3. Confirm the policy is **enabled**.
4. Check **Namespace Filter** — if set, only matching namespaces are targeted.
5. Check **Label Selector** — if set, only workloads matching the selector are targeted.
6. Check **Guardrails → Skip Namespaces** — namespaces in that list are always excluded.

## A policy is stuck in `transitioning` state

`transitioning` means a sleep or wake execution is currently running. If the execution finished but the state was not updated:

1. Go to **History → Policies** and check the latest execution for that policy. If it shows `interrupted`, the pod was killed mid-run.
2. On next startup, kube-phoenix marks any `running` policy executions as `interrupted` automatically.
3. Trigger a manual **Wake Now** or **Sleep Now** from the policy card to force the state forward.

## A policy execution is stuck in `running` / shows as `interrupted`

On startup, kube-phoenix calls `MarkInterruptedPolicyExecutions` to set any leftover `running` executions to `interrupted`. If you see `interrupted` in the policy execution list:

1. Check if workloads are in an inconsistent state — some may have been scaled to 0 while others were not.
2. Open the execution log to see the last successful log lines.
3. Use **Wake Now** (or **Sleep Now**) to drive the policy to a clean state.

## A policy shows `unknown` currentState after startup

`unknown` is the initial state for a brand-new policy or after a restart where recovery could not determine the intended state. Recovery fires automatically on startup:

1. If recovery failed (no cron expression configured, or no past fire times), the state stays `unknown`.
2. Trigger a manual **Sleep Now** or **Wake Now** to set a known state.
3. Ensure the policy has at least one cron expression (`sleepCron` or `wakeCron`) for recovery to compute the intended state.

## A scheduled exception did not fire

1. Check the **Exceptions** page — confirm the exception `status` is `pending` (not `completed` or `cancelled`).
2. The exception tick loop runs every minute. If `startsAt` has passed but the status is still `pending`, check pod logs for exception tick errors: `kubectl logs -n kube-phoenix deployment/kube-phoenix | grep exception-tick`.
3. Confirm the exception's `policyId` points to an existing, enabled policy.
4. Verify the exception's time window is correct — `startsAt` must be in the past (or present) for it to activate.

## Workload replica counts were not restored correctly after wake

kube-phoenix stores replica counts in `workload_snapshots` rows at sleep time. If replicas were not restored:

1. Check the wake execution log — look for `WasAlreadyZero`, `WasDeletedAtWake`, or `WasExternallyScaled` log lines.
2. `WasAlreadyZero`: the workload was already at 0 before the sleep run. It is not restored automatically (to avoid scaling up workloads you intentionally stopped).
3. `WasDeletedAtWake`: the workload was deleted between sleep and wake. No action needed.
4. `WasExternallyScaled`: someone changed the replica count while the workload was sleeping. The policy detects this and skips the restore to avoid overwriting the manual change.
5. If none of the above apply, check whether a guardrail is excluding the workload's namespace.

---

## See also

- [Configuration](configuration.md) — environment variables and schedule setup
- [Deployment](deployment.md) — Helm installation and values reference
- [API Reference](api.md) — endpoint documentation
