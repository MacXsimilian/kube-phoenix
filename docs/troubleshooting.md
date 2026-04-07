# Troubleshooting

## Policy ran but nothing was scaled

**Problem:** A policy execution completed successfully but no workloads were affected.

**Cause:** The policy is misconfigured or running in plan mode.

**Solution:**

1. Open the execution log in the **History** page. Every skip is logged with a reason.
2. Confirm the policy is in **apply** mode, not **plan** mode. New policies default to plan mode.
3. Confirm the policy is **enabled**.
4. Check the **Namespace Filter**. If set, only matching namespaces are targeted.
5. Check the **Label Selector**. If set, only matching workloads are targeted.
6. Verify the target namespaces are not in **Guardrails > System-Protected Namespaces**.

## Policy is stuck in `transitioning` state

**Problem:** A policy shows `transitioning` indefinitely even though no execution appears to be running.

**Cause:** The pod was killed mid-execution (OOMKill, node eviction, deployment rollout) and the state was not updated.

**Solution:**

The scheduler automatically recovers stuck `transitioning` policies. If a policy has been in `transitioning` for longer than its execution timeout plus a 5-minute grace period (minimum 15 minutes), it is reset to `unknown` and re-evaluated on the next tick. No manual intervention is required.

If you need to resolve it immediately:

1. If the execution is still running, cancel it via **Cancel** on the policy card or `POST /api/policies/{id}/cancel`.
2. Check **History > Policies** for the latest execution. If it shows `interrupted`, the pod was killed mid-run.
3. On next startup, kube-phoenix automatically marks any `running` executions as `interrupted`.
4. Trigger a manual **Wake Now** or **Sleep Now** from the policy card to set a known state.

## Policy shows `unknown` state after startup

**Problem:** A policy's `currentState` is `unknown` after a pod restart.

**Cause:** Recovery could not determine the intended state because no sleep windows are configured.

**Solution:**

1. Ensure the policy has at least one sleep window configured.
2. If the policy is newly created with no past ticks, trigger a manual **Sleep Now** or **Wake Now** to set an initial state.
3. Once sleep windows are configured and a tick has fired, recovery will work automatically on subsequent restarts.

## Execution stuck in `running` or marked `interrupted`

**Problem:** An execution remains in `running` state, or appears as `interrupted` in the History page.

**Cause:** The pod was terminated while an execution was in progress (OOMKill, eviction, rollout). On startup, kube-phoenix calls `MarkInterruptedPolicyExecutions` to transition any leftover `running` executions to `interrupted`, and `ResetStuckTransitioningPolicies` to move any policy stuck in `transitioning` back to `unknown` for immediate re-evaluation.

**Solution:**

1. Check whether workloads are in an inconsistent state. Some may have been scaled to zero while others were not.
2. Open the execution log to see the last successful log lines.
3. Use **Wake Now** or **Sleep Now** to drive the policy to a clean state. Open `WorkloadSnapshot` rows in the database are the source of truth for what still needs restoring.

## Workload stuck at zero replicas after a failed wake

**Problem:** A workload has `replicas=0` and an open `WorkloadSnapshot` row exists in the database, but the wake never completed.

**Cause:** A wake execution was interrupted or partially failed.

**Solution:**

Trigger **Wake Now** for the policy. The wake routine reads open snapshots from the database and restores each workload to its original `ReplicasBefore` value, then closes the snapshot. If the workload no longer exists, the snapshot is marked deleted-at-wake and skipped.

If you need to inspect or clean up open snapshots manually, query the `workload_snapshots` table:

```sql
SELECT id, kind, namespace, name, replicas_before
FROM workload_snapshots
WHERE wake_execution_id IS NULL
  AND was_deleted_at_wake = false
  AND was_already_zero = false;
```

Then review the failed execution log to understand the root cause.

## Workload replicas not restored correctly after wake

**Problem:** After a wake execution, some workloads were not restored to their original replica count.

**Cause:** The scaler intentionally skips restoration in several cases.

**Solution:** Check the wake execution log for these status values:

| Log Status | Meaning | Action |
| :--------- | :------ | :----- |
| `WasAlreadyZero` | Workload was at zero replicas before the sleep run | No restore needed; it was intentionally stopped |
| `WasDeletedAtWake` | Workload was deleted between sleep and wake | No action needed |
| `WasExternallyScaled` | Replica count was changed while sleeping | Skipped to avoid overwriting the manual change |

If none of the above apply, check whether a guardrail is excluding the workload's namespace.

## Scheduled exception did not fire

**Problem:** A scheduled exception's `startsAt` has passed but it is still in `pending` status.

**Cause:** The exception tick loop (runs every minute) may have encountered an error, or the exception's policy does not exist.

**Solution:**

1. Confirm the exception status on the **Exceptions** page. It should be `pending` before activation.
2. Check pod logs for exception tick errors:

```bash
kubectl logs -n kube-phoenix deployment/kube-phoenix | grep "exception"
```

3. Verify the exception's `policyId` points to an existing, enabled policy.
4. Confirm `startsAt` is in the past or present for activation to occur.

## Backend crashes on startup

**Problem:** The pod enters CrashLoopBackOff immediately after starting.

**Cause:** Missing or malformed `DATABASE_URL`.

**Solution:**

1. Check pod logs for the specific error:

```bash
kubectl logs -n kube-phoenix deployment/kube-phoenix
```

2. Verify the `DATABASE_URL` environment variable is set and the PostgreSQL instance is reachable.
3. If using an external database, confirm the host, port, and credentials are correct.

## Cluster state shows no workloads or nodes

**Problem:** The Cluster State page is empty.

**Cause:** The Kubernetes client cannot reach the API server or lacks RBAC permissions.

**Solution:**

- **Running locally without a cluster:** Expected behavior. Cluster endpoints return empty data.
- **RBAC not applied:** Verify the ClusterRoleBinding exists: `kubectl get clusterrolebinding kube-phoenix`.
- **Cache not yet populated:** On cold start, the cluster cache waits up to 30 seconds for SharedInformer sync. If the API server is slow, `Snapshot().Ready()` may still be false. Wait a few seconds and refresh.

## WebSocket log streaming disconnects immediately

**Problem:** The live log viewer opens and closes instantly.

**Cause:** Missing or expired session cookie.

**Solution:**

1. Verify you are logged in. The `__kp_session` cookie must be present.
2. Confirm the WebSocket URL is same-origin as the page. In development, set `NEXT_PUBLIC_API_URL` so the frontend knows the backend URL.
3. Check browser DevTools > Network > WS for the close code. Code `4401` means no valid session.

## Pod log viewer lines arrive in bursts (deployed environments)

**Problem:** In the pod log viewer, log lines arrive in delayed bursts instead of streaming in real time. This typically only occurs in deployed environments, not during local development.

**Cause:** A reverse proxy (nginx ingress, Envoy) is buffering the chunked HTTP response before forwarding it to the browser.

**Solution:**

1. Verify the backend is setting `X-Accel-Buffering: no` on the streaming response. This header is set automatically in `streamPodLogs()`.
2. If using nginx, ensure `proxy_buffering off;` is respected. Some ingress controllers override `X-Accel-Buffering` at the server level.
3. If using AWS ALB, note that ALB does not support chunked streaming natively. Consider using an nginx ingress controller or NLB instead.

## CORS errors during local development

**Problem:** The browser console shows CORS errors when the frontend dev server calls the backend.

**Cause:** The backend does not allow cross-origin requests by default.

**Solution:** Set `CORS_ALLOWED_ORIGIN=http://localhost:3000` on the backend process when running the frontend dev server separately.

> **Tip:** When `ADMIN_USER` is unset, CORS allows all origins automatically. Authentication is always enforced — only the CORS behavior changes.

## Image pull errors (ImagePullBackOff)

**Problem:** The pod is stuck in `ImagePullBackOff` or `ErrImagePull`.

**Cause:** The container image is inaccessible.

**Solution:**

1. Verify the image exists: `docker pull <image>` from a machine with registry access.
2. Confirm `image.tag` in Helm values matches an existing tag.
3. If using a private registry, configure `imagePullSecrets`.
4. Inspect pod events: `kubectl describe pod -n kube-phoenix <pod-name>`.

## PostgreSQL PVC stuck in Pending

**Problem:** The PostgreSQL StatefulSet pod stays in `Pending` because the PVC cannot be bound.

**Cause:** No suitable StorageClass is available.

**Solution:**

1. Check if a default StorageClass exists: `kubectl get sc`.
2. If none exists, create one or set `postgresql.persistence.storageClass` explicitly.
3. Verify the StorageClass supports the requested access mode and size.
4. Inspect PVC events: `kubectl describe pvc -n kube-phoenix`.

## Init container waiting for PostgreSQL

**Problem:** The main pod is stuck in `Init:0/1`.

**Cause:** The init container is waiting for PostgreSQL to become ready.

**Solution:**

1. Check the PostgreSQL pod status: `kubectl get pods -n kube-phoenix`.
2. Check PostgreSQL logs: `kubectl logs -n kube-phoenix <postgresql-pod>`.
3. Verify `DATABASE_URL` or the internal service DNS resolves correctly.
4. If using an external database, confirm it is reachable from the cluster.

## Pod OOMKilled

**Problem:** The pod restarts with reason `OOMKilled`.

**Cause:** The container exceeded its memory limit.

**Solution:**

1. Confirm the OOM event: `kubectl describe pod -n kube-phoenix <pod-name>` -- look for `Last State: Terminated, Reason: OOMKilled`.
2. Increase `resources.limits.memory` in Helm values (default is `256Mi`). For clusters with 500+ workloads, `512Mi` or more may be needed.
3. Monitor memory via Prometheus: `container_memory_working_set_bytes{container="kube-phoenix"}`.

## NetworkPolicy blocking traffic

**Problem:** Traffic between kube-phoenix components is blocked after enabling NetworkPolicy.

**Cause:** The cluster CNI does not support NetworkPolicy, or egress rules do not cover non-standard ports.

**Solution:**

1. Verify your CNI supports NetworkPolicy (Calico, Cilium). If not, set `networkPolicy.enabled=false`.
2. If using an external database on a non-standard port, the default egress rules (port 5432) may not cover it. Disable the NetworkPolicy or customize egress rules.
3. Inspect the policy: `kubectl describe networkpolicy -n kube-phoenix`.

## ServiceMonitor CRD not found

**Problem:** Helm install fails with `no matches for kind "ServiceMonitor" in version "monitoring.coreos.com/v1"`.

**Cause:** The Prometheus Operator CRDs are not installed.

**Solution:**

1. Install the CRDs first, or set `metrics.serviceMonitor.enabled=false`.
2. If using kube-prometheus-stack, the CRDs are included automatically.

## Database connection lost at runtime

**Problem:** The API returns 500 errors and `/healthz` fails after the application was previously running.

**Cause:** The PostgreSQL instance became unreachable.

**Solution:**

1. Check PostgreSQL pod or RDS instance status.
2. Test network connectivity from the app pod:

```bash
kubectl exec -n kube-phoenix <pod> -- /bin/sh -c "nc -zv <db-host> 5432"
```

> **Tip:** This only works with non-distroless images.

3. The application auto-recovers when the database becomes available again. GORM reconnects automatically, and the pod becomes ready once `/healthz` succeeds.

---

## Observability Dashboard

### SSE stream not updating / "Updated Xs ago" shows stale data

**Problem:** The observability dashboard stops receiving live updates and the "Updated Xs ago" indicator grows stale.

**Cause:** The collector is not running, cannot write to the database, or a reverse proxy is buffering SSE responses.

**Solution:**

1. Check the collector is running. Look for `observability: collector started` in pod logs.
2. Verify database connectivity. The collector writes snapshots every 2s to the `metric_snapshots` table. If writes fail, the SSE stream has nothing new to deliver.
3. Check if too many SSE clients are connected. Each client reads from an in-memory buffer, but the collector still needs DB write access to persist snapshots.
4. If using a reverse proxy (nginx, Envoy), ensure SSE responses are not buffered. The backend sets the `X-Accel-Buffering: no` header, but the proxy must respect it.

### Metrics panels show 0.0 / no data

**Problem:** Dashboard metrics panels display `0.0` or appear empty even though the collector is running.

**Cause:** The collector has not yet accumulated enough ticks to compute rate deltas, or Prometheus metrics are not being collected.

**Solution:**

1. Wait at least 4 seconds after the collector starts. The first tick establishes a baseline; the second tick computes rates. Until then, all deltas are zero.
2. Verify Prometheus metrics are being collected:

```bash
curl localhost:8080/metrics | grep kube_phoenix
```

3. Check pod logs for `observability: collection tick failed` warnings. These indicate the collector encountered an error during a tick.

### Live API Call Feed is empty

**Problem:** The API Call Feed panel shows no entries.

**Cause:** Call recording is not active, or the SSE stream is not connected.

**Solution:**

1. Confirm the Chi middleware for call recording is in the middleware stack. Without it, no calls are captured.
2. Note that only routes matching the 49-entry lookup table are recorded. Unmatched routes appear as "unknown".
3. SSE streams, `/healthz`, `/metrics`, and static file routes are intentionally skipped and will never appear in the feed.
4. Verify the SSE stream is connected by opening browser DevTools > Network and looking for an active connection to `/api/observability/stream`.

### API Rivers particles not flowing

**Problem:** The API Rivers visualization renders but particles are static or absent.

**Cause:** The SSE stream is not delivering the required data, or the selected scenario does not produce particle flow.

**Solution:**

1. Ensure the SSE stream is connected and delivering `components` and `links` data.
2. Check that a scenario other than "Idle" is selected. The Idle scenario intentionally shows no particles.
3. If particles appear but do not follow paths, the SVG path elements may not be rendering correctly. Check the browser console for JavaScript errors.

### Historical data gaps or missing time ranges

**Problem:** Time-series charts show gaps, or a requested time range returns no data.

**Cause:** Snapshots have been pruned, or the collector was not running during the missing period.

**Solution:**

1. Snapshots are pruned after 3 days. Data beyond the retention window is permanently deleted.
2. The history endpoint downsamples server-side. Gaps in short time ranges suggest the collector was not running during that period.
3. Verify the `metric_snapshots` table has data:

```sql
SELECT COUNT(*), MIN(timestamp), MAX(timestamp) FROM metric_snapshots;
```

### Threshold alerts not firing

**Problem:** A metric exceeds its configured threshold but no alert is raised.

**Cause:** Thresholds are evaluated client-side, not server-side, and alerts fire only on state transitions.

**Solution:**

1. Verify thresholds are configured: `GET /api/observability/thresholds`.
2. Thresholds are checked client-side in the SSE hook, not server-side. If the browser tab is closed, no alerts fire.
3. Alerts only fire on threshold *crossings* (the transition from ok to warn or crit), not continuously while above the threshold. If the metric was already above the threshold when the page loaded, no crossing event occurs until it dips below and rises again.
