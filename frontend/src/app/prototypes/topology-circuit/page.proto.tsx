'use client'

import { useState, useEffect, useRef, useCallback, useMemo, type ReactElement } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import ReplayIcon from '@mui/icons-material/Replay'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import { useRouter } from 'next/navigation'
import gsap from 'gsap'

// ─── Types ───────────────────────────────────────────────────────────────────

type PodState = 'running' | 'sleeping' | 'pending' | 'failed'
type Namespace = 'dev' | 'staging' | 'monitoring' | 'kube-system'

interface NodeData {
  id: string
  designator: string
  name: string
  instanceType: string
  cpuPercent: number
  memPercent: number
  podCount: number
  x: number
  y: number
  width: number
  height: number
}

interface WorkloadData {
  id: string
  designator: string
  name: string
  kind: string
  namespace: Namespace
  nodeId: string
  replicas: number
  x: number
  y: number
  width: number
  height: number
}

interface PodData {
  id: string
  name: string
  workloadId: string
  state: PodState
  cpu: number
  x: number
  y: number
}

// ─── Constants ───────────────────────────────────────────────────────────────

const NS_COLORS: Record<Namespace, string> = {
  dev: '#3B82F6',
  staging: '#A855F7',
  monitoring: '#22D3EE',
  'kube-system': '#F59E0B',
}

const POD_STATE_COLORS: Record<PodState, string> = {
  running: '#22C55E',
  sleeping: '#6B7280',
  pending: '#F59E0B',
  failed: '#EF4444',
}

const PCB_BG = '#0a1a0a'
const PCB_GRID = '#0d250d'
const CHIP_BODY = '#1a1a24'
const CHIP_BORDER = '#22D3EE'
const SILKSCREEN = '#e8e8d0'
const TRACE_WIDTH_NODE = 2
const TRACE_WIDTH_POD = 1

const SVG_WIDTH = 1100
const SVG_HEIGHT = 700

// ─── Initial Data ────────────────────────────────────────────────────────────

function createInitialNodes(): NodeData[] {
  return [
    { id: 'node-1', designator: 'U1', name: 'node-1', instanceType: 'm5.xlarge', cpuPercent: 65, memPercent: 72, podCount: 12, x: 80, y: 120, width: 200, height: 140 },
    { id: 'node-2', designator: 'U2', name: 'node-2', instanceType: 'm5.2xlarge', cpuPercent: 45, memPercent: 58, podCount: 8, x: 440, y: 100, width: 220, height: 150 },
    { id: 'node-3', designator: 'U3', name: 'node-3', instanceType: 'c5.xlarge', cpuPercent: 28, memPercent: 35, podCount: 5, x: 820, y: 140, width: 180, height: 120 },
  ]
}

function createInitialWorkloads(): WorkloadData[] {
  return [
    { id: 'wl-api', designator: 'C1', name: 'api-server', kind: 'Deployment', namespace: 'dev', nodeId: 'node-1', replicas: 3, x: 50, y: 340, width: 120, height: 50 },
    { id: 'wl-web', designator: 'C2', name: 'web-frontend', kind: 'Deployment', namespace: 'dev', nodeId: 'node-1', replicas: 2, x: 190, y: 340, width: 120, height: 50 },
    { id: 'wl-redis', designator: 'C3', name: 'redis', kind: 'StatefulSet', namespace: 'dev', nodeId: 'node-1', replicas: 1, x: 50, y: 430, width: 120, height: 50 },
    { id: 'wl-worker', designator: 'C4', name: 'worker', kind: 'Deployment', namespace: 'dev', nodeId: 'node-2', replicas: 2, x: 190, y: 430, width: 120, height: 50 },
    { id: 'wl-checkout', designator: 'C5', name: 'checkout-svc', kind: 'Deployment', namespace: 'staging', nodeId: 'node-2', replicas: 2, x: 400, y: 330, width: 130, height: 50 },
    { id: 'wl-product', designator: 'C6', name: 'product-api', kind: 'Deployment', namespace: 'staging', nodeId: 'node-2', replicas: 3, x: 550, y: 330, width: 130, height: 50 },
    { id: 'wl-postgres', designator: 'C7', name: 'postgres', kind: 'StatefulSet', namespace: 'staging', nodeId: 'node-3', replicas: 1, x: 475, y: 420, width: 130, height: 50 },
    { id: 'wl-prom', designator: 'C8', name: 'prometheus', kind: 'StatefulSet', namespace: 'monitoring', nodeId: 'node-2', replicas: 1, x: 760, y: 330, width: 130, height: 50 },
    { id: 'wl-grafana', designator: 'C9', name: 'grafana', kind: 'Deployment', namespace: 'monitoring', nodeId: 'node-3', replicas: 1, x: 910, y: 330, width: 130, height: 50 },
    { id: 'wl-alertmgr', designator: 'C10', name: 'alertmanager', kind: 'Deployment', namespace: 'monitoring', nodeId: 'node-3', replicas: 1, x: 835, y: 420, width: 130, height: 50 },
    { id: 'wl-coredns', designator: 'C11', name: 'coredns', kind: 'Deployment', namespace: 'kube-system', nodeId: 'node-1', replicas: 2, x: 350, y: 530, width: 130, height: 50 },
    { id: 'wl-kubeproxy', designator: 'C12', name: 'kube-proxy', kind: 'DaemonSet', namespace: 'kube-system', nodeId: 'node-3', replicas: 3, x: 520, y: 530, width: 130, height: 50 },
  ]
}

function createInitialPods(workloads: WorkloadData[]): PodData[] {
  const pods: PodData[] = []
  let podIdx = 0
  for (const wl of workloads) {
    for (let i = 0; i < wl.replicas; i++) {
      pods.push({
        id: `pod-${podIdx}`,
        name: `${wl.name}-${randomSuffix()}`,
        workloadId: wl.id,
        state: 'running',
        cpu: Math.floor(Math.random() * 40 + 10),
        x: wl.x + 15 + i * 22,
        y: wl.y + wl.height + 16,
      })
      podIdx++
    }
  }
  return pods
}

function randomSuffix(): string {
  return Math.random().toString(36).substring(2, 7)
}

// ─── Manhattan Routing ───────────────────────────────────────────────────────

function manhattanPath(x1: number, y1: number, x2: number, y2: number): string {
  const midX = (x1 + x2) / 2
  return `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`
}

// ─── SVG Sub-Components ─────────────────────────────────────────────────────

function PinMarks({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  const pins: ReactElement[] = []
  const pinSpacing = 16
  const pinLength = 8
  const pinWidth = 2

  const topCount = Math.floor((width - 20) / pinSpacing)
  for (let i = 0; i < topCount; i++) {
    const px = x + 14 + i * pinSpacing
    pins.push(<rect key={`t${i}`} x={px} y={y - pinLength} width={pinWidth} height={pinLength} fill="#555" />)
    pins.push(<rect key={`b${i}`} x={px} y={y + height} width={pinWidth} height={pinLength} fill="#555" />)
  }

  const sideCount = Math.floor((height - 20) / pinSpacing)
  for (let i = 0; i < sideCount; i++) {
    const py = y + 14 + i * pinSpacing
    pins.push(<rect key={`l${i}`} x={x - pinLength} y={py} width={pinLength} height={pinWidth} fill="#555" />)
    pins.push(<rect key={`r${i}`} x={x + width} y={py} width={pinLength} height={pinWidth} fill="#555" />)
  }

  return <g className="pins">{pins}</g>
}

function ICChip({
  node,
  isHovered,
  onHover,
  onLeave,
}: {
  node: NodeData
  isHovered: boolean
  onHover: () => void
  onLeave: () => void
}) {
  const barWidth = node.width - 40
  const cpuBarW = barWidth * (node.cpuPercent / 100)
  const memBarW = barWidth * (node.memPercent / 100)
  const notchWidth = 12

  return (
    <g onMouseEnter={onHover} onMouseLeave={onLeave} style={{ cursor: 'pointer' }}>
      <PinMarks x={node.x} y={node.y} width={node.width} height={node.height} />
      <rect
        x={node.x}
        y={node.y}
        width={node.width}
        height={node.height}
        rx={4}
        fill={CHIP_BODY}
        stroke={isHovered ? CHIP_BORDER : `${CHIP_BORDER}40`}
        strokeWidth={isHovered ? 2 : 1}
      />
      {/* Orientation notch */}
      <circle cx={node.x + notchWidth} cy={node.y + notchWidth} r={4} fill="none" stroke="#444" strokeWidth={1} />
      {/* Designator */}
      <text x={node.x + node.width - 8} y={node.y + 14} textAnchor="end" fill={SILKSCREEN} fontSize={9} fontFamily="monospace" opacity={0.6}>
        {node.designator}
      </text>
      {/* Node name */}
      <text x={node.x + 20} y={node.y + 28} fill="#e2e8f0" fontSize={11} fontFamily="monospace" fontWeight="bold">
        {node.name}
      </text>
      <text x={node.x + 20} y={node.y + 42} fill="#94a3b8" fontSize={9} fontFamily="monospace">
        {node.instanceType}
      </text>
      {/* CPU bar */}
      <text x={node.x + 20} y={node.y + 62} fill="#94a3b8" fontSize={8} fontFamily="monospace">CPU</text>
      <rect x={node.x + 45} y={node.y + 55} width={barWidth} height={6} rx={2} fill="#1e293b" />
      <rect x={node.x + 45} y={node.y + 55} width={cpuBarW} height={6} rx={2} fill={node.cpuPercent > 80 ? '#EF4444' : '#22C55E'} />
      <text x={node.x + 48 + barWidth} y={node.y + 62} fill="#94a3b8" fontSize={8} fontFamily="monospace">
        {node.cpuPercent}%
      </text>
      {/* Mem bar */}
      <text x={node.x + 20} y={node.y + 80} fill="#94a3b8" fontSize={8} fontFamily="monospace">MEM</text>
      <rect x={node.x + 45} y={node.y + 73} width={barWidth} height={6} rx={2} fill="#1e293b" />
      <rect x={node.x + 45} y={node.y + 73} width={memBarW} height={6} rx={2} fill={node.memPercent > 80 ? '#EF4444' : '#3B82F6'} />
      <text x={node.x + 48 + barWidth} y={node.y + 80} fill="#94a3b8" fontSize={8} fontFamily="monospace">
        {node.memPercent}%
      </text>
      {/* Pod count */}
      <text x={node.x + 20} y={node.y + node.height - 16} fill="#94a3b8" fontSize={9} fontFamily="monospace">
        {node.podCount} pods
      </text>
    </g>
  )
}

function WorkloadComponent({
  wl,
  isSleeping,
  isHovered,
  onHover,
  onLeave,
}: {
  wl: WorkloadData
  isSleeping: boolean
  isHovered: boolean
  onHover: () => void
  onLeave: () => void
}) {
  const borderColor = NS_COLORS[wl.namespace]
  const opacity = isSleeping ? 0.3 : 1

  return (
    <g
      className={`workload-${wl.namespace}`}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      style={{ cursor: 'pointer' }}
      opacity={opacity}
    >
      <rect
        x={wl.x}
        y={wl.y}
        width={wl.width}
        height={wl.height}
        rx={3}
        fill="#12121c"
        stroke={isHovered ? borderColor : `${borderColor}80`}
        strokeWidth={isHovered ? 2 : 1}
      />
      {/* Designator */}
      <text x={wl.x + wl.width - 6} y={wl.y + 12} textAnchor="end" fill={SILKSCREEN} fontSize={7} fontFamily="monospace" opacity={0.5}>
        {wl.designator}
      </text>
      {/* Name */}
      <text x={wl.x + 8} y={wl.y + 16} fill="#e2e8f0" fontSize={9} fontFamily="monospace" fontWeight="bold">
        {wl.name}
      </text>
      {/* Kind badge */}
      <rect x={wl.x + 8} y={wl.y + 22} width={wl.kind.length * 5.5 + 6} height={12} rx={2} fill={`${borderColor}20`} />
      <text x={wl.x + 11} y={wl.y + 31} fill={borderColor} fontSize={7} fontFamily="monospace">
        {wl.kind}
      </text>
      {/* Replicas */}
      <text x={wl.x + 8} y={wl.y + wl.height - 6} fill="#64748b" fontSize={7} fontFamily="monospace">
        {wl.replicas}x
      </text>
      {/* Sleep indicator */}
      {isSleeping && (
        <text x={wl.x + wl.width - 24} y={wl.y + wl.height - 6} fill="#A855F7" fontSize={9} fontFamily="monospace">
          zzz
        </text>
      )}
    </g>
  )
}

function LEDPod({
  pod,
  isSleeping,
  isHovered,
  onHover,
  onLeave,
}: {
  pod: PodData
  isSleeping: boolean
  isHovered: boolean
  onHover: () => void
  onLeave: () => void
}) {
  const effectiveState = isSleeping ? 'sleeping' : pod.state
  const color = POD_STATE_COLORS[effectiveState]
  const isGlowing = effectiveState === 'running'

  return (
    <g onMouseEnter={onHover} onMouseLeave={onLeave} style={{ cursor: 'pointer' }} className={`led-${pod.id}`}>
      {isGlowing && (
        <circle cx={pod.x} cy={pod.y} r={10} fill={`${color}30`} className="led-glow" />
      )}
      <circle
        cx={pod.x}
        cy={pod.y}
        r={4}
        fill={color}
        stroke={isHovered ? '#fff' : 'none'}
        strokeWidth={1}
        opacity={isSleeping ? 0.3 : 1}
      />
    </g>
  )
}

function Trace({
  x1, y1, x2, y2,
  color,
  width,
  isActive,
  isSleeping,
  isHovered,
  onHover,
  onLeave,
  traceId,
}: {
  x1: number; y1: number; x2: number; y2: number
  color: string
  width: number
  isActive: boolean
  isSleeping: boolean
  isHovered: boolean
  onHover: () => void
  onLeave: () => void
  traceId: string
}) {
  const d = manhattanPath(x1, y1, x2, y2)
  const dimColor = isSleeping ? '#333' : color

  return (
    <g onMouseEnter={onHover} onMouseLeave={onLeave} style={{ cursor: 'pointer' }}>
      {/* Hit area */}
      <path d={d} fill="none" stroke="transparent" strokeWidth={10} />
      {/* Trace line */}
      <path
        d={d}
        fill="none"
        stroke={isHovered ? color : `${dimColor}60`}
        strokeWidth={isHovered ? width + 1 : width}
        className={`trace-${traceId}`}
      />
      {/* Current flow dot */}
      {isActive && !isSleeping && (
        <circle r={2.5} fill={color}>
          <animateMotion dur="2s" repeatCount="indefinite" path={d} />
        </circle>
      )}
    </g>
  )
}

// ─── Cosmetic elements ───────────────────────────────────────────────────────

function TestPoints() {
  const points = [
    { x: 30, y: 620, label: 'TP1' },
    { x: 700, y: 90, label: 'TP2' },
    { x: 1040, y: 600, label: 'TP3' },
  ]
  return (
    <g>
      {points.map((tp) => (
        <g key={tp.label}>
          <circle cx={tp.x} cy={tp.y} r={4} fill="none" stroke={`${SILKSCREEN}40`} strokeWidth={1} />
          <circle cx={tp.x} cy={tp.y} r={1.5} fill={`${SILKSCREEN}30`} />
          <text x={tp.x + 8} y={tp.y + 3} fill={`${SILKSCREEN}40`} fontSize={7} fontFamily="monospace">{tp.label}</text>
        </g>
      ))}
    </g>
  )
}

function Vias() {
  const vias = [
    { x: 340, y: 290 },
    { x: 710, y: 290 },
    { x: 340, y: 500 },
    { x: 710, y: 500 },
    { x: 180, y: 500 },
    { x: 900, y: 500 },
  ]
  return (
    <g>
      {vias.map((v, i) => (
        <g key={i}>
          <circle cx={v.x} cy={v.y} r={5} fill="#1a2a1a" stroke="#2a3a2a" strokeWidth={1} />
          <circle cx={v.x} cy={v.y} r={2} fill="#2a3a2a" />
        </g>
      ))}
    </g>
  )
}

function SilkscreenLabels({ sleepingNamespaces }: { sleepingNamespaces: Set<Namespace> }) {
  const labels: { text: string; x: number; y: number; ns: Namespace }[] = [
    { text: 'DEV', x: 120, y: 318, ns: 'dev' },
    { text: 'STAGING', x: 500, y: 308, ns: 'staging' },
    { text: 'MONITORING', x: 850, y: 308, ns: 'monitoring' },
    { text: 'KUBE-SYSTEM', x: 430, y: 518, ns: 'kube-system' },
  ]
  return (
    <g>
      {labels.map((l) => (
        <text
          key={l.text}
          x={l.x}
          y={l.y}
          fill={SILKSCREEN}
          fontSize={10}
          fontFamily="monospace"
          fontWeight="bold"
          letterSpacing={2}
          opacity={sleepingNamespaces.has(l.ns) ? 0.2 : 0.5}
        >
          {l.text}
        </text>
      ))}
    </g>
  )
}

function BoardTitle() {
  return (
    <g>
      <text x={30} y={30} fill={SILKSCREEN} fontSize={12} fontFamily="monospace" fontWeight="bold" letterSpacing={3} opacity={0.4}>
        KUBE-PHOENIX CLUSTER REV 3.1
      </text>
      <text x={30} y={690} fill={SILKSCREEN} fontSize={8} fontFamily="monospace" opacity={0.25}>
        PCB-2026-04 | LAYER: 4 | MATERIAL: FR-4
      </text>
    </g>
  )
}

function BoardEdge() {
  return (
    <rect
      x={8}
      y={8}
      width={SVG_WIDTH - 16}
      height={SVG_HEIGHT - 16}
      rx={8}
      fill="none"
      stroke="#1a3a1a"
      strokeWidth={2}
      strokeDasharray="4 2"
    />
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function TopologyCircuitPage() {
  const router = useRouter()
  const svgRef = useRef<SVGSVGElement>(null)
  const simulationRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [nodes, setNodes] = useState<NodeData[]>(createInitialNodes)
  const [workloads] = useState<WorkloadData[]>(createInitialWorkloads)
  const [pods, setPods] = useState<PodData[]>(() => createInitialPods(createInitialWorkloads()))
  const [sleepingNamespaces, setSleepingNamespaces] = useState<Set<Namespace>>(new Set())
  const [isSimulating, setIsSimulating] = useState(true)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [tickCount, setTickCount] = useState(0)

  const workloadsByNode = useMemo(() => {
    const map = new Map<string, WorkloadData[]>()
    for (const wl of workloads) {
      const existing = map.get(wl.nodeId) ?? []
      existing.push(wl)
      map.set(wl.nodeId, existing)
    }
    return map
  }, [workloads])

  const podsByWorkload = useMemo(() => {
    const map = new Map<string, PodData[]>()
    for (const p of pods) {
      const existing = map.get(p.workloadId) ?? []
      existing.push(p)
      map.set(p.workloadId, existing)
    }
    return map
  }, [pods])

  const totalPods = pods.length
  const runningPods = pods.filter((p) => p.state === 'running' && !sleepingNamespaces.has(workloads.find((w) => w.id === p.workloadId)!.namespace)).length
  const sleepingPods = pods.filter((p) => sleepingNamespaces.has(workloads.find((w) => w.id === p.workloadId)!.namespace)).length

  // ─── Sleep/Wake animations ────────────────────────────────────────────────

  const sleepNamespace = useCallback((ns: Namespace) => {
    setSleepingNamespaces((prev) => new Set(prev).add(ns))

    const nsPods = pods.filter((p) => workloads.find((w) => w.id === p.workloadId)?.namespace === ns)
    nsPods.forEach((pod, i) => {
      const el = svgRef.current?.querySelector(`.led-${pod.id} circle:last-child`)
      if (el) {
        gsap.to(el, { opacity: 0.2, duration: 0.3, delay: i * 0.1 })
      }
      const glowEl = svgRef.current?.querySelector(`.led-${pod.id} .led-glow`)
      if (glowEl) {
        gsap.to(glowEl, { opacity: 0, duration: 0.3, delay: i * 0.1 })
      }
    })
  }, [pods, workloads])

  const wakeNamespace = useCallback((ns: Namespace) => {
    setSleepingNamespaces((prev) => {
      const next = new Set(prev)
      next.delete(ns)
      return next
    })

    const nsPods = pods.filter((p) => workloads.find((w) => w.id === p.workloadId)?.namespace === ns)
    nsPods.forEach((pod, i) => {
      const el = svgRef.current?.querySelector(`.led-${pod.id} circle:last-child`)
      if (el) {
        gsap.to(el, { opacity: 1, duration: 0.3, delay: i * 0.1 })
      }
      const glowEl = svgRef.current?.querySelector(`.led-${pod.id} .led-glow`)
      if (glowEl) {
        gsap.to(glowEl, { opacity: 1, duration: 0.3, delay: i * 0.1 })
      }
    })
  }, [pods, workloads])

  // ─── Simulation ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isSimulating) {
      if (simulationRef.current) clearInterval(simulationRef.current)
      return
    }

    simulationRef.current = setInterval(() => {
      setTickCount((t) => t + 1)

      setPods((prev) => {
        const next = [...prev]
        const awakeIndices = next
          .map((p, i) => ({ p, i }))
          .filter(({ p }) => !sleepingNamespaces.has(workloads.find((w) => w.id === p.workloadId)!.namespace))

        if (awakeIndices.length === 0) return next

        const target = awakeIndices[Math.floor(Math.random() * awakeIndices.length)]
        const pod = { ...target.p }

        if (pod.state === 'running') {
          pod.state = Math.random() > 0.15 ? 'pending' : 'failed'
        } else {
          pod.state = 'running'
        }
        pod.cpu = Math.floor(Math.random() * 60 + 5)
        next[target.i] = pod
        return next
      })

      setNodes((prev) =>
        prev.map((n) => ({
          ...n,
          cpuPercent: Math.max(5, Math.min(95, n.cpuPercent + Math.floor(Math.random() * 11 - 5))),
          memPercent: Math.max(10, Math.min(90, n.memPercent + Math.floor(Math.random() * 7 - 3))),
        })),
      )
    }, 2000)

    return () => {
      if (simulationRef.current) clearInterval(simulationRef.current)
    }
  }, [isSimulating, sleepingNamespaces, workloads])

  const handleReset = useCallback(() => {
    setNodes(createInitialNodes())
    setPods(createInitialPods(workloads))
    setSleepingNamespaces(new Set())
    setIsSimulating(true)
    setTickCount(0)
  }, [workloads])

  // ─── Trace data ────────────────────────────────────────────────────────────

  const nodeToWorkloadTraces = useMemo(() => {
    return workloads.map((wl) => {
      const node = nodes.find((n) => n.id === wl.nodeId)!
      return {
        id: `trace-n2w-${wl.id}`,
        x1: node.x + node.width / 2,
        y1: node.y + node.height,
        x2: wl.x + wl.width / 2,
        y2: wl.y,
        color: NS_COLORS[wl.namespace],
        width: TRACE_WIDTH_NODE,
        namespace: wl.namespace,
        workloadId: wl.id,
      }
    })
  }, [workloads, nodes])

  const workloadToPodTraces = useMemo(() => {
    return pods.map((pod) => {
      const wl = workloads.find((w) => w.id === pod.workloadId)!
      return {
        id: `trace-w2p-${pod.id}`,
        x1: wl.x + wl.width / 2,
        y1: wl.y + wl.height,
        x2: pod.x,
        y2: pod.y - 5,
        color: NS_COLORS[wl.namespace],
        width: TRACE_WIDTH_POD,
        namespace: wl.namespace,
        workloadId: wl.id,
        podId: pod.id,
      }
    })
  }, [pods, workloads])

  // ─── Hover tooltip content ─────────────────────────────────────────────────

  function getTooltipContent(itemId: string): string {
    const node = nodes.find((n) => n.id === itemId)
    if (node) return `${node.name} (${node.instanceType})\nCPU: ${node.cpuPercent}% | MEM: ${node.memPercent}%\nPods: ${node.podCount}`

    const wl = workloads.find((w) => w.id === itemId)
    if (wl) return `${wl.name} (${wl.kind})\nNamespace: ${wl.namespace}\nReplicas: ${wl.replicas}`

    const pod = pods.find((p) => p.id === itemId)
    if (pod) {
      const parentWl = workloads.find((w) => w.id === pod.workloadId)!
      const isSleeping = sleepingNamespaces.has(parentWl.namespace)
      return `${pod.name}\nState: ${isSleeping ? 'sleeping' : pod.state}\nCPU: ${pod.cpu}m`
    }

    return ''
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#060d06', p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography variant="h6" sx={{ fontFamily: 'monospace', color: SILKSCREEN }}>
          G3-v7 &mdash; Circuit Board
        </Typography>
      </Box>

      {/* Controls */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2, alignItems: 'center' }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={isSimulating ? <PauseIcon /> : <PlayArrowIcon />}
          onClick={() => setIsSimulating(!isSimulating)}
        >
          {isSimulating ? 'Pause' : 'Simulate'}
        </Button>
        <Button size="small" variant="outlined" startIcon={<ReplayIcon />} onClick={handleReset}>
          Reset
        </Button>

        {sleepingNamespaces.has('staging') ? (
          <Button size="small" variant="outlined" color="success" startIcon={<WbSunnyIcon />} onClick={() => wakeNamespace('staging')}>
            Wake staging
          </Button>
        ) : (
          <Button size="small" variant="outlined" color="secondary" startIcon={<BedtimeIcon />} onClick={() => sleepNamespace('staging')}>
            Sleep staging
          </Button>
        )}

        {sleepingNamespaces.has('dev') ? (
          <Button size="small" variant="outlined" color="success" startIcon={<WbSunnyIcon />} onClick={() => wakeNamespace('dev')}>
            Wake dev
          </Button>
        ) : (
          <Button size="small" variant="outlined" color="secondary" startIcon={<BedtimeIcon />} onClick={() => sleepNamespace('dev')}>
            Sleep dev
          </Button>
        )}

        <Box sx={{ flex: 1 }} />

        <Chip label={`${totalPods} pods`} size="small" variant="outlined" />
        <Chip label={`${runningPods} running`} size="small" color="success" variant="outlined" />
        <Chip label={`${sleepingPods} sleeping`} size="small" color="secondary" variant="outlined" />
        <Chip label={`tick ${tickCount}`} size="small" variant="outlined" sx={{ fontFamily: 'monospace' }} />
      </Box>

      {/* SVG Canvas */}
      <Box
        sx={{
          borderRadius: 2,
          overflow: 'hidden',
          border: '1px solid #1a3a1a',
          background: `
            ${PCB_BG}
          `,
          position: 'relative',
        }}
      >
        {/* PCB grid pattern via CSS overlay */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            backgroundImage: `
              repeating-linear-gradient(0deg, ${PCB_GRID} 0px, ${PCB_GRID} 1px, transparent 1px, transparent 20px),
              repeating-linear-gradient(90deg, ${PCB_GRID} 0px, ${PCB_GRID} 1px, transparent 1px, transparent 20px)
            `,
            zIndex: 1,
            opacity: 0.5,
          }}
        />
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          width="100%"
          style={{ display: 'block', position: 'relative', zIndex: 2 }}
        >
          <defs>
            {/* LED glow filter */}
            <filter id="led-glow-green">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <BoardEdge />
          <BoardTitle />
          <Vias />
          <TestPoints />
          <SilkscreenLabels sleepingNamespaces={sleepingNamespaces} />

          {/* Traces: node → workload */}
          {nodeToWorkloadTraces.map((t) => {
            const isSleeping = sleepingNamespaces.has(t.namespace)
            const isTraceHovered = hoveredItem === t.id || hoveredItem === t.workloadId
            return (
              <Trace
                key={t.id}
                traceId={t.id}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                color={t.color}
                width={t.width}
                isActive={!isSleeping}
                isSleeping={isSleeping}
                isHovered={isTraceHovered}
                onHover={() => setHoveredItem(t.id)}
                onLeave={() => setHoveredItem(null)}
              />
            )
          })}

          {/* Traces: workload → pod */}
          {workloadToPodTraces.map((t) => {
            const isSleeping = sleepingNamespaces.has(t.namespace)
            const isTraceHovered = hoveredItem === t.id || hoveredItem === t.workloadId || hoveredItem === t.podId
            return (
              <Trace
                key={t.id}
                traceId={t.id}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                color={t.color}
                width={t.width}
                isActive={!isSleeping}
                isSleeping={isSleeping}
                isHovered={isTraceHovered}
                onHover={() => setHoveredItem(t.id)}
                onLeave={() => setHoveredItem(null)}
              />
            )
          })}

          {/* IC Chips (Nodes) */}
          {nodes.map((node) => (
            <Tooltip
              key={node.id}
              title={<span style={{ whiteSpace: 'pre-line', fontFamily: 'monospace', fontSize: 11 }}>{getTooltipContent(node.id)}</span>}
              arrow
              placement="top"
            >
              <g>
                <ICChip
                  node={node}
                  isHovered={hoveredItem === node.id}
                  onHover={() => setHoveredItem(node.id)}
                  onLeave={() => setHoveredItem(null)}
                />
              </g>
            </Tooltip>
          ))}

          {/* Workload Components */}
          {workloads.map((wl) => {
            const isSleeping = sleepingNamespaces.has(wl.namespace)
            return (
              <Tooltip
                key={wl.id}
                title={<span style={{ whiteSpace: 'pre-line', fontFamily: 'monospace', fontSize: 11 }}>{getTooltipContent(wl.id)}</span>}
                arrow
                placement="top"
              >
                <g>
                  <WorkloadComponent
                    wl={wl}
                    isSleeping={isSleeping}
                    isHovered={hoveredItem === wl.id}
                    onHover={() => setHoveredItem(wl.id)}
                    onLeave={() => setHoveredItem(null)}
                  />
                </g>
              </Tooltip>
            )
          })}

          {/* LED Pods */}
          {pods.map((pod) => {
            const wl = workloads.find((w) => w.id === pod.workloadId)!
            const isSleeping = sleepingNamespaces.has(wl.namespace)
            return (
              <Tooltip
                key={pod.id}
                title={<span style={{ whiteSpace: 'pre-line', fontFamily: 'monospace', fontSize: 11 }}>{getTooltipContent(pod.id)}</span>}
                arrow
                placement="bottom"
              >
                <g>
                  <LEDPod
                    pod={pod}
                    isSleeping={isSleeping}
                    isHovered={hoveredItem === pod.id}
                    onHover={() => setHoveredItem(pod.id)}
                    onLeave={() => setHoveredItem(null)}
                  />
                </g>
              </Tooltip>
            )
          })}
        </svg>
      </Box>

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 3, mt: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" sx={{ color: '#64748b', fontFamily: 'monospace', mr: 1 }}>Namespaces:</Typography>
          {(Object.entries(NS_COLORS) as [Namespace, string][]).map(([ns, color]) => (
            <Chip key={ns} label={ns} size="small" sx={{ fontSize: 10, fontFamily: 'monospace', borderColor: color, color }} variant="outlined" />
          ))}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ color: '#64748b', fontFamily: 'monospace', mr: 1 }}>Pods:</Typography>
          {(Object.entries(POD_STATE_COLORS) as [PodState, string][]).map(([state, color]) => (
            <Box key={state} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, boxShadow: state === 'running' ? `0 0 6px 2px ${color}60` : 'none' }} />
              <Typography variant="caption" sx={{ color: '#64748b', fontFamily: 'monospace', fontSize: 10 }}>{state}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}
