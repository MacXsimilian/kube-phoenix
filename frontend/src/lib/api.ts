import type { Schedule, ScheduleInput, Guardrails, Execution, LogLine, Workload, Node, NodePod, ExecutionPage } from './types'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? res.statusText)
  }
  // 204 No Content
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ── Schedules ─────────────────────────────────────────────────────────────────

export const getSchedules = (): Promise<Schedule[]> =>
  req<Schedule[]>('/api/schedules')

export const createSchedule = (data: ScheduleInput): Promise<Schedule> =>
  req<Schedule>('/api/schedules', {
    method: 'POST',
    body: JSON.stringify({
      name: data.name,
      type: data.type,
      cron_expr: data.cronExpr,
      timezone: data.timezone,
      mode: data.mode,
      enabled: data.enabled,
      namespace_filter: data.namespaceFilter,
    }),
  })

export const updateSchedule = (id: number, data: Partial<ScheduleInput>): Promise<Schedule> => {
  const payload: Record<string, unknown> = {}
  if (data.name !== undefined)            payload.name = data.name
  if (data.cronExpr !== undefined)        payload.cron_expr = data.cronExpr
  if (data.timezone !== undefined)        payload.timezone = data.timezone
  if (data.mode !== undefined)            payload.mode = data.mode
  if (data.enabled !== undefined)         payload.enabled = data.enabled
  if (data.namespaceFilter !== undefined) payload.namespace_filter = data.namespaceFilter
  return req<Schedule>(`/api/schedules/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export const deleteSchedule = (id: number): Promise<void> =>
  req<void>(`/api/schedules/${id}`, { method: 'DELETE' })

// ── Guardrails ────────────────────────────────────────────────────────────────

export const getGuardrails = (): Promise<Guardrails> =>
  req<Guardrails>('/api/guardrails')

export const updateGuardrails = (data: Partial<Guardrails>): Promise<Guardrails> =>
  req<Guardrails>('/api/guardrails', {
    method: 'PUT',
    body: JSON.stringify({
      skip_namespaces: data.skipNamespaces,
      skip_ns_node: data.skipNsNode,
      skip_node_labels: data.skipNodeLabels,
      skip_node_taints: data.skipNodeTaints,
    }),
  })

// ── Executions ────────────────────────────────────────────────────────────────

export const getExecutions = (params?: {
  scheduleId?: number
  status?: string
  page?: number
  pageSize?: number
}): Promise<ExecutionPage> => {
  const q = new URLSearchParams()
  if (params?.scheduleId) q.set('schedule_id', String(params.scheduleId))
  if (params?.status) q.set('status', params.status)
  if (params?.page !== undefined) q.set('page', String(params.page))
  if (params?.pageSize) q.set('page_size', String(params.pageSize))
  return req<ExecutionPage>(`/api/executions?${q}`)
}

export const getExecution = (id: number): Promise<Execution> =>
  req<Execution>(`/api/executions/${id}`)

export const getExecutionLogs = (id: number): Promise<LogLine[]> =>
  req<LogLine[]>(`/api/executions/${id}/logs`)

// ── Cluster ───────────────────────────────────────────────────────────────────

export const getWorkloads = (): Promise<Workload[]> =>
  req<Workload[]>('/api/cluster/workloads')

export const getNodes = (): Promise<Node[]> =>
  req<Node[]>('/api/cluster/nodes')

export const getNodePods = (nodeName: string): Promise<NodePod[]> =>
  req<NodePod[]>(`/api/cluster/nodes/${encodeURIComponent(nodeName)}/pods`)

// ── Trigger ───────────────────────────────────────────────────────────────────

export const triggerRun = (
  scheduleId: number,
  mode: 'plan' | 'apply'
): Promise<{ executionId: number }> =>
  req<{ executionId: number }>('/api/trigger', {
    method: 'POST',
    body: JSON.stringify({ scheduleId, mode }),
  })

// ── Admin ─────────────────────────────────────────────────────────────────────

export const resetDatabase = (): Promise<{ status: string; message: string }> =>
  req<{ status: string; message: string }>('/api/admin/reset-db', {
    method: 'POST',
    body: JSON.stringify({ confirm: 'RESET DATABASE' }),
  })

// ── WebSocket URL helper ──────────────────────────────────────────────────────

export const wsLogsUrl = (executionId: number): string => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
  const base = apiUrl
    ? apiUrl.replace(/^http/, 'ws')
    : `${typeof window !== 'undefined' ? window.location.origin.replace(/^http/, 'ws') : ''}`
  return `${base}/ws/executions/${executionId}/logs`
}
