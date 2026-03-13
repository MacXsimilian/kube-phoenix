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

export interface ExecutionPage {
  items: Execution[]
  total: number
}
