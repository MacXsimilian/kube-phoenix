# Config Export / Import

When kube-phoenix is deployed across many similar clusters, operators
need a fast way to keep guardrails, policies, and scheduled exceptions
in sync across environments. The export/import feature is built for
exactly that, paste-in-UI flow.

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

## JSON envelopes

Every payload uses the same outer shape:

```json
{
  "schemaVersion": 1,
  "kind": "guardrails" | "policy" | "exception",
  "guardrails": { ... } | "policy": { ... } | "exception": { ... }
}
```

The backend rejects mismatched `schemaVersion` or a `kind` that does not
match the endpoint.

### What is stripped on export

| Resource | Stripped fields |
| :-- | :-- |
| Guardrails | `id`, `updatedAt` |
| Policy | `id`, `currentState`, `stateSince`, `lastSleepAt`, `lastWakeAt`, `nextTransitionAt`, `createdAt`, `updatedAt` |
| Exception | `id`, `status`, `startExecutionId`, `endExecutionId`, `cancelledAt`, `cancelReason`, `createdBy`, `createdAt`, `updatedAt` |

Exception exports replace the `policyId` foreign key with `policyName`
so the target environment can resolve the reference locally.

## Conflict resolution

Conflicts are matched **by name**.

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
  regardless of the source JSON. The operator must explicitly enable
  the policy after reviewing it.
- Policy `mode` is validated on import — only `"plan"` and `"apply"`
  are accepted; any other value is rejected with 400 before the forced
  coercion runs.
- Exception imports run the same overlap check as the manual create
  endpoint — a window that collides with an existing opposite-type
  exception on the same policy is rejected with 409 in both preview
  and apply.
- Every apply produces an audit entry: `guardrail.import`,
  `policy.import`, or `exception.import`.
- The guardrails apply path reloads the scheduler if the timing or
  evaluator fields changed.

## Permissions

The feature reuses the existing permissions — no new role.

| Action | Permission |
| :-- | :-- |
| Export and import guardrails | `guardrail.edit` |
| Export and import policies | `schedule.edit` |
| Export and import exceptions | `schedule.edit` |

Read operations (export) require an authenticated session; write
operations (apply) require the listed permission.

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
