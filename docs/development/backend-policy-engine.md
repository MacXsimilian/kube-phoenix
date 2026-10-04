# Backend policy engine

Read this reference when changing scheduling, exception handling, replica restoration, or node operations. Start with the [backend guide](../backend-dev-guide.md) for setup and verification, and [window semantics](../window-native-scheduling.md) for time examples.

## Responsibilities

| Layer | Responsibility | Source |
| :---- | :------------- | :----- |
| Window evaluator | Pure timezone-aware sleep/awake calculation and next transition | [policy](../../backend/internal/policy) |
| Policy engine | Exception precedence and intended-state calculation | [policy_engine.go](../../backend/internal/scheduler/policy_engine.go) |
| Scheduler | Evaluation, recovery, claims, cancellation, execution lifecycle, log persistence | [policy_scheduler.go](../../backend/internal/scheduler/policy_scheduler.go) |
| Policy runner | Workload selection, snapshots, scaling, node phase, wake waves | [policy_scaler.go](../../backend/internal/scaler/policy_scaler.go) |
| Store | Persisted policies, executions, logs, exceptions, snapshots | [store](../../backend/internal/store) |

Keep time calculation independent of Kubernetes and database access. The scheduler chooses an operation; the runner performs it. Handler validation and import validation must enforce the same policy rules.

## Intended state and evaluation

The engine gives active `force_sleep` exceptions precedence over `stay_awake`, then uses the union of the policy's sleep windows. Stored policies without windows produce `unknown` at this layer. Current create/import endpoints require 1–10 valid windows; the lower-level window evaluator's empty-input behavior is not the scheduler's policy contract.

The scheduler caches parsed windows and locations, evaluates enabled policies on the configured interval, and compares intended state with recorded state. Guardrail changes reload settings and restart the evaluation ticker when needed. Manual triggers can execute disabled policies.

Additional evaluator behavior:

- **Auto Wake** gates ordinary scheduled wakes. It does not gate corrective wake reconciliation in the same way.
- **Reconcile While Awake** retries restoration when an awake policy still has snapshots needing restore, with a five-minute per-policy backoff.
- **Enforce Sleep** checks open snapshots for workloads scaled up during a sleep period and requests a corrective sleep, also with backoff. Namespace protection and active stay-awake exceptions remain relevant.
- A `transitioning` policy is skipped by normal evaluation. A stale transition is reset after the policy timeout plus five minutes, with a minimum threshold of fifteen minutes.

Read the scheduler's branch order before modifying a gate: recovery, exceptions, ordinary transitions, and drift correction are separate paths.

## Claims and execution lifecycle

An in-process map rejects a second execution for the same policy. A conditional database transition claim provides another guard before creating the execution row. After the claim, the policy is `transitioning`, and the execution is `running`.

The runner executes with a cancellable timeout context. A policy timeout of zero uses the two-hour server default. Logs are drained and persisted while the runner works. After the runner returns, the scheduler drains the log worker and closes broker delivery before finalizing counts, execution status, and policy state. A clean WebSocket close can therefore precede the final HTTP record update; clients must reconcile the execution record. The in-process claim is then released. Failure to create an execution after claiming a transition resets the policy to `unknown`.

`success`, `failed`, and `interrupted` describe the execution result; `awake`, `sleeping`, `transitioning`, and `unknown` describe policy state. Plan runs can update recorded state without touching Kubernetes. A state badge alone does not prove replicas or pod readiness.

On startup, unfinished execution records are marked interrupted and stale transition state is reset. Recovery then compares enabled policies with their current window/exception intent. This is reconciliation, not a replay of every missed schedule boundary. It depends on the database, Kubernetes access, and the configured execution mode.

## Sleep and snapshots

Sleep lists Deployments and StatefulSets using the workload selector, filters namespaces and protected namespaces, and orders work by priority namespace. Workload scaling uses bounded concurrency. Existing open snapshots prevent ordinary double-sleep from replacing the original replica baseline.

| Workload condition | Apply behavior |
| :----------------- | :------------- |
| Already at zero | Record `wasAlreadyZero`; do not claim ownership of a later wake |
| Existing open snapshot | Skip ordinary double-sleep; retain the original baseline |
| Positive replicas | Scale to zero, then persist the captured replica count |
| Scale failure | Log the failure and count an error |

The Kubernetes scale and database insert are separate operations. A snapshot write can fail after replicas reach zero; the runner logs a warning that automatic restoration is unavailable for that workload. Do not describe this as an atomic transaction or guaranteed recovery after database loss. Operators need execution logs and a verified replica baseline for that case.

Snapshots in PostgreSQL are the current restoration source. There is no annotation fallback. Plan mode logs proposed actions without creating workload snapshots or mutating Kubernetes resources.

## Wake and snapshot closure

Wake reads open snapshots for the policy, applies a namespace filter when present, and restores the recorded counts. It does not rediscover an arbitrary desired replica count from live labels. Priority namespace ordering and optional wake waves control processing; wave readiness waits are bounded.

| Snapshot/workload condition | Apply behavior |
| :-------------------------- | :------------- |
| Originally zero | Close without scaling |
| Workload deleted | Mark deleted-at-wake and skip |
| Already at recorded replicas | Mark external scaling and close without a redundant scale |
| Nonzero replicas differing from the baseline | Log external scaling and restore the recorded count |
| Lookup or scale fails | Report an error; retain work that can be retried |

Snapshot closure writes can also fail after a successful scale. Keep retries tolerant of already-restored replicas. Follow [the first-policy walkthrough](../first-policy.md) to verify actual replica restoration.

## Node operations

After workload sleep, the runner considers nodes across the cluster. A policy's namespace filter does not scope node deletion. Node protection checks labels, taints, configured critical namespaces, and optionally critical-priority non-DaemonSet pods. Critical-priority protection is off by default.

Unprotected nodes can be cordoned, drained, and deleted. The drain uses evictions and can fall back to force deletion on eviction failure; do not imply it guarantees PodDisruptionBudget preservation. Inspect [nodes.go](../../backend/internal/scaler/nodes.go) and [client.go](../../backend/internal/k8s/client.go) before changing this behavior.

Wake restores workloads only; it does not uncordon surviving nodes or recreate deleted ones. An external autoscaler, such as Karpenter, must replace missing capacity. Use [explicit all-node protection](../first-policy.md#2-protect-every-node) for local scaling exercises.

## Scheduled exceptions

Each exception references a parent policy. Activation and completion run on the configured evaluator interval. `stay_awake` requests a wake and `force_sleep` requests a sleep; a disabled parent skips execution. Scoped exception operations use an in-memory copy of the policy with supplied filters rather than changing its saved targeting.

Scoped exceptions still affect the policy-level intended state so the ordinary evaluator does not immediately contradict them. API validation rejects overlapping opposite-type exceptions on the same parent; the engine retains force-sleep precedence for stored inputs.

When `sleepOnEnd` is true, completion or active cancellation computes the normal schedule's current intended state and requests sleep or wake accordingly. The name is historical: it does not mean the end action always sleeps. Unknown intent or a disabled parent skips the return execution.

## Changing this area

Add focused tests at the layer where the behavior belongs: pure time cases in `internal/policy`, claims and gates in `internal/scheduler`, and mutation/snapshot outcomes in `internal/scaler`. Cover overnight boundaries, exception precedence, cancellation, partial failure, and retry behavior when those paths change.

Use the [policy smoke test](../testing/policy-smoke-test.md) for a quick manual check and the [regression catalogue](../test-plan-policy.md) for broader scenarios. Record which checks actually ran; the catalogue lists expected behavior, not current test evidence.
