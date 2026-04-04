'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import { useRouter } from 'next/navigation'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PodStatus = 'running' | 'pending' | 'failed' | 'sleeping'

interface PodState {
  name: string
  status: PodStatus
  cpu: number
  memory: number
}

interface HexState {
  workload: string
  namespace: string
  kind: 'Deployment' | 'StatefulSet'
  cx: number
  cy: number
  radius: number
  baseRadius: number
  pods: PodState[]
  sleeping: boolean
  animProgress: number
  highlighted: boolean
  gridCol: number
  gridRow: number
}

interface NamespaceTerritory {
  name: string
  color: string
  hexIndices: number[]
  sleeping: boolean
  sleepProgress: number
  labelX: number
  labelY: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_FILL: Record<string, string> = {
  allRunning: '#22C55E',
  mixed: '#F59E0B',
  anyFailed: '#EF4444',
  sleeping: '#2A2A35',
}

const NAMESPACE_COLORS: Record<string, string> = {
  production: '#3B82F6',
  staging: '#A855F7',
  dev: '#F59E0B',
  monitoring: '#06B6D4',
  'kube-system': '#EF4444',
}

function radiusForReplicas(count: number): number {
  if (count <= 1) return 28
  if (count === 2) return 34
  return 40
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

interface WorkloadDef {
  name: string
  namespace: string
  kind: 'Deployment' | 'StatefulSet'
  replicas: number
}

const WORKLOAD_DEFS: WorkloadDef[] = [
  // production (8)
  { name: 'api-gateway', namespace: 'production', kind: 'Deployment', replicas: 3 },
  { name: 'web-frontend', namespace: 'production', kind: 'Deployment', replicas: 3 },
  { name: 'auth-service', namespace: 'production', kind: 'Deployment', replicas: 2 },
  { name: 'order-service', namespace: 'production', kind: 'Deployment', replicas: 2 },
  { name: 'payment-svc', namespace: 'production', kind: 'Deployment', replicas: 2 },
  { name: 'notification', namespace: 'production', kind: 'Deployment', replicas: 1 },
  { name: 'postgres', namespace: 'production', kind: 'StatefulSet', replicas: 3 },
  { name: 'redis-cluster', namespace: 'production', kind: 'StatefulSet', replicas: 3 },
  // staging (6)
  { name: 'api-gateway', namespace: 'staging', kind: 'Deployment', replicas: 2 },
  { name: 'web-frontend', namespace: 'staging', kind: 'Deployment', replicas: 2 },
  { name: 'auth-service', namespace: 'staging', kind: 'Deployment', replicas: 1 },
  { name: 'order-service', namespace: 'staging', kind: 'Deployment', replicas: 1 },
  { name: 'postgres', namespace: 'staging', kind: 'StatefulSet', replicas: 2 },
  { name: 'redis', namespace: 'staging', kind: 'StatefulSet', replicas: 1 },
  // dev (4)
  { name: 'api-gateway', namespace: 'dev', kind: 'Deployment', replicas: 1 },
  { name: 'web-frontend', namespace: 'dev', kind: 'Deployment', replicas: 1 },
  { name: 'postgres', namespace: 'dev', kind: 'StatefulSet', replicas: 1 },
  { name: 'debug-tool', namespace: 'dev', kind: 'Deployment', replicas: 1 },
  // monitoring (4)
  { name: 'prometheus', namespace: 'monitoring', kind: 'StatefulSet', replicas: 2 },
  { name: 'grafana', namespace: 'monitoring', kind: 'Deployment', replicas: 1 },
  { name: 'alertmanager', namespace: 'monitoring', kind: 'Deployment', replicas: 2 },
  { name: 'loki', namespace: 'monitoring', kind: 'StatefulSet', replicas: 1 },
  // kube-system (3)
  { name: 'coredns', namespace: 'kube-system', kind: 'Deployment', replicas: 2 },
  { name: 'etcd', namespace: 'kube-system', kind: 'StatefulSet', replicas: 3 },
  { name: 'kube-proxy', namespace: 'kube-system', kind: 'Deployment', replicas: 1 },
]

// ---------------------------------------------------------------------------
// Hex math
// ---------------------------------------------------------------------------

function hexCorners(cx: number, cy: number, r: number): [number, number][] {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as [number, number]
  })
}

function pointInHex(px: number, py: number, cx: number, cy: number, r: number): boolean {
  const dx = Math.abs(px - cx)
  const dy = Math.abs(py - cy)
  const s = r * Math.sqrt(3) / 2
  if (dx > r || dy > s) return false
  return r * s - s * dx - (r / 2) * dy >= 0
}

function hexCenter(col: number, row: number, r: number): { x: number; y: number } {
  const w = r * 2
  const h = r * Math.sqrt(3)
  const x = col * (w * 0.75)
  const y = row * h + (col % 2 !== 0 ? h / 2 : 0)
  return { x, y }
}

// ---------------------------------------------------------------------------
// Build initial hex layout
// ---------------------------------------------------------------------------

interface NamespaceOrigin {
  col: number
  row: number
}

const NAMESPACE_ORIGINS: Record<string, NamespaceOrigin> = {
  monitoring: { col: 1, row: 0 },
  'kube-system': { col: 8, row: 0 },
  production: { col: 3, row: 3 },
  staging: { col: 8, row: 4 },
  dev: { col: 4, row: 7 },
}

function arrangeHexesInTerritory(
  count: number,
  origin: NamespaceOrigin,
): { col: number; row: number }[] {
  const positions: { col: number; row: number }[] = []
  const visited = new Set<string>()
  const queue: { col: number; row: number }[] = [{ col: origin.col, row: origin.row }]
  visited.add(`${origin.col},${origin.row}`)

  while (positions.length < count && queue.length > 0) {
    const cur = queue.shift()!
    positions.push(cur)

    const neighbors = getHexNeighbors(cur.col, cur.row)
    for (const n of neighbors) {
      const key = `${n.col},${n.row}`
      if (!visited.has(key)) {
        visited.add(key)
        queue.push(n)
      }
    }
  }
  return positions
}

function getHexNeighbors(col: number, row: number): { col: number; row: number }[] {
  const even = col % 2 === 0
  return [
    { col: col + 1, row: even ? row - 1 : row },
    { col: col + 1, row: even ? row : row + 1 },
    { col: col - 1, row: even ? row - 1 : row },
    { col: col - 1, row: even ? row : row + 1 },
    { col, row: row - 1 },
    { col, row: row + 1 },
  ]
}

function buildInitialState(): { hexes: HexState[]; territories: NamespaceTerritory[] } {
  const hexes: HexState[] = []
  const territories: NamespaceTerritory[] = []
  const namespaceGroups = new Map<string, WorkloadDef[]>()

  for (const w of WORKLOAD_DEFS) {
    if (!namespaceGroups.has(w.namespace)) namespaceGroups.set(w.namespace, [])
    namespaceGroups.get(w.namespace)!.push(w)
  }

  const baseHexRadius = 36

  for (const [ns, workloads] of namespaceGroups) {
    const origin = NAMESPACE_ORIGINS[ns] ?? { col: 0, row: 0 }
    const gridPositions = arrangeHexesInTerritory(workloads.length, origin)
    const hexIndices: number[] = []

    for (let i = 0; i < workloads.length; i++) {
      const w = workloads[i]
      const gp = gridPositions[i]
      const r = radiusForReplicas(w.replicas)
      const center = hexCenter(gp.col, gp.row, baseHexRadius)

      const pods: PodState[] = Array.from({ length: w.replicas }, (_, pi) => ({
        name: `${w.name}-${randomId()}`,
        status: 'running' as PodStatus,
        cpu: 10 + Math.random() * 80,
        memory: 50 + Math.random() * 200,
      }))

      hexIndices.push(hexes.length)
      hexes.push({
        workload: w.name,
        namespace: ns,
        kind: w.kind,
        cx: center.x,
        cy: center.y,
        radius: r,
        baseRadius: r,
        pods,
        sleeping: false,
        animProgress: 0,
        highlighted: false,
        gridCol: gp.col,
        gridRow: gp.row,
      })
    }

    const nsHexes = hexIndices.map(idx => hexes[idx])
    const avgX = nsHexes.reduce((s, h) => s + h.cx, 0) / nsHexes.length
    const minY = Math.min(...nsHexes.map(h => h.cy))

    territories.push({
      name: ns,
      color: NAMESPACE_COLORS[ns] ?? '#888888',
      hexIndices,
      sleeping: false,
      sleepProgress: 0,
      labelX: avgX,
      labelY: minY - baseHexRadius * 1.6,
    })
  }

  return { hexes, territories }
}

function randomId(): string {
  return Math.random().toString(36).substring(2, 7)
}

// ---------------------------------------------------------------------------
// Hex fill color
// ---------------------------------------------------------------------------

function hexFillColor(hex: HexState): string {
  if (hex.sleeping && hex.animProgress >= 1) return STATUS_FILL.sleeping
  const statuses = hex.pods.map(p => p.status)
  if (statuses.some(s => s === 'failed')) return STATUS_FILL.anyFailed
  if (statuses.some(s => s === 'pending')) return STATUS_FILL.mixed
  if (statuses.every(s => s === 'sleeping')) return STATUS_FILL.sleeping
  return STATUS_FILL.allRunning
}

function lerpColor(a: string, b: string, t: number): string {
  const parseHex = (h: string) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ]
  const ca = parseHex(a)
  const cb = parseHex(b)
  const r = Math.round(ca[0] + (cb[0] - ca[0]) * t)
  const g = Math.round(ca[1] + (cb[1] - ca[1]) * t)
  const bl = Math.round(ca[2] + (cb[2] - ca[2]) * t)
  return `rgb(${r},${g},${bl})`
}

function brightenColor(color: string, factor: number): string {
  let r: number, g: number, b: number
  if (color.startsWith('#')) {
    r = parseInt(color.slice(1, 3), 16)
    g = parseInt(color.slice(3, 5), 16)
    b = parseInt(color.slice(5, 7), 16)
  } else {
    const m = color.match(/\d+/g)
    if (!m) return color
    ;[r, g, b] = m.map(Number)
  }
  return `rgb(${Math.min(255, Math.round(r * factor))},${Math.min(255, Math.round(g * factor))},${Math.min(255, Math.round(b * factor))})`
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function drawHexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const corners = hexCorners(cx, cy, r)
  ctx.beginPath()
  ctx.moveTo(corners[0][0], corners[0][1])
  for (let i = 1; i < 6; i++) ctx.lineTo(corners[i][0], corners[i][1])
  ctx.closePath()
}

function drawHex(
  ctx: CanvasRenderingContext2D,
  hex: HexState,
  time: number,
  isHovered: boolean,
  highlightedNs: string | null,
) {
  const dimmed = highlightedNs !== null && hex.namespace !== highlightedNs

  let fillBase = hexFillColor(hex)

  if (hex.sleeping && hex.animProgress > 0 && hex.animProgress < 1) {
    const t = hex.animProgress
    const originalColor = hexFillColor({ ...hex, sleeping: false, animProgress: 0, pods: hex.pods.map(p => ({ ...p, status: 'running' })) })
    if (t < 0.3) {
      fillBase = lerpColor(originalColor, '#F59E0B', t / 0.3)
    } else {
      fillBase = lerpColor('#F59E0B', STATUS_FILL.sleeping, (t - 0.3) / 0.7)
    }
  }

  if (!hex.sleeping && hex.animProgress > 0 && hex.animProgress < 1) {
    const t = hex.animProgress
    if (t < 0.3) {
      fillBase = lerpColor(STATUS_FILL.sleeping, '#F59E0B', t / 0.3)
    } else {
      fillBase = lerpColor('#F59E0B', STATUS_FILL.allRunning, (t - 0.3) / 0.7)
    }
  }

  const animShrink = hex.sleeping
    ? 1 - 0.1 * Math.min(hex.animProgress, 1)
    : hex.animProgress > 0 && hex.animProgress < 1
      ? 0.9 + 0.1 * hex.animProgress
      : 1

  const drawR = hex.baseRadius * animShrink * (isHovered ? 1.08 : 1)

  ctx.save()

  if (dimmed) ctx.globalAlpha = 0.35

  // Territory glow for running hexes
  if (!hex.sleeping && hex.animProgress <= 0) {
    const pulse = 0.6 + 0.4 * Math.sin(time * 0.001 + hex.cx * 0.01)
    const grd = ctx.createRadialGradient(hex.cx, hex.cy, drawR * 0.2, hex.cx, hex.cy, drawR * 1.3)
    grd.addColorStop(0, `rgba(34,197,94,${0.08 * pulse})`)
    grd.addColorStop(1, 'rgba(34,197,94,0)')
    ctx.fillStyle = grd
    drawHexPath(ctx, hex.cx, hex.cy, drawR * 1.3)
    ctx.fill()
  }

  // Main hex fill with radial gradient
  drawHexPath(ctx, hex.cx, hex.cy, drawR)
  const grd = ctx.createRadialGradient(hex.cx, hex.cy, 0, hex.cx, hex.cy, drawR)
  grd.addColorStop(0, brightenColor(fillBase, 1.3))
  grd.addColorStop(1, fillBase)
  ctx.fillStyle = grd
  ctx.fill()

  // Border
  ctx.strokeStyle = isHovered
    ? '#FFFFFF'
    : hex.sleeping
      ? '#444455'
      : brightenColor(fillBase, 1.5)
  ctx.lineWidth = isHovered ? 3 : 2
  ctx.stroke()

  // Shockwave ring during sleep animation
  if (hex.sleeping && hex.animProgress > 0.1 && hex.animProgress < 0.6) {
    const waveT = (hex.animProgress - 0.1) / 0.5
    const waveR = drawR * (1 + waveT * 1.5)
    const waveAlpha = 0.6 * (1 - waveT)
    ctx.beginPath()
    ctx.arc(hex.cx, hex.cy, waveR, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(168,85,247,${waveAlpha})`
    ctx.lineWidth = 2
    ctx.stroke()
  }

  // Wake golden flash
  if (!hex.sleeping && hex.animProgress > 0.2 && hex.animProgress < 0.5) {
    const flashT = (hex.animProgress - 0.2) / 0.3
    const flashAlpha = 0.5 * (1 - flashT)
    const flashR = drawR * (1 + flashT)
    ctx.beginPath()
    ctx.arc(hex.cx, hex.cy, flashR, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(251,191,36,${flashAlpha})`
    ctx.lineWidth = 3
    ctx.stroke()
  }

  // Pod dots inside
  const activePods = hex.sleeping && hex.animProgress >= 1
    ? []
    : hex.pods
  const podCount = activePods.length

  if (podCount > 0) {
    const dotR = drawR * 0.3
    const podDotSize = Math.min(4, drawR * 0.1)

    for (let i = 0; i < podCount; i++) {
      const pod = activePods[i]
      const angle = (Math.PI * 2 * i) / podCount - Math.PI / 2
      const px = hex.cx + dotR * Math.cos(angle)
      const py = hex.cy + dotR * Math.sin(angle) - 2

      let dotColor = '#22C55E'
      if (pod.status === 'pending') dotColor = '#F59E0B'
      else if (pod.status === 'failed') dotColor = '#EF4444'
      else if (pod.status === 'sleeping') dotColor = '#555566'

      const podPulse = pod.status === 'running'
        ? 1 + 0.2 * Math.sin(time * 0.003 + i * 1.5)
        : 1

      // Fade out pods during sleep
      let podAlpha = 1
      if (hex.sleeping && hex.animProgress > 0) {
        podAlpha = Math.max(0, 1 - hex.animProgress * 2)
      }
      // Fade in pods during wake
      if (!hex.sleeping && hex.animProgress > 0 && hex.animProgress < 1) {
        podAlpha = Math.min(1, hex.animProgress * 2)
      }

      ctx.globalAlpha = (dimmed ? 0.35 : 1) * podAlpha
      ctx.beginPath()
      ctx.arc(px, py, podDotSize * podPulse, 0, Math.PI * 2)
      ctx.fillStyle = dotColor
      ctx.fill()
    }
    ctx.globalAlpha = dimmed ? 0.35 : 1
  }

  // Workload name
  ctx.fillStyle = hex.sleeping && hex.animProgress >= 1 ? '#666677' : '#E2E8F0'
  ctx.font = `${Math.max(8, drawR * 0.28)}px Inter, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const label = hex.workload.length > 10 ? hex.workload.slice(0, 9) + '..' : hex.workload
  ctx.fillText(label, hex.cx, hex.cy + drawR * 0.35)

  // Replica count
  const runningPods = hex.pods.filter(p => p.status === 'running' || p.status === 'pending').length
  const replicaText = hex.sleeping && hex.animProgress >= 1
    ? `0/${hex.pods.length}`
    : `${runningPods}/${hex.pods.length}`
  ctx.font = `bold ${Math.max(9, drawR * 0.3)}px Inter, sans-serif`
  ctx.fillText(replicaText, hex.cx, hex.cy + drawR * 0.6)

  // Kind indicator
  const kindChar = hex.kind === 'Deployment' ? 'D' : 'S'
  ctx.font = `bold ${Math.max(7, drawR * 0.22)}px Inter, sans-serif`
  ctx.textAlign = 'right'
  ctx.fillStyle = hex.sleeping ? '#555566' : '#94A3B8'
  ctx.fillText(kindChar, hex.cx + drawR * 0.7, hex.cy - drawR * 0.5)

  // Moon icon for fully sleeping hex
  if (hex.sleeping && hex.animProgress >= 1) {
    ctx.font = `${drawR * 0.35}px Inter, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillStyle = '#7C3AED'
    ctx.fillText('\u263D', hex.cx, hex.cy - drawR * 0.15)
  }

  ctx.restore()
}

function drawTerritoryOutline(
  ctx: CanvasRenderingContext2D,
  hexes: HexState[],
  territory: NamespaceTerritory,
  highlightedNs: string | null,
) {
  const tHexes = territory.hexIndices.map(i => hexes[i])
  if (tHexes.length === 0) return

  const dimmed = highlightedNs !== null && territory.name !== highlightedNs

  ctx.save()
  if (dimmed) ctx.globalAlpha = 0.25

  // Territory background
  const padding = 20
  const minX = Math.min(...tHexes.map(h => h.cx - h.baseRadius)) - padding
  const maxX = Math.max(...tHexes.map(h => h.cx + h.baseRadius)) + padding
  const minY = Math.min(...tHexes.map(h => h.cy - h.baseRadius)) - padding
  const maxY = Math.max(...tHexes.map(h => h.cy + h.baseRadius)) + padding

  // Convex hull outline using circles around each hex
  ctx.beginPath()
  for (const h of tHexes) {
    const corners = hexCorners(h.cx, h.cy, h.baseRadius + 8)
    for (const [x, y] of corners) {
      ctx.lineTo(x, y)
    }
  }
  ctx.closePath()

  // Subtle territory fill
  const fillColor = territory.color
  ctx.fillStyle = fillColor + '08'
  ctx.fill()

  // Glowing border
  if (territory.sleeping) {
    ctx.setLineDash([8, 6])
    ctx.strokeStyle = '#444466'
  } else {
    ctx.setLineDash([])
    ctx.strokeStyle = fillColor + '60'
    ctx.shadowColor = fillColor
    ctx.shadowBlur = 12
  }
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.setLineDash([])
  ctx.shadowBlur = 0

  // Namespace label
  ctx.fillStyle = territory.sleeping ? '#666688' : fillColor
  ctx.font = 'bold 13px Inter, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(territory.name.toUpperCase(), territory.labelX, territory.labelY)

  // SLEEPING overlay
  if (territory.sleeping && territory.sleepProgress >= 1) {
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    ctx.fillStyle = '#7C3AED88'
    ctx.font = 'bold 16px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('SLEEPING', cx, cy - 8)
    ctx.font = '20px Inter, sans-serif'
    ctx.fillText('\u263D', cx, cy + 16)
  }

  ctx.restore()
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FlagshipHexGridPage() {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hexesRef = useRef<HexState[]>([])
  const territoriesRef = useRef<NamespaceTerritory[]>([])
  const mouseRef = useRef({ x: -1000, y: -1000 })
  const hoveredHexRef = useRef<number>(-1)
  const rafRef = useRef<number>(0)
  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [simulating, setSimulating] = useState(true)
  const [stats, setStats] = useState({ workloads: 0, replicas: 0, running: 0, sleeping: 0, failed: 0 })
  const [tooltipData, setTooltipData] = useState<{ x: number; y: number; hex: HexState } | null>(null)
  const [detailHex, setDetailHex] = useState<HexState | null>(null)
  const [highlightedNs, setHighlightedNs] = useState<string | null>(null)
  const [namespaceSleepState, setNamespaceSleepState] = useState<Record<string, boolean>>({})

  const simulatingRef = useRef(simulating)
  simulatingRef.current = simulating
  const highlightedNsRef = useRef(highlightedNs)
  highlightedNsRef.current = highlightedNs

  // -----------------------------------------------------------------------
  // Initialize
  // -----------------------------------------------------------------------
  const initState = useCallback(() => {
    const { hexes, territories } = buildInitialState()
    hexesRef.current = hexes
    territoriesRef.current = territories
    setNamespaceSleepState(Object.fromEntries(territories.map(t => [t.name, false])))
    updateStats()
  }, [])

  useEffect(() => {
    initState()
  }, [initState])

  // -----------------------------------------------------------------------
  // Stats
  // -----------------------------------------------------------------------
  const updateStats = useCallback(() => {
    const hexes = hexesRef.current
    let replicas = 0, running = 0, sleeping = 0, failed = 0
    for (const h of hexes) {
      for (const p of h.pods) {
        replicas++
        if (p.status === 'running') running++
        else if (p.status === 'sleeping') sleeping++
        else if (p.status === 'failed') failed++
      }
    }
    setStats({ workloads: hexes.length, replicas, running, sleeping, failed })
  }, [])

  // -----------------------------------------------------------------------
  // Canvas sizing
  // -----------------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = container.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(container)
    resize()

    return () => observer.disconnect()
  }, [])

  // -----------------------------------------------------------------------
  // Render loop
  // -----------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const draw = (time: number) => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const dpr = window.devicePixelRatio || 1
      const w = canvas.width / dpr
      const h = canvas.height / dpr

      // Background
      ctx.fillStyle = '#0F1117'
      ctx.fillRect(0, 0, w, h)

      // Grid dots background
      ctx.fillStyle = '#1A1B23'
      for (let gx = 0; gx < w; gx += 30) {
        for (let gy = 0; gy < h; gy += 30) {
          ctx.beginPath()
          ctx.arc(gx, gy, 0.5, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      const hexes = hexesRef.current
      const territories = territoriesRef.current

      // Center the hex field
      if (hexes.length === 0) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }

      const allCx = hexes.map(h2 => h2.cx)
      const allCy = hexes.map(h2 => h2.cy)
      const fieldMinX = Math.min(...allCx) - 60
      const fieldMaxX = Math.max(...allCx) + 60
      const fieldMinY = Math.min(...allCy) - 80
      const fieldMaxY = Math.max(...allCy) + 60
      const fieldW = fieldMaxX - fieldMinX
      const fieldH = fieldMaxY - fieldMinY
      const scale = Math.min((w - 40) / fieldW, (h - 40) / fieldH, 1.2)
      const offsetX = (w - fieldW * scale) / 2 - fieldMinX * scale
      const offsetY = (h - fieldH * scale) / 2 - fieldMinY * scale

      ctx.save()
      ctx.translate(offsetX, offsetY)
      ctx.scale(scale, scale)

      // Draw territories
      for (const t of territories) {
        drawTerritoryOutline(ctx, hexes, t, highlightedNsRef.current)
      }

      // Detect hover
      const mx = (mouseRef.current.x - offsetX) / scale
      const my = (mouseRef.current.y - offsetY) / scale
      let newHovered = -1
      for (let i = 0; i < hexes.length; i++) {
        if (pointInHex(mx, my, hexes[i].cx, hexes[i].cy, hexes[i].baseRadius)) {
          newHovered = i
          break
        }
      }
      hoveredHexRef.current = newHovered

      // Draw hexes
      for (let i = 0; i < hexes.length; i++) {
        drawHex(ctx, hexes[i], time, i === newHovered, highlightedNsRef.current)
      }

      ctx.restore()

      // Tooltip
      if (newHovered >= 0) {
        const hh = hexes[newHovered]
        const screenX = hh.cx * scale + offsetX
        const screenY = hh.cy * scale + offsetY
        setTooltipData({ x: screenX, y: screenY, hex: hh })
      } else {
        setTooltipData(null)
      }

      // Update animation progress
      const dt = 1 / 60
      for (const hx of hexes) {
        if (hx.sleeping && hx.animProgress < 1) {
          hx.animProgress = Math.min(1, hx.animProgress + dt * 1.2)
        }
        if (!hx.sleeping && hx.animProgress > 0) {
          hx.animProgress = Math.min(1, hx.animProgress + dt * 1.2)
          if (hx.animProgress >= 1) hx.animProgress = 0
        }
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  // -----------------------------------------------------------------------
  // Live simulation
  // -----------------------------------------------------------------------
  useEffect(() => {
    simIntervalRef.current = setInterval(() => {
      if (!simulatingRef.current) return
      const hexes = hexesRef.current
      const awakeHexes = hexes.filter(h => !h.sleeping)
      if (awakeHexes.length === 0) return

      for (let c = 0; c < 2; c++) {
        const h = awakeHexes[Math.floor(Math.random() * awakeHexes.length)]
        const podIdx = Math.floor(Math.random() * h.pods.length)
        const roll = Math.random()
        if (roll < 0.85) h.pods[podIdx].status = 'running'
        else if (roll < 0.93) h.pods[podIdx].status = 'pending'
        else h.pods[podIdx].status = 'failed'
        h.pods[podIdx].cpu = 10 + Math.random() * 80
      }
      updateStats()
    }, 1500)

    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current)
    }
  }, [updateStats])

  // -----------------------------------------------------------------------
  // Sleep / Wake
  // -----------------------------------------------------------------------
  const triggerSleep = useCallback((nsName: string) => {
    const hexes = hexesRef.current
    const territory = territoriesRef.current.find(t => t.name === nsName)
    if (!territory) return

    const tHexes = territory.hexIndices.map(i => hexes[i])
    const cx = tHexes.reduce((s, h) => s + h.cx, 0) / tHexes.length
    const cy = tHexes.reduce((s, h) => s + h.cy, 0) / tHexes.length

    const maxDist = Math.max(...tHexes.map(h => Math.hypot(h.cx - cx, h.cy - cy)), 1)

    for (const h of tHexes) {
      const dist = Math.hypot(h.cx - cx, h.cy - cy)
      const delay = (dist / maxDist) * 600

      setTimeout(() => {
        h.sleeping = true
        h.animProgress = 0
        for (const p of h.pods) p.status = 'sleeping'
      }, delay)
    }

    territory.sleeping = true
    setTimeout(() => {
      territory.sleepProgress = 1
      updateStats()
    }, 800)

    setNamespaceSleepState(prev => ({ ...prev, [nsName]: true }))
  }, [updateStats])

  const triggerWake = useCallback((nsName: string) => {
    const hexes = hexesRef.current
    const territory = territoriesRef.current.find(t => t.name === nsName)
    if (!territory) return

    territory.sleeping = false
    territory.sleepProgress = 0

    const tHexes = territory.hexIndices.map(i => hexes[i])
    const cx = tHexes.reduce((s, h) => s + h.cx, 0) / tHexes.length
    const cy = tHexes.reduce((s, h) => s + h.cy, 0) / tHexes.length
    const maxDist = Math.max(...tHexes.map(h => Math.hypot(h.cx - cx, h.cy - cy)), 1)

    for (const h of tHexes) {
      const dist = Math.hypot(h.cx - cx, h.cy - cy)
      const delay = (dist / maxDist) * 600

      setTimeout(() => {
        h.sleeping = false
        h.animProgress = 0.01
        for (const p of h.pods) p.status = 'running'
      }, delay)
    }

    setTimeout(() => updateStats(), 900)
    setNamespaceSleepState(prev => ({ ...prev, [nsName]: false }))
  }, [updateStats])

  // -----------------------------------------------------------------------
  // Mouse events
  // -----------------------------------------------------------------------
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [])

  const handleMouseLeave = useCallback(() => {
    mouseRef.current = { x: -1000, y: -1000 }
    setTooltipData(null)
  }, [])

  const handleClick = useCallback(() => {
    const idx = hoveredHexRef.current
    if (idx >= 0) {
      setDetailHex({ ...hexesRef.current[idx] })
    } else {
      setDetailHex(null)
      setHighlightedNs(null)
    }
  }, [])

  const handleNsClick = useCallback((ns: string) => {
    setHighlightedNs(prev => prev === ns ? null : ns)
  }, [])

  const handleReset = useCallback(() => {
    initState()
    setDetailHex(null)
    setHighlightedNs(null)
    setTooltipData(null)
  }, [initState])

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  const sleepableNamespaces = ['production', 'staging', 'dev']

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#0F1117', color: '#E2E8F0' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.5, borderBottom: '1px solid #1E293B' }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small" sx={{ color: '#94A3B8' }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: 1 }}>
          FL12 — Hexagonal Grid
        </Typography>
      </Box>

      {/* Stats bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1, flexWrap: 'wrap', borderBottom: '1px solid #1E293B' }}>
        <Chip label={`${stats.workloads} workloads`} size="small" sx={{ bgcolor: '#1E293B', color: '#94A3B8' }} />
        <Chip label={`${stats.replicas} replicas`} size="small" sx={{ bgcolor: '#1E293B', color: '#94A3B8' }} />
        <Chip label={`${stats.running} running`} size="small" sx={{ bgcolor: '#052E16', color: '#22C55E' }} />
        <Chip label={`${stats.sleeping} sleeping`} size="small" sx={{ bgcolor: '#1A1A2E', color: '#7C3AED' }} />
        <Chip label={`${stats.failed} failed`} size="small" sx={{ bgcolor: '#2D0A0A', color: '#EF4444' }} />
        <Box sx={{ flex: 1 }} />
        {territoriesRef.current.map(t => (
          <Chip
            key={t.name}
            label={`${t.name} (${t.hexIndices.length})`}
            size="small"
            onClick={() => handleNsClick(t.name)}
            sx={{
              bgcolor: highlightedNs === t.name ? t.color + '40' : '#1E293B',
              color: t.color,
              border: highlightedNs === t.name ? `1px solid ${t.color}` : '1px solid transparent',
              cursor: 'pointer',
              '&:hover': { bgcolor: t.color + '20' },
            }}
          />
        ))}
      </Box>

      {/* Controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, borderBottom: '1px solid #1E293B', flexWrap: 'wrap' }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={simulating ? <PauseIcon /> : <PlayArrowIcon />}
          onClick={() => setSimulating(!simulating)}
          sx={{ color: '#94A3B8', borderColor: '#334155', textTransform: 'none' }}
        >
          {simulating ? 'Pause' : 'Simulate'}
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<RestartAltIcon />}
          onClick={handleReset}
          sx={{ color: '#94A3B8', borderColor: '#334155', textTransform: 'none' }}
        >
          Reset
        </Button>
        <Box sx={{ width: 1, height: 24, bgcolor: '#334155', mx: 1 }} />
        {sleepableNamespaces.map(ns => {
          const isSleeping = namespaceSleepState[ns]
          return isSleeping ? (
            <Button
              key={ns}
              size="small"
              variant="outlined"
              startIcon={<WbSunnyIcon />}
              onClick={() => triggerWake(ns)}
              sx={{ color: '#F59E0B', borderColor: '#78350F', textTransform: 'none' }}
            >
              Wake {ns}
            </Button>
          ) : (
            <Button
              key={ns}
              size="small"
              variant="outlined"
              startIcon={<BedtimeIcon />}
              onClick={() => triggerSleep(ns)}
              sx={{ color: '#7C3AED', borderColor: '#4C1D95', textTransform: 'none' }}
            >
              Sleep {ns}
            </Button>
          )
        })}
      </Box>

      {/* Canvas */}
      <Box ref={containerRef} sx={{ flex: 1, position: 'relative', minHeight: 650, overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          style={{ display: 'block', cursor: hoveredHexRef.current >= 0 ? 'pointer' : 'default' }}
        />

        {/* Tooltip */}
        {tooltipData && (
          <Box
            sx={{
              position: 'absolute',
              left: tooltipData.x + 16,
              top: tooltipData.y - 20,
              bgcolor: '#1E293BF0',
              border: '1px solid #334155',
              borderRadius: 1.5,
              px: 1.5,
              py: 1,
              pointerEvents: 'none',
              zIndex: 10,
              minWidth: 180,
              backdropFilter: 'blur(8px)',
            }}
          >
            <Typography variant="caption" sx={{ color: '#E2E8F0', fontWeight: 700, display: 'block' }}>
              {tooltipData.hex.workload}
            </Typography>
            <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block' }}>
              {tooltipData.hex.namespace} &middot; {tooltipData.hex.kind}
            </Typography>
            <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mt: 0.5 }}>
              Replicas: {tooltipData.hex.pods.filter(p => p.status === 'running').length}/{tooltipData.hex.pods.length}
            </Typography>
            <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block' }}>
              CPU: {Math.round(tooltipData.hex.pods.reduce((s, p) => s + p.cpu, 0))}m &middot; Mem: {Math.round(tooltipData.hex.pods.reduce((s, p) => s + p.memory, 0))}Mi
            </Typography>
            <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {tooltipData.hex.pods.map((p, i) => (
                <Box
                  key={i}
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: p.status === 'running' ? '#22C55E' : p.status === 'pending' ? '#F59E0B' : p.status === 'failed' ? '#EF4444' : '#555566',
                  }}
                />
              ))}
            </Box>
          </Box>
        )}

        {/* Detail card */}
        {detailHex && (
          <Card
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              bgcolor: '#1E293BF5',
              border: '1px solid #334155',
              minWidth: 320,
              maxWidth: 400,
              zIndex: 20,
              backdropFilter: 'blur(12px)',
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="h6" sx={{ color: '#E2E8F0', fontWeight: 700 }}>
                  {detailHex.workload}
                </Typography>
                <Chip
                  label={detailHex.kind}
                  size="small"
                  sx={{ bgcolor: '#334155', color: '#94A3B8' }}
                />
              </Box>
              <Typography variant="body2" sx={{ color: '#94A3B8', mb: 1.5 }}>
                Namespace: {detailHex.namespace}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mb: 1 }}>
                PODS ({detailHex.pods.length})
              </Typography>
              {detailHex.pods.map((pod, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: pod.status === 'running' ? '#22C55E' : pod.status === 'pending' ? '#F59E0B' : pod.status === 'failed' ? '#EF4444' : '#555566',
                      flexShrink: 0,
                    }}
                  />
                  <Typography variant="caption" sx={{ color: '#CBD5E1', fontFamily: 'monospace', flex: 1 }}>
                    {pod.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748B' }}>
                    {Math.round(pod.cpu)}m / {Math.round(pod.memory)}Mi
                  </Typography>
                </Box>
              ))}
              <Button
                size="small"
                onClick={() => setDetailHex(null)}
                sx={{ mt: 1.5, color: '#94A3B8', textTransform: 'none' }}
              >
                Close
              </Button>
            </CardContent>
          </Card>
        )}
      </Box>
    </Box>
  )
}
