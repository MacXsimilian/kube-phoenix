export interface Schedule {
  id: number
  name: string
  type: 'scale_down' | 'scale_up'
  cronExpr: string
  timezone: string
  mode: 'plan' | 'apply'
  enabled: boolean
  namespaceFilter: string  // comma-separated; empty = all namespaces
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
  skipNamespaces: string
  skipNsNode: string
  skipNodeLabels: string
  skipNodeTaints: string
  updatedAt: string
}

export interface Execution {
  id: number
  scheduleId?: number | null
  policyId?: number | null
  schedule?: Schedule | null
  policy?: SleepPolicy | null
  action?: 'scale_down' | 'scale_up' | null  // sleep or wake edge
  startedAt: string
  finishedAt: string | null
  status: 'running' | 'success' | 'failed' | 'skipped'
  mode: 'plan' | 'apply'
  executionType?: 'scheduled' | 'manual' | 'drift_correction' | 'skipped'
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
  status: 'running' | 'sleeping' | 'partial' | 'unmanaged'
  governedBy: string | null
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
  startedAt: string
}

export interface ExecutionPage {
  items: Execution[]
  total: number
}

// ── Policies ──────────────────────────────────────────────────────────────────

export interface SleepPolicy {
  id: number
  name: string
  description?: string
  tags: string  // comma-separated
  timezone: string
  mode: 'plan' | 'apply'
  namespaceFilter: string
  enabled: boolean
  driftCorrectionMode: 'record' | 'silent'
  timeoutMinutes: number
  windows: PolicyWindow[]
  guardrails?: PolicyGuardrails
  overrides?: PolicyOverride[]
  conflictTags: string[]  // ["CONFLICT", "ABSORBED", "NO-OP"]
  nextSleep?: string | null  // ISO timestamp
  nextWake?: string | null   // ISO timestamp
  lastExecution?: { status: string; finishedAt: string } | null
  createdAt: string
  updatedAt: string
}

export interface PolicyWindow {
  id: number
  policyId: number
  daysOfWeek: string  // JSON array string: '["mon","tue","wed","thu","fri"]'
  sleepAt: string     // "19:00"
  wakeAt?: string | null  // "06:00" — null = sleep-only
  advancedRules?: {
    dateRanges?: { from: string; to: string }[]
    exceptions?: string[]
  } | null
}

export interface PolicyGuardrails {
  id: number
  policyId: number
  skipWorkloads: string
  skipNamespaces: string
  skipNsNode: string
  skipNodeLabels: string
  skipNodeTaints: string
  minReplicas: number
}

export interface PolicyOverride {
  id: number
  policyId: number
  occurrenceDate: string  // YYYY-MM-DD
  edge: 'sleep' | 'wake' | 'both'
  action: 'skip'
  createdAt: string
}

export interface Notification {
  id: number
  policyId?: number | null
  executionId?: number | null
  type: 'conflict' | 'no_op' | 'absorbed' | 'execution_failed' | 'drift_corrected' | 'guardrail_shadow'
  severity: 'error' | 'warning' | 'info'
  message: string
  detail?: Record<string, unknown>
  read: boolean
  createdAt: string
  dismissedAt?: string | null
}

export interface NotificationList {
  notifications: Notification[]
  unreadCount: number
}

export interface PolicyInput {
  name: string
  description?: string
  tags: string
  timezone: string
  mode: 'plan' | 'apply'
  namespaceFilter: string
  enabled: boolean
  driftCorrectionMode: 'record' | 'silent'
  timeoutMinutes: number
  windows: PolicyWindowInput[]
  guardrails?: PolicyGuardrailsInput
}

export interface PolicyWindowInput {
  daysOfWeek: string
  sleepAt: string
  wakeAt?: string | null
  advancedRules?: {
    dateRanges?: { from: string; to: string }[]
    exceptions?: string[]
  } | null
}

export interface PolicyGuardrailsInput {
  skipWorkloads: string
  skipNamespaces: string
  skipNsNode: string
  skipNodeLabels: string
  skipNodeTaints: string
  minReplicas: number
}
