'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import ShuffleIcon from '@mui/icons-material/Shuffle'
import { useRouter } from 'next/navigation'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PodStatus = 'running' | 'pending' | 'failed' | 'sleeping'

interface PodData {
  name: string
  workload: string
  namespace: string
  node: string
  status: PodStatus
  cpuMillicores: number
  memoryMB: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  mass: number
  radius: number
  color: string
  targetX: number
  targetY: number
  pod: PodData
  frozen: boolean
  opacity: number
  trail: { x: number; y: number }[]
  orbitDirection: number
  collapseFlashTime: number
}

interface WorkloadCenter {
  name: string
  namespace: string
  x: number
  y: number
  podCount: number
  pulsePhase: number
  dimmed: boolean
  eventHorizon: boolean
}

interface NamespaceRegion {
  name: string
  cx: number
  cy: number
  radius: number
  color: string
}

interface NodeWell {
  name: string
  x: number
  y: number
  color: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<PodStatus, string> = {
  running: '#22C55E',
  pending: '#F59E0B',
  failed: '#EF4444',
  sleeping: '#64748B',
}

const NODE_COLORS = [
  '#6366F1', '#8B5CF6', '#A78BFA', '#818CF8', '#7C3AED', '#6D28D9',
]

const NS_CONFIG: Record<string, { cx: number; cy: number; radius: number; color: string }> = {
  production: { cx: 0.5, cy: 0.5, radius: 0.22, color: '#3B82F6' },
  staging: { cx: 0.78, cy: 0.45, radius: 0.13, color: '#8B5CF6' },
  dev: { cx: 0.75, cy: 0.75, radius: 0.11, color: '#EC4899' },
  monitoring: { cx: 0.22, cy: 0.3, radius: 0.11, color: '#14B8A6' },
  'kube-system': { cx: 0.22, cy: 0.72, radius: 0.12, color: '#F97316' },
}

const SPRING_K = 0.002
const DAMPING = 0.995
const TRAIL_LENGTH = 8
const COLLAPSE_SPRING_MULTIPLIER = 50
const REPULSION_DISTANCE = 20
const REPULSION_FORCE = 0.5

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

interface WorkloadDef {
  name: string
  namespace: string
  podCount: number
  statusOverrides?: Partial<Record<number, PodStatus>>
}

const WORKLOAD_DEFS: WorkloadDef[] = [
  { name: 'api-gateway', namespace: 'production', podCount: 3 },
  { name: 'web-frontend', namespace: 'production', podCount: 2 },
  { name: 'order-svc', namespace: 'production', podCount: 2, statusOverrides: { 1: 'pending' } },
  { name: 'payment-svc', namespace: 'production', podCount: 2 },
  { name: 'user-svc', namespace: 'production', podCount: 2 },
  { name: 'notif-svc', namespace: 'production', podCount: 1 },
  { name: 'postgres', namespace: 'production', podCount: 3 },
  { name: 'redis', namespace: 'production', podCount: 3, statusOverrides: { 2: 'failed' } },
  { name: 'api-gateway', namespace: 'staging', podCount: 1 },
  { name: 'web-frontend', namespace: 'staging', podCount: 1 },
  { name: 'order-svc', namespace: 'staging', podCount: 1 },
  { name: 'payment-svc', namespace: 'staging', podCount: 1 },
  { name: 'postgres', namespace: 'staging', podCount: 1 },
  { name: 'redis', namespace: 'staging', podCount: 1 },
  { name: 'api-gateway', namespace: 'dev', podCount: 1 },
  { name: 'web-frontend', namespace: 'dev', podCount: 1, statusOverrides: { 0: 'pending' } },
  { name: 'feature-svc', namespace: 'dev', podCount: 1 },
  { name: 'postgres', namespace: 'dev', podCount: 1 },
  { name: 'prometheus', namespace: 'monitoring', podCount: 1 },
  { name: 'grafana', namespace: 'monitoring', podCount: 1 },
  { name: 'alertmanager', namespace: 'monitoring', podCount: 1 },
  { name: 'loki', namespace: 'monitoring', podCount: 1 },
  { name: 'coredns', namespace: 'kube-system', podCount: 2 },
  { name: 'kube-proxy', namespace: 'kube-system', podCount: 3, statusOverrides: { 2: 'failed' } },
  { name: 'metrics-server', namespace: 'kube-system', podCount: 1 },
]

const NODE_NAMES = [
  'ip-10-0-1-100', 'ip-10-0-1-101', 'ip-10-0-1-102',
  'ip-10-0-1-103', 'ip-10-0-1-104', 'ip-10-0-1-105',
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function distributeWorkloadsInRegion(
  workloads: WorkloadDef[],
  regionCx: number,
  regionCy: number,
  regionRadius: number,
  canvasW: number,
  canvasH: number,
): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>()
  const count = workloads.length
  const angleStep = (2 * Math.PI) / Math.max(count, 1)
  const spreadRadius = regionRadius * Math.min(canvasW, canvasH) * 0.55

  workloads.forEach((w, i) => {
    const angle = angleStep * i - Math.PI / 2
    const jitter = (Math.random() - 0.5) * spreadRadius * 0.3
    const r = count === 1 ? 0 : spreadRadius * 0.6 + jitter
    result.set(`${w.namespace}/${w.name}`, {
      x: regionCx * canvasW + Math.cos(angle) * r,
      y: regionCy * canvasH + Math.sin(angle) * r,
    })
  })
  return result
}

function buildParticles(canvasW: number, canvasH: number): {
  particles: Particle[]
  workloadCenters: WorkloadCenter[]
  namespaceRegions: NamespaceRegion[]
  nodeWells: NodeWell[]
} {
  const namespaceRegions: NamespaceRegion[] = Object.entries(NS_CONFIG).map(([name, cfg]) => ({
    name,
    cx: cfg.cx * canvasW,
    cy: cfg.cy * canvasH,
    radius: cfg.radius * Math.min(canvasW, canvasH),
    color: cfg.color,
  }))

  const nodeWells: NodeWell[] = NODE_NAMES.map((name, i) => ({
    name,
    x: ((i + 1) / (NODE_NAMES.length + 1)) * canvasW,
    y: 40,
    color: NODE_COLORS[i],
  }))

  const workloadsByNs = new Map<string, WorkloadDef[]>()
  for (const w of WORKLOAD_DEFS) {
    const list = workloadsByNs.get(w.namespace) ?? []
    list.push(w)
    workloadsByNs.set(w.namespace, list)
  }

  const positionMaps = new Map<string, Map<string, { x: number; y: number }>>()
  for (const [ns, wList] of workloadsByNs.entries()) {
    const cfg = NS_CONFIG[ns]
    if (!cfg) continue
    positionMaps.set(ns, distributeWorkloadsInRegion(wList, cfg.cx, cfg.cy, cfg.radius, canvasW, canvasH))
  }

  const workloadCenters: WorkloadCenter[] = []
  const particles: Particle[] = []
  let nodeIndex = 0

  for (const wDef of WORKLOAD_DEFS) {
    const posMap = positionMaps.get(wDef.namespace)
    const pos = posMap?.get(`${wDef.namespace}/${wDef.name}`)
    if (!pos) continue

    workloadCenters.push({
      name: wDef.name,
      namespace: wDef.namespace,
      x: pos.x,
      y: pos.y,
      podCount: wDef.podCount,
      pulsePhase: Math.random() * Math.PI * 2,
      dimmed: false,
      eventHorizon: false,
    })

    for (let i = 0; i < wDef.podCount; i++) {
      const status: PodStatus = wDef.statusOverrides?.[i] ?? 'running'
      const cpu = 50 + Math.random() * 450
      const mass = cpu / 100
      const radius = 3 + mass * 1.2
      const angle = Math.random() * Math.PI * 2
      const orbitRadius = 25 + Math.random() * 40
      const speed = 0.3 + Math.random() * 0.5
      const dir = Math.random() > 0.5 ? 1 : -1

      const assignedNode = nodeIndex % NODE_NAMES.length
      nodeIndex++

      particles.push({
        x: pos.x + Math.cos(angle) * orbitRadius,
        y: pos.y + Math.sin(angle) * orbitRadius,
        vx: Math.cos(angle + (Math.PI / 2) * dir) * speed,
        vy: Math.sin(angle + (Math.PI / 2) * dir) * speed,
        mass,
        radius,
        color: STATUS_COLORS[status],
        targetX: pos.x,
        targetY: pos.y,
        pod: {
          name: `${wDef.name}-${randomSuffix()}`,
          workload: wDef.name,
          namespace: wDef.namespace,
          node: NODE_NAMES[assignedNode],
          status,
          cpuMillicores: Math.round(cpu),
          memoryMB: Math.round(64 + Math.random() * 448),
        },
        frozen: false,
        opacity: 1,
        trail: [],
        orbitDirection: dir,
        collapseFlashTime: 0,
      })
    }
  }

  return { particles, workloadCenters, namespaceRegions, nodeWells }
}

function randomSuffix(): string {
  return Math.random().toString(36).substring(2, 7)
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FlagshipGravityPrototype() {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const particlesRef = useRef<Particle[]>([])
  const workloadCentersRef = useRef<WorkloadCenter[]>([])
  const namespaceRegionsRef = useRef<NamespaceRegion[]>([])
  const nodeWellsRef = useRef<NodeWell[]>([])
  const sizeRef = useRef({ w: 0, h: 0 })
  const lastTimeRef = useRef(0)
  const hoveredRef = useRef<Particle | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const panRef = useRef({ offsetX: 0, offsetY: 0, scale: 1 })
  const dragRef = useRef({ dragging: false, lastX: 0, lastY: 0 })
  const focusRef = useRef<WorkloadCenter | null>(null)
  const focusAnimRef = useRef({ active: false, startTime: 0, fromScale: 1, fromX: 0, fromY: 0, toScale: 1, toX: 0, toY: 0 })
  const chaosEndRef = useRef(0)
  const collapseQueueRef = useRef<{ namespace: string; workloadIdx: number; time: number }[]>([])
  const wakeQueueRef = useRef<{ namespace: string; workloadIdx: number; time: number }[]>([])

  const [paused, setPaused] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [sleepingNamespaces, setSleepingNamespaces] = useState<Set<string>>(new Set())
  const [stats, setStats] = useState({ running: 0, pending: 0, failed: 0, sleeping: 0, total: 0 })

  const pausedRef = useRef(false)
  const speedRef = useRef(1)
  const sleepingRef = useRef<Set<string>>(new Set())

  pausedRef.current = paused
  speedRef.current = speed
  sleepingRef.current = sleepingNamespaces

  const updateStats = useCallback(() => {
    const counts = { running: 0, pending: 0, failed: 0, sleeping: 0, total: 0 }
    for (const p of particlesRef.current) {
      counts.total++
      if (p.frozen) counts.sleeping++
      else if (p.pod.status === 'running') counts.running++
      else if (p.pod.status === 'pending') counts.pending++
      else if (p.pod.status === 'failed') counts.failed++
    }
    setStats(counts)
  }, [])

  const initSimulation = useCallback((w: number, h: number) => {
    const { particles, workloadCenters, namespaceRegions, nodeWells } = buildParticles(w, h)
    particlesRef.current = particles
    workloadCentersRef.current = workloadCenters
    namespaceRegionsRef.current = namespaceRegions
    nodeWellsRef.current = nodeWells
    sizeRef.current = { w, h }
    panRef.current = { offsetX: 0, offsetY: 0, scale: 1 }
    focusRef.current = null
    focusAnimRef.current.active = false
    updateStats()
  }, [updateStats])

  const handleSleep = useCallback((ns: string) => {
    setSleepingNamespaces(prev => {
      const next = new Set(prev)
      next.add(ns)
      return next
    })

    const now = performance.now()
    const nsWorkloads = workloadCentersRef.current
      .map((wc, idx) => ({ wc, idx }))
      .filter(({ wc }) => wc.namespace === ns)

    nsWorkloads.forEach(({ idx }, i) => {
      collapseQueueRef.current.push({ namespace: ns, workloadIdx: idx, time: now + i * 200 })
    })
  }, [])

  const handleWake = useCallback((ns: string) => {
    setSleepingNamespaces(prev => {
      const next = new Set(prev)
      next.delete(ns)
      return next
    })

    const now = performance.now()
    const nsWorkloads = workloadCentersRef.current
      .map((wc, idx) => ({ wc, idx }))
      .filter(({ wc }) => wc.namespace === ns)

    nsWorkloads.forEach(({ wc, idx }, i) => {
      wakeQueueRef.current.push({ namespace: ns, workloadIdx: idx, time: now + i * 150 })
      wc.dimmed = false
      wc.eventHorizon = false
    })
  }, [])

  const handleChaos = useCallback(() => {
    chaosEndRef.current = performance.now() + 3000
  }, [])

  const handleReset = useCallback(() => {
    const { w, h } = sizeRef.current
    if (w > 0 && h > 0) {
      collapseQueueRef.current = []
      wakeQueueRef.current = []
      chaosEndRef.current = 0
      setSleepingNamespaces(new Set())
      initSimulation(w, h)
    }
  }, [initSimulation])

  const cycleSpeed = useCallback(() => {
    setSpeed(prev => {
      if (prev === 1) return 2
      if (prev === 2) return 4
      return 1
    })
  }, [])

  // -------------------------------------------------------------------------
  // Physics + Render Loop
  // -------------------------------------------------------------------------

  const updatePhysics = useCallback((dt: number, now: number) => {
    const particles = particlesRef.current
    const workloadCenters = workloadCentersRef.current

    // Process collapse queue
    const collapseQueue = collapseQueueRef.current
    for (let qi = collapseQueue.length - 1; qi >= 0; qi--) {
      const entry = collapseQueue[qi]
      if (now >= entry.time) {
        const wc = workloadCenters[entry.workloadIdx]
        if (wc) {
          for (const p of particles) {
            if (p.pod.workload === wc.name && p.pod.namespace === wc.namespace && !p.frozen) {
              p.pod.status = 'sleeping'
              p.color = STATUS_COLORS.sleeping
            }
          }
          wc.dimmed = true
        }
        collapseQueue.splice(qi, 1)
      }
    }

    // Process wake queue
    const wakeQueue = wakeQueueRef.current
    for (let qi = wakeQueue.length - 1; qi >= 0; qi--) {
      const entry = wakeQueue[qi]
      if (now >= entry.time) {
        const wc = workloadCenters[entry.workloadIdx]
        if (wc) {
          for (const p of particles) {
            if (p.pod.workload === wc.name && p.pod.namespace === wc.namespace && p.frozen) {
              p.frozen = false
              p.opacity = 1
              p.pod.status = 'running'
              p.color = STATUS_COLORS.running
              const angle = Math.random() * Math.PI * 2
              const burstSpeed = 3 + Math.random() * 2
              p.vx = Math.cos(angle) * burstSpeed
              p.vy = Math.sin(angle) * burstSpeed
              p.collapseFlashTime = now
              p.trail = []
            }
          }
        }
        wakeQueue.splice(qi, 1)
      }
    }

    const chaosActive = now < chaosEndRef.current

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]

      if (p.frozen) {
        p.opacity = Math.max(0.2, p.opacity - dt * 0.0005)
        const dx = p.targetX - p.x
        const dy = p.targetY - p.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > 2) {
          p.x += dx * 0.05
          p.y += dy * 0.05
        }
        continue
      }

      // Trail
      p.trail.push({ x: p.x, y: p.y })
      if (p.trail.length > TRAIL_LENGTH) p.trail.shift()

      // Spring force toward workload center
      const dx = p.targetX - p.x
      const dy = p.targetY - p.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      let k = SPRING_K
      const isSleeping = p.pod.status === 'sleeping'
      if (isSleeping && !p.frozen) {
        k *= COLLAPSE_SPRING_MULTIPLIER
        if (dist < 5) {
          p.frozen = true
          p.vx = 0
          p.vy = 0
          p.collapseFlashTime = now
          const wc = workloadCenters.find(
            w => w.name === p.pod.workload && w.namespace === p.pod.namespace,
          )
          if (wc) wc.eventHorizon = true
          continue
        }
      }

      if (p.pod.status === 'pending') {
        k *= 3
      }

      let fx = dx * k
      let fy = dy * k

      // Orbital tangential force
      if (dist > 1) {
        const nx = dx / dist
        const ny = dy / dist
        const tangentStrength = 0.0008 * p.orbitDirection
        fx += -ny * tangentStrength * dist
        fy += nx * tangentStrength * dist
      }

      // Failed pod jitter
      if (p.pod.status === 'failed') {
        fx += (Math.random() - 0.5) * 0.15
        fy += (Math.random() - 0.5) * 0.15
      }

      // Chaos
      if (chaosActive) {
        fx += (Math.random() - 0.5) * 2
        fy += (Math.random() - 0.5) * 2
      }

      p.vx += fx * dt
      p.vy += fy * dt
      p.vx *= DAMPING
      p.vy *= DAMPING
      p.x += p.vx * dt
      p.y += p.vy * dt

      // Collision avoidance
      for (let j = i + 1; j < particles.length; j++) {
        const q = particles[j]
        if (q.frozen) continue
        const cdx = q.x - p.x
        const cdy = q.y - p.y
        const cdist = Math.sqrt(cdx * cdx + cdy * cdy)
        const minDist = REPULSION_DISTANCE
        if (cdist < minDist && cdist > 0.1) {
          const overlap = minDist - cdist
          const nx = cdx / cdist
          const ny = cdy / cdist
          const push = overlap * REPULSION_FORCE * 0.01
          p.vx -= nx * push
          p.vy -= ny * push
          q.vx += nx * push
          q.vy += ny * push
        }
      }
    }
  }, [])

  const render = useCallback((ctx: CanvasRenderingContext2D, now: number) => {
    const { w, h } = sizeRef.current
    const dpr = window.devicePixelRatio || 1
    const pan = panRef.current

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, w * dpr, h * dpr)

    // Handle focus animation
    const fa = focusAnimRef.current
    if (fa.active) {
      const elapsed = now - fa.startTime
      const duration = 600
      const t = Math.min(elapsed / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      pan.scale = lerp(fa.fromScale, fa.toScale, ease)
      pan.offsetX = lerp(fa.fromX, fa.toX, ease)
      pan.offsetY = lerp(fa.fromY, fa.toY, ease)
      if (t >= 1) fa.active = false
    }

    ctx.setTransform(dpr * pan.scale, 0, 0, dpr * pan.scale, dpr * pan.offsetX, dpr * pan.offsetY)

    drawBackground(ctx, w, h)
    drawNodeGravityWells(ctx, now)
    drawNamespaceRegions(ctx)
    drawWorkloadCenters(ctx, now)
    drawParticleTrails(ctx, now)
    drawParticles(ctx, now)
    drawNodeLinks(ctx)
    drawLabels(ctx)
  }, [])

  const drawBackground = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.fillStyle = '#0F172A'
    ctx.fillRect(-500, -500, w + 1000, h + 1000)

    // Star field
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    const seed = 42
    for (let i = 0; i < 120; i++) {
      const sx = ((seed * (i + 1) * 7919) % (w + 200)) - 100
      const sy = ((seed * (i + 1) * 6271) % (h + 200)) - 100
      const sr = ((i * 3571) % 3) * 0.3 + 0.3
      ctx.beginPath()
      ctx.arc(sx, sy, sr, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [])

  const drawNodeGravityWells = useCallback((ctx: CanvasRenderingContext2D, now: number) => {
    for (const node of nodeWellsRef.current) {
      const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y + 60, 120)
      gradient.addColorStop(0, hexToRgba(node.color, 0.15))
      gradient.addColorStop(1, 'transparent')
      ctx.fillStyle = gradient
      ctx.fillRect(node.x - 120, node.y, 240, 120)

      ctx.fillStyle = hexToRgba(node.color, 0.6)
      ctx.beginPath()
      ctx.arc(node.x, node.y, 10, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = hexToRgba(node.color, 0.3)
      ctx.beginPath()
      ctx.arc(node.x, node.y, 16 + Math.sin(now * 0.002) * 2, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = '9px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(node.name, node.x, node.y + 28)
    }
  }, [])

  const drawNamespaceRegions = useCallback((ctx: CanvasRenderingContext2D) => {
    for (const region of namespaceRegionsRef.current) {
      ctx.strokeStyle = hexToRgba(region.color, 0.15)
      ctx.setLineDash([6, 6])
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(region.cx, region.cy, region.radius, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.fillStyle = hexToRgba(region.color, 0.5)
      ctx.font = 'bold 11px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(region.name, region.cx, region.cy - region.radius - 8)
    }
  }, [])

  const drawWorkloadCenters = useCallback((ctx: CanvasRenderingContext2D, now: number) => {
    for (const wc of workloadCentersRef.current) {
      const alpha = wc.dimmed ? 0.15 : 0.25
      const pulseScale = wc.dimmed ? 0 : Math.sin(now * 0.003 + wc.pulsePhase) * 3

      // Gravitational lensing concentric circles
      if (!wc.dimmed) {
        for (let ring = 1; ring <= 3; ring++) {
          ctx.strokeStyle = `rgba(255,255,255,${0.03 / ring})`
          ctx.lineWidth = 0.5
          ctx.beginPath()
          ctx.arc(wc.x, wc.y, 16 + ring * 12, 0, Math.PI * 2)
          ctx.stroke()
        }
      }

      // Event horizon
      if (wc.eventHorizon) {
        ctx.strokeStyle = 'rgba(100,116,139,0.3)'
        ctx.lineWidth = 1.5
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.arc(wc.x, wc.y, 30, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([])
      }

      // Core circle
      const nsCfg = NS_CONFIG[wc.namespace]
      const coreColor = nsCfg ? nsCfg.color : '#64748B'
      ctx.fillStyle = hexToRgba(coreColor, alpha)
      ctx.beginPath()
      ctx.arc(wc.x, wc.y, 12 + pulseScale, 0, Math.PI * 2)
      ctx.fill()

      // Label
      ctx.fillStyle = `rgba(255,255,255,${wc.dimmed ? 0.2 : 0.45})`
      ctx.font = '8px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(wc.name, wc.x, wc.y + 22)
    }
  }, [])

  const drawParticleTrails = useCallback((ctx: CanvasRenderingContext2D, now: number) => {
    for (const p of particlesRef.current) {
      if (p.frozen || p.trail.length < 2) continue

      const vel = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
      const glowIntensity = Math.min(vel / 3, 1)

      for (let i = 1; i < p.trail.length; i++) {
        const alpha = (i / p.trail.length) * 0.5 * glowIntensity
        ctx.strokeStyle = hexToRgba(p.color, alpha)
        ctx.lineWidth = p.radius * 0.6 * (i / p.trail.length)
        ctx.beginPath()
        ctx.moveTo(p.trail[i - 1].x, p.trail[i - 1].y)
        ctx.lineTo(p.trail[i].x, p.trail[i].y)
        ctx.stroke()
      }

      // Connect last trail point to current position
      if (p.trail.length > 0) {
        const last = p.trail[p.trail.length - 1]
        const alpha = 0.5 * glowIntensity
        ctx.strokeStyle = hexToRgba(p.color, alpha)
        ctx.lineWidth = p.radius * 0.6
        ctx.beginPath()
        ctx.moveTo(last.x, last.y)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()
      }
    }
  }, [])

  const drawParticles = useCallback((ctx: CanvasRenderingContext2D, now: number) => {
    const hovered = hoveredRef.current
    const anyHovered = hovered !== null

    for (const p of particlesRef.current) {
      const isHovered = p === hovered

      // Collapse flash
      if (p.collapseFlashTime > 0 && now - p.collapseFlashTime < 300) {
        const flashProgress = (now - p.collapseFlashTime) / 300
        const flashAlpha = (1 - flashProgress) * 0.8
        ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius * 3 * (1 - flashProgress) + p.radius, 0, Math.PI * 2)
        ctx.fill()
      }

      // Glow
      const vel = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
      const glowRadius = p.radius + (p.frozen ? 0 : vel * 2)
      if (!p.frozen && glowRadius > p.radius + 1) {
        const gradient = ctx.createRadialGradient(p.x, p.y, p.radius * 0.5, p.x, p.y, glowRadius)
        const glowAlpha = isHovered ? 0.4 : 0.15
        gradient.addColorStop(0, hexToRgba(p.color, glowAlpha))
        gradient.addColorStop(1, 'transparent')
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2)
        ctx.fill()
      }

      // Particle body
      const dimFactor = anyHovered && !isHovered ? 0.3 : 1
      const alpha = p.opacity * dimFactor
      ctx.fillStyle = hexToRgba(p.color, alpha)
      ctx.beginPath()
      ctx.arc(p.x, p.y, isHovered ? p.radius * 1.4 : p.radius, 0, Math.PI * 2)
      ctx.fill()

      // White core
      ctx.fillStyle = `rgba(255,255,255,${0.4 * alpha})`
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.radius * 0.35, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [])

  const drawNodeLinks = useCallback((ctx: CanvasRenderingContext2D) => {
    const nodes = nodeWellsRef.current
    if (nodes.length === 0) return

    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 0.5
    ctx.setLineDash([2, 4])

    for (const p of particlesRef.current) {
      if (p.frozen) continue
      const node = nodes.find(n => n.name === p.pod.node)
      if (!node) continue
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(node.x, node.y)
      ctx.stroke()
    }
    ctx.setLineDash([])
  }, [])

  const drawLabels = useCallback((_ctx: CanvasRenderingContext2D) => {
    // Labels handled in workload centers and namespace regions
  }, [])

  // -------------------------------------------------------------------------
  // Main loop
  // -------------------------------------------------------------------------

  const loop = useCallback((timestamp: number) => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) {
      rafRef.current = requestAnimationFrame(loop)
      return
    }

    const rawDt = lastTimeRef.current === 0 ? 16 : timestamp - lastTimeRef.current
    lastTimeRef.current = timestamp
    const dt = Math.min(rawDt, 50) * speedRef.current

    if (!pausedRef.current) {
      updatePhysics(dt, timestamp)
    }

    render(ctx, timestamp)
    rafRef.current = requestAnimationFrame(loop)
  }, [updatePhysics, render])

  // -------------------------------------------------------------------------
  // Canvas setup + events
  // -------------------------------------------------------------------------

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = container.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`

      if (sizeRef.current.w === 0) {
        initSimulation(rect.width, rect.height)
      }
      sizeRef.current = { w: rect.width, h: rect.height }
    }

    resizeCanvas()
    const ro = new ResizeObserver(resizeCanvas)
    ro.observe(container)

    lastTimeRef.current = 0
    rafRef.current = requestAnimationFrame(loop)

    // Stats update interval
    const statsInterval = setInterval(updateStats, 500)

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      clearInterval(statsInterval)
    }
  }, [initSimulation, loop, updateStats])

  // Mouse events
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const toWorld = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect()
      const pan = panRef.current
      return {
        x: (clientX - rect.left - pan.offsetX) / pan.scale,
        y: (clientY - rect.top - pan.offsetY) / pan.scale,
      }
    }

    const findParticleAt = (wx: number, wy: number): Particle | null => {
      for (const p of particlesRef.current) {
        const dx = p.x - wx
        const dy = p.y - wy
        if (dx * dx + dy * dy < (p.radius + 6) * (p.radius + 6)) return p
      }
      return null
    }

    const findWorkloadAt = (wx: number, wy: number): WorkloadCenter | null => {
      for (const wc of workloadCentersRef.current) {
        const dx = wc.x - wx
        const dy = wc.y - wy
        if (dx * dx + dy * dy < 16 * 16) return wc
      }
      return null
    }

    const onMouseMove = (e: MouseEvent) => {
      if (dragRef.current.dragging) {
        const dx = e.clientX - dragRef.current.lastX
        const dy = e.clientY - dragRef.current.lastY
        panRef.current.offsetX += dx
        panRef.current.offsetY += dy
        dragRef.current.lastX = e.clientX
        dragRef.current.lastY = e.clientY
        hoveredRef.current = null
        hideTooltip()
        return
      }

      const { x, y } = toWorld(e.clientX, e.clientY)
      const particle = findParticleAt(x, y)
      hoveredRef.current = particle

      if (particle && tooltipRef.current) {
        const rect = canvas.getBoundingClientRect()
        showTooltip(
          particle,
          e.clientX - rect.left + 15,
          e.clientY - rect.top - 10,
        )
      } else {
        hideTooltip()
      }

      canvas.style.cursor = particle ? 'pointer' : (findWorkloadAt(x, y) ? 'pointer' : 'grab')
    }

    const onMouseDown = (e: MouseEvent) => {
      const { x, y } = toWorld(e.clientX, e.clientY)
      const particle = findParticleAt(x, y)
      if (particle) return

      const wc = findWorkloadAt(x, y)
      if (wc) {
        handleWorkloadClick(wc)
        return
      }

      dragRef.current = { dragging: true, lastX: e.clientX, lastY: e.clientY }
      canvas.style.cursor = 'grabbing'
    }

    const onMouseUp = () => {
      dragRef.current.dragging = false
      canvas.style.cursor = 'grab'
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      const pan = panRef.current

      const zoomFactor = e.deltaY > 0 ? 0.92 : 1.08
      const newScale = Math.max(0.3, Math.min(5, pan.scale * zoomFactor))

      pan.offsetX = mouseX - (mouseX - pan.offsetX) * (newScale / pan.scale)
      pan.offsetY = mouseY - (mouseY - pan.offsetY) * (newScale / pan.scale)
      pan.scale = newScale
    }

    const handleWorkloadClick = (wc: WorkloadCenter) => {
      const { w, h } = sizeRef.current
      const pan = panRef.current

      if (focusRef.current === wc) {
        // Unfocus
        focusRef.current = null
        focusAnimRef.current = {
          active: true,
          startTime: performance.now(),
          fromScale: pan.scale,
          fromX: pan.offsetX,
          fromY: pan.offsetY,
          toScale: 1,
          toX: 0,
          toY: 0,
        }
        return
      }

      focusRef.current = wc
      const targetScale = 2.5
      focusAnimRef.current = {
        active: true,
        startTime: performance.now(),
        fromScale: pan.scale,
        fromX: pan.offsetX,
        fromY: pan.offsetY,
        toScale: targetScale,
        toX: w / 2 - wc.x * targetScale,
        toY: h / 2 - wc.y * targetScale,
      }
    }

    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('mouseleave', onMouseUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('mouseleave', onMouseUp)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [])

  const showTooltip = (p: Particle, x: number, y: number) => {
    const el = tooltipRef.current
    if (!el) return
    el.style.display = 'block'
    el.style.left = `${x}px`
    el.style.top = `${y}px`
    el.innerHTML = `
      <div style="font-weight:600;margin-bottom:4px;color:#E2E8F0">${p.pod.name}</div>
      <div>Workload: <span style="color:#93C5FD">${p.pod.workload}</span></div>
      <div>Namespace: <span style="color:#93C5FD">${p.pod.namespace}</span></div>
      <div>Node: <span style="color:#93C5FD">${p.pod.node}</span></div>
      <div>CPU: <span style="color:#93C5FD">${p.pod.cpuMillicores}m</span></div>
      <div>Memory: <span style="color:#93C5FD">${p.pod.memoryMB}Mi</span></div>
      <div>Status: <span style="color:${STATUS_COLORS[p.pod.status]}">${p.pod.status}</span></div>
    `
  }

  const hideTooltip = () => {
    const el = tooltipRef.current
    if (el) el.style.display = 'none'
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Box sx={{ width: '100vw', height: '100vh', bgcolor: '#0F172A', position: 'relative', overflow: 'hidden' }}>
      {/* Back button */}
      <IconButton
        onClick={() => router.push('/prototypes/')}
        sx={{ position: 'absolute', top: 12, left: 12, zIndex: 20, color: '#94A3B8' }}
      >
        <ArrowBackIcon />
      </IconButton>

      {/* Title */}
      <Typography
        variant="subtitle2"
        sx={{ position: 'absolute', top: 16, left: 56, zIndex: 20, color: '#94A3B8', letterSpacing: 1 }}
      >
        FL10 — Gravitational Field
      </Typography>

      {/* Canvas */}
      <Box ref={containerRef} sx={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
        <canvas ref={canvasRef} style={{ display: 'block' }} />
      </Box>

      {/* Tooltip */}
      <Box
        ref={tooltipRef}
        sx={{
          display: 'none',
          position: 'absolute',
          zIndex: 30,
          bgcolor: 'rgba(15,23,42,0.92)',
          border: '1px solid rgba(148,163,184,0.2)',
          borderRadius: 1.5,
          px: 1.5,
          py: 1,
          fontSize: 11,
          color: '#94A3B8',
          pointerEvents: 'none',
          backdropFilter: 'blur(8px)',
          lineHeight: 1.6,
          whiteSpace: 'nowrap',
        }}
      />

      {/* Controls */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          bgcolor: 'rgba(15,23,42,0.85)',
          border: '1px solid rgba(148,163,184,0.15)',
          borderRadius: 2,
          px: 2,
          py: 1,
          backdropFilter: 'blur(12px)',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <Button
          size="small"
          variant="outlined"
          startIcon={paused ? <PlayArrowIcon /> : <PauseIcon />}
          onClick={() => setPaused(p => !p)}
          sx={{ color: '#94A3B8', borderColor: 'rgba(148,163,184,0.3)', textTransform: 'none', fontSize: 12, minWidth: 90 }}
        >
          {paused ? 'Simulate' : 'Pause'}
        </Button>

        <Button
          size="small"
          variant="outlined"
          startIcon={<RestartAltIcon />}
          onClick={handleReset}
          sx={{ color: '#94A3B8', borderColor: 'rgba(148,163,184,0.3)', textTransform: 'none', fontSize: 12 }}
        >
          Reset
        </Button>

        <Button
          size="small"
          variant="outlined"
          onClick={cycleSpeed}
          sx={{ color: '#94A3B8', borderColor: 'rgba(148,163,184,0.3)', textTransform: 'none', fontSize: 12, minWidth: 50 }}
        >
          {speed}x
        </Button>

        <Box sx={{ width: 1, height: 20, bgcolor: 'rgba(148,163,184,0.2)', mx: 0.5 }} />

        <NamespaceControl label="production" sleeping={sleepingNamespaces.has('production')} onSleep={() => handleSleep('production')} onWake={() => handleWake('production')} />
        <NamespaceControl label="staging" sleeping={sleepingNamespaces.has('staging')} onSleep={() => handleSleep('staging')} onWake={() => handleWake('staging')} />
        <NamespaceControl label="dev" sleeping={sleepingNamespaces.has('dev')} onSleep={() => handleSleep('dev')} onWake={() => handleWake('dev')} />

        <Box sx={{ width: 1, height: 20, bgcolor: 'rgba(148,163,184,0.2)', mx: 0.5 }} />

        <Button
          size="small"
          variant="outlined"
          startIcon={<ShuffleIcon />}
          onClick={handleChaos}
          sx={{ color: '#F59E0B', borderColor: 'rgba(245,158,11,0.3)', textTransform: 'none', fontSize: 12 }}
        >
          Add Chaos
        </Button>

        <Box sx={{ width: 1, height: 20, bgcolor: 'rgba(148,163,184,0.2)', mx: 0.5 }} />

        <Chip label={`${stats.running} running`} size="small" sx={{ bgcolor: 'rgba(34,197,94,0.15)', color: '#22C55E', fontSize: 10, height: 22 }} />
        <Chip label={`${stats.pending} pending`} size="small" sx={{ bgcolor: 'rgba(245,158,11,0.15)', color: '#F59E0B', fontSize: 10, height: 22 }} />
        <Chip label={`${stats.failed} failed`} size="small" sx={{ bgcolor: 'rgba(239,68,68,0.15)', color: '#EF4444', fontSize: 10, height: 22 }} />
        <Chip label={`${stats.sleeping} sleeping`} size="small" sx={{ bgcolor: 'rgba(100,116,139,0.15)', color: '#64748B', fontSize: 10, height: 22 }} />
        <Chip label={`${stats.total} total`} size="small" sx={{ bgcolor: 'rgba(148,163,184,0.1)', color: '#94A3B8', fontSize: 10, height: 22 }} />
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function NamespaceControl({
  label,
  sleeping,
  onSleep,
  onWake,
}: {
  label: string
  sleeping: boolean
  onSleep: () => void
  onWake: () => void
}) {
  return (
    <Button
      size="small"
      variant="outlined"
      startIcon={sleeping ? <WbSunnyIcon /> : <BedtimeIcon />}
      onClick={sleeping ? onWake : onSleep}
      sx={{
        color: sleeping ? '#F59E0B' : '#94A3B8',
        borderColor: sleeping ? 'rgba(245,158,11,0.3)' : 'rgba(148,163,184,0.3)',
        textTransform: 'none',
        fontSize: 11,
        minWidth: 0,
        px: 1.2,
      }}
    >
      {sleeping ? `Wake ${label}` : `Sleep ${label}`}
    </Button>
  )
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
