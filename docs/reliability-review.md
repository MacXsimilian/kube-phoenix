# Reliability verification and fixes

Initial review branch: `master`. Initial full commit: `eac56428b6c3248e33ccdc3de5c0f3818cbcff42`.
The checkout happened to match the historical reference; it was not reset. Initial user changes were `frontend/next-env.d.ts` and untracked `frontend/AGENTS.md`; they remain outside the commits. No root AGENTS.md was present. Architecture, backend development, execution/data-flow, testing, CI, and frontend guidance were inspected.

This is a historical review and validation record. The current-contract summary below reflects branch changes through `5c70b60` on 2026-10-09. Commands and test counts later in the document describe their original runs; they are not a new validation run of the final branch.

## Current branch contract

| Area | Current behavior |
|---|---|
| Sleep/wake recovery | Persist `prepared` intent before scaling, mark applied sleep, and retain the original replica baseline across retries. Sleep, wake, and corrective sleep follow kind/namespace/name. Saved UID metadata does not block legacy or same-name replacement recovery. Scale conflicts use bounded GetScale/UpdateScale retries. |
| Partial failures and repeat sleep | Any operation error fails the execution and leaves retryable recovery work. Workload failures, unresolved prepared intents outside the selection, or exception protection defer nodes. An ordinary sleep can reapply zero using an existing open snapshot; the historical recommendation to skip applied/legacy snapshots was not implemented. |
| Exceptions | Namespace, label, and explicit workload filters intersect the parent scope. Scoped actions reconcile separately and preserve baseline policy state on success; they do not suppress other workloads' normal wake or perform node actions. Unscoped force-sleep retains precedence over stay-awake. |
| Draining | Attempt eviction, then zero-grace pod deletion on errors other than not-found, with ownership/cancellation and pod UID checks. The fallback bypasses PDBs and graceful termination but requires separate core pod-delete permission, absent from the default chart. Failed drain/deletion and startup cleanup recover only owned cordons. |
| Ownership and startup | Require one database owner for recovery and process lifetime, one application replica, Recreate updates, at least two DB connections, and direct/session-preserving PostgreSQL access. Ownership-session loss exits. Kubernetes client construction may fail without preventing HTTP startup; owned-cordon recovery failure after successful client construction prevents startup. |
| Health | `/livez` checks the serving process; `/readyz` and compatibility `/healthz` check the database with a two-second deadline. Dedicated ownership-session loss can still terminate the process. |

Current source: [workload operations](../backend/internal/scaler/workloads.go), [scale retries](../backend/internal/k8s/operations.go), [draining](../backend/internal/k8s/nodes.go), [exception targeting](../backend/internal/scaler/targeting.go), [scheduler](../backend/internal/scheduler/policy_scheduler.go), [execution finalization](../backend/internal/scheduler/execution.go), [ownership](../backend/internal/store/ownership.go), and [snapshot queries](../backend/internal/store/snapshots.go). The later readability refactor split these responsibilities out of the older file locations cited in the historical findings.

## Subsequent workload identity decision

The added workload UID/resource-version safeguard is removed by request. Sleep, wake and corrective sleep again identify workloads by kind/namespace/name, including same-name replacements and legacy snapshots without a UID. Scaling uses the original GetScale/UpdateScale path with bounded conflict retries rather than a conditional JSON patch pinned to the earlier observation. Kubernetes normal update conflict handling remains in place.

Durable prepared/applied snapshots and scheduler ownership checks remain. The additive UID column is retained as informational metadata so existing records and migrations are not destructively rewritten. Pod-deletion preconditions and cordon ownership are separate drain protections and are unchanged. Earlier descriptions of blocked legacy recovery and workload identity enforcement below are superseded by this decision.

Validation: `go test -p=1 ./...`, `go test -race -p=1 ./internal/scaler ./internal/k8s`, `go vet ./internal/scaler ./internal/k8s`, and `git diff --check` pass. New fake-client regressions cover Deployment/StatefulSet sleep, wake and corrective sleep with legacy/replacement snapshots, plus conflict retries after an older observation. Database integration tests skip without a disposable DSN; no real cluster was used.

## Compatibility audit and recommendation

A follow-up audit compared every changed area against the original implementation, commit messages, tests, and documentation. Several initial findings below incorrectly classified deliberate behavior as defects. A test written to expect different behavior establishes a difference; it does not establish that the original behavior was wrong. This section supersedes those classifications.

The audit recommended preserving documented product behavior and repairing failures within that contract: best-effort shutdown, the double-sleep guard, exception precedence, and the original rollout objective. Force-delete fallback and name-based workload scaling with conflict retries were subsequently restored. The other recommendations below remain historical proposals, not the current contract; the summary above records what the branch actually implements.

### Historical restoration recommendations

| Area | Original evidence | Recommendation |
|---|---|---|
| Partial execution results | `554980d` explicitly introduced failure only when `Errors > 0 && Scaled == 0`, for sleep and wake. `f643fa1` used the same threshold for enforce-sleep. The backend guide documented it. | Restore the threshold; preserve individual error counts and logs. Returning failure on every partial error changes status and retry behavior. A new partial-success status would be a separate product decision. |
| Node phase after workload errors | The original sleep pipeline attempted node operations after workloads, including failures. `554980d` placed total-failure detection after that phase. | Restore best-effort continuation with cancellation and existing node protections. A failed drain must still prevent deletion of that node; workload scale failures and node drain failures are distinct. |
| Ordinary repeat sleep | `e860b36` introduced a double-sleep guard. The original policy-engine guide says existing open snapshots skip ordinary sleep and retain the baseline. `f643fa1` introduced separate configurable Enforce Sleep. | Skip completed and legacy open snapshots during ordinary sleep; retry new `prepared` intents using their original baseline. Reapplying completed snapshots bypasses the Enforce Sleep choice. |
| Scoped exception precedence | `554980d` integrated exceptions into policy-level intent to stop normal ticks reversing them. `beaeaed` retained scoped exceptions in this model, including the test `scoped exception still holds policy-level state`. Original documentation explains the same reason. | Restore policy-level precedence/state. Independent baseline/scoped scheduling is a product redesign, not a demonstrated defect fix. |
| Exception filter replacement | `beaeaed` explicitly makes supplied exception filters override runtime policy scope without changing the saved policy. Wake is also limited to snapshots owned by that policy. | Restore runtime replacement of supplied namespace/label filters. Keep exact target matching and owned wake snapshots. Universal parent-selector intersection is a new restriction. |
| Node phase for scoped actions | Scoped sleeps inherited the ordinary pipeline. The original guide says namespace filters do not scope node deletion; no exception-specific exemption was found. | Preserve cluster-wide protected-node selection. Suppression for all scoped sleeps changes behavior; a separate rationale for this particular original edge case was not found. |
| Kubernetes conflict retries | `1955e3c` deliberately introduced bounded conflict retries with 500 ms / 1.5 s / 3 s backoff for scaling and cordoning. New conditional scale/owned-cordon paths bypass those helpers. | Restore retries while retaining identity/version checks. Re-read and validate identity, scope and the replica baseline before retrying; blindly replacing the resource version is insufficient. |
| Rolling deployments | `4ab2389` added RollingUpdate. Original values promise zero-downtime rollouts with `maxUnavailable: 0`; `298eba7` preserves graceful shutdown during rolling updates. | Preserve this objective with safe scheduler ownership handoff. Merely reverting the chart while keeping startup-fatal lock contention would stall rollout: the new pod cannot become ready while the old owner remains. Mandatory Recreate is a compatibility change. |

### Reliability changes to retain

| Area | Historical evidence and decision |
|---|---|
| Durable snapshot intents | `012246d` moved snapshot persistence after scaling to prevent orphan records **while annotation recovery existed**. `720900f` later removed that recovery and made PostgreSQL the sole restoration source. Keep durable `prepared` / `applied` phases: the old ordering lost its recovery prerequisite, and phases explicitly represent incomplete work. Preserve the original replica baseline across retries. |
| Persistence errors | No evidence makes lost restoration data a desired outcome. Keep required snapshot reads/writes/closure errors visible and recoverable. Whether a mixed execution returns success is the separate best-effort contract above. |
| Explicit targets and label-scoped wake | The model/UI already promised workload targeting; test catalogue §10.2 expected only matching workloads to wake. Keep exact targets, label filtering, input validation and clearing target lists. Ordinary full wake must still restore owned snapshots after labels change. |
| Scoped recovery/corrective sleep | Startup should preserve an exception action's scope even with policy-level intended state restored. `f643fa1` intended corrective sleep to respect stay-awake protection; exact labels/targets complete that intent. |
| Owned cordons and eviction RBAC | No rationale was found for abandoning cordons after failed operations. Keep cleanup limited to matching ownership markers and the corrected eviction permission. `f120b63` established that failed/timed-out drains must prevent deletion of that node. |
| Scheduler ownership | Original architecture/deployment docs support one application replica. Preventing overlapping startup recovery and mutations supports that contract, but new rollout/DB requirements need compatibility treatment below. |
| Health and CI | No evidence was found that database-dependent liveness was an intentional restart policy. Keep separate liveness/readiness and compatibility `/healthz`. Keep frontend/chart regression coverage; it changes verification, not functionality. |

### Additional compatibility concerns

- **Legacy snapshots (superseded):** the audit objected to blocking nonzero records without a UID and proposed a legacy recovery path while retaining UID checks for new records. The subsequent workload identity decision instead restored name-based recovery for both new and legacy snapshots, including replacements.
- **DB requirements:** reserving one connection, requiring at least two pooled connections, requiring session-preserving access, and exiting on ownership-session loss are new constraints. `9c4a4d6` deliberately exposed pool tuning. Keep scheduler exclusion without describing these requirements as unchanged behavior. Enforcing the documented one-replica limit is distinct from removing rolling updates.
- **Startup cleanup:** failure to list/recover cordons now stops startup, whereas earlier Kubernetes initialization could warn and allow the API to start. Cleanup should retry under valid ownership without a transient cleanup failure alone preventing the UI/API from serving.
- **Intent within an execution:** `012246d` rejected mid-execution override rechecks to avoid half-finished operations. Those overrides were later removed, so this is not conclusive evidence about exceptions. Nevertheless, new per-workload exception queries deserve review; prefer a consistent exception view per execution while retaining cancellation and identity checks.

Already-zero ownership, ordinary wake replica restoration, missing-workload handling, reliance on an external autoscaler, default credentials, and global operator permissions were also checked; their original behavior was retained. Initial test results below remain evidence of what ran, not proof that disputed product decisions were correct.

Audit validation: historical source/commit review, coverage cross-check against all 41 changed files, and `git diff --check`. This follow-up changes documentation only; no new runtime test pass or functional restoration is claimed.

## Subsequent drain behavior decision

The requested original force-delete fallback is restored. Eviction is attempted first; any eviction error other than an already-removed pod leads to an immediate zero-grace deletion attempt, subject to cancellation, ownership and pod UID checks. This deliberately favors shutdown completion over PDB availability and graceful termination. The default chart permissions are unchanged, so the fallback can still be forbidden unless pod deletion is authorized separately. Failed fallback attempts remain visible and trigger owned-cordon recovery. The earlier eviction-only change below is historical and superseded by this decision.

Validation of the restored fallback: `go test -race ./internal/k8s ./internal/scaler` and `go vet ./internal/k8s` both pass using the local Go toolchain. Kubernetes behavior is covered with fake clients; no real cluster was used.

## Initial findings and evidence

These are the initial review's dispositions and implementation evidence. Source line numbers refer to the review checkout before the readability refactor; `k8s/identity.go` and its conditional patch path were subsequently removed. The compatibility audit corrects classifications, while the current-contract summary records the final behavior. In particular, the UID enforcement described in rows 4B and 7 is historical and superseded. “Reproduced” below identifies the actual test level. No production cluster was contacted and no Kubernetes rollout or real PDB rejection was reproduced.

| Issue | Initial disposition | Historical evidence location | Reproduction / verification at review time | Initial fix or subsequent decision |
|---|---|---|---|---|
| 1. Recovery record after destructive scale | Confirmed defect | `backend/internal/scaler/policy_scaler.go:171`; `backend/internal/store/policies.go:341` | Original code failed `TestSleepPersistsBeforeMutation` and `TestSleepScaleFailureRetainsIntent`. Both now pass. Restart-before/after-mutation and applied-write failure cases also pass with a fake store. | Durable prepared intent before scaling; retain original UID and replicas on retry; reconcile live replicas; applied/restored phases; required persistence failures are errors; incomplete work defers nodes. |
| 2. Eviction permission, force deletion, cordons | RBAC and cordon recovery defects; force deletion is intentional shutdown behavior with conditional impact | `backend/internal/k8s/client.go:469`, `evictPods`; `backend/internal/k8s/cordon.go:14` | Original eviction-only regressions passed at review time; the restored contract is covered by zero-grace fallback and failed-fallback cordon-recovery tests. No real service-account/PDB integration. | Correct core eviction permission and owned-cordon recovery retained. Original force-delete fallback restored by explicit request, with its PDB and termination tradeoff documented in code. Default pod-delete permissions unchanged. |
| 3. Overlap and startup recovery ownership | Confirmed risky behavior with conditional impact | `backend/internal/store/ownership.go:21`; `backend/cmd/server/main.go:70` | Real disposable PostgreSQL test rejects a second owner, leaves the live execution untouched, terminates only the test lock session, then admits takeover and recovers interrupted records. No rolling-upgrade test. | Recreate deployment; reject replicas above one and autoscaling; preserve zero-replica maintenance. Dedicated advisory-lock session covers recovery and process lifetime. Mutation guards and watchdog fail closed on session loss. Existing per-policy claims remain. |
| 4A. Explicit targets ignored | Confirmed defect | `backend/internal/store/targeting.go:29`; `backend/internal/api/exceptions.go:355` | Source-confirmed original omission. `TestScopedSleepAndWake`, `TestExceptionTargetIntersection`, `TestExceptionAPIsValidateAndClearTargets` pass. | Carry execution-only scope, recognize explicit-only targets, validate create/update/import, intersect targets/namespaces/labels with parent scope. Empty update arrays can clear targets. |
| 4B. Label-scoped wake broadens restoration | Confirmed defect | `backend/internal/scaler/targeting.go:55`; `backend/internal/scaler/policy_scaler.go:327` | Fake-client test restores A only, leaves B asleep, preserves scope during corrective sleep, and verifies ordinary wake after label changes. | Scoped wake matches live labels and explicit targets; scope and UID are rechecked against the observed version used by the conditional mutation. Full wake follows stored ownership rather than current labels. |
| 5. Partial sleep recorded as success | Confirmed defect | `backend/internal/scaler/policy_scaler.go:222`; `backend/internal/scheduler/policy_scheduler.go:972` | Production runner with fake Kubernetes/store: one of two patches fails, counts remain available, nodes are not contacted, retry preserves both baselines, wake restores 3 and 5 replicas. Scheduler test records failed/unknown and verifies retry backoff. | Any operation error produces incomplete/failed execution. Prepared snapshots retain failed targets; failed initial persistence leaves policy retryable so selection runs again. Successful baselines are reused. |
| 6. Scoped exception suppresses unrelated normal wake | Confirmed defect after reproduction; global precedence remains intentional | `backend/internal/scheduler/policy_scheduler.go:572`; `backend/internal/scheduler/policy_scheduler.go:319` | `TestScopedExceptionDoesNotSuppressScheduledWake` failed against the original scheduler: B stayed asleep at 07:00. It now passes, including B staying asleep before 07:00. A separate restart test exposed and fixed startup broadening. These use real scheduler paths with a simulated workload runner and supplied tick times. | Evaluate baseline schedule for non-targets, apply scoped intent separately, preserve baseline state after successful scoped work, and retry scoped work independently. Failed scope completion remains retryable. Unscoped force-sleep precedence remains unchanged. |
| 7. Replacement workload restoration | Confirmed risky behavior with conditional impact | `backend/internal/k8s/identity.go:14`; `backend/internal/store/models.go:164` | Fake Kubernetes tests cover same UID, replacement UID, changed resource version at the patch boundary, and missing legacy UID. Real PostgreSQL upgrade test preserves an existing open snapshot and replica baseline. | Persist UID. Atomic JSON Patch tests UID and resourceVersion before changing replicas. Conflicts retain the snapshot. Legacy nonzero snapshots require operator review; no invented identity. |
| 8A. Dependency-dependent liveness | Confirmed availability defect | `backend/internal/api/health.go:11` | `TestLivenessSurvivesDatabaseOutage` returns 200 from livez and 503 from readyz/healthz; rendered probes verified. | `/livez` checks serving process; `/readyz` checks DB with a deadline; `/healthz` retains compatibility. Loss of the dedicated ownership session still intentionally exits for mutation safety. |
| 8B. Example credentials | Confirmed risky behavior with conditional impact; development defaults are documented | `helm/kube-phoenix/values.yaml:55`; `helm/kube-phoenix/values.yaml:97` | Existing-secret render test passes. No installed credentials inspected or rotated. No compromise established. | Defaults unchanged pending an explicit development/production installation contract. Concrete hardening proposal below. |
| 8C. Missing frontend regression CI | Confirmed coverage gap | `.github/workflows/ci.yml:45` | Scheduling: 12 tests pass. Observability + mock exceptions: 9 tests pass. Existing lint/typecheck/build also pass. | Add all three distinct focused commands to CI; include reliability chart tests in chart discovery. |
| 9. Cluster-wide node operations | Intentional/documented behavior | `backend/internal/scaler/nodes.go:64` | Existing node classification tests pass. | Ordinary policy node selection remains cluster-wide. Workload failures, unresolved intents and scoped/protected exception work can defer nodes. Namespace workload filters alone are still not node protection. |
| 9. Global operator permissions | Intentional implemented authorization model | `backend/internal/auth/permissions.go:4` | Existing backend authorization tests pass. | No new tenancy model or namespace isolation requirement was introduced. |

## Atomic implementation commits

```text
89dce1f fix(k8s): guard scaling with workload identity and version checks
770b214 fix(scaler): persist recoverable sleep intents before scale-down
6aea97a fix(k8s): respect eviction budgets and recover owned cordons
bdb6ced fix(scheduler): hold exclusive ownership through recovery and execution
e9279a9 fix(exceptions): enforce target boundaries through reconciliation
0612caf fix(health): separate process liveness from database readiness
e5eef8f ci: run frontend and rendered chart reliability regressions
bbb1544 test(exceptions): verify corrective scope across wake boundaries
5ccae06 fix(scheduler): preserve exception scope during startup recovery
8903fb3 fix(k8s): restore force-delete fallback for sleep drains
3ec922c fix(scaler): restore name-based workload recovery and retries
fc134bd test: clarify Go tests and strengthen regression coverage
6d5175a refactor: improve Go backend readability
c50f1f7 fix(docker): preserve build caches and gate releases on image smoke tests
5c70b60 fix(helm): correct discovery, disruption budgets and database configuration
```

## Changes and migration

- Scaler workload entries and snapshot model/query methods: durable replica intent and name-based restoration with bounded scale conflict retries. UID metadata remains informational. `k8s/mutation_guard.go` retains scheduler ownership checks.
- `k8s/nodes.go`, `k8s/cordon.go`, scaler node operations and chart ClusterRole: eviction-first draining with the restored zero-grace deletion fallback, explicit failure results, cordon ownership and recovery.
- `store/ownership.go`, server startup/shutdown, scheduler stale-transition checks and Helm values/schema/helpers: one database owner throughout recovery and execution, Recreate upgrades.
- Shared target matching in `store/targeting.go`; API create/update/import, scaler sleep/wake/reconciliation and scheduler startup/evaluation: consistent exception scope and baseline scheduling.
- Health handlers, probe values and OpenAPI: independent liveness and bounded readiness.
- Focused unit, fake-client, scheduler, real PostgreSQL and chart tests; CI invokes existing frontend regressions and all chart tests. Architecture and execution documentation describe the resulting contract.
- Snapshot columns `workload_uid varchar(128) DEFAULT ''` and `phase varchar(20) DEFAULT ''` are additive AutoMigrate changes. `backend/migrations/20261008_snapshot_intents.sql` provides the same idempotent additions for `AUTO_MIGRATE=false`. Historical migrations and existing recovery rows are not rewritten.
- Later chart corrections make ServiceMonitor selectors match the application service, preserve explicit zero disruption-budget settings, and align PostgreSQL credentials/database overrides with the application DSN. See [deployment](deployment.md) and [configuration](configuration.md) for current settings.
- Image smoke checks exercise startup, the binary's healthcheck, `/readyz`, embedded version metadata, and frontend HTML/JavaScript before releases. Their workflow wiring and build-cache behavior are described in [contributing](../CONTRIBUTING.md); these newer checks are not included in the historical command results below.

## Commands and actual results

Historical results from the initial review and its stated follow-ups follow. Later added/refined tests and final-branch CI should be assessed from their own runs; these counts have not been relabeled as current. Tool paths used:

- Go: `/home/macxsimilian/.local/share/kube-phoenix-toolchain/go/bin/go` (abbreviated `$GO` below).
- Node/npm directory added to PATH: `/home/macxsimilian/.local/share/kube-phoenix-toolchain/node-v26.11.1-linux-x64/bin`.
- Helm: `/tmp/kube-phoenix-helm` (also exposed as `helm` in `/tmp/kube-phoenix-validation-bin`).
- Final Go temporary storage: `GOTMPDIR=/home/macxsimilian/kube-phoenix/.reliability-validation/tmp`.
- Integration DSN: `TEST_DATABASE_URL='host=127.0.0.1 port=55439 user=postgres dbname=postgres sslmode=disable'`.

Backend commands ran from `backend/`; npm commands from `frontend/`; chart commands from the repository root.

| Command | Result |
|---|---|
| `$GO test ./internal/scaler -run 'TestSleep(Persists\|ScaleFailure)' -count=1` before the fix | FAIL as expected: mutation after failed persistence; missing intent after failed scale. |
| `$GO test ./internal/scheduler -run TestScopedExceptionDoesNotSuppressScheduledWake -count=1` with original scheduler temporarily restored | FAIL as expected: B asleep at 07:00. Edited scheduler restored immediately afterward. |
| `$GO test ./internal/scheduler -run TestStartupRecoveryKeepsExceptionScoped -count=1` before startup correction | FAIL as expected: startup woke both A and B. |
| `$GO test ./internal/scaler ./internal/k8s` | PASS after fixes. |
| `$GO test ./...` | PASS, including a run with the disposable PostgreSQL DSN. |
| `$GO test ./internal/store -run 'TestOwnership\|TestSnapshotMigration' -count=1` with disposable DSN | PASS against PostgreSQL. |
| `$GO test -race ./...` | Initial attempt failed during compilation because `/tmp` exhausted its 1.5 GB capacity; not a race-test pass. |
| `$GO test -race -p=1 ./...` with disk-backed GOTMPDIR and disposable DSN | PASS. |
| `$GO test -race ./internal/scaler ./internal/scheduler` with disk-backed GOTMPDIR | PASS after added corrective-scope assertions. |
| `$GO test -race ./internal/scheduler` | PASS after the startup correction. |
| `$GO vet ./...` | Initial parallel attempt failed on `/tmp` exhaustion. |
| `$GO vet -p=1 ./...` | PASS, including the final disk-backed run. |
| `npm run test:windows` | PASS: 12 tests. |
| `node --test tests/observability-history.test.mjs mock-api/tests/exceptions.test.mjs` | PASS: 9 tests. |
| `npm run lint` | PASS: zero errors, 42 warnings in unchanged frontend code. |
| `npm run typecheck` | PASS. |
| `npm run build` | PASS: production static export, 32 pages. |
| `/tmp/kube-phoenix-helm lint helm/kube-phoenix` | PASS; informational icon suggestion. |
| `/tmp/kube-phoenix-helm lint helm/kube-phoenix -f examples/values-{alb,ingress-tls,minimal,rds}.yaml` (one invocation per file) | All four PASS. |
| `PATH=/tmp/kube-phoenix-validation-bin:$PATH python3 -m unittest discover -s hack/tests -v` | PASS: 13 tests. Includes rendered defaults, RBAC, rejected ownership settings, probes, existing secrets and PostgreSQL storage maintenance. An initial overly strict probe assertion was corrected before this pass. |
| `git diff --check` | PASS. |
| `golangci-lint run` | NOT RUN: binary unavailable in the execution environment. `go vet` and compiler/test checks ran. |
| Real Kubernetes eviction/PDB/service-account and rolling-upgrade scenarios | NOT RUN: no explicitly disposable Kubernetes cluster provisioned. Fake-client coverage is not equivalent to these scenarios. |

The PostgreSQL test environment was created with:

```sh
/app/bin/host-spawn podman run --rm -d \
  --name kube-phoenix-reliability-test-20261008 \
  -p 127.0.0.1:55439:5432 -e POSTGRES_HOST_AUTH_METHOD=trust \
  docker.io/library/postgres:18-alpine
```

It contained only disposable test schemas and was stopped after validation. Integration tests skip explicitly without `TEST_DATABASE_URL`; point it only at a disposable database. They create and drop isolated schemas and terminate only their own advisory-lock backend during the takeover test.

## Upgrade and remaining decisions

1. Back up PostgreSQL and retain all open snapshots. Apply the additive migration before starting with `AUTO_MIGRATE=false`; otherwise normal AutoMigrate adds the fields.
2. Legacy snapshots remain eligible for name-based restoration without a UID. Same-name replacement workloads can receive the saved replica count, matching the original recovery contract. Preserve open records and replica baselines; no UID backfill is required.
3. Stop all old scheduler processes for the first upgrade: older binaries do not participate in the new lock. Use `strategy.type=Recreate`, remove old `strategy.rollingUpdate` overrides, and use replicas 1 (or 0 during maintenance). Expect brief application downtime. Helm reuse-values may retain incompatible old overrides and will now fail validation.
4. Allow at least two DB connections because ownership reserves one. Use a direct PostgreSQL connection or session pooling; transaction-pooling proxies do not preserve the session advisory-lock contract. Losing that dedicated session intentionally stops the process even though liveness itself is independent of ordinary readiness failures.
5. Apply the corrected core eviction permission. The restored force-delete fallback requires separate `delete` authorization on core `pods`; the default chart does not grant it. Direct deletion intentionally bypasses PDBs and graceful termination. External systems that take over an owned cordon must remove/replace the ownership marker so cleanup will not undo their intent.
6. Scoped filters now narrow by intersection. An exception outside its parent scope matches nothing; invalid syntax/kinds/names are rejected. Ordinary policy wake still restores snapshots after label changes. The policy state describes baseline schedule progress; scoped workload states can differ.
7. Node actions remain destructive and cluster-wide for ordinary policy sleep. Keep node protections and external autoscaler capacity configured. Scoped exception executions and incomplete workload prerequisites defer node actions.
8. Database ownership is a singleton safeguard, not a distributed fencing protocol or HA implementation. A request already accepted by Kubernetes can finish after process/session loss. Workload scaling follows names and normal Kubernetes conflict retries; PostgreSQL/Kubernetes side effects are not transactional. Database loss, concurrent external actors, and conflicting overlapping parent policies still require operational care.
9. Credential hardening proposal: add an explicit production installation mode in a separate compatibility change, requiring an operator-managed application secret and independently managed database credentials; retain demo credentials only behind an explicit development opt-in. Upgrades must preserve existing secret values and never generate replacement passwords automatically. Current `secret.existingSecret` support is verified; no installed credentials were changed here.

Passing unit, fake-client and PostgreSQL tests does not establish production readiness. A disposable real Kubernetes validation of eviction/force-delete behavior, RBAC, node deletion failure and upgrade shutdown remains recommended before deployment.
