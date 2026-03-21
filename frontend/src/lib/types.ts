export interface Schedule {
  id: number
  name: string
  type: 'scale_down' | 'scale_up'
  cronExpr: string
  timezone: string
  mode: 'plan' | 'apply'
  enabled: boolean
  namespaceFilter: string  // comma-separated; empty = all namespaces
  position: number         // display order within each type group
  updatedAt: string
  nextRun?: string  // ISO timestamp from cron engine; absent when schedule is disabled
}

export interface ScheduleInput {
  name: string
  type: 'scale_down' | 'scale_up'
  cronExpr: string
  timezone: string
  mode: 'plan' | 'apply'
  enabled: boolean
  namespaceFilter: string
}

export interface Guardrails {
  id: number
  systemNamespaces: string  // protected system defaults — requires confirmation to remove
  skipNamespaces: string
  skipNsNode: string
  skipNodeLabels: string
  skipNodeTaints: string
  updatedAt: string
}

export interface Execution {
  id: number
  scheduleId: number
  schedule: Schedule
  startedAt: string
  finishedAt: string | null
  status: 'running' | 'success' | 'failed'
  mode: 'plan' | 'apply'
  countScaled: number
  countDrained: number
  countDeleted: number
  countSkipped: number
  countErrors: number
}

export interface LogLine {
  id: number
  executionId: number
  seq: number
  level: 'info' | 'ok' | 'plan' | 'error' | 'warn'
  message: string
  timestamp: string
}

export interface Workload {
  namespace: string
  name: string
  kind: 'Deployment' | 'StatefulSet'
  currentReplicas: number
  savedReplicas: number | null
  readyReplicas: number
  status: 'running' | 'sleeping' | 'partial'
}

export interface Node {
  name: string
  instanceType: string
  zone: string
  podCount: number
  status: 'active' | 'protected' | 'would-drain'
  protectionReason: string | null
  cpuAllocatable: number
  cpuRequested: number
  memAllocatable: number
  memRequested: number
  createdAt: string
  cordoned: boolean
}

export interface NodePod {
  name: string
  namespace: string
  ownerKind: string
  ownerName: string
  status: string
  readyContainers: number
  totalContainers: number
  cpuRequest: number
  memRequest: number
  cpuUsage: number
  memUsage: number
  startedAt: string
}

export interface ExecutionPage {
  items: Execution[]
  total: number
}

export interface PodContainer {
  name: string
  image: string
  ready: boolean
  restartCount: number
  cpuRequest: number  // millicores
  memRequest: number  // bytes
  cpuLimit: number    // millicores, 0 = no limit set
  memLimit: number    // bytes, 0 = no limit set
  cpuUsage: number    // millicores, 0 = unavailable
  memUsage: number    // bytes, 0 = unavailable
  lastState: string   // terminated reason or ""
}

export interface PodCondition {
  type: string
  status: 'True' | 'False' | 'Unknown'
}

export interface PodEvent {
  type: string    // "Normal" | "Warning"
  reason: string
  message: string
  count: number
  lastSeen: string  // RFC3339
}

export interface Overview {
  clusterStatus: 'awake' | 'sleeping' | 'partial'
  runningCount: number
  sleepingCount: number
  nodeCount: number
  sleepingByNs: { namespace: string; count: number }[]
  nextRun?: { name: string; nextRun: string }
  cacheAgeMs: number
}

export interface PodDetail {
  name: string
  namespace: string
  phase: string
  nodeName: string
  nodeInstanceType: string
  podIP: string
  hostIP: string
  qosClass: string
  startedAt: string
  labels: Record<string, string>
  annotations: Record<string, string>
  containers: PodContainer[]
  conditions: PodCondition[]
  events: PodEvent[]
}

// ─── User management ─────────────────────────────────────────────────────────

export type Role = 'admin' | 'operator' | 'viewer'

export interface User {
  id: number
  username: string
  givenName?: string
  familyName?: string
  email?: string
  role: Role
  source: 'local' | 'oidc'
  enabled: boolean
  createdAt: string
  lastLoginAt?: string
  permissions: string[]
}

export interface AuditLogEntry {
  id: number
  userId?: number
  username: string
  action: string
  resourceType?: string
  resourceId?: number
  before?: string
  after?: string
  ipAddress?: string
  timestamp: string
}

export interface AuditLogPage {
  items: AuditLogEntry[]
  total: number
}
