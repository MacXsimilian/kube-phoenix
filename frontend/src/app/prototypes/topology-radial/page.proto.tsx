'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import ReplayIcon from '@mui/icons-material/Replay'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import { useRouter } from 'next/navigation'
import * as echarts from 'echarts'
import { darkTheme } from '@/lib/motion/echartsTheme'

echarts.registerTheme('kube-phoenix-dark', darkTheme)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PodState = 'running' | 'sleeping' | 'pending' | 'failed'

interface WorkloadDef {
  id: string
  name: string
  namespace: string
  node: string
}

interface PodDef {
  id: string
  name: string
  workload: string
  namespace: string
  node: string
  state: PodState
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RING_RADII = { node: 100, namespace: 200, workload: 300, pod: 400 }
const CENTER_X = 450
const CENTER_Y = 450

const STATE_COLORS: Record<PodState, string> = {
  running: '#22C55E',
  sleeping: '#64748B',
  pending: '#F59E0B',
  failed: '#EF4444',
}

const NS_COLORS: Record<string, string> = {
  production: '#22C55E',
  staging: '#7C3AED',
  dev: '#3B82F6',
  monitoring: '#22D3EE',
  'kube-system': '#F59E0B',
}

const NODES = ['node-1', 'node-2', 'node-3']
const NAMESPACES = ['production', 'staging', 'dev', 'monitoring', 'kube-system']

const WORKLOAD_DEFS: WorkloadDef[] = [
  { id: 'wl-0', name: 'api-server', namespace: 'dev', node: 'node-1' },
  { id: 'wl-1', name: 'web-frontend', namespace: 'dev', node: 'node-1' },
  { id: 'wl-2', name: 'redis', namespace: 'dev', node: 'node-2' },
  { id: 'wl-3', name: 'worker', namespace: 'dev', node: 'node-2' },
  { id: 'wl-4', name: 'checkout-svc', namespace: 'staging', node: 'node-2' },
  { id: 'wl-5', name: 'product-api', namespace: 'staging', node: 'node-3' },
  { id: 'wl-6', name: 'cart-svc', namespace: 'staging', node: 'node-3' },
  { id: 'wl-7', name: 'prometheus', namespace: 'monitoring', node: 'node-2' },
  { id: 'wl-8', name: 'grafana', namespace: 'monitoring', node: 'node-3' },
  { id: 'wl-9', name: 'coredns', namespace: 'kube-system', node: 'node-1' },
  { id: 'wl-10', name: 'kube-proxy', namespace: 'kube-system', node: 'node-1' },
]

function generatePods(): PodDef[] {
  const pods: PodDef[] = []
  const replicaCounts: Record<string, number> = {
    'wl-0': 3, 'wl-1': 2, 'wl-2': 1, 'wl-3': 2,
    'wl-4': 2, 'wl-5': 2, 'wl-6': 1,
    'wl-7': 1, 'wl-8': 1,
    'wl-9': 2, 'wl-10': 1,
  }
  let idx = 0
  for (const wl of WORKLOAD_DEFS) {
    const count = replicaCounts[wl.id] ?? 1
    for (let i = 0; i < count; i++) {
      pods.push({
        id: `pod-${idx++}`,
        name: `${wl.name}-${Math.random().toString(36).slice(2, 7)}`,
        workload: wl.id,
        namespace: wl.namespace,
        node: wl.node,
        state: 'running',
      })
    }
  }
  return pods
}

// ---------------------------------------------------------------------------
// Positioning helpers
// ---------------------------------------------------------------------------

function polarToCartesian(angle: number, radius: number): [number, number] {
  return [
    CENTER_X + Math.cos(angle) * radius,
    CENTER_Y + Math.sin(angle) * radius,
  ]
}

function distributeAngles(count: number, offset: number = 0): number[] {
  return Array.from({ length: count }, (_, i) => offset + (2 * Math.PI * i) / count)
}

function clusterChildAngles(
  parentAngle: number,
  count: number,
  spreadRad: number,
): number[] {
  if (count === 1) return [parentAngle]
  const start = parentAngle - spreadRad / 2
  return Array.from(
    { length: count },
    (_, i) => start + (spreadRad * i) / (count - 1),
  )
}

// ---------------------------------------------------------------------------
// Build namespace angle map
// ---------------------------------------------------------------------------

function buildNsAngleMap(): Record<string, number> {
  const angles = distributeAngles(NAMESPACES.length, -Math.PI / 2)
  const map: Record<string, number> = {}
  NAMESPACES.forEach((ns, i) => { map[ns] = angles[i] })
  return map
}

// ---------------------------------------------------------------------------
// Chart builder
// ---------------------------------------------------------------------------

function buildOption(
  pods: PodDef[],
  expandedNs: string | null,
): echarts.EChartsOption {
  const nsAngles = buildNsAngleMap()
  const nodeAngles = distributeAngles(NODES.length, -Math.PI / 2 + Math.PI / 6)

  const graphNodes: object[] = []
  const graphLinks: object[] = []

  // Cluster center
  graphNodes.push({
    id: 'cluster',
    name: 'dev-cluster',
    x: CENTER_X,
    y: CENTER_Y,
    symbolSize: 36,
    symbol: 'circle',
    category: 0,
    label: { show: true, fontSize: 10, color: '#E2E8F0', position: 'inside' },
    itemStyle: {
      color: '#7C3AED',
      shadowBlur: 30,
      shadowColor: 'rgba(124,58,237,0.6)',
    },
  })

  // Nodes (ring 1)
  NODES.forEach((node, i) => {
    const [x, y] = polarToCartesian(nodeAngles[i], RING_RADII.node)
    const cpuSize = node === 'node-3' ? 18 : 24
    graphNodes.push({
      id: node,
      name: node,
      x, y,
      symbolSize: cpuSize,
      category: 1,
      label: { show: true, fontSize: 9, color: '#E2E8F0', position: 'bottom', distance: 4 },
      itemStyle: {
        color: '#22D3EE',
        shadowBlur: 12,
        shadowColor: 'rgba(34,211,238,0.4)',
      },
    })
    graphLinks.push({
      source: 'cluster',
      target: node,
      lineStyle: { width: 2.5, color: 'rgba(34,211,238,0.35)', curveness: 0.2 },
    })
  })

  // Namespaces (ring 2)
  NAMESPACES.forEach((ns) => {
    const angle = nsAngles[ns]
    const [x, y] = polarToCartesian(angle, RING_RADII.namespace)
    const isExpanded = expandedNs === ns
    graphNodes.push({
      id: `ns-${ns}`,
      name: ns,
      x, y,
      symbolSize: isExpanded ? 18 : 14,
      category: 2,
      label: {
        show: true,
        fontSize: 9,
        color: isExpanded ? '#fff' : '#CBD5E1',
        fontWeight: isExpanded ? 'bold' : 'normal',
        position: 'bottom',
        distance: 4,
      },
      itemStyle: {
        color: NS_COLORS[ns],
        shadowBlur: isExpanded ? 20 : 8,
        shadowColor: NS_COLORS[ns] + '60',
        opacity: expandedNs && !isExpanded ? 0.3 : 1,
      },
    })
    // Namespace → Node links
    const nodeSet = new Set(
      WORKLOAD_DEFS.filter(w => w.namespace === ns).map(w => w.node),
    )
    nodeSet.forEach(node => {
      graphLinks.push({
        source: node,
        target: `ns-${ns}`,
        lineStyle: {
          width: 1.5,
          color: NS_COLORS[ns] + '30',
          curveness: 0.2,
        },
      })
    })
  })

  // Workloads (ring 3)
  const wlsByNs: Record<string, WorkloadDef[]> = {}
  WORKLOAD_DEFS.forEach(wl => {
    if (!wlsByNs[wl.namespace]) wlsByNs[wl.namespace] = []
    wlsByNs[wl.namespace].push(wl)
  })

  const wlPositions: Record<string, { angle: number; x: number; y: number }> = {}

  Object.entries(wlsByNs).forEach(([ns, wls]) => {
    const parentAngle = nsAngles[ns]
    const isExpanded = expandedNs === ns
    const faded = expandedNs !== null && !isExpanded
    const radius = isExpanded ? RING_RADII.workload + 40 : RING_RADII.workload
    const spread = isExpanded ? 0.7 : 0.35
    const angles = clusterChildAngles(parentAngle, wls.length, spread)

    wls.forEach((wl, i) => {
      const [x, y] = polarToCartesian(angles[i], radius)
      wlPositions[wl.id] = { angle: angles[i], x, y }
      graphNodes.push({
        id: wl.id,
        name: wl.name,
        x, y,
        symbolSize: isExpanded ? 10 : 7,
        category: 3,
        label: {
          show: isExpanded,
          fontSize: 8,
          color: '#CBD5E1',
          position: 'right',
          distance: 4,
        },
        itemStyle: {
          color: NS_COLORS[ns],
          opacity: faded ? 0.15 : 0.85,
          shadowBlur: isExpanded ? 8 : 0,
          shadowColor: NS_COLORS[ns] + '40',
        },
      })
      graphLinks.push({
        source: `ns-${ns}`,
        target: wl.id,
        lineStyle: {
          width: 1,
          color: NS_COLORS[ns] + (faded ? '08' : '25'),
          curveness: 0.2,
        },
      })
    })
  })

  // Pods (ring 4)
  const podsByWl: Record<string, PodDef[]> = {}
  pods.forEach(p => {
    if (!podsByWl[p.workload]) podsByWl[p.workload] = []
    podsByWl[p.workload].push(p)
  })

  Object.entries(podsByWl).forEach(([wlId, wlPods]) => {
    const wlDef = WORKLOAD_DEFS.find(w => w.id === wlId)
    if (!wlDef) return
    const ns = wlDef.namespace
    const isExpanded = expandedNs === ns
    const faded = expandedNs !== null && !isExpanded
    const wlPos = wlPositions[wlId]
    if (!wlPos) return

    const radius = isExpanded ? RING_RADII.pod + 50 : RING_RADII.pod
    const spread = isExpanded ? 0.2 : 0.1
    const angles = clusterChildAngles(wlPos.angle, wlPods.length, spread)

    wlPods.forEach((pod, i) => {
      const [x, y] = polarToCartesian(angles[i], radius)
      const isSleeping = pod.state === 'sleeping'
      graphNodes.push({
        id: pod.id,
        name: pod.name,
        x, y,
        symbolSize: isExpanded ? 6 : 4,
        category: 4,
        label: { show: false },
        itemStyle: {
          color: STATE_COLORS[pod.state],
          opacity: faded ? 0.08 : isSleeping ? 0.4 : 0.9,
          shadowBlur: pod.state === 'running' && !faded ? 4 : 0,
          shadowColor: STATE_COLORS[pod.state] + '60',
        },
      })
      graphLinks.push({
        source: wlId,
        target: pod.id,
        lineStyle: {
          width: 0.5,
          color: STATE_COLORS[pod.state] + (faded ? '06' : '18'),
          curveness: 0.2,
        },
      })
    })
  })

  // Categories for focus adjacency
  const categories = [
    { name: 'Cluster' },
    { name: 'Node' },
    { name: 'Namespace' },
    { name: 'Workload' },
    { name: 'Pod' },
  ]

  // Ring circles and labels via graphic
  const ringGraphics = buildRingGraphics()

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (params: unknown) => {
        const p = params as { data?: { name?: string; id?: string }; dataType?: string }
        if (p.dataType === 'node' && p.data) {
          return `<b>${p.data.name}</b><br/>ID: ${p.data.id}`
        }
        return ''
      },
    },
    graphic: ringGraphics,
    series: [
      {
        type: 'graph',
        layout: 'none',
        roam: true,
        animation: true,
        animationDuration: 600,
        animationDurationUpdate: 500,
        animationEasingUpdate: 'cubicInOut',
        emphasis: {
          focus: 'adjacency',
          lineStyle: { width: 3 },
        },
        categories,
        data: graphNodes,
        links: graphLinks,
        lineStyle: { opacity: 1 },
        scaleLimit: { min: 0.4, max: 3 },
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Ring circle graphics
// ---------------------------------------------------------------------------

function buildRingGraphics(): object[] {
  const rings = [
    { r: RING_RADII.node, label: 'Nodes' },
    { r: RING_RADII.namespace, label: 'Namespaces' },
    { r: RING_RADII.workload, label: 'Workloads' },
    { r: RING_RADII.pod, label: 'Pods' },
  ]

  const elements: object[] = []

  rings.forEach(({ r, label }) => {
    elements.push({
      type: 'ring',
      shape: { cx: CENTER_X, cy: CENTER_Y, r: r - 0.5, r0: r + 0.5 },
      style: {
        fill: 'transparent',
        stroke: 'rgba(148,163,184,0.08)',
        lineDash: [4, 4],
        lineWidth: 1,
      },
      silent: true,
      z: -1,
    })
    elements.push({
      type: 'text',
      style: {
        text: label,
        x: CENTER_X + r + 6,
        y: CENTER_Y - 8,
        fill: 'rgba(148,163,184,0.25)',
        fontSize: 10,
        fontFamily: '"Inter", sans-serif',
      },
      silent: true,
      z: -1,
    })
  })

  return elements
}

// ---------------------------------------------------------------------------
// Stats calculation
// ---------------------------------------------------------------------------

function computeStats(pods: PodDef[]) {
  const total = pods.length
  let running = 0
  let sleeping = 0
  let failed = 0
  let pending = 0
  for (const p of pods) {
    if (p.state === 'running') running++
    else if (p.state === 'sleeping') sleeping++
    else if (p.state === 'failed') failed++
    else if (p.state === 'pending') pending++
  }
  return { total, running, sleeping, failed, pending }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TopologyRadialPrototype() {
  const router = useRouter()
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)
  const [pods, setPods] = useState<PodDef[]>(() => generatePods())
  const [simulating, setSimulating] = useState(false)
  const [expandedNs, setExpandedNs] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stats = computeStats(pods)

  const updateChart = useCallback((currentPods: PodDef[], currentExpanded: string | null) => {
    if (!chartInstance.current) return
    const option = buildOption(currentPods, currentExpanded)
    chartInstance.current.setOption(option, { replaceMerge: ['series', 'graphic'] })
  }, [])

  // Initialize chart
  useEffect(() => {
    if (!chartRef.current) return
    const chart = echarts.init(chartRef.current, 'kube-phoenix-dark')
    chartInstance.current = chart
    updateChart(pods, expandedNs)

    chart.on('click', (params: unknown) => {
      const p = params as { dataType?: string; data?: { id?: string } }
      if (p.dataType !== 'node') {
        setExpandedNs(null)
        return
      }
      const id = p.data?.id
      if (typeof id === 'string' && id.startsWith('ns-')) {
        const ns = id.slice(3)
        setExpandedNs(prev => (prev === ns ? null : ns))
      }
    })

    const ro = new ResizeObserver(() => chart.resize())
    ro.observe(chartRef.current)

    return () => {
      ro.disconnect()
      chart.dispose()
      chartInstance.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync chart when pods or expandedNs change
  useEffect(() => {
    updateChart(pods, expandedNs)
  }, [pods, expandedNs, updateChart])

  // Simulation loop
  useEffect(() => {
    if (!simulating) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = null
      return
    }
    intervalRef.current = setInterval(() => {
      setPods(prev => {
        const next = [...prev]
        const changes = 1 + Math.floor(Math.random() * 2)
        for (let c = 0; c < changes; c++) {
          const idx = Math.floor(Math.random() * next.length)
          const pod = { ...next[idx] }
          if (pod.state === 'sleeping') continue
          const roll = Math.random()
          if (roll < 0.6) pod.state = 'running'
          else if (roll < 0.85) pod.state = 'pending'
          else pod.state = 'failed'
          next[idx] = pod
        }
        return next
      })
    }, 1500)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [simulating])

  const handleReset = useCallback(() => {
    setSimulating(false)
    setExpandedNs(null)
    setPods(generatePods())
  }, [])

  const handleSleep = useCallback((ns: string) => {
    setPods(prev =>
      prev.map(p =>
        p.namespace === ns ? { ...p, state: 'sleeping' as PodState } : p,
      ),
    )
  }, [])

  const handleWake = useCallback((ns: string) => {
    setPods(prev =>
      prev.map(p =>
        p.namespace === ns && p.state === 'sleeping'
          ? { ...p, state: 'running' as PodState }
          : p,
      ),
    )
  }, [])

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#0B0E14' }}>
      {/* Header */}
      <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#E2E8F0' }}>
          G3-v4 — Radial Topology
        </Typography>
      </Box>

      {/* Controls */}
      <Box sx={{ px: 2, py: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Button
          size="small"
          variant={simulating ? 'contained' : 'outlined'}
          startIcon={simulating ? <PauseIcon /> : <PlayArrowIcon />}
          onClick={() => setSimulating(s => !s)}
          color={simulating ? 'warning' : 'primary'}
        >
          {simulating ? 'Pause' : 'Simulate'}
        </Button>
        <Button size="small" variant="outlined" startIcon={<ReplayIcon />} onClick={handleReset}>
          Reset
        </Button>

        <Box sx={{ mx: 0.5, width: '1px', height: 24, bgcolor: 'rgba(255,255,255,0.08)' }} />

        <Button size="small" variant="outlined" startIcon={<BedtimeIcon />} onClick={() => handleSleep('staging')}>
          Sleep staging
        </Button>
        <Button size="small" variant="outlined" startIcon={<WbSunnyIcon />} onClick={() => handleWake('staging')}>
          Wake staging
        </Button>
        <Button size="small" variant="outlined" startIcon={<BedtimeIcon />} onClick={() => handleSleep('dev')}>
          Sleep dev
        </Button>
        <Button size="small" variant="outlined" startIcon={<WbSunnyIcon />} onClick={() => handleWake('dev')}>
          Wake dev
        </Button>

        <Box sx={{ mx: 0.5, width: '1px', height: 24, bgcolor: 'rgba(255,255,255,0.08)' }} />

        <Chip label={`Total: ${stats.total}`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.06)', color: '#CBD5E1' }} />
        <Chip label={`Running: ${stats.running}`} size="small" sx={{ bgcolor: 'rgba(34,197,94,0.12)', color: '#22C55E' }} />
        <Chip label={`Sleeping: ${stats.sleeping}`} size="small" sx={{ bgcolor: 'rgba(100,116,139,0.15)', color: '#94A3B8' }} />
        <Chip label={`Pending: ${stats.pending}`} size="small" sx={{ bgcolor: 'rgba(245,158,11,0.12)', color: '#F59E0B' }} />
        <Chip label={`Failed: ${stats.failed}`} size="small" sx={{ bgcolor: 'rgba(239,68,68,0.12)', color: '#EF4444' }} />
      </Box>

      {/* Chart */}
      <Box ref={chartRef} sx={{ flex: 1, minHeight: 0 }} />
    </Box>
  )
}
