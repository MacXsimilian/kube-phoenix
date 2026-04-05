export interface MetricSnapshot {
  id: number
  timestamp: string
  httpRequestRate: number
  httpLatencyP50Ms: number
  httpLatencyP95Ms: number
  httpLatencyP99Ms: number
  httpErrorRate: number
  k8sGetRate: number
  k8sPatchRate: number
  k8sDeleteRate: number
  k8sLatencyP50Ms: number
  k8sLatencyP99Ms: number
  policySuccessCount: number
  policyFailedCount: number
  policySkippedCount: number
  wsActiveConnections: number
  cacheHitRate: number
  schedulerEvalRate: number
  schedulerEvalDurationMs: number
  workloadsScaledCount: number
  scaleOperationDurationMs: number
  schedulerPanics: number
  auditDrops: number
  rateLimitHits: number
  totalErrorRate: number
  dbPoolOpen: number
  dbPoolInUse: number
  dbPoolIdle: number
  activeSessions: number
  activePolicies: number
  k8sErrorRate: number
}

export interface RiverComponentMetrics {
  component: string
  rpsIn: number
  rpsOut: number
  latencyMs: number
  errorRate: number
  status: 'ok' | 'warn' | 'crit'
}

export interface RiverLinkMetrics {
  source: string
  target: string
  rps: number
  latencyMs: number
  errorRate: number
  category: 'http' | 'k8s' | 'store' | 'internal' | 'ws'
}

export interface ObservabilityThreshold {
  id: number
  panelKey: string
  warnVal: number
  critVal: number
}

export interface ApiCall {
  id: string
  timestamp: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'WS' | 'SSE'
  path: string
  statusCode: number
  durationMs: number
  component: string
  goFunc: string
  category: 'http' | 'k8s' | 'store' | 'internal' | 'ws'
}

export interface RuntimeLimit {
  label: string
  value: string
}

export interface RuntimeConfig {
  components: Record<string, RuntimeLimit[]>
}

export interface ObservabilityStreamPayload {
  snapshot: MetricSnapshot
  components: RiverComponentMetrics[]
  links: RiverLinkMetrics[]
  thresholds: ObservabilityThreshold[]
  recentCalls: ApiCall[]
}

export interface IncidentEvent {
  id: string
  severity: 'warning' | 'critical'
  message: string
  timestamp: string
  panelKey: string
}

export type ThresholdStatus = 'ok' | 'warn' | 'crit'

export type TimeRange = '1m' | '5m' | '15m' | '1h' | '6h' | '1d' | '3d'

export const TIME_RANGE_OPTIONS: { label: string; value: TimeRange }[] = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1h', value: '1h' },
  { label: '6h', value: '6h' },
  { label: '1d', value: '1d' },
  { label: '3d', value: '3d' },
]

export const RIVER_COMPONENTS = [
  'router', 'auth', 'handlers', 'scheduler',
  'scaler', 'k8s-client', 'store', 'ws-broker',
] as const

export type RiverComponentId = (typeof RIVER_COMPONENTS)[number]
