# kube-phoenix Documentation

## Getting Started

| Document | Description |
| :------- | :---------- |
| [Deployment Guide](deployment.md) | Install kube-phoenix with Helm, configure for production, and upgrade |
| [Configuration Reference](configuration.md) | Environment variables, authentication, RBAC, policies, and guardrails |

## Operations

| Document | Description |
| :------- | :---------- |
| [Troubleshooting](troubleshooting.md) | Diagnose common issues organized by symptom |

## Reference

| Document | Description |
| :------- | :---------- |
| [API Reference](api.md) | REST, SSE, and WebSocket endpoints with authentication details |
| [OpenAPI Spec](../openapi.yaml) | Machine-readable OpenAPI 3.1 definition (also served at `/api/docs/openapi.yaml`) |
| [Helm Values](../helm/kube-phoenix/values.yaml) | Full Helm values file with inline comments |

## Development

| Document | Description |
| :------- | :---------- |
| [Architecture](../ARCHITECTURE.md) | System design, data flows, and internals |
| [Backend Developer Guide](backend-dev-guide.md) | Deep-dive into Go packages, data model, execution engine, and cluster pipeline |
| [Frontend Developer Guide](frontend-dev-guide.md) | Deep-dive into React components, API layer, state management, and real-time flows |
| [Contributing](../CONTRIBUTING.md) | Development setup, branching strategy, and PR checklist |
| [Changelog](../CHANGELOG.md) | Release history |
