# Troubleshooting

Start with the symptom below. [Configuration](configuration.md) owns setting defaults; [deployment](deployment.md) and [local development](local-development.md) contain complete setup commands.

[Policy execution](#policy-ran-but-nothing-was-scaled) · [Login and connections](#ui-logs-the-user-out-on-transient-network-errors) · [Deployment](#backend-crashes-on-startup) · [Alpha observability](#observability-dashboard)

## Policy ran but nothing was scaled

**Problem:** A policy execution completed successfully but no workloads were affected.

**Cause:** The policy is misconfigured or running in plan mode.

**Solution:**

1. Open the execution log in the **History** page. Every skip is logged with a reason.
2. Confirm the policy is in **apply** mode, not **plan** mode. New policies default to plan mode.
3. For scheduled runs, confirm the policy is **enabled**. Manual triggers also work while scheduling is disabled.
4. Check the **Namespace Filter**. If set, only matching namespaces are targeted.
5. Check the **Label Selector**. If set, only matching workloads are targeted.
6. Verify the target namespaces are not in **Guardrails > Protected Namespaces**.
7. Check active exceptions: `stay_awake` protects matching workloads from ordinary sleep; `force_sleep` protects them from ordinary wake and wins when both types match.

Plan runs log the intended operations but do not create, close, or modify recovery snapshots. To investigate live effects, check the execution's recorded mode and the workload replicas.

## Policy is stuck in `transitioning` state

**Problem:** A policy shows `transitioning` indefinitely even though no execution appears to be running.

**Cause:** The pod was killed mid-execution (OOMKill, node eviction, deployment rollout) and the state was not updated.

**Solution:**

The scheduler resets stale `transitioning` policies after the execution timeout plus a 5-minute grace period (minimum 15 minutes). Enabled policies are then re-evaluated; successful recovery still depends on database and Kubernetes access. Check execution logs if the policy remains uncertain.

If you need to resolve it immediately:

1. If the execution is still running, cancel it via **Cancel** on the policy card or `POST /api/policies/{id}/cancel`.
2. Check **History > Policies** for the latest execution. If it shows `interrupted`, the pod was killed mid-run.
3. On next startup, after acquiring exclusive database ownership, kube-phoenix atomically marks `running` executions `interrupted` and resets `transitioning` policies to `unknown`.
4. Trigger a manual **Wake Now** or **Sleep Now** from the policy card to set a known state.

## Policy shows `unknown` state after startup

**Problem:** A policy's `currentState` is `unknown` after a pod restart.

**Cause:** Startup reset an interrupted transition, an execution failed, or recovery could not determine intent from a legacy/malformed stored window configuration. Current create/import endpoints require valid windows and initialize policy state from them.

**Solution:**

1. Check the latest execution and backend recovery logs for database or Kubernetes errors.
2. Confirm the policy has valid windows and a timezone. Enabled policies are evaluated automatically; disabled policies need a manual trigger.
3. After correcting the cause, use **Sleep Now** or **Wake Now** in the intended mode and verify real replicas. A recorded policy state alone does not prove the cluster matches it.

## Execution stuck in `running` or marked `interrupted`

**Problem:** An execution remains in `running` state, or appears as `interrupted` in the History page.

**Cause:** The pod was terminated while an execution was in progress (OOMKill, eviction, rollout). On startup, the exclusive scheduler owner performs both recovery changes in one database transaction: leftover `running` executions become `interrupted`, and `transitioning` policies become `unknown` for re-evaluation. Another process cannot run this recovery while the current owner holds the database lock.

**Solution:**

1. Check whether workloads are in an inconsistent state. Some may have been scaled to zero while others were not.
2. Open the execution log to see the last successful log lines.
3. Use **Wake Now** or **Sleep Now** to drive the policy to a clean state. Open `WorkloadSnapshot` rows in the database are the source of truth for what still needs restoring.

## Workload stuck at zero replicas after a failed wake

**Problem:** A workload has `replicas=0` and an open `WorkloadSnapshot` row exists in the database, but the wake never completed.

**Cause:** A wake execution was interrupted or partially failed.

**Solution:**

Trigger **Wake Now** in apply mode for the policy. The wake routine reads open snapshots from the database and restores each eligible workload to its original `ReplicasBefore` value, then closes the snapshot. `prepared` intents remain recoverable even if the previous process stopped between scaling and recording `applied`. Restoration follows kind, namespace, and name; a recreated workload with a different UID is still eligible. If the workload no longer exists, the snapshot is marked deleted-at-wake and skipped. Check the current policy namespace filter and any active `force_sleep` exceptions if a snapshot remains open.

To inspect open recovery snapshots, query the `workload_snapshots` table. Preserve these rows until restoration is verified:

```sql
SELECT id, policy_id, kind, namespace, name, replicas_before, phase, workload_uid
FROM workload_snapshots
WHERE wake_execution_id IS NULL
  AND was_deleted_at_wake = false
  AND was_already_zero = false;
```

Then review the failed execution log to understand the root cause.

## Workload replicas not restored correctly after wake

**Problem:** After a wake execution, some workloads were not restored to their original replica count.

**Cause:** A snapshot can describe an intentional skip, an external replica change, or a failed restore.

**Solution:** Check the wake execution log for these status values:

| Snapshot Flag | Meaning | Action |
| :--------- | :------ | :----- |
| `wasAlreadyZero` | Workload was at zero replicas before the sleep run | No restore needed; it was intentionally stopped |
| `wasDeletedAtWake` | Workload was deleted between sleep and wake | No action needed |
| `wasExternallyScaled` | Nonzero replica count was observed while sleeping | If already at the saved count, close without rescaling; otherwise restore the saved count and log the change |

If none of these explain the result, check the wake's namespace filter, active exceptions, and lookup/scale or snapshot-close errors. Full-policy wake can restore an owned workload after its labels change; scoped exceptions also check current labels and explicit targets. Namespace protection excludes future sleep operations; it does not prevent restoring existing snapshots.

Apply-mode sleep saves its intent before scaling. `Cannot persist sleep intent` means that workload was not scaled by this attempt. If scaling or the subsequent `applied` update fails, the open intent retains the original replica count for retry. A failed snapshot close after wake also remains retryable: a subsequent wake can recognize the already restored replica count and close it without another scale.

## Audit log CSV export is truncated or missing rows

**Problem:** The audit log CSV download contains fewer rows than the filtered table view shows.

**Cause:** The export pages through results 1000 rows at a time but caps at 100,000 total rows. Filter sets larger than that are intentionally truncated to keep the in-browser CSV build bounded.

**Solution:** Narrow the date range or filters until the matching total falls under 100,000. When the cap is hit, the UI surfaces a banner stating the total match count alongside the export.

## Audit CSV cells begin with a stray apostrophe

**Problem:** A username or other field in an exported audit CSV starts with `'`.

**Cause:** Excel, Numbers, and Google Sheets treat cells starting with `=`, `+`, `-`, `@`, tab, or carriage return as formulas, so the export prefixes any such cell with a leading apostrophe to neutralise formula injection. The apostrophe is a sentinel — the spreadsheet treats the rest of the cell as text and never displays the prefix.

**Solution:** No action required. The raw value remains intact; only the spreadsheet rendering is guarded.

## Scheduled exception did not fire

**Problem:** A scheduled exception's `startsAt` has passed but it is still in `pending` status.

**Cause:** Exception evaluation runs on the configured scheduler evaluation interval (30 seconds by default). It may have encountered an error, or the exception's policy does not exist.

**Solution:**

1. Confirm the exception status on the **Exceptions** page. It should be `pending` before activation.
2. Check pod logs for exception tick errors:

```bash
kubectl logs -n kube-phoenix deployment/kube-phoenix | grep "exception"
```

3. Verify the exception's `policyId` points to an existing, enabled policy.
4. Confirm `startsAt` is in the past or present for activation to occur.

## Exception affects the wrong scope or leaves workloads unchanged

Namespace, label, and explicit workload-target filters are combined by intersection with the parent policy. They do not expand its scope. Verify the live workload labels and the target's exact `Deployment` or `StatefulSet` kind, namespace, and name. Invalid targeting in a stored exception stops execution rather than becoming an unfiltered operation.

A successful scoped exception restores the parent's baseline state; it does not mark the entire policy awake or sleeping. Check execution logs and live replicas for the affected subset. `force_sleep` wins when multiple active exceptions match the same workload. In API updates, send `workloadTargets: []` to clear the exact-target list; omitting it retains the list.

## Backend crashes on startup

**Problem:** The pod enters CrashLoopBackOff immediately after starting.

**Cause:** Database initialization, exclusive scheduler ownership, or startup recovery failed.

**Solution:**

1. Check pod logs for the specific error:

```bash
kubectl logs -n kube-phoenix deployment/kube-phoenix
```

2. Verify the `DATABASE_URL` environment variable is set and the PostgreSQL instance is reachable.
3. If using an external database, confirm the host, port, and credentials are correct. Individual Helm DSN fields are escaped automatically; a full `externalDatabase.url` or Secret DSN must already be valid.
4. For `another live scheduler owns this database`, stop the duplicate application process and keep one replica. Use `Recreate`, and check for a local backend, another release, or an autoscaler using the same database. Do not manually release the active process's lock.
5. For `DB_MAX_OPEN_CONNS must be at least 2`, increase the finite pool limit; scheduler ownership reserves one connection.
6. For `startup recovery failed`, inspect the database/schema error. With `AUTO_MIGRATE=false`, apply [the snapshot-intent migration](../backend/migrations/20261008_snapshot_intents.sql) before this version starts.
7. For `startup cordon recovery failed`, check Kubernetes connectivity and node get/list/update permissions. The process exits rather than starting the scheduler with incomplete cordon recovery.

## Nodes remain cordoned or a drain fails

A node cordoned by the drain path carries `kube-phoenix.io/cordon-owner`. Failed drains or node deletions attempt to remove that owned cordon; startup also recovers markers after acquiring scheduler ownership. A node already cordoned by an operator has no new ownership marker and is left alone. Check node annotations and execution logs before changing schedulability manually.

Node operations are skipped when workload sleep fails, a scoped exception is running, active exception protections excluded workloads, or an unresolved prepared intent lies outside the current selection. Fix the workload error or targeting before retrying.

The drain path requests `policy/v1` eviction through the core `pods/eviction` subresource; its RBAC rule uses `apiGroups: [""], resources: ["pods/eviction"], verbs: ["create"]`. Eviction failures still fall back to zero-grace pod deletion, which bypasses PDBs and graceful termination. Configure node protections when nodes must not be drained.

## Cluster state shows no workloads or nodes

**Problem:** The Cluster State page is empty.

**Cause:** The Kubernetes client cannot reach the API server or lacks RBAC permissions.

**Solution:**

- **Running locally without a cluster:** Expected behavior. When Kubernetes client initialization failed, cluster endpoints return HTTP 503 (`kubernetes client unavailable`).
- **RBAC not applied:** Verify the ClusterRoleBinding exists: `kubectl get clusterrolebinding kube-phoenix`.
- **Cache not yet populated:** On cold start, the cluster cache waits up to 30 seconds for SharedInformer sync. If the API server is slow, `Snapshot().Ready()` may still be false. Wait a few seconds and refresh.

## UI logs the user out on transient network errors

**Problem:** The UI returns to the login screen during brief backend hiccups (CDN restart, ingress reload, laptop sleep), even though the session is still valid.

**Cause:** Historic behavior treated every failed `/api/auth/me` call as "session expired". Now the auth poller distinguishes three outcomes: an explicit 401/403 (logout), a network/5xx failure (preserve current user, surface a backend-error banner instead), and a successful payload (compare to cached user, skip the state update when nothing changed).

**Solution:** Nothing to configure. If you still see logouts, check the browser DevTools network tab for an actual `401` on `/api/auth/me` — that indicates the session cookie is genuinely missing or expired.

## WebSocket log streaming disconnects immediately

**Problem:** The live log viewer opens and closes instantly.

**Cause:** Missing or expired session cookie.

**Solution:**

1. Verify you are logged in. The `__kp_session` cookie must be present.
2. Confirm the browser's Origin host matches the WebSocket request host. `NEXT_PUBLIC_API_URL` alone does not satisfy this check; use a same-origin development proxy for live logs.
3. Check the upgrade request in browser DevTools > Network. An expired or missing session returns HTTP 401 before the upgrade; an origin mismatch returns HTTP 403. See [the WebSocket protocol](api.md#websocket-protocol).

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

> **Tip:** An explicit `CORS_ALLOWED_ORIGIN` always wins. The all-origins fallback applies only when both it and `ADMIN_USER` are empty. Authentication remains enforced. See [CORS configuration](configuration.md#cors).

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

## PostgreSQL refuses data after a major image upgrade

**Problem:** PostgreSQL fails to start after moving from version 17 to 18. The Helm `init-permissions` container reports existing PostgreSQL data or an incompatible major version; Compose may report that an old database was found.

**Cause:** PostgreSQL 18 cannot open a PostgreSQL 17 data directory. The new image also uses a different volume layout. Startup stops before initializing a new database on that volume.

**Solution:** Keep the old volume and backup. Stop application writers, restore the previous PostgreSQL 17 configuration if necessary to take a final dump, then follow [PostgreSQL 17 to 18 migration](postgresql-upgrade.md) using a fresh volume. Do not remove `PG_VERSION`, delete the PVC, or change `PGDATA` to bypass the guard. Changing only the image tag back to 17 with the new chart's storage layout is not a rollback; restore the previous chart and volume configuration together.

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
2. For an external database configured with individual fields, verify `externalDatabase.port`. For DSNs supplied through `externalDatabase.url` or a Secret, and custom OIDC/Kubernetes endpoints, add their TCP ports to `networkPolicy.extraEgressPorts`.
3. Inspect the policy: `kubectl describe networkpolicy -n kube-phoenix`.

## Helm rejects replica count or deployment strategy

The chart accepts only `replicaCount: 0` or `1` and requires `strategy.type: Recreate`. Remove old `strategy.rollingUpdate` entries from saved values when upgrading, and remove any HPA that scales the backend. Do not bypass validation to run multiple schedulers. See [upgrading](deployment.md#upgrading).

## ServiceMonitor CRD not found

**Problem:** Helm install fails with `no matches for kind "ServiceMonitor" in version "monitoring.coreos.com/v1"`.

**Cause:** The Prometheus Operator CRDs are not installed.

**Solution:**

1. Install the CRDs first, or set `metrics.serviceMonitor.enabled=false`.
2. If using kube-prometheus-stack, the CRDs are included automatically.

## ServiceMonitor exists but Prometheus has no target

1. Check the Prometheus resource's ServiceMonitor label and namespace selectors. Set `metrics.serviceMonitor.labels.release` only if that matches your Prometheus selector; the example release label is not universal.
2. The monitor selects the server Service by application name, release instance, and `app.kubernetes.io/component: server`. Verify those labels on the Service and its named `http` port. The bundled database Service is excluded.
3. If `metrics.serviceMonitor.namespace` differs from the application namespace, verify Prometheus discovers the monitor there. The monitor's `namespaceSelector.matchNames` must still name the application namespace.
4. Verify scrape access to `/metrics`, including NetworkPolicy, and disable annotation scraping if it would duplicate the ServiceMonitor target.

## Database connection lost at runtime

**Problem:** API requests fail, `/readyz` (or `/healthz`) returns HTTP 503, or the process exits after previously running.

**Cause:** The PostgreSQL instance became unreachable.

**Solution:**

1. Check PostgreSQL pod or RDS instance status.
2. Check DNS, credentials, and NetworkPolicy from a diagnostic pod or approved debug container with access equivalent to the application. The released distroless image has no shell or `nc`.
3. Inspect logs for `scheduler ownership lost`. The owner connection is checked every second with a bounded probe; if it is lost, the process exits instead of reconnecting that lock session. Kubernetes restarts the pod, which must reacquire ownership before recovery and scheduling resume.
4. Verify `/readyz` succeeds after recovery, then check interrupted executions and open snapshots. `/livez` checks only the HTTP process and can still succeed briefly while database readiness fails.

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
2. The route lookup table supplies function/component labels; unmatched routes can still be recorded with function `unknown`.
3. Cluster/observability SSE streams, pod-log streams, `/healthz`, `/metrics`, and static routes are skipped. `/livez` and `/readyz` are currently included, so Kubernetes probes can appear as `unknown` calls and contribute to HTTP metrics.
4. Verify the SSE stream is connected by opening browser DevTools > Network and looking for an active connection to `/api/observability/stream`.

### API Rivers particles not flowing

**Problem:** The API Rivers visualization renders but particles are static or absent.

**Cause:** API Rivers is a cosmetic visualization driven by illustrative scenarios. Its particles are not a trace of actual requests; an idle scenario intentionally produces no flow. The metrics dashboard is also an alpha feature. See [observability scope](observability.md).

**Solution:**

1. Check the selected scenario. Use an active scenario to preview the animation.
2. Use execution logs and cluster state to assess scaling behavior; particle movement is not evidence of a successful operation.
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
