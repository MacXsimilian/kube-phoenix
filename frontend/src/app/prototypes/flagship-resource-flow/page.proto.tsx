'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Card from '@mui/material/Card'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import ReplayIcon from '@mui/icons-material/Replay'
import CloseIcon from '@mui/icons-material/Close'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import * as echarts from 'echarts'
import { darkTheme } from '@/lib/motion/echartsTheme'
import gsap from 'gsap'

echarts.registerTheme('kube-phoenix-dark', darkTheme)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewMode = 'replicas' | 'cpu' | 'memory' | 'cost'
type SimState = 'awake' | 'sleeping' | 'transitioning'
type NodeLevel = 'policy' | 'namespace' | 'workload' | 'node'

interface PolicyData {
  name: string
  schedule: string
  color: string
  namespaces: string[]
  totalSavings: string
  executionCount: number
}

interface WorkloadData {
  name: string
  kind: string
  namespace: string
  replicas: number
  cpu: number
  memory: number
  status: 'running' | 'sleeping' | 'pending' | 'failed'
  costPerHour: number
  nodes: string[]
}

interface NodeData {
  name: string
  instanceType: string
  cpuCapacity: number
  cpuUsed: number
  memoryCapacity: number
  memoryUsed: number
  podCount: number
}

interface DetailInfo {
  level: NodeLevel
  name: string
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const COLORS = {
  policy: {
    'production-sleep': '#7C3AED',
    'staging-always-sleep': '#6366F1',
    'dev-weekend-sleep': '#3B82F6',
    'Unmanaged': '#64748B',
  } as Record<string, string>,
  status: {
    running: '#22C55E',
    sleeping: '#475569',
    pending: '#F59E0B',
    failed: '#EF4444',
  },
  nsAwake: '#22C55E',
  nsSleeping: '#7C3AED',
}

function cpuUtilColor(pct: number): string {
  if (pct < 30) return '#3B82F6'
  if (pct < 60) return '#22C55E'
  if (pct < 80) return '#F59E0B'
  return '#EF4444'
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const POLICIES: PolicyData[] = [
  { name: 'production-sleep', schedule: '0 22 * * 1-5', color: COLORS.policy['production-sleep'], namespaces: ['production'], totalSavings: '$1,247.60', executionCount: 89 },
  { name: 'staging-always-sleep', schedule: '0 19 * * *', color: COLORS.policy['staging-always-sleep'], namespaces: ['staging'], totalSavings: '$634.20', executionCount: 134 },
  { name: 'dev-weekend-sleep', schedule: '0 18 * * 5', color: COLORS.policy['dev-weekend-sleep'], namespaces: ['dev'], totalSavings: '$312.80', executionCount: 52 },
]

const WORKLOADS: WorkloadData[] = [
  // production
  { name: 'api-gateway', kind: 'Deployment', namespace: 'production', replicas: 3, cpu: 600, memory: 1024, status: 'running', costPerHour: 0.54, nodes: ['node-1', 'node-2', 'node-3'] },
  { name: 'web-frontend', kind: 'Deployment', namespace: 'production', replicas: 2, cpu: 400, memory: 512, status: 'running', costPerHour: 0.36, nodes: ['node-1', 'node-2'] },
  { name: 'order-service', kind: 'Deployment', namespace: 'production', replicas: 2, cpu: 500, memory: 768, status: 'running', costPerHour: 0.41, nodes: ['node-2', 'node-3'] },
  { name: 'payment-service', kind: 'Deployment', namespace: 'production', replicas: 2, cpu: 500, memory: 1024, status: 'running', costPerHour: 0.45, nodes: ['node-3', 'node-4'] },
  { name: 'user-service', kind: 'Deployment', namespace: 'production', replicas: 2, cpu: 400, memory: 512, status: 'running', costPerHour: 0.32, nodes: ['node-1', 'node-4'] },
  { name: 'notification-svc', kind: 'Deployment', namespace: 'production', replicas: 1, cpu: 200, memory: 256, status: 'running', costPerHour: 0.14, nodes: ['node-2'] },
  { name: 'postgres', kind: 'StatefulSet', namespace: 'production', replicas: 3, cpu: 600, memory: 2048, status: 'running', costPerHour: 0.72, nodes: ['node-4', 'node-5', 'node-6'] },
  { name: 'redis', kind: 'StatefulSet', namespace: 'production', replicas: 3, cpu: 400, memory: 2048, status: 'running', costPerHour: 0.67, nodes: ['node-5', 'node-6', 'node-1'] },
  // staging
  { name: 'stg-api-gateway', kind: 'Deployment', namespace: 'staging', replicas: 1, cpu: 200, memory: 512, status: 'running', costPerHour: 0.18, nodes: ['node-3'] },
  { name: 'stg-web-frontend', kind: 'Deployment', namespace: 'staging', replicas: 1, cpu: 200, memory: 512, status: 'running', costPerHour: 0.18, nodes: ['node-3'] },
  { name: 'stg-order-service', kind: 'Deployment', namespace: 'staging', replicas: 1, cpu: 200, memory: 512, status: 'running', costPerHour: 0.18, nodes: ['node-4'] },
  { name: 'stg-payment-service', kind: 'Deployment', namespace: 'staging', replicas: 1, cpu: 200, memory: 512, status: 'running', costPerHour: 0.18, nodes: ['node-4'] },
  { name: 'stg-postgres', kind: 'StatefulSet', namespace: 'staging', replicas: 1, cpu: 200, memory: 512, status: 'running', costPerHour: 0.18, nodes: ['node-5'] },
  { name: 'stg-redis', kind: 'StatefulSet', namespace: 'staging', replicas: 1, cpu: 200, memory: 512, status: 'running', costPerHour: 0.14, nodes: ['node-5'] },
  // dev
  { name: 'dev-api-gateway', kind: 'Deployment', namespace: 'dev', replicas: 1, cpu: 200, memory: 512, status: 'running', costPerHour: 0.14, nodes: ['node-5'] },
  { name: 'dev-web-frontend', kind: 'Deployment', namespace: 'dev', replicas: 1, cpu: 200, memory: 512, status: 'running', costPerHour: 0.14, nodes: ['node-6'] },
  { name: 'feature-branch-svc', kind: 'Deployment', namespace: 'dev', replicas: 1, cpu: 200, memory: 512, status: 'running', costPerHour: 0.10, nodes: ['node-6'] },
  { name: 'dev-postgres', kind: 'StatefulSet', namespace: 'dev', replicas: 1, cpu: 200, memory: 512, status: 'running', costPerHour: 0.14, nodes: ['node-6'] },
  // monitoring
  { name: 'prometheus', kind: 'StatefulSet', namespace: 'monitoring', replicas: 1, cpu: 400, memory: 2048, status: 'running', costPerHour: 0.32, nodes: ['node-1'] },
  { name: 'grafana', kind: 'Deployment', namespace: 'monitoring', replicas: 1, cpu: 200, memory: 512, status: 'running', costPerHour: 0.14, nodes: ['node-1'] },
  { name: 'alertmanager', kind: 'Deployment', namespace: 'monitoring', replicas: 1, cpu: 200, memory: 512, status: 'running', costPerHour: 0.10, nodes: ['node-2'] },
  { name: 'loki', kind: 'StatefulSet', namespace: 'monitoring', replicas: 1, cpu: 200, memory: 1024, status: 'running', costPerHour: 0.18, nodes: ['node-2'] },
  // kube-system
  { name: 'coredns', kind: 'Deployment', namespace: 'kube-system', replicas: 2, cpu: 200, memory: 256, status: 'running', costPerHour: 0.08, nodes: ['node-1', 'node-2'] },
  { name: 'kube-proxy', kind: 'DaemonSet', namespace: 'kube-system', replicas: 3, cpu: 200, memory: 512, status: 'running', costPerHour: 0.12, nodes: ['node-1', 'node-3', 'node-5'] },
  { name: 'metrics-server', kind: 'Deployment', namespace: 'kube-system', replicas: 1, cpu: 200, memory: 256, status: 'running', costPerHour: 0.06, nodes: ['node-4'] },
]

const NODES: NodeData[] = [
  { name: 'node-1', instanceType: 'm5.xlarge', cpuCapacity: 8000, cpuUsed: 5800, memoryCapacity: 16384, memoryUsed: 11264, podCount: 8 },
  { name: 'node-2', instanceType: 'm5.xlarge', cpuCapacity: 8000, cpuUsed: 5200, memoryCapacity: 16384, memoryUsed: 9728, podCount: 7 },
  { name: 'node-3', instanceType: 'm5.large', cpuCapacity: 4000, cpuUsed: 3400, memoryCapacity: 8192, memoryUsed: 6656, podCount: 6 },
  { name: 'node-4', instanceType: 'm5.large', cpuCapacity: 4000, cpuUsed: 3100, memoryCapacity: 8192, memoryUsed: 5632, podCount: 6 },
  { name: 'node-5', instanceType: 'm5.xlarge', cpuCapacity: 8000, cpuUsed: 4600, memoryCapacity: 16384, memoryUsed: 10752, podCount: 7 },
  { name: 'node-6', instanceType: 'm5.large', cpuCapacity: 4000, cpuUsed: 2000, memoryCapacity: 8192, memoryUsed: 4096, podCount: 4 },
]

const NAMESPACE_POLICY_MAP: Record<string, string> = {
  production: 'production-sleep',
  staging: 'staging-always-sleep',
  dev: 'dev-weekend-sleep',
  monitoring: 'Unmanaged',
  'kube-system': 'Unmanaged',
}

const ALL_NAMESPACES = ['production', 'staging', 'dev', 'monitoring', 'kube-system']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getValueForMode(workload: WorkloadData, mode: ViewMode): number {
  switch (mode) {
    case 'replicas': return workload.replicas
    case 'cpu': return workload.cpu
    case 'memory': return workload.memory
    case 'cost': return Math.round(workload.costPerHour * 100)
  }
}

function buildSankeyData(mode: ViewMode, sleeping: boolean) {
  const nodes: { name: string; depth: number; itemStyle: { color: string; borderWidth: number; borderColor: string } }[] = []
  const links: { source: string; target: string; value: number; lineStyle?: { color: string; opacity: number } }[] = []

  const policyNames = [...POLICIES.map(p => p.name), 'Unmanaged']
  policyNames.forEach(pName => {
    const color = COLORS.policy[pName] || '#64748B'
    nodes.push({
      name: pName,
      depth: 0,
      itemStyle: { color, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    })
  })

  ALL_NAMESPACES.forEach(ns => {
    const policyName = NAMESPACE_POLICY_MAP[ns]
    const isManaged = policyName !== 'Unmanaged'
    const isSleeping = sleeping && isManaged
    const color = isSleeping ? COLORS.nsSleeping : COLORS.nsAwake
    nodes.push({
      name: `ns:${ns}`,
      depth: 1,
      itemStyle: { color, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    })

    const nsWorkloads = WORKLOADS.filter(w => w.namespace === ns)
    const nsTotal = nsWorkloads.reduce((sum, w) => {
      const val = getValueForMode(w, mode)
      return sum + (isSleeping ? Math.max(1, Math.round(val * 0.05)) : val)
    }, 0)

    links.push({
      source: policyName,
      target: `ns:${ns}`,
      value: Math.max(1, nsTotal),
      lineStyle: {
        color: COLORS.policy[policyName] || '#64748B',
        opacity: isSleeping ? 0.08 : 0.25,
      },
    })
  })

  WORKLOADS.forEach(w => {
    const policyName = NAMESPACE_POLICY_MAP[w.namespace]
    const isManaged = policyName !== 'Unmanaged'
    const isSleeping = sleeping && isManaged
    const status = isSleeping ? 'sleeping' : w.status
    const val = isSleeping ? Math.max(1, Math.round(getValueForMode(w, mode) * 0.05)) : getValueForMode(w, mode)

    nodes.push({
      name: `wl:${w.name}`,
      depth: 2,
      itemStyle: {
        color: COLORS.status[status],
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
      },
    })

    links.push({
      source: `ns:${w.namespace}`,
      target: `wl:${w.name}`,
      value: Math.max(1, val),
      lineStyle: {
        color: COLORS.status[status],
        opacity: isSleeping ? 0.08 : 0.3,
      },
    })

    const replicasPerNode = Math.max(1, Math.ceil(val / w.nodes.length))
    w.nodes.forEach(nodeName => {
      links.push({
        source: `wl:${w.name}`,
        target: `nd:${nodeName}`,
        value: Math.max(1, isSleeping ? 1 : replicasPerNode),
        lineStyle: {
          color: COLORS.status[status],
          opacity: isSleeping ? 0.06 : 0.2,
        },
      })
    })
  })

  NODES.forEach(n => {
    const utilPct = (n.cpuUsed / n.cpuCapacity) * 100
    nodes.push({
      name: `nd:${n.name}`,
      depth: 3,
      itemStyle: {
        color: cpuUtilColor(utilPct),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
      },
    })
  })

  return { nodes, links }
}

function formatLabel(name: string): string {
  if (name.startsWith('ns:')) return name.slice(3)
  if (name.startsWith('wl:')) return name.slice(3)
  if (name.startsWith('nd:')) return name.slice(3)
  return name
}

function detectLevel(name: string): NodeLevel {
  if (name.startsWith('ns:')) return 'namespace'
  if (name.startsWith('wl:')) return 'workload'
  if (name.startsWith('nd:')) return 'node'
  return 'policy'
}

// ---------------------------------------------------------------------------
// Stat Card Component
// ---------------------------------------------------------------------------

function StatCard({ label, value, suffix, sub, color }: { label: string; value: number; suffix?: string; sub: string; color: string }) {
  const valRef = useRef<HTMLSpanElement>(null)
  const hasAnimated = useRef(false)

  useEffect(() => {
    if (!valRef.current || hasAnimated.current) return
    hasAnimated.current = true
    const target = { v: 0 }
    gsap.to(target, {
      v: value,
      duration: 1.4,
      ease: 'power2.out',
      onUpdate: () => {
        if (!valRef.current) return
        valRef.current.textContent = suffix === '$'
          ? `$${target.v.toFixed(2)}`
          : String(Math.round(target.v))
      },
    })
  }, [value, suffix])

  return (
    <Card sx={{ flex: 1, p: 2, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </Typography>
      <Typography variant="h5" fontWeight={800} sx={{ color, mt: 0.5 }}>
        <span ref={valRef}>0</span>
      </Typography>
      <Typography variant="caption" color="text.secondary">{sub}</Typography>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Detail Panel Component
// ---------------------------------------------------------------------------

function DetailPanel({ detail, onClose }: { detail: DetailInfo; onClose: () => void }) {
  const rawName = formatLabel(detail.name)

  function renderPolicyDetail() {
    const policy = POLICIES.find(p => p.name === rawName)
    if (!policy) {
      return <Typography variant="body2" color="text.secondary">Unmanaged workloads (no policy)</Typography>
    }
    const nsWorkloads = WORKLOADS.filter(w => policy.namespaces.includes(w.namespace))
    const totalReplicas = nsWorkloads.reduce((s, w) => s + w.replicas, 0)
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <DetailRow label="Schedule" value={policy.schedule} />
        <DetailRow label="Namespaces" value={policy.namespaces.join(', ')} />
        <DetailRow label="Workloads" value={String(nsWorkloads.length)} />
        <DetailRow label="Total Replicas" value={String(totalReplicas)} />
        <DetailRow label="Total Savings" value={policy.totalSavings} />
        <DetailRow label="Executions" value={String(policy.executionCount)} />
      </Box>
    )
  }

  function renderNamespaceDetail() {
    const nsWorkloads = WORKLOADS.filter(w => w.namespace === rawName)
    const totalReplicas = nsWorkloads.reduce((s, w) => s + w.replicas, 0)
    const totalCpu = nsWorkloads.reduce((s, w) => s + w.cpu, 0)
    const totalMem = nsWorkloads.reduce((s, w) => s + w.memory, 0)
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <DetailRow label="Policy" value={NAMESPACE_POLICY_MAP[rawName]} />
        <DetailRow label="Workloads" value={String(nsWorkloads.length)} />
        <DetailRow label="Total Replicas" value={String(totalReplicas)} />
        <DetailRow label="CPU" value={`${totalCpu}m`} />
        <DetailRow label="Memory" value={`${totalMem} MB`} />
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, mb: 0.5, display: 'block' }}>
            Workloads
          </Typography>
          {nsWorkloads.map(w => (
            <Box key={w.name} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}>
              <Typography variant="caption" sx={{ color: COLORS.status[w.status] }}>{w.name}</Typography>
              <Typography variant="caption" color="text.secondary">{w.replicas}r</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    )
  }

  function renderWorkloadDetail() {
    const workload = WORKLOADS.find(w => w.name === rawName)
    if (!workload) return null
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <DetailRow label="Kind" value={workload.kind} />
        <DetailRow label="Namespace" value={workload.namespace} />
        <DetailRow label="Status" value={workload.status} />
        <DetailRow label="Replicas" value={String(workload.replicas)} />
        <DetailRow label="CPU" value={`${workload.cpu}m`} />
        <DetailRow label="Memory" value={`${workload.memory} MB`} />
        <DetailRow label="Cost/hr" value={`$${workload.costPerHour.toFixed(2)}`} />
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, mb: 0.5, display: 'block' }}>
            Pods
          </Typography>
          {Array.from({ length: workload.replicas }, (_, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25 }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: COLORS.status[workload.status] }} />
              <Typography variant="caption" color="text.secondary">{workload.name}-{String.fromCharCode(97 + i)}x{Math.random().toString(36).slice(2, 7)}</Typography>
            </Box>
          ))}
        </Box>
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, mb: 0.5, display: 'block' }}>
            Nodes
          </Typography>
          {workload.nodes.map(n => (
            <Typography key={n} variant="caption" color="text.secondary" sx={{ display: 'block' }}>{n}</Typography>
          ))}
        </Box>
      </Box>
    )
  }

  function renderNodeDetail() {
    const node = NODES.find(n => n.name === rawName)
    if (!node) return null
    const cpuPct = Math.round((node.cpuUsed / node.cpuCapacity) * 100)
    const memPct = Math.round((node.memoryUsed / node.memoryCapacity) * 100)
    const nodeWorkloads = WORKLOADS.filter(w => w.nodes.includes(rawName))
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <DetailRow label="Instance" value={node.instanceType} />
        <DetailRow label="CPU" value={`${node.cpuUsed}m / ${node.cpuCapacity}m (${cpuPct}%)`} />
        <DetailRow label="Memory" value={`${node.memoryUsed} / ${node.memoryCapacity} MB (${memPct}%)`} />
        <DetailRow label="Pod Count" value={String(node.podCount)} />
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, mb: 0.5, display: 'block' }}>
            Workloads on this node
          </Typography>
          {nodeWorkloads.map(w => (
            <Box key={w.name} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}>
              <Typography variant="caption" sx={{ color: COLORS.status[w.status] }}>{w.name}</Typography>
              <Typography variant="caption" color="text.secondary">{w.namespace}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    )
  }

  const levelLabel: Record<NodeLevel, string> = { policy: 'Policy', namespace: 'Namespace', workload: 'Workload', node: 'Node' }

  return (
    <motion.div
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: 300,
        background: 'rgba(15, 15, 22, 0.95)', borderLeft: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(12px)', overflowY: 'auto', zIndex: 10,
      }}
    >
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Chip label={levelLabel[detail.level]} size="small" sx={{ bgcolor: 'rgba(124,58,237,0.2)', color: '#C4B5FD', fontSize: 10, height: 20 }} />
          <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2, wordBreak: 'break-word' }}>
          {rawName}
        </Typography>
        {detail.level === 'policy' && renderPolicyDetail()}
        {detail.level === 'namespace' && renderNamespaceDetail()}
        {detail.level === 'workload' && renderWorkloadDetail()}
        {detail.level === 'node' && renderNodeDetail()}
      </Box>
    </motion.div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>{label}</Typography>
      <Typography variant="caption" fontWeight={600} sx={{ fontSize: 11 }}>{value}</Typography>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function FlagshipResourceFlowPrototype() {
  const router = useRouter()
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('replicas')
  const [simState, setSimState] = useState<SimState>('awake')
  const [detail, setDetail] = useState<DetailInfo | null>(null)

  const totalWorkloads = WORKLOADS.length
  const runningCount = WORKLOADS.filter(w => w.status === 'running').length
  const sleepingCount = WORKLOADS.filter(w => w.status === 'sleeping').length
  const totalReplicas = WORKLOADS.reduce((s, w) => s + w.replicas, 0)
  const totalCost = WORKLOADS.reduce((s, w) => s + w.costPerHour, 0)

  const buildOption = useCallback((mode: ViewMode, sleeping: boolean): echarts.EChartsOption => {
    const { nodes, links } = buildSankeyData(mode, sleeping)
    const modeLabels: Record<ViewMode, string> = { replicas: 'replicas', cpu: 'mCPU', memory: 'MB', cost: 'cents/hr' }

    return {
      animation: true,
      animationDuration: 800,
      animationDurationUpdate: 600,
      animationEasing: 'cubicOut',
      animationEasingUpdate: 'cubicInOut',
      tooltip: {
        trigger: 'item',
        triggerOn: 'mousemove',
        formatter: (params: unknown) => {
          const p = params as { dataType: string; data: { source?: string; target?: string; value?: number }; name?: string; value?: number }
          if (p.dataType === 'edge') {
            return `${formatLabel(p.data.source || '')} → ${formatLabel(p.data.target || '')}<br/><strong>${p.data.value} ${modeLabels[mode]}</strong>`
          }
          return `<strong>${formatLabel(p.name || '')}</strong><br/>${p.value ?? ''} ${modeLabels[mode]}`
        },
      },
      series: [{
        type: 'sankey' as const,
        orient: 'horizontal' as const,
        nodeWidth: 20,
        nodeGap: 10,
        layoutIterations: 0,
        emphasis: { focus: 'adjacency' },
        lineStyle: { color: 'source', curveness: 0.5, opacity: 0.25 },
        label: {
          position: 'right',
          fontSize: 10,
          fontFamily: '"Inter", sans-serif',
          color: '#CBD5E1',
          formatter: (p: { name: string }) => formatLabel(p.name),
        },
        levels: [
          {
            depth: 0,
            label: { position: 'left', fontSize: 11, fontWeight: 'bold' as const },
            lineStyle: { opacity: 0.3 },
          },
          {
            depth: 1,
            label: { fontSize: 11, fontWeight: 'bold' as const },
            lineStyle: { opacity: 0.25 },
          },
          {
            depth: 2,
            label: { fontSize: 9 },
            lineStyle: { opacity: 0.2 },
          },
          {
            depth: 3,
            label: { position: 'right', fontSize: 11, fontWeight: 'bold' as const },
            lineStyle: { opacity: 0.15 },
          },
        ],
        data: nodes,
        links,
      }],
    }
  }, [])

  useEffect(() => {
    if (!chartRef.current) return
    const chart = echarts.init(chartRef.current, 'kube-phoenix-dark', { renderer: 'canvas' })
    chartInstance.current = chart
    chart.setOption(buildOption(viewMode, simState === 'sleeping'))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chart.on('click', (params: any) => {
      if (params.dataType === 'node' && params.name) {
        const level = detectLevel(params.name)
        setDetail(prev => {
          if (prev && prev.name === params.name) return null
          return { level, name: params.name! }
        })
      }
    })

    const ob = new ResizeObserver(() => chart.resize())
    ob.observe(chartRef.current)

    return () => {
      ob.disconnect()
      chart.dispose()
      chartInstance.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!chartInstance.current) return
    chartInstance.current.setOption(buildOption(viewMode, simState === 'sleeping'), { replaceMerge: ['series'] })
  }, [viewMode, simState, buildOption])

  function handleSleep() {
    setSimState('transitioning')
    setDetail(null)
    setTimeout(() => setSimState('sleeping'), 100)
  }

  function handleWake() {
    setSimState('transitioning')
    setDetail(null)
    setTimeout(() => setSimState('awake'), 100)
  }

  function handleReset() {
    setSimState('awake')
    setViewMode('replicas')
    setDetail(null)
  }

  const modeLabel: Record<ViewMode, string> = {
    replicas: 'Replica Flow',
    cpu: 'CPU Flow',
    memory: 'Memory Flow',
    cost: 'Cost Flow',
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', py: 4, px: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>FL8 — Resource Flow</Typography>
          <Typography variant="body2" color="text.secondary">
            Multi-level Sankey: Policies → Namespaces → Workloads → Nodes
          </Typography>
        </Box>
        {simState === 'sleeping' && (
          <Chip icon={<BedtimeIcon sx={{ fontSize: 14 }} />} label="Cluster Sleeping" size="small"
            sx={{ bgcolor: 'rgba(124,58,237,0.2)', color: '#C4B5FD' }} />
        )}
      </Box>

      {/* Stats Bar */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <StatCard label="Policies" value={POLICIES.length + 1} sub={`${POLICIES.length} managed + 1 unmanaged`} color="#7C3AED" />
        <StatCard label="Workloads" value={totalWorkloads} sub={`${runningCount} running / ${sleepingCount} sleeping`} color="#22C55E" />
        <StatCard label="Total Replicas" value={totalReplicas} sub="across all namespaces" color="#3B82F6" />
        <StatCard label="Hourly Cost" value={totalCost} suffix="$" sub="estimated compute cost" color="#F59E0B" />
      </Box>

      {/* Controls */}
      <Box sx={{
        display: 'flex', gap: 1.5, mb: 3, p: 1.5, borderRadius: 2,
        bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid', borderColor: 'divider',
        alignItems: 'center', flexWrap: 'wrap',
      }}>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          size="small"
          onChange={(_, v) => { if (v) setViewMode(v as ViewMode) }}
          sx={{
            '& .MuiToggleButton-root': {
              fontSize: 11, px: 1.5, py: 0.5, textTransform: 'none',
              color: 'text.secondary', borderColor: 'divider',
              '&.Mui-selected': { bgcolor: 'rgba(124,58,237,0.15)', color: '#C4B5FD' },
            },
          }}
        >
          {(['replicas', 'cpu', 'memory', 'cost'] as ViewMode[]).map(m => (
            <ToggleButton key={m} value={m}>{modeLabel[m]}</ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Box sx={{ flex: 1 }} />

        <Button
          variant="outlined" size="small"
          startIcon={<BedtimeIcon sx={{ fontSize: 14 }} />}
          disabled={simState === 'sleeping' || simState === 'transitioning'}
          onClick={handleSleep}
          sx={{ fontSize: 11, textTransform: 'none', borderColor: 'divider', color: '#C4B5FD' }}
        >
          Simulate Sleep
        </Button>
        <Button
          variant="outlined" size="small"
          startIcon={<WbSunnyIcon sx={{ fontSize: 14 }} />}
          disabled={simState === 'awake' || simState === 'transitioning'}
          onClick={handleWake}
          sx={{ fontSize: 11, textTransform: 'none', borderColor: 'divider', color: '#FCD34D' }}
        >
          Simulate Wake
        </Button>
        <Button
          variant="outlined" size="small"
          startIcon={<ReplayIcon sx={{ fontSize: 14 }} />}
          onClick={handleReset}
          sx={{ fontSize: 11, textTransform: 'none', borderColor: 'divider' }}
        >
          Reset
        </Button>
      </Box>

      {/* Level Legend */}
      <Box sx={{ display: 'flex', gap: 3, mb: 1.5, px: 1 }}>
        {[
          { label: 'Policies', color: '#7C3AED' },
          { label: 'Namespaces', color: '#22C55E' },
          { label: 'Workloads', color: '#94A3B8' },
          { label: 'Nodes', color: '#3B82F6' },
        ].map(l => (
          <Box key={l.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: 0.5, bgcolor: l.color }} />
            <Typography variant="caption" sx={{ color: l.color, fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {l.label}
            </Typography>
          </Box>
        ))}
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
          Click a node to inspect details
        </Typography>
      </Box>

      {/* Chart + Detail Panel */}
      <Box sx={{ position: 'relative', borderRadius: 2, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        <Box
          ref={chartRef}
          sx={{
            width: detail ? 'calc(100% - 300px)' : '100%',
            height: 600,
            transition: 'width 0.3s ease',
          }}
        />
        <AnimatePresence>
          {detail && (
            <DetailPanel detail={detail} onClose={() => setDetail(null)} />
          )}
        </AnimatePresence>
      </Box>

      {/* Status Legend */}
      <Box sx={{ display: 'flex', gap: 2, mt: 1.5, px: 1, justifyContent: 'center' }}>
        {[
          { label: 'Running', color: '#22C55E' },
          { label: 'Sleeping', color: '#475569' },
          { label: 'Pending', color: '#F59E0B' },
          { label: 'Failed', color: '#EF4444' },
        ].map(s => (
          <Box key={s.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: s.color }} />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{s.label}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
