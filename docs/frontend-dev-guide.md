# Frontend Developer Guide

> Deep-dive technical documentation for contributors working on the kube-phoenix frontend.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Project Structure](#2-project-structure)
3. [Architecture Patterns](#3-architecture-patterns)
4. [API Layer Deep Dive](#4-api-layer-deep-dive)
5. [Component Architecture](#5-component-architecture)
6. [Shared Utilities Deep Dive](#6-shared-utilities-deep-dive)
7. [State Management](#7-state-management)
8. [Styling Patterns](#8-styling-patterns)
9. [Real-Time Data Flows](#9-real-time-data-flows)
10. [Observability](#10-observability)
11. [Adding New Features Guide](#11-adding-new-features-guide)

---

## 1. Overview

The kube-phoenix frontend is the operator-facing UI for managing Kubernetes sleep/wake policies. It lets operators view cluster state (workloads, nodes, pods), create and manage scheduling policies with sleep windows, monitor live execution logs, configure guardrails, and administer users. The entire application is a client-side SPA with no server-side rendering -- the Go backend serves it as static files embedded in the binary.

**Tech stack:**

| Layer | Version | Notes |
|:------|:--------|:------|
| Next.js | 16 (static export, `output: 'export'`) | |
| React | 19 | |
| MUI (Material UI) | v9 | |
| TanStack Query | v5 | |
| Emotion | v11 (MUI's styling engine) | |
| Framer Motion | 12 | Sidebar morph, drawer slide, log animations |
| TypeScript | 6 | |

**Dependency notes:**

- `three`, `@react-three/fiber`, and `@react-three/drei` were removed (unused).
- `react-window` is listed as a dependency but not currently used (evaluated for log virtualization).
- GSAP is lazy-loaded via dynamic `import()` in `ApiRivers` rather than eagerly imported.

**Running locally:**

```bash
make dev-frontend    # starts Next.js dev server on port 3000
```

The dev server proxies API requests to the Go backend (default `http://localhost:8080`). Set `NEXT_PUBLIC_API_URL` to override the backend URL.

**Build output:** `next build` produces a fully static SPA in `frontend/out/`. The Go binary embeds this directory via `//go:embed` and serves it with an SPA fallback handler (all non-API paths return `index.html`). There is no SSR, no API routes in Next.js, and no Node.js runtime in production.

---

## 2. Project Structure

```
frontend/
  mock-api/                     # Standalone mock API server for Mode 3 (frontend-only) development
    data.mjs                    # Seed data (policies, workloads, users, etc.)
    dev.mjs                     # Dev launcher script
    server.mjs                  # HTTP server entry point (port 4444)
    routes/                     # Route handler modules (*.mjs)
  src/
    app/                        # Next.js App Router pages
      page.tsx                  # Root redirect
      layout.tsx                # Root layout: Inter font, <Providers> wrapper
      providers.tsx             # Provider stack (QueryClient, Theme, Auth)
      overview/page.tsx         # /overview -- dashboard
      cluster/page.tsx          # /cluster -- workloads & nodes tabs
      policies/page.tsx         # /policies -- policy list
      policies/detail/page.tsx  # /policies/detail/?id=N -- single policy
      exceptions/page.tsx       # /exceptions -- calendar strip layout with history split
      history/page.tsx          # /history -- execution history
      audit/page.tsx            # /audit -- audit log (viewer and above)
      users/page.tsx            # /users -- user management (admin)
      settings/page.tsx         # /settings -- Command Center layout with collapsible sections: Profile & Identity, Cluster & Connection, Appearance, Security & Sessions, System Pulse, Danger Zone, About
      guardrails/page.tsx       # /guardrails -- guardrails editor
      observability/layout.tsx  # /observability layout -- wraps all observability routes in ObservabilityStreamProvider
      observability/page.tsx    # /observability -- observability center
      observability/[component]/page.tsx  # /observability/{component} -- component drill-down
      prototypes/                 # /prototypes/* -- in-app mockup gallery for shared components (committed, not gated)
    components/
      layout/
        Sidebar.tsx             # Navigation sidebar: collapsible/expandable with framer-motion, collapsed state persisted to localStorage, width 220px expanded / 64px collapsed
        AppShell.tsx            # Top-level layout wrapper with sidebar + content area
        AboutModal.tsx          # Version/about dialog
      auth/
        LoginScreen.tsx         # Login form (local + OIDC SSO button)
      overview/
        ClusterStatusCard.tsx   # SSE-driven cluster status with quick sleep/wake buttons
        ActivityFeed.tsx        # Recent executions list with inline log viewer
      cluster/
        WorkloadsTable.tsx      # Sortable/filterable workload table
        NodesTable.tsx          # Sortable/filterable node table with zone grouping
        WorkloadDetailDrawer.tsx # Resizable drawer: workload -> pods -> pod detail
        NodeDetailDrawer.tsx    # Resizable drawer: node -> pods -> pod detail
        PodDetailContent.tsx    # Pod metadata, containers, conditions, events
        PodLogViewer.tsx        # Live streaming pod logs (delegates to usePodLogStream + LogSearchBar)
        PodRow.tsx              # Shared table row for pod listings
        CollapsibleSection.tsx  # Accordion section with title, count badge, and expand/collapse toggle
        LabelChip.tsx           # Styled key=value chip for Kubernetes labels
        TaintChip.tsx           # Styled chip for Kubernetes taints with effect color coding
        MiniBar.tsx             # Compact resource utilization bar (CPU/memory) with label
        LogSearchBar.tsx        # Search input with match count and prev/next navigation
        DetailDrawer.tsx         # Shared resizable drawer with pod drill-down, search, and back navigation
        usePodLogStream.ts      # Hook: chunked HTTP streaming, line buffering, tail/follow lifecycle
        statusColors.ts         # Mode-aware workload/node/pod status color maps
      policies/
        PolicyCard.tsx          # Card for each policy in the list view
        CreatePolicyDialog.tsx  # Create/edit policy dialog with window picker + preview
        ExceptionDialog.tsx     # Create/edit scheduled exception
        ExceptionWindowPicker.tsx # Inline two-month range calendar + time steppers for the exception window
        ExceptionsSection.tsx   # Exception table in policy detail
        WeeklyTimeline.tsx      # SVG 7-day bar chart timeline
        LedGlowTimeline.tsx     # SVG 7-day LED-strip timeline with glow filters
        MiniTimeline.tsx        # Full-width single-day 24h sparkline for policy cards
        WindowPicker.tsx        # Sleep window editor with day buttons + time selectors
        LegendItem.tsx          # Shared timeline legend dot + label
        TimelineLegend.tsx      # Extracted legend strip for timelines (sleep, awake, exception)
        ExecutionHistoryTable.tsx # Execution table embedded in policy detail
        PolicyHeroBand.tsx      # Full-width hero band with gradient bg, state icon, action buttons
        PolicyMetadataRow.tsx   # Metadata row (timezone, namespace filter, label selector)
        timelineSegments.ts     # Shared segment computation for WeeklyTimeline + LedGlowTimeline
      history/
        ExecutionTable.tsx      # Paginated execution list (global history page)
        LogViewer.tsx           # WebSocket-driven execution log drawer (delegates to useExecutionLogs + ExecutionSummary)
        ExecutionSummary.tsx    # Accordion summary: parsed workloads grouped by namespace, node entries
        parseSummary.ts         # Regex-based log line parser → structured workload/node/error data
        useExecutionLogs.ts     # Hook: WebSocket streaming for running execs, REST fetch for completed
      audit/
        AuditRow.tsx            # Expandable table row with diff toggle
        DiffLineRow.tsx         # Single classified diff line with prefix symbol and colour
        JsonDiffView.tsx        # Side-by-side JSON diff panel (added/removed/changed/unchanged)
        auditDiff.ts            # Diff computation helpers (flattenToLeaves, classifyLine, computeDiff) + CSV export
        auditFormatters.ts      # ACTION_LABELS map, formatActionLabel(), actionColor() (moved from statusColors.ts)
      common/
        ChipInput.tsx           # Tag-style input: type + Enter to add chips, Backspace to remove
        LabeledSwitch.tsx       # Shared labeled toggle: Switch + bold title + caption description
        ConfirmDialog.tsx       # Shared confirmation dialog (title, message, confirm/cancel buttons)
        CenteredSpinner.tsx     # Centered CircularProgress spinner for loading states
        TriggerModeDialog.tsx   # Plan/apply mode selection dialog for policy triggers
      shared/
        StatusChip.tsx          # Reusable status chip with color mapping; supports hideSpinner prop (pulse animation for running state instead of spinner)
        TriggerChip.tsx         # Reusable chip displaying execution trigger type with icon and color
        PageHeader.tsx          # Unified page-title chrome: title, subtitle, breadcrumbs, actions, meta, tabs slots
        EmptyState.tsx          # Dashed-border placeholder card with title, optional description, icon, and action slot
      exceptions/
        ExceptionsCalendarStrip.tsx  # Calendar strip layout: day rows, span rows for multi-day, history split. Threads optional onExport down to each row.
        ExceptionDetailPanel.tsx     # Expandable detail grid (dates, duration, namespace filter, workload targets)
        ExceptionChips.tsx           # TypeChip (stay_awake/force_sleep) and StatusChipEx renderers
        ExceptionActions.tsx         # Edit / Export / Cancel icon buttons with stopPropagation
      guardrails/
        GuardrailsForm.tsx      # Collapsible category cards with stat pills (uses useReducer, CategoryCard). Toolbar has Save / Export / Import buttons.
        CategoryCard.tsx        # Reusable collapsible card: icon header, stat pills, chevron, expand body
        ProtectedChipInput.tsx  # ChipInput variant with removal confirmation dialog
      import/
        ImportDialog.tsx        # Kind-parameterised three-step dialog (paste/drag-drop → preview → apply). Renders kind-specific rich preview cards (changed-fields table for guardrails, side-by-side card for policy with green/amber highlights, structured card for exceptions). Resolves overwrite/rename for policy, single Apply for guardrails and exception.
        ExportMenu.tsx          # Shared anchor-positioned popover offering "Copy JSON to clipboard" and "Download .json" for every Export trigger site.
      settings/
        AccountSettings.tsx     # Timezone selector (defaults from user preference)
        DatabaseSettings.tsx    # Multi-step DB reset with confirmation phrase
        AppearanceSettings.tsx  # Light/dark/system theme selector with card header icon
        OIDCStatusCard.tsx      # OIDC provider connection status (green status bar)
        ActiveSessionsCard.tsx  # Active sessions list (fetches from GET /api/auth/sessions)
        ClusterConnectionCard.tsx # Kubernetes cluster connection details
        AboutBar.tsx            # Version and uptime footer bar
      observability/              # Observability center components
      ErrorBoundary.tsx         # React error boundary
    lib/
      animations.ts              # Shared CSS-in-JS animation constants (LOG_WATERFALL_SX)
      api.ts                    # Centralized fetch wrapper + all API functions
      auth.tsx                  # AuthContext provider, login/logout, refreshUser, session management
      types.ts                  # TypeScript interfaces for all backend models + shared UI types (SnackMessage, ClusterInfo, VersionInfo)
      colors.ts                 # Semantic color palette, useColors() hook, TIMELINE_COLORS
      statusColors.ts           # Color maps for states, executions, modes, types, log levels
      constants.ts              # Polling intervals, drawer constraints, log limits, timezones
      formatters.ts             # CPU/memory/time formatting utilities
      layoutConstants.ts        # Shared layout constants (BLEED_MARGIN_X, BLEED_PADDING_X)
      windowUtils.ts            # Sleep window evaluation, timezone handling, timeline math
      timelineUtils.ts          # Day labels and time-range-to-segment conversion for timelines
      rbac.ts                   # Permission checking helpers
      observability-types.ts    # TypeScript interfaces for observability metrics and streams
      observability-components.ts # Component metadata (display names, descriptions, icons) for drill-down pages
      ObservabilityStreamContext.tsx # Shared React context + provider for useObservabilityStream (persists SSE across route transitions)
      useObservabilityStream.ts # SSE hook for observability data streams
      motion/                   # Motion design tokens and animation utilities
        echartsTheme.ts         # ECharts theme configuration
        gsapAnimations.ts       # GSAP animation presets
        variants.ts             # Framer Motion variant definitions
      themeMode.tsx             # ThemeModeProvider context (light/dark/system + localStorage)
      queryClient.ts            # TanStack QueryClient singleton with default options
      queryKeys.ts              # Centralized query key factory for all TanStack Query keys
      useClusterStream.ts       # SSE hook: cluster/stream subscription with reconnect + TanStack cache injection
      useDebouncedValue.ts      # Generic debounce hook for search inputs
      useDrawerResize.ts        # Mouse/touch drag resize hook for side drawers (returns named object)
      useIsDark.ts              # Hook: returns boolean for dark mode (wraps useTheme)
      usePolicyTriggers.ts      # Shared sleep/wake mutation hook (invalidation + navigation)
      useTriStateSort.ts        # Hook: tri-state column sort (asc -> desc -> none)
      SortHeader.tsx            # Reusable sort-header cell for MUI tables (uses useTriStateSort)
      tableStyles.ts            # Shared table styling constants (TABLE_HEAD_CELL_SX, TABLE_BODY_CELL_SX, etc.)
      useSnackbar.tsx           # Hook: returns { notify, SnackbarAlert } for standardized snackbar rendering
      useUnsavedChanges.tsx     # Context + provider: intercepts navigation when form has unsaved changes
    theme/
      theme.ts                  # MUI theme factory (createAppTheme) for dark and light modes
  next.config.mjs               # Static export config
  package.json
  tsconfig.json
```

**Naming conventions:**

- Page files: `src/app/<route>/page.tsx` (Next.js convention)
- Components: PascalCase filenames matching the default export (`PolicyCard.tsx` exports `PolicyCard`)
- Utility modules: camelCase (`formatters.ts`, `windowUtils.ts`)
- Color/constant modules: camelCase (`statusColors.ts`, `constants.ts`)
- Hooks: `use` prefix (`useDrawerResize.ts`, `usePolicyTriggers.ts`, `useColors()`)

**URL mapping:** Next.js App Router with `trailingSlash: true` means `src/app/policies/page.tsx` maps to `/policies/`. The policy detail page at `src/app/policies/detail/page.tsx` maps to `/policies/detail/?id=N` (uses query params, not dynamic segments, because the static export does not support dynamic routes).

---

## 3. Architecture Patterns

### Static Export (No SSR)

The Next.js config sets `output: 'export'`, which produces plain HTML/JS/CSS files with no server component. Every page file has the `'use client'` directive. Implications:

- No `getServerSideProps`, `getStaticProps`, or server actions
- No API routes in Next.js -- all API calls go to the Go backend
- No `next/image` optimization (set to `unoptimized: true`)
- Dynamic routes are not supported; pages use `useSearchParams()` for parameters
- The Go binary serves `index.html` for all non-API paths (SPA fallback)

### Provider Stack

The root layout (`layout.tsx`) wraps all content in `<Providers>`, which layers:

```
QueryClientProvider          # TanStack Query cache
  ThemeModeProvider          # light/dark/system preference (localStorage)
    ThemeProvider (MUI)      # MUI theme built from resolved mode
      CssBaseline            # MUI CSS reset
        AuthProvider         # Session state, login/logout
          AppContent         # Auth gate: shows LoginScreen or AppShell
            ErrorBoundary
              AppShell       # Sidebar + content area
                {children}   # Page content
```

### TanStack Query as the Data Layer

TanStack Query is the sole data-fetching and caching layer. There is no Redux, Zustand, or other global state library.

**Query key conventions:**

All query keys are centralized in the `queryKeys` factory at `src/lib/queryKeys.ts` instead of hardcoded arrays. Components import key builders from this module (e.g., `queryKeys.policies.list()`, `queryKeys.executions.detail(id)`) to ensure consistency across queries and invalidations.

| Pattern | Example | Used by |
|:--------|:--------|:--------|
| `['resource']` | `['policies']`, `['workloads']`, `['nodes']` | List queries |
| `['resource', id]` | `['policy', 42]`, `['logs', 15]` | Detail queries |
| `['resource', parentId]` | `['policy-executions', policyId]`, `['exceptions', policyId]` | Scoped queries |
| `['resource', ...filters]` | `['audit-logs', page, pageSize, user, action, from, to]` | Paginated/filtered queries |
| `['resource', 'feed']` | `['policy-executions', 'feed']` | Special-purpose queries |

**Default options** (from `queryClient.ts`):

```typescript
{
  staleTime: 30_000,   // DEFAULT_STALE_TIME_MS
  retry: 1,
}
```

**Refetch intervals** vary by data sensitivity:

| Data | Interval | Constant |
|:-----|:---------|:---------|
| Workloads | 30s | `WORKLOADS_REFETCH_MS` |
| Nodes | 30s | `NODES_REFETCH_MS` |
| Workload pods | 15s | `WORKLOAD_PODS_REFETCH_MS` |
| Node pods | 15s | `NODE_PODS_REFETCH_MS` |
| Pod detail | 15s | `POD_DETAIL_REFETCH_MS` |
| Activity feed | 15s | `ACTIVITY_FEED_REFETCH_MS` |
| Overview (fallback) | 30s | Inline |
| Executions (history) | 10s | `EXECUTIONS_REFETCH_MS` |
| Policies | 30s | `POLICIES_REFETCH_MS` |
| Exceptions | 30s | `EXCEPTIONS_REFETCH_MS` |

**Cache invalidation** happens after every mutation via `queryClient.invalidateQueries()`. The pattern is always: mutate -> onSuccess -> invalidate related query keys. Example from `PolicyCard`:

```typescript
const deleteMut = useMutation({
  mutationFn: () => deletePolicy(policy.id),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['policies'] })
    onNotify?.(`"${policy.name}" deleted`, 'success')
  },
})
```

There are no optimistic updates in the codebase. All mutations wait for the server response, then invalidate to refetch fresh data.

### Auth Context

`useAuth()` returns the auth state and actions:

```typescript
interface AuthState {
  isAuthenticated: boolean
  checking: boolean        // true during initial session probe
  backendError: boolean    // true if backend is unreachable
  user: User | null
  oidcEnabled: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}
```

**Session lifecycle:**

1. On mount, `AuthProvider` fetches `GET /api/auth/me` to check for an existing session cookie.
2. In parallel, it probes `GET /api/auth/oidc/config` to detect whether OIDC SSO is available.
3. If `/me` fails (no session), it probes `GET /api/policies` to detect dev mode (no auth required). In dev mode, a synthetic admin user is created with all permissions.
4. After login, the provider fetches `/me` again to get the authoritative user object with permissions.
5. A 5-minute interval (`ME_POLL_INTERVAL`) re-fetches `/me` to detect role changes, session expiry, or disabled accounts.
6. The API layer dispatches a `kp-session-expired` custom event on any 401 response. The auth provider listens for this event and sets the user to `null`, which triggers the login screen.

**CSRF protection:** Mutation requests (POST/PUT/DELETE/PATCH) include an `X-CSRF-Token` header read from the `__kp_csrf` cookie via `getCSRFToken()`.

### Theme System

The theme supports three modes: `light`, `dark`, and `system` (follows OS preference).

**ThemeModeProvider** (`lib/themeMode.tsx`):
- Persists the user's choice in `localStorage` under `kube-phoenix-theme`
- Listens to `prefers-color-scheme` media query changes when in `system` mode
- Exposes `mode`, `setMode`, and `resolvedMode` (always `'light'` or `'dark'`)

**createAppTheme** (`theme/theme.ts`):
- Factory function that takes `'light' | 'dark'` and returns a complete MUI theme
- Primary color: purple (`#7C3AED` dark, `#6D28D9` light)
- Custom component overrides for Card, Paper, Drawer, AppBar, TableCell borders
- Border radius: 10px globally

**useColors()** hook (`lib/colors.ts`):
- Returns a mode-aware semantic color palette with named colors (success, warning, error, info, muted, orange, cyan, purple) and their low-alpha backgrounds (successBg, warningBg, etc.)
- Used throughout components for consistent theming without hardcoding hex values

### RBAC

The backend returns a `permissions` string array on the user object. The frontend checks these permissions to conditionally render UI elements:

```typescript
// lib/rbac.ts
export const canEditSchedules    = (permissions?: string[]) => hasPerm(permissions, 'schedule.edit')
export const canTriggerSchedules = (permissions?: string[]) => hasPerm(permissions, 'schedule.trigger')
export const canEditGuardrails   = (permissions?: string[]) => hasPerm(permissions, 'guardrail.edit')
export const canManageUsers      = (permissions?: string[]) => hasPerm(permissions, 'user.manage')
export const canResetDB          = (permissions?: string[]) => hasPerm(permissions, 'admin.reset_db')
export const canEmergencyScale   = (permissions?: string[]) => hasPerm(permissions, 'admin.emergency_scale')
export const canViewAudit        = (permissions?: string[]) => hasPerm(permissions, 'audit.view')
```

Usage pattern: pages call `useAuth()` to get the user, then pass boolean `canEdit`/`canTrigger` props to child components that disable buttons or hide sections. Pages requiring specific permissions (Audit, Users) also perform a navigation guard: `if (user && !canViewAudit(user.permissions)) router.replace('/overview')`.

The sidebar filters navigation items based on permissions, hiding "Users" and "Audit Log" from users without the required permissions.

---

## 4. API Layer Deep Dive

### Core Request Function

All API calls go through the `apiFetch<T>()` function in `lib/api.ts`:

```typescript
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T>
```

**Behavior:**

| Concern | Implementation |
|:--------|:--------------|
| Base URL | `process.env.NEXT_PUBLIC_API_URL ?? ''` (empty = same origin) |
| Credentials | `credentials: 'include'` (always sends cookies) |
| Content-Type | `application/json` for all requests |
| CSRF | `X-CSRF-Token` header attached on POST/PUT/DELETE/PATCH via `getCSRFToken()` |
| Timeout | `AbortSignal.timeout(30_000)` (`REQUEST_TIMEOUT_MS`) |
| 401 handling | Dispatches `kp-session-expired` event, throws `'Session expired'` |
| 403 handling | Parses error body, throws descriptive permission error |
| Non-OK handling | Parses error/message from JSON body, throws `HTTP {status}` as fallback |
| 204 handling | Returns `undefined` (no body) |

### API Function Reference

**Guardrails:**

| Function | Method | Endpoint |
|:---------|:-------|:---------|
| `getGuardrails()` | GET | `/api/guardrails` |
| `updateGuardrails(data)` | PUT | `/api/guardrails` |
| `exportGuardrails()` | GET | `/api/guardrails/export` |
| `previewGuardrailsImport(payload)` | POST | `/api/guardrails/import/preview` |
| `applyGuardrailsImport(payload)` | POST | `/api/guardrails/import/apply` |

**Overview:**

| Function | Method | Endpoint |
|:---------|:-------|:---------|
| `getOverview()` | GET | `/api/overview` |

**Cluster:**

| Function | Method | Endpoint |
|:---------|:-------|:---------|
| `getClusterInfo()` | GET | `/api/cluster/info` |
| `getWorkloads()` | GET | `/api/cluster/workloads` |
| `getNodes()` | GET | `/api/cluster/nodes` |
| `getNodePods(nodeName)` | GET | `/api/cluster/nodes/{nodeName}/pods` |
| `getPodDetail(ns, pod)` | GET | `/api/cluster/pods/{ns}/{pod}` |
| `getWorkloadPods(ns, kind, name)` | GET | `/api/cluster/workloads/{ns}/{kind}/{name}/pods` |
| `getPodLogs(ns, pod, container?, tail?, prev?)` | GET | `/api/cluster/pods/{ns}/{pod}/logs` |
| `streamPodLogs(ns, pod, container?, tail?, signal?)` | GET | `/api/cluster/pods/{ns}/{pod}/logs?follow=true` |
| `getVersionInfo()` | GET | `/api/version` |

**Policies:**

| Function | Method | Endpoint |
|:---------|:-------|:---------|
| `getPolicies()` | GET | `/api/policies` |
| `getPolicy(id)` | GET | `/api/policies/{id}` |
| `createPolicy(data)` | POST | `/api/policies` |
| `updatePolicy(id, data)` | PUT | `/api/policies/{id}` |
| `deletePolicy(id)` | DELETE | `/api/policies/{id}` |
| `triggerPolicySleep(id, mode?: 'plan' \| 'apply')` | POST | `/api/policies/{id}/sleep` |
| `triggerPolicyWake(id, mode?: 'plan' \| 'apply')` | POST | `/api/policies/{id}/wake` |
| `exportPolicy(id)` | GET | `/api/policies/{id}/export` |
| `previewPolicyImport(payload)` | POST | `/api/policies/import/preview` |
| `applyPolicyImport(payload)` | POST | `/api/policies/import/apply` |

**Policy Executions:**

| Function | Method | Endpoint |
|:---------|:-------|:---------|
| `getPolicyExecutions(params?)` | GET | `/api/policy-executions?...` |
| `getPolicyExecutionLogs(id)` | GET | `/api/policy-executions/{id}/logs` |

**Scheduled Exceptions:**

| Function | Method | Endpoint |
|:---------|:-------|:---------|
| `getExceptions(params?)` | GET | `/api/exceptions?...` |
| `createException(data)` | POST | `/api/exceptions` |
| `updateException(id, data)` | PUT | `/api/exceptions/{id}` |
| `deleteException(id)` | DELETE | `/api/exceptions/{id}` |
| `exportException(id)` | GET | `/api/exceptions/{id}/export` |
| `previewExceptionImport(payload)` | POST | `/api/exceptions/import/preview` |
| `applyExceptionImport(payload)` | POST | `/api/exceptions/import/apply` |

**Users:**

| Function | Method | Endpoint |
|:---------|:-------|:---------|
| `getUsers()` | GET | `/api/users` |
| `createUserAPI(data)` | POST | `/api/users` |
| `updateUserAPI(id, data)` | PUT | `/api/users/{id}` |
| `deleteUserAPI(id)` | DELETE | `/api/users/{id}` |

**Auth/OIDC:**

| Function | Method | Endpoint |
|:---------|:-------|:---------|
| `getOIDCConfig()` | GET | `/api/auth/oidc/config` |
| `getSessions()` | GET | `/api/auth/sessions` |

**Audit:**

| Function | Method | Endpoint |
|:---------|:-------|:---------|
| `getAuditLogs(params?)` | GET | `/api/audit-logs?...` |

**Admin:**

| Function | Method | Endpoint |
|:---------|:-------|:---------|
| `resetDatabaseStream()` | POST | `/api/danger/reset-db` |
| `emergencyScaleStream()` | POST | `/api/danger/emergency-scale` |

### Streaming: Pod Logs

`streamPodLogs()` returns an object with a `start()` method. It uses `fetch()` with `follow=true` to get a chunked HTTP response, then reads the `ReadableStream` with a `TextDecoder`, splitting on newlines and calling `onLine()` for each line. This is not SSE -- it is raw chunked text streaming from the Kubernetes API (proxied through the Go backend).

```typescript
streamPodLogs(namespace, podName, container?, tailLines?, signal?): {
  start: (onLine, onError, onDone) => void
}
```

The caller passes an `AbortSignal` to cancel the stream (used when the component unmounts or the user switches containers).

The `usePodLogStream` hook batches incoming lines in a ref buffer and flushes to React state once per `requestAnimationFrame`. This collapses many rapid `onLine` callbacks into a single state update per frame, avoiding excessive re-renders and array copies under high log throughput.

### Streaming: Database Reset

`resetDatabaseStream()` is an async generator that reads NDJSON (newline-delimited JSON) from the POST response body. Each line is a `ResetEvent` with `type: 'step' | 'done' | 'error'` and a `message`. The `DatabaseSettings` component consumes these events to show a real-time progress dialog.

### WebSocket: Execution Logs

`wsPolicyLogsUrl(executionId)` constructs a WebSocket URL by replacing `http` with `ws` in the base URL:

```
ws://host/ws/policy-executions/{id}/logs
```

The `LogViewer` component opens this WebSocket for running executions, receiving JSON-encoded `LogLine` objects. See [Real-Time Data Flows](#9-real-time-data-flows) for details.

---

## 5. Component Architecture

### Overview Dashboard

**Page:** `src/app/overview/page.tsx`

A two-column grid with `ClusterStatusCard` (left) and `ActivityFeed` (right).

#### ClusterStatusCard

`src/components/overview/ClusterStatusCard.tsx`

This is the most data-rich component on the dashboard. It combines multiple data sources:

1. **SSE stream** via the `useClusterStream()` hook, which subscribes to `GET /api/cluster/stream` and pushes `Overview` objects directly into the TanStack Query cache under the `['overview']` key using `queryClient.setQueryData()`.

2. **REST fallback** via a standard `useQuery({ queryKey: ['overview'], queryFn: getOverview, refetchInterval: 30_000 })`. If the SSE stream fails, the polling fallback keeps data fresh.

3. **Policies query** to find the first enabled policy for the quick Sleep Now / Wake Now buttons.

The component displays:
- Status indicator with pulsing dot (sleeping/partial/awake)
- Namespace breakdown when workloads are partially sleeping
- Stats chips (nodes, running workloads, sleeping workloads) -- each is clickable, navigating to the cluster page with the relevant filter
- Sleep Now / Wake Now buttons gated by `canTriggerSchedules` permission -- clicking opens the LogViewer drawer inline on the overview page
- Next scheduled run badge with countdown via `timeUntil()`

The `useClusterStream()` hook implements automatic reconnection with exponential backoff. After 2 consecutive failures, it shows a "Live updates paused" chip. On successful reconnection, the indicator clears.

#### ActivityFeed

`src/components/overview/ActivityFeed.tsx`

Fetches the 3 most recent executions via `getPolicyExecutions({ pageSize: 3 })` with a 15s refetch interval. Each execution is rendered as a `ListItemButton` showing:
- Direction icon (sleep moon or wake sun)
- Status via the shared `StatusChip` component
- Mode chip (PLAN/APPLY)
- Summary stats or a live pulse indicator for running executions

Clicking an execution opens the `LogViewer` drawer inline. The "View all" link navigates to `/history/`.

### Cluster Views

**Page:** `src/app/cluster/page.tsx`

A tabbed view switching between `WorkloadsTable` and `NodesTable`. Tab state is driven by the `tab` URL search parameter (e.g., `/cluster/?tab=nodes`).

#### Drill-Down Pattern

The cluster views follow a consistent drill-down architecture:

```
Table (WorkloadsTable / NodesTable)
  -> click row -> opens Drawer (WorkloadDetailDrawer / NodeDetailDrawer)
    -> drawer shows pod list
      -> click pod row -> PodDetailContent replaces pod list in the same drawer
        -> click "Logs" button -> PodLogViewer replaces detail content
```

The drawer content switches in-place using local `selectedPod` state. A back button in the header returns to the previous level. This avoids nested drawers and keeps the UI clean.

#### WorkloadsTable

`src/components/cluster/WorkloadsTable.tsx`

- **Data:** `useQuery(['workloads'], getWorkloads, { refetchInterval: 30_000 })`
- **Filters:** Search (text), Namespace (dropdown built from data), Status (dropdown)
- **Sorting:** Column headers use `SortHeader` + `useTriStateSort` hook (asc -> desc -> none)
- **Status from URL:** Reads `?status=` from search params to pre-filter (used when clicking chips on the overview dashboard)
- **Row click:** Opens `WorkloadDetailDrawer`

#### NodesTable

`src/components/cluster/NodesTable.tsx`

- **Data:** `useQuery(['nodes'], getNodes, { refetchInterval: 30_000 })`
- **Filters:** Search, "Group by zone" toggle
- **Zone grouping:** When enabled, nodes are grouped under zone header rows showing aggregate stats (node count, total pods, CPU/MEM percentages)
- **Resource bars:** `ResourceBar` sub-component renders a colored `LinearProgress` bar with percentage, colored based on utilization thresholds (green < 65%, amber 65-84%, red >= 85%) via `pctColor()`
- **Row click:** Opens `NodeDetailDrawer`

#### Extracted Cluster Subcomponents

Several components were extracted from `NodeDetailDrawer` and `PodLogViewer` for reuse and clarity:

| Component | File | Purpose |
|:----------|:-----|:--------|
| `CollapsibleSection` | `cluster/CollapsibleSection.tsx` | Accordion section with title, count badge, and expand/collapse toggle. Used for labels, taints, and conditions sections in `NodeDetailDrawer`. |
| `LabelChip` | `cluster/LabelChip.tsx` | Styled `key=value` chip for Kubernetes labels with optional highlight. |
| `TaintChip` | `cluster/TaintChip.tsx` | Styled chip for Kubernetes taints with effect-based colour coding. |
| `MiniBar` | `cluster/MiniBar.tsx` | Compact resource utilization bar (CPU/memory) with label and percentage. Used by `NodeDetailDrawer` and `PodDetailContent`. |
| `LogSearchBar` | `cluster/LogSearchBar.tsx` | Search input with match count display and prev/next navigation buttons. Used by `PodLogViewer`. |
| `DetailDrawer` | `cluster/DetailDrawer.tsx` | Shared resizable drawer shell with header, pod list table, pod search, drill-down to `PodDetailContent`, and back navigation. Used by both `WorkloadDetailDrawer` and `NodeDetailDrawer` to eliminate duplicated drawer/pod-list/drill-down code. |
| `usePodLogStream` | `cluster/usePodLogStream.ts` | Hook that manages chunked HTTP streaming for pod logs: initial 250-line tail fetch, follow mode, `requestAnimationFrame`-batched line buffering, and abort cleanup. Used by `PodLogViewer`. |

#### useDrawerResize Hook

`src/lib/useDrawerResize.ts`

Both detail drawers use this hook for drag-to-resize:

```typescript
function useDrawerResize(initial: number, min?: number):
  { width: number; onMouseDown: (e: React.MouseEvent) => void; onTouchStart: (e: React.TouchEvent) => void }
```

Returns a named object `{ width, onMouseDown, onTouchStart }`.

The hook works by:
1. Capturing the starting X position and width on mousedown/touchstart
2. Attaching window-level move/up listeners (prevents losing the drag when the cursor leaves the handle)
3. Computing `delta = startX - currentX` (drawer opens from the right, so leftward movement increases width)
4. Clamping between `DRAWER_MIN_WIDTH` (360px) and `DRAWER_MAX_WIDTH_RATIO * window.innerWidth` (90%)

The resize handle is a thin (8px) absolutely-positioned strip on the left edge of the drawer, hidden on mobile (`display: { xs: 'none', md: 'block' }`).

#### Pod Status Colors

`src/components/cluster/statusColors.ts` exports mode-aware functions that return color maps:

- `statusColors(isDark)` -- Workload status: running (green), sleeping (amber), partial (blue)
- `podStatusStyle(isDark)` -- Pod phase: Running (green), Pending (amber), Failed (red), Succeeded (gray)
- `getPodStatusStyle(status, isDark)` -- Pod status with fallback for unknown statuses
- `nodeStatusMap(isDark)` -- Node status: active (green), protected (blue), would-drain (amber)

All functions take an `isDark` boolean and return objects with `{ bgcolor, color, label }` using the semantic colors from `lib/colors.ts`.

### Policies

**Pages:** `src/app/policies/page.tsx` (list), `src/app/policies/detail/page.tsx` (detail)

#### Policy CRUD Flow

1. **List page** fetches all policies via `getPolicies()` with 30s refetch, renders them as `PolicyCard` components.
2. **Create:** "New Policy" button opens `CreatePolicyDialog` with empty defaults. The dialog uses a `useMutation` wrapping `createPolicy()`, then invalidates `['policies']` on success.
3. **Edit:** "Edit" button on `PolicyCard` opens `CreatePolicyDialog` with `existing={policy}`. The dialog detects edit mode via `!!existing` and calls `updatePolicy()` instead.
4. **Delete:** "Delete" button on `PolicyCard` opens a confirmation dialog, then calls `deletePolicy()`.
5. **Trigger sleep/wake:** Both `PolicyCard` and the detail page use the shared `usePolicyTriggers(policyId, onNotify)` hook, which encapsulates the `triggerPolicySleep/Wake()` mutations, query invalidation, and navigation to the execution detail view.

#### PolicyCard Layout

`PolicyCard` uses a wide timeline card design:
- **Gradient header bar** (3px): state-colored gradient from `CARD_HEADER_GRADIENTS`
- **LED status dot** with glow, pulse animation for transitioning state, from shared `LED_COLORS`
- **70/30 column layout**: left column has policy name, status/mode chips, schedule text, and a 48px `MiniTimeline`; right column shows State, Next transition, and Timezone with a border-left separator
- **Vertical action buttons** on the far right edge: view, sleep, wake, edit, delete

#### Policy Detail Page (Full-Width Horizontal Bands)

The detail page (`src/app/policies/detail/page.tsx`) uses a full-width horizontal band layout. Each band bleeds edge-to-edge within the content area using negative margins (`BLEED_MARGIN_X`) to negate `AppShell`'s padding, then re-applies padding (`BLEED_PADDING_X`) to keep content aligned. The sidebar is never overlaid -- on mobile, the sidebar is already a hamburger menu so bands take full viewport width.

The hero band and metadata row are extracted into dedicated components:

- **`PolicyHeroBand`** (`components/policies/PolicyHeroBand.tsx`): State-colored gradient background, back button, 64px state icon, policy name + description, large state label, mode/enabled chips, action buttons (Sleep Now, Wake Now, Edit, Exception). Action button callbacks are grouped into a `TriggerActions` interface prop (`trigger: { onSleep, onWake, onEdit, onException, isBusy }`) to keep the prop surface clean.
- **`PolicyMetadataRow`** (`components/policies/PolicyMetadataRow.tsx`): Renders timezone, namespace filter, and label selector in a compact row.

Bands (top to bottom):
1. **Hero band** -- `PolicyHeroBand`
2. **Metadata row** -- `PolicyMetadataRow`
3. **Timeline band** -- `LedGlowTimeline` filling the left, weekly stats (Sleep/Week, Awake/Week, Next Transition with countdown) on the right
4. **Exceptions band** -- subtle alternating background, `ExceptionsSection` (wraps on mobile). The table renders the first 5 rows by default; if more exist, a centered "Show all N / Show fewer" toggle expands the list in place.
5. **Execution History band** -- `ExecutionHistoryTable` at full width with status filter dropdown. The table renders the first 10 of the 20 fetched rows by default; if more match the current filter, a centered "Show all N / Show fewer" toggle expands the list. Clicking a row opens the log viewer drawer inline (same behaviour as the History page), using `selectedExec` state and the `LogViewer` component.

#### WindowPicker

`src/components/policies/WindowPicker.tsx`

The sleep window editor renders one card per `SleepWindow` (max 10) with:

- **Inline-editable name:** Click the header to set a custom name (e.g. "EU Maintenance"). When empty, a smart placeholder is auto-derived from the window's days and time range (e.g. "Weekday Nights", "Weekends")
- **Presets:** "Weekday nights", "Weekends", "Nights + weekends", "Business hours" -- pill buttons that replace all windows (pre-named)
- **All-day toggle:** Switch that sets `allDay: true` (hides time pickers)
- **Time pickers:** Hour (0-23) and Minute (0/5/10/.../55) dropdowns for start (sleep) and end (wake) times
- **Day buttons:** Seven day buttons (Mon-Sun) that toggle day inclusion. Active days have a purple border and background
- **Overnight indicator:** Shows a "next day" chip when end time <= start time
- **Never-wake warning:** Appears when all 7 days are set to all-day sleep
- **Add/remove windows:** "Add window" button appends a new empty window; delete icon removes. Disables at the 10-window limit

The parent (`CreatePolicyDialog`) receives window changes via `onChange` and passes them to `WeeklyTimeline` for a live preview.

#### Timeline Components

All three timeline components use raw SVG for rendering. They share timeline math from `lib/windowUtils.ts`. `WeeklyTimeline` and `LedGlowTimeline` also share segment computation logic via `timelineSegments.ts`, which exports `computeWindowSegments` and `computeExceptionSegments`. This eliminates duplicated window-to-segment conversion code between the two timeline variants.

**WeeklyTimeline** (`WeeklyTimeline.tsx`):
- 7 rows (Mon-Sun), 24h per row
- Responsive SVG via `viewBox`; scales to container width
- Green background for awake time, purple blocks for sleep windows
- Exception blocks in green/red
- Current time marker as a red vertical line spanning all rows
- Hour labels at 0, 3, 6, 9, 12, 15, 18, 21
- Today's row has a brighter background
- Used in `CreatePolicyDialog` for schedule preview

**LedGlowTimeline** (`LedGlowTimeline.tsx`):
- Same 7-row layout but rendered as thin LED strips (6px height)
- Responsive SVG via `viewBox`; scales to container width
- SVG `<filter>` elements create glow effects (feGaussianBlur + feMerge)
- Different glow filters for sleep (purple) and exception (red/green)
- Current time marker with a circle indicator on today's row
- Used on the policy detail page

**MiniTimeline** (`MiniTimeline.tsx`):
- Sparkline-style 24h waveform showing today's sleep/awake state (default 48px tall)
- Sleep = line drops down with purple gradient fill above, Awake = line rises with green gradient fill below
- Smooth step transitions between states at 15-minute resolution
- SVG waveform stretches to fill the container width (no fixed pixel width)
- SVG tick marks at hour positions (0, 3, 6, 9, 12, 15, 18, 21, 24); CSS-positioned labels beneath to avoid SVG distortion
- Now-marker (red dot + vertical line) positioned via CSS percentage, updates in real-time every 30 seconds via `setInterval`
- Timezone-aware via the policy's timezone
- Sleep ranges memoized with `useMemo` to avoid recalculation on unrelated re-renders
- Gradient SVG IDs use `useId()` for uniqueness across multiple policy cards
- Wrapped in a Tooltip showing the full `windowsToText()` description
- Used on `PolicyCard` as a full-width timeline row beneath the schedule text

**TimelineLegend** (`TimelineLegend.tsx`): Extracted shared legend strip rendered below both `WeeklyTimeline` and `LedGlowTimeline`. Shows legend items for sleep, awake, and exceptions (stay_awake, force_sleep).

**Shared timeline math:**

The `DOW_MAP` constant maps array index to JS day-of-week: `[1,2,3,4,5,6,0]` (Mon=0 through Sun=6 in timeline row space, where Mon is row 0 and Sun is row 6).

`computeTimeRangeBlocks(startISO, endISO, tz?)` splits an absolute time range into per-day `TimeBlock` objects, each with `{ row, startHour, endHour }`. This is used by exceptions to render their blocks on the timeline grid.

**`timelineSegments.ts`** (`components/policies/timelineSegments.ts`): Shared by `WeeklyTimeline` and `LedGlowTimeline`. Exports:

- `TimelineSegment` -- `{ row, startHour, endHour, color, variant }` interface
- `computeWindowSegments(windows)` -- converts `SleepWindow[]` to per-row timeline segments
- `computeExceptionSegments(exceptions, tz)` -- converts active exceptions to timeline segments

#### Exceptions on the Timeline

Both `WeeklyTimeline` and `LedGlowTimeline` accept an optional `exceptions` prop. They convert these absolute time ranges into timeline blocks using `computeTimeRangeBlocks()`, then render them on top of the sleep window blocks. Cancelled and completed exceptions are filtered out before rendering.

### Execution History

**Page:** `src/app/history/page.tsx`

The history page composes `ExecutionTable` and `LogViewer`. It supports deep-linking via `?exec=N` to auto-open a specific execution's log drawer.

#### ExecutionTable

`src/components/history/ExecutionTable.tsx`

- Paginated table using `TablePagination` (10/20/50 rows per page)
- Refetches periodically to catch newly completed executions
- **Filter dropdowns** for Status (running/success/failed/interrupted/skipped) and Direction (sleep/wake)
- Columns: Started (`fmtDtShort` with year), Policy name (from preloaded relation), Direction (sleep/wake icon), Mode chip (using `modeColors(isDark)`), Status via `StatusChip`, Duration (`fmtDuration`), Summary (icons for scaled/drained/deleted/errors)
- Header styling extracted to `TABLE_HEADER_CELL_SX` constant; chip sizing uses shared `SMALL_CHIP_SX`
- Row click calls `onSelect(execution)`, which opens the `LogViewer` drawer

#### LogViewer

`src/components/history/LogViewer.tsx`

The execution log viewer is a resizable right-side drawer. Data fetching and WebSocket management are delegated to the `useExecutionLogs` hook; log summary parsing is delegated to `parseSummary.ts` and rendered by `ExecutionSummary`.

**Submodules:**

| File | Purpose |
|:-----|:--------|
| `useExecutionLogs.ts` | Hook that manages the data source: opens a WebSocket for running executions, falls back to REST `getPolicyExecutionLogs()` for completed ones. Handles reconnection with exponential backoff, RAF message batching, `seq`-based deduplication, and `cleanClose` detection. |
| `parseSummary.ts` | Regex-based parser that extracts structured data from log lines: workload entries (`Slept`, `Restored -> N replicas`, `Would sleep/restore`), node entries (drained, deleted, would-drain), and error lines. Groups workloads by namespace. |
| `ExecutionSummary.tsx` | Renders the parsed summary as an accordion: workloads grouped by namespace with target replicas, node entries, error count chip, and a stats bar showing duration, scaled/restored count, drained/deleted nodes, skipped, errors, and API call throughput. |

**Drawer layout:**

1. **Header:** Direction icon, execution ID, running spinner, mode chip, count chips (scaled, drained, errors)
2. **Summary accordion** (`ExecutionSummary`): Rendered from `parseSummary()` output
3. **Log lines area:** Each line rendered with timestamp (30% opacity) and message colored by log level
4. **Error navigation:** "Jump to error" button cycles through error-level lines, scrolling to each

**Log level colors** are defined in `lib/statusColors.ts`:

```typescript
// Dark mode
{ info: '#22D3EE', ok: '#22C55E', plan: '#C084FC', error: '#F87171', warn: '#FBBF24' }
// Light mode
{ info: '#0369A1', ok: '#15803D', plan: '#6D28D9', error: '#B91C1C', warn: '#92400E' }
```

### Exceptions

#### ExceptionDialog

`src/components/policies/ExceptionDialog.tsx`

Handles both create and edit modes. When opened without a `defaultPolicyId` (e.g. from the standalone Exceptions page), a policy dropdown is shown, lazy-loaded via `useQuery`. When opened from a policy detail page, the policy is pre-selected and the dropdown is hidden. Dialog uses `maxWidth="md"` to fit the inline two-month calendar.

The window itself is picked via the `ExceptionWindowPicker` component (see below). The dialog stores `startsAt`/`endsAt` as ISO strings directly on `form` and passes them straight to the picker — there is no separate local-format mirror state. Validation: policy must be selected, start must be in the future (for new exceptions), end must be after start.

#### ExceptionWindowPicker

`src/components/policies/ExceptionWindowPicker.tsx`

Inline picker that combines a two-month range calendar with hour:minute steppers.

Props:

- `value: { startISO, endISO }` — current window as ISO strings (empty string when unset)
- `onChange(next)` — emits a new value whenever the user picks a day or changes a time
- `minDate?: Date` — earliest selectable day. The dialog passes `new Date()` for new exceptions and `undefined` for edits (so historic windows render).

Behavior:

- Click a day to set the start; click a second day to set the end. Clicking a day earlier than the current start re-anchors the range with the original start as the new end.
- Hovering after picking a start shows a dashed-outline preview range.
- Today is outlined in primary; days before `minDate` and out-of-month days are disabled and dimmed.
- A "FROM … → TO …" header above the calendar shows the current selection plus a duration chip (e.g. `2d 5h`).
- Time pickers are HH:MM dropdowns (1-hour / 5-min granularity) with ±15-min stepper buttons.
- Picking the same day for start and end auto-bumps end-time to start-time + 1h if the times would invert.
- Header actions: Clear (only when a selection exists), previous month, jump-to-today, next month.
- Caption shows the user's local IANA timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`.

#### ExceptionsSection

Uses `getTypeLabel(isDark, type)` from `lib/statusColors.ts` to color-code exception types with mode-aware colors. This accessor wraps `typeLabels(isDark)` with a fallback for unknown type strings, returning `{ label, color, bg }` for `stay_awake` and `force_sleep`.

**Exception status lifecycle:** `pending` (created, start time is in the future) -> `active` (start time has passed, the backend activates the exception) -> `completed` (end time has passed) or `cancelled` (manually cancelled). The backend manages these transitions; the frontend only displays them.

### Audit Log

**Page:** `src/app/audit/page.tsx`

Displays a paginated, filterable table of audit log entries. Gated by the `audit.view` permission via an inline navigation guard. The page is decomposed into four extracted modules under `src/components/audit/`.

**Submodules:**

| File | Purpose |
|:-----|:--------|
| `auditDiff.ts` | Pure helpers: `flattenToLeaves`, `classifyLine`, `computeDiff`, `isEmptySnapshot`, `downloadCSV`. Shared by `JsonDiffView` and the page. |
| `auditFormatters.ts` | `ACTION_LABELS` map, `formatActionLabel()`, and `actionColor()`. Moved from `lib/statusColors.ts` to co-locate with audit components. |
| `AuditRow.tsx` | Expandable table row with diff toggle. Renders the action label, username, timestamp (browser-local time with UTC tooltip on hover), and expand chevron. |
| `DiffLineRow.tsx` | Single classified diff line with prefix symbol (`+`, `-`, `~`, ` `) and colour coding. |
| `JsonDiffView.tsx` | Renders the full diff panel: iterates classified lines via `DiffLineRow`, shows change count summary. |

**Timestamps:** Displayed in the browser's local timezone via `fmtDt()`, with a MUI `Tooltip` showing the UTC value on hover. The column header includes a hint: "local time, hover for UTC".

**Filters:** `User` (debounced via `useDebouncedValue`, exact-match), `Action` (dropdown built from `ACTION_LABELS`), and `From`/`To` date range filters. Date filters use local midnight (not UTC midnight) so filtering by date matches the displayed timestamps. All filters reset pagination to page 0 on change.

**Expandable diff rows:** Entries that carry `before` or `after` data show an expand chevron. Clicking it opens a `JsonDiffView` panel inside a `Collapse`.

#### JsonDiffView

The diff panel compares the `before` and `after` JSON snapshots from the audit entry and renders a line-by-line diff with colour coding:

| Symbol | Colour | Meaning |
|:-------|:-------|:--------|
| `+` | green | Field only in `after` (added) |
| `-` | red | Field only in `before` (removed) |
| `~` | amber | Field in both, value changed (shows ~~old~~ `new` inline) |
| ` ` | dimmed | Field unchanged (35% opacity) |

A summary line above the panel shows the count of changed fields.

**Key helpers (defined in `components/audit/auditDiff.ts`):**

| Symbol | Purpose |
|:-------|:--------|
| `isEmptySnapshot(json?)` | Returns `true` when `json` is falsy or equals the null snapshot sentinel |
| `flattenToLeaves(value, prefix?)` | Recursively flattens an object to dot-notation key → JSON-value pairs (e.g. `{ "settings.timezone": '"UTC"' }`) |
| `classifyLine(key, before?, after?)` | Classifies a single key as `added`, `removed`, `changed`, or `unchanged` |
| `computeDiff(beforeJson?, afterJson?)` | Orchestrates snapshot parsing and line classification; returns `null` when both snapshots are empty |
| `downloadCSV(logs)` | Exports the current audit log view as a CSV file |

---

### Shared Page Chrome

Two cross-cutting primitives live in `src/components/shared/` and are used by every top-level page. They exist so page-level markup stays uniform and design changes happen in one place rather than nine.

#### PageHeader

`src/components/shared/PageHeader.tsx`

Renders the standard title block above every page. Props:

| Prop | Type | Purpose |
|:-----|:-----|:--------|
| `title` | `string` (required) | Rendered as `h5`, weight 700 |
| `subtitle` | `ReactNode` (optional) | Muted body2 line under the title |
| `breadcrumbs` | `Crumb[]` (optional) | Caption-sized trail above the title; entries with `href` render as Next.js links |
| `actions` | `ReactNode` (optional) | Right-aligned slot for buttons (e.g. `New Policy`, `Export CSV`) |
| `meta` | `ReactNode` (optional) | Slot under the title for freshness indicators, count chips, etc. |
| `tabs` | `ReactNode` (optional) | Tab bar slot rendered with a bottom border; used by Cluster State and Observability |

All slots are mobile-responsive (the title/actions row wraps to two lines on `xs`). Bottom margin is fixed at `mb: 3`; pages should not add their own margin.

Adopted in: `/overview`, `/cluster`, `/policies`, `/policies/detail`, `/exceptions`, `/guardrails`, `/history`, `/users`, `/audit`, `/settings`, `/observability`.

#### EmptyState

`src/components/shared/EmptyState.tsx`

Dashed-border centered placeholder card used when a list has no data. Props:

| Prop | Type | Purpose |
|:-----|:-----|:--------|
| `title` | `string` (required) | Rendered as `subtitle1`, weight 600 |
| `description` | `ReactNode` (optional) | Muted body2 line under the title; max-width 420px for readability |
| `icon` | `ReactNode` (optional) | Rendered above the title at `fontSize: 40` in `text.disabled` |
| `action` | `ReactNode` (optional) | Slot below the description for a CTA (e.g. "Create policy") |

Adopted in: `/policies` ("No policies yet"), `/exceptions` ("No exceptions found.").

#### Prototype gallery

The two shared primitives above are documented visually under `/prototypes/page-header` and `/prototypes/empty-state`. These are full Next.js pages with every variant rendered inline (minimal → kitchen-sink) plus before/after comparisons. Use the same convention when adding new shared primitives: build a mockup page at `/prototypes/<name>` so reviewers can compare variants without spinning up Storybook.

---

### Settings

**Page:** `src/app/settings/page.tsx`

Command Center layout with collapsible sections. Each section expands/collapses inline and fetches real API data. Sections: Profile & Identity, Cluster & Connection, Appearance, Security & Sessions, System Pulse, Danger Zone, About. Only `DatabaseSettings` is imported as a child component (with `bare` prop); all other sections are rendered directly in the page.

#### AccountSettings

`src/components/settings/AccountSettings.tsx`

- Displays username, role, source (local/OIDC)
- Timezone selector: IANA timezone dropdown that persists via `PUT /api/auth/settings`
- The selected timezone is used as the default when creating new policies

#### ClusterConnectionCard

`src/components/settings/ClusterConnectionCard.tsx`

- Displays Kubernetes API server URL, version, auth mode, and cluster name
- Fetches from `GET /api/cluster/info`

#### AboutBar

`src/components/settings/AboutBar.tsx`

- Displays build version and server uptime
- Fetches from `GET /api/version` (no auth required)

#### DatabaseSettings

`src/components/settings/DatabaseSettings.tsx`

A multi-step destructive action flow:

1. **Step 1 dialog:** "Are you absolutely sure?" with description of what will be destroyed
2. **Step 2 dialog:** Type `RESET DATABASE` to confirm (exact phrase match required)
3. **Progress dialog:** Streams `ResetEvent` objects from `resetDatabaseStream()` async generator, showing each step in a monospace log view
4. On success (`type === 'done'`), calls `queryClient.clear()` to wipe the entire cache

#### GuardrailsForm

`src/components/guardrails/GuardrailsForm.tsx`

The guardrails editor uses collapsible category cards — each section (Protected Namespaces, Node Protection, Scaling Priority, Scheduler Behaviour) is a `CategoryCard` with an icon header, summary stat pills (hidden when expanded), and a chevron toggle. Form state is managed with `useReducer` and a typed `FormState` interface. Dirty tracking uses `buildSnapshot()` / `isDirty()` helpers that compare current state against the last saved snapshot, feeding into the `useUnsavedChanges` context to intercept navigation.

The toolbar below the cards has three actions: **Save Guardrails** persists the current form via `PUT /api/guardrails`; **Export** opens an `ExportMenu` (Copy JSON / Download .json) backed by `GET /api/guardrails/export`; **Import** opens the shared `ImportDialog` with `kind="guardrails"`. The dialog accepts pasted text or a dropped `.json` file, runs the import through `/api/guardrails/import/preview`, renders a changed-fields table when fields differ from the live environment, and applies via `/api/guardrails/import/apply`. The same `ImportDialog` + `ExportMenu` pair is reused on the policies list page, policy detail hero, the scheduled-exceptions page, and the exceptions table inside policy detail — with the kind switched to `"policy"` or `"exception"` and a different rich preview card rendered for each.

**`CategoryCard`** (`components/guardrails/CategoryCard.tsx`): A reusable collapsible card accepting `icon`, `title`, `subtitle`, `pills`, `expanded`, `onToggle`, `children`, and optional `cardSx`/`dividerSx` props. Renders a clickable header with icon box, title, subtitle, conditional pills, and chevron. Body content renders inside a `Collapse` below a `Divider`.

**`ChipInput`** (`components/common/ChipInput.tsx`): A reusable tag input component:

- Type a value and press Enter to add a chip
- Press Backspace on an empty input to remove the last chip
- `onBlur` also commits the current input value
- Values are stored as `string[]` locally and serialized to CSV for the API

**`ProtectedChipInput`** (`components/guardrails/ProtectedChipInput.tsx`): A `ChipInput` variant for the Protected Namespaces list that adds a confirmation dialog when removing a chip, warning that removing a protected namespace could affect critical infrastructure. Note: the main `GuardrailsForm` uses `ChipInput` directly with amber styling for the namespace section (not `ProtectedChipInput`) to avoid a duplicate heading.

Data is loaded from the API as CSV strings and split with `splitCommaList()`. On save, arrays are joined back with `joinCommaList()`.

The Scheduler Behaviour section uses stacked label-left/control-right rows for Eval Interval (Go duration, validated), Auto Wake (switch), and Reconcile While Awake (switch).

**`useUnsavedChanges`** (`lib/useUnsavedChanges.tsx`): A context provider that tracks dirty state across any form. Intercepts internal `<a>` link clicks (capture phase) to show a confirmation dialog when dirty, and uses `beforeunload` for browser tab close. Wrapped in `UnsavedChangesProvider` inside `providers.tsx`. The context value is memoized with `useMemo` to prevent unnecessary re-renders of all consumers when the parent re-renders without a dirty-state change.

**`LabeledSwitch`** (`components/common/LabeledSwitch.tsx`): A shared component that renders a `FormControlLabel` wrapping a `Switch` with a two-line label (bold title + secondary caption). Used by `ExceptionDialog`.

---

## 6. Shared Utilities Deep Dive

### lib/formatters.ts

| Function | Signature | Purpose | Used by |
|:---------|:----------|:--------|:--------|
| `fmtCpu(m)` | `number -> string` | Format millicores: `1500` -> `"1.5c"`, `500` -> `"500m"` | NodesTable, NodeDetailDrawer, PodDetailContent, PodRow |
| `fmtMem(bytes)` | `number -> string` | Format bytes: `1.5 GiB` -> `"1.5G"`, `512 MiB` -> `"512M"` | Same as fmtCpu |
| `podAge(iso)` | `string -> string` | ISO to short age: `"5m"`, `"3h"`, `"2d"` | NodesTable, PodDetailContent, PodRow |
| `sinceMs(ms)` | `number -> string` | Millisecond timestamp to relative: `"just now"`, `"5s ago"`, `"3m ago"` | WorkloadsTable, NodesTable, drawers (for `dataUpdatedAt`) |
| `timeUntil(iso)` | `string -> string` | ISO to countdown: `"now"`, `"in 5m"`, `"in 2h 30m"`, `"in 5d 8h"` | ClusterStatusCard, PolicyCard, PolicyDetailPage |
| `pct(used, total)` | `(number, number) -> number` | Safe percentage: returns 0 when total is 0 | NodesTable, NodeDetailDrawer |
| `pctColor(p, isDark)` | `(number, boolean) -> string` | Color by percentage threshold using named constants (`PCT_WARNING` = 65%, `PCT_CRITICAL` = 85%): green < warning, amber warning-critical, red >= critical | NodesTable, NodeDetailDrawer |
| `fmtDt(iso)` | `string \| null -> string` | ISO to locale string, or em-dash for null | PolicyDetailPage, ExceptionsSection, ExceptionsPage, AuditRow |
| `fmtDtShort(iso)` | `string \| null -> string` | ISO to short date with year: `"Mar 24, 2026, 2:15 PM"` | ExecutionTable, ExecutionHistoryTable |
| `fmtDuration(start, end)` | `(string, string \| null) -> string` | Duration between two ISO timestamps: `"5s"`, `"2m 30s"`, or `"Running…"` | ExecutionTable, ExecutionHistoryTable |
| `formatError(e)` | `unknown -> string` | Extract human-readable message from a caught error | Mutations across all pages |
| `timeAgo(iso)` | `string -> string` | ISO to past relative: `"just now"`, `"5m ago"`, `"2h ago"`, `"3d ago"` | ActivityFeed |

### lib/windowUtils.ts

| Function | Purpose |
|:---------|:--------|
| `formatTime(time)` | `"19:00"` -> `"7:00 PM"` |
| `isOvernight(window)` | Returns `true` when end time <= start time (e.g., 19:00-07:00) |
| `formatDayRange(days)` | `[1,2,3,4,5]` -> `"Mon-Fri"`, `[0,6]` -> `"Sat-Sun"`, `[1,3,5]` -> `"Mon, Wed, Fri"` |
| `windowsToText(windows)` | Full human-readable summary: `"Mon-Fri 7 PM - 7 AM, Sat-Sun all day"` |
| `timeToHours(time)` | `"19:30"` -> `19.5` (fractional hours for timeline rendering) |
| `hasSleepWindows(windows)` | Type guard: returns `true` if the array is non-null and non-empty (narrows `SleepWindow[] \| null` to `SleepWindow[]`) |
| `computeWeeklyStats(windows)` | Returns `{ sleepHours, awakeHours }` per 168-hour week |
| `nowInTimezone(tz?)` | Returns `{ dayOfWeek, fractionalHour }` in the given IANA timezone |
| `toTimezone(iso, tz?)` | Converts ISO timestamp to a Date in the given timezone |
| `computeTimeRangeBlocks(start, end, tz?)` | Splits an absolute time range into per-day `TimeBlock[]` for timeline rendering |

**DOW_MAP:** `[1, 2, 3, 4, 5, 6, 0]` maps timeline row index (0=Mon, 6=Sun) to JavaScript `getDay()` values (0=Sun, 1=Mon, ..., 6=Sat). This allows the timeline to render Mon-Sun top-to-bottom while using standard JS day-of-week numbers internally.

### lib/colors.ts

**`semanticColors(isDark)`** returns a flat object of 19 named colors, each adapting to the current theme mode. This is the canonical color palette for non-MUI-theme colors:

```typescript
{
  success, warning, error, errorLight, info, muted, orange, cyan, purple, vividYellow,
  successBg, warningBg, errorBg, infoBg, mutedBg, orangeBg, purpleBg,
  zoneBg,
}
```

**`useColors()`** is a React hook that calls `useTheme()` to detect the current mode and returns `semanticColors(isDark)`.

**`TIMELINE_COLORS`** is a static object with named colors for timeline rendering: `sleep`, `sleepGlow`, `exception`, `exceptionBg`, `awake`, `awakeBg`, `sleepBg`. These are not mode-aware because timelines render the same in both themes.

### lib/statusColors.ts

Most color exports are mode-aware functions that accept an `isDark: boolean` parameter and return pre-computed static objects (no per-render allocations). Call them with `useTheme().palette.mode === 'dark'` inside components.

| Export | Type | Purpose |
|:-------|:-----|:--------|
| `stateColors(isDark)` | `(boolean) → Record<string, { bg, color, label }>` | Policy current state (sleeping, awake, transitioning, unknown) |
| `executionStatusColors(isDark)` | `(boolean) → Record<string, { bg, color }>` | Execution and exception statuses (running, success, failed, interrupted, skipped, pending, active, completed, cancelled) |
| `executionStatusFallback(isDark)` | `(boolean) → { bg, color }` | Default for unknown status strings |
| `modeColors(isDark)` | `(boolean) → Record<string, { bg, color }>` | Plan (blue) and Apply (amber) mode chips |
| `SMALL_CHIP_SX` | `{ height: 18, fontSize: 10 }` | Shared sx for small chips (mode, type badges) |
| `CARD_HEADER_GRADIENTS` | `Record<string, string>` | Horizontal gradient for PolicyCard top edge (3px bar) |
| `HERO_HEADER_GRADIENTS` | `Record<string, string>` | Vertical gradient for detail page hero band background |
| `LED_COLORS` | `Record<string, { bg, glow }>` | LED dot colors per policy state (bg color + glow shadow) |
| `subtleBorder(isDark)` | `(boolean) → string` | Subtle separator color for full-width bands |
| `typeLabels(isDark)` | `(boolean) → Record<string, { label, color, bg }>` | Exception types (stay_awake, force_sleep) |
| `typeLabelFallback(isDark)` | `(boolean) → { label, color, bg }` | Default for unknown type strings |
| `getModeStyle(isDark, mode)` | `(boolean, string) → { bg, color }` | Safe accessor for `modeColors` with fallback for unknown mode strings |
| `getTypeLabel(isDark, type)` | `(boolean, string) → { label, color, bg }` | Safe accessor for `typeLabels` with fallback for unknown type strings |
| `LOG_LEVEL_COLORS_DARK` | `Record<LogLine['level'], string>` | Log line text colors (dark mode) |
| `LOG_LEVEL_COLORS_LIGHT` | `Record<LogLine['level'], string>` | Log line text colors (light mode) |

### lib/constants.ts

| Constant | Value | Purpose |
|:---------|:------|:--------|
| `TIMEZONES` | 50+ IANA timezone strings | Dropdown options for policy timezone selector |
| `REQUEST_TIMEOUT_MS` | 30,000 | Default fetch timeout |
| `DEFAULT_STALE_TIME_MS` | 30,000 | TanStack Query default stale time |
| `WORKLOADS_REFETCH_MS` | 30,000 | Workload list polling interval |
| `NODES_REFETCH_MS` | 30,000 | Node list polling interval |
| `POLICIES_REFETCH_MS` | 30,000 | Policy list polling interval |
| `EXCEPTIONS_REFETCH_MS` | 30,000 | Exception list polling interval |
| `EXECUTIONS_REFETCH_MS` | 10,000 | Execution list polling interval |
| `ACTIVITY_FEED_STALE_MS` | 14,000 | Activity feed stale time |
| `ACTIVITY_FEED_REFETCH_MS` | 15,000 | Activity feed polling interval |
| `NODE_PODS_REFETCH_MS` | 15,000 | Node pod list polling interval |
| `WORKLOAD_PODS_REFETCH_MS` | 15,000 | Workload pod list polling interval |
| `POD_DETAIL_REFETCH_MS` | 15,000 | Pod detail polling interval |
| `SNACKBAR_AUTO_HIDE_MS` | 4,000 | Snackbar auto-dismiss time |
| `DRAWER_MIN_WIDTH` | 360 | Minimum drawer width in pixels |
| `DRAWER_MAX_WIDTH_RATIO` | 0.9 | Maximum drawer width as fraction of viewport |
| `MINUTES_PER_HOUR` | 60 | Time unit constant |
| `MINUTES_PER_DAY` | 1,440 | Time unit constant |
| `HOURS_PER_WEEK` | 168 | Time unit constant |

### lib/rbac.ts

A thin permission-checking layer. The internal `hasPerm(permissions, perm)` function checks if a string exists in the permissions array. Seven convenience wrappers are exported for common checks (`canEditSchedules`, `canTriggerSchedules`, `canEditGuardrails`, `canManageUsers`, `canResetDB`, `canEmergencyScale`, `canViewAudit`). See [RBAC](#rbac) in Architecture Patterns.

### lib/usePolicyTriggers.ts

A custom hook that encapsulates sleep/wake trigger mutations for a policy. Returns `{ sleepMut, wakeMut, isBusy }`. On success, it invalidates the `policies`, `policy`, `policy-executions` query keys and opens the execution log viewer inline. On error, it calls the provided `onNotify` callback. Used by both `PolicyCard` and `PolicyDetailPage` to avoid duplicating mutation setup, query invalidation, and error handling.

### lib/useDrawerResize.ts

See [useDrawerResize Hook](#usedrawerresize-hook) in the Cluster Views section.

### lib/useSnackbar.tsx

A hook that encapsulates snackbar state and rendering. Returns `{ notify, SnackbarAlert }`. Call `notify(message, severity)` to show a snackbar. Render `SnackbarAlert` in the component tree -- the hook manages open/close state, auto-hide duration (from `SNACKBAR_AUTO_HIDE_MS`), and MUI `Alert` rendering internally. Replaces scattered `useState` + inline `<Snackbar>` patterns across all pages.

### lib/useIsDark.ts

A one-liner hook that returns `useTheme().palette.mode === 'dark'`. Eliminates the repeated `const isDark = useTheme().palette.mode === 'dark'` boilerplate from every component that needs mode-aware colors.

### lib/layoutConstants.ts

Exports shared responsive layout constants used by the policy detail page's full-width band layout:

- `BLEED_MARGIN_X` -- negative margins to bleed bands edge-to-edge (`{ xs: -2, sm: -2.5, md: -3 }`)
- `BLEED_PADDING_X` -- matching padding to re-align content (`{ xs: 2, sm: 2.5, md: 3 }`)

### lib/useTriStateSort.ts

A hook for tri-state column sorting: clicking the active column cycles `asc` -> `desc` -> none (unsorted). Clicking a different column activates it ascending. Returns `{ sortCol, sortDir, handleSort }`. Used by `WorkloadsTable` and `NodesTable` alongside the `SortHeader` component.

### lib/SortHeader.tsx

A reusable table header cell that renders a `TableSortLabel` wired to the `useTriStateSort` hook. Accepts `col`, `label`, `active`, `dir`, and `onSort` props. Uses the shared `TABLE_HEAD_CELL_SX` constant from `tableStyles.ts`.

### lib/tableStyles.ts

Shared table styling constants for consistent appearance across all pages:

| Constant | Style | Used by |
|:---------|:------|:--------|
| `TABLE_HEAD_CELL_SX` | `fontWeight: 700, color: text.secondary, fontSize: 12, whiteSpace: nowrap` | SortHeader, ExecutionTable, audit, users, exceptions, policy exceptions |
| `TABLE_BODY_CELL_SX` | `fontSize: 13` | Users page, workloads table |
| `TABLE_BODY_CELL_SECONDARY_SX` | `fontSize: 13, color: text.secondary` | Users page |
| `TABLE_BODY_CELL_MONO_SX` | `fontSize: 13, fontFamily: monospace` | Available for monospace cells |

### common/ConfirmDialog.tsx

A shared confirmation dialog component accepting `open`, `title`, `message`, `confirmLabel`, `confirmColor`, `onConfirm`, and `onClose` props. Replaces ad-hoc inline confirmation dialogs in `PolicyCard`, `DetailDrawer`, and the exceptions page.

### common/CenteredSpinner.tsx

A centered `CircularProgress` spinner for loading states. Accepts an optional `size` prop (default 40). Used as the loading placeholder across pages and drawers.

### lib/useDebouncedValue.ts

A generic debounce hook: `useDebouncedValue<T>(value, delayMs)` returns the debounced value. Used by the audit page to debounce user search input.

### lib/useClusterStream.ts

The SSE subscription hook for the cluster stream. Connects to `GET /api/cluster/stream`, parses SSE events, and pushes `Overview` objects into the TanStack Query cache via `queryClient.setQueryData()`. Implements automatic reconnection with exponential backoff and sets a disconnected flag after 2 consecutive failures.

### lib/timelineUtils.ts

Timeline rendering utilities. Exports `DAYS` (day label array) and `timeRangeToSegments()` which converts time ranges to renderable segments. Used by timeline components for shared day-label rendering and segment computation.

---

## 7. State Management

### No Global State Library

The codebase deliberately avoids Redux, Zustand, Jotai, or any global state library. TanStack Query is the single source of truth for all server state. The rationale: every piece of remote data is fetched, cached, and invalidated through TanStack Query. There is no client-only global state that needs to be shared across unrelated component trees.

### Query Key Conventions

Query keys follow a consistent pattern: `['resource-type', ...identifiers, ...filters]`. This enables targeted invalidation -- `invalidateQueries({ queryKey: ['policies'] })` invalidates the list, while `invalidateQueries({ queryKey: ['policy', 42] })` invalidates only one policy.

### Cache Invalidation After Mutations

Every `useMutation` has an `onSuccess` handler that invalidates related query keys. Some mutations invalidate multiple keys. The shared `usePolicyTriggers(policyId, onNotify)` hook encapsulates sleep/wake trigger mutations and invalidates four query families on success:

```typescript
// usePolicyTriggers invalidates these on successful sleep/wake trigger:
queryClient.invalidateQueries({ queryKey: ['policies'] })
queryClient.invalidateQueries({ queryKey: ['policy', policyId] })
queryClient.invalidateQueries({ queryKey: ['policy-executions'] })
queryClient.invalidateQueries({ queryKey: ['policy-executions', policyId] })
```

Both `PolicyCard` and `PolicyDetailPage` consume this hook rather than duplicating the mutation logic.

The exception is the SSE-driven overview, where `useClusterStream()` bypasses the normal fetch cycle and pushes data directly into the cache with `queryClient.setQueryData()`.

### Local Component State

Components use `useState` for:
- UI state: dialog open/closed, search text, selected rows, form fields
- Transient state: snackbar messages, loading indicators

`useSearchParams()` is used for URL-driven state: filter values, tab selection, entity IDs. This enables deep-linking and browser navigation.

---

## 8. Styling Patterns

### MUI sx Prop

The entire codebase uses the MUI `sx` prop for styling. There are no CSS files, CSS modules, styled-components, or Tailwind. The `sx` prop provides:
- Theme-aware values (e.g., `color: 'text.secondary'`, `bgcolor: 'background.paper'`)
- Responsive syntax (e.g., `width: { xs: '100vw', md: drawerWidth }`)
- Pseudo-selectors (e.g., `'&:hover': { bgcolor: 'action.hover' }`)

### Theme Tokens vs. Hardcoded Values

**Use MUI theme tokens** for standard palette colors:
```typescript
sx={{ color: 'text.secondary', bgcolor: 'background.default', borderColor: 'divider' }}
```

**Use `useColors()` hook** for semantic colors not in the MUI palette:
```typescript
const colors = useColors()
sx={{ color: colors.success, bgcolor: colors.successBg }}
```

**Use `TIMELINE_COLORS`** for SVG timeline rendering (static, not mode-aware).

**Use `statusColors.ts` functions** for status-dependent coloring:
```typescript
const isDark = useIsDark()
const colors = stateColors(isDark)
const stateStyle = colors[policy.currentState] ?? colors.unknown
sx={{ bgcolor: stateStyle.bg, color: stateStyle.color }}
```

### Responsive Patterns

- **Drawer width:** `width: { xs: '100vw', md: drawerWidth }` -- full viewport on mobile, resizable on desktop
- **Resize handle:** `display: { xs: 'none', md: 'block' }` -- hidden on mobile
- **Sidebar:** Temporary drawer on mobile (`xs`), permanent on desktop (`md`)
- **Grid layouts:** `<Grid size={{ xs: 12, md: 6 }}>` -- full width on mobile, half on desktop
- **Page max-width:** Settings page uses a full-width two-column Grid layout. All other pages fill the available width provided by AppShell padding

### Typography and Spacing

- **Font:** Inter (loaded via `next/font/google` with weights 300-700)
- **Page title:** use the shared `<PageHeader title=... />` component (see [Shared Page Chrome](#shared-page-chrome)) instead of raw `Typography` — every top-level page renders through it
- **Heading:** `variant="h5" sx={{ fontWeight: 700 }}` for in-page section headers that are not the page title
- **Subtitle:** `variant="subtitle1" sx={{ fontWeight: 700 }}` for section headers
- **Body:** `variant="body2"` for most content
- **Monospace:** `fontFamily: 'monospace'` for pod names, node names, log lines, resource values
- **Spacing:** MUI theme spacing unit (8px). Common values: `mb: 2` (16px), `gap: 1.5` (12px), `p: 2.5` (20px)

---

## 9. Real-Time Data Flows

### SSE: Cluster Status

**Component:** `ClusterStatusCard` via `useClusterStream()` hook

**Flow:**
1. Hook calls `fetch('/api/cluster/stream', { credentials: 'include' })` with an `AbortController`
2. Reads the response body as a `ReadableStream` with `TextDecoder`
3. Parses SSE format: looks for lines starting with `data: `, parses JSON
4. Pushes parsed `Overview` objects directly into TanStack cache: `queryClient.setQueryData(['overview'], data)`
5. On connection loss, waits 3-5 seconds and reconnects in a loop
6. Sets a `disconnected` flag after 2 consecutive failures, displayed as a warning chip

The SSE stream pushes updates within ~2 seconds of any cluster change (the backend `ClusterCache` debounce interval). If nothing changes, no events are sent. The REST polling fallback (`refetchInterval: 30_000`) only fires if the TanStack Query cache becomes stale, which normally does not happen while the SSE stream is healthy.

### WebSocket: Execution Logs

**Component:** `LogViewer` via the `useExecutionLogs` hook

**Connection flow:**
1. When `execution.status === 'running'`, `useExecutionLogs` opens `new WebSocket(wsPolicyLogsUrl(execution.id))`
2. The backend sends lines in three phases:
   - **Persisted lines** from PostgreSQL (ordered by `seq`)
   - **Replay buffer lines** covering the gap between the last DB flush and the subscription start (filtered to `seq > maxDBSeq`)
   - **Live stream** from the broker as new lines arrive
3. `ws.onmessage` deduplicates by `seq` (not `id`, since broker lines have `id: 0` before DB insertion) and buffers messages for RAF batch rendering
4. Each `requestAnimationFrame` flush sorts the batch by `seq` to guarantee visual ordering
5. For completed executions, the hook falls back to `getPolicyExecutionLogs()` via REST

**Reconnection:**
- On `ws.onerror`, reconnection is attempted with exponential backoff (1s base, 15s max, 10% jitter, 10 max retries)
- Reconnection only happens if the execution is still running (`isRunningRef.current`)
- On `ws.onclose`, the hook inspects the close code: 1000 (normal), 1008 (policy violation), and 1009 (message too large) are treated as terminal and do not trigger reconnection
- A `cleanClose` flag distinguishes graceful server-initiated disconnections (execution finished) from unexpected drops, suppressing the "connection lost" toast and spinner

**Deduplication:**
The frontend deduplicates by `line.seq` rather than `line.id` because the broker publishes lines before they are inserted into PostgreSQL. At publish time, `id` is 0 (the auto-increment primary key has not been assigned yet). The `seq` field is a per-execution monotonic counter assigned by the scheduler before publish, making it stable across both the broker and the database.

**Why the replay buffer matters:**
Log lines are batch-flushed to PostgreSQL every 50 lines but published to the broker immediately. When a client connects mid-execution, the DB may not yet contain recently published lines. The broker's replay buffer (last 256 lines) bridges this gap. Without it, lines emitted between the last DB flush and the WebSocket subscription would be lost. See `docs/observability.md` "Log Streaming Architecture" for the full backend design.

The WebSocket URL is constructed by replacing `http` with `ws` in the API base URL.

### REST Polling Fallback

Components that do not use SSE or WebSocket rely on TanStack Query's `refetchInterval` for freshness:

| Component | Query Key | Interval |
|:----------|:----------|:---------|
| WorkloadsTable | `['workloads']` | 30s |
| NodesTable | `['nodes']` | 30s |
| WorkloadDetailDrawer | `['workload-pods', ...]` | 15s |
| NodeDetailDrawer | `['node-pods', ...]` | 15s |
| PodDetailContent | `['pod-detail', ...]` | 15s |
| ActivityFeed | `['policy-executions', 'feed']` | 15s |
| ExecutionTable | `['policy-executions', ...]` | 10s |
| PoliciesPage | `['policies']` | 30s |
| ExceptionsPage | `['exceptions', ...]` | 30s |

### Auto-Scroll in PodLogViewer

`PodLogViewer` delegates streaming to the `usePodLogStream` hook and search UI to `LogSearchBar`. It manages auto-scroll via:

1. `autoScroll` state (default `true`)
2. `useEffect` that scrolls to bottom when `lines` change and `autoScroll` is true: `logRef.current.scrollTop = logRef.current.scrollHeight`
3. `onScroll` handler that detects if user is near the bottom (within 40px): `setAutoScroll(atBottom)`
4. User scrolling up disables auto-scroll; scrolling back to the bottom re-enables it
5. Clicking "next match" in search disables auto-scroll so the view stays at the match

The entrance animation (`LOG_WATERFALL_SX`) is only applied to newly appended lines. A `prevLineCountRef` tracks the line count from the previous render so that existing lines skip the animation, avoiding hundreds of concurrent CSS animations on each state update.

---

## 10. Observability

**Page:** `src/app/observability/page.tsx` (`/observability`)

A two-tab layout (Metrics Dashboard / API Rivers) sharing a single SSE stream. Tab selection and time range are synced to URL query params: `?tab=metrics|rivers&range=1m|5m|...|3d`.

### Data Flow

```
SSE /api/observability/stream
  → useObservabilityStream hook (single instance)
    → ObservabilityStreamContext (React context in layout.tsx)
      → ObservabilityPage (URL state, keyboard shortcuts)
      │   → MetricsDashboard (panels, call feed, overview, timeline)
      │   → ApiRivers (topology, particles, tooltips, minimap)
      → ComponentDetail (drill-down with skeleton loading)
```

The SSE stream is the sole data source -- there is no TanStack Query polling fallback. A single `useObservabilityStream` instance is created in `ObservabilityStreamProvider` (mounted in `observability/layout.tsx`) and shared via React context to all child routes. This means navigating between the dashboard and component drill-down pages does not tear down and re-establish the SSE connection -- the stream persists across route transitions, providing instant data availability on navigation.

### Key Components

All components live under `src/components/observability/`.

| Component | Purpose |
|:----------|:--------|
| MetricsDashboard.tsx | Main dashboard with 6 eCharts panels, fullscreen expand, comparison overlay |
| ApiRivers.tsx | 15-node topology with canvas particle system, GSAP animations, drag, zoom |
| StatusHeader.tsx | Live clock, KPI cards with sparklines, trend arrows, freshness indicator |
| SystemOverview.tsx | Hero card with traffic bar, latency breakdown, health grid, error summary |
| CallFeed.tsx | Live API call table with search, grouping, expandable rows, auto-scroll |
| ErrorTimeline.tsx | SVG timeline plotting incidents over error rate area |
| RiversMinimap.tsx | Thumbnail overview with viewport indicator and click-to-scroll |
| RiversLinkPopover.tsx | Click-activated link detail card with Go signature and trace action |
| RiversComponentPreview.tsx | Hover preview with live metrics, runtime limits, connections |
| RiversControls.tsx | Zoom +/- buttons |

### Key Hooks

- **`useObservabilityStream`** -- SSE connection with automatic reconnect using exponential backoff (5s base, 30s max), history ring buffer (60 entries), threshold crossing detection, and runtime config polling (30s). Instantiated once in the layout provider, not per-page.
- **`useSharedObservabilityStream`** -- Context consumer hook that reads from `ObservabilityStreamContext`. All observability pages and components use this instead of calling `useObservabilityStream` directly.
- **Lazy eCharts loading** -- a Promise-based dedup pattern ensures only one `import('echarts')` call is in-flight at a time, shared across all chart panels.
- **`useSharedClock`** (in `StatusHeader`) -- consolidates 3 timer intervals (clock, freshness, sparkline tick) into a single `setInterval`.

### State Management

| Concern | Approach |
|:--------|:---------|
| Stream data | Lifted to layout level via `ObservabilityStreamProvider`; all child routes consume via `useSharedObservabilityStream` context hook |
| Tab and time range | URL query params (`?tab=`, `?range=`) via `useSearchParams` |
| Rivers drag offsets | Persisted to `localStorage` |
| Keyboard shortcuts | Registered at page level (tab switching, time range cycling) |

No TanStack Query is used on this page. All data arrives via SSE push rather than request/response polling.

### Additional Observability Details

- **MetricsDashboard** uses a split `useEffect` pattern: one effect initializes chart instances (runs once), a separate effect updates chart data when the SSE stream delivers new snapshots.
- **ApiRivers** caches path lengths in the animation loop to avoid repeated `getTotalLength()` calls. Shadow blur is disabled when the particle count exceeds 300 to maintain frame rate.
- **Traffic segments** in `SystemOverview`: K8s API rates are converted from calls/min (backend) to req/s (display). WebSocket connections are no longer included in the traffic bar breakdown.
- **ComponentDetail** metadata (display names, descriptions, icons) is extracted to `src/lib/observability-components.ts` for reuse across the drill-down pages. The drill-down page displays MUI `Skeleton` placeholders for the status indicator and metric card values while waiting for the first SSE payload, providing immediate visual feedback on navigation.
- **Inverted threshold logic** applies to the `cache_hit` panel: higher values are better, so warning/critical thresholds are inverted compared to other panels.
- **Accessibility:** `aria-live="polite"` is set on key KPI values in `StatusHeader` and `MetricsDashboard` so screen readers announce metric changes.

### Performance Considerations

- The SSE stream is instantiated once in `ObservabilityStreamProvider` at the layout level. Navigating between `/observability` and `/observability/{component}` does not destroy or re-establish the connection, eliminating the 2--4 second data gap that would occur if each page managed its own stream.
- eCharts instances are disposed on unmount with `ResizeObserver` cleanup to prevent memory leaks.
- The particle animation in `ApiRivers` reads live data from refs (not effect dependencies) to avoid teardown and re-initialization on every SSE update.
- `AnimatePresence` in `CallFeed` is limited to the newest 5 rows to cap layout animation cost.
- The canvas renderer uses `devicePixelRatio` for crisp rendering on retina displays.
- GSAP is lazy-loaded via dynamic `import()` in `ApiRivers`.

---

## 11. Adding New Features Guide

### Adding a New Page

1. Create `src/app/<route>/page.tsx` with `'use client'` directive
2. Render the page title via `<PageHeader title="My Feature" />` from `@/components/shared/PageHeader` (see [Shared Page Chrome](#shared-page-chrome)). Pass `actions`, `subtitle`, `tabs`, or `meta` slots as needed -- do not hand-roll a `Typography h5`
3. For empty/no-data states, use `<EmptyState title="..." />` from `@/components/shared/EmptyState` rather than building a one-off dashed `Box`
4. Add a navigation entry to the `NAV` array in `src/components/layout/Sidebar.tsx`:
   ```typescript
   { label: 'My Feature', href: '/my-feature', icon: <SomeIcon fontSize="small" /> }
   ```
   If the page requires a permission, add `requirePerm: canDoSomething`
5. The page gets the full `AppShell` layout (sidebar + header) automatically via the provider stack
6. Use `useAuth()` for permission checks, `useQuery()` for data fetching

### Adding a New API Endpoint

1. Add the function to `src/lib/api.ts` following the existing pattern:
   ```typescript
   export const getMyData = (): Promise<MyType> =>
     apiFetch<MyType>('/api/my-endpoint')
   ```
   For mutations, specify `method` and `body`:
   ```typescript
   export const createMyData = (data: MyInput): Promise<MyType> =>
     apiFetch<MyType>('/api/my-endpoint', { method: 'POST', body: JSON.stringify(data) })
   ```
2. Add TypeScript types to `src/lib/types.ts`
3. Use the function in a component via `useQuery` or `useMutation`:
   ```typescript
   const { data, isLoading } = useQuery({
     queryKey: ['my-data'],
     queryFn: getMyData,
     refetchInterval: 30_000,
   })
   ```

### Adding a New Component

1. Place the file in the appropriate domain directory under `src/components/`
2. Use PascalCase for the filename matching the default export
3. Add `'use client'` at the top
4. Follow the prop pattern: accept data, callbacks, and permission flags as props. Components should not call `useAuth()` directly -- instead, receive boolean permission flags from their parent page
5. For color-coded status elements, use the maps in `lib/statusColors.ts` or `lib/colors.ts`

### Adding a New Settings Section

Follow the `AccountSettings` pattern:

1. Create `src/components/settings/MySettings.tsx`
2. Render a `Card` with `CardContent` containing the section title and form fields
3. Import and render the component in `src/app/settings/page.tsx`
4. Gate visibility with a permission check if needed:
   ```typescript
   {canDoSomething(user?.permissions) && <MySettings />}
   ```

### Adding Permission-Gated UI

1. Add a convenience wrapper in `src/lib/rbac.ts`:
   ```typescript
   export const canDoSomething = (p?: string[]) => hasPerm(p, 'my.permission')
   ```
2. In the page component, compute the boolean:
   ```typescript
   const canDo = canDoSomething(user?.permissions)
   ```
3. Pass it to child components as a prop, use it to disable buttons or hide sections
4. For pages that should be completely hidden from unauthorized users:
   - Add `requirePerm` to the sidebar nav entry
   - Add a `useEffect` guard that redirects to `/overview`
   - Return `null` after the guard (after all hooks)
