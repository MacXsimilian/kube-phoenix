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
10. [Adding New Features Guide](#10-adding-new-features-guide)

---

## 1. Overview

The kube-phoenix frontend is the operator-facing UI for managing Kubernetes sleep/wake policies. It lets operators view cluster state (workloads, nodes, pods), create and manage scheduling policies with sleep windows, monitor live execution logs, configure guardrails, and administer users. The entire application is a client-side SPA with no server-side rendering -- the Go backend serves it as static files embedded in the binary.

**Tech stack:**

| Layer | Version |
|:------|:--------|
| Next.js | 16 (static export, `output: 'export'`) |
| React | 19 |
| MUI (Material UI) | v7 |
| TanStack Query | v5 |
| Emotion | v11 (MUI's styling engine) |
| dnd-kit | v6/v9/v10 (drag-and-drop for policy ordering) |
| cronstrue | v3 (human-readable cron descriptions) |
| TypeScript | 5 |

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
  src/
    app/                        # Next.js App Router pages
      layout.tsx                # Root layout: Inter font, <Providers> wrapper
      providers.tsx             # Provider stack (QueryClient, Theme, Auth)
      overview/page.tsx         # /overview -- dashboard
      cluster/page.tsx          # /cluster -- workloads & nodes tabs
      policies/page.tsx         # /policies -- policy list
      policies/detail/page.tsx  # /policies/detail/?id=N -- single policy
      exceptions/page.tsx       # /exceptions -- scheduled exceptions list
      history/page.tsx          # /history -- execution history
      audit/page.tsx            # /audit -- audit log (viewer and above)
      users/page.tsx            # /users -- user management (admin)
      settings/page.tsx         # /settings -- appearance, account, OIDC, DB reset
      guardrails/page.tsx       # /guardrails -- guardrails editor
    components/
      layout/
        Sidebar.tsx             # Navigation sidebar (permanent on desktop, temporary on mobile)
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
        PodLogViewer.tsx        # Live streaming pod logs with search/download
        PodRow.tsx              # Shared table row for pod listings
        statusColors.ts         # Mode-aware workload/node/pod status color maps
      policies/
        PolicyCard.tsx          # Card for each policy in the list view
        CreatePolicyDialog.tsx  # Create/edit policy dialog with window picker + preview
        ExceptionDialog.tsx     # Create/edit scheduled exception
        ExceptionsSection.tsx   # Exception table in policy detail
        OverridesSection.tsx    # Override table + inline create form in policy detail
        WeeklyTimeline.tsx      # SVG 7-day bar chart timeline
        LedGlowTimeline.tsx     # SVG 7-day LED-strip timeline with glow filters
        MiniTimeline.tsx        # Full-width single-day 24h sparkline for policy cards
        WindowPicker.tsx        # Sleep window editor with day buttons + time selectors
        LegendItem.tsx          # Shared timeline legend dot + label
        ExecutionHistoryTable.tsx # Execution table embedded in policy detail
      history/
        ExecutionTable.tsx      # Paginated execution list (global history page)
        LogViewer.tsx           # WebSocket-driven execution log drawer with summary
      common/
        LabeledSwitch.tsx       # Shared labeled toggle: Switch + bold title + caption description
      shared/
        StatusChip.tsx          # Reusable status chip with color mapping
      guardrails/
        GuardrailsForm.tsx      # Chip-based namespace/label/taint editor
      settings/
        AccountSettings.tsx     # Password change (local users only)
        DatabaseSettings.tsx    # Multi-step DB reset with confirmation phrase
        AppearanceSettings.tsx  # Light/dark/system theme selector
      ErrorBoundary.tsx         # React error boundary
    lib/
      api.ts                    # Centralized fetch wrapper + all API functions
      auth.tsx                  # AuthContext provider, login/logout, session management
      types.ts                  # TypeScript interfaces for all backend models + shared UI types (SnackMessage)
      colors.ts                 # Semantic color palette, useColors() hook, TIMELINE_COLORS
      statusColors.ts           # Color maps for states, executions, modes, types, log levels
      constants.ts              # Polling intervals, drawer constraints, log limits, timezones
      formatters.ts             # CPU/memory/time formatting utilities
      windowUtils.ts            # Sleep window evaluation, timezone handling, timeline math
      rbac.ts                   # Permission checking helpers
      themeMode.tsx             # ThemeModeProvider context (light/dark/system + localStorage)
      queryClient.ts            # TanStack QueryClient singleton with default options
      usePolicyTriggers.ts      # Shared sleep/wake mutation hook (invalidation + navigation)
      useDrawerResize.ts        # Mouse/touch drag resize hook for side drawers
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
| Workload pods | 15s | `WORKLOAD_PODS_REFETCH_MS` |
| Node pods | 15s | `NODE_PODS_REFETCH_MS` |
| Activity feed | 15s | `ACTIVITY_FEED_REFETCH_MS` |
| Overview (fallback) | 30s | Inline |
| Executions (history) | 10s | Inline |
| Policies | 30s | Inline |
| Exceptions | 30s | Inline |

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
export const canEditSchedules    = (p?: string[]) => hasPerm(p, 'schedule.edit')
export const canTriggerSchedules = (p?: string[]) => hasPerm(p, 'schedule.trigger')
export const canEditGuardrails   = (p?: string[]) => hasPerm(p, 'guardrail.edit')
export const canManageUsers      = (p?: string[]) => hasPerm(p, 'user.manage')
export const canResetDB          = (p?: string[]) => hasPerm(p, 'admin.reset_db')
export const canViewAudit        = (p?: string[]) => hasPerm(p, 'audit.view')
```

Usage pattern: pages call `useAuth()` to get the user, then pass boolean `canEdit`/`canTrigger` props to child components that disable buttons or hide sections. Pages requiring specific permissions (Audit, Users) also perform a navigation guard: `if (user && !canViewAudit(user.permissions)) router.replace('/overview')`.

The sidebar filters navigation items based on permissions, hiding "Users" and "Audit Log" from users without the required permissions.

---

## 4. API Layer Deep Dive

### Core Request Function

All API calls go through the `req<T>()` function in `lib/api.ts`:

```typescript
async function req<T>(path: string, options?: RequestInit): Promise<T>
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

**Overview:**

| Function | Method | Endpoint |
|:---------|:-------|:---------|
| `getOverview()` | GET | `/api/overview` |

**Cluster:**

| Function | Method | Endpoint |
|:---------|:-------|:---------|
| `getWorkloads()` | GET | `/api/cluster/workloads` |
| `getNodes()` | GET | `/api/cluster/nodes` |
| `getNodePods(nodeName)` | GET | `/api/cluster/nodes/{nodeName}/pods` |
| `getPodDetail(ns, pod)` | GET | `/api/cluster/pods/{ns}/{pod}` |
| `getWorkloadPods(ns, kind, name)` | GET | `/api/cluster/workloads/{ns}/{kind}/{name}/pods` |
| `getPodLogs(ns, pod, container?, tail?, prev?)` | GET | `/api/cluster/pods/{ns}/{pod}/logs` |
| `streamPodLogs(ns, pod, container?, tail?, signal?)` | GET | `/api/cluster/pods/{ns}/{pod}/logs?follow=true` |

**Policies:**

| Function | Method | Endpoint |
|:---------|:-------|:---------|
| `getPolicies()` | GET | `/api/policies` |
| `getPolicy(id)` | GET | `/api/policies/{id}` |
| `createPolicy(data)` | POST | `/api/policies` |
| `updatePolicy(id, data)` | PUT | `/api/policies/{id}` |
| `deletePolicy(id)` | DELETE | `/api/policies/{id}` |
| `triggerPolicySleep(id)` | POST | `/api/policies/{id}/sleep` |
| `triggerPolicyWake(id)` | POST | `/api/policies/{id}/wake` |

**Policy Executions:**

| Function | Method | Endpoint |
|:---------|:-------|:---------|
| `getPolicyExecutions(params?)` | GET | `/api/policy-executions?...` |
| `getPolicyExecution(id)` | GET | `/api/policy-executions/{id}` |
| `getPolicyExecutionLogs(id)` | GET | `/api/policy-executions/{id}/logs` |
| `getPolicyExecutionSnapshots(id)` | GET | `/api/policy-executions/{id}/snapshots` |
| `getPolicySnapshots(policyId, open?)` | GET | `/api/policies/{policyId}/snapshots` |

**Policy Overrides:**

| Function | Method | Endpoint |
|:---------|:-------|:---------|
| `getPolicyOverrides(policyId)` | GET | `/api/policies/{policyId}/overrides` |
| `createPolicyOverride(policyId, data)` | POST | `/api/policies/{policyId}/overrides` |
| `deletePolicyOverride(policyId, overrideId)` | DELETE | `/api/policies/{policyId}/overrides/{overrideId}` |

**Scheduled Exceptions:**

| Function | Method | Endpoint |
|:---------|:-------|:---------|
| `getExceptions(params?)` | GET | `/api/exceptions?...` |
| `getException(id)` | GET | `/api/exceptions/{id}` |
| `createException(data)` | POST | `/api/exceptions` |
| `updateException(id, data)` | PUT | `/api/exceptions/{id}` |
| `deleteException(id)` | DELETE | `/api/exceptions/{id}` |

**Users:**

| Function | Method | Endpoint |
|:---------|:-------|:---------|
| `getUsers()` | GET | `/api/users` |
| `createUserAPI(data)` | POST | `/api/users` |
| `updateUserAPI(id, data)` | PUT | `/api/users/{id}` |
| `deleteUserAPI(id)` | DELETE | `/api/users/{id}` |
| `changePasswordAPI(current, new)` | PUT | `/api/auth/password` |

**Auth/OIDC:**

| Function | Method | Endpoint |
|:---------|:-------|:---------|
| `getOIDCConfig()` | GET | `/api/auth/oidc/config` |

**Audit:**

| Function | Method | Endpoint |
|:---------|:-------|:---------|
| `getAuditLogs(params?)` | GET | `/api/audit-logs?...` |

**Admin:**

| Function | Method | Endpoint |
|:---------|:-------|:---------|
| `resetDatabaseStream()` | POST | `/api/danger/reset-db` |

### Streaming: Pod Logs

`streamPodLogs()` returns an object with a `start()` method. It uses `fetch()` with `follow=true` to get a chunked HTTP response, then reads the `ReadableStream` with a `TextDecoder`, splitting on newlines and calling `onLine()` for each line. This is not SSE -- it is raw chunked text streaming from the Kubernetes API (proxied through the Go backend).

```typescript
streamPodLogs(namespace, podName, container?, tailLines?, signal?): {
  start: (onLine, onError, onDone) => void
}
```

The caller passes an `AbortSignal` to cancel the stream (used when the component unmounts or the user switches containers).

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
- Sleep Now / Wake Now buttons gated by `canTriggerSchedules` permission
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
- **Filters:** Search (text), Namespace (dropdown built from data), Status (dropdown), "Would be affected" toggle (cross-references guardrails skip namespaces)
- **Sorting:** Column headers toggle asc/desc/none via `TableSortLabel`
- **Status from URL:** Reads `?status=` from search params to pre-filter (used when clicking chips on the overview dashboard)
- **Row click:** Opens `WorkloadDetailDrawer`

#### NodesTable

`src/components/cluster/NodesTable.tsx`

- **Data:** `useQuery(['nodes'], getNodes, { refetchInterval: 30_000 })`
- **Filters:** Search, "Group by zone" toggle
- **Zone grouping:** When enabled, nodes are grouped under zone header rows showing aggregate stats (node count, total pods, CPU/MEM percentages)
- **Resource bars:** `ResourceBar` sub-component renders a colored `LinearProgress` bar with percentage, colored based on utilization thresholds (green < 65%, amber 65-84%, red >= 85%) via `pctColor()`
- **Row click:** Opens `NodeDetailDrawer`

#### useDrawerResize Hook

`src/lib/useDrawerResize.ts`

Both detail drawers use this hook for drag-to-resize:

```typescript
function useDrawerResize(initial: number, min?: number):
  [number, (e: React.MouseEvent) => void, (e: React.TouchEvent) => void]
```

Returns `[drawerWidth, handleResizeMouseDown, handleResizeTouchStart]`.

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

Bands (top to bottom):
1. **Hero band** -- state-colored gradient background (`HERO_HEADER_GRADIENTS`), back button, 64px state icon, policy name + description, large state label, mode/enabled chips, action buttons (Sleep Now, Wake Now, Edit, Exception)
2. **Timeline band** -- `LedGlowTimeline` filling the left, weekly stats (Sleep/Week, Awake/Week, Next Transition with countdown) on the right
3. **Overrides + Exceptions band** -- subtle alternating background, side-by-side `OverridesSection` and `ExceptionsSection` (wraps on mobile)
4. **Execution History band** -- `ExecutionHistoryTable` at full width. Clicking a row opens the log viewer drawer inline (same behaviour as the History page), using `selectedExec` state and the `LogViewer` component.

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

All three timeline components use raw SVG for rendering. They share timeline math from `lib/windowUtils.ts`.

**WeeklyTimeline** (`WeeklyTimeline.tsx`):
- 7 rows (Mon-Sun), 24h per row
- Fixed dimensions: 480px bar width + 36px label width
- Green background for awake time, purple blocks for sleep windows
- Override blocks in orange/red, exception blocks in green/red
- Current time marker as a red vertical line spanning all rows
- Hour labels at 0, 3, 6, 9, 12, 15, 18, 21
- Today's row has a brighter background
- Used in `CreatePolicyDialog` for schedule preview

**LedGlowTimeline** (`LedGlowTimeline.tsx`):
- Same 7-row layout but rendered as thin LED strips (6px height)
- SVG `<filter>` elements create glow effects (feGaussianBlur + feMerge)
- Different glow filters for sleep (purple), override (orange), exception (red/green)
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

**Shared timeline math:**

The `DOW_MAP` constant maps array index to JS day-of-week: `[1,2,3,4,5,6,0]` (Mon=0 through Sun=6 in timeline row space, where Mon is row 0 and Sun is row 6).

`computeTimeRangeBlocks(startISO, endISO, tz?)` splits an absolute time range into per-day `TimeBlock` objects, each with `{ row, startHour, endHour }`. This is used by overrides and exceptions to render their blocks on the timeline grid.

#### Overrides and Exceptions on the Timeline

Both `WeeklyTimeline` and `LedGlowTimeline` accept optional `overrides` and `exceptions` props. They convert these absolute time ranges into timeline blocks using `computeTimeRangeBlocks()`, then render them on top of the sleep window blocks. Cancelled and completed exceptions are filtered out before rendering.

### Execution History

**Page:** `src/app/history/page.tsx`

The history page composes `ExecutionTable` and `LogViewer`. It supports deep-linking via `?exec=N` to auto-open a specific execution's log drawer.

#### ExecutionTable

`src/components/history/ExecutionTable.tsx`

- Paginated table using `TablePagination` (10/20/50 rows per page)
- Refetches every 10s to catch newly completed executions
- **Filter dropdowns** for Status (running/success/failed/interrupted/skipped) and Direction (sleep/wake)
- Columns: Started (`fmtDtShort` with year), Policy name (from preloaded relation), Direction (sleep/wake icon), Mode chip (using `MODE_COLORS`), Status via `StatusChip`, Duration (`fmtDuration`), Summary (icons for scaled/drained/deleted/errors)
- Header styling extracted to `HEADER_SX` constant; chip sizing uses shared `SMALL_CHIP_SX`
- Row click calls `onSelect(execution)`, which opens the `LogViewer` drawer

#### LogViewer

`src/components/history/LogViewer.tsx`

The execution log viewer is a resizable right-side drawer with:

1. **Header:** Direction icon, execution ID, running spinner, mode chip, count chips (scaled, drained, errors)
2. **Summary accordion** (`PolicyExecutionSummary`): Parses all log lines using regex patterns to extract structured data:
   - Workload entries: "Scaled Deployment ns/name -> 0", "Restored ...", "Would scale ..."
   - Node entries: "Drained node ...", "Deleted node ...", "Would drain ..."
   - Groups workloads by namespace
   - Shows error count chip
3. **Log lines area:** Each line rendered with timestamp (30% opacity) and message colored by log level
4. **Error navigation:** "Jump to error" button cycles through error-level lines, scrolling to each

**Data source depends on execution status:**
- `status === 'running'`: Opens a WebSocket to `wsPolicyLogsUrl(execution.id)`. Lines arrive as JSON `LogLine` objects via `ws.onmessage`. Auto-reconnects after 3s on error.
- `status !== 'running'`: Fetches all lines via `getPolicyExecutionLogs(id)` as a standard REST query.

**Log level colors** are defined in `lib/statusColors.ts`:

```typescript
// Dark mode
{ info: '#22D3EE', ok: '#22C55E', plan: '#C084FC', error: '#F87171', warn: '#FBBF24' }
// Light mode
{ info: '#0369A1', ok: '#15803D', plan: '#6D28D9', error: '#B91C1C', warn: '#92400E' }
```

### Exceptions and Overrides

#### ExceptionDialog

`src/components/policies/ExceptionDialog.tsx`

Handles both create and edit modes. Key datetime handling:

- The dialog stores dates in two formats: `startsAtLocal` (for the `datetime-local` input) and `startsAt` (ISO string for the API)
- `toLocalDatetimeInput(iso)` converts an ISO string to `YYYY-MM-DDTHH:mm` format for the input
- `toISO(localDT)` converts the local datetime-local value back to ISO via `new Date(localDT).toISOString()`
- Times are always displayed with a note: "Times are in your browser's local timezone"
- Validation checks: start must be in the future (for new exceptions), end must be after start

#### ExceptionsSection / OverridesSection

Both use the shared `TYPE_LABELS` map from `lib/statusColors.ts` to color-code exception/override types:

```typescript
const TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  stay_awake:  { label: 'Stay Awake',  color: '#FCD34D', bg: 'rgba(245,158,11,0.15)' },
  force_sleep: { label: 'Force Sleep', color: '#FCA5A5', bg: 'rgba(239,68,68,0.15)' },
  skip_sleep:  { label: 'Skip Sleep',  color: '#A5B4FC', bg: 'rgba(99,102,241,0.15)' },
  skip_wake:   { label: 'Skip Wake',   color: '#A5B4FC', bg: 'rgba(99,102,241,0.15)' },
}
```

**Exception status lifecycle:** `pending` (created, start time is in the future) -> `active` (start time has passed, the backend activates the exception) -> `completed` (end time has passed) or `cancelled` (manually cancelled). The backend manages these transitions; the frontend only displays them.

**OverridesSection** includes an inline create form (not a dialog) that expands within the section. Override types `stay_awake` and `force_sleep` require start/end datetime fields; `skip_sleep` and `skip_wake` require a single target cron time.

### Audit Log

**Page:** `src/app/audit/page.tsx`

Displays a paginated, filterable table of audit log entries. Gated by the `audit.view` permission — users without it are redirected to `/overview/`.

**Filters:** `User` (debounced text, exact-match) and `Action` (dropdown built from `ACTION_LABELS`). Both reset pagination to page 0 on change.

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

**Key helpers (all defined in `audit/page.tsx`):**

| Symbol | Purpose |
|:-------|:--------|
| `NULL_SNAPSHOT` | Constant `'null'` — the string value stored in the DB when before/after is absent |
| `isEmptySnapshot(json?)` | Returns `true` when `json` is falsy or equals `NULL_SNAPSHOT` |
| `flattenToLeaves(value, prefix?)` | Recursively flattens an object to dot-notation key → JSON-value pairs (e.g. `{ "settings.timezone": '"UTC"' }`) |
| `parseSnapshot(json)` | Parses a JSON string and flattens it; returns `null` on parse error |
| `classifyLine(key, before?, after?)` | Classifies a single key as `added`, `removed`, `changed`, or `unchanged` |
| `computeDiff(beforeJson?, afterJson?)` | Orchestrates snapshot parsing and line classification; returns `null` when both snapshots are empty |
| `formatChangeSummary(count)` | Formats the "N fields changed" summary label |
| `DIFF_STYLE` | `Record<DiffType, { bg, border, text, prefix }>` — single source of truth for all diff styling per type |
| `DiffLineRow` | Renders a single classified diff line with the appropriate colours and prefix symbol |

---

### Settings

**Page:** `src/app/settings/page.tsx`

Composes multiple settings cards: `AppearanceSettings`, `AccountSettings`, OIDC config display, and `DatabaseSettings`.

#### AccountSettings

`src/components/settings/AccountSettings.tsx`

- Displays username, role, source (local/OIDC)
- "Change Password" button (only for `source === 'local'`) opens a dialog
- Uses direct `async/await` with `changePasswordAPI()` rather than `useMutation` (simpler for single-use forms)
- Validation: current password required, new password minimum 8 characters

#### DatabaseSettings

`src/components/settings/DatabaseSettings.tsx`

A multi-step destructive action flow:

1. **Step 1 dialog:** "Are you absolutely sure?" with description of what will be destroyed
2. **Step 2 dialog:** Type `RESET DATABASE` to confirm (exact phrase match required)
3. **Progress dialog:** Streams `ResetEvent` objects from `resetDatabaseStream()` async generator, showing each step in a monospace log view
4. On success (`type === 'done'`), calls `queryClient.clear()` to wipe the entire cache

#### GuardrailsForm

`src/components/guardrails/GuardrailsForm.tsx`

The guardrails editor uses a custom `ChipInput` component for tag-like editing:

- Type a value and press Enter to add a chip
- Press Backspace on an empty input to remove the last chip
- `onBlur` also commits the current input value
- Values are stored as `string[]` locally and serialized to CSV for the API

The `ProtectedChipInput` variant (for system namespaces) adds a confirmation dialog when removing a chip, warning that removing a system-protected namespace could affect critical infrastructure.

Data is loaded from the API as CSV strings and split with `fromCsv()`. On save, arrays are joined back with `csv()`.

The form also includes a "Scheduler Behaviour" card with three controls: an `Eval Interval` text field (Go duration string, validated with a regex before save) and two `LabeledSwitch` toggles for `Auto Wake` and `Reconcile While Awake`. These map to the three scheduler settings in the `Guardrails` model (`SchedulerEvalInterval`, `SchedulerAutoWake`, `SchedulerReconcileWhileAwake`).

**`LabeledSwitch`** (`components/common/LabeledSwitch.tsx`): A shared component that renders a `FormControlLabel` wrapping a `Switch` with a two-line label (bold title + secondary caption). Used by `GuardrailsForm` and `ExceptionDialog`.

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
| `pctColor(p, isDark)` | `(number, boolean) -> string` | Color by percentage threshold: green < 65%, amber 65-84%, red >= 85% | NodesTable, NodeDetailDrawer |
| `fmtDt(iso)` | `string \| null -> string` | ISO to locale string, or em-dash for null | PolicyDetailPage, ExceptionsSection, OverridesSection, ExceptionsPage |
| `fmtDtShort(iso)` | `string \| null -> string` | ISO to short date with year: `"Mar 24, 2026, 2:15 PM"` | ExecutionTable, ExecutionHistoryTable |
| `fmtDuration(start, end)` | `(string, string \| null) -> string` | Duration between two ISO timestamps: `"5s"`, `"2m 30s"`, or `"Running…"` | ExecutionTable, ExecutionHistoryTable |
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

**`semanticColors(isDark)`** returns a flat object of 18 named colors, each adapting to the current theme mode. This is the canonical color palette for non-MUI-theme colors:

```typescript
{
  success, warning, error, errorLight, info, muted, orange, cyan, purple,
  successBg, warningBg, errorBg, infoBg, mutedBg, orangeBg, purpleBg,
  zoneBg,
}
```

**`useColors()`** is a React hook that calls `useTheme()` to detect the current mode and returns `semanticColors(isDark)`.

**`TIMELINE_COLORS`** is a static object with named colors for timeline rendering: `sleep`, `sleepGlow`, `exception`, `exceptionBg`, `override`, `awake`, `awakeBg`, `sleepBg`. These are not mode-aware because timelines render the same in both themes.

### lib/statusColors.ts

| Export | Type | Purpose |
|:-------|:-----|:--------|
| `STATE_COLORS` | `Record<string, { bg, color, label }>` | Policy current state (sleeping, awake, transitioning, unknown) |
| `EXECUTION_STATUS_COLORS` | `Record<string, { bg, color }>` | Execution and exception statuses (running, success, failed, interrupted, skipped, pending, active, completed, cancelled) |
| `EXECUTION_STATUS_FALLBACK` | `{ bg, color }` | Default for unknown status strings |
| `MODE_COLORS` | `Record<string, { bg, color }>` | Plan (blue) and Apply (amber) mode chips |
| `SMALL_CHIP_SX` | `{ height: 18, fontSize: 10 }` | Shared sx for small chips (mode, type badges) |
| `CARD_HEADER_GRADIENTS` | `Record<string, string>` | Horizontal gradient for PolicyCard top edge (3px bar) |
| `HERO_HEADER_GRADIENTS` | `Record<string, string>` | Vertical gradient for detail page hero band background |
| `LED_COLORS` | `Record<string, { bg, glow }>` | LED dot colors per policy state (bg color + glow shadow) |
| `SUBTLE_BORDER` | `string` | Subtle separator color (`rgba(255,255,255,0.04)`) for full-width bands |
| `TYPE_LABELS` | `Record<string, { label, color, bg }>` | Override/exception types (stay_awake, force_sleep, skip_sleep, skip_wake) |
| `TYPE_LABEL_FALLBACK` | `{ label, color, bg }` | Default for unknown type strings |
| `ACTION_LABELS` | `Record<string, string>` | Human-readable labels for audit log actions (e.g. `policy.update` → "Policy Update") |
| `formatActionLabel(action)` | `(string) → string` | Returns the label for an action key, with auto-formatting fallback for unknown actions |
| `actionColor(action)` | `(string) → MUI color` | Derives semantic chip color from action verb suffix (`.create` → success, `.delete` → error, `.update` → info) |
| `LOG_LEVEL_COLORS_DARK` | `Record<LogLine['level'], string>` | Log line text colors (dark mode) |
| `LOG_LEVEL_COLORS_LIGHT` | `Record<LogLine['level'], string>` | Log line text colors (light mode) |

### lib/constants.ts

| Constant | Value | Purpose |
|:---------|:------|:--------|
| `TIMEZONES` | 50+ IANA timezone strings | Dropdown options for policy timezone selector |
| `REQUEST_TIMEOUT_MS` | 30,000 | Default fetch timeout |
| `DEFAULT_STALE_TIME_MS` | 30,000 | TanStack Query default stale time |
| `WORKLOADS_REFETCH_MS` | 30,000 | Workload list polling interval |
| `ACTIVITY_FEED_STALE_MS` | 14,000 | Activity feed stale time |
| `ACTIVITY_FEED_REFETCH_MS` | 15,000 | Activity feed polling interval |
| `NODE_PODS_REFETCH_MS` | 15,000 | Node pod list polling interval |
| `WORKLOAD_PODS_REFETCH_MS` | 15,000 | Workload pod list polling interval |
| `WS_RECONNECT_DELAY_MS` | 3,000 | WebSocket reconnection delay |
| `SNACKBAR_AUTO_HIDE_MS` | 2,000 | Snackbar auto-dismiss time |
| `DRAWER_MIN_WIDTH` | 360 | Minimum drawer width in pixels |
| `DRAWER_MAX_WIDTH_RATIO` | 0.9 | Maximum drawer width as fraction of viewport |
| `LOG_INITIAL_TAIL` | 500 | Initial pod log lines to fetch |
| `LOG_LOAD_INCREMENT` | 2,000 | Lines added when "Load older logs" is clicked |
| `LOG_MAX_LINES` | 10,000 | Maximum lines kept in memory |
| `MAX_TIMEOUT_MINUTES` | 1,440 | Maximum policy timeout (24 hours) |
| `MINUTES_PER_HOUR` | 60 | Time unit constant |
| `MINUTES_PER_DAY` | 1,440 | Time unit constant |
| `HOURS_PER_WEEK` | 168 | Time unit constant |

### lib/rbac.ts

A thin permission-checking layer. `hasPerm(permissions, perm)` checks if a string exists in the permissions array. Six convenience wrappers are exported for common checks. See [RBAC](#rbac) in Architecture Patterns.

### lib/usePolicyTriggers.ts

A custom hook that encapsulates sleep/wake trigger mutations for a policy. Returns `{ sleepMut, wakeMut, isBusy }`. On success, it invalidates the `policies`, `policy`, `policy-executions` query keys and navigates to the execution detail view. On error, it calls the provided `onNotify` callback. Used by both `PolicyCard` and `PolicyDetailPage` to avoid duplicating mutation setup, query invalidation, and error handling.

### lib/useDrawerResize.ts

See [useDrawerResize Hook](#usedrawerresize-hook) in the Cluster Views section.

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

**Use `statusColors.ts` maps** for status-dependent coloring:
```typescript
const stateStyle = STATE_COLORS[policy.currentState] ?? STATE_COLORS.unknown
sx={{ bgcolor: stateStyle.bg, color: stateStyle.color }}
```

### Responsive Patterns

- **Drawer width:** `width: { xs: '100vw', md: drawerWidth }` -- full viewport on mobile, resizable on desktop
- **Resize handle:** `display: { xs: 'none', md: 'block' }` -- hidden on mobile
- **Sidebar:** Temporary drawer on mobile (`xs`), permanent on desktop (`md`)
- **Grid layouts:** `<Grid size={{ xs: 12, md: 6 }}>` -- full width on mobile, half on desktop
- **Page max-width:** Settings page uses `maxWidth: 720` with `mx: 'auto'` (form-centric layout). All other pages fill the available width provided by AppShell padding

### Typography and Spacing

- **Font:** Inter (loaded via `next/font/google` with weights 300-700)
- **Heading:** `variant="h5" fontWeight={700}` for page titles
- **Subtitle:** `variant="subtitle1" fontWeight={700}` for section headers
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

The SSE stream pushes updates roughly every 10 seconds (the backend `ClusterCache` refresh interval). The REST polling fallback (`refetchInterval: 30_000`) only fires if the TanStack Query cache becomes stale, which normally does not happen while the SSE stream is healthy.

### WebSocket: Execution Logs

**Component:** `LogViewer`

**Flow:**
1. When `execution.status === 'running'`, the component opens `new WebSocket(wsPolicyLogsUrl(execution.id))`
2. `ws.onmessage` parses each message as a JSON `LogLine` and appends to `liveLines` state
3. On `ws.onerror`, sets error state and attempts reconnection after 3 seconds (`WS_RECONNECT_DELAY_MS`)
4. Reconnection only happens if the execution is still running (`isRunningRef.current`)
5. On component unmount or execution change, the WebSocket is closed via cleanup function

The WebSocket URL is constructed by replacing `http` with `ws` in the API base URL. The backend replays all existing log lines on connection, then streams new ones as they arrive from the policy scaler.

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

`PodLogViewer` manages auto-scroll via:

1. `autoScroll` state (default `true`)
2. `useEffect` that scrolls to bottom when `lines` change and `autoScroll` is true: `logRef.current.scrollTop = logRef.current.scrollHeight`
3. `onScroll` handler that detects if user is near the bottom (within 40px): `setAutoScroll(atBottom)`
4. User scrolling up disables auto-scroll; scrolling back to the bottom re-enables it
5. Clicking "next match" in search disables auto-scroll so the view stays at the match

---

## 10. Adding New Features Guide

### Adding a New Page

1. Create `src/app/<route>/page.tsx` with `'use client'` directive
2. Add a navigation entry to the `NAV` array in `src/components/layout/Sidebar.tsx`:
   ```typescript
   { label: 'My Feature', href: '/my-feature', icon: <SomeIcon fontSize="small" /> }
   ```
   If the page requires a permission, add `requirePerm: canDoSomething`
3. The page gets the full `AppShell` layout (sidebar + header) automatically via the provider stack
4. Use `useAuth()` for permission checks, `useQuery()` for data fetching

### Adding a New API Endpoint

1. Add the function to `src/lib/api.ts` following the existing pattern:
   ```typescript
   export const getMyData = (): Promise<MyType> =>
     req<MyType>('/api/my-endpoint')
   ```
   For mutations, specify `method` and `body`:
   ```typescript
   export const createMyData = (data: MyInput): Promise<MyType> =>
     req<MyType>('/api/my-endpoint', { method: 'POST', body: JSON.stringify(data) })
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
