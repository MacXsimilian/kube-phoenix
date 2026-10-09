# Window-Native Policy Scheduling

This guide describes the current evaluator and scheduler. For the operator workflow, start with [Your first policy](first-policy.md); for request fields, use the [configuration reference](configuration.md#policy-configuration) and [OpenAPI contract](../openapi.yaml). The final two sections describe legacy cron migration history, not an alternative scheduling mode.

## 1. Overview

A policy's sleep windows define when its matching workloads should sleep. The scheduler evaluates the current time in the policy's timezone, applies active-exception precedence, and compares the resulting intended state with the stored policy state. It does not replay a list of cron jobs.

The evaluation interval defaults to 30 seconds and is configurable through guardrails. A boundary makes a transition eligible for evaluation; it does not guarantee that scaling starts or finishes at that exact instant. Execution mode, enabled state, guardrails, API availability, ongoing executions, and retry delays affect the outcome.

Workload targeting and node protection are separate. A normal sleep execution scales matching Deployments/StatefulSets and then considers cluster-wide node drain/deletion. A namespace filter does not restrict that node phase. Scoped exception executions, protected opposite-exception targets, or incomplete workload operations defer node actions. Wake restores replicas from database snapshots; it does not recreate nodes. Failed drain/deletion and startup recovery separately restore owned cordons. See [node protection in the tutorial](first-policy.md#2-protect-every-node).

## 2. Data Model

| Field | Meaning |
| :---- | :------ |
| `sleepWindows` | One to ten recurring sleep windows, serialized as JSON in the policy row and returned as an array by the API |
| `daysOfWeek` | Nonempty set of weekdays: `0` Sunday through `6` Saturday; duplicate days are rejected |
| `startTime`, `endTime` | Local `HH:MM` times; must differ for a timed window |
| `allDay` | Whole selected calendar days; start/end fields are ignored |
| `timezone` | IANA timezone; the API defaults an omitted value to `UTC` |
| `mode` | `plan` previews actions; `apply` changes cluster resources |
| `enabled` | Controls automatic evaluation; manual triggers remain available when disabled |
| `currentState` | Stored baseline execution/scheduler state; scoped exceptions can leave individual workloads in a different state |
| `nextTransitionAt` | Computed prediction of the next change in the union of sleep windows; see below |

An exception belongs to a policy and carries an absolute start/end time, a type (`stay_awake` or `force_sleep`), optional targeting filters, and `sleepOnEnd`. It has a separate lifecycle from the policy.

Definitions: [window type and validation](../backend/internal/policy/windows.go), [stored models](../backend/internal/store/models.go), [API preparation and defaults](../backend/internal/api/policies_validation.go).

## 3. Window Evaluator

### Evaluate()

The evaluator converts the supplied instant to the policy's timezone and checks its local weekday and minute of day. **Any matching window means sleeping; no match means awake.** Multiple windows form a union, so an overlap or adjacent window can keep the policy sleeping after another window ends.

Timed windows use a start-inclusive, end-exclusive interval: `[start, end)`.

| Window | Interpretation | Example |
| :----- | :------------- | :------ |
| Same-day, start before end | Selected day and local time within the interval | Monday 09:00–17:00 sleeps at 09:00 and wakes at 17:00 if no other window matches |
| Overnight, end before start | Selected weekday is the **start** day; the interval continues into the following day | Friday 19:00–07:00 includes Saturday 06:59, but not Saturday 07:00 |
| All-day | Every instant of each selected local calendar day | Saturday and Sunday sleep continuously until Monday 00:00 unless another window continues coverage |

For example, Monday windows 19:00–23:00 and 22:00–07:00 produce one continuous sleeping period through Tuesday 07:00. The first window's 23:00 end is not a wake boundary because the second still matches.

Local clock changes affect the elapsed duration of a wall-clock window. The evaluator uses the timezone's local weekday/hour/minute, and prediction constructs candidate boundaries with Go's `time.Date` and calendar-day arithmetic. It does not add a fixed number of elapsed hours to midnight. Review windows near ambiguous or skipped local clock times in the intended timezone; the implementation does not provide a separate choice of which repeated clock occurrence to use.

The pure evaluator returns awake for empty windows or an invalid timezone. The scheduler's policy engine instead treats a missing window set with no applicable exception as `unknown`; the API requires valid windows/timezones, and scheduler loading skips policies with invalid timezones.

Source: [evaluator.go](../backend/internal/policy/evaluator.go).

### NextTransition()

Prediction collects start/end boundaries across eight local calendar days, sorts them, and returns the first future boundary where evaluating the **whole window union** changes the current window-derived state. Returned timestamps are UTC instants.

`nextTransitionAt` is therefore a window prediction, not a promised execution time:

- Active exceptions are not included in this calculation.
- It does not account for Auto Wake, execution mode, node protection, failures, or execution duration.
- Policies absent from the enabled-policy scheduler cache have no computed prediction.
- A schedule that never changes state within the lookahead, such as all-day sleep on all seven days of the week, has no next transition; the API can omit the field.

Sources: [boundary evaluation](../backend/internal/policy/evaluator.go), [scheduler cache and predictions](../backend/internal/scheduler/policy_scheduler.go), [API response construction](../backend/internal/api/policies.go).

## 4. Scheduler Architecture

### Ticker Loop

Each tick first processes exception lifecycle changes, then evaluates enabled policies. Active exceptions are batch-loaded for the evaluation pass. Schedule or guardrail changes update the scheduler configuration; changing the interval restarts its ticker.

### Exception Precedence

For baseline policy intent, the scheduler supplies active, time-bounded exceptions without targeting filters to the policy engine:

| Priority | Input | Intended state |
| :------- | :---- | :------------- |
| 1 | `force_sleep` exception | Sleeping |
| 2 | `stay_awake` exception | Awake |
| 3 | Union of policy sleep windows | Sleeping or awake |
| 4 | No windows and no applicable exception | Unknown |

Exceptions with namespaces, labels, or explicit workload targets reconcile separately. Filters intersect each other and the parent policy's namespace/label boundary. A successful scoped action preserves the baseline policy state, and ordinary sleep/wake preserves workloads protected by an active opposite exception. For example, a 06:00–08:00 stay-awake exception for namespace A does not suppress namespace B's scheduled 07:00 wake. The policy still has one baseline state; it does not persist a state per workload.

The API normally rejects overlapping opposite-type exceptions on the same policy. If stored inputs conflict, force-sleep takes precedence over stay-awake for a matching workload as well as for unscoped policy intent.

Sources: [policy engine](../backend/internal/scheduler/policy_engine.go), [active-exception queries](../backend/internal/store/exceptions.go), [shared target matching](../backend/internal/store/targeting.go), [exception validation](../backend/internal/api/exceptions.go).

### State Transition Detection

When stored and intended states differ, the scheduler attempts a sleep or wake execution. Normal scheduled wakes respect **Auto Wake**. A failed scheduled transition waits at least five minutes before another scheduled attempt for that policy; this is a fixed minimum delay, not exponential backoff.

When state already matches, optional reconciliation handles open snapshots left by partial wakes, and optional sleep enforcement handles workloads externally scaled up during sleep. Corrective attempts also use a five-minute minimum delay. Corrective wake bypasses Auto Wake because it repairs a partial wake.

Active scoped exceptions have a separate five-minute retry clock per exception. Their corrective actions run before the optional baseline reconciliation paths and are independent of those guardrail switches. Failed or interrupted executions reset policy state to `unknown`; partial scaling errors retain counters and open snapshots for retry rather than reporting success.

A policy left `transitioning` past its configured execution timeout plus five minutes, with a minimum threshold of fifteen minutes, is reset to `unknown` for re-evaluation.

### Execution Lifecycle

An execution claims the policy transition, records a running execution, runs the scaler with its timeout, persists and streams log lines, then stores final status and counters. Timeout `0` uses the server's two-hour execution default; the UI normally creates policies with a thirty-minute timeout.

Plan mode records predicted actions without applying workload/node changes, but successful plan executions can update `currentState`. Inspect execution mode and actual Kubernetes replicas when verifying an outcome.

Manual triggers may explicitly override the policy's stored mode and remain available while the policy is disabled. Disabling a policy stops automatic scheduling; it is not a replacement for checking the mode in a manual trigger dialog.

### Startup Recovery

Startup first acquires a dedicated PostgreSQL session advisory lock. The owning session marks leftover running executions interrupted and resets stored transitioning policies; a second process cannot run this recovery while the owner is alive. Recovery compares enabled policies' stored states with current windows and unscoped exceptions, queues baseline mismatches, and reconciles scoped exceptions without broadening them. The tick loop follows. Completion time depends on actual scaling, failures, and retries; there is no fixed two-tick recovery guarantee.

Ownership stays held until shutdown and execution completion; mutation checks and a watchdog stop work when its database session is lost. This requires one application replica, Recreate upgrades, and session-preserving PostgreSQL access. See [upgrade requirements](reliability-review.md#upgrade-and-remaining-decisions).

Sources: [application startup](../backend/cmd/server/main.go), [scheduler lifecycle](../backend/internal/scheduler/policy_scheduler.go), [execution/finalization](../backend/internal/scheduler/execution.go), [ownership](../backend/internal/store/ownership.go), [atomic store transitions](../backend/internal/store/policies.go).

### Exception Ticker

Pending exceptions become active when their start is due. On activation, `stay_awake` requests a wake and `force_sleep` requests a sleep. A failure to start that execution returns the exception to pending for another attempt. Disabled policies skip exception-triggered executions.

Active exceptions become completed on a tick strictly after `endsAt`; active-state queries include the end instant itself. If `sleepOnEnd=true`, the end action evaluates the policy's **current windows without exceptions**, then requests sleep or wake for that result using the ending exception's scope. It does not blindly invert the exception type. For example, a force-sleep exception ending during a normal sleep window requests sleep, not wake.

Cancelling an active exception through the API uses the same schedule-based end action when `sleepOnEnd=true`. With `sleepOnEnd=false`, there is no explicit end action, but ordinary policy evaluation resumes; the flag does not freeze the resulting state indefinitely. Other active exceptions still affect subsequent normal evaluation.

Expiry records completion before dispatching the end action; API cancellation attempts the action before recording cancelled status. A dispatch failure is logged without retrying that lifecycle action; baseline scheduling/reconciliation remains subject to its usual gates. This differs from activation, whose dispatch failure returns the exception to pending.

Sources: `TickExceptions`, `RunExceptionAction`, and `RevertExceptionAction` in [scheduler/exceptions.go](../backend/internal/scheduler/exceptions.go); cancellation in [api/exceptions.go](../backend/internal/api/exceptions.go).

## 5. API

Policy requests use `sleepWindows`; cron fields are not part of the current request model. A window might be:

```json
{
  "name": "Weekday nights",
  "daysOfWeek": [1, 2, 3, 4, 5],
  "startTime": "19:00",
  "endTime": "07:00",
  "allDay": false
}
```

Use the [API guide](api.md), [OpenAPI contract](../openapi.yaml), and [configuration reference](configuration.md#policy-configuration) for complete requests, validation, and authentication. They are the field/endpoint references; this page explains schedule interpretation.

## 6. Frontend

The [window editor](../frontend/src/components/policies/WindowPicker.tsx) selects days, times, all-day windows, and presets. The [weekly timeline](../frontend/src/components/policies/WeeklyTimeline.tsx) visualizes window coverage in the selected timezone. Neither is a cron editor.

The create/edit dialog distinguishes the policy's stored mode and enabled state from the explicit Plan/Apply choice in a manual trigger. Follow the [first-policy walkthrough](first-policy.md) for screenshots and an end-to-end example. See the [frontend developer guide](frontend-dev-guide.md) for component details.

## 7. Migration

**Legacy compatibility history.** This section applies to databases from the former cron-based scheduler. It is not needed to create a new window-native policy.

The former implementation compiled windows into sleep/wake cron expressions and inferred state from previous cron firing times. Current execution evaluates windows directly. Retained conversion code exists only to upgrade old stored policies.

### Step 1: Schema Migration

`store.New()` calls `runMigrations()`. With AutoMigrate enabled, GORM updates the current schema before legacy conversion. `AUTO_MIGRATE=false` skips the GORM `AutoMigrate` call only: other explicit migration statements, cron conversion, and legacy-column drops still run.

### Step 2: Cron-to-Window Conversion

When the `sleep_cron` column exists, `migrateWindowsFromCrons()` selects policies whose `sleep_windows` is null, empty, or `[]` and which contain a legacy sleep or wake cron. Existing nonempty window arrays are left alone.

`CronsToWindows()` attempts a limited conversion of single-time five-field cron pairs. It supports wildcard day/month fields and day-of-week lists/ranges, and checks sleep/wake day alignment for same-day or overnight windows. It is not a general cron interpreter.

If conversion fails or yields no window, migration writes an **all-day window covering all seven days**. This fallback means continuous intended sleep, not preservation of the old schedule. An enabled apply policy can act on that fallback as soon as the upgraded scheduler starts. Before upgrading a legacy database, back it up, review unsupported cron pairs, and keep live execution disabled during migration. Inspect the converted windows and migration warnings before re-enabling live execution.

### Step 3: Column Drops

After conversion attempts, the migration drops `sleep_cron`, `wake_cron`, `next_sleep_at`, and `next_wake_at` using `DROP COLUMN IF EXISTS`.

### Idempotency

Column-existence checks and conditional drops allow later startups to skip already-completed conversion work. This is not a promise of atomic, lossless conversion: the helper performs best-effort reads/updates and later attempts column drops. Keep a database backup when migrating an older installation.

Sources: [runMigrations and conversion](../backend/internal/store/migrations.go), [CronsToWindows and parser](../backend/internal/policy/windows.go).

## 8. Deleted Code

**Legacy migration history.** The current code no longer uses `robfig/cron` scheduling, raw sleep/wake cron API fields, separate next-sleep/next-wake timestamps, or a frontend cron-mode editor. The active schedule representation is `sleepWindows` and its computed `nextTransitionAt` prediction.

`CronsToWindows()` and its parsing helpers remain in [windows.go](../backend/internal/policy/windows.go) for database migration. No removal date or requirement to manually run those helpers is implied.
