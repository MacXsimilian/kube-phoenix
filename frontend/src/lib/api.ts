import type {
  Guardrails,
  Execution,
  LogLine,
  Workload,
  Node,
  NodePod,
  ExecutionPage,
  SleepPolicy,
  PolicyWindow,
  PolicyGuardrails,
  PolicyOverride,
  PolicyInput,
  PolicyWindowInput,
  PolicyGuardrailsInput,
  NotificationList,
  Notification,
} from './types'

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
  policyId?: number
  status?: string
  executionType?: string
  page?: number
  pageSize?: number
}): Promise<ExecutionPage> => {
  const q = new URLSearchParams()
  if (params?.policyId) q.set('policy_id', String(params.policyId))
  if (params?.status) q.set('status', params.status)
  if (params?.executionType) q.set('execution_type', params.executionType)
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

// ── Policies ──────────────────────────────────────────────────────────────────

export const policiesApi = {
  list: (): Promise<{ policies: SleepPolicy[] }> =>
    req<{ policies: SleepPolicy[] }>('/api/policies'),

  create: (data: PolicyInput): Promise<SleepPolicy> =>
    req<SleepPolicy>('/api/policies', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  get: (id: number): Promise<SleepPolicy> =>
    req<SleepPolicy>(`/api/policies/${id}`),

  update: (id: number, data: Partial<PolicyInput>): Promise<SleepPolicy> =>
    req<SleepPolicy>(`/api/policies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: number): Promise<void> =>
    req<void>(`/api/policies/${id}`, { method: 'DELETE' }),

  createWindow: (id: number, data: PolicyWindowInput): Promise<PolicyWindow> =>
    req<PolicyWindow>(`/api/policies/${id}/windows`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateWindow: (id: number, wid: number, data: Partial<PolicyWindowInput>): Promise<PolicyWindow> =>
    req<PolicyWindow>(`/api/policies/${id}/windows/${wid}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteWindow: (id: number, wid: number): Promise<void> =>
    req<void>(`/api/policies/${id}/windows/${wid}`, { method: 'DELETE' }),

  getGuardrails: (id: number): Promise<PolicyGuardrails> =>
    req<PolicyGuardrails>(`/api/policies/${id}/guardrails`),

  updateGuardrails: (id: number, data: PolicyGuardrailsInput): Promise<PolicyGuardrails> =>
    req<PolicyGuardrails>(`/api/policies/${id}/guardrails`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  createOverride: (id: number, data: { occurrenceDate: string; edge: 'sleep' | 'wake' | 'both' }): Promise<PolicyOverride> =>
    req<PolicyOverride>(`/api/policies/${id}/overrides`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteOverride: (id: number, date: string, edge: string): Promise<void> =>
    req<void>(`/api/policies/${id}/overrides/${date}/${edge}`, { method: 'DELETE' }),

  triggerSleep: (id: number, mode: 'plan' | 'apply'): Promise<{ executionId: number }> =>
    req<{ executionId: number }>(`/api/policies/${id}/trigger`, {
      method: 'POST',
      body: JSON.stringify({ edge: 'sleep', mode }),
    }),

  triggerWake: (id: number, mode: 'plan' | 'apply'): Promise<{ executionId: number }> =>
    req<{ executionId: number }>(`/api/policies/${id}/trigger`, {
      method: 'POST',
      body: JSON.stringify({ edge: 'wake', mode }),
    }),
}

// ── Notifications ─────────────────────────────────────────────────────────────

export const notificationsApi = {
  list: (): Promise<NotificationList> =>
    req<NotificationList>('/api/notifications'),

  markRead: (id: number): Promise<Notification> =>
    req<Notification>(`/api/notifications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ read: true }),
    }),

  dismiss: (id: number): Promise<Notification> =>
    req<Notification>(`/api/notifications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ dismissed: true }),
    }),

  dismissAll: (): Promise<void> =>
    req<void>('/api/notifications', { method: 'DELETE' }),
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export const adminApi = {
  resetDB: (): Promise<void> =>
    req<void>('/api/admin/reset-db', { method: 'POST' }),

  getVersion: (): Promise<{ version: string }> =>
    req<{ version: string }>('/api/version'),
}

// ── WebSocket URL helper ──────────────────────────────────────────────────────

export const wsLogsUrl = (executionId: number): string => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
  const base = apiUrl
    ? apiUrl.replace(/^http/, 'ws')
    : `${typeof window !== 'undefined' ? window.location.origin.replace(/^http/, 'ws') : ''}`
  return `${base}/ws/executions/${executionId}/logs`
}
