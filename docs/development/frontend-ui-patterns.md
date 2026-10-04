# Frontend UI Patterns

Use these patterns when extending the operator interface. The [Frontend Developer Guide](../frontend-dev-guide.md) covers setup and checks; [Frontend Data Flow](frontend-data-flow.md) owns authentication, API, caching, and stream lifecycle guidance.

[Page structure](#page-structure-and-feedback) · [Forms](#forms-and-mutations) · [Cluster drill-down](#cluster-drill-down) · [Schedules](#schedules-and-timelines) · [Logs](#logs-and-expensive-views) · [Styling](#styling-and-responsive-layout) · [Keyboard interaction](#keyboard-interaction-and-focus)

## Page structure and feedback

Route components compose a domain view, its data hooks, and its dialogs. Shared presentation belongs in `components/shared/` or `components/common/`; domain-specific interactions stay with their domain. Start from a representative implementation rather than duplicating an entire page.

| Workflow | Representative implementation | Pattern to reuse |
| :------- | :---------------------------- | :--------------- |
| Overview | [ClusterStatusCard](../../frontend/src/components/overview/ClusterStatusCard.tsx) | Live state with a REST fallback and explicit trigger actions |
| Cluster | [WorkloadsTable](../../frontend/src/components/cluster/WorkloadsTable.tsx), [NodesTable](../../frontend/src/components/cluster/NodesTable.tsx) | Filters, sortable rows and resource drill-down |
| Policies | [Policies page](../../frontend/src/app/policies/page.tsx), [policy detail](../../frontend/src/app/policies/detail/page.tsx) | List editor, schedule preview, exceptions and execution history |
| Exceptions | [Exceptions page](../../frontend/src/app/exceptions/page.tsx) | Time-oriented display with expandable details and scoped actions |
| History | [ExecutionTable](../../frontend/src/components/history/ExecutionTable.tsx) | Server pagination/filtering and execution log selection |
| Audit | [Audit page](../../frontend/src/app/audit/page.tsx) | Searchable records with explicit before/after differences |
| Guardrails and settings | [GuardrailsForm](../../frontend/src/components/guardrails/GuardrailsForm.tsx), [Settings page](../../frontend/src/app/settings/page.tsx) | Grouped forms and permission-sensitive administration |

Use [`PageHeader`](../../frontend/src/components/shared/PageHeader.tsx) for the title, optional subtitle/breadcrumbs, actions, metadata, and tabs. Use [`EmptyState`](../../frontend/src/components/shared/EmptyState.tsx) when a successful request returns no relevant records. A failed request needs an error state rather than an empty-state explanation.

Loading indicators should belong to the part still loading so other usable content can remain visible. Show mutation failures beside the operation or through [`useSnackbar`](../../frontend/src/lib/useSnackbar.tsx). The application shell and route error boundaries catch render failures; they do not replace API error handling in a form.

Page-header and empty-state examples also exist under `app/prototypes/`. Treat these as presentation references; application workflows and data contracts live in their domain routes.

## Forms and mutations

[`CreatePolicyDialog`](../../frontend/src/components/policies/CreatePolicyDialog.tsx) illustrates the form lifecycle:

1. Initialize draft fields when opening, from the selected record or the creation defaults.
2. Keep edits local until the user submits. Reset validation feedback when reopening.
3. Validate user input before constructing the API payload.
4. Disable repeat submission while the mutation is pending.
5. On success, invalidate the relevant list/detail data, give feedback, and close the editor. On failure, preserve the draft and show the error.

New policies start in plan mode in the editor. Do not infer whether a sleep/wake operation should apply changes from its button label alone: [`TriggerModeDialog`](../../frontend/src/components/common/TriggerModeDialog.tsx) makes the execution mode explicit, and `usePolicyTriggers` handles the resulting execution navigation.

Use [`ConfirmDialog`](../../frontend/src/components/common/ConfirmDialog.tsx) for operations needing a confirmation step. Database reset has its own deliberate confirmation flow in [`DatabaseSettings`](../../frontend/src/components/settings/DatabaseSettings.tsx); preserve that behavior when changing its presentation.

For forms using [`useUnsavedChanges`](../../frontend/src/lib/useUnsavedChanges.tsx), mark the draft dirty and clear that state after saving or discarding. Its provider handles browser unload and intercepted internal link clicks. Programmatic routing and dialog dismissal still need explicit consideration; do not assume the provider intercepts every navigation mechanism.

The shared [`ImportDialog`](../../frontend/src/components/import/ImportDialog.tsx) separates input, server preview, and apply. [`ExportMenu`](../../frontend/src/components/import/ExportMenu.tsx) supplies copy/download actions. Reuse this flow for policies, exceptions, and guardrails, and keep preview/conflict handling aligned with the [configuration import/export contract](../config-export-import.md). A preview is not a completed import.

## Cluster drill-down

Cluster views share this interaction:

```text
Workload or node table
  → resource detail drawer
    → pod list
      → pod detail
        → container logs
```

[`DetailDrawer`](../../frontend/src/components/cluster/DetailDrawer.tsx) owns the common drawer frame, resize behavior, pod selection, search, and back navigation. Workload and node drawers supply their resource-specific headers and queries. Reuse that boundary when extending either view so a pod drill-down behaves consistently from both entry points.

[`useDrawerResize`](../../frontend/src/lib/useDrawerResize.ts) centralizes mouse/touch resizing and bounds. Keep desktop resizing separate from the narrow-screen full-width layout. When closing or switching the selected resource, reset the associated selection and let its query/stream owner release stale work.

Tables use shared sorting and presentation helpers in [`useTriStateSort`](../../frontend/src/lib/useTriStateSort.ts), [`SortHeader`](../../frontend/src/lib/SortHeader.tsx), and [`tableStyles`](../../frontend/src/lib/tableStyles.ts). Preserve the distinction between client-side sorting of a loaded collection and server-side filtering/pagination of execution or audit records.

## Schedules and timelines

The schedule editor, list card, detail timeline, and exception picker show related concepts at different scales. Keep their time calculations shared:

- [`windowUtils.ts`](../../frontend/src/lib/windowUtils.ts) formats windows, calculates the union of recurring sleep intervals, and converts timestamps into calendar blocks in a selected timezone.
- [`timelineSegments.ts`](../../frontend/src/components/policies/timelineSegments.ts) and [`timelineUtils.ts`](../../frontend/src/lib/timelineUtils.ts) provide common timeline geometry.
- [`WindowPicker`](../../frontend/src/components/policies/WindowPicker.tsx) edits recurring windows; [`ExceptionWindowPicker`](../../frontend/src/components/policies/ExceptionWindowPicker.tsx) edits a bounded date/time range.

Preserve these distinctions:

| Concept | Meaning |
| :------ | :------ |
| Recurring sleep window | Weekdays and wall-clock times evaluated in the policy timezone |
| Overnight window | Begins on the selected day and continues into the following morning |
| All-day window | Covers the selected calendar day without a separate wake time |
| Scheduled exception | Absolute start/end timestamps overlaid on the recurring schedule |
| Weekly savings display | Proportion of a recurring week scheduled asleep, not a measured cloud bill reduction |

Overlapping windows count once when calculating sleep hours and percentages. Those statistics describe a nominal recurring week; do not turn them into elapsed-hour or monetary estimates for a particular daylight-saving transition week.

Timezone conversion must preserve calendar fields independently of the browser's timezone. The utilities encode converted civil dates and read them through UTC getters so the browser does not normalize them using its own daylight-saving rules. Reuse these functions instead of round-tripping localized date strings through `new Date(...)`.

Timelines are a preview of policy intent. The backend evaluates the actual schedule and executes transitions. Validate new rendering/math behavior against the existing window regression cases, especially week boundaries, overlaps, overnight intervals, and daylight-saving transitions.

## Logs and expensive views

`LogViewer` presents execution status, a parsed summary, and ordered log lines. `PodLogViewer` presents container output with search, tail selection, previous logs, and follow controls. Their hooks own transport state; the components own rendering, selection, search, and scroll behavior.

Both viewers use TanStack Virtual to render visible rows. Keep the scroll container attached to the virtualizer, measure wrapped rows where needed, and scroll to a virtual index when navigating to a search result. An off-screen row may not have a DOM element to query.

Auto-scroll should follow the newest lines while the user remains at the bottom and stop when the user scrolls upward. Continuing to receive data must not force the viewport away from text the user is reading. Preserve resize and search behavior when changing line wrapping or font metrics.

[`parseSummary.ts`](../../frontend/src/components/history/parseSummary.ts) derives a display summary from execution messages. Treat that summary as a presentation aid; the structured execution response remains the source for execution status and counts. If backend log wording changes, review the parser and the resulting summary together.

For observability charts and animations, preserve lazy loading and lifecycle cleanup. Large arrays should not be copied or parsed on every render when their inputs have not changed. The [data-flow reference](frontend-data-flow.md#observability-state) explains the split stream contexts and timestamp-based history merge.

## Styling and responsive layout

Use MUI's `sx` prop and theme tokens for ordinary styling. [`theme.ts`](../../frontend/src/theme/theme.ts) defines the theme; [`useColors`](../../frontend/src/lib/colors.ts) provides semantic colors, and [`statusColors.ts`](../../frontend/src/lib/statusColors.ts) maps domain states to mode-aware styles. Keep static SVG timeline colors in the shared timeline palette.

For example, this component follows the application's spacing and color tokens:

```tsx
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

export function DetailSection({ title }: { title: string }) {
  return (
    <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: 'background.paper' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
    </Box>
  )
}
```

Use existing [`layoutConstants`](../../frontend/src/lib/layoutConstants.ts) for sections that extend into the shell's page padding. Prefer semantic states to scattered literal colors, and check both light and dark modes. Use text or icons alongside color when conveying status.

MUI spacing values use the theme spacing scale; responsive values use its breakpoints. A two-column desktop view can use `Grid size={{ xs: 12, md: 6 }}`, and a drawer can use `width: { xs: '100vw', md: drawerWidth }`. Check long names, empty collections, and large values as well as the populated mock screenshot.

Animations use shared tokens in [`lib/motion`](../../frontend/src/lib/motion) and the owning component's lifecycle. Preserve stable keys for enter/exit transitions and avoid remounting an expensive view merely to update its labels.

## Keyboard interaction and focus

Use buttons or links for interactive controls, including table-row actions. Existing workload/node/pod and execution tables expose named button targets; keep icon-only buttons labeled. A pointer-click handler on a plain cell is not a replacement for keyboard activation.

Preserve MUI dialog/drawer focus handling. Opening a detail view, moving back from pod detail, and closing a modal should leave focus in a useful place. Check Escape, Tab, Enter, and Space for the interactions affected by a change.

The exception calendar uses labeled date buttons with selected/current-date semantics and labeled time controls. Preserve those semantics when changing its layout. Search and filter fields need accessible labels, and failed operations must remain understandable without relying on color alone.

Use the [frontend validation checklist](../frontend-dev-guide.md#validate-a-change) to choose focused browser and regression checks for the behavior you changed.
