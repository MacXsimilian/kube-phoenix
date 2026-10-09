# Frontend Data Flow

This reference explains how browser state and backend data reach the UI. Start with the [Frontend Developer Guide](../frontend-dev-guide.md) for setup, common changes, and validation. See [API documentation](../api.md) for request/response contracts.

[Routing](#routing-and-static-export) · [Providers](#providers-and-state-ownership) · [Authentication](#authentication-and-permissions) · [Requests](#request-boundary) · [Queries](#queries-and-mutations) · [Streams](#streaming-data) · [Observability](#observability-state)

## Routing and static export

[`next.config.mjs`](../../frontend/next.config.mjs) enables static export and trailing slashes. `npm run build` writes HTML and assets to `frontend/out/`; the Go build embeds them through [`backend/web`](../../backend/web/embed.go).

Each exported route serves its own HTML. `/policies/` resolves to `policies/index.html`, `/policies` redirects to the slash form, and existing assets are served directly. Unknown paths retain the root HTML fallback. Browser navigation working in development is therefore insufficient on its own: a new route must also survive export, a direct request, and reload.

The Go embed pattern includes underscore-prefixed directories such as `_next/static/`, so the compiled JavaScript and CSS ship with the HTML. The final-image smoke check fetches the root page and a referenced Next.js script to catch missing assets or assets incorrectly served as the HTML fallback.

Resource IDs that exist only at runtime use query strings, such as `/policies/detail/?id=4&exec=14`. A dynamic path can be exported when all of its values are known at build time. [`observability/[component]/page.tsx`](../../frontend/src/app/observability/[component]/page.tsx) does this with `generateStaticParams()`.

Keep browser hooks in client components and follow the existing `Suspense` boundary pattern when using `useSearchParams()`. The production application has no Next.js request-time server functions or API handlers; API work belongs in the Go backend.

## Providers and state ownership

[`app/providers.tsx`](../../frontend/src/app/providers.tsx) establishes these boundaries:

```text
QueryClientProvider
  ThemeModeProvider
    ClockTickProvider
      MUI ThemeProvider + CssBaseline
        AuthProvider
          AppContent: checking, backend unavailable, login, or authenticated shell
            ErrorBoundary
              UnsavedChangesProvider
                AppShell + route
```

The observability route layout adds its own `ObservabilityStreamProvider`. It stays mounted when moving between that dashboard and its component pages.

| State | Owner | Reason |
| :---- | :---- | :----- |
| REST resources and historical logs | TanStack Query | Shared cache, refetch and mutation invalidation |
| Session/user and permissions | `AuthProvider` | Authentication must be available before protected routes render |
| Theme preference | `ThemeModeProvider` | Shared appearance, including persisted light/dark/system choice |
| Wall-clock refresh | `ClockTickProvider` | A shared tick for relative-time displays |
| Drafts, filters, selected rows, open dialogs | The owning component or hook | Interaction state stays close to the UI that changes it |
| Live execution/pod log buffers | Their streaming hooks | Arrival batches and connection lifecycle differ from REST queries |
| Observability live samples, calls and connection state | Route-scoped stream contexts | One stream with separate subscriptions for different consumers |

TanStack Query is the default for REST server state, not a container for every kind of application state. Reuse the existing owners before adding another global context or store.

The workloads table filters its cached collection locally. Its status filter also reads the `status` URL parameter on navigation; clearing filters therefore updates both local state and the URL with `history.replaceState`. Other filters remain component state. Preserve this boundary so a cleared deep link does not reapply a stale filter or trigger an unnecessary API request.

## Authentication and permissions

[`AuthProvider`](../../frontend/src/lib/auth.tsx) fetches `/api/auth/me` and the OIDC configuration on mount. It distinguishes an unauthenticated response from a network/server failure. Startup failures show the backend-unavailable state; failed periodic refreshes preserve the current user rather than treating an outage as a logout.

The provider also contains a compatibility probe: after a 401/403 from `/me`, a successful unauthenticated `/api/policies` response creates a synthetic development user. This is not a supported authentication-off setting for the Go backend, which enforces sessions. The bundled mock instead returns its seeded administrator directly from `/me`.

The provider clears the query cache when the user identity changes, including logout/session expiry. This prevents one account's cached data from appearing under another account. Refresh responses are checked against the identity that requested them so an older request cannot replace a newly logged-in user.

Ordinary API 401 responses dispatch `kp-session-expired`, which the provider handles. A 403 surfaces the permission error without signing the user out. Local login refreshes `/me` for authoritative permissions; OIDC logout can redirect to the provider's end-session URL.

Use the helpers in [`rbac.ts`](../../frontend/src/lib/rbac.ts) with `user?.permissions`. Gate navigation, direct page access, and actions as appropriate. Pass permission booleans into reusable presentation components. The backend remains responsible for enforcing permissions even when the UI hides or disables an action.

## Request boundary

Ordinary JSON requests belong in [`api.ts`](../../frontend/src/lib/api.ts). Its private `apiFetch<T>` wrapper:

- Prefixes paths with `NEXT_PUBLIC_API_URL`, or uses the current origin when unset.
- Sends credentials and JSON headers, preserving additional caller headers.
- Reads the `__kp_csrf` cookie and sends `X-CSRF-Token` for mutations.
- Combines the request timeout with a caller-provided abort signal.
- Applies the shared 401/403 behavior and converts error responses into exceptions.
- Handles `204 No Content` without attempting to parse a body.

Keep path encoding and query-string construction in the API function. For example, pod names and namespaces are encoded before being inserted into URLs. Add the TypeScript contract alongside the request function and keep it consistent with the backend schema.

Streaming requests need a separate lifecycle: pod logs return text, WebSockets carry individual log records, and the database reset operation yields progress events. Their helpers still handle credentials, CSRF where applicable, and errors, but should not inherit a short timeout intended for a JSON response.

## Queries and mutations

[`queryClient.ts`](../../frontend/src/lib/queryClient.ts) defines the shared defaults: a stale interval from `constants.ts`, one retry, and no automatic refetch on window focus. Queries override these when their data needs different freshness.

Use the builders in [`queryKeys.ts`](../../frontend/src/lib/queryKeys.ts), such as `queryKeys.policies()`, `queryKeys.policy(id)`, and `queryKeys.policyExecutionsTable(page, rowsPerPage, status, direction)`.

Include all request arguments that change the result in its key. Give lists, individual records, feeds, and paginated tables distinct identities. List and detail keys are not always prefixes of each other: invalidating `queryKeys.policies()` does not invalidate `queryKeys.policy(id)`.

This illustrative hook uses existing contracts and invalidates both views after a successful write:

```tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getPolicy, updatePolicy } from '@/lib/api'
import { queryKeys } from '@/lib/queryKeys'
import type { PolicyInput } from '@/lib/types'

export function usePolicyRecord(id: number) {
  const client = useQueryClient()
  const query = useQuery({
    queryKey: queryKeys.policy(id),
    queryFn: () => getPolicy(id),
    enabled: Number.isSafeInteger(id) && id > 0,
  })
  const update = useMutation({
    mutationFn: (changes: Partial<PolicyInput>) => updatePolicy(id, changes),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.policies() }),
        client.invalidateQueries({ queryKey: queryKeys.policy(id) }),
      ])
    },
  })
  return { query, update }
}
```

The caller must handle the query's pending/error states, prevent submitting an invalid ID, display mutation failures, and disable duplicate submissions while the mutation is pending. For a new resource, add its key builder rather than copying a string array into each consumer.

Sleep/wake changes also affect execution history. [`usePolicyTriggers`](../../frontend/src/lib/usePolicyTriggers.ts) invalidates the policy list, policy detail, and execution queries, then navigates to the execution in the policy detail page. It accepts an override for a caller that opens a local log viewer instead.

## Streaming data

The application uses several transports because their data and lifecycle requirements differ:

| View | Transport | State destination |
| :--- | :-------- | :---------------- |
| Cluster overview | SSE, with REST fallback | `queryKeys.overview()` cache entry |
| Running policy execution | WebSocket | `useExecutionLogs` buffer |
| Completed policy execution | REST | Log query keyed by execution ID |
| Following pod logs | Chunked HTTP text | `usePodLogStream` buffer |
| Previous container logs | HTTP text response | Pod-log hook state |
| Observability live values | SSE | Route-scoped contexts |
| Observability stored history | REST | Query keyed by selected range |

### Cluster status and polling

[`useClusterStream`](../../frontend/src/lib/useClusterStream.ts) reads `/api/cluster/stream` with credentialed `fetch`, parses SSE data lines, and writes overview objects directly into TanStack Query. An abort controller stops the request and reconnect wait when the consumer unmounts.

[`ClusterStatusCard`](../../frontend/src/components/overview/ClusterStatusCard.tsx) keeps a normal overview query for initial data and fallback. It explicitly sets:

```tsx
refetchInterval: streamDisconnected ? 30_000 : false
```

That setting disables interval polling while the stream is healthy. Cache freshness alone does not disable `refetchInterval`. Other pages still use their own polling intervals; their queries are not all fed by the overview stream. Use the owning query and [`constants.ts`](../../frontend/src/lib/constants.ts) as the source for current intervals.

On stream closure or failure, the hook marks the connection disconnected and retries with capped exponential backoff and jitter. Short unsuccessful connections retain the retry progression; a sufficiently long connection resets it. Keep the disconnect signal, retry timer, and request cleanup together when changing this behavior.

### Execution logs

[`useExecutionLogs`](../../frontend/src/components/history/useExecutionLogs.ts) opens the execution WebSocket while the execution is running. Completed executions load persisted lines through REST. Switching executions clears the live buffer and closes the old connection; unmounting cancels reconnect timers and pending animation-frame work.

Incoming records are deduplicated by per-execution `seq`, not the database `id`: live records may be published before a database ID exists. The hook batches arrival updates with `requestAnimationFrame` and sorts each batch by sequence. This accommodates overlapping persisted, replayed, and live records from the backend.

A normal WebSocket close (`1000`) marks a clean completion and suppresses reconnect handling. Abnormal closes retry while the execution remains running, with a retry limit; policy/size rejection closes are not retried. Connection status and execution status are distinct: a disconnected browser does not establish that the backend execution failed.

### Pod logs

[`usePodLogStream`](../../frontend/src/components/cluster/usePodLogStream.ts) receives the selected pod/container and owns follow/previous mode, tail size, and line buffers. Live text arrives through the `streamPodLogs` helper, which preserves partial lines across network chunks. Changing the pod, container, mode, or requested tail replaces the stream. Cleanup aborts the request and cancels queued frame updates.

Live lines are batched and capped to keep memory bounded. Loading more requests a larger tail and restarts the live stream; previous-container logs use a separate one-shot request. Keep these operations distinct from visual auto-scroll: stopping scroll follow should let the user inspect text while data continues arriving.

## Observability state

The Metrics Dashboard is alpha and API Rivers is cosmetic/mock. Their visualizations must not be documented as distributed tracing or a source of measured per-link traffic. See the [operator guide](../observability.md) for what the displayed data represents.

[`ObservabilityStreamProvider`](../../frontend/src/lib/ObservabilityStreamContext.tsx) calls `useObservabilityStream` once in the observability layout and exposes separate contexts for metrics/history, transient events, recent calls, and connection/runtime configuration. A consumer subscribes only to the slices it needs. The stream remains open across navigation within that layout and is cleaned up when the layout unmounts.

The hook keeps bounded live samples and call/event lists, fetches runtime configuration, and reconnects after stream failures with capped backoff. These live values are not stored in the general query cache.

[`MetricsDashboard`](../../frontend/src/components/observability/MetricsDashboard.tsx) separately queries stored history by time range. [`observabilityHistory.ts`](../../frontend/src/lib/observabilityHistory.ts) merges stored and live samples, removes duplicate timestamps, filters the selected time span, and emits timestamp/value chart series. Preserve actual timestamps rather than spacing points by array index: downsampling and gaps mean samples are not necessarily evenly spaced.

ECharts and GSAP are loaded lazily by their views. Dispose chart instances, resize observers, animation callbacks, and library contexts when their owners unmount. See [UI patterns](frontend-ui-patterns.md#logs-and-expensive-views) for rendering concerns and the [frontend checks](../frontend-dev-guide.md#validate-a-change) for the history regression command.
