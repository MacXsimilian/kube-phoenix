import type { Guardrails, Workload, Node, NodePod, PodDetail, Overview, User, AuditLogPage, Policy, PolicyInput, PolicyExecution, PolicyExecutionPage, LogLine, WorkloadSnapshot, PolicyOverride, ScheduledException, ScheduledExceptionInput } from './types'
import { getCSRFToken } from './auth'
import { REQUEST_TIMEOUT_MS } from './constants'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

// Mutation methods that require a CSRF token.
const MUTATION_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH'])

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const method = options?.method?.toUpperCase() ?? 'GET'
  const incoming = options?.headers
  const hdrs: Record<string, string> = incoming instanceof Headers
    ? Object.fromEntries(incoming.entries())
    : Array.isArray(incoming)
      ? Object.fromEntries(incoming as [string, string][])
      : (incoming as Record<string, string> | undefined) ?? {}
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...hdrs,
  }

  // Attach CSRF token on mutation requests.
  if (MUTATION_METHODS.has(method)) {
    headers['X-CSRF-Token'] = getCSRFToken()
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers,
    signal: options?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
  // 204 No Content — safe cast: callers use T=void for endpoints that return no body
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
      systemNamespaces: data.systemNamespaces,
      skipNsNode: data.skipNsNode,
      skipNodeLabels: data.skipNodeLabels,
      skipNodeTaints: data.skipNodeTaints,
      scalingPriorityNamespaces: data.scalingPriorityNamespaces,
      schedulerEvalInterval: data.schedulerEvalInterval,
      schedulerAutoWake: data.schedulerAutoWake,
      schedulerReconcileWhileAwake: data.schedulerReconcileWhileAwake,
    }),
  })

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

// ── Admin ─────────────────────────────────────────────────────────────────────

export type ResetEvent = { type: 'step' | 'done' | 'error'; message: string }

export async function* resetDatabaseStream(): AsyncGenerator<ResetEvent> {
  const res = await fetch(`${BASE}/api/danger/reset-db`, {
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
        try { yield JSON.parse(line) } catch { if (process.env.NODE_ENV === 'development') console.warn('[kp] skipping malformed JSON line:', line) }
      }
    }
  }
}

// ── Users ─────────────────────────────────────────────────────────────────────

export const getUsers = (): Promise<User[]> =>
  req<User[]>('/api/users')

export const createUserAPI = (data: { username: string; email?: string; password: string; role: string }): Promise<User> =>
  req<User>('/api/users', { method: 'POST', body: JSON.stringify(data) })

export const updateUserAPI = (id: number, data: Partial<Pick<User, 'role' | 'enabled'>>): Promise<User> =>
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

// ── Policies ──────────────────────────────────────────────────────────────────

export const getPolicies = (): Promise<Policy[]> =>
  req<Policy[]>('/api/policies')

export const getPolicy = (id: number): Promise<Policy> =>
  req<Policy>(`/api/policies/${id}`)

export const createPolicy = (data: PolicyInput): Promise<Policy> =>
  req<Policy>('/api/policies', { method: 'POST', body: JSON.stringify(data) })

export const updatePolicy = (id: number, data: Partial<PolicyInput>): Promise<Policy> =>
  req<Policy>(`/api/policies/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deletePolicy = (id: number): Promise<void> =>
  req<void>(`/api/policies/${id}`, { method: 'DELETE' })

export const triggerPolicySleep = (id: number): Promise<{ executionId: number }> =>
  req<{ executionId: number }>(`/api/policies/${id}/sleep`, { method: 'POST' })

export const triggerPolicyWake = (id: number): Promise<{ executionId: number }> =>
  req<{ executionId: number }>(`/api/policies/${id}/wake`, { method: 'POST' })

// ── Policy executions ─────────────────────────────────────────────────────────

export const getPolicyExecutions = (params?: {
  policyId?: number
  status?: string
  direction?: string
  page?: number
  pageSize?: number
}): Promise<PolicyExecutionPage> => {
  const q = new URLSearchParams()
  if (params?.policyId) q.set('policy_id', String(params.policyId))
  if (params?.status) q.set('status', params.status)
  if (params?.direction) q.set('direction', params.direction)
  if (params?.page !== undefined) q.set('page', String(params.page))
  if (params?.pageSize) q.set('page_size', String(params.pageSize))
  return req<PolicyExecutionPage>(`/api/policy-executions?${q}`)
}

export const getPolicyExecution = (id: number): Promise<PolicyExecution> =>
  req<PolicyExecution>(`/api/policy-executions/${id}`)

export const getPolicyExecutionLogs = (id: number): Promise<LogLine[]> =>
  req<LogLine[]>(`/api/policy-executions/${id}/logs`)

export const getPolicyExecutionSnapshots = (id: number): Promise<WorkloadSnapshot[]> =>
  req<WorkloadSnapshot[]>(`/api/policy-executions/${id}/snapshots`)

export const getPolicySnapshots = (policyId: number, open?: boolean): Promise<WorkloadSnapshot[]> => {
  const q = open ? '?open=true' : ''
  return req<WorkloadSnapshot[]>(`/api/policies/${policyId}/snapshots${q}`)
}

// ── Policy overrides ──────────────────────────────────────────────────────────

export const getPolicyOverrides = (policyId: number): Promise<PolicyOverride[]> =>
  req<PolicyOverride[]>(`/api/policies/${policyId}/overrides`)

export const createPolicyOverride = (
  policyId: number,
  data: Omit<PolicyOverride, 'id' | 'policyId' | 'createdBy' | 'createdAt'>
): Promise<PolicyOverride> =>
  req<PolicyOverride>(`/api/policies/${policyId}/overrides`, {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const deletePolicyOverride = (policyId: number, overrideId: number): Promise<void> =>
  req<void>(`/api/policies/${policyId}/overrides/${overrideId}`, { method: 'DELETE' })

// ── Scheduled exceptions ──────────────────────────────────────────────────────

export const getExceptions = (params?: {
  policyId?: number
  status?: string
}): Promise<ScheduledException[]> => {
  const q = new URLSearchParams()
  if (params?.policyId) q.set('policy_id', String(params.policyId))
  if (params?.status) q.set('status', params.status)
  return req<ScheduledException[]>(`/api/exceptions?${q}`)
}

export const getException = (id: number): Promise<ScheduledException> =>
  req<ScheduledException>(`/api/exceptions/${id}`)

export const createException = (data: ScheduledExceptionInput): Promise<ScheduledException> =>
  req<ScheduledException>('/api/exceptions', { method: 'POST', body: JSON.stringify(data) })

export const updateException = (id: number, data: Partial<ScheduledExceptionInput>): Promise<ScheduledException> =>
  req<ScheduledException>(`/api/exceptions/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteException = (id: number): Promise<void> =>
  req<void>(`/api/exceptions/${id}`, { method: 'DELETE' })

// ── WebSocket URL helper ──────────────────────────────────────────────────────

export const wsPolicyLogsUrl = (executionId: number): string => {
  const base = BASE
    ? BASE.replace(/^http/, 'ws')
    : `${typeof window !== 'undefined' ? window.location.origin.replace(/^http/, 'ws') : ''}`
  return `${base}/ws/policy-executions/${executionId}/logs`
}
