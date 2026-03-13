# Project Requirements Document — kube-phoenix

**Version:** 2.0
**Date:** 2026-03-13
**Status:** Active Development

---

## 1. Executive Summary

kube-phoenix is an internal SRE tool that automates Kubernetes cluster sleep/wake scheduling. It replaces ad-hoc bash-based CronJob scalers with a production-grade Go backend and Next.js frontend. SRE operators define **Sleep Policies** — declarative rules that describe when a cluster should be awake — and the system continuously reconciles actual cluster state against those policies. All operations are guarded by layered guardrails, recorded in a full audit history with live log streaming, and protected by a plan-before-apply safety model.

---

## 2. Problem Statement

### 2.1 Original Problem
Kubernetes workloads running 24/7 in non-production clusters waste compute resources during off-hours. The previous approach used a single `cronjob.yaml` with hardcoded bash scripts, which had no visibility, no guardrails, no preview mode, and no web interface.

### 2.2 Cron Model Limitations (v1 → v2)
The v1 replacement introduced cron-based schedules but inherited the conceptual limitations of cron:

- **Two objects for one intent.** A sleep window requires a `scale_down` schedule and a `scale_up` schedule — separate, unlinked objects that can silently diverge.
- **No state awareness.** Cron fires unconditionally. If the cluster is already sleeping, a sleep cron fires again. If the pod restarts, missed fires are lost.
- **No business calendar.** `1-5` in cron means Mon–Fri at the engine level, not at the intent level. Holidays, date ranges, and exceptions are not expressible.
- **Annotation as state store.** Replica counts were saved as `previous-replicas` annotations on each Deployment/StatefulSet — scattered, unqueryable, and a second source of truth alongside PostgreSQL.
- **No conflict detection.** Two overlapping schedules targeting the same namespaces produce undefined behavior.

v2 replaces the cron model entirely with a **desired-state engine** built on Sleep Policies.

---

## 3. Goals

| # | Goal |
|---|------|
| G1 | Define cluster sleep/wake intent as a single Sleep Policy, not paired cron schedules |
| G2 | Continuously reconcile actual cluster state against policy-defined desired state |
| G3 | Protect critical system namespaces and nodes via layered global and per-policy guardrails |
| G4 | Provide a plan mode to preview operations without making changes |
| G5 | Record full audit history of every execution with per-line log streaming |
| G6 | Ship as a single container installable via Helm |
| G7 | Support manual triggers and per-occurrence overrides (skip next) |
| G8 | Detect and surface conflicts between overlapping policies in the UI |
| G9 | Store workload replica state in PostgreSQL, not as Kubernetes annotations |
| G10 | Notify SRE operators of policy conflicts, failures, and drift corrections in-app |

---

## 4. Non-Goals

- Multi-cluster management (single-cluster scope, v1)
- OIDC/SSO authentication (planned; v2 uses HTTP Basic Auth)
- Slack/email/external notifications (planned; v2 notifications are UI-only)
- Horizontal scaling of the controller (single replica; leader election not required)
- Cost reporting or savings analytics
- Multi-user access control (SRE-only tool; all users share one identity until Keycloak)
- Per-workload `min_replicas` granularity (per-policy only in v2; per-workload reserved)

---

## 5. Users and Stakeholders

| Role | Interaction |
|------|-------------|
| SRE / Platform Engineer | Primary user — creates policies, configures guardrails, reviews history, acts on notifications |
| Engineering Manager | Reads audit history, verifies cost-saving actions |

---

## 6. Functional Requirements

### 6.1 Sleep Policy Management

| ID | Requirement |
|----|-------------|
| FR-01 | System must support multiple named Sleep Policies, each fully describing a cluster sleep intent |
| FR-02 | Each policy must have a name, optional description, optional free-text tags (comma-separated), timezone, mode, namespace filter, enabled flag, and drift correction mode |
| FR-03 | Each policy must have one or more schedule windows (see §6.2) |
| FR-04 | Each policy must have a single execution mode: `plan` (preview only) or `apply` (execute) |
| FR-05 | Policies must be individually enable/disable-able without deletion |
| FR-06 | Each policy may filter to specific namespaces (comma-separated; empty = governs all namespaces) |
| FR-07 | Policy tags are free-text organizational labels for SRE use; they carry no access-control meaning |
| FR-08 | Policies must be configurable via the web UI and REST API without a restart |
| FR-09 | One default policy must be seeded on first startup: "Business Hours" — Mon–Fri awake 07:00–19:00, UTC, plan mode |
| FR-10 | The global guardrails singleton must be seeded on first startup with `kube-system` pre-populated in `skip_namespaces` |

### 6.2 Policy Windows — Simple Mode

| ID | Requirement |
|----|-------------|
| FR-11 | Each window must define a set of days-of-week, a `sleep_at` time, and an optional `wake_at` time |
| FR-12 | When `wake_at` is absent the window is sleep-only — the cluster sleeps on schedule and is only woken manually or by another policy |
| FR-13 | Sleep-only windows must display "Manual wake required" in the UI |
| FR-14 | Overnight windows (e.g. `sleep_at: 19:00`, `wake_at: 06:00`) must be supported — the system understands the wake fires on the following calendar day |
| FR-15 | An overnight window that spans from a weekday into a weekend day implicitly covers that weekend day — no separate weekend window is required |
| FR-16 | A policy may contain multiple windows for different day groups (e.g. Mon–Fri one window, Sat–Sun another) |
| FR-17 | The UI must display a plain-English preview of the policy's effective schedule, updated live as the form changes |
| FR-18 | Next sleep and next wake timestamps must be derived from window definitions and shown on the policy card |

### 6.3 Policy Windows — Advanced Mode

| ID | Requirement |
|----|-------------|
| FR-19 | Advanced mode must be accessible via an expandable section within the policy form — it does not replace simple mode |
| FR-20 | Advanced mode must support date ranges — the window only fires on days that are both in the day-of-week selection AND within at least one date range (AND logic) |
| FR-21 | Advanced mode must support exception dates — specific calendar dates on which the window never fires regardless of other rules |
| FR-22 | When no date ranges are configured the date range gate is open (all time applies) |
| FR-23 | Advanced rules are stored as JSONB alongside the window record and are null in simple mode |

### 6.4 Desired-State Engine

| ID | Requirement |
|----|-------------|
| FR-24 | The scheduler must be a native Go loop — no external cron library. It computes next-event times directly from policy window definitions using `time.Time` arithmetic |
| FR-25 | On startup, the scheduler must reconcile current cluster state against policy desired state before entering the event loop |
| FR-26 | The scheduler must run a periodic drift check (default: every 15 minutes) to detect and correct state divergence |
| FR-27 | When multiple policies govern the same namespace: **awake wins** — the namespace sleeps only when all governing policies agree it should be sleeping |
| FR-28 | A namespace not covered by any policy is **unmanaged** — the system never touches it |
| FR-29 | When a policy is created, updated, or deleted, the scheduler must reload and recompute next-event times immediately via a notify channel |
| FR-30 | Per-policy `drift_correction_mode` controls whether corrections create an execution record (`record`, default) or apply silently without any record (`silent`) |
| FR-31 | Drift corrections in `record` mode must appear in History with `execution_type: drift_correction` and trigger an Info notification |

### 6.5 Scale-Down Behaviour

| ID | Requirement |
|----|-------------|
| FR-32 | Before scaling any workload, scale-down must record current replica count in `workload_snapshots` (not as a Kubernetes annotation) |
| FR-33 | Scale-down must skip workloads already at 0 replicas — no snapshot is created for already-sleeping workloads |
| FR-34 | Scale-down must set all targeted Deployments and StatefulSets to 0 replicas (or `min_replicas` if the policy guardrail sets a floor greater than 0) |
| FR-35 | Scale-down must cordon targeted nodes before evicting pods |
| FR-36 | Scale-down must attempt graceful pod eviction (Eviction API), falling back to force delete |
| FR-37 | Scale-down must wait up to 30 seconds for evictable pods to terminate before proceeding |
| FR-38 | Scale-down must delete the node object after draining (Karpenter/CA reprovisioning handles new nodes) |
| FR-39 | Scale-down must skip DaemonSet pods during drain |
| FR-40 | In plan mode, all operations must be logged as would-be actions without mutating any resource or writing any snapshot |

### 6.6 Scale-Up Behaviour

| ID | Requirement |
|----|-------------|
| FR-41 | Scale-up must restore each workload to the `replicas_before` value from the most recent unrestored `workload_snapshots` row for that workload |
| FR-42 | If no snapshot exists for a workload, scale-up must log a warning and skip it — no blind scaling to an unknown value |
| FR-43 | After restoring, scale-up must mark the snapshot as restored (`restored_at`, `replicas_restored`, `wake_execution_id`) |
| FR-44 | Scale-up does not provision nodes — Karpenter/CA provisions new nodes as pods become Pending |
| FR-45 | In plan mode, all restore operations must be logged without mutating any resource or marking any snapshot |
| FR-46 | On first wake after migration from v1: if no DB snapshot exists, fall back to the `previous-replicas` annotation; create a snapshot record retroactively; remove the annotation |

### 6.7 Guardrails

#### Global Guardrails (platform-level, always enforced)

| ID | Requirement |
|----|-------------|
| FR-47 | Global guardrails are a singleton configuration row — one set of rules that applies to every policy execution |
| FR-48 | `skip_namespaces`: workloads in listed namespaces are never scaled by any policy |
| FR-49 | `skip_ns_node`: nodes running pods from listed namespaces are never drained or deleted |
| FR-50 | `skip_node_labels`: nodes bearing matching `key=value` labels are protected |
| FR-51 | `skip_node_taints`: nodes bearing matching `key=value:effect` taints are protected |
| FR-52 | `kube-system` must be pre-populated in `skip_namespaces` at seed time |

#### Per-Policy Guardrails (additive, scoped to one policy)

| ID | Requirement |
|----|-------------|
| FR-53 | Each policy may have its own guardrails row; per-policy rules are additive — they can only restrict further, never relax a global guardrail |
| FR-54 | `skip_workloads`: specific Deployment/StatefulSet names to never touch, even if they fall within the policy's namespace filter |
| FR-55 | `skip_namespaces`: additional namespace exclusions within this policy's scope |
| FR-56 | `skip_ns_node`, `skip_node_labels`, `skip_node_taints`: same semantics as global, scoped to this policy |
| FR-57 | `min_replicas`: floor — scale to this value instead of 0. Applies to all workloads governed by this policy. `0` = full sleep (default) |
| FR-58 | `workload_overrides` JSONB column is reserved for future per-workload `min_replicas` and must be stored but not evaluated in v2 |

#### Evaluation Order

| ID | Requirement |
|----|-------------|
| FR-59 | Guardrail evaluation order (first match wins, stops evaluation): global `skip_namespaces` → global node rules → policy `skip_workloads` → policy `skip_namespaces` → policy `min_replicas` → policy node rules |
| FR-60 | Guardrail format must be validated before saving: `skip_node_labels` must match `key=value` and `skip_node_taints` must match `key=value:effect`. Invalid entries must be rejected with a descriptive error message |
| FR-61 | Guardrails must be applied consistently in scheduled, manual trigger, and drift correction executions |

### 6.8 Conflict Detection

| ID | Requirement |
|----|-------------|
| FR-62 | Conflict detection must run on every policy save (create and update) |
| FR-63 | A **direct conflict** exists when two policies share at least one day, their sleep windows overlap in time, and they govern overlapping namespaces — tag both policies `CONFLICT` |
| FR-64 | An **absorbed policy** exists when policy B's awake window is fully contained within policy A's awake window on every shared day — policy B has no independent effect — tag it `ABSORBED` |
| FR-65 | A **no-op policy** exists when all namespaces in the policy's filter are already covered by global `skip_namespaces` — the policy never executes — tag it `NO-OP` |
| FR-66 | A **guardrail shadow** exists when a policy-level rule duplicates an already-enforced global rule — flag as informational |
| FR-67 | Conflict detection never blocks saving — it tags and notifies but the policy is always persisted |
| FR-68 | Both policies involved in a conflict must be tagged, not just the newer one |
| FR-69 | Conflict tags must be recomputed whenever a related policy changes; resolved conflicts must clear their tags |

### 6.9 Notifications

| ID | Requirement |
|----|-------------|
| FR-70 | Notifications are UI-only and admin-facing — no external delivery in v2 |
| FR-71 | Notifications must persist in the database until explicitly dismissed |
| FR-72 | Notification types: `conflict`, `no_op`, `absorbed`, `execution_failed`, `drift_corrected`, `guardrail_shadow` |
| FR-73 | Notification severities: `error`, `warning`, `info` |
| FR-74 | The UI must display a bell icon with unread notification count in the sidebar |
| FR-75 | Notifications must be individually dismissible and bulk-dismissible ("dismiss all") |
| FR-76 | Each notification must link to the relevant policy or execution record |
| FR-77 | A notification must be generated on: conflict detection, execution failure, drift correction (record mode only), policy becoming no-op or absorbed |

### 6.10 Skip Next Occurrence

| ID | Requirement |
|----|-------------|
| FR-78 | Any policy occurrence (sleep edge, wake edge, or both) must be skippable via a self-service action in the UI |
| FR-79 | A skip override must be scoped to a specific calendar date and edge (`sleep`, `wake`, or `both`) |
| FR-80 | Active skips must be visible on the policy card as a dismissible pill on the next-run timestamp |
| FR-81 | Skipped occurrences must appear in History with `status: skipped` — they must not be silently absent |
| FR-82 | After the skipped date passes, the override record must be automatically purged |
| FR-83 | Cancelling a skip (clicking the pill's X) must immediately remove the override and restore the next occurrence |

### 6.11 Execution History and Audit

| ID | Requirement |
|----|-------------|
| FR-84 | Every execution (scheduled, manual, drift correction, skipped) must be recorded |
| FR-85 | Execution record must include: `policy_id`, `execution_type`, `started_at`, `finished_at`, `status`, `mode`, and counters (scaled, drained, deleted, skipped, errors) |
| FR-86 | `execution_type` values: `scheduled`, `manual`, `drift_correction`, `skipped` |
| FR-87 | `status` values: `running`, `success`, `failed`, `skipped` |
| FR-88 | Every operation within an execution must produce a log line with level, message, and timestamp |
| FR-89 | Log levels: `info`, `ok`, `plan`, `warn`, `error` |
| FR-90 | History must be paginated and filterable by policy, execution type, status, and date range |

### 6.12 Live Log Streaming

| ID | Requirement |
|----|-------------|
| FR-91 | The system must stream log lines in real-time via WebSocket while an execution is running |
| FR-92 | On WebSocket connect, all previously emitted log lines must be replayed to the client |
| FR-93 | The WebSocket connection must close automatically when the execution finishes |
| FR-94 | Ping/pong heartbeat: 30s interval, 60s pong timeout |

### 6.13 Cluster State Visibility

| ID | Requirement |
|----|-------------|
| FR-95 | System must list all Deployments and StatefulSets with: current replicas, saved replicas (from `workload_snapshots`), ready replicas, and governing policy name |
| FR-96 | Workload status: `running`, `sleeping`, `partial`, `unmanaged` |
| FR-97 | System must list all nodes with CPU/memory allocatable vs. requested, pod count, and protection status |
| FR-98 | System must expose per-node pod list (excluding DaemonSets, resolving Deployment owners) |
| FR-99 | Workloads not covered by any policy must show status `unmanaged` — distinct from sleeping |

### 6.14 Manual Trigger

| ID | Requirement |
|----|-------------|
| FR-100 | Any policy must be manually triggerable (sleep or wake edge) independent of its schedule |
| FR-101 | Manual trigger must accept an override mode (`plan` or `apply`) |
| FR-102 | Manual trigger must return an execution ID immediately (202 Accepted, async) |

### 6.15 Health Check

| ID | Requirement |
|----|-------------|
| FR-103 | `GET /healthz` must ping the database and return 200 if healthy, 503 otherwise |
| FR-104 | The health endpoint must be exempt from authentication |

---

## 7. Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-01 | Deployment | Single OCI image installable via Helm chart |
| NFR-02 | Deployment | Single binary (`kube-phoenix`); no nginx or external file server |
| NFR-03 | Availability | Single-replica deployment; restart policy covers recovery |
| NFR-04 | Resource Usage | Requests ≤ 50m CPU / 64Mi; limits ≤ 200m CPU / 256Mi |
| NFR-05 | Security | Non-root user, distroless base image |
| NFR-06 | Security | API protected by HTTP Basic Auth via K8s Secret |
| NFR-07 | Security | Auth disabled when `BASIC_AUTH_*` env vars are unset (dev mode) |
| NFR-08 | Security | RBAC follows least-privilege (see §9) |
| NFR-09 | Observability | Structured JSON logs to stdout |
| NFR-10 | Observability | All execution operations recorded to DB for audit |
| NFR-11 | Compatibility | Kubernetes 1.28+ |
| NFR-12 | Compatibility | PostgreSQL 14+ (tested on 16) |
| NFR-13 | Build | Multi-stage Dockerfile; final image contains only the compiled binary |
| NFR-14 | Build | CI blocks on CRITICAL/HIGH CVEs (Trivy) |
| NFR-15 | CI/CD | Short SHA tags on master push; semver on release |
| NFR-16 | Helm | Supports in-cluster PostgreSQL and external DB (RDS, Cloud SQL) |

---

## 8. System Architecture

```
┌──────────────────────────────────────────────────────┐
│  Browser (Next.js SPA — embedded in Go binary)       │
│  Dark-theme MUI v6, TanStack Query v5                │
│  6 screens: Overview, Policies, Cluster State,       │
│             Guardrails, History, Notifications       │
└─────────────────────┬────────────────────────────────┘
                      │ HTTP REST / WebSocket
                      │ /api/* + /ws/*
┌─────────────────────▼────────────────────────────────┐
│  Go Backend (Chi router, port 8080)                  │
│                                                      │
│  ┌──────────────────┐   ┌─────────────────────────┐  │
│  │ Desired-State    │   │ REST API Handlers        │  │
│  │ Engine           │   │                         │  │
│  │ ┌─────────────┐  │   │ /api/policies           │  │
│  │ │ Scheduler   │  │   │ /api/executions         │  │
│  │ │ (native Go  │  │   │ /api/cluster            │  │
│  │ │  loop)      │  │   │ /api/guardrails         │  │
│  │ └──────┬──────┘  │   │ /api/notifications      │  │
│  │        │notify   │   └───────────┬─────────────┘  │
│  │ ┌──────▼──────┐  │               │                │
│  │ │ Reconciler  │  │               │                │
│  │ │ (startup +  │  │               │                │
│  │ │  drift)     │  │               │                │
│  │ └──────┬──────┘  │               │                │
│  └────────┼─────────┘               │                │
│           │                         │                │
│  ┌────────▼─────────────────────────▼────────────┐   │
│  │  Scaler (scale_down / scale_up)               │   │
│  │  Conflict Detector                            │   │
│  │  Notification Generator                       │   │
│  └────────────────────┬──────────────────────────┘   │
│                       │                              │
│  ┌────────────────────▼──────────────────────────┐   │
│  │  GORM Store (PostgreSQL)                      │   │
│  └────────────────────┬──────────────────────────┘   │
│                       │                              │
│  ┌────────────────────▼──────────────────────────┐   │
│  │  K8s Client (client-go)                       │   │
│  └───────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
          │                         │
   ┌──────▼──────┐       ┌──────────▼───────┐
   │ PostgreSQL  │       │ Kubernetes API   │
   └─────────────┘       └──────────────────┘
```

**Single-binary SPA delivery:** `//go:embed static` serves the pre-built Next.js `out/` directory.

**Desired-state engine:** Replaces `robfig/cron`. A native Go event loop computes next-event times directly from policy window definitions. On startup and periodically, a reconciler compares actual cluster state to policy-defined desired state and corrects divergence.

**DB as state store:** `workload_snapshots` replaces `previous-replicas` annotations. PostgreSQL is the single source of truth for replica state during sleep cycles.

**Broker pattern:** In-memory pub/sub broker distributes log lines from scaler goroutines to connected WebSocket clients.

**Scheduler notify channel:** Policy CRUD operations send a signal to the scheduler loop, which breaks its sleep and recomputes next events immediately.

---

## 9. Kubernetes RBAC

Service account `kube-phoenix` (namespace: `kube-phoenix`) bound to a `ClusterRole`:

| API Group | Resource | Verbs |
|-----------|----------|-------|
| `""` | `namespaces`, `pods` | `get`, `list`, `watch` |
| `""` | `nodes` | `get`, `list`, `watch`, `patch`, `update`, `delete` |
| `policy` | `pods/eviction` | `create` |
| `apps` | `deployments`, `statefulsets` | `get`, `list`, `watch`, `update`, `patch` |
| `apps` | `deployments/scale`, `statefulsets/scale` | `get`, `update`, `patch` |

---

## 10. Database Schema

### 10.1 `sleep_policies`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | SERIAL | PK | |
| `name` | VARCHAR(255) | NOT NULL | Human-readable label |
| `description` | TEXT | | Optional |
| `tags` | TEXT | NOT NULL DEFAULT `''` | Comma-separated free-text labels for SRE organisation |
| `timezone` | VARCHAR(100) | NOT NULL DEFAULT `'UTC'` | IANA timezone |
| `mode` | VARCHAR(10) | NOT NULL DEFAULT `'plan'` | `plan` \| `apply` |
| `namespace_filter` | TEXT | NOT NULL DEFAULT `''` | Comma-separated; empty = governs all namespaces |
| `enabled` | BOOLEAN | NOT NULL DEFAULT `true` | |
| `drift_correction_mode` | VARCHAR(10) | NOT NULL DEFAULT `'record'` | `record` \| `silent` |
| `timeout_minutes` | INT | NOT NULL DEFAULT `0` | `0` = use 120 min default |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

**Indexes:** none beyond PK (low row count; full scans acceptable)

---

### 10.2 `policy_windows`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | SERIAL | PK | |
| `policy_id` | INT | NOT NULL, FK → `sleep_policies(id)` ON DELETE CASCADE | |
| `days_of_week` | TEXT | NOT NULL | JSON array: `["mon","tue","wed","thu","fri"]` |
| `sleep_at` | VARCHAR(5) | NOT NULL | `"19:00"` — time to sleep on these days |
| `wake_at` | VARCHAR(5) | | `"06:00"` — null = sleep-only, no auto-wake |
| `advanced_rules` | JSONB | | null in simple mode. Schema: `{date_ranges: [{from, to}], exceptions: ["YYYY-MM-DD"]}` |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

**Indexes:** `(policy_id)`

**Notes:**
- Overnight windows are expressed naturally: `sleep_at: "19:00"`, `wake_at: "06:00"`. When `wake_at < sleep_at` the wake fires the following calendar day.
- A policy with one window Mon–Fri `sleep_at: 19:00` / `wake_at: 06:00` implicitly covers weekends: the Friday sleep fires at 19:00 and the Monday wake fires at 06:00, covering Saturday and Sunday entirely.
- Multiple windows per policy model different day groups within one intent.

---

### 10.3 `policy_guardrails`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | SERIAL | PK | |
| `policy_id` | INT | NOT NULL, UNIQUE, FK → `sleep_policies(id)` ON DELETE CASCADE | One row per policy |
| `skip_workloads` | TEXT | NOT NULL DEFAULT `''` | Comma-separated Deployment/StatefulSet names |
| `skip_namespaces` | TEXT | NOT NULL DEFAULT `''` | Additional namespace exclusions within this policy's scope |
| `skip_ns_node` | TEXT | NOT NULL DEFAULT `''` | Comma-separated namespaces whose pods protect nodes |
| `skip_node_labels` | TEXT | NOT NULL DEFAULT `''` | `key=value,...` |
| `skip_node_taints` | TEXT | NOT NULL DEFAULT `''` | `key=value:effect,...` |
| `min_replicas` | INT | NOT NULL DEFAULT `0` | Floor replica count; `0` = full sleep |
| `workload_overrides` | JSONB | | Reserved — null in v2; future per-workload `min_replicas` |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

**Notes:** Created automatically (empty) when a policy is created. Never deleted independently — cascades with policy.

---

### 10.4 `global_guardrails`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INT | PK DEFAULT `1`, CHECK `id = 1` | Singleton — always one row |
| `skip_namespaces` | TEXT | NOT NULL DEFAULT `''` | `kube-system` pre-populated at seed |
| `skip_ns_node` | TEXT | NOT NULL DEFAULT `''` | |
| `skip_node_labels` | TEXT | NOT NULL DEFAULT `''` | |
| `skip_node_taints` | TEXT | NOT NULL DEFAULT `''` | |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

---

### 10.5 `policy_overrides`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | SERIAL | PK | |
| `policy_id` | INT | NOT NULL, FK → `sleep_policies(id)` ON DELETE CASCADE | |
| `occurrence_date` | DATE | NOT NULL | The specific calendar date being skipped |
| `edge` | VARCHAR(10) | NOT NULL | `sleep` \| `wake` \| `both` |
| `action` | VARCHAR(20) | NOT NULL DEFAULT `'skip'` | Extensible: `extend_until` in future |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| UNIQUE | | `(policy_id, occurrence_date, edge)` | |

**Indexes:** `(policy_id, occurrence_date)`

**Notes:** Rows with `occurrence_date < CURRENT_DATE` are stale and purged by the scheduler on startup and after each event loop iteration.

---

### 10.6 `workload_snapshots`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | SERIAL | PK | |
| `sleep_execution_id` | INT | NOT NULL, FK → `executions(id)` | Which sleep run captured this |
| `wake_execution_id` | INT | FK → `executions(id)` | null until restored |
| `policy_id` | INT | FK → `sleep_policies(id)` ON DELETE SET NULL | null for manual triggers |
| `namespace` | VARCHAR(255) | NOT NULL | |
| `workload_name` | VARCHAR(255) | NOT NULL | |
| `workload_kind` | VARCHAR(50) | NOT NULL | `Deployment` \| `StatefulSet` |
| `replicas_before` | INT | NOT NULL | Replica count at time of sleep |
| `replicas_restored` | INT | | null until restored; may differ from `replicas_before` if workload was scaled manually between sleep and wake |
| `snapshotted_at` | TIMESTAMPTZ | NOT NULL | |
| `restored_at` | TIMESTAMPTZ | | null until restored |

**Indexes:** `(namespace, workload_name, restored_at)`, `(sleep_execution_id)`, `(policy_id)`

---

### 10.7 `executions`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | SERIAL | PK | |
| `policy_id` | INT | FK → `sleep_policies(id)` ON DELETE SET NULL | null if policy was deleted after execution |
| `execution_type` | VARCHAR(30) | NOT NULL DEFAULT `'scheduled'` | `scheduled` \| `manual` \| `drift_correction` \| `skipped` |
| `started_at` | TIMESTAMPTZ | NOT NULL | Indexed |
| `finished_at` | TIMESTAMPTZ | | null while running |
| `status` | VARCHAR(20) | NOT NULL | `running` \| `success` \| `failed` \| `skipped` |
| `mode` | VARCHAR(10) | NOT NULL | `plan` \| `apply` |
| `count_scaled` | INT | NOT NULL DEFAULT `0` | |
| `count_drained` | INT | NOT NULL DEFAULT `0` | |
| `count_deleted` | INT | NOT NULL DEFAULT `0` | |
| `count_skipped` | INT | NOT NULL DEFAULT `0` | |
| `count_errors` | INT | NOT NULL DEFAULT `0` | |

**Indexes:** `(policy_id)`, `(started_at DESC)`, `(status)`

---

### 10.8 `log_lines`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | SERIAL | PK | |
| `execution_id` | INT | NOT NULL, FK → `executions(id)` ON DELETE CASCADE | |
| `seq` | INT | NOT NULL | Monotonic per execution |
| `level` | VARCHAR(10) | NOT NULL | `info` \| `ok` \| `plan` \| `warn` \| `error` |
| `message` | TEXT | NOT NULL | |
| `timestamp` | TIMESTAMPTZ | NOT NULL | |
| UNIQUE | | `(execution_id, seq)` | |

**Indexes:** `(execution_id, seq)`

---

### 10.9 `notifications`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | SERIAL | PK | |
| `policy_id` | INT | FK → `sleep_policies(id)` ON DELETE SET NULL | null for cluster-level notifications |
| `execution_id` | INT | FK → `executions(id)` ON DELETE SET NULL | null for non-execution notifications |
| `type` | VARCHAR(50) | NOT NULL | `conflict` \| `no_op` \| `absorbed` \| `execution_failed` \| `drift_corrected` \| `guardrail_shadow` |
| `severity` | VARCHAR(10) | NOT NULL | `error` \| `warning` \| `info` |
| `message` | TEXT | NOT NULL | Human-readable summary |
| `detail` | JSONB | | Structured data: conflicting policy IDs, overlap window, affected namespaces |
| `read` | BOOLEAN | NOT NULL DEFAULT `false` | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| `dismissed_at` | TIMESTAMPTZ | | null until dismissed |

**Indexes:** `(read, created_at DESC)`, `(policy_id)`, `(dismissed_at)` (partial, WHERE NULL for active notifications)

---

### 10.10 Entity Relationship Summary

```
sleep_policies ──< policy_windows
sleep_policies ──  policy_guardrails (1:1)
sleep_policies ──< policy_overrides
sleep_policies ──< executions
sleep_policies ──< workload_snapshots
sleep_policies ──< notifications

executions ──< log_lines
executions ──< workload_snapshots (sleep_execution_id)
executions ──< workload_snapshots (wake_execution_id)
executions ──< notifications
```

---

## 11. Database Logic

### 11.1 Scheduler: Computing Next Event Time

The scheduler loop calls `computeNextEvent(policies []SleepPolicy, now time.Time)` on each iteration.

For each policy:
1. Load all `policy_windows` for the policy.
2. For each window, compute the next `sleep_at` fire time and the next `wake_at` fire time (if `wake_at` is not null) relative to `now`.
3. For overnight windows (`wake_at < sleep_at`): the wake fires the following calendar day.
4. Check `policy_overrides` for the computed occurrence date — if a matching override exists with `action: skip`, skip that edge and advance to the next occurrence.
5. Collect all candidate fire times across all policies; return the minimum.

The loop sleeps until that time using `time.NewTimer`. A `notifyChannel` select case breaks the sleep early when a policy is saved.

---

### 11.2 Desired-State Reconciliation

Called on startup and every 15 minutes (drift check).

```
for each namespace in cluster:
  policies = SELECT * FROM sleep_policies
             WHERE enabled = true
               AND (namespace_filter = '' OR namespace IN namespace_filter)

  if len(policies) == 0:
    state = UNMANAGED → skip

  desiredState = SLEEP  // default
  for each policy in policies:
    if currentTime is within any awake window of policy:
      desiredState = AWAKE  // awake wins
      break

  actualState = k8s.GetWorkloadStates(namespace)

  if desiredState == AWAKE and actualState == SLEEPING:
    → fire scale_up execution (drift_correction)
  if desiredState == SLEEP and actualState == RUNNING:
    → fire scale_down execution (drift_correction)
  if desiredState == actualState:
    → no action
```

If policy `drift_correction_mode = 'silent'`: apply the correction but do not insert an `executions` row and do not generate a notification.

---

### 11.3 Scale-Down Snapshot Write

```
BEGIN TRANSACTION
  current = k8s.GetReplicas(namespace, workload_name)
  if current == 0: ROLLBACK, skip workload

  INSERT INTO workload_snapshots (
    sleep_execution_id, policy_id, namespace, workload_name,
    workload_kind, replicas_before, snapshotted_at
  ) VALUES (...)

  k8s.Scale(namespace, workload_name, max(0, policy.min_replicas))
COMMIT
```

If the transaction commits but `k8s.Scale` fails: the snapshot exists with no corresponding cluster change. The reconciler will detect the workload is still running when the policy says it should be sleeping and retry on the next drift check.

---

### 11.4 Scale-Up Snapshot Read and Mark

```
-- Find the oldest unrestored snapshot for this workload
snapshot = SELECT * FROM workload_snapshots
           WHERE namespace = $1
             AND workload_name = $2
             AND restored_at IS NULL
           ORDER BY snapshotted_at ASC
           LIMIT 1

if snapshot IS NULL:
  log WARN "no snapshot found, skipping"
  count_skipped++
  continue

k8s.Scale(namespace, workload_name, snapshot.replicas_before)

UPDATE workload_snapshots SET
  wake_execution_id = $wakeExecId,
  replicas_restored = snapshot.replicas_before,
  restored_at = NOW()
WHERE id = snapshot.id
```

Ordering by `snapshotted_at ASC` ensures that if two sleep runs fired before a wake (edge case), the original pre-sleep replica count is restored.

---

### 11.5 Cluster State: Saved Replicas Query

Used by `GET /api/cluster/workloads` to populate the "saved replicas" column without calling the K8s API per workload:

```sql
SELECT
  s.namespace,
  s.workload_name,
  s.workload_kind,
  s.replicas_before,
  sp.name AS governed_by
FROM workload_snapshots s
LEFT JOIN sleep_policies sp ON sp.id = s.policy_id
WHERE s.restored_at IS NULL
ORDER BY s.snapshotted_at DESC
```

Joined against the live workload list from the K8s API in the handler.

---

### 11.6 Conflict Detection Logic

Runs synchronously on every policy save before the HTTP response is returned.

```
newPolicy = the policy being saved

candidates = SELECT * FROM sleep_policies
             WHERE id != newPolicy.id AND enabled = true

for each candidate in candidates:
  sharedDays = intersection(newPolicy.days_of_week, candidate.days_of_week)
  if sharedDays is empty: continue

  sharedNamespaces = namespaceOverlap(newPolicy.namespace_filter, candidate.namespace_filter)
  if sharedNamespaces is empty: continue

  // Check time overlap per shared day (handle overnight windows)
  if windowsOverlap(newPolicy.windows, candidate.windows, sharedDays):
    tag both policies CONFLICT
    INSERT notification (type: conflict, policy_id: newPolicy.id, ...)
    INSERT notification (type: conflict, policy_id: candidate.id, ...)

  // Check absorption
  if allWindowsContained(newPolicy.windows, candidate.windows):
    tag candidate ABSORBED
    INSERT notification (type: absorbed, policy_id: candidate.id, ...)
```

`namespaceOverlap`: returns true if either filter is empty (all namespaces) or they share at least one namespace string.

`windowsOverlap`: converts each window to a set of (day, start_minutes, end_minutes) tuples, expanding overnight windows to two tuples (pre-midnight and post-midnight), then checks for intersection.

---

### 11.7 Policy Override Check

Before the scheduler fires any edge, it checks:

```sql
SELECT 1 FROM policy_overrides
WHERE policy_id = $1
  AND occurrence_date = $2
  AND (edge = $3 OR edge = 'both')
  AND action = 'skip'
LIMIT 1
```

If a row is found: create an `executions` row with `execution_type: skipped`, `status: skipped`, do not invoke the scaler, then advance to the next occurrence of this edge.

---

### 11.8 Stale Override Purge

On scheduler startup and after each event loop iteration:

```sql
DELETE FROM policy_overrides
WHERE occurrence_date < CURRENT_DATE
```

---

### 11.9 Migration: Annotation Fallback

On the first scale-up execution after upgrading from v1:

```
snapshot = SELECT * FROM workload_snapshots WHERE workload_name = X AND restored_at IS NULL

if snapshot IS NULL:
  annotation = k8s.GetAnnotation(workload, "previous-replicas")
  if annotation != "":
    replicas = parseInt(annotation)
    INSERT INTO workload_snapshots (replicas_before = replicas, ...) // retroactive
    k8s.Scale(workload, replicas)
    k8s.RemoveAnnotation(workload, "previous-replicas")
  else:
    log WARN "no snapshot and no annotation, skipping"
```

After one full sleep/wake cycle all state is in the DB. Annotation fallback code is removed in the following release.

---

## 12. API Surface

### Policy Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/policies` | Basic | List all policies with next-event times and conflict tags |
| `POST` | `/api/policies` | Basic | Create policy (runs conflict detection, creates guardrails row) |
| `GET` | `/api/policies/{id}` | Basic | Fetch policy with windows, guardrails, active overrides |
| `PUT` | `/api/policies/{id}` | Basic | Update policy (re-runs conflict detection, notifies scheduler) |
| `DELETE` | `/api/policies/{id}` | Basic | Delete policy |
| `GET` | `/api/policies/{id}/windows` | Basic | List windows for a policy |
| `POST` | `/api/policies/{id}/windows` | Basic | Add window to policy |
| `PUT` | `/api/policies/{id}/windows/{wid}` | Basic | Update window |
| `DELETE` | `/api/policies/{id}/windows/{wid}` | Basic | Remove window |
| `GET` | `/api/policies/{id}/guardrails` | Basic | Fetch per-policy guardrails |
| `PUT` | `/api/policies/{id}/guardrails` | Basic | Update per-policy guardrails |
| `POST` | `/api/policies/{id}/overrides` | Basic | Create skip override for next occurrence |
| `DELETE` | `/api/policies/{id}/overrides/{date}/{edge}` | Basic | Cancel a skip override |

### Execution Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/executions` | Basic | List executions (paginated; filter: policy_id, type, status, date range) |
| `GET` | `/api/executions/{id}` | Basic | Fetch execution with policy |
| `GET` | `/api/executions/{id}/logs` | Basic | Fetch all log lines |
| `POST` | `/api/trigger` | Basic | Manual trigger — body: `{policyId, edge, mode}` → 202 `{executionId}` |

### Cluster Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/cluster/workloads` | Basic | Workloads with replica status and governing policy |
| `GET` | `/api/cluster/nodes` | Basic | Nodes with protection status and resource usage |
| `GET` | `/api/cluster/nodes/{name}/pods` | Basic | Pods on a specific node |

### Guardrails & Notifications

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/guardrails` | Basic | Fetch global guardrails |
| `PUT` | `/api/guardrails` | Basic | Update global guardrails |
| `GET` | `/api/notifications` | Basic | List notifications (filter: read, dismissed, severity) |
| `PATCH` | `/api/notifications/{id}` | Basic | Mark read or dismiss |
| `DELETE` | `/api/notifications` | Basic | Dismiss all |

### Health & WebSocket

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/healthz` | None | Database ping liveness check |
| `GET` (WS) | `/ws/executions/{id}/logs` | Basic | Live log stream |

---

## 13. Helm Chart Requirements

| Requirement | Notes |
|-------------|-------|
| In-cluster PostgreSQL (opt-in) | StatefulSet, 1Gi PVC, configurable auth |
| External database (opt-in) | Full DSN or individual fields; supports RDS/Cloud SQL |
| Ingress (opt-in) | Any IngressClass; supports TLS |
| AWS ALB TargetGroupBinding (opt-in) | For AWS-native load balancing |
| Existing Secret support | `secret.existingSecret` skips Secret creation |
| Configurable basic auth | `secret.basicAuthUser` + `secret.basicAuthPassword` |
| Namespace creation | `createNamespace: true` by default |

---

## 14. CI/CD Pipeline

| Stage | Tool | Trigger | Notes |
|-------|------|---------|-------|
| Frontend build + audit | Node.js 22 | PR / push | `npm audit --audit-level=high` blocks |
| Backend build + vet + test | Go 1.25 + golangci-lint | PR / push | Coverage report |
| Helm lint | Helm 3 | PR / push | |
| Docker build + Trivy scan | Buildx + Trivy | PR / push | CRITICAL/HIGH CVE fails |
| Docker push to GHCR | Buildx | master only | Tags: short SHA + `latest` |
| Release + semver | release-please | master push | CHANGELOG, GitHub Release, Chart.appVersion bump |
| Helm chart publish | Helm + GHCR | On release | `oci://ghcr.io/macxsimilian/helm` |

---

## 15. Default Seed Data

On first startup (empty database):

**Sleep Policy: "Business Hours"**

| Field | Value |
|-------|-------|
| Timezone | UTC |
| Mode | `plan` |
| Namespace filter | (all) |
| Drift correction | `record` |
| Enabled | true |

| Window | Days | Sleep at | Wake at |
|--------|------|----------|---------|
| Weeknights + Weekend | Mon–Fri | 19:00 | 06:00 |

This single window sleeps the cluster from Monday–Friday at 19:00 and wakes it at 06:00 the next morning. The Friday sleep carries through to Monday morning, covering the weekend implicitly.

**Global Guardrails (singleton ID=1):**

| Field | Value |
|-------|-------|
| `skip_namespaces` | `kube-system,kube-phoenix` |
| All other fields | empty |

All seeded in `plan` mode. Operators must explicitly switch to `apply` after reviewing plan output.

---

## 16. Configuration Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL DSN. Fatal if missing. |
| `BASIC_AUTH_USER` | No | — | HTTP Basic Auth username. Auth disabled if unset. |
| `BASIC_AUTH_PASSWORD` | No | — | HTTP Basic Auth password. Auth disabled if unset. |

---

## 17. Roadmap (Out of Scope for v2)

| Feature | Priority | Notes |
|---------|----------|-------|
| Keycloak OIDC | High | Replace HTTP Basic Auth; per-user audit trail and policy ownership |
| Per-workload `min_replicas` | Medium | `workload_overrides` JSONB column is reserved; schema migration not required |
| Slack/email notifications | Medium | Trigger on execution failure and conflict detection |
| Multi-cluster support | Medium | Multiple kubeconfig contexts |
| Holiday calendar | Low | Named calendars (uk-public-holidays etc.) as reusable exception sets |
| `extend_until` override | Low | `policy_overrides.action` field is extensible; scheduler logic only |
| GitLab CI/CD | Low | Mirror of GitHub Actions pipeline |
| PostgreSQL K8s manifest / RDS decision | High | Production database strategy not finalised |

---

## 18. Glossary

| Term | Definition |
|------|------------|
| Sleep Policy | A single declarative object that defines when a cluster (or subset of namespaces) should be awake. Everything outside awake windows is sleeping. |
| Policy Window | A row within a policy defining a set of days and a sleep/wake time pair. Multiple windows model different day groups within one policy. |
| Desired-State Engine | The scheduler + reconciler combination that computes desired cluster state from policies and corrects divergence, as opposed to a simple cron event-firer. |
| Awake wins | The conflict resolution rule: a namespace stays awake if any active governing policy says it should be awake at the current time. |
| Unmanaged | A namespace not covered by any policy. The system never touches it. |
| Drift correction | A reconciliation action taken when actual cluster state diverges from policy desired state, e.g. after a pod restart or manual intervention. |
| Skip override | A per-occurrence record that causes the scheduler to skip one specific sleep or wake edge on a specific calendar date. |
| Workload snapshot | A PostgreSQL row recording the replica count of a workload at the time it was slept. Replaces the `previous-replicas` Kubernetes annotation. |
| Global guardrails | Platform-level protection rules that apply to every policy execution and cannot be overridden by per-policy guardrails. |
| Per-policy guardrails | Additive protection rules scoped to one policy. They narrow the policy's scope; they cannot relax global guardrails. |
| min_replicas | A per-policy floor: scale workloads to this value instead of 0. `0` = full sleep. |
| Plan mode | Execute logic, log all operations as would-be actions, make no cluster changes. |
| Apply mode | Execute logic and apply all changes to the cluster. |
| Broker | In-memory pub/sub component distributing live log lines to WebSocket clients. |
| Absorbed | A conflict tag indicating a policy's awake windows are entirely contained within another policy's windows — it has no independent effect. |
| NO-OP | A conflict tag indicating a policy's namespace filter is fully covered by global `skip_namespaces` — the policy never executes. |
