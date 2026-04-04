/**
 * Shared mock data generators for all flagship prototypes.
 * Provides realistic cluster topology, execution logs, cost data, and node/pod state.
 */

// ── Color Constants ─────────────────────────────────────────────────────────

export const FLAGSHIP_COLORS = {
  healthy: '#22C55E',
  pending: '#F59E0B',
  failed: '#EF4444',
  sleeping: '#475569',
  sleepingGlow: '#7C3AED',
  phoenixOrange: '#F97316',
  emberGold: '#FBBF24',
  wakingAmber: '#F59E0B',
  info: '#94A3B8',
  cyan: '#22D3EE',
  background: '#0F0F13',
  cardBg: '#1A1A24',
} as const

// ── Types ───────────────────────────────────────────────────────────────────

export type PodStatus = 'Running' | 'Pending' | 'Failed' | 'Succeeded' | 'Terminating' | 'Sleeping'
export type NodeStatus = 'Ready' | 'Cordoned' | 'Draining' | 'Deleted'
export type ExecutionDirection = 'sleep' | 'wake'
export type LogLevel = 'info' | 'ok' | 'plan' | 'error' | 'warn'

export interface MockPod {
  name: string
  namespace: string
  workload: string
  workloadKind: 'Deployment' | 'StatefulSet'
  status: PodStatus
  cpu: number
  memory: number
  restarts: number
  containers: number
  nodeName: string
}

export interface MockNode {
  name: string
  status: NodeStatus
  cpuCapacity: number
  cpuUsed: number
  memoryCapacity: number
  memoryUsed: number
  podCount: number
  pods: MockPod[]
  labels: Record<string, string>
  taints: string[]
  age: string
}

export interface MockWorkload {
  name: string
  namespace: string
  kind: 'Deployment' | 'StatefulSet'
  replicas: number
  replicasBefore: number
  status: PodStatus
}

export interface MockLogLine {
  id: string
  seq: number
  level: LogLevel
  message: string
  timestamp: string
  workloadName?: string
  nodeName?: string
}

export interface MockExecution {
  id: string
  policyId: string
  policyName: string
  direction: ExecutionDirection
  status: 'running' | 'success' | 'failed'
  startedAt: string
  duration: number
  countScaled: number
  countDrained: number
  totalWorkloads: number
  totalNodes: number
}

export interface MockPolicy {
  id: string
  name: string
  namespaces: string[]
  currentState: 'sleeping' | 'awake' | 'transitioning'
  sleepWindow: { start: string; end: string; days: string[] }
  timezone: string
  savings: number
  executionCount: number
}

export interface MockCostEntry {
  date: string
  savingsUsd: number
  baselineCost: number
  actualCost: number
  nodesAsleep: number
  workloadsScaled: number
  policyId: string
  policyName: string
  sleepHours: number
}

// ── Namespace Data ──────────────────────────────────────────────────────────

export const NAMESPACES = ['production', 'staging', 'dev', 'monitoring', 'kube-system'] as const

const WORKLOADS_BY_NS: Record<string, { name: string; kind: 'Deployment' | 'StatefulSet'; replicas: number }[]> = {
  production: [
    { name: 'api-gateway', kind: 'Deployment', replicas: 3 },
    { name: 'web-frontend', kind: 'Deployment', replicas: 2 },
    { name: 'order-service', kind: 'Deployment', replicas: 2 },
    { name: 'payment-service', kind: 'Deployment', replicas: 2 },
    { name: 'user-service', kind: 'Deployment', replicas: 2 },
    { name: 'notification-svc', kind: 'Deployment', replicas: 1 },
    { name: 'postgres', kind: 'StatefulSet', replicas: 3 },
    { name: 'redis', kind: 'StatefulSet', replicas: 3 },
  ],
  staging: [
    { name: 'api-gateway', kind: 'Deployment', replicas: 1 },
    { name: 'web-frontend', kind: 'Deployment', replicas: 1 },
    { name: 'order-service', kind: 'Deployment', replicas: 1 },
    { name: 'payment-service', kind: 'Deployment', replicas: 1 },
    { name: 'postgres', kind: 'StatefulSet', replicas: 1 },
    { name: 'redis', kind: 'StatefulSet', replicas: 1 },
  ],
  dev: [
    { name: 'api-gateway', kind: 'Deployment', replicas: 1 },
    { name: 'web-frontend', kind: 'Deployment', replicas: 1 },
    { name: 'feature-branch-svc', kind: 'Deployment', replicas: 1 },
    { name: 'postgres', kind: 'StatefulSet', replicas: 1 },
  ],
  monitoring: [
    { name: 'prometheus', kind: 'StatefulSet', replicas: 1 },
    { name: 'grafana', kind: 'Deployment', replicas: 1 },
    { name: 'alertmanager', kind: 'Deployment', replicas: 1 },
    { name: 'loki', kind: 'StatefulSet', replicas: 1 },
  ],
  'kube-system': [
    { name: 'coredns', kind: 'Deployment', replicas: 2 },
    { name: 'kube-proxy', kind: 'Deployment', replicas: 3 },
    { name: 'metrics-server', kind: 'Deployment', replicas: 1 },
  ],
}

// ── Generators ──────────────────────────────────────────────────────────────

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function randomId() {
  return Math.random().toString(36).slice(2, 7)
}

export function generatePods(node: string, namespace: string, workload: string, kind: 'Deployment' | 'StatefulSet', replicas: number, statusOverride?: PodStatus): MockPod[] {
  return Array.from({ length: replicas }, (_, i) => ({
    name: kind === 'StatefulSet' ? `${workload}-${i}` : `${workload}-${randomId()}`,
    namespace,
    workload,
    workloadKind: kind,
    status: statusOverride ?? 'Running',
    cpu: Math.round(randomBetween(5, 80)),
    memory: Math.round(randomBetween(64, 512)),
    restarts: Math.random() > 0.85 ? Math.floor(randomBetween(1, 5)) : 0,
    containers: kind === 'StatefulSet' ? 2 : 1,
    nodeName: node,
  }))
}

export function generateNodes(count: number = 6): MockNode[] {
  const nodeTypes = ['m5.xlarge', 'm5.2xlarge', 'c5.xlarge', 'r5.large']
  const nodes: MockNode[] = []
  const allWorkloads = Object.entries(WORKLOADS_BY_NS).flatMap(([ns, wls]) =>
    wls.map(w => ({ ...w, namespace: ns }))
  )

  for (let i = 0; i < count; i++) {
    const nodeType = nodeTypes[i % nodeTypes.length]
    const cpuCap = nodeType.includes('2xlarge') ? 8000 : 4000
    const memCap = nodeType.includes('r5') ? 32768 : 16384
    const nodeName = `ip-10-0-${i + 1}-${100 + i}.ec2.internal`

    const nodePods: MockPod[] = []
    const workloadsForNode = allWorkloads.filter((_, idx) => idx % count === i)
    for (const wl of workloadsForNode) {
      nodePods.push(...generatePods(nodeName, wl.namespace, wl.name, wl.kind, wl.replicas))
    }

    nodes.push({
      name: nodeName,
      status: 'Ready',
      cpuCapacity: cpuCap,
      cpuUsed: Math.round(randomBetween(cpuCap * 0.2, cpuCap * 0.85)),
      memoryCapacity: memCap,
      memoryUsed: Math.round(randomBetween(memCap * 0.3, memCap * 0.75)),
      podCount: nodePods.length,
      pods: nodePods,
      labels: { 'node.kubernetes.io/instance-type': nodeType, 'topology.kubernetes.io/zone': `us-east-1${String.fromCharCode(97 + (i % 3))}` },
      taints: [],
      age: `${Math.floor(randomBetween(1, 90))}d`,
    })
  }
  return nodes
}

export function generateWorkloads(): MockWorkload[] {
  return Object.entries(WORKLOADS_BY_NS).flatMap(([ns, wls]) =>
    wls.map(w => ({
      name: w.name,
      namespace: ns,
      kind: w.kind,
      replicas: w.replicas,
      replicasBefore: w.replicas,
      status: 'Running' as PodStatus,
    }))
  )
}

export function generateSleepLogLines(workloads: MockWorkload[], nodes: MockNode[]): MockLogLine[] {
  const lines: MockLogLine[] = []
  let seq = 0
  const base = Date.now()

  const push = (level: LogLevel, message: string, extra?: Partial<MockLogLine>) => {
    lines.push({
      id: `log-${seq}`,
      seq,
      level,
      message,
      timestamp: new Date(base + seq * 800).toISOString(),
      ...extra,
    })
    seq++
  }

  push('info', 'Sleep execution started for policy "production-sleep"')
  push('plan', `Planning to scale ${workloads.length} workloads across ${nodes.length} nodes`)
  push('info', 'Evaluating guardrails...')
  push('ok', 'All guardrails passed')

  const scalable = workloads.filter(w => !['kube-system', 'monitoring'].includes(w.namespace))
  for (const w of scalable) {
    push('info', `Scaling ${w.namespace}/${w.name} from ${w.replicas} to 0 replicas`, { workloadName: w.name })
    push('ok', `${w.namespace}/${w.name} scaled to 0`, { workloadName: w.name })
  }

  const drainable = nodes.slice(0, Math.ceil(nodes.length * 0.6))
  for (const n of drainable) {
    push('info', `Cordoning node ${n.name}`, { nodeName: n.name })
    push('info', `Draining node ${n.name} (${n.podCount} pods)`, { nodeName: n.name })
    push('ok', `Node ${n.name} drained successfully`, { nodeName: n.name })
    push('info', `Deleting node ${n.name}`, { nodeName: n.name })
    push('ok', `Node ${n.name} deleted`, { nodeName: n.name })
  }

  push('ok', `Sleep execution completed: ${scalable.length} workloads scaled, ${drainable.length} nodes drained`)
  return lines
}

export function generateWakeLogLines(workloads: MockWorkload[], nodes: MockNode[]): MockLogLine[] {
  const lines: MockLogLine[] = []
  let seq = 0
  const base = Date.now()

  const push = (level: LogLevel, message: string, extra?: Partial<MockLogLine>) => {
    lines.push({
      id: `log-${seq}`,
      seq,
      level,
      message,
      timestamp: new Date(base + seq * 600).toISOString(),
      ...extra,
    })
    seq++
  }

  push('info', 'Wake execution started for policy "production-sleep"')
  push('plan', `Restoring ${workloads.length} workloads`)

  const scalable = workloads.filter(w => !['kube-system', 'monitoring'].includes(w.namespace))
  for (const w of scalable) {
    push('info', `Restoring ${w.namespace}/${w.name} to ${w.replicasBefore} replicas`, { workloadName: w.name })
    push('ok', `${w.namespace}/${w.name} restored (${w.replicasBefore}/${w.replicasBefore} ready)`, { workloadName: w.name })
  }

  push('info', 'Waiting for Karpenter to provision nodes for pending pods...')
  push('ok', 'New nodes provisioned and ready')
  push('ok', `Wake execution completed: ${scalable.length} workloads restored`)
  return lines
}

export function generatePolicies(): MockPolicy[] {
  return [
    {
      id: 'pol-1',
      name: 'production-sleep',
      namespaces: ['production'],
      currentState: 'awake',
      sleepWindow: { start: '22:00', end: '06:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
      timezone: 'America/New_York',
      savings: 12847.50,
      executionCount: 142,
    },
    {
      id: 'pol-2',
      name: 'staging-always-sleep',
      namespaces: ['staging'],
      currentState: 'sleeping',
      sleepWindow: { start: '19:00', end: '08:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
      timezone: 'America/New_York',
      savings: 8234.20,
      executionCount: 210,
    },
    {
      id: 'pol-3',
      name: 'dev-weekend-sleep',
      namespaces: ['dev'],
      currentState: 'awake',
      sleepWindow: { start: '20:00', end: '07:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
      timezone: 'UTC',
      savings: 5621.80,
      executionCount: 98,
    },
  ]
}

export function generateCostHistory(days: number = 90): MockCostEntry[] {
  const entries: MockCostEntry[] = []
  const policies = generatePolicies()
  const now = new Date()
  const nodeHourlyCost = 0.192

  for (let d = days - 1; d >= 0; d--) {
    const date = new Date(now)
    date.setDate(date.getDate() - d)
    const dateStr = date.toISOString().slice(0, 10)
    const dow = date.getDay()
    const isWeekend = dow === 0 || dow === 6

    for (const pol of policies) {
      const sleepHours = isWeekend
        ? (pol.name.includes('always') ? 24 : pol.name.includes('weekend') ? 24 : 0)
        : (pol.name.includes('always') ? 13 : 8)
      const nodesAsleep = pol.name.includes('production') ? 4 : pol.name.includes('staging') ? 2 : 1
      const workloadsScaled = pol.namespaces.reduce((sum, ns) => sum + (WORKLOADS_BY_NS[ns]?.length ?? 0), 0)
      const savingsUsd = sleepHours * nodesAsleep * nodeHourlyCost * (0.85 + Math.random() * 0.3)
      const baselineCost = 24 * nodesAsleep * nodeHourlyCost
      const actualCost = baselineCost - savingsUsd

      entries.push({
        date: dateStr,
        savingsUsd: Math.round(savingsUsd * 100) / 100,
        baselineCost: Math.round(baselineCost * 100) / 100,
        actualCost: Math.round(actualCost * 100) / 100,
        nodesAsleep,
        workloadsScaled,
        policyId: pol.id,
        policyName: pol.name,
        sleepHours: Math.round(sleepHours * 10) / 10,
      })
    }
  }
  return entries
}

export function generateSparklineData(points: number = 24): number[] {
  const data: number[] = []
  let val = randomBetween(20, 60)
  for (let i = 0; i < points; i++) {
    val += randomBetween(-8, 8)
    val = Math.max(0, Math.min(100, val))
    data.push(Math.round(val))
  }
  return data
}

export function generateTimeSeriesData(points: number, baseValue: number, variance: number): { time: string; value: number }[] {
  const now = Date.now()
  const interval = 60000
  return Array.from({ length: points }, (_, i) => ({
    time: new Date(now - (points - i) * interval).toISOString(),
    value: Math.round((baseValue + randomBetween(-variance, variance)) * 100) / 100,
  }))
}
