# Feature: Policy-Based Scheduled Scaling

## Problem Statement

Kubernetes clusters running non-production workloads (dev, staging, QA) consume full resources 24/7 even when no one is using them — nights, weekends, holidays. Teams pay for idle compute with no automated way to scale down based on business hours and scale back up before engineers start working.

---

## Use Cases

**UC-1: Office-Hours Scaling**
A platform team wants dev-environment Deployments and StatefulSets scaled to zero every weeknight at 8 PM and restored every morning at 7 AM, Monday through Friday.

**UC-2: Weekend Shutdown**
The same team wants all staging workloads fully shut down Friday 8 PM → Monday 7 AM.

**UC-3: Selective Targeting**
Only workloads in specific namespaces (e.g., `dev`, `staging`) or matching specific labels (e.g., `cost-group=non-prod`) should be affected. System namespaces (`kube-system`, `monitoring`) must never be touched.

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
| R2.1 | **Sleep**: for each matching Deployment/StatefulSet, capture current replica count, then scale to 0                                   |
| R2.2 | **Wake**: restore each workload to its pre-sleep replica count                                                                       |
| R2.3 | Workloads already at 0 replicas at sleep time must be recorded but not re-scaled on wake                                             |
| R2.4 | If a workload is deleted while sleeping, wake must handle this gracefully (log, skip, mark)                                          |
| R2.5 | Replica snapshots must be persisted to survive system restarts                                                                       |
| R2.6 | An annotation-based fallback must exist on the workload itself in case the database is lost                                          |
| R2.7 | Each execution must have a configurable **timeout**                                                                                  |

### R3 — Scheduled Exceptions

| #    | Requirement                                                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------ |
| R3.1 | Exceptions define a future time window that overrides the normal policy schedule                                                     |
| R3.2 | Exceptions have a lifecycle: `pending` → `active` → `completed` (or `cancelled`)                                                    |
| R3.3 | Exception type (`stay_awake` or `force_sleep`) must determine the action taken on start — wake for stay_awake, sleep for force_sleep |
| R3.4 | An exception may optionally trigger the inverse action on end (e.g., re-sleep after a stay_awake window)                             |
| R3.5 | Only pending exceptions can be edited                                                                                                |

### R4 — Guardrails & Protection

| #    | Requirement                                                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------ |
| R4.1 | A global list of **system namespaces** that are never scaled (e.g., `kube-system`)                                                   |
| R4.2 | Nodes can be **protected** by label or taint — protected nodes are never drained                                                     |
| R4.3 | **Priority namespaces** are processed first during both sleep and wake                                                               |
| R4.4 | Two `apply`-mode policies must not target overlapping workloads — overlap detection at creation time                                 |

### R5 — Evaluation Loop

| #    | Requirement                                                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------ |
| R5.1 | A background scheduler evaluates all enabled policies on a configurable tick interval (default 30s)                                  |
| R5.2 | Each tick computes the **intended state** (sleeping/awake) and compares to **current state**                                         |
| R5.3 | State transitions are **atomically claimed** to prevent concurrent executions of the same policy                                     |
| R5.4 | Stuck transitions (no completion within policy timeout + grace period) are automatically reset                                        |
| R5.5 | On startup, the scheduler must run **recovery** — detect mismatches and self-correct                                                |
| R5.6 | While a policy is awake, **reconciliation** should detect open snapshots (drift) and attempt corrective wakes with backoff           |

### R6 — Observability

| #    | Requirement                                                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------ |
| R6.1 | Every execution is recorded with status (`running`, `success`, `failed`, `interrupted`), trigger type, and aggregate counters |
| R6.2 | Structured log lines per execution, streamable via WebSocket                                                                         |
| R6.3 | Prometheus metrics for scaling events                                                                                                |
| R6.4 | Policy state fields: `CurrentState`, `StateSince`, `LastSleepAt`, `LastWakeAt`, `NextTransitionAt`                                   |

---

## Success Criteria

| #     | Criteria                                                                                                        | Verification                                                                                    |
| ----- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| SC-1  | Workloads in targeted namespaces reach 0 replicas within the configured timeout after a sleep window starts     | Query replica counts via k8s API after sleep execution completes                                |
| SC-2  | Workloads are restored to their exact pre-sleep replica counts when the sleep window ends                       | Compare post-wake replicas against stored snapshots                                             |
| SC-3  | System namespaces and protected workloads are **never** scaled, under any policy configuration                  | Create a policy targeting `kube-system` — verify 0 workloads affected                          |
| SC-4  | `plan` mode produces execution logs identical to `apply` mode but changes 0 replicas                           | Run same policy in both modes, diff execution logs vs. actual cluster state                     |
| SC-5  | Exceptions take precedence in the correct order (`force_sleep` > `stay_awake` > schedule)                      | Create conflicting exceptions, verify the highest-priority one wins                             |
| SC-6  | After a system restart mid-execution, the scheduler recovers and reaches the correct state within 2 ticks      | Kill the process during a sleep, restart, verify workloads reach intended state                 |
| SC-7  | Two `apply`-mode policies cannot be created with overlapping scope                                              | Attempt to create overlapping policies, verify rejection                                        |
| SC-8  | Snapshots survive process restarts and are correctly used for wake restoration                                  | Sleep workloads, restart the system, trigger wake, verify correct restoration                   |
| SC-9  | A `force_sleep` exception triggers a sleep action (not a wake)                                                  | Create a force_sleep exception, verify workloads are scaled to zero on start                    |
| SC-10 | Manual sleep/wake triggers work while respecting the transition claim lock (no double-execution)                | Rapidly trigger sleep twice, verify only one execution runs                                     |

---

## Out of Scope (Future Work)

- Webhook/notification integrations (Slack, PagerDuty)
- Per-policy RBAC (namespace-level access control)
- Workload-level exclusions within a policy
- CronJob and DaemonSet support
- Multi-cluster policy federation
- Cost estimation and reporting

---

## Open Questions

1. Should node draining be scoped to the policy's namespace filter, or remain cluster-wide?
2. Should failed scheduled transitions have exponential backoff (like reconciliation does), or is immediate retry acceptable?
3. Should switching a policy from `apply` → `plan` while workloads are sleeping force a wake first?
4. ~~How should freestanding exceptions (no parent policy) work — independent targeting, or disallowed?~~ **Resolved:** Freestanding exceptions are rejected at the API layer. All exceptions must reference a policy.
