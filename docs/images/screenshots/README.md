# Application screenshots

These images show the actual application rendered with the bundled [mock API fixtures](../../../frontend/mock-api). All displayed cluster resources, users, executions, and monitoring values are example data. They illustrate the interface; they do not record a Kubernetes test run.

Captures use the dark theme at 1600 × 1000 pixels. Fonts and populated content were checked before capture. The development overlay was hidden; the images were not retouched. [manifest.json](manifest.json) records source commit, routes, capture times, dimensions, and SHA-256 hashes.

These captures predate the policy-card and workload-filter updates on the reliability branch. Current cards have a clearer disabled state, responsive sizing, and an interactive savings explanation; the workload table also has **Clear filters**. Follow the written guides for current behavior. The existing images and manifest retain their original capture provenance.

| View | Image | Illustrates |
| :--- | :---- | :------ |
| Overview | [overview.png](overview.png) | Cluster status and recent activity |
| Policies | [policies.png](policies.png) | Schedules and state cards |
| Policy editor | [policy-editor.png](policy-editor.png) | Targeting and sleep windows |
| Workloads | [workloads.png](workloads.png) | Cluster inventory |
| Guardrails | [guardrails.png](guardrails.png) | Workload and node protection settings |
| Execution logs | [execution-logs.png](execution-logs.png) | Execution summary and log viewer |
| Metrics dashboard | [metrics-dashboard.png](metrics-dashboard.png) | Alpha monitoring interface |
| API Rivers | [api-rivers.png](api-rivers.png) | Cosmetic scenario animation |

The execution-log fixture reports five scaled workloads in its header and six in its seeded summary. The image preserves those fixture values. Use Kubernetes measurements and execution records for actual scaling results.

The metrics dashboard is alpha. API Rivers uses illustrative scenarios and cosmetic animation; it is not a request trace.

To refresh screenshots, start [mock development mode](../../local-development.md), navigate to the relevant screen, and capture it after content and fonts load. Keep names stable, add a mock-data caption beside each embedded image, update the manifest, and stop the mock processes after capture.
