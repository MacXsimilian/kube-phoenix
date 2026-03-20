import type { Schedule, ScheduleInput, Guardrails, Execution, LogLine, Workload, Node, NodePod, ExecutionPage, PodDetail, Overview, User, AuditLogPage } from './types'
import { getCSRFToken } from './auth'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

// Mutation methods that require a CSRF token.
const MUTATION_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH'])

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const method = options?.method?.toUpperCase() ?? 'GET'
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.headers as Record<string, string>,
  }

  // Attach CSRF token on mutation requests.
  if (MUTATION_METHODS.has(method)) {
    headers['X-CSRF-Token'] = getCSRFToken()
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  })

  // 401 → session expired or not authenticated.
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('kp-session-expired'))
    }
    throw new Error('Session expired')
  }

  // 403 → permission denied — surface the backend message clearly.
  if (res.status === 403) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error || 'You do not have permission to perform this action')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error || body?.message || `HTTP ${res.status}`)
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

export const reorderSchedules = (type: 'scale_down' | 'scale_up', ids: number[]): Promise<Schedule[]> =>
  req<Schedule[]>('/api/schedules/reorder', {
    method: 'PUT',
    body: JSON.stringify({ type, ids }),
  })

// ── Guardrails ────────────────────────────────────────────────────────────────

export const getGuardrails = (): Promise<Guardrails> =>
  req<Guardrails>('/api/guardrails')

export const updateGuardrails = (data: Partial<Guardrails>): Promise<Guardrails> =>
  req<Guardrails>('/api/guardrails', {
    method: 'PUT',
    body: JSON.stringify({
      system_namespaces: data.systemNamespaces,
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

// ── Overview ──────────────────────────────────────────────────────────────────

export const getOverview = (): Promise<Overview> =>
  req<Overview>('/api/overview')

// ── Cluster ───────────────────────────────────────────────────────────────────

export const getWorkloads = (): Promise<Workload[]> =>
  req<Workload[]>('/api/cluster/workloads')

export const getNodes = (): Promise<Node[]> =>
  req<Node[]>('/api/cluster/nodes')

export const getNodePods = (nodeName: string): Promise<NodePod[]> =>
  req<NodePod[]>(`/api/cluster/nodes/${encodeURIComponent(nodeName)}/pods`)

export const getPodDetail = (namespace: string, podName: string): Promise<PodDetail> =>
  req<PodDetail>(`/api/cluster/pods/${encodeURIComponent(namespace)}/${encodeURIComponent(podName)}`)

export const getWorkloadPods = (namespace: string, kind: string, name: string): Promise<NodePod[]> =>
  req<NodePod[]>(`/api/cluster/workloads/${encodeURIComponent(namespace)}/${encodeURIComponent(kind)}/${encodeURIComponent(name)}/pods`)

export async function getPodLogs(
  namespace: string,
  podName: string,
  container?: string,
  tailLines = 500,
  previous = false,
): Promise<string> {
  const q = new URLSearchParams({ tailLines: String(tailLines) })
  if (container) q.set('container', container)
  if (previous) q.set('previous', 'true')
  const res = await fetch(
    `${BASE}/api/cluster/pods/${encodeURIComponent(namespace)}/${encodeURIComponent(podName)}/logs?${q}`,
    { credentials: 'include' },
  )
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error || `HTTP ${res.status}`)
  }
  return res.text()
}

export function streamPodLogs(
  namespace: string,
  podName: string,
  container?: string,
  tailLines = 100,
  signal?: AbortSignal,
): {
  start: (onLine: (line: string) => void, onError: (err: Error) => void, onDone: () => void) => void
} {
  const q = new URLSearchParams({ tailLines: String(tailLines), follow: 'true' })
  if (container) q.set('container', container)
  const url = `${BASE}/api/cluster/pods/${encodeURIComponent(namespace)}/${encodeURIComponent(podName)}/logs?${q}`

  return {
    start(onLine, onError, onDone) {
      fetch(url, { credentials: 'include', signal })
        .then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => null)
            throw new Error(body?.error || `HTTP ${res.status}`)
          }
          const reader = res.body?.getReader()
          if (!reader) { onDone(); return }
          const decoder = new TextDecoder()
          let buf = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buf += decoder.decode(value, { stream: true })
            const parts = buf.split('\n')
            buf = parts.pop() ?? ''
            for (const line of parts) {
              if (line) onLine(line)
            }
          }
          if (buf) onLine(buf)
          onDone()
        })
        .catch((err) => {
          if (signal?.aborted) return
          onError(err instanceof Error ? err : new Error(String(err)))
        })
    },
  }
}

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

export type ResetEvent = { type: 'step' | 'done' | 'error'; message: string }

export async function* resetDatabaseStream(): AsyncGenerator<ResetEvent> {
  const res = await fetch(`${BASE}/api/admin/reset-db`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCSRFToken() },
    body: JSON.stringify({ confirm: 'RESET DATABASE' }),
  })

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    let errMsg: string | undefined
    try { errMsg = (JSON.parse(text) as { error?: string }).error } catch { /* not JSON */ }
    throw new Error(errMsg || text || `HTTP ${res.status}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (line.trim()) {
        try { yield JSON.parse(line) } catch { /* skip malformed lines */ }
      }
    }
  }
}

// ── Users ─────────────────────────────────────────────────────────────────────

export const getUsers = (): Promise<User[]> =>
  req<User[]>('/api/users')

export const createUserAPI = (data: { username: string; email?: string; password: string; role: string }): Promise<User> =>
  req<User>('/api/users', { method: 'POST', body: JSON.stringify(data) })

export const updateUserAPI = (id: number, data: Record<string, unknown>): Promise<User> =>
  req<User>(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteUserAPI = (id: number): Promise<void> =>
  req<void>(`/api/users/${id}`, { method: 'DELETE' })

export const changePasswordAPI = (currentPassword: string, newPassword: string): Promise<void> =>
  req<void>('/api/auth/password', {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, newPassword }),
  })

// ── OIDC ──────────────────────────────────────────────────────────────────────

export interface OIDCConfigResponse {
  enabled: boolean
  mounted: boolean
  issuerURL?: string
  clientID?: string
  redirectURL?: string
  groupsClaim?: string
  roleAdminGroups?: string[]
  roleOperatorGroups?: string[]
}

export const getOIDCConfig = (): Promise<OIDCConfigResponse> =>
  req<OIDCConfigResponse>('/api/auth/oidc/config')

// ── Audit logs ────────────────────────────────────────────────────────────────

export const getAuditLogs = (params?: {
  user?: string
  action?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}): Promise<AuditLogPage> => {
  const q = new URLSearchParams()
  if (params?.user) q.set('user', params.user)
  if (params?.action) q.set('action', params.action)
  if (params?.from) q.set('from', params.from)
  if (params?.to) q.set('to', params.to)
  if (params?.page !== undefined) q.set('page', String(params.page))
  if (params?.pageSize) q.set('pageSize', String(params.pageSize))
  return req<AuditLogPage>(`/api/audit-logs?${q}`)
}

// ── WebSocket URL helper ──────────────────────────────────────────────────────

export const wsLogsUrl = (executionId: number): string => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
  const base = apiUrl
    ? apiUrl.replace(/^http/, 'ws')
    : `${typeof window !== 'undefined' ? window.location.origin.replace(/^http/, 'ws') : ''}`

  // Cookies are sent automatically on same-origin WebSocket upgrades — no token param needed.
  return `${base}/ws/executions/${executionId}/logs`
}
