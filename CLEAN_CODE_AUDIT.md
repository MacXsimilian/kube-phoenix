# Clean Code Audit — kube-phoenix

> Generated: 2026-03-27
> Scope: Full codebase — Go backend + TypeScript/React frontend
> Standard: *Clean Code* by Robert C. Martin
> Purpose: Actionable findings for remediation agents

Each finding includes: file path, line(s), violation category, problem, and a concrete fix.

---

## Table of Contents

- [Backend (Go)](#backend-go)
  - [Functions — Length & Single Responsibility](#be-functions)
  - [Meaningful Names](#be-names)
  - [Error Handling](#be-errors)
  - [Comments](#be-comments)
  - [Formatting & Vertical Density](#be-formatting)
  - [Boundary Violations (Mixed Concerns)](#be-boundaries)
  - [God Objects](#be-objects)
  - [Single Responsibility Principle](#be-srp)
  - [DRY Violations](#be-dry)
  - [Law of Demeter](#be-demeter)
  - [Too Many Parameters](#be-params)
  - [Boolean Flag Arguments](#be-flags)
  - [Output Arguments](#be-output-args)
- [Frontend (TypeScript / React)](#frontend-typescript--react)
  - [Meaningful Names](#fe-names)
  - [Functions & Component Responsibilities](#fe-functions)
  - [Single Responsibility Principle](#fe-srp)
  - [DRY Violations](#fe-dry)
  - [Error Handling](#fe-errors)
  - [Magic Numbers & Strings](#fe-magic)
  - [Comments](#fe-comments)
  - [Formatting](#fe-formatting)

---

## Backend (Go)

### BE-FUNCTIONS

#### [FUNCTIONS] `backend/internal/api/cluster.go:269-313` — `getNodes` does too much (44 lines)
**Problem:** Handles validation, cache-first lookup, fallback API call, error handling, and response building in a single function.
**Fix:** Extract `getNodesCached()` for the cache path and `getNodesFallback()` for the API path. Let `getNodes` orchestrate.

---

#### [FUNCTIONS] `backend/internal/api/cluster.go:391-414` — `getNodePods` mixes K8s calls with response building
**Problem:** Pod filtering and response building are done inline inside the same function, mixing infrastructure and presentation.
**Fix:** Extract `buildNodePodsList(pods)` to separate pod-to-response transformation from the fetch logic.

---

#### [FUNCTIONS] `backend/internal/api/cluster.go:462-504` — `getPodDetail` is 42 lines with multiple responsibilities
**Problem:** Handles validation, K8s API calls, event gathering, metric gathering, and response building.
**Fix:** Create `fetchPodData(ctx, ns, name)` and `buildPodDetailResponse(pod, metrics, events)` helpers.

---

#### [FUNCTIONS] `backend/internal/api/policies.go:198-282` — `updatePolicy` is 84 lines
**Problem:** Handles parameter parsing, 6 distinct validation steps, conflict checking, window validation, and DB writes all inline.
**Fix:** Extract `buildPolicyUpdates(req)`, `validatePolicyConflicts(updates, existing)`, and `validateWindowUpdates(windows)`.

---

#### [FUNCTIONS] `backend/internal/api/exceptions.go:59-90` — `createException` has 6+ return paths
**Problem:** Validation and policy lookup are intertwined with business logic, creating deeply nested branching.
**Fix:** Extract `validateExceptionInput(req)` and `validateExceptionPolicy(policyID)` and call them before the main logic.

---

#### [FUNCTIONS] `backend/internal/scaler/policy_scaler.go:95-162` — `RunPolicySleep` is 68 lines
**Problem:** Fetches guardrails, validates snapshots, fetches workloads, scales, and handles node operations all in one function.
**Fix:** Extract `processPolicySleepWorkloads(ctx, workloads, logCh)` to isolate the iteration loop from orchestration.

---

#### [FUNCTIONS] `backend/internal/scheduler/policy_scheduler.go:277-320` — `evaluatePolicy` has 4 levels of nesting
**Problem:** Override logic, skip conditions, and state checks are nested 4 levels deep across 43 lines.
**Fix:** Extract `shouldSkipTransition(overrides []Override, direction string, now time.Time) bool` and call it early.

---

#### [FUNCTIONS] `backend/internal/scheduler/policy_scheduler.go:371-498` — `run` is 128 lines
**Problem:** Handles state checking, execution creation, goroutine management, log channel setup, metrics recording, and final state updates.
**Fix:** Extract `executePolicy(ctx, execID, policy, direction, trigger)` and `finalizeExecution(execID, counts, status)`.

---

#### [FUNCTIONS] `backend/cmd/server/main.go:197-208` — `parseIntEnv` has a hidden side effect (logging)
**Problem:** A function named `parseIntEnv` also emits log warnings. Callers don't expect parsing to produce log output.
**Fix:** Return `(int, error)` and let the caller decide whether to log the warning.

---

### BE-NAMES

#### [NAMES] `backend/internal/scaler/scaler.go:49` — Parameter `ch` in `emit`
**Problem:** `ch` is too generic for a log-line channel. Context is lost when reading the function signature.
**Fix:** Rename to `logCh`.

---

#### [NAMES] `backend/internal/policy/evaluator.go:29` — Abbreviation `dow` (day-of-week)
**Problem:** `dow` is not self-documenting for readers unfamiliar with the abbreviation.
**Fix:** Rename to `dayOfWeek`, or define `const DayOfWeekSunday = 0` with an explanatory comment.

---

#### [NAMES] `backend/internal/api/audit.go:72` — Parameters `before` / `after` use `any`
**Problem:** The intent (before/after state of an object) is unclear from the `any` type and minimal names.
**Fix:** Rename to `beforeState` and `afterState` and document the expected JSON-serializable contract.

---

#### [NAMES] `backend/internal/store/policies.go:57-62` — Magic string `"awake"` in `UpdatePolicyState`
**Problem:** `"awake"` is used as a bare string literal in a switch; this is a hidden contract between the store and callers.
**Fix:** Define `const PolicyStateAwake = "awake"` and `const PolicyStateSleeping = "sleeping"` in `models.go`.

---

### BE-ERRORS

#### [ERRORS] `backend/internal/api/cluster.go:409` — Metrics error silently discarded with `_`
**Problem:** `podMetrics, _ := h.k8s.GetAllPodMetrics(ctx)` — if Metrics Server is unavailable, the caller has no way to know.
**Fix:** Log a warning: `if podMetrics, err := h.k8s.GetAllPodMetrics(ctx); err != nil { slog.Warn("metrics unavailable", "err", err) }`.

---

#### [ERRORS] `backend/internal/api/oidc.go:240-244` — `json.Unmarshal` error silently swallowed
**Problem:** A malformed `groupsClaim` silently makes the user a viewer rather than failing with a clear error.
**Fix:** Log: `if err := json.Unmarshal(data, &g); err != nil { slog.Warn("oidc: malformed groups claim", "err", err) }`.

---

#### [ERRORS] `backend/internal/auth/oidc.go:78` — OIDC discovery error discarded with `_ =`
**Problem:** `_ = provider.Claims(&rawClaims)` — if `end_session_endpoint` is missing, no warning is emitted.
**Fix:** `if err := provider.Claims(&rawClaims); err != nil { slog.Warn("oidc: end_session_endpoint unavailable", "err", err) }`.

---

#### [ERRORS] `backend/internal/k8s/client.go:385-386` — Unmarshal failure in `GetAllPodMetrics` returns empty map
**Problem:** Callers cannot distinguish "no metrics" from "parsing failed".
**Fix:** Return `(map[string]PodMetrics, error)` and propagate the unmarshal error. Log at warning level in callers.

---

#### [ERRORS] `backend/internal/api/helpers.go:45-49` — `reloadScheduler` result ignored
**Problem:** If the scheduler reload fails, cached policies become stale with no indication to operators.
**Fix:** Return the error from the handler and log it: `if err := h.policyScheduler.Reload(); err != nil { slog.Error("scheduler reload failed", "err", err) }`.

---

### BE-COMMENTS

#### [COMMENTS] `backend/internal/api/cluster.go:29-32` — Comments repeat what the code says
**Problem:** Comments `// "running" | "sleeping" | "partial"` on struct fields duplicate what constants would express better.
**Fix:** Replace with constants: `const (WorkloadStatusRunning = "running"; WorkloadStatusSleeping = "sleeping"; ...)` and reference them.

---

#### [COMMENTS] `backend/internal/policy/evaluator.go:40-41` — Redundant comment on `windowContains`
**Problem:** The comment restates the function signature word-for-word.
**Fix:** Replace with an intent comment: `// windowContains reports whether the given point-in-time falls within the window's schedule.`

---

#### [COMMENTS] `backend/internal/scheduler/broker.go:34-36` — Inline narrative should be a doc comment
**Problem:** The "Safe to call after Close" note is placed inline but should be on the method itself for `godoc` visibility.
**Fix:** Move above `Unsubscribe` as a `// Unsubscribe removes ...` doc comment.

---

#### [COMMENTS] `backend/internal/scaler/scaler.go:99-102` — Misleading comment on `workloadEntry`
**Problem:** "Fields that are unused by the caller … are left nil" doesn't explain which fields or when.
**Fix:** Document each nil-able field individually: `// Annotate is set for scale-down only. RemoveAnnotation is set for scale-up only.`

---

### BE-FORMATTING

#### [FORMATTING] `backend/internal/api/policies.go:162-171` — Dense `policyFieldMap` literal
**Problem:** Map literal defined without line breaks, reducing scannability.
**Fix:** Format one entry per line with aligned values (standard Go style).

---

#### [FORMATTING] `backend/internal/api/guardrails.go:76-94` — Two unrelated loops lack visual separation
**Problem:** `skipNodeLabels` and `skipNodeTaints` validation loops are run together with no blank line between them.
**Fix:** Add a blank line between the two loops and a short comment heading each section.

---

#### [FORMATTING] `backend/internal/k8s/cache.go:72-120` — `refresh` method is visually dense (48 lines, no breaks)
**Problem:** Error array init, parallel fetch goroutines, result processing, and mutex unlock are all run together.
**Fix:** Add blank lines between: init, goroutine setup, error check, and final state update sections.

---

#### [FORMATTING] `backend/internal/middleware/auth.go:30-60` — `SessionAuth` closure is cramped
**Problem:** Session validation, user lookup, and extension logic are written without visual breaks.
**Fix:** Add blank lines between: session decode, user check, and extension logic blocks.

---

### BE-BOUNDARIES

#### [BOUNDARIES] `backend/internal/api/cluster.go:156-193` — `getWorkloads` mixes cache logic with response building
**Problem:** The cache-aware fetch (`h.cache.Snapshot()`) and the `jsonOK` response build are done in the same function.
**Fix:** Extract `getOrFetchWorkloads(ctx) ([]WorkloadResponse, error)` to separate the data concern from the API concern.

---

#### [BOUNDARIES] `backend/internal/scaler/policy_scaler.go:40-88` — `sleepWorkload` mixes DB snapshots with K8s operations
**Problem:** Database snapshot management and Kubernetes scale operations are interleaved in one function.
**Fix:** Extract `scaleWorkloadToZero(ctx, workload WorkloadRef, logCh chan string) error` and keep snapshot logic in the caller.

---

#### [BOUNDARIES] `backend/internal/scheduler/policy_scheduler.go:261-320` — Override evaluation embedded in scheduler
**Problem:** Business logic (override precedence, skip conditions) belongs in `policy_engine.go`, not the scheduler.
**Fix:** Move override evaluation to `policy_engine.go` as `ShouldSkipTransition(overrides []Override, direction string, now time.Time) bool`.

---

### BE-OBJECTS

#### [OBJECTS] `backend/internal/api/router.go:32-44` — `Handler` is a God Object
**Problem:** `Handler` holds 11 fields spanning API, auth, persistence, k8s, rate-limiting, and scheduling concerns.
**Fix:** Consider splitting into `AuthHandler`, `PolicyHandler`, `ClusterHandler` composed with shared dependencies, or at minimum group related fields into nested structs.

---

#### [OBJECTS] `backend/internal/store/models.go:89-116` — `Policy` mixes config and runtime state
**Problem:** Schedule config (`SleepWindows`, `Timezone`) and derived runtime state (`CurrentState`, `StateSince`, `NextTransitionAt`) are in one struct, making them hard to reason about independently.
**Fix:** Split into `PolicyConfig` (schedule inputs) and `PolicyState` (mutable runtime), compose them when needed.

---

### BE-SRP

#### [SRP] `backend/internal/api/cluster.go:737-760` — `nodeProtectionStatus` does label AND taint checking
**Problem:** Two reasons to change: label matching logic, taint matching logic.
**Fix:** Extract `isLabelProtected(node, labels)` and `isTaintProtected(node, taints)` (mirrors existing helpers in `scaler.go`) and compose them.

---

#### [SRP] `backend/internal/scaler/scale_down.go:54-108` — `drainNodes` has 5+ responsibilities
**Problem:** Fetches nodes, identifies critical nodes, computes protection, counts pods, and executes drains all inline.
**Fix:** Extract `identifyCriticalNodes()`, `getProtectedNodes()`, and keep `drainNodes` as a thin orchestration loop.

---

#### [SRP] `backend/internal/scheduler/policy_scheduler.go:148-187` — `RecoverPolicies` mixes recovery orchestration with state evaluation
**Problem:** Fetches policies, parses windows, checks overrides, evaluates state, and triggers executions all in one function. Hard to unit-test individual steps.
**Fix:** Extract `determineRecoveryAction(policy, intended, current string) RecoveryAction` and test it independently.

---

### BE-DRY

#### [DRY] `backend/internal/api/admin.go:45-82` vs `backend/internal/scaler/scale_down.go:30-45` — Duplicated workload listing
**Problem:** Both fetch deployments and statefulsets and filter them using the same pattern.
**Fix:** Extract a shared helper on the base `Runner`: `fetchAndFilterWorkloads(ctx, namespaceFilter, labelSelector) ([]workloadEntry, error)`.

---

#### [DRY] `backend/internal/api/helpers.go:40-43` vs `backend/internal/api/exceptions.go:271-274` — Duplicated ID parsing
**Problem:** `parseID` and `parseIDFromString` are nearly identical uint-from-string conversions.
**Fix:** Keep one canonical `parseID(s string) (uint, error)` function in `helpers.go` and remove the other.

---

#### [DRY] `backend/internal/api/auth.go:207-245` vs `backend/internal/api/oidc.go:258-294` — Duplicated session/cookie creation
**Problem:** Both paths perform identical session creation and cookie setup.
**Fix:** Extract `createSessionAndCookies(w http.ResponseWriter, user *User, idleTimeout, maxLifetime time.Duration) error`.

---

#### [DRY] `backend/internal/k8s/client.go:80-94` vs `backend/internal/k8s/client.go:141-155` — Duplicated annotation logic
**Problem:** `AnnotateDeployment` and `AnnotateStatefulSet` follow identical get→check-nil→set→update patterns.
**Fix:** Create a generic annotation helper that accepts fetch and update functions to eliminate duplication across resource types.

---

### BE-DEMETER

#### [DEMETER] `backend/internal/api/cluster.go:461-504` — `getPodDetail` navigates deeply into pod internals
**Problem:** Directly accesses `pod.Spec.Containers`, `pod.Status.ContainerStatuses`, `pod.Status.Conditions`, `pod.Status.QOSClass`.
**Fix:** Create `buildPodDetail(pod *corev1.Pod) PodDetailResponse` to encapsulate the navigation.

---

#### [DEMETER] `backend/internal/scheduler/policy_scheduler.go:278` — Scheduler reads many raw Policy fields
**Problem:** Directly accesses `p.Mode`, `p.Timezone`, `p.CurrentState`, `p.TimeoutMinutes`. Changes to Policy require scheduler changes.
**Fix:** Create accessor methods or a `PolicyContext` value object that shields the scheduler from `Policy` internals.

---

#### [DEMETER] `backend/internal/scaler/policy_scaler.go:140-145` — `PolicyRunner` reaches through `r.base.k8s`
**Problem:** `r.base.k8s.ListDeploymentsBySelector(...)` reaches two levels into dependencies.
**Fix:** Expose a method on the base `Runner`: `func (r *Runner) listWorkloads(ctx, selector)`.

---

### BE-PARAMS

#### [PARAMS] `backend/internal/scaler/policy_scaler.go:40` — `sleepWorkload` has 6 parameters
**Problem:** `kind`, `namespace`, `name string`, `replicas int32`, `annotate`, `scale func()` are all separate.
**Fix:** Bundle into `type WorkloadRef struct { Kind, Namespace, Name string; Replicas int32 }` and pass one struct.

---

#### [PARAMS] `backend/internal/scaler/scaler.go:147-154` — `collectFilteredEntries` has 6 parameters
**Problem:** `deployments`, `statefulsets`, `skipNS`, `namespaceFilter`, `counts`, `countSkipped` are all separate.
**Fix:** Create `type FilterOptions struct { SkipNamespaces map[string]bool; NamespaceFilter string; CountSkipped bool }`.

---

#### [PARAMS] `backend/internal/scaler/scaler.go:249-261` — `applyScale` has 7 parameters
**Problem:** `ctx, mode, entry, wl, target, okMsg, planMsg, logCh, counts` are all positional.
**Fix:** Create `type ScaleOptions struct { Mode string; Target int32; SuccessMsg, PlanMsg string }`.

---

### BE-FLAGS

#### [FLAGS] `backend/internal/api/cluster.go:603` — `parsePodLogParams` returns bare booleans
**Problem:** `container, tailLines, previous, follow := parsePodLogParams(r)` — `previous` and `follow` are semantically opaque at the call site.
**Fix:** Return a struct: `type PodLogOptions struct { Container string; TailLines int64; Previous, Follow bool }`.

---

#### [FLAGS] `backend/internal/scaler/scaler.go:153` — `countSkipped bool` changes behavior
**Problem:** A boolean flag that alters internal counter side effects is not self-documenting.
**Fix:** Remove the flag and let callers handle incrementing their own counters, or make it part of a `FilterOptions` struct with a clear field name.

---

### BE-OUTPUT-ARGS

#### [OUTPUT-ARGS] `backend/internal/scaler/scaler.go:178-192` — `scaleDownWorkloads` mutates `counts *Counts`
**Problem:** The `counts` pointer is modified as an implicit output parameter. Callers may not realize filtering has side effects.
**Fix:** Return `type ScaleSummary struct { Scaled, Skipped, Errors int }` and let callers merge as needed.

---

---

## Frontend (TypeScript / React)

### FE-NAMES

#### [NAMES] `frontend/src/lib/formatters.ts:6` — `fmtCpu` is abbreviated
**Problem:** `fmtCpu` violates "avoid mental mapping." `fmt` is not a standard prefix in this codebase.
**Fix:** Rename to `formatCpu`.

---

#### [NAMES] `frontend/src/lib/formatters.ts:11` — `fmtMem` is abbreviated
**Problem:** Same pattern as `fmtCpu`.
**Fix:** Rename to `formatMem`.

---

#### [NAMES] `frontend/src/lib/formatters.ts:17` — `podAge` does not follow formatter naming convention
**Problem:** All other functions in this file use a `format`/`fmt` prefix; `podAge` uses neither.
**Fix:** Rename to `formatPodAge`.

---

#### [NAMES] `frontend/src/lib/formatters.ts:26` — `sinceMs` is cryptic
**Problem:** `ms` implies milliseconds but it's actually a millisecond epoch timestamp. Name doesn't convey "time elapsed since."
**Fix:** Rename to `formatTimeSinceMs` and add JSDoc: `@param ms - past timestamp in milliseconds since epoch`.

---

#### [NAMES] `frontend/src/lib/formatters.ts:34` — `timeUntil` lacks verb and type clarity
**Problem:** Doesn't indicate it formats a countdown or that it expects an ISO timestamp.
**Fix:** Rename to `formatCountdown`. Add JSDoc: `@param iso - future ISO timestamp`.

---

#### [NAMES] `frontend/src/lib/formatters.ts:47` — `pct` is abbreviated
**Problem:** Violates "avoid mental mapping."
**Fix:** Rename to `calculatePercentage`.

---

#### [NAMES] `frontend/src/lib/formatters.ts:52` — `pctColor` is abbreviated
**Problem:** Both the `pct` prefix and lack of noun make the return type unclear.
**Fix:** Rename to `getPercentageColor`.

---

#### [NAMES] `frontend/src/lib/formatters.ts:59` — `fmtDt` is doubly abbreviated
**Problem:** `fmt` + `Dt` are both abbreviations; meaning is not obvious.
**Fix:** Rename to `formatDateTime`.

---

#### [NAMES] `frontend/src/lib/formatters.ts:65` — `fmtDtShort` is doubly abbreviated
**Problem:** Same issue as `fmtDt`.
**Fix:** Rename to `formatDateTimeShort`.

---

#### [NAMES] `frontend/src/lib/formatters.ts:74` — `fmtDuration` uses abbreviated prefix
**Problem:** Inconsistent with `formatTime` pattern elsewhere.
**Fix:** Rename to `formatDuration`.

---

#### [NAMES] `frontend/src/lib/formatters.ts:84` — `timeAgo` lacks formatting verb
**Problem:** Other formatters use `format` prefix; `timeAgo` does not.
**Fix:** Rename to `formatTimeAgo`.

---

#### [NAMES] `frontend/src/lib/windowUtils.ts:66` — `arrEq` is opaque
**Problem:** Does not communicate type (array) or behavior (equality by value).
**Fix:** Rename to `arrayEquals`.

---

### FE-FUNCTIONS

#### [FUNCTIONS] `frontend/src/components/cluster/PodLogViewer.tsx` — 486-line component lacks top-level documentation
**Problem:** Handles live streaming, multiple container selection, searching, auto-scroll, and scroll-lock. No JSDoc.
**Fix:** Add JSDoc at the top describing architecture and responsibilities. Consider whether streaming logic belongs in a `usePodLogStream` hook.

---

#### [FUNCTIONS] `frontend/src/components/history/LogViewer.tsx` — 568-line component lacks top-level documentation
**Problem:** Handles WebSocket streaming, summary parsing, and log display together. No JSDoc.
**Fix:** Add JSDoc. Consider extracting `useLogStream` hook for the streaming/parsing concern.

---

#### [FUNCTIONS] `frontend/src/components/guardrails/GuardrailsForm.tsx` — 450-line form lacks documentation
**Problem:** Handles chips, selects, switches, duration fields, validation, and API calls together.
**Fix:** Add JSDoc. Extract `useGuardrailsForm` hook for form state and validation.

---

#### [FUNCTIONS] `frontend/src/components/policies/CreatePolicyDialog.tsx` — 307-line dialog mixes form and preview
**Problem:** Form state, window presets, timeline preview, and API calls all inline.
**Fix:** Extract `useCreatePolicyForm` hook. Extract `<PolicyWindowPreview>` component.

---

#### [FUNCTIONS] `frontend/src/components/policies/WindowPicker.tsx` — 386-line picker handles multiple input modes
**Problem:** Day selection, time input, all-day toggle, and presets are all in one component.
**Fix:** Extract `<DayPicker>`, `<TimePicker>`, `<WindowPresets>` and compose via `<WindowPickerContainer>`.

---

#### [FUNCTIONS] `frontend/src/app/policies/detail/page.tsx` — 400+ line page lacks JSDoc and section decomposition
**Problem:** Hero, timeline, overrides, exceptions, and execution history are all rendered inline.
**Fix:** Extract `<PolicyHero>`, `<PolicyTimeline>`, `<PolicyExecutionHistory>` sections. Add JSDoc explaining page structure.

---

#### [FUNCTIONS] `frontend/src/components/overview/ClusterStatusCard.tsx` — 342-line card with SSE lacks documentation
**Problem:** SSE subscription, state updates, and visual rendering are combined without explaining the architecture.
**Fix:** Add JSDoc. Extract `useClusterStatus` hook wrapping `useClusterStream`.

---

### FE-SRP

#### [SRP] `frontend/src/components/cluster/PodLogViewer.tsx` — Combines streaming, search, container selection, and scroll management
**Problem:** 4+ responsibilities make this component impossible to test in isolation.
**Fix:** Extract `usePodLogStream(podName, container, options)` hook for streaming. Keep component focused on display.

---

#### [SRP] `frontend/src/components/history/LogViewer.tsx` — Combines WebSocket management, log parsing, and display
**Problem:** Parsing summaries, managing WebSocket state, and rendering are all intertwined.
**Fix:** Extract `useExecutionLogStream(execID)` hook returning `{ lines, summary, status }`. Keep component as pure display.

---

#### [SRP] `frontend/src/components/guardrails/GuardrailsForm.tsx` — Form handles state, validation, and API calls
**Problem:** UI concerns mixed with business validation and network calls.
**Fix:** Extract `useGuardrailsForm()` hook returning `{ values, errors, handleChange, handleSubmit }`.

---

#### [SRP] `frontend/src/app/policies/detail/page.tsx` — Page renders 5+ distinct sections inline
**Problem:** Each section (hero, timeline, overrides, exceptions, history) has its own data dependencies and state.
**Fix:** Decompose into section-level components. Page becomes an orchestration shell only.

---

### FE-DRY

#### [DRY] `frontend/src/lib/formatters.ts:17-23` vs `:84-92` — `podAge` and `timeAgo` duplicate time-difference calculation
**Problem:** Both compute elapsed time in seconds and bucket into m/h/d. Logic is the same with different output suffixes.
**Fix:** Extract `getElapsedParts(seconds: number): { value: number; unit: string }` and reuse.

---

#### [DRY] `frontend/src/lib/formatters.ts:59-71` — `fmtDt` and `fmtDtShort` duplicate null guard
**Problem:** Both functions check `if (!iso) return '—'` before calling `.toLocaleString()`.
**Fix:**
```typescript
function safeDate(iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, opts)
}
```

---

#### [DRY] `frontend/src/lib/windowUtils.ts:102-124` — `computeWeeklyStats` duplicates `isOvernight`'s time math
**Problem:** `startMin`/`endMin` calculation is repeated instead of calling `isOvernight`'s shared logic.
**Fix:** Extract `parseTimeRange(startTime, endTime): { startMin, endMin }` and use it in both functions.

---

#### [DRY] `frontend/src/lib/windowUtils.ts:45-64` — Consecutive-run grouping logic is inline
**Problem:** The pattern of grouping consecutive integers into runs likely appears elsewhere (timeline rendering, day display).
**Fix:** Extract `groupConsecutive(numbers: number[]): number[][]` utility and reuse across components.

---

### FE-ERRORS

#### [ERRORS] `frontend/src/lib/auth.tsx:40-48` — `fetchMe` silently returns `null` on all failures
**Problem:** Network errors, JSON parse errors, and 500s are all collapsed into `null`. No way to distinguish failure modes.
**Fix:** In development, log the error. Distinguish `401` (not logged in) from network failures.

---

#### [ERRORS] `frontend/src/lib/auth.tsx:112-127` — `login` partial user state on `fetchMe` failure
**Problem:** If `fetchMe()` fails after successful login, stale data from the login response is used without noting incomplete permissions.
**Fix:** If `fetchMe()` returns null post-login, throw `new Error('Failed to load user permissions after login')` and clear state.

---

#### [ERRORS] `frontend/src/lib/api.ts:38-41` — 403 body forwarded directly to UI
**Problem:** Backend error bodies may contain internal implementation details shown directly to users.
**Fix:** In production, show a generic "You do not have permission" message; only log the body in development.

---

#### [ERRORS] `frontend/src/lib/api.ts:43-46` — Generic error for all non-OK HTTP responses
**Problem:** Users see `HTTP 500` with no context. 4xx and 5xx are not distinguished.
**Fix:** Differentiate: 5xx → "Server error, please try again"; 4xx → "Invalid request, check your input"; fallback to body message if present.

---

#### [ERRORS] `frontend/src/lib/api.ts:166-197` — `resetDatabaseStream` doesn't cancel the reader on error
**Problem:** If `reader.read()` throws mid-stream, the ReadableStream is leaked.
**Fix:** Wrap the reading loop in `try/finally { reader.cancel() }` to ensure cleanup.

---

### FE-MAGIC

#### [MAGIC] `frontend/src/lib/formatters.ts:7` — Magic number `1000` (millicores per core)
**Fix:** `const MILLICORES_PER_CORE = 1000`

---

#### [MAGIC] `frontend/src/lib/formatters.ts:12` — Magic numbers `1073741824` and `1048576`
**Fix:** `const BYTES_PER_GIB = 1_073_741_824` and `const BYTES_PER_MIB = 1_048_576`

---

#### [MAGIC] `frontend/src/lib/formatters.ts:20-22` — Magic numbers `3600` and `86400`
**Fix:** `const SECONDS_PER_HOUR = 3_600` and `const SECONDS_PER_DAY = 86_400`

---

#### [MAGIC] `frontend/src/lib/windowUtils.ts:59` — Magic number `3` for consecutive day range threshold
**Fix:** `const MIN_DAYS_FOR_RANGE_NOTATION = 3`

---

#### [MAGIC] `frontend/src/lib/auth.tsx:9` — Magic expression `5 * 60 * 1000` for polling interval
**Fix:** Move to `constants.ts` as `export const ME_POLL_INTERVAL_MS = 5 * 60 * 1000` with a comment.

---

### FE-COMMENTS

#### [COMMENTS] `frontend/src/lib/windowUtils.ts:142-152` — `DOW_MAP` array has no explanation
**Problem:** The mapping `[1,2,3,4,5,6,0]` is not obvious. It transforms JS `getDay()` (0=Sun) into UI week indices (0=Mon).
**Fix:**
```typescript
/**
 * Maps JS Date.getDay() (0 = Sun .. 6 = Sat) to UI week-row index (0 = Mon .. 6 = Sun).
 */
export const DOW_MAP = [1, 2, 3, 4, 5, 6, 0]
```

---

#### [COMMENTS] `frontend/src/lib/auth.tsx:52-86` — Dev-mode fallback logic has no explanation
**Problem:** The synthetic dev user creation logic is opaque without context.
**Fix:** Add a block comment: `// If /api/auth/me returns 401 but /api/policies succeeds, the backend is running without auth (dev mode). Synthesize a dev user.`

---

#### [COMMENTS] `frontend/src/lib/api.ts:10-50` — CSRF token injection has no explanation
**Problem:** Readers don't know why only mutation methods get the CSRF header.
**Fix:** Add a comment: `// Mutation methods require a CSRF token to prevent cross-site request forgery.`

---

### FE-FORMATTING

#### [FORMATTING] `frontend/src/components/cluster/PodLogViewer.tsx` — Likely has lines exceeding 100 chars
**Fix:** Run Prettier with project settings (2-space indent, 100-char limit).

---

#### [FORMATTING] `frontend/src/components/guardrails/GuardrailsForm.tsx` — Long JSX prop lines
**Fix:** Break props onto new lines per project convention.

---

#### [FORMATTING] `frontend/src/components/policies/WindowPicker.tsx` — Dense JSX in 386-line component
**Fix:** Apply Prettier and add blank lines between logical JSX sections.

---

## Summary

| Category | Backend (Go) | Frontend (TS) | Total |
|---|---|---|---|
| Functions (length/SRP) | 9 | 7 | 16 |
| Meaningful Names | 4 | 11 | 15 |
| Error Handling | 5 | 5 | 10 |
| DRY Violations | 4 | 4 | 8 |
| God Objects / SRP | 5 | 4 | 9 |
| Magic Numbers/Strings | 1 | 5 | 6 |
| Comments | 4 | 3 | 7 |
| Formatting | 4 | 3 | 7 |
| Boundary / Layer Mixing | 3 | — | 3 |
| Law of Demeter | 3 | — | 3 |
| Too Many Parameters | 3 | — | 3 |
| Boolean Flags | 2 | — | 2 |
| Output Arguments | 1 | — | 1 |
| **Total** | **48** | **42** | **90** |

### Highest-priority fixes (biggest impact, lowest risk)

1. **Name all abbreviations** — `fmtCpu`, `fmtMem`, `fmtDt`, `pct`, `arrEq`, `ch`, `dow` — purely mechanical renames with no logic change.
2. **Replace magic numbers** — All `1000`, `3600`, `86400`, `1073741824` — extract to named constants.
3. **Fix silent error drops** — `podMetrics, _ :=`, `_ = provider.Claims(...)`, `json.Unmarshal` ignore patterns — add at minimum a `slog.Warn`.
4. **Deduplicate session creation** — `auth.go` vs `oidc.go` session setup is a bug risk, not just a style issue.
5. **Extract long functions** — `run` (128 lines), `updatePolicy` (84 lines), `RunPolicySleep` (68 lines) — each extraction is independent.
