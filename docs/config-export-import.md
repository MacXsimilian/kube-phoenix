# Config Export / Import

Copy one guardrail configuration, policy, or scheduled exception between environments using the application's export and import dialogs. Preview shows what will change before you apply it. The destination database owns the resulting configuration.

For first-time policy setup, start with [your first policy](first-policy.md). For exact request schemas, use [OpenAPI](../openapi.yaml).

## Scope

Three resources can be exported and imported:

- **Guardrails** — one singleton record per environment.
- **Policy** — one policy per export.
- **Scheduled Exception** — one exception per export.

The feature is intentionally narrow:

- No bundle export. Each resource is its own JSON envelope.
- No CLI, no token, no GitOps bootstrap.
- No drift detection — the source of truth is the database in each env.

## Flow

```
[Source env]                        [Target env]
  Export ──► JSON ──► copy/paste ──► Import preview ──► Apply
```

1. In the source environment, click **Export** next to the resource. Choose
   "Copy JSON to clipboard" or "Download .json".
2. In the target environment, click **Import** on the same surface. Paste the
   JSON into the textarea, or drag a `.json` file onto it, then click
   **Preview**.
3. Resolve any conflict that the preview surfaces, then click **Apply**.

Imported policies always start disabled in plan mode. Review the [safety rules](#safety-rules) before switching to live execution or enabling scheduling.

## JSON envelopes

Every payload contains `schemaVersion`, `kind`, and a body named for that kind. This valid policy example can be pasted into a policy import preview:

```json
{
  "schemaVersion": 1,
  "kind": "policy",
  "policy": {
    "name": "Backend weeknights",
    "description": "Sleep a development namespace overnight",
    "namespaceFilter": "team-backend",
    "labelSelector": "",
    "timezone": "UTC",
    "mode": "plan",
    "enabled": false,
    "timeoutMinutes": 20,
    "sleepWindows": [
      {
        "name": "Weeknights",
        "daysOfWeek": [1, 2, 3, 4, 5],
        "startTime": "20:00",
        "endTime": "07:00",
        "allDay": false
      }
    ]
  }
}
```

The backend rejects mismatched `schemaVersion` or a `kind` that does not
match the endpoint.

| Kind | Body key | OpenAPI schema |
| :--- | :------- | :------------- |
| `guardrails` | `guardrails` | `GuardrailsExport` |
| `policy` | `policy` | `PolicyExport` |
| `exception` | `exception` | `ExceptionExport` |

Find these schemas in [OpenAPI](../openapi.yaml). Use a fresh export as the starting point for guardrails and exceptions so all current settings are preserved. Exception start/end timestamps must still be valid in the destination; update expired dates before previewing.

### What is stripped on export

| Resource | Stripped fields |
| :-- | :-- |
| Guardrails | `id`, `updatedAt` |
| Policy | `id`, `currentState`, `stateSince`, `lastSleepAt`, `lastWakeAt`, `nextTransitionAt`, `createdAt`, `updatedAt` |
| Exception | `id`, `status`, `startExecutionId`, `endExecutionId`, `cancelledAt`, `cancelReason`, `createdBy`, `createdAt`, `updatedAt` |

Exception exports replace the `policyId` foreign key with `policyName`
so the target environment can resolve the reference locally.
Historical parentless records export `policyName: null`, but cannot be
imported without supplying an existing parent policy name.

## Conflict resolution

Policy conflicts are matched **by name**.

| Resource | Resolutions |
| :-- | :-- |
| Guardrails (singleton) | Overwrite (only option) |
| Policy | Overwrite · Rename (new name) |
| Exception | Always create (no name to match on), rejected with 409 when the window overlaps an existing opposite-type exception on the same parent policy |

If an exception import names a parent policy that does not exist in the
target environment, the backend returns:

> "Parent policy '<name>' not found in target environment. Import the
> policy first, then retry."

## Safety rules

- Imported policies are forced to `enabled: false` and `mode: "plan"`
  regardless of the source JSON. Review targeting and guardrails, run a manual plan, then explicitly choose apply mode and enable scheduling when ready. Manual triggers work while disabled.
- Policy `mode` is validated on import — only `"plan"` and `"apply"`
  are accepted; any other value is rejected with 400 before the forced
  coercion runs.
- Exception imports run the same overlap check as the manual create
  endpoint — a window that collides with an existing opposite-type
  exception on the same policy is rejected with 409 in both preview
  and apply.
- Exception imports require a non-blank `policyName`. Missing, null, or
  blank names are rejected with 400 in both preview and apply because
  parentless exceptions cannot run.
- Every apply produces an audit entry: `guardrail.import`,
  `policy.import`, or `exception.import`. Every export does too:
  `guardrail.export`, `policy.export`, or `exception.export`. Export
  entries carry the user, IP, and a small `after` payload identifying
  what was pulled (policy name, exception ticket ref + parent policy
  name) so admins can trace who exported what.
- The guardrails apply path reloads the scheduler if the timing or
  evaluator fields changed.

## Permissions

The feature reuses the existing permissions — no new role.

| Action | Permission |
| :-- | :-- |
| Export any supported resource | Authenticated session (viewer, operator, or admin) |
| Preview or apply guardrails import | `guardrail.edit` (operator or admin) |
| Preview or apply policy import | `schedule.edit` (operator or admin) |
| Preview or apply exception import | `schedule.edit` (operator or admin) |

Both import preview and apply use POST and require a CSRF token. See [API authentication](api.md#authentication).

## API endpoints

| Method · Path | Purpose |
| :-- | :-- |
| `GET /api/guardrails/export` | Export guardrails |
| `GET /api/policies/{id}/export` | Export a policy |
| `GET /api/exceptions/{id}/export` | Export an exception |
| `POST /api/guardrails/import/preview` | Preview a guardrails import |
| `POST /api/guardrails/import/apply` | Apply a guardrails import |
| `POST /api/policies/import/preview` | Preview a policy import |
| `POST /api/policies/import/apply` | Apply a policy import |
| `POST /api/exceptions/import/preview` | Preview an exception import |
| `POST /api/exceptions/import/apply` | Apply an exception import |
