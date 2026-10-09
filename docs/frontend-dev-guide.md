# Frontend Developer Guide

Start here to change the kube-phoenix UI. Read [Architecture](../ARCHITECTURE.md) for the system boundaries, then use this guide for setup, common changes, and checks. The deeper references cover [data flow](development/frontend-data-flow.md) and [UI patterns](development/frontend-ui-patterns.md).

[Run locally](#run-locally) · [Make a change](#make-a-change) · [Validate a change](#validate-a-change) · [Find the code](#find-the-code) · [Reference guides](#reference-guides)

<a id="1-overview"></a>

## Overview

The frontend lets operators inspect cluster state, manage sleep/wake policies and exceptions, follow execution logs, and administer the application. It uses React, the Next.js App Router, MUI with Emotion, TanStack Query, and TypeScript. See [package.json](../frontend/package.json) and the lockfile for dependency versions.

Production is a static export embedded in the Go binary. There is no request-time Next.js server, server-side API route, or Node.js runtime in the deployed application. Pages fetch data from the Go API in the browser.

## Run locally

Use the Node.js version and prerequisites in [CONTRIBUTING](../CONTRIBUTING.md#prerequisites). From the repository root, start the frontend with sample data:

```bash
make dev-mock
```

This starts the Next.js development server at `http://localhost:3000` and the mock API at `http://localhost:4444`. The mock returns a seeded administrator automatically. Its data is in memory and resets when the mock server restarts; it does not validate real authentication, Kubernetes behavior, or persistence.

For a real backend, follow the [Local Development Guide](local-development.md), set `NEXT_PUBLIC_API_URL=http://localhost:8080` in `frontend/.env.local`, and run `make dev-frontend`. The browser talks directly to the configured API origin, so the backend's CORS and local HTTP cookie settings matter. Restart the frontend after changing the public API URL. An unset URL uses the frontend's own origin, as in the deployed single-binary application.

<a id="11-adding-new-features-guide"></a>

## Make a change

### Add or change a page

1. Find the owning route in `frontend/src/app/` and its domain components in `frontend/src/components/`.
2. Keep the route focused on composing the page, its queries, and its dialogs. Put reusable interaction logic in a component or hook.
3. Use `PageHeader`, provide loading/error/empty states, and check permissions before exposing actions. See [UI patterns](development/frontend-ui-patterns.md#page-structure-and-feedback).
4. Add navigation in `components/layout/Sidebar.tsx` when the page should be discoverable from the sidebar. Match its permission gate in the page itself.
5. Check the page through direct navigation and a browser reload, including its query parameters.

<a id="static-export-no-ssr"></a>

With `output: 'export'` and `trailingSlash: true`, `app/policies/page.tsx` exports `/policies/index.html`. Arbitrary resource IDs use query parameters, such as `/policies/detail/?id=4`; dynamic path segments are supported when their values are enumerated at build time with `generateStaticParams()`. The observability component route is an example. See [routing and static export](development/frontend-data-flow.md#routing-and-static-export) before adding routes.

### Add API data or a mutation

1. Check the contract in [API documentation](api.md) and [openapi.yaml](../openapi.yaml).
2. Add or update the response/input types in `src/lib/types.ts` and the request function in `src/lib/api.ts`. Use its shared request wrapper for ordinary JSON requests.
3. Add a key builder in `src/lib/queryKeys.ts`. Include resource IDs, server-side filters, and pagination arguments that change the response.
4. Use `useQuery` for REST data and `useMutation` for writes. Invalidate the affected list and detail keys after a successful mutation; show failures to the user.
5. Update the relevant `mock-api/routes/` handler and sample data so the same interaction can be exercised locally.

The [data-flow reference](development/frontend-data-flow.md#queries-and-mutations) contains a typed example using the current query-key helpers. For sleep/wake actions, reuse `usePolicyTriggers` and `TriggerModeDialog` so plan/apply selection, invalidation, and execution navigation remain consistent.

### Change a form, schedule, or shared component

Keep draft fields local to the editor and save through the API layer. Reuse the existing policy and exception pickers for scheduling, `useSnackbar` for operation feedback, and the shared confirmation/import/export components where their behavior fits. For settings changes, start from the actual composition in `app/settings/page.tsx` rather than assuming every component in `components/settings/` is mounted there.

Schedule calculations belong in the shared time utilities. Add focused cases for overnight windows, overlapping intervals, timezones, and daylight-saving boundaries when changing that logic. See [schedules and timelines](development/frontend-ui-patterns.md#schedules-and-timelines).

![Policy editor with a weekday sleep window and all-day weekend window](images/screenshots/policy-editor.png)

*The actual application running with seeded mock data. The screenshot illustrates the editor, not live cluster configuration.*

## Validate a change

Run these from `frontend/` after installing dependencies with `npm ci`:

```bash
npm run typecheck
npm run lint
npm run build
```

The build checks static export as well as compilation and writes `frontend/out/`. Preserve the repository's `.npmrc` and install-time patches when changing dependencies. For the production path, use the Go-backed setup in the [Local Development Guide](local-development.md); the static export does not use `next start`. CI runs lint, typecheck, all three regression commands below, and the export build on pull requests and pushes to `master`.

Run the relevant regression checks when their area changes:

```bash
# Schedule calculations, including timezone and overlap behavior
npm run test:windows

# Stored/live metrics history merging and chart timestamps
node --test tests/observability-history.test.mjs

# Mock exception create/update/import contracts
node --test mock-api/tests/exceptions.test.mjs
```

These checks cover specific behaviors; they are not an end-to-end UI suite. For an interface change, exercise its main path and its loading, empty, and error states in the browser. Check keyboard activation, focus after closing a dialog, light/dark themes, and a narrow viewport where relevant. For streaming changes, switch resources and close the viewer while data is arriving. Use a real backend for changes to sessions, permissions, API contracts, or Kubernetes behavior; mock success alone does not establish those contracts.

For policy cards, include a disabled policy, a long name, reduced-motion settings, and narrow layouts. Check the savings explanation with hover, focus, tap, Escape, and click-away. For workload filters, open a `status` deep link, combine it with the other filters, then clear: the status parameter should disappear, every filter should reset, and Search should regain focus.

Changes to embedded assets or Docker builds also need the [final-image smoke check](local-development.md#final-image-smoke-check). It exercises the built Go server and a referenced Next.js script from the final container, which a successful standalone frontend build does not cover.

Follow the [contribution review checklist](../CONTRIBUTING.md#before-requesting-review). Keep unrelated formatting out of the change; the package's formatting scripts operate across the source tree.

<a id="2-project-structure"></a>

## Find the code

| Area | Start here | Responsibility |
| :--- | :--------- | :------------- |
| Routes and providers | [src/app](../frontend/src/app), [providers.tsx](../frontend/src/app/providers.tsx) | Page composition, route boundaries, shared providers |
| Navigation and shell | [components/layout](../frontend/src/components/layout) | Sidebar and responsive application frame |
| Operator workflows | [components](../frontend/src/components) | Domain folders for cluster, policies, exceptions, history, guardrails, audit, and settings |
| Shared UI | [components/shared](../frontend/src/components/shared), [components/common](../frontend/src/components/common) | Page chrome, feedback, confirmation and input primitives |
| Requests and state | [api.ts](../frontend/src/lib/api.ts), [queryKeys.ts](../frontend/src/lib/queryKeys.ts), [auth.tsx](../frontend/src/lib/auth.tsx) | API boundary, cache identity, session lifecycle |
| Presentation utilities | [src/lib](../frontend/src/lib), [theme.ts](../frontend/src/theme/theme.ts) | Time calculations, formatting, sorting, semantic colors and theme |
| Local sample API | [mock-api](../frontend/mock-api) | Development routes and seeded data |

Use PascalCase for component filenames, camelCase for utility modules, and a `use` prefix for hooks. Keep page files in the App Router's `page.tsx` convention.

## Reference guides

<a id="3-architecture-patterns"></a>
<a id="4-api-layer-deep-dive"></a>
<a id="7-state-management"></a>
<a id="9-real-time-data-flows"></a>
<a id="provider-stack"></a>
<a id="query-key-conventions"></a>
<a id="cache-invalidation-after-mutations"></a>

### Architecture, requests, and state

[Frontend data flow](development/frontend-data-flow.md) explains the provider boundaries, authentication and CSRF, query-key conventions, mutation invalidation, and the distinct cluster, execution-log, pod-log, and observability streams. It owns the transport and caching guidance; use [API documentation](api.md) for endpoint contracts.

<a id="5-component-architecture"></a>
<a id="6-shared-utilities-deep-dive"></a>
<a id="8-styling-patterns"></a>
<a id="shared-page-chrome"></a>
<a id="timeline-components"></a>

### Components, utilities, and styling

[Frontend UI patterns](development/frontend-ui-patterns.md) explains page composition, editors, cluster drill-down, schedules, virtualized logs, theme tokens, and keyboard interaction. It links representative implementations instead of duplicating every component's props or every utility function.

<a id="10-observability"></a>

### Observability

The Metrics Dashboard is an alpha feature and API Rivers is a cosmetic/mock visualization. See the [operator guide](observability.md) for interpretation and limits, and [observability state](development/frontend-data-flow.md#observability-state) for the frontend provider and history merge.
