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

The scheduler automatically recovers stuck `transitioning` policies. If a policy has been in `transitioning` for more than 10 minutes, it is reset to `unknown` and re-evaluated on the next tick. No manual intervention is required.

If you need to resolve it immediately:

1. Check **History > Policies** for the latest execution. If it shows `interrupted`, the pod was killed mid-run.
2. On next startup, kube-phoenix automatically marks any `running` executions as `interrupted`.
3. Trigger a manual **Wake Now** or **Sleep Now** from the policy card to set a known state.

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
3. Use **Wake Now** or **Sleep Now** to drive the policy to a clean state.
4. To find workloads that were partially scaled:

```bash
kubectl get deployments -A -o json | \
  jq '.items[] | select(.metadata.annotations["kube-phoenix/previous-replicas"]) | .metadata.namespace + "/" + .metadata.name'
```

## Workload stuck with `previous-replicas` annotation

**Problem:** A workload has `replicas=0` and the `kube-phoenix/previous-replicas` annotation, but the wake never completed.

**Cause:** A wake execution was interrupted or partially failed.

**Solution:**

```bash
# Restore replicas (replace <n> with the value from the annotation)
kubectl scale deployment <name> -n <namespace> --replicas=<n>

# Remove the annotation
kubectl annotate deployment <name> -n <namespace> kube-phoenix/previous-replicas-
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
kubectl logs -n kube-phoenix deployment/kube-phoenix | grep exception-tick
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

## CORS errors during local development

**Problem:** The browser console shows CORS errors when the frontend dev server calls the backend.

**Cause:** The backend does not allow cross-origin requests by default.

**Solution:** Set `CORS_ALLOWED_ORIGIN=http://localhost:3000` on the backend process when running the frontend dev server separately.

> **Tip:** In dev mode (auth disabled), CORS allows all origins automatically.

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
