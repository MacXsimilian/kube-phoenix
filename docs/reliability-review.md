# Reliability verification and fixes

Reviewed branch: `master`. Initial full commit: `eac56428b6c3248e33ccdc3de5c0f3818cbcff42`.
The checkout happened to match the historical reference; it was not reset. Initial user changes were `frontend/next-env.d.ts` and untracked `frontend/AGENTS.md`; they remain outside the commits. No root AGENTS.md was present. Architecture, backend development, execution/data-flow, testing, CI, and frontend guidance were inspected.

## Subsequent drain behavior decision

The requested original force-delete fallback is restored. Eviction is attempted first; any eviction error other than an already-removed pod leads to an immediate zero-grace deletion attempt, subject to cancellation, ownership and pod UID checks. This deliberately favors shutdown completion over PDB availability and graceful termination. The default chart permissions are unchanged, so the fallback can still be forbidden unless pod deletion is authorized separately. Failed fallback attempts remain visible and trigger owned-cordon recovery. The earlier eviction-only change below is historical and superseded by this decision.

Validation of the restored fallback: `go test -race ./internal/k8s ./internal/scaler` and `go vet ./internal/k8s` both pass using the local Go toolchain. Kubernetes behavior is covered with fake clients; no real cluster was used.

## Findings and evidence

“Reproduced” below identifies the actual test level. No production cluster was contacted and no Kubernetes rollout or real PDB rejection was reproduced.

| Issue | Disposition | Current evidence | Reproduction / verification | Fix or decision |
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
```

## Changes and migration

- `k8s/identity.go`, scaler workload entries, snapshot model/query methods: durable replica intent, UID/version mutation preconditions, restoration conflict handling, accurate partial results.
- `k8s/client.go`, `k8s/cordon.go`, scaler node operations and chart ClusterRole: eviction-first draining with the restored zero-grace deletion fallback, explicit failure results, cordon ownership and recovery.
- `store/ownership.go`, server startup/shutdown, scheduler stale-transition checks and Helm values/schema/helpers: one database owner throughout recovery and execution, Recreate upgrades.
- Shared target matching in `store/targeting.go`; API create/update/import, scaler sleep/wake/reconciliation and scheduler startup/evaluation: consistent exception scope and baseline scheduling.
- Health handlers, probe values and OpenAPI: independent liveness and bounded readiness.
- Focused unit, fake-client, scheduler, real PostgreSQL and chart tests; CI invokes existing frontend regressions and all chart tests. Architecture and execution documentation describe the resulting contract.
- Snapshot columns `workload_uid varchar(128) DEFAULT ''` and `phase varchar(20) DEFAULT ''` are additive AutoMigrate changes. `backend/migrations/20261008_snapshot_intents.sql` provides the same idempotent additions for `AUTO_MIGRATE=false`. Historical migrations and existing recovery rows are not rewritten.

## Commands and actual results

Tool paths used:

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
2. Inspect open legacy nonzero snapshots before upgrading. They deliberately fail automatic restoration without an original UID. Verify the workload identity and baseline through operator evidence before an explicit manual recovery; do not populate guessed UIDs or discard open records.
3. Stop all old scheduler processes for the first upgrade: older binaries do not participate in the new lock. Use `strategy.type=Recreate`, remove old `strategy.rollingUpdate` overrides, and use replicas 1 (or 0 during maintenance). Expect brief application downtime. Helm reuse-values may retain incompatible old overrides and will now fail validation.
4. Allow at least two DB connections because ownership reserves one. Use a direct PostgreSQL connection or session pooling; transaction-pooling proxies do not preserve the session advisory-lock contract. Losing that dedicated session intentionally stops the process even though liveness itself is independent of ordinary readiness failures.
5. Apply the corrected core eviction permission. The restored force-delete fallback requires separate `delete` authorization on core `pods`; the default chart does not grant it. Direct deletion intentionally bypasses PDBs and graceful termination. External systems that take over an owned cordon must remove/replace the ownership marker so cleanup will not undo their intent.
6. Scoped filters now narrow by intersection. An exception outside its parent scope matches nothing; invalid syntax/kinds/names are rejected. Ordinary policy wake still restores snapshots after label changes. The policy state describes baseline schedule progress; scoped workload states can differ.
7. Node actions remain destructive and cluster-wide for ordinary policy sleep. Keep node protections and external autoscaler capacity configured. Scoped exception executions and incomplete workload prerequisites defer node actions.
8. Database ownership is a singleton safeguard, not a distributed fencing protocol or HA implementation. A request already accepted by Kubernetes can finish after process/session loss. UID/version preconditions prevent stale workload patches; they do not make all PostgreSQL/Kubernetes side effects transactional. Database loss, concurrent external actors, and conflicting overlapping parent policies still require operational care.
9. Credential hardening proposal: add an explicit production installation mode in a separate compatibility change, requiring an operator-managed application secret and independently managed database credentials; retain demo credentials only behind an explicit development opt-in. Upgrades must preserve existing secret values and never generate replacement passwords automatically. Current `secret.existingSecret` support is verified; no installed credentials were changed here.

Passing unit, fake-client and PostgreSQL tests does not establish production readiness. A disposable real Kubernetes validation of eviction/force-delete behavior, RBAC, node deletion failure and upgrade shutdown remains recommended before deployment.
