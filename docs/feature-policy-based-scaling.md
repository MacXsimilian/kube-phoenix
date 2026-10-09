# Policy-Based Scaling — Design and Requirements Record

This document records the motivation, requirements, and acceptance criteria for policy-based scaling. It is a design record, not an installation guide or a test-results report. The status below describes the current source implementation; an implemented requirement does not mean its acceptance scenario has been executed in every environment.

For current operation, use [Your first policy](first-policy.md), [window scheduling semantics](window-native-scheduling.md), and the [configuration reference](configuration.md). Record actual validation in the [smoke checklist](testing/policy-smoke-test.md) or a run of the [scenario catalogue](test-plan-policy.md).

## Current Status

| Area | Current implementation | Scope or qualification |
| :--- | :--------------------- | :--------------------- |
| Window scheduling (R1, R5) | Implemented: recurring local-time windows, union evaluation, configurable tick, recovery and reconciliation | `nextTransitionAt` predicts window changes; exceptions and execution delays are not included in that prediction |
| Workload sleep/wake (R2.1–R2.5, R2.7) | Implemented for Deployments and StatefulSets with prepared/applied database snapshots, execution timeouts, and conflict retries | Intent is persisted before scale-down; partial failures fail execution, retain recovery data, and defer nodes. Wake follows kind/namespace/name, including legacy snapshots and replacements |
| Annotation recovery (R2.6) | **Superseded** for policy executions | Policy wake reads database snapshots; it does not reconstruct lost snapshots from workload annotations |
| Exceptions (R3) | Implemented: parent policy, lifecycle, type-based start action, namespace/label/explicit-target intersections | Scoped work preserves baseline schedule state and does not drain nodes. End action follows the current schedule rather than blindly reversing the start action |
| Guardrails and overlap checks (R4) | Implemented: namespace protection during sleep, node label/taint protection, priority order, conservative namespace overlap checks | Node processing is cluster-wide; a workload namespace filter does not restrict node candidates. Label-selector intersections are not used to permit same-namespace apply policies |
| Execution records (R6) | Implemented: database history, streamed logs, counters and metrics | Plan executions also record state/history; displayed policy state alone does not prove cluster replicas changed |
| Startup/execution ownership (R5.3, R5.5) | One dedicated PostgreSQL advisory-lock session covers startup recovery and process lifetime | One application replica, Recreate upgrades, at least two DB connections, and session-preserving DB access are required; this is not an HA scheduler |
| Acceptance scenarios below | Defined verification targets | No pass/fail results or deployment-wide completion claim are recorded here |

Implementation entry points: [window evaluator](../backend/internal/policy/evaluator.go), [scheduler](../backend/internal/scheduler/policy_scheduler.go), [execution lifecycle](../backend/internal/scheduler/execution.go), [policy scaler](../backend/internal/scaler/policy_scaler.go), [workload operations](../backend/internal/scaler/workloads.go), [node processing](../backend/internal/scaler/nodes.go), [policy overlap checks](../backend/internal/store/policies.go), and [snapshot store](../backend/internal/store/snapshots.go).

## Problem Statement

Kubernetes clusters running non-production workloads (dev, staging, QA) consume full resources 24/7 even when no one is using them — nights, weekends, holidays. Teams pay for idle compute with no automated way to scale down based on business hours and scale back up before engineers start working.

---

## Use Cases

**UC-1: Office-Hours Scaling**
A platform team wants dev-environment Deployments and StatefulSets scaled to zero every weeknight at 8 PM and restored every morning at 7 AM, Monday through Friday.

**UC-2: Weekend Shutdown**
The same team wants all staging workloads fully shut down Friday 8 PM → Monday 7 AM.

**UC-3: Selective Targeting**
Only workloads in specific namespaces (e.g., `dev`, `staging`) or matching specific labels (e.g., `cost-group=non-prod`) should be scaled. Configured protected namespaces must be excluded from workload sleep. Wake may still restore existing snapshots in those namespaces. Node drain/deletion is a separate cluster-wide phase with its own guardrails.

**UC-4: Safe Preview Before Enforcement**
An operator wants to see what a policy *would* do before it actually scales anything — a dry-run/plan mode.

**UC-5: Emergency Exception**
During an incident or demo, an operator creates an immediate exception to keep workloads awake beyond the scheduled sleep window, or force-sleep workloads outside the normal schedule.

**UC-6: Scheduled Exception**
A team has a load test next Tuesday 2 AM–6 AM. They need to pre-schedule a "stay awake" window that overrides the normal sleep policy for that night only.

**UC-7: Graceful Recovery**
If the system restarts mid-sleep or mid-wake, it must detect the mismatch between intended state and actual state and self-correct without operator intervention.

**UC-8: Drift Reconciliation**
If a workload is manually scaled back up while a sleep policy is active, the system should detect and optionally re-enforce the policy.

**UC-9: Emergency Scale**
During a critical incident, an admin needs to immediately disable all policies, cancel all active exceptions, and scale every sleeping workload to at least 1 replica to restore service availability.

---

## Requirements

Requirement IDs are retained for traceability. Superseded wording is called out where the implemented design changed. These are behavior requirements, not claims that cluster operations always succeed.

### R1 — Policy Definition

| #    | Requirement                                                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------ |
| R1.1 | A policy must define one or more **sleep windows** — recurring time ranges when targeted workloads should be scaled to zero           |
| R1.2 | Each window specifies days of week, start time, end time, and supports overnight spans (e.g., 22:00 → 06:00)                        |
| R1.3 | All times are relative to a configurable **timezone** per policy                                                                     |
| R1.4 | A policy targets workloads via **namespace filter** (comma-separated list or all) and optional **Kubernetes label selector**          |
| R1.5 | A policy has a **mode**: `plan` (log-only, no scaling) or `apply` (actual scaling)                                                   |
| R1.6 | A policy can be **enabled/disabled** without deleting it                                                                             |
| R1.7 | Maximum 10 sleep windows per policy                                                                                                  |

### R2 — Scaling Behavior

| #    | Requirement                                                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------ |
| R2.1 | **Sleep**: persist prepared intent with each matching Deployment/StatefulSet's replica count before scaling to 0, then record application. Retain intent on failure; any operation error fails the execution and defers node actions |
| R2.2 | **Wake**: restore each workload by kind/namespace/name to its saved pre-sleep replica count, including same-name replacements and legacy snapshots without UID metadata |
| R2.3 | Workloads already at 0 replicas at sleep time must be recorded but not re-scaled on wake                                             |
| R2.4 | If a workload is deleted while sleeping, wake must handle this gracefully (log, skip, mark)                                          |
| R2.5 | Replica snapshots must be persisted to survive system restarts                                                                       |
| R2.6 | **Superseded:** the original annotation-fallback requirement is not the policy wake path. Database snapshots are required for restoration                                          |
| R2.7 | Each execution must have a configurable **timeout**                                                                                  |

### R3 — Scheduled Exceptions

| #    | Requirement                                                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------ |
| R3.1 | Exceptions define a future time window that overrides the normal policy schedule                                                     |
| R3.2 | Exceptions have a lifecycle: `pending` → `active` → `completed` (or `cancelled`)                                                    |
| R3.3 | Exception type (`stay_awake` or `force_sleep`) must determine the action taken on start — wake for stay_awake, sleep for force_sleep |
| R3.4 | **Revised:** `sleepOnEnd=true` requests the current schedule's sleep/wake action at end, using the exception scope; it is not necessarily the inverse action                             |
| R3.5 | Only pending exceptions can be edited                                                                                                |
| R3.6 | Exception namespaces, labels, and explicit workload targets intersect each other and the parent policy boundary; scoped actions preserve baseline scheduling for other workloads and skip node drain/deletion |

### R4 — Guardrails & Protection

| #    | Requirement                                                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------ |
| R4.1 | A configurable list of **protected namespaces** excluded from sleep/scaling-down; seeded defaults include `kube-system`. Wake can still restore existing snapshots                                                   |
| R4.2 | Nodes can be **protected** by exact label or taint matches, excluding them from the sleep execution's cluster-wide drain/delete phase                                                     |
| R4.3 | **Priority namespaces** are processed first during both sleep and wake                                                               |
| R4.4 | Reject potentially overlapping `apply` policies on creation or update using namespace scope; disabled apply policies also participate in this conservative check                                 |

### R5 — Evaluation Loop

| #    | Requirement                                                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------ |
| R5.1 | A background scheduler evaluates all enabled policies on a configurable tick interval (default 30s)                                  |
| R5.2 | Each tick computes the **intended state** (sleeping/awake) and compares to **current state**                                         |
| R5.3 | State transitions are **atomically claimed** to prevent concurrent executions of the same policy; a dedicated database advisory-lock session excludes another live process from recovery and execution |
| R5.4 | Stuck transitions (no completion within policy timeout + grace period) are automatically reset                                        |
| R5.5 | On startup, the scheduler must run **recovery** — detect mismatches and self-correct                                                |
| R5.6 | While a policy is awake, optional **reconciliation** detects open snapshots and attempts corrective wakes with a fixed five-minute minimum delay between attempts           |
| R5.7 | Active scoped exceptions reconcile on a separate five-minute retry clock without suppressing baseline transitions for other workloads |

### R6 — Observability

| #    | Requirement                                                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------ |
| R6.1 | Every execution is recorded with status (`running`, `success`, `failed`, `interrupted`), trigger type, and aggregate counters |
| R6.2 | Structured log lines per execution, streamable via WebSocket                                                                         |
| R6.3 | Prometheus metrics for scaling events                                                                                                |
| R6.4 | Policy state fields: `CurrentState`, `StateSince`, `LastSleepAt`, `LastWakeAt`, `NextTransitionAt`                                   |

---

## Success Criteria

These are acceptance scenarios to execute and record separately. Timing criteria depend on the cluster and failures; they are not availability guarantees. Protect all nodes for workload-only scenarios, as shown in the tutorial, and keep destructive node tests separate.

| #     | Criteria                                                                                                        | Verification                                                                                    |
| ----- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| SC-1  | Workloads in targeted namespaces reach 0 replicas within the configured timeout after a sleep window starts     | Query replica counts via k8s API after sleep execution completes                                |
| SC-2  | Workloads are restored to their exact pre-sleep replica counts when the sleep window ends                       | Compare post-wake replicas against stored snapshots                                             |
| SC-3  | Workloads in the configured protected namespaces are excluded from sleep/scaling-down; this does not block restoration of existing snapshots                  | Confirm `kube-system` remains protected, then verify a targeted plan excludes its workloads                          |
| SC-4  | `plan` previews intended targets and changes neither workload replicas nor nodes; log levels/text differ from apply                           | Inspect plan targets and node protection, then compare captured Kubernetes state; record apply separately                     |
| SC-5  | Unscoped exceptions take precedence (`force_sleep` > `stay_awake` > schedule); scoped exceptions affect only intersecting targets and preserve other workloads' schedule | Check engine/targeting tests and a mixed-scope wake boundary; API-created opposite-type overlaps should be rejected |
| SC-6  | After restart, recovery detects eligible mismatches and attempts correction; the former two-tick target is not a guaranteed bound      | In a separate recovery test, record interruption handling, retries, elapsed time, and restored replicas                 |
| SC-7  | Potentially overlapping `apply` namespace scopes are rejected on creation and update                                              | Attempt to create overlapping policies, verify rejection                                        |
| SC-8  | Snapshots survive process restarts and are correctly used for wake restoration                                  | Sleep workloads, restart the system, trigger wake, verify correct restoration                   |
| SC-9  | A `force_sleep` exception triggers a sleep action (not a wake)                                                  | Create a force_sleep exception, verify workloads are scaled to zero on start                    |
| SC-10 | Manual sleep/wake triggers work while respecting the transition claim lock (no double-execution)                | Rapidly trigger sleep twice, verify only one execution runs                                     |

---

## Out of Scope (Future Work)

- Webhook/notification integrations (Slack, PagerDuty)
- Per-policy RBAC (namespace-level access control)
- A dedicated permanent per-policy exclusion list (positive targeting and scoped exceptions already exist)
- CronJob and DaemonSet support
- Multi-cluster policy federation
- Cost estimation and reporting

---

## Settled Current Behavior

| Former question | Current behavior |
| :-------------- | :--------------- |
| Are node operations limited by the workload namespace filter? | No. Ordinary sleep considers cluster-wide node candidates and applies node-protection guardrails. Scoped exception runs and incomplete workload prerequisites defer nodes. Wake does not recreate nodes; failure/startup cleanup restores only owned cordons |
| Does a PDB block the sleep drain indefinitely? | Eviction is attempted first; errors other than pod-not-found trigger a zero-grace pod-delete attempt. This bypasses PDBs and graceful termination when pod-delete authorization is present; the default chart does not grant that verb |
| Does an existing snapshot prevent all repeat scaling? | It preserves the original baseline. Ordinary sleep can reapply zero to a nonzero workload with an open snapshot; Enforce Sleep separately controls periodic drift checks |
| Do failed scheduled transitions retry immediately? | No. They use a fixed five-minute minimum retry delay, as do corrective attempts |
| Does changing an apply policy to plan automatically restore sleeping workloads? | No. Saving the mode change does not itself perform a live wake; use an explicit Apply wake when restoration is intended |
| Can exceptions exist without a policy? | No. API validation requires a parent policy |
| Does `sleepOnEnd` always invert an exception? | No. The end action evaluates current policy windows without exceptions; ordinary subsequent evaluation still applies active-exception precedence |

## Open Questions

These are possible future design decisions, not undocumented switches in the current product:

1. Should a separate node-targeting control be introduced alongside workload namespace/label targeting?
2. Should fixed retry delays become configurable or exponential?
3. Should switching apply → plan while snapshots remain open offer an explicit restore-first workflow?

No implementation or delivery commitment is made for these questions. Changes would need their own requirements and acceptance scenarios.
