export interface Guardrails {
  id: number
  systemNamespaces: string
  skipNsNode: string
  skipNodeLabels: string
  skipNodeTaints: string
  scalingPriorityNamespaces: string
  schedulerEvalInterval: string
  schedulerAutoWake: boolean
  schedulerReconcileWhileAwake: boolean
  updatedAt: string
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

export interface NodeTaint {
  key: string
  value: string
  effect: string
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
  labels: Record<string, string>
  taints: NodeTaint[]
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

// ─── Policy model ─────────────────────────────────────────────────────────────

export interface SleepWindow {
  name?: string        // optional display name (e.g. "EU Maintenance")
  daysOfWeek: number[] // 0=Sun, 1=Mon, ..., 6=Sat
  startTime: string    // "HH:MM" 24h
  endTime: string      // "HH:MM" 24h
  allDay: boolean      // entire calendar day is sleeping
}

export interface Policy {
  id: number
  name: string
  description: string
  namespaceFilter: string
  labelSelector: string
  sleepWindows: SleepWindow[] | null
  timezone: string
  mode: 'plan' | 'apply'
  enabled: boolean
  timeoutMinutes: number
  currentState: 'sleeping' | 'awake' | 'unknown' | 'transitioning'
  stateSince: string | null
  lastSleepAt: string | null
  lastWakeAt: string | null
  createdAt: string
  updatedAt: string
  nextTransitionAt?: string | null
}

export interface PolicyInput {
  name: string
  description?: string
  namespaceFilter?: string
  labelSelector?: string
  sleepWindows: SleepWindow[]
  timezone?: string
  mode?: 'plan' | 'apply'
  enabled?: boolean
  timeoutMinutes?: number
}

export interface PolicyExecution {
  id: number
  policyId: number
  policy?: { name: string }
  direction: 'sleep' | 'wake'
  trigger: string
  startedAt: string
  finishedAt: string | null
  status: 'running' | 'success' | 'failed' | 'interrupted' | 'skipped'
  mode: 'plan' | 'apply'
  countScaled: number
  countSkipped: number
  countErrors: number
  countProtected: number
  countDrained: number
  countDeleted: number
}

export interface PolicyExecutionPage {
  items: PolicyExecution[]
  total: number
}

export interface LogLine {
  id: number
  executionId: number
  seq: number
  level: 'info' | 'ok' | 'plan' | 'error' | 'warn'
  message: string
  timestamp: string
}

export interface WorkloadSnapshot {
  id: number
  policyId: number
  sleepExecutionId: number
  wakeExecutionId: number | null
  namespace: string
  kind: string
  name: string
  replicasBefore: number
  replicasRestored: number | null
  restoredAt: string | null
  wasAlreadyZero: boolean
  wasDeletedAtWake: boolean
  wasExternallyScaled: boolean
  capturedAt: string
}

export interface PolicyOverride {
  id: number
  policyId: number
  overrideType: 'stay_awake' | 'force_sleep' | 'skip_sleep' | 'skip_wake'
  startsAt: string | null
  endsAt: string | null
  targetCronTime: string | null
  reason: string
  createdBy: string
  createdAt: string
}

export interface WorkloadTarget {
  kind: string
  namespace: string
  name: string
}

export interface ScheduledException {
  id: number
  policyId: number | null
  exceptionType: 'stay_awake' | 'force_sleep'
  startsAt: string
  endsAt: string
  ticketRef: string
  reason: string
  sleepOnEnd: boolean
  namespaceFilter: string
  labelSelector: string
  status: 'pending' | 'active' | 'completed' | 'cancelled'
  startExecutionId: number | null
  endExecutionId: number | null
  cancelledAt: string | null
  cancelReason: string
  createdBy: string
  createdAt: string
  updatedAt: string
  workloadTargets: WorkloadTarget[]
}

export interface ScheduledExceptionInput {
  policyId?: number | null
  exceptionType: 'stay_awake' | 'force_sleep'
  startsAt: string
  endsAt: string
  ticketRef?: string
  reason?: string
  sleepOnEnd?: boolean
  namespaceFilter?: string
  labelSelector?: string
  workloadTargets?: WorkloadTarget[]
}

// ─── Shared UI types ─────────────────────────────────────────────────────────

export interface SnackMessage {
  msg: string
  severity: 'success' | 'error'
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
