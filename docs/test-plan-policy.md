# Policy Feature — Test Planbook

> Target environment: minikube 3-node cluster (local-cluster)
> 9 namespaces, 72 deployments, 240 pods (`busybox:1.37` with role-based activity, some `pause:3.10` for idle workloads)
> Access: `http://localhost:8080` — admin / adminadmin

---

## Table of Contents

1. [Pre-flight Checks](#1-pre-flight-checks)
2. [Policy CRUD](#2-policy-crud)
3. [Sleep Windows & Scheduling](#3-sleep-windows--scheduling)
4. [Manual Sleep / Wake](#4-manual-sleep--wake)
5. [Plan Mode vs Apply Mode](#5-plan-mode-vs-apply-mode)
6. [Namespace Filtering](#6-namespace-filtering)
7. [Label Selector Targeting](#7-label-selector-targeting)
8. [Multi-Namespace Policies](#8-multi-namespace-policies)
9. [Scheduled Exceptions](#9-scheduled-exceptions)
10. [Scoped Exceptions](#10-scoped-exceptions)
11. [Exception Lifecycle](#11-exception-lifecycle)
12. [Guardrails Integration](#12-guardrails-integration)
13. [Drift Detection & Reconciliation](#13-drift-detection--reconciliation)
14. [Sleep Enforcement](#14-sleep-enforcement)
15. [Overlap Detection](#15-overlap-detection)
16. [Timeout & Stuck Transitions](#16-timeout--stuck-transitions)
17. [Concurrent Execution Safety](#17-concurrent-execution-safety)
18. [Edge Cases — Workload State](#18-edge-cases--workload-state)
19. [Node Drain](#19-node-drain)
20. [Execution Logs & WebSocket Streaming](#20-execution-logs--websocket-streaming)
21. [Workload Snapshots](#21-workload-snapshots)
22. [Policy Delete Cascade](#22-policy-delete-cascade)
23. [Scheduler Recovery on Restart](#23-scheduler-recovery-on-restart)
24. [Frontend — Policies List](#24-frontend--policies-list)
25. [Frontend — Policy Detail](#25-frontend--policy-detail)
26. [Frontend — Create / Edit Dialog](#26-frontend--create--edit-dialog)
27. [Frontend — Exception Dialog](#27-frontend--exception-dialog)
28. [Frontend — Trigger Mode Override](#28-frontend--trigger-mode-override)
29. [Frontend — Execution History & Log Viewer](#29-frontend--execution-history--log-viewer)
30. [API Validation & Error Responses](#30-api-validation--error-responses)
31. [Load & Scale](#31-load--scale)

---

## 1. Pre-flight Checks

Verify the environment is ready before running any policy tests.

| # | Step | Expected Result |
|---|------|-----------------|
| 1.1 | Run `kubectl get nodes` | 3 nodes: `local-cluster` (control-plane), `local-cluster-m02`, `local-cluster-m03`, all `Ready` |
| 1.2 | Run `kubectl get deployments -A \| grep team- \| wc -l` | 72 deployments |
| 1.3 | Run `kubectl get pods -A \| grep team- \| grep Running \| wc -l` | 240 pods in `Running` state |
| 1.4 | Open `http://localhost:8080`, log in as admin | Dashboard loads, Cluster State shows all 9 namespaces |
| 1.5 | Navigate to Policies page | Empty state — no policies exist yet |
| 1.6 | Navigate to Guardrails page | Default settings loaded, no protected namespaces |
| 1.7 | Check metrics-server: `kubectl top nodes` | Returns CPU/memory for all 3 nodes |

---

## 2. Policy CRUD

### 2.1 Create — Minimal

| # | Step | Expected Result |
|---|------|-----------------|
| 2.1.1 | Click "Create Policy" | Dialog opens with default values: mode=plan, timezone=UTC, enabled=on |
| 2.1.2 | Enter name: `nightly-backend`, add 1 sleep window: Mon-Fri 20:00-08:00 | Window appears in preview timeline |
| 2.1.3 | Set namespace filter: `team-backend` | Field accepts comma-separated namespaces |
| 2.1.4 | Submit | Policy created, appears in list with state `awake` or `sleeping` depending on current time |
| 2.1.5 | `GET /api/policies` | Returns array with 1 policy, mode=plan, enabled=true, timezone=UTC |

### 2.2 Create — Full Options

| # | Step | Expected Result |
|---|------|-----------------|
| 2.2.1 | Create policy with: name=`full-options-test`, description=`Testing all fields`, timezone=`America/New_York`, mode=plan, namespace=`team-web`, 2 windows (weekday night + weekend all-day), timeout=60, enabled=true | All fields persisted correctly |
| 2.2.2 | `GET /api/policies/{id}` | All fields match input. `nextTransitionAt` is computed. `sleepWindows` has 2 entries |

### 2.3 Update — Partial

| # | Step | Expected Result |
|---|------|-----------------|
| 2.3.1 | Edit `nightly-backend`: change description to `Updated description` | Only description changes, all other fields unchanged |
| 2.3.2 | Edit: change timezone from UTC to `Europe/Berlin` | Timezone updated. `nextTransitionAt` recalculated |
| 2.3.3 | Edit: toggle enabled off | Policy shows as disabled. Scheduler stops evaluating it |
| 2.3.4 | Edit: toggle enabled on | Policy re-evaluated, state computed from current time |
| 2.3.5 | Edit: add a second sleep window | `sleepWindows` array now has 2 entries |
| 2.3.6 | Edit: change mode from plan to apply | Mode updated. Overlap check runs against other apply-mode policies |

### 2.4 Delete

| # | Step | Expected Result |
|---|------|-----------------|
| 2.4.1 | Delete `full-options-test` | Confirmation dialog appears |
| 2.4.2 | Confirm delete | Policy removed from list. `GET /api/policies/{id}` returns 404 |
| 2.4.3 | Verify cascading delete | Associated executions, log lines, snapshots, and exceptions also deleted |

---

## 3. Sleep Windows & Scheduling

### 3.1 Same-Day Window

| # | Step | Expected Result |
|---|------|-----------------|
| 3.1.1 | Create policy with window: Mon-Fri 09:00-17:00 UTC | Policy sleeping during 09:00-17:00 UTC on weekdays |
| 3.1.2 | Verify state at 10:00 UTC on a Tuesday | `currentState=sleeping` |
| 3.1.3 | Verify state at 18:00 UTC on a Tuesday | `currentState=awake` |
| 3.1.4 | Verify state at 10:00 UTC on a Saturday | `currentState=awake` |

### 3.2 Overnight Window

| # | Step | Expected Result |
|---|------|-----------------|
| 3.2.1 | Create policy with window: Mon-Fri 20:00-06:00 UTC | Sleeping from 20:00 to next-day 06:00 |
| 3.2.2 | Verify state at 22:00 UTC on Wednesday | `currentState=sleeping` |
| 3.2.3 | Verify state at 03:00 UTC on Thursday (window started Wed 20:00) | `currentState=sleeping` |
| 3.2.4 | Verify state at 07:00 UTC on Thursday | `currentState=awake` |
| 3.2.5 | Verify Friday 20:00 → Saturday 06:00 | Sleeping (Friday is in daysOfWeek, overnight extends to Saturday) |
| 3.2.6 | Verify Saturday 20:00 → Sunday 06:00 if Sat NOT in daysOfWeek | `currentState=awake` |

### 3.3 All-Day Window

| # | Step | Expected Result |
|---|------|-----------------|
| 3.3.1 | Create policy with window: Sat-Sun, allDay=true | Sleeping all day Saturday and Sunday |
| 3.3.2 | Verify state Saturday 00:01 | `currentState=sleeping` |
| 3.3.3 | Verify state Saturday 23:59 | `currentState=sleeping` |
| 3.3.4 | Verify state Friday 23:59 | `currentState=awake` |
| 3.3.5 | Verify state Monday 00:01 | `currentState=awake` |

### 3.4 Multiple Windows

| # | Step | Expected Result |
|---|------|-----------------|
| 3.4.1 | Create policy with 2 windows: weekday nights (20:00-08:00) + weekends (allDay) | Combined coverage |
| 3.4.2 | Verify state Wednesday 22:00 | `sleeping` (window 1) |
| 3.4.3 | Verify state Wednesday 12:00 | `awake` (no window active) |
| 3.4.4 | Verify state Saturday 14:00 | `sleeping` (window 2) |

### 3.5 Timezone Handling

| # | Step | Expected Result |
|---|------|-----------------|
| 3.5.1 | Create policy: window Mon-Fri 18:00-06:00, timezone=`America/New_York` | Evaluates in ET, not UTC |
| 3.5.2 | Verify at 23:00 UTC on a Wednesday (= 18:00 ET during EDT) | `sleeping` |
| 3.5.3 | Verify at 22:00 UTC on a Wednesday during EST (= 17:00 ET) | `awake` |
| 3.5.4 | Change timezone to `Asia/Tokyo` | `nextTransitionAt` recalculated for JST |

### 3.6 Next Transition Calculation

| # | Step | Expected Result |
|---|------|-----------------|
| 3.6.1 | Create policy with known window, check `nextTransitionAt` | Shows next boundary (sleep start or wake time) |
| 3.6.2 | Wait for transition to occur | `nextTransitionAt` updates to the following boundary |
| 3.6.3 | Verify frontend countdown matches `nextTransitionAt` | Countdown ticks down correctly |

---

## 4. Manual Sleep / Wake

### 4.1 Basic Manual Triggers

| # | Step | Expected Result |
|---|------|-----------------|
| 4.1.1 | On an awake policy, click Sleep | Trigger mode dialog appears |
| 4.1.2 | Confirm with default mode | Execution created, `executionId` returned. State → `transitioning` → `sleeping` |
| 4.1.3 | Check execution: direction=sleep, trigger=`manual_sleep` | Correct trigger type recorded |
| 4.1.4 | On the now-sleeping policy, click Wake | Trigger mode dialog appears |
| 4.1.5 | Confirm | State → `transitioning` → `awake`. Trigger=`manual_wake` |

### 4.2 Manual Trigger on Disabled Policy

| # | Step | Expected Result |
|---|------|-----------------|
| 4.2.1 | Disable the policy | Policy shows as disabled |
| 4.2.2 | Click Sleep | Should still work — manual triggers work regardless of enabled state |
| 4.2.3 | Verify scheduler does NOT auto-wake | Since disabled, scheduler ignores it. State stays `sleeping` |

### 4.3 Sleep When Already Sleeping

| # | Step | Expected Result |
|---|------|-----------------|
| 4.3.1 | Policy is sleeping. Click Sleep again | Returns 409 Conflict (`ErrAlreadyRunning`) or skips gracefully |

### 4.4 Wake When Already Awake

| # | Step | Expected Result |
|---|------|-----------------|
| 4.4.1 | Policy is awake with no open snapshots. Click Wake | Execution completes with 0 scaled (nothing to restore) |

---

## 5. Plan Mode vs Apply Mode

### 5.1 Plan Mode Execution

| # | Step | Expected Result |
|---|------|-----------------|
| 5.1.1 | Create policy in plan mode targeting `team-backend` | Mode badge shows "plan" |
| 5.1.2 | Trigger manual sleep | Execution created with mode=plan |
| 5.1.3 | Check execution logs | Log lines with level=`plan`: "Would scale deployment api 5→0", etc. |
| 5.1.4 | Check `countScaled` | Reflects number that would be scaled |
| 5.1.5 | `kubectl get pods -n team-backend` | All pods still running — no actual scaling |
| 5.1.6 | Check workload snapshots | No snapshots created (plan mode does not persist snapshots) |

### 5.2 Apply Mode Execution

| # | Step | Expected Result |
|---|------|-----------------|
| 5.2.1 | Create policy in apply mode targeting `team-qa` | Overlap check passes (no other apply policy on team-qa) |
| 5.2.2 | Trigger manual sleep | Execution with mode=apply |
| 5.2.3 | Check execution logs | Log lines with level=`ok`: "Scaled deployment test-runner 5→0" |
| 5.2.4 | `kubectl get pods -n team-qa` | 0 pods running |
| 5.2.5 | Check workload snapshots | 7 snapshots created (one per deployment), each with `replicasBefore` set |
| 5.2.6 | Trigger wake | All deployments restored to original replica counts |
| 5.2.7 | `kubectl get pods -n team-qa` | 25 pods running again |

### 5.3 Mode Override on Trigger

| # | Step | Expected Result |
|---|------|-----------------|
| 5.3.1 | Policy is in apply mode. Trigger sleep with mode override = plan | Execution runs in plan mode. No actual scaling |
| 5.3.2 | Policy is in plan mode. Trigger sleep with mode override = apply | Execution runs in apply mode. Workloads actually scaled to 0 |
| 5.3.3 | Verify execution record has the overridden mode, not the policy default | `execution.mode` matches the override |

---

## 6. Namespace Filtering

### 6.1 Single Namespace

| # | Step | Expected Result |
|---|------|-----------------|
| 6.1.1 | Create policy: namespaceFilter=`team-backend`, mode=apply | Only team-backend targeted |
| 6.1.2 | Trigger sleep | 8 deployments in team-backend scale to 0 (30 pods) |
| 6.1.3 | Verify other namespaces untouched | `kubectl get pods -n team-web` — still 25 running |
| 6.1.4 | Wake | team-backend restored to 30 pods |

### 6.2 Multiple Namespaces

| # | Step | Expected Result |
|---|------|-----------------|
| 6.2.1 | Create policy: namespaceFilter=`team-web,team-data` | Targets both namespaces |
| 6.2.2 | Trigger sleep (apply mode) | team-web (25 pods) and team-data (30 pods) scale to 0 |
| 6.2.3 | Verify team-backend, team-qa, etc. untouched | No change |
| 6.2.4 | Wake | Both namespaces restored |

### 6.3 No Namespace Filter (All Namespaces)

| # | Step | Expected Result |
|---|------|-----------------|
| 6.3.1 | Create policy: namespaceFilter empty | Targets all non-system namespaces |
| 6.3.2 | Trigger sleep (plan mode) | Logs show all 72 deployments across 9 team namespaces |
| 6.3.3 | Verify kube-system, kube-phoenix namespaces excluded | System namespaces never targeted |

---

## 7. Label Selector Targeting

### 7.1 Setup

| # | Step | Expected Result |
|---|------|-----------------|
| 7.1.1 | Label specific deployments: `kubectl -n team-backend label deployment api tier=critical` | Label applied |
| 7.1.2 | Label: `kubectl -n team-backend label deployment worker tier=batch` | Label applied |
| 7.1.3 | Label: `kubectl -n team-backend label deployment cron tier=batch` | Label applied |

### 7.2 Label-Based Policy

| # | Step | Expected Result |
|---|------|-----------------|
| 7.2.1 | Create policy: namespaceFilter=`team-backend`, labelSelector=`tier=batch` | Only batch-tier deployments targeted |
| 7.2.2 | Trigger sleep (apply mode) | Only `worker` and `cron` scale to 0 |
| 7.2.3 | Verify `api` still running at 5 replicas | Not matched by label selector |
| 7.2.4 | Wake | `worker` and `cron` restored |

### 7.3 Invalid Label Selector

| # | Step | Expected Result |
|---|------|-----------------|
| 7.3.1 | Create policy with labelSelector=`invalid!!!syntax` | 400 error: invalid label selector |
| 7.3.2 | Create policy with labelSelector=`tier in (batch, critical)` | Accepted — set-based selector is valid K8s syntax |

---

## 8. Multi-Namespace Policies

### 8.1 Cross-Team Policy

| # | Step | Expected Result |
|---|------|-----------------|
| 8.1.1 | Create policy: namespaceFilter=`team-data,team-web,team-ml` | Targets 3 namespaces (80 pods total) |
| 8.1.2 | Trigger sleep (apply) | All 3 namespaces scale to 0 |
| 8.1.3 | Verify execution counts: `countScaled` = 23 (9+7+7 deployments) | Correct deployment count |
| 8.1.4 | Wake | All 80 pods restored across 3 namespaces |

### 8.2 All-Namespace Policy

| # | Step | Expected Result |
|---|------|-----------------|
| 8.2.1 | Create policy: no namespace filter, no label selector | Targets everything |
| 8.2.2 | Trigger sleep (plan mode) | Logs show 72 deployments across 9 namespaces would be scaled |
| 8.2.3 | Verify `countScaled` = 72 in plan mode | All deployments counted |

---

## 9. Scheduled Exceptions

### 9.1 Stay-Awake Exception

| # | Step | Expected Result |
|---|------|-----------------|
| 9.1.1 | Create policy targeting `team-backend`, apply mode, with a window that covers now | Policy sleeping, team-backend at 0 |
| 9.1.2 | Create exception: type=`stay_awake`, starts=now, ends=+2h | Exception created in `pending` state |
| 9.1.3 | Wait for scheduler tick (≤30s) | Exception transitions to `active`. Wake execution fires for team-backend |
| 9.1.4 | Verify team-backend pods restored | 30 pods running |
| 9.1.5 | Policy `currentState` during exception | `awake` (exception overrides window) |
| 9.1.6 | Wait for exception to end (or shorten `endsAt`) | Exception → `completed`. If `sleepOnEnd=true`, sleep re-triggered |
| 9.1.7 | Verify team-backend scales back to 0 | Policy reverts to schedule-driven state |

### 9.2 Force-Sleep Exception

| # | Step | Expected Result |
|---|------|-----------------|
| 9.2.1 | Create policy targeting `team-qa`, apply mode, currently in awake window | Policy awake, team-qa has 25 pods |
| 9.2.2 | Create exception: type=`force_sleep`, starts=now, ends=+1h | Pending → active |
| 9.2.3 | Wait for activation | Sleep execution fires. team-qa scales to 0 |
| 9.2.4 | Policy `currentState` during exception | `sleeping` (force_sleep overrides awake window) |
| 9.2.5 | Exception ends | If `sleepOnEnd=true` and schedule says awake: wake fires, pods restored |

### 9.3 Exception with sleepOnEnd=false

| # | Step | Expected Result |
|---|------|-----------------|
| 9.3.1 | Create stay_awake exception with `sleepOnEnd=false` on a sleeping policy | Exception activates, pods wake |
| 9.3.2 | Exception ends | No revert action dispatched. Policy state re-evaluated on next tick |
| 9.3.3 | If still in sleep window, scheduler triggers sleep on next tick | State eventually corrects to `sleeping` |

---

## 10. Scoped Exceptions

### 10.1 Namespace-Scoped Exception

| # | Step | Expected Result |
|---|------|-----------------|
| 10.1.1 | Create policy targeting `team-backend,team-web` (apply mode) | Both namespaces in scope |
| 10.1.2 | Sleep the policy | Both namespaces scale to 0 (55 pods total) |
| 10.1.3 | Create exception: type=`stay_awake`, namespaceFilter=`team-backend` only | Scoped to team-backend |
| 10.1.4 | Exception activates | Only team-backend wakes (30 pods). team-web stays at 0 |
| 10.1.5 | Exception ends with sleepOnEnd=true | Only team-backend re-sleeps. team-web unaffected (already at 0) |

### 10.2 Label-Scoped Exception

| # | Step | Expected Result |
|---|------|-----------------|
| 10.2.1 | Policy targets `team-backend` (all deployments). Sleep it | 8 deployments at 0 |
| 10.2.2 | Create exception: type=`stay_awake`, labelSelector=`tier=critical` | Only `api` deployment matches |
| 10.2.3 | Exception activates | Only `api` wakes to 5 replicas. Other 7 deployments stay at 0 |
| 10.2.4 | Exception ends | `api` scales back to 0 |

### 10.3 Exception Scope Wider Than Policy

| # | Step | Expected Result |
|---|------|-----------------|
| 10.3.1 | Policy targets `team-backend`. Create exception with namespaceFilter=`team-backend,team-web` | Exception scope broader than policy |
| 10.3.2 | Exception activates | Only affects team-backend (intersection of policy + exception scope). team-web not touched because it has no snapshots from this policy |

---

## 11. Exception Lifecycle

### 11.1 State Transitions

| # | Step | Expected Result |
|---|------|-----------------|
| 11.1.1 | Create exception with `startsAt` = now + 5min | Status = `pending` |
| 11.1.2 | Wait 5 minutes | Status transitions to `active`. Start execution recorded |
| 11.1.3 | Let it run until `endsAt` | Status transitions to `completed`. End execution recorded |
| 11.1.4 | Verify `startExecutionId` and `endExecutionId` populated | Both IDs reference valid executions |

### 11.2 Cancel Pending

| # | Step | Expected Result |
|---|------|-----------------|
| 11.2.1 | Create exception with future `startsAt` | Status = `pending` |
| 11.2.2 | Cancel it | Status = `cancelled`, `cancelledAt` set, `cancelReason` stored |
| 11.2.3 | No execution triggered | No start/end executions created |

### 11.3 Cancel Active

| # | Step | Expected Result |
|---|------|-----------------|
| 11.3.1 | Create exception that is currently active | Status = `active`, start execution completed |
| 11.3.2 | Cancel it | Status = `cancelled`. If sleepOnEnd, revert action dispatched |

### 11.4 Edit Exception

| # | Step | Expected Result |
|---|------|-----------------|
| 11.4.1 | Edit a pending exception: change `endsAt` | Updated successfully |
| 11.4.2 | Try editing an active exception | 409: only pending exceptions can be edited |
| 11.4.3 | Try editing a completed exception | 409: only pending exceptions can be edited |

### 11.5 Overlapping Exceptions

| # | Step | Expected Result |
|---|------|-----------------|
| 11.5.1 | Create stay_awake exception: 10:00-12:00 | Created |
| 11.5.2 | Create force_sleep exception: 11:00-13:00 (overlaps, opposite type) | 409: overlapping exception conflict |
| 11.5.3 | Create another stay_awake exception: 11:00-13:00 (same type) | Allowed — same-type overlap is fine |

### 11.6 Exception Priority

| # | Step | Expected Result |
|---|------|-----------------|
| 11.6.1 | Have both `force_sleep` and `stay_awake` active simultaneously (from non-overlapping creation) | `force_sleep` takes precedence → policy sleeping |

---

## 12. Guardrails Integration

### 12.1 Protected Namespace

| # | Step | Expected Result |
|---|------|-----------------|
| 12.1.1 | Add `team-payments` to guardrails system-protected namespaces | Guardrails updated |
| 12.1.2 | Create policy targeting `team-payments` (or all namespaces) | Policy created (no error at creation) |
| 12.1.3 | Trigger sleep (apply mode) | team-payments deployments skipped. Execution log shows `countProtected` for those deployments |
| 12.1.4 | Verify `kubectl get pods -n team-payments` | All 25 pods still running |
| 12.1.5 | Check execution `countProtected` | = 8 (all team-payments deployments) |

### 12.2 Protected Namespace in Multi-NS Policy

| # | Step | Expected Result |
|---|------|-----------------|
| 12.2.1 | Policy targets `team-payments,team-infra`. team-payments is protected | Policy created |
| 12.2.2 | Trigger sleep | team-infra scales to 0 (25 pods). team-payments untouched (25 pods remain) |
| 12.2.3 | Execution counts: `countScaled`=8, `countProtected`=8 | team-infra deployments scaled, team-payments protected |

### 12.3 Priority Namespaces

| # | Step | Expected Result |
|---|------|-----------------|
| 12.3.1 | Add `team-platform` to guardrails priority namespaces | Not protected, but scaled first/last |
| 12.3.2 | Create all-namespace policy, trigger sleep | team-platform deployments appear first in execution logs (scaled first) |
| 12.3.3 | Trigger wake | team-platform deployments restored first |

---

## 13. Drift Detection & Reconciliation

### 13.1 Drift During Awake Window

| # | Step | Expected Result |
|---|------|-----------------|
| 13.1.1 | Create apply-mode policy on `team-ml`, sleep then wake | Policy awake, all snapshots closed |
| 13.1.2 | Manually: `kubectl -n team-ml scale deployment model-serve --replicas=0` | Externally scaled down |
| 13.1.3 | If `schedulerReconcileWhileAwake=true` and open snapshots exist | Reconcile detects drift, corrective wake fires |
| 13.1.4 | Note: if snapshots are already closed (wake completed), no drift detected | Reconciliation only checks open snapshots |

### 13.2 Drift After Partial Wake

| # | Step | Expected Result |
|---|------|-----------------|
| 13.2.1 | Sleep `team-ml`, then simulate partial wake failure (e.g., timeout mid-wake) | Some snapshots closed, some still open |
| 13.2.2 | Wait for scheduler tick | `reconcileAwakePolicy` detects open snapshots, triggers reconcile wake |
| 13.2.3 | Remaining workloads restored | All snapshots closed |

### 13.3 Reconcile Backoff

| # | Step | Expected Result |
|---|------|-----------------|
| 13.3.1 | Trigger a reconcile scenario | Reconcile fires |
| 13.3.2 | Immediately check next tick | 5-minute backoff prevents re-reconcile |
| 13.3.3 | Wait >5 minutes | Reconcile eligible again |

---

## 14. Sleep Enforcement

### 14.1 Manual Scale During Sleep

| # | Step | Expected Result |
|---|------|-----------------|
| 14.1.1 | Create apply-mode policy on `team-infra`, trigger sleep | All 25 pods at 0 |
| 14.1.2 | Manually: `kubectl -n team-infra scale deployment dns --replicas=3` | dns externally scaled to 3 |
| 14.1.3 | If `schedulerEnforceSleep=true`, wait for tick | Scheduler detects drift via `HasDriftedFromSleep()` |
| 14.1.4 | Enforce-sleep execution fires | dns re-scaled to 0. Trigger=`enforce_sleep` |
| 14.1.5 | Snapshot marked `wasExternallyScaled=true` | Drift recorded |

### 14.2 Enforcement Respects Scoped Exceptions

| # | Step | Expected Result |
|---|------|-----------------|
| 14.2.1 | Policy on `team-backend` is sleeping. stay_awake exception active on `api` only | api at 5 replicas, others at 0 |
| 14.2.2 | Manually scale `worker` to 2 | External drift on non-excepted workload |
| 14.2.3 | Enforce-sleep fires | `worker` re-scaled to 0. `api` untouched (covered by exception) |

### 14.3 Enforcement Disabled

| # | Step | Expected Result |
|---|------|-----------------|
| 14.3.1 | Set `schedulerEnforceSleep=false` via guardrails | Enforcement disabled |
| 14.3.2 | Sleep a policy, manually scale a workload up | No enforcement fires |
| 14.3.3 | Workload remains at manually-set replicas | Drift tolerated |

---

## 15. Overlap Detection

### 15.1 Apply-Mode Overlap

| # | Step | Expected Result |
|---|------|-----------------|
| 15.1.1 | Create apply-mode policy A on `team-backend` | Created |
| 15.1.2 | Create apply-mode policy B on `team-backend` | 409 Conflict: namespace overlap with policy A |
| 15.1.3 | Create apply-mode policy B on `team-web` instead | Created — no overlap |

### 15.2 Plan-Mode No Overlap Check

| # | Step | Expected Result |
|---|------|-----------------|
| 15.2.1 | Create plan-mode policy C on `team-backend` | Created — plan mode skips overlap check |
| 15.2.2 | Create plan-mode policy D on `team-backend` | Also created — multiple plan policies allowed |

### 15.3 Wildcard Overlap

| # | Step | Expected Result |
|---|------|-----------------|
| 15.3.1 | Create apply-mode policy with empty namespace filter (targets all) | Created |
| 15.3.2 | Create another apply-mode policy on `team-qa` | 409: wildcard policy conflicts with everything |

### 15.4 Overlap on Update

| # | Step | Expected Result |
|---|------|-----------------|
| 15.4.1 | Policy A targets `team-web` (apply). Policy B targets `team-data` (apply) | No overlap |
| 15.4.2 | Update policy B: change namespace to `team-web` | 409: now overlaps with policy A |

---

## 16. Timeout & Stuck Transitions

### 16.1 Execution Timeout

| # | Step | Expected Result |
|---|------|-----------------|
| 16.1.1 | Create policy with `timeoutMinutes=1` | Short timeout for testing |
| 16.1.2 | If an execution runs longer than 1 minute | Context cancelled, execution marked `interrupted` or `failed` |
| 16.1.3 | Verify partial work is recorded | Snapshots created for workloads already processed |

### 16.2 Stuck Transition Detection

| # | Step | Expected Result |
|---|------|-----------------|
| 16.2.1 | Policy stuck in `transitioning` state beyond timeout + 5min + 15min floor | Scheduler detects stuck state |
| 16.2.2 | Scheduler resets state to `unknown` | `currentState=unknown` |
| 16.2.3 | Next tick re-evaluates intended state | New execution fires to correct the state |

### 16.3 Default Timeout

| # | Step | Expected Result |
|---|------|-----------------|
| 16.3.1 | Create policy with `timeoutMinutes=0` | Defaults to 120 minutes internally |
| 16.3.2 | Verify in execution that timeout context is 2 hours | Execution does not time out prematurely |

---

## 17. Concurrent Execution Safety

### 17.1 Double Trigger Prevention

| # | Step | Expected Result |
|---|------|-----------------|
| 17.1.1 | Trigger sleep on a policy | Execution starts, state=`transitioning` |
| 17.1.2 | Immediately trigger sleep again (before first completes) | 409: already executing |
| 17.1.3 | First execution completes | State updates to `sleeping` |
| 17.1.4 | Now trigger wake | Accepted — no concurrent conflict |

### 17.2 Scheduler vs Manual Race

| # | Step | Expected Result |
|---|------|-----------------|
| 17.2.1 | Set up a policy where scheduled transition is imminent | Scheduler about to fire |
| 17.2.2 | Manually trigger at the same moment | One wins the CAS claim, other gets `ErrTransitionAlreadyClaimed` |
| 17.2.3 | Only one execution runs | No double-scaling |

### 17.3 Scaling Concurrency

| # | Step | Expected Result |
|---|------|-----------------|
| 17.3.1 | Create policy targeting all 9 namespaces (72 deployments) | Large scope |
| 17.3.2 | Trigger sleep | Scaling operations bounded by `scalingConcurrency` (default 10) |
| 17.3.3 | Verify all 72 deployments processed | No deployments missed due to concurrency limiting |

---

## 18. Edge Cases — Workload State

### 18.1 Already-Zero Workload

| # | Step | Expected Result |
|---|------|-----------------|
| 18.1.1 | `kubectl -n team-mobile scale deployment crash-report --replicas=0` | crash-report already at 0 |
| 18.1.2 | Sleep the policy targeting team-mobile | crash-report snapshot: `wasAlreadyZero=true` |
| 18.1.3 | Wake the policy | crash-report NOT scaled (stays at 0). Snapshot closed without restore |

### 18.2 Workload Deleted During Sleep

| # | Step | Expected Result |
|---|------|-----------------|
| 18.2.1 | Sleep team-mobile (apply mode) | Snapshots created for all 8 deployments |
| 18.2.2 | `kubectl -n team-mobile delete deployment ab-testing` | Deployment gone |
| 18.2.3 | Wake the policy | ab-testing snapshot: `wasDeletedAtWake=true`. Warning logged. Other deployments restored normally |

### 18.3 Externally Scaled During Sleep

| # | Step | Expected Result |
|---|------|-----------------|
| 18.3.1 | Sleep team-mobile (apply mode) | All at 0 |
| 18.3.2 | `kubectl -n team-mobile scale deployment push-service --replicas=2` | Externally scaled to 2 |
| 18.3.3 | If enforcement enabled, enforce-sleep re-scales to 0 | Snapshot: `wasExternallyScaled=true` |
| 18.3.4 | Eventually wake | push-service restored to original (4), not to the external value (2) |

### 18.4 Double Sleep (Idempotency)

| # | Step | Expected Result |
|---|------|-----------------|
| 18.4.1 | Sleep a policy (apply mode) | Snapshots created |
| 18.4.2 | Somehow trigger sleep again (e.g., via exception action) | Already-snapshotted workloads skipped. No duplicate snapshots |

### 18.5 New Deployment Added During Sleep

| # | Step | Expected Result |
|---|------|-----------------|
| 18.5.1 | Sleep `team-infra` | 8 deployments at 0 |
| 18.5.2 | `kubectl -n team-infra create deployment new-svc --image=registry.k8s.io/pause:3.10 --replicas=3` | New deployment created during sleep window |
| 18.5.3 | If enforce-sleep runs, it has no snapshot for `new-svc` | New deployment not enforced (no snapshot = not managed) |
| 18.5.4 | Wake fires | Only original 8 deployments restored. `new-svc` untouched at 3 |

---

## 19. Node Drain

### 19.1 Drain on Sleep

| # | Step | Expected Result |
|---|------|-----------------|
| 19.1.1 | Create policy with node drain enabled (if applicable in policy config) | Policy configured |
| 19.1.2 | Trigger sleep (apply mode) | Workloads scale to 0. Worker nodes cordoned |
| 19.1.3 | `kubectl get nodes` | `local-cluster-m02` and `local-cluster-m03` show `SchedulingDisabled` |
| 19.1.4 | Trigger wake | Workloads restored. Nodes uncordoned |
| 19.1.5 | `kubectl get nodes` | All nodes `Ready` (no `SchedulingDisabled`) |

### 19.2 Drain in Plan Mode

| # | Step | Expected Result |
|---|------|-----------------|
| 19.2.1 | Trigger sleep in plan mode on a drain-enabled policy | Logs say "Would cordon node X" |
| 19.2.2 | `kubectl get nodes` | Nodes NOT cordoned (plan mode is dry-run) |

### 19.3 Drain Count

| # | Step | Expected Result |
|---|------|-----------------|
| 19.3.1 | After drain-enabled sleep execution | `countDrained` = 2 (worker nodes) |
| 19.3.2 | Control plane node NOT drained | `local-cluster` stays schedulable |

---

## 20. Execution Logs & WebSocket Streaming

### 20.1 Log Retrieval

| # | Step | Expected Result |
|---|------|-----------------|
| 20.1.1 | After a completed execution, `GET /api/policy-executions/{id}/logs` | Returns array of `PolicyLogLine` objects |
| 20.1.2 | Verify log structure: `seq`, `level`, `message`, `timestamp` | All fields present |
| 20.1.3 | Verify ordering: `seq` is monotonically increasing | Logs in correct order |
| 20.1.4 | Verify levels: `info`, `ok`, `plan`, `error`, `warn` used appropriately | Level matches content |

### 20.2 WebSocket Live Streaming

| # | Step | Expected Result |
|---|------|-----------------|
| 20.2.1 | Trigger sleep on a large policy (many deployments) | Execution starts |
| 20.2.2 | Open policy detail page, select the running execution | Log viewer connects via WebSocket |
| 20.2.3 | Observe logs streaming in real-time | New lines appear as scaling progresses |
| 20.2.4 | Execution completes | WebSocket closes. Final log state matches REST API response |

### 20.3 Log Truncation

| # | Step | Expected Result |
|---|------|-----------------|
| 20.3.1 | Execute against 72 deployments multiple times | Logs accumulate |
| 20.3.2 | Verify max 5000 log lines retained per execution | Older lines not returned beyond limit |

---

## 21. Workload Snapshots

### 21.1 Snapshot Creation

| # | Step | Expected Result |
|---|------|-----------------|
| 21.1.1 | Sleep `team-backend` (apply mode, 8 deployments) | 8 snapshots created |
| 21.1.2 | `GET /api/policies/{id}/snapshots?open=true` | Returns 8 open snapshots |
| 21.1.3 | Each snapshot has: `kind`, `namespace`, `name`, `replicasBefore`, `sleepExecutionId` | Fields populated correctly |
| 21.1.4 | `wakeExecutionId` is null | Not yet woken |

### 21.2 Snapshot Closure

| # | Step | Expected Result |
|---|------|-----------------|
| 21.2.1 | Wake the policy | Snapshots closed |
| 21.2.2 | `GET /api/policies/{id}/snapshots?open=true` | Returns empty array |
| 21.2.3 | `GET /api/policies/{id}/snapshots` (all) | Returns 8 snapshots with `wakeExecutionId` set, `replicasRestored` populated |

### 21.3 Snapshot Edge Cases

| # | Step | Expected Result |
|---|------|-----------------|
| 21.3.1 | Snapshot for `wasAlreadyZero=true` workload | `replicasBefore=0`, not restored on wake |
| 21.3.2 | Snapshot for deleted workload | `wasDeletedAtWake=true`, `replicasRestored=null` |
| 21.3.3 | Snapshot for externally scaled workload | `wasExternallyScaled=true`, restored to `replicasBefore` (not external value) |

### 21.4 Snapshot via Execution

| # | Step | Expected Result |
|---|------|-----------------|
| 21.4.1 | `GET /api/policy-executions/{sleepExecId}/snapshots` | Returns snapshots created by that specific execution |
| 21.4.2 | Verify `sleepExecutionId` matches the queried execution | Correct association |

---

## 22. Policy Delete Cascade

| # | Step | Expected Result |
|---|------|-----------------|
| 22.1 | Create policy, trigger sleep, create exception, trigger wake | Policy has executions, snapshots, logs, exceptions |
| 22.2 | Delete the policy | Policy gone |
| 22.3 | `GET /api/policies/{id}` | 404 |
| 22.4 | `GET /api/policy-executions?policy_id={id}` | Returns empty (or 0 items) |
| 22.5 | Verify no orphaned snapshots in DB | Cascading delete cleaned everything |
| 22.6 | Verify no orphaned exceptions | All related exceptions deleted |

---

## 23. Scheduler Recovery on Restart

### 23.1 Restart Mid-Sleep

| # | Step | Expected Result |
|---|------|-----------------|
| 23.1.1 | Sleep policy (apply mode), verify workloads at 0 | Sleeping |
| 23.1.2 | Restart kube-phoenix pod: `kubectl -n kube-phoenix rollout restart deployment kube-phoenix` | Pod restarts |
| 23.1.3 | After restart, scheduler calls `RecoverPolicies()` | Policy re-evaluated |
| 23.1.4 | If still in sleep window, state remains `sleeping` | No unnecessary wake |
| 23.1.5 | If now outside sleep window, recovery wake fires | Trigger=`recovery`, workloads restored |

### 23.2 Restart During Transition

| # | Step | Expected Result |
|---|------|-----------------|
| 23.2.1 | Trigger sleep on a large policy (72 deployments) | Execution running |
| 23.2.2 | Kill the pod mid-execution | Execution interrupted |
| 23.2.3 | `ResetStuckTransitionPolicies()` runs on startup | Stuck policies reset to `unknown` |
| 23.2.4 | Scheduler re-evaluates, fires recovery execution | Correct state restored |

### 23.3 Restart with Active Exception

| # | Step | Expected Result |
|---|------|-----------------|
| 23.3.1 | Active stay_awake exception during sleep window | Policy awake via exception |
| 23.3.2 | Restart kube-phoenix | Recovery checks exceptions |
| 23.3.3 | Exception still active → intended state = awake | No unnecessary sleep |

---

## 24. Frontend — Policies List

| # | Step | Expected Result |
|---|------|-----------------|
| 24.1 | Navigate to `/policies` | Page loads with all policies displayed as cards |
| 24.2 | Each card shows: name, mode badge, enabled state, current state (LED), next transition countdown | All data visible |
| 24.3 | Disabled policy has reduced opacity | Visual distinction |
| 24.4 | Cards show correct state colors: green (awake), purple/blue (sleeping), yellow (transitioning) | Color coding correct |
| 24.5 | Page auto-refetches every 30s | State changes appear without manual refresh |
| 24.6 | Click a policy card → navigates to detail page | Routing works |

---

## 25. Frontend — Policy Detail

| # | Step | Expected Result |
|---|------|-----------------|
| 25.1 | Navigate to `/policies/detail?id={id}` | Detail page loads |
| 25.2 | Policy metadata section: name, description, mode, timezone, namespace filter, label selector | All fields displayed |
| 25.3 | Weekly timeline visualization shows sleep windows | Windows rendered correctly across 7-day grid |
| 25.4 | Exception overlays visible on timeline | Active/pending exceptions shown |
| 25.5 | Execution history table loaded | Shows recent executions with direction, status, trigger, counts |
| 25.6 | Click execution row → log viewer populates | Logs for that execution displayed |
| 25.7 | Exceptions section: lists all exceptions with status badges | Pending/active/completed/cancelled shown |
| 25.8 | Navigate with `?exec={id}` query param | That execution pre-selected and logs shown |

---

## 26. Frontend — Create / Edit Dialog

### 27.1 Create

| # | Step | Expected Result |
|---|------|-----------------|
| 26.1.1 | Open create dialog | Default values: mode=plan, timezone=user default, enabled=on |
| 26.1.2 | Submit without name | Validation error: name required |
| 26.1.3 | Submit without sleep windows | Validation error: at least 1 window required |
| 26.1.4 | Add window via WindowPicker: select days, set times | Window appears in preview |
| 26.1.5 | Toggle allDay | startTime/endTime pickers hidden |
| 26.1.6 | Add 10 windows | Max reached — add button disabled |
| 26.1.7 | Add 11th window | Not allowed (max 10) |
| 26.1.8 | Fill all fields, submit | Policy created, dialog closes, list refreshes, success toast |

### 27.2 Edit

| # | Step | Expected Result |
|---|------|-----------------|
| 26.2.1 | Click edit on existing policy | Dialog opens pre-filled with current values |
| 26.2.2 | Change name | Name updates on save |
| 26.2.3 | Change mode plan → apply | Overlap check runs. If conflict, error shown |
| 26.2.4 | Remove all windows | Validation error: at least 1 required |
| 26.2.5 | Save changes | Policy updated, dialog closes, detail refreshes |

---

## 27. Frontend — Exception Dialog

| # | Step | Expected Result |
|---|------|-----------------|
| 27.1 | Open "Add Exception" | Dialog with type, start/end datetime pickers, optional fields |
| 27.2 | Select type: stay_awake | Type set |
| 27.3 | Set start before end | Accepted |
| 27.4 | Set start after end | Validation error |
| 27.5 | Fill ticket ref: `JIRA-456` | Optional field accepted |
| 27.6 | Fill reason: `Emergency maintenance` | Optional field accepted |
| 27.7 | Toggle sleepOnEnd off | Checkbox unchecked |
| 27.8 | Submit | Exception created, exceptions section refreshes |
| 27.9 | Edit a pending exception | Dialog opens pre-filled, can modify |
| 27.10 | Delete a pending exception | Confirmation, then removed |
| 27.11 | Cancel an active exception | Cancel button, confirmation, status → cancelled |

---

## 28. Frontend — Trigger Mode Override

| # | Step | Expected Result |
|---|------|-----------------|
| 28.1 | Click Sleep on an awake policy | TriggerModeDialog opens |
| 28.2 | Shows options: use policy default, plan, apply | All options visible |
| 28.3 | Select "plan" override on an apply-mode policy | Confirms dry-run intent |
| 28.4 | Confirm | Execution fires with overridden mode. Redirects to execution logs |
| 28.5 | Cancel the dialog | No execution triggered |

---

## 29. Frontend — Execution History & Log Viewer

### 30.1 Execution Table

| # | Step | Expected Result |
|---|------|-----------------|
| 29.1.1 | View execution history on policy detail | Table with columns: date, direction, status, trigger, mode, counts |
| 29.1.2 | Status badges: running (yellow), success (green), failed (red), interrupted (orange) | Color coded |
| 29.1.3 | Direction: sleep (moon icon) / wake (sun icon) | Visual indicators |
| 29.1.4 | Paginate through >20 executions | Pagination controls work |

### 30.2 Log Viewer

| # | Step | Expected Result |
|---|------|-----------------|
| 29.2.1 | Select a completed execution | Logs load via REST |
| 29.2.2 | Log lines color-coded by level: info (gray), ok (green), plan (blue), error (red), warn (yellow) | Colors match levels |
| 29.2.3 | Select a running execution | WebSocket connects, logs stream in real-time |
| 29.2.4 | Execution completes while watching | Stream ends, final state consistent |
| 29.2.5 | Scroll through long log output | Smooth scrolling, no truncation in viewer |

---

## 30. API Validation & Error Responses

### 31.1 Field Validation

| # | Input | Expected |
|---|-------|----------|
| 30.1.1 | name: "" (empty) | 400: name required |
| 30.1.2 | name: 256 chars | 400: max 255 characters |
| 30.1.3 | description: 1025 chars | 400: max 1024 characters |
| 30.1.4 | labelSelector: 4097 chars | 400: max 4096 characters |
| 30.1.5 | labelSelector: `!!invalid` | 400: invalid label selector |
| 30.1.6 | namespaceFilter: `UPPERCASE` | 400: must match RFC 1123 |
| 30.1.7 | namespaceFilter: `a-name-longer-than-63-characters-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` | 400: max 63 chars per name |
| 30.1.8 | timezone: `Fake/Zone` | 400: invalid timezone |
| 30.1.9 | mode: `destroy` | 400: must be plan or apply |
| 30.1.10 | timeoutMinutes: -1 | 400: 0-1440 range |
| 30.1.11 | timeoutMinutes: 1441 | 400: exceeds max |
| 30.1.12 | sleepWindows: [] (empty) | 400: at least 1 window |
| 30.1.13 | sleepWindows: 11 windows | 400: max 10 windows |
| 30.1.14 | window daysOfWeek: [7] | 400: values must be 0-6 |
| 30.1.15 | window daysOfWeek: [1,1] | 400: duplicate day |
| 30.1.16 | window startTime: `25:00` | 400: invalid time format |
| 30.1.17 | window startTime == endTime (not allDay) | 400: start and end must differ |

### 31.2 Not Found

| # | Input | Expected |
|---|-------|----------|
| 30.2.1 | `GET /api/policies/999999` | 404 |
| 30.2.2 | `POST /api/policies/999999/sleep` | 404 |
| 30.2.3 | `GET /api/policy-executions/999999` | 404 |

### 31.3 Conflict

| # | Input | Expected |
|---|-------|----------|
| 30.3.1 | Create overlapping apply-mode policy | 409: overlap |
| 30.3.2 | Trigger sleep while transitioning | 409: already executing |
| 30.3.3 | Edit non-pending exception | 409: only pending editable |
| 30.3.4 | Create overlapping opposite-type exception | 409: exception overlap |

---

## 31. Load & Scale

### 32.1 Large Execution (All Namespaces)

| # | Step | Expected Result |
|---|------|-----------------|
| 31.1.1 | Create apply-mode policy with no namespace filter | Targets all 72 deployments, 240 pods |
| 31.1.2 | Trigger sleep | All 240 pods scale to 0. Execution completes within timeout |
| 31.1.3 | Verify `countScaled` = 72 | All deployments processed |
| 31.1.4 | Verify 72 snapshots created | One per deployment |
| 31.1.5 | Trigger wake | All 240 pods restored |
| 31.1.6 | Verify `countScaled` = 72 on wake | All restored |

### 32.2 Multiple Concurrent Policies

| # | Step | Expected Result |
|---|------|-----------------|
| 31.2.1 | Create 5 apply-mode policies, each targeting a different namespace | No overlap |
| 31.2.2 | Configure windows so all transition at the same time | Scheduler evaluates all 5 in same tick |
| 31.2.3 | Wait for scheduled transition | All 5 execute concurrently (separate goroutines) |
| 31.2.4 | All 5 succeed | No race conditions, no missed transitions |

### 32.3 Rapid Manual Triggers

| # | Step | Expected Result |
|---|------|-----------------|
| 31.3.1 | Sleep policy A, immediately wake, immediately sleep | Each trigger waits for previous to complete or returns 409 |
| 31.3.2 | No double-scaling or lost snapshots | State machine integrity maintained |

### 32.4 Many Exceptions

| # | Step | Expected Result |
|---|------|-----------------|
| 31.4.1 | Create 10 scheduled exceptions on a single policy (non-overlapping, same type) | All created |
| 31.4.2 | Each activates and completes in sequence | State transitions correct throughout |

---

## Namespace / Deployment Reference

Quick reference for available test targets:

| Namespace | Deployments | Pods |
|-----------|------------|------|
| team-backend | api(5), worker(5), cron(3), gateway(5), auth(4), notifications(3), cache(3), search(2) | 30 |
| team-web | web(5), bff(4), assets(3), ssr(4), cdn-origin(3), analytics(3), preview(3) | 25 |
| team-data | pipeline(5), scheduler(3), dashboard(3), etl(4), warehouse(3), spark-driver(2), spark-worker(5), airflow(3), metabase(2) | 30 |
| team-qa | test-runner(5), selenium(4), mock-api(3), cypress(4), load-test(3), coverage(3), report(3) | 25 |
| team-platform | consul(4), vault(3), prometheus(3), grafana(2), alertmanager(2), loki(3), tempo(3), otel-collector(4), cert-manager(3), ingress(3) | 30 |
| team-ml | model-serve(5), trainer(3), feature-store(3), notebook(4), labeling(3), inference(4), vector-db(3) | 25 |
| team-mobile | push-service(4), media-api(3), chat-service(4), sync(3), deeplink(3), config-server(3), ab-testing(3), crash-report(2) | 25 |
| team-payments | ledger(4), processor(3), fraud(3), invoicing(3), webhook(4), reconciler(3), pci-proxy(3), audit(2) | 25 |
| team-infra | dns(3), ntp(2), log-shipper(4), backup(3), registry(3), artifact(3), scanner(4), policy-agent(3) | 25 |
| **Total** | **72 deployments** | **240** |
