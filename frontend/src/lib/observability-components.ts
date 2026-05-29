// Single source of truth for observability component metadata.

import type { MetricSnapshot } from '@/lib/observability-types'

export interface ComponentInfo {
  id: string
  label: string
  description: string
  goFile: string
  metrics: { label: string; unit: string; getValue: (s: MetricSnapshot) => number }[]
  relatedLinks: { direction: 'in' | 'out'; target: string; category: string }[]
}

export const COMPONENT_INFO: Record<string, ComponentInfo> = {
  router: {
    id: 'router',
    label: 'Chi Router',
    description: 'HTTP routing, request ID generation, logging middleware. Entry point for all API traffic.',
    goFile: 'internal/api/router.go',
    metrics: [
      { label: 'Request Rate', unit: 'req/s', getValue: (s) => s.httpRequestRate },
      { label: 'P50 Latency', unit: 'ms', getValue: (s) => s.httpLatencyP50Ms },
      { label: 'P99 Latency', unit: 'ms', getValue: (s) => s.httpLatencyP99Ms },
      { label: 'Error Rate', unit: '/s', getValue: (s) => s.httpErrorRate },
    ],
    relatedLinks: [
      { direction: 'out', target: 'auth', category: 'http' },
    ],
  },
  auth: {
    id: 'auth',
    label: 'Auth Middleware',
    description: 'Session validation, CSRF protection, RBAC enforcement. Rejects unauthenticated requests.',
    goFile: 'internal/middleware/session.go',
    metrics: [
      { label: 'Throughput', unit: 'req/s', getValue: (s) => s.httpRequestRate },
      { label: 'Active Sessions', unit: '', getValue: (s) => s.activeSessions },
      { label: 'Rate Limit Hits', unit: '', getValue: (s) => s.rateLimitHits },
    ],
    relatedLinks: [
      { direction: 'in', target: 'router', category: 'http' },
      { direction: 'out', target: 'handlers', category: 'http' },
    ],
  },
  handlers: {
    id: 'handlers',
    label: 'API Handlers',
    description: 'REST endpoint logic for policies, cluster state, users, guardrails, and audit logs.',
    goFile: 'internal/api/',
    metrics: [
      { label: 'Request Rate', unit: 'req/s', getValue: (s) => s.httpRequestRate },
      { label: 'Latency', unit: 'ms', getValue: (s) => s.httpLatencyP50Ms },
      { label: 'Error Rate', unit: '/s', getValue: (s) => s.httpErrorRate },
      { label: 'Audit Drops', unit: '', getValue: (s) => s.auditDrops },
    ],
    relatedLinks: [
      { direction: 'in', target: 'auth', category: 'http' },
      { direction: 'out', target: 'scheduler', category: 'internal' },
      { direction: 'out', target: 'store', category: 'store' },
      { direction: 'out', target: 'ws-broker', category: 'ws' },
    ],
  },
  scheduler: {
    id: 'scheduler',
    label: 'Policy Scheduler',
    description: 'Evaluation loop running on a configurable tick interval. Evaluates policies, triggers sleep/wake.',
    goFile: 'internal/scheduler/scheduler.go',
    metrics: [
      { label: 'Eval Rate', unit: '/min', getValue: (s) => s.schedulerEvalRate },
      { label: 'Eval Duration', unit: 'ms', getValue: (s) => s.schedulerEvalDurationMs },
      { label: 'Panics', unit: '', getValue: (s) => s.schedulerPanics },
    ],
    relatedLinks: [
      { direction: 'in', target: 'handlers', category: 'internal' },
      { direction: 'out', target: 'scaler', category: 'internal' },
      { direction: 'out', target: 'ws-broker', category: 'ws' },
    ],
  },
  scaler: {
    id: 'scaler',
    label: 'Scaler',
    description: 'Performs the actual workload scaling — sets replica counts on Deployments and StatefulSets.',
    goFile: 'internal/scaler/',
    metrics: [
      { label: 'Workloads Scaled', unit: '', getValue: (s) => s.workloadsScaledCount },
      { label: 'Scale Duration', unit: 'ms', getValue: (s) => s.scaleOperationDurationMs },
    ],
    relatedLinks: [
      { direction: 'in', target: 'scheduler', category: 'internal' },
      { direction: 'out', target: 'k8s-client', category: 'k8s' },
    ],
  },
  'k8s-client': {
    id: 'k8s-client',
    label: 'K8s Client',
    description: 'client-go wrapper for Kubernetes API calls. Handles GET/PATCH/DELETE on Deployments, StatefulSets, Nodes.',
    goFile: 'internal/k8s/client.go',
    metrics: [
      { label: 'GET Rate', unit: '/min', getValue: (s) => s.k8sGetRate },
      { label: 'PATCH Rate', unit: '/min', getValue: (s) => s.k8sPatchRate },
      { label: 'DELETE Rate', unit: '/min', getValue: (s) => s.k8sDeleteRate },
      { label: 'P50 Latency', unit: 'ms', getValue: (s) => s.k8sLatencyP50Ms },
      { label: 'Error Rate', unit: '/min', getValue: (s) => s.k8sErrorRate },
    ],
    relatedLinks: [
      { direction: 'in', target: 'scaler', category: 'k8s' },
      { direction: 'out', target: 'store', category: 'store' },
    ],
  },
  store: {
    id: 'store',
    label: 'Store (GORM)',
    description: 'PostgreSQL persistence layer. Connection pool of 10. Handles policies, executions, audit logs, snapshots.',
    goFile: 'internal/store/store.go',
    metrics: [
      { label: 'Pool In Use', unit: '', getValue: (s) => s.dbPoolInUse },
      { label: 'Pool Open', unit: '', getValue: (s) => s.dbPoolOpen },
      { label: 'Audit Drops', unit: '', getValue: (s) => s.auditDrops },
      { label: 'Cache Hit Rate', unit: '%', getValue: (s) => s.cacheHitRate },
    ],
    relatedLinks: [
      { direction: 'in', target: 'handlers', category: 'store' },
      { direction: 'in', target: 'k8s-client', category: 'store' },
    ],
  },
  'ws-broker': {
    id: 'ws-broker',
    label: 'WS Broker',
    description: 'Pub/sub event broker for WebSocket connections. Streams execution logs to connected clients.',
    goFile: 'internal/api/ws.go',
    metrics: [
      { label: 'Active Connections', unit: '', getValue: (s) => s.wsActiveConnections },
    ],
    relatedLinks: [
      { direction: 'in', target: 'scheduler', category: 'ws' },
      { direction: 'in', target: 'handlers', category: 'ws' },
      { direction: 'out', target: 'handlers', category: 'ws' },
    ],
  },
  http_rate: {
    id: 'router',
    label: 'HTTP Request Rate',
    description: 'Aggregate HTTP request throughput across all endpoints.',
    goFile: 'internal/api/router.go',
    metrics: [
      { label: 'Request Rate', unit: 'req/s', getValue: (s) => s.httpRequestRate },
      { label: 'Error Rate', unit: '/s', getValue: (s) => s.httpErrorRate },
    ],
    relatedLinks: [],
  },
  latency_p99: {
    id: 'handlers',
    label: 'HTTP Latency',
    description: 'Request latency at P50, P95, and P99 percentiles.',
    goFile: 'internal/api/',
    metrics: [
      { label: 'P50', unit: 'ms', getValue: (s) => s.httpLatencyP50Ms },
      { label: 'P95', unit: 'ms', getValue: (s) => s.httpLatencyP95Ms },
      { label: 'P99', unit: 'ms', getValue: (s) => s.httpLatencyP99Ms },
    ],
    relatedLinks: [],
  },
  policy_executions: {
    id: 'scheduler',
    label: 'Policy Executions',
    description: 'Policy execution outcomes — success, failed, interrupted.',
    goFile: 'internal/scheduler/',
    metrics: [
      { label: 'Success', unit: '', getValue: (s) => s.policySuccessCount },
      { label: 'Failed', unit: '', getValue: (s) => s.policyFailedCount },
      { label: 'Interrupted', unit: '', getValue: (s) => s.policyInterruptedCount },
    ],
    relatedLinks: [],
  },
  k8s_api: {
    id: 'k8s-client',
    label: 'K8s API Calls',
    description: 'Kubernetes API call rates by verb.',
    goFile: 'internal/k8s/client.go',
    metrics: [
      { label: 'GET', unit: '/min', getValue: (s) => s.k8sGetRate },
      { label: 'PATCH', unit: '/min', getValue: (s) => s.k8sPatchRate },
      { label: 'DELETE', unit: '/min', getValue: (s) => s.k8sDeleteRate },
    ],
    relatedLinks: [],
  },
  ws_connections: {
    id: 'ws-broker',
    label: 'WebSocket Connections',
    description: 'Active WebSocket connections for log streaming.',
    goFile: 'internal/api/ws.go',
    metrics: [
      { label: 'Active', unit: '', getValue: (s) => s.wsActiveConnections },
    ],
    relatedLinks: [],
  },
  cache_hit: {
    id: 'store',
    label: 'Cache Hit Rate',
    description: 'Cluster cache effectiveness. Lower rates mean more rebuilds.',
    goFile: 'internal/k8s/cache.go',
    metrics: [
      { label: 'Hit Rate', unit: '%', getValue: (s) => s.cacheHitRate },
    ],
    relatedLinks: [],
  },
  scheduler_health: {
    id: 'scheduler',
    label: 'Scheduler Health',
    description: 'Scheduler evaluation rate and duration.',
    goFile: 'internal/scheduler/',
    metrics: [
      { label: 'Eval Rate', unit: '/min', getValue: (s) => s.schedulerEvalRate },
      { label: 'Eval Duration', unit: 'ms', getValue: (s) => s.schedulerEvalDurationMs },
      { label: 'Panics', unit: '', getValue: (s) => s.schedulerPanics },
    ],
    relatedLinks: [],
  },
  error_rate: {
    id: 'router',
    label: 'Error Rate',
    description: 'Combined error rate across HTTP 5xx, scheduler panics, and audit drops.',
    goFile: '',
    metrics: [
      { label: 'Total Errors', unit: '/s', getValue: (s) => s.totalErrorRate },
      { label: 'HTTP Errors', unit: '/s', getValue: (s) => s.httpErrorRate },
      { label: 'Panics', unit: '', getValue: (s) => s.schedulerPanics },
      { label: 'Audit Drops', unit: '', getValue: (s) => s.auditDrops },
    ],
    relatedLinks: [],
  },
}
