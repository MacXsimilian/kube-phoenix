# Policy smoke test

Use this checklist after installing or upgrading a test instance. [Your first policy](../first-policy.md) contains the exact setup, node-protection, plan/apply, restoration, and cleanup steps. The [policy scenario catalogue](../test-plan-policy.md) covers broader scheduling, exception, recovery, and node-operation cases.

This is a reusable checklist of expected outcomes, not a record of a completed run. Screenshots elsewhere in the guides contain illustrative mock data. Mark a check as passed only after observing it on the real cluster; record unexecuted checks as **Not run**.

## Preconditions

- A running application and database on a disposable cluster; the browser and kubectl target that same cluster.
- The baseline `team-backend` fixtures: seven Deployments and nine desired replicas, all ready.
- Every node carries the tutorial protection label, and the matching **Skip Node Labels** entry has been saved and verified.
- No other policies, exceptions, HPA, or GitOps reconciliation will change the target replicas during the run.
- The tutorial policy remains **Enabled off** so the checks use explicit manual triggers.

Namespace scope does not limit node operations. Do not proceed to Apply if the plan proposes draining or deleting any node.

## Checks

| Check | Expected result | Result / evidence |
| :---- | :-------------- | :---------------- |
| Open the application and sign in | Login succeeds; policy and cluster pages load | Not run |
| Capture baseline | Saved deployment replica counts and node list match the intended test cluster | Not run |
| Save the tutorial policy | Namespace `team-backend`, mode Plan, Enabled off, valid day/time window | Not run |
| Preview Sleep Now with Plan | Seven workload targets; every node protected; no proposed node drain/deletion | Not run |
| Compare after Plan | Desired replicas and node list unchanged | Not run |
| Save Apply mode, keep Enabled off | Settings persist; namespace scope unchanged | Not run |
| Sleep Now with Apply | Execution succeeds; seven desired replica counts become zero; drain/delete counts remain zero | Not run |
| Wake Now with Apply | Execution succeeds; desired replicas match the saved baseline | Not run |
| Wait for recovery | All nine expected replicas ready; original nodes remain ready and schedulability unchanged | Not run |
| Clean up | Policy disabled or removed after restoration; node-protection disposition recorded | Not run |

## Record a run

Copy this block into your test notes or issue. Keep expected scenarios separate from observed results.

```text
Date / tester:
Application version or commit:
Cluster context / Kubernetes version / node count:
Container runtime / deployment method:
Policy ID:
Plan execution ID:
Sleep execution ID:
Wake execution ID:
Baseline and restored replica comparison:
Node protection / drain count / delete count:
Failed or skipped checks, with reasons:
Cleanup and remaining protection:
Evidence links or log excerpts:
```

Passing this smoke test verifies only the recorded manual flow in that environment. It does not establish coverage for scheduled transitions, OIDC, multi-node draining, failure recovery, or the complete scenario catalogue.
