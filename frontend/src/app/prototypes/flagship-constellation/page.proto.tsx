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
import { useRouter } from 'next/navigation'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PodStatus = 'running' | 'pending' | 'failed' | 'sleeping'

interface Pod {
  name: string
  workload: string
  namespace: string
  node: string
  cpu: number
  memory: number
  status: PodStatus
  x: number
  y: number
  baseSize: number
  twinklePhase: number
  twinkleSpeed: number
}

interface Workload {
  name: string
  namespace: string
  podNames: string[]
}

interface NamespaceRegion {
  name: string
  cx: number
  cy: number
  radius: number
  nebulaColor: [number, number, number]
  sleeping: boolean
  sleepProgress: number
  wakeGlowRadius: number
  wakeGlowOpacity: number
}

interface BackgroundStar {
  x: number
  y: number
  size: number
  brightness: number
  twinklePhase: number
  twinkleSpeed: number
}

// ---------------------------------------------------------------------------
// Star color palette
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<PodStatus, { core: string; glow: string }> = {
  running: { core: '#FFF8DC', glow: '#FBBF24' },
  pending: { core: '#F59E0B', glow: '#D97706' },
  failed: { core: '#EF4444', glow: '#DC2626' },
  sleeping: { core: '#444444', glow: '#333333' },
}

const NEBULA_COLORS: Record<string, [number, number, number]> = {
  production: [255, 180, 50],
  staging: [160, 80, 220],
  dev: [60, 120, 255],
  monitoring: [0, 200, 200],
  'kube-system': [200, 160, 60],
}

// ---------------------------------------------------------------------------
// Mock data factory
// ---------------------------------------------------------------------------

function buildMockData(canvasW: number, canvasH: number) {
  const namespaceLayout: Record<string, { cx: number; cy: number }> = {
    production: { cx: 0.35, cy: 0.48 },
    staging: { cx: 0.72, cy: 0.25 },
    dev: { cx: 0.75, cy: 0.72 },
    monitoring: { cx: 0.18, cy: 0.22 },
    'kube-system': { cx: 0.2, cy: 0.75 },
  }

  const workloadDefs: Record<string, Record<string, number>> = {
    production: {
      'api-gateway': 3, 'web-frontend': 2, 'order-svc': 2,
      'payment-svc': 2, 'user-svc': 2, 'notif-svc': 1,
      postgres: 3, redis: 3,
    },
    staging: {
      'api-gateway': 1, 'web-frontend': 1, 'order-svc': 1,
      'payment-svc': 1, postgres: 1, redis: 1,
    },
    dev: {
      'api-gateway': 1, 'web-frontend': 1, 'feature-svc': 1, postgres: 1,
    },
    monitoring: {
      prometheus: 1, grafana: 1, alertmanager: 1, loki: 1,
    },
    'kube-system': {
      coredns: 2, 'kube-proxy': 3, 'metrics-server': 1,
    },
  }

  const nodes = ['node-1', 'node-2', 'node-3', 'node-4']
  const pods: Pod[] = []
  const workloads: Workload[] = []
  const namespaces: NamespaceRegion[] = []

  for (const [ns, wls] of Object.entries(workloadDefs)) {
    const layout = namespaceLayout[ns]
    const regionCx = layout.cx * canvasW
    const regionCy = layout.cy * canvasH
    const nsRadius = ns === 'production' ? 160 : 90
    let wlIndex = 0
    const wlCount = Object.keys(wls).length

    for (const [wlName, count] of Object.entries(wls)) {
      const angle = (wlIndex / wlCount) * Math.PI * 2
      const wlCx = regionCx + Math.cos(angle) * nsRadius * 0.55
      const wlCy = regionCy + Math.sin(angle) * nsRadius * 0.55
      const podNames: string[] = []

      for (let i = 0; i < count; i++) {
        const podAngle = (i / Math.max(count, 1)) * Math.PI * 2 + angle
        const podDist = 15 + Math.random() * 25
        const pod: Pod = {
          name: `${wlName}-${randomHex()}`,
          workload: wlName,
          namespace: ns,
          node: nodes[Math.floor(Math.random() * nodes.length)],
          cpu: 10 + Math.random() * 80,
          memory: 64 + Math.random() * 448,
          status: 'running',
          x: wlCx + Math.cos(podAngle) * podDist,
          y: wlCy + Math.sin(podAngle) * podDist,
          baseSize: 3 + Math.random() * 3,
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.5 + Math.random() * 1.5,
        }
        pods.push(pod)
        podNames.push(pod.name)
      }

      workloads.push({ name: wlName, namespace: ns, podNames })
      wlIndex++
    }

    namespaces.push({
      name: ns,
      cx: regionCx,
      cy: regionCy,
      radius: nsRadius + 40,
      nebulaColor: NEBULA_COLORS[ns] ?? [100, 100, 100],
      sleeping: false,
      sleepProgress: 0,
      wakeGlowRadius: 0,
      wakeGlowOpacity: 0,
    })
  }

  const bgStars: BackgroundStar[] = []
  for (let i = 0; i < 200; i++) {
    bgStars.push({
      x: Math.random() * canvasW,
      y: Math.random() * canvasH,
      size: 0.5 + Math.random(),
      brightness: 0.3 + Math.random() * 0.7,
      twinklePhase: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.3 + Math.random() * 1.2,
    })
  }

  return { pods, workloads, namespaces, bgStars }
}

function randomHex() {
  return Math.random().toString(16).slice(2, 7)
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

function drawHorizonGlow(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const grad = ctx.createLinearGradient(0, h * 0.75, 0, h)
  grad.addColorStop(0, 'rgba(10, 5, 30, 0)')
  grad.addColorStop(0.5, 'rgba(20, 10, 60, 0.15)')
  grad.addColorStop(1, 'rgba(30, 15, 80, 0.25)')
  ctx.fillStyle = grad
  ctx.fillRect(0, h * 0.75, w, h * 0.25)
}

function drawBackgroundStars(
  ctx: CanvasRenderingContext2D,
  stars: BackgroundStar[],
  time: number,
) {
  for (const star of stars) {
    const twinkle = 0.5 + 0.5 * Math.sin(time * star.twinkleSpeed + star.twinklePhase)
    const alpha = star.brightness * twinkle
    ctx.beginPath()
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(200, 210, 255, ${alpha})`
    ctx.fill()
  }
}

function drawNebula(
  ctx: CanvasRenderingContext2D,
  ns: NamespaceRegion,
) {
  const opacity = 0.06 * (1 - ns.sleepProgress)
  if (opacity < 0.001) return
  const [r, g, b] = ns.nebulaColor
  const grad = ctx.createRadialGradient(ns.cx, ns.cy, 0, ns.cx, ns.cy, ns.radius)
  grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${opacity})`)
  grad.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, ${opacity * 0.4})`)
  grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
  ctx.fillStyle = grad
  ctx.fillRect(ns.cx - ns.radius, ns.cy - ns.radius, ns.radius * 2, ns.radius * 2)
}

function drawWakeGlow(ctx: CanvasRenderingContext2D, ns: NamespaceRegion) {
  if (ns.wakeGlowOpacity < 0.001) return
  const grad = ctx.createRadialGradient(ns.cx, ns.cy, 0, ns.cx, ns.cy, ns.wakeGlowRadius)
  grad.addColorStop(0, `rgba(255, 160, 40, ${ns.wakeGlowOpacity * 0.3})`)
  grad.addColorStop(0.5, `rgba(255, 120, 20, ${ns.wakeGlowOpacity * 0.15})`)
  grad.addColorStop(1, 'rgba(255, 100, 10, 0)')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(ns.cx, ns.cy, ns.wakeGlowRadius, 0, Math.PI * 2)
  ctx.fill()
}

function drawConstellationLines(
  ctx: CanvasRenderingContext2D,
  workloads: Workload[],
  podMap: Map<string, Pod>,
  focusedNs: string | null,
) {
  ctx.lineWidth = 0.5
  for (const wl of workloads) {
    const nsPods = wl.podNames.map((n) => podMap.get(n)).filter(Boolean) as Pod[]
    if (nsPods.length < 2) continue
    const dimmed = focusedNs !== null && nsPods[0].namespace !== focusedNs
    const sleeping = nsPods[0].status === 'sleeping'

    if (sleeping) continue
    ctx.strokeStyle = dimmed
      ? 'rgba(255,255,255,0.03)'
      : 'rgba(255,255,255,0.15)'

    for (let i = 0; i < nsPods.length - 1; i++) {
      ctx.beginPath()
      ctx.moveTo(nsPods[i].x, nsPods[i].y)
      ctx.lineTo(nsPods[i + 1].x, nsPods[i + 1].y)
      ctx.stroke()
    }
  }
}

function drawInterNamespaceLines(
  ctx: CanvasRenderingContext2D,
  namespaces: NamespaceRegion[],
) {
  ctx.setLineDash([4, 8])
  ctx.lineWidth = 0.3
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  for (let i = 0; i < namespaces.length; i++) {
    for (let j = i + 1; j < namespaces.length; j++) {
      ctx.beginPath()
      ctx.moveTo(namespaces[i].cx, namespaces[i].cy)
      ctx.lineTo(namespaces[j].cx, namespaces[j].cy)
      ctx.stroke()
    }
  }
  ctx.setLineDash([])
}

function drawPodStar(
  ctx: CanvasRenderingContext2D,
  pod: Pod,
  time: number,
  hovered: boolean,
  focusedNs: string | null,
) {
  const dimmed = focusedNs !== null && pod.namespace !== focusedNs
  const twinkle = 0.7 + 0.3 * Math.sin(time * pod.twinkleSpeed + pod.twinklePhase)

  let size = pod.baseSize * (pod.cpu / 60)
  size = Math.max(1.5, Math.min(size, 7))

  if (pod.status === 'sleeping') {
    size = 1
  }

  if (hovered) {
    size *= 1.5
  }

  const colors = STATUS_COLORS[pod.status]
  let alpha = twinkle
  if (dimmed) alpha *= 0.3
  if (pod.status === 'pending') {
    alpha *= 0.4 + 0.6 * Math.abs(Math.sin(time * 3 + pod.twinklePhase))
  }
  if (pod.status === 'failed') {
    alpha *= 0.5 + 0.5 * Math.abs(Math.sin(time * 6 + pod.twinklePhase))
  }

  const glowRadius = size * 4
  const grad = ctx.createRadialGradient(pod.x, pod.y, 0, pod.x, pod.y, glowRadius)
  grad.addColorStop(0, `rgba(255,255,255,${alpha})`)
  grad.addColorStop(0.2, hexToRgba(colors.core, alpha * 0.8))
  grad.addColorStop(0.5, hexToRgba(colors.glow, alpha * 0.3))
  grad.addColorStop(1, 'rgba(0,0,0,0)')

  ctx.beginPath()
  ctx.arc(pod.x, pod.y, glowRadius, 0, Math.PI * 2)
  ctx.fillStyle = grad
  ctx.fill()

  ctx.beginPath()
  ctx.arc(pod.x, pod.y, size, 0, Math.PI * 2)
  ctx.fillStyle = hexToRgba(colors.core, alpha)
  ctx.fill()
}

function drawLabels(
  ctx: CanvasRenderingContext2D,
  namespaces: NamespaceRegion[],
  workloads: Workload[],
  podMap: Map<string, Pod>,
  focusedNs: string | null,
  clusterCx: number,
  clusterCy: number,
) {
  ctx.textAlign = 'center'

  ctx.font = '11px "JetBrains Mono", "Fira Code", monospace'
  ctx.fillStyle = 'rgba(200, 210, 255, 0.12)'
  ctx.fillText('dev-cluster', clusterCx, clusterCy)

  for (const ns of namespaces) {
    const dimmed = focusedNs !== null && ns.name !== focusedNs
    const alpha = dimmed ? 0.15 : 0.6
    ctx.font = '13px "JetBrains Mono", "Fira Code", monospace'
    ctx.fillStyle = `rgba(200, 210, 255, ${alpha})`
    ctx.fillText(ns.name, ns.cx, ns.cy - ns.radius + 15)

    if (ns.sleeping && ns.sleepProgress > 0.8) {
      drawMoonIcon(ctx, ns.cx, ns.cy, 12, ns.sleepProgress)
    }
  }

  ctx.font = '9px "JetBrains Mono", "Fira Code", monospace'
  for (const wl of workloads) {
    const wlPods = wl.podNames.map((n) => podMap.get(n)).filter(Boolean) as Pod[]
    if (wlPods.length === 0) continue
    const dimmed = focusedNs !== null && wl.namespace !== focusedNs
    if (wlPods[0].status === 'sleeping') continue

    const cx = wlPods.reduce((s, p) => s + p.x, 0) / wlPods.length
    const cy = wlPods.reduce((s, p) => s + p.y, 0) / wlPods.length
    ctx.fillStyle = dimmed
      ? 'rgba(200,210,255,0.08)'
      : 'rgba(200,210,255,0.35)'
    ctx.fillText(wl.name, cx, cy - 18)
  }
}

function drawMoonIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  opacity: number,
) {
  ctx.save()
  ctx.globalAlpha = Math.min(opacity, 0.6)
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = '#555'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x + r * 0.4, y - r * 0.2, r * 0.85, 0, Math.PI * 2)
  ctx.fillStyle = '#000'
  ctx.fill()
  ctx.restore()
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FlagshipConstellationPage() {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)

  const podsRef = useRef<Pod[]>([])
  const workloadsRef = useRef<Workload[]>([])
  const namespacesRef = useRef<NamespaceRegion[]>([])
  const bgStarsRef = useRef<BackgroundStar[]>([])
  const podMapRef = useRef<Map<string, Pod>>(new Map())

  const mouseRef = useRef<{ x: number; y: number }>({ x: -1000, y: -1000 })
  const hoveredPodRef = useRef<string | null>(null)
  const sizeRef = useRef<{ w: number; h: number }>({ w: 1200, h: 800 })
  const simulatingRef = useRef(true)
  const sleepAnimsRef = useRef<Map<string, { type: 'sleep' | 'wake'; startTime: number }>>(new Map())

  const [tooltipData, setTooltipData] = useState<{
    pod: Pod; x: number; y: number
  } | null>(null)
  const [selectedPod, setSelectedPod] = useState<Pod | null>(null)
  const [focusedNs, setFocusedNs] = useState<string | null>(null)
  const [simulating, setSimulating] = useState(true)
  const [stats, setStats] = useState({ total: 0, running: 0, sleeping: 0, failed: 0 })
  const [nsStates, setNsStates] = useState<Record<string, boolean>>({
    production: false, staging: false, dev: false, monitoring: false, 'kube-system': false,
  })

  const focusedNsRef = useRef<string | null>(null)
  useEffect(() => { focusedNsRef.current = focusedNs }, [focusedNs])

  const initializeData = useCallback((w: number, h: number) => {
    const data = buildMockData(w, h)
    podsRef.current = data.pods
    workloadsRef.current = data.workloads
    namespacesRef.current = data.namespaces
    bgStarsRef.current = data.bgStars
    const map = new Map<string, Pod>()
    for (const p of data.pods) map.set(p.name, p)
    podMapRef.current = map
    updateStats()
  }, [])

  const updateStats = useCallback(() => {
    const pods = podsRef.current
    setStats({
      total: pods.length,
      running: pods.filter((p) => p.status === 'running').length,
      sleeping: pods.filter((p) => p.status === 'sleeping').length,
      failed: pods.filter((p) => p.status === 'failed').length,
    })
  }, [])

  const handleSleep = useCallback((nsName: string) => {
    sleepAnimsRef.current.set(nsName, { type: 'sleep', startTime: performance.now() / 1000 })
    setNsStates((prev) => ({ ...prev, [nsName]: true }))
  }, [])

  const handleWake = useCallback((nsName: string) => {
    sleepAnimsRef.current.set(nsName, { type: 'wake', startTime: performance.now() / 1000 })
    setNsStates((prev) => ({ ...prev, [nsName]: false }))
  }, [])

  const handleReset = useCallback(() => {
    sleepAnimsRef.current.clear()
    setNsStates({ production: false, staging: false, dev: false, monitoring: false, 'kube-system': false })
    setFocusedNs(null)
    setSelectedPod(null)
    setTooltipData(null)
    const { w, h } = sizeRef.current
    initializeData(w, h)
  }, [initializeData])

  // ---- Canvas setup & resize ----
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    function resize() {
      const rect = container!.getBoundingClientRect()
      const w = rect.width
      const h = Math.max(rect.height, 700)
      const dpr = window.devicePixelRatio || 1
      canvas!.width = w * dpr
      canvas!.height = h * dpr
      canvas!.style.width = `${w}px`
      canvas!.style.height = `${h}px`
      const ctx = canvas!.getContext('2d')
      if (ctx) ctx.scale(dpr, dpr)
      sizeRef.current = { w, h }

      if (podsRef.current.length === 0) {
        initializeData(w, h)
      }
    }

    const observer = new ResizeObserver(resize)
    observer.observe(container)
    resize()

    return () => observer.disconnect()
  }, [initializeData])

  // ---- Mouse events ----
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }

      let closest: Pod | null = null
      let closestDist = 15
      for (const pod of podsRef.current) {
        const dx = pod.x - mouseRef.current.x
        const dy = pod.y - mouseRef.current.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < closestDist) {
          closestDist = dist
          closest = pod
        }
      }

      hoveredPodRef.current = closest?.name ?? null
      if (closest) {
        setTooltipData({ pod: closest, x: e.clientX - canvas!.getBoundingClientRect().left, y: e.clientY - canvas!.getBoundingClientRect().top })
      } else {
        setTooltipData(null)
      }
    }

    function onClick(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top

      for (const pod of podsRef.current) {
        const dx = pod.x - mx
        const dy = pod.y - my
        if (Math.sqrt(dx * dx + dy * dy) < 15) {
          setSelectedPod(pod)
          return
        }
      }

      for (const ns of namespacesRef.current) {
        const labelY = ns.cy - ns.radius + 15
        if (Math.abs(mx - ns.cx) < 50 && Math.abs(my - labelY) < 12) {
          setFocusedNs((prev) => (prev === ns.name ? null : ns.name))
          setSelectedPod(null)
          return
        }
      }

      setSelectedPod(null)
    }

    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('click', onClick)
    return () => {
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('click', onClick)
    }
  }, [])

  // ---- Simulation tick ----
  useEffect(() => {
    const interval = setInterval(() => {
      if (!simulatingRef.current) return
      const pods = podsRef.current
      if (pods.length === 0) return

      for (let i = 0; i < 2; i++) {
        const idx = Math.floor(Math.random() * pods.length)
        const pod = pods[idx]
        if (pod.status === 'sleeping') continue

        const roll = Math.random()
        if (roll < 0.05) {
          pod.status = 'failed'
        } else if (roll < 0.15) {
          pod.status = 'pending'
        } else {
          pod.status = 'running'
        }

        pod.cpu = Math.max(5, Math.min(95, pod.cpu + (Math.random() - 0.5) * 20))
      }

      updateStats()
    }, 1500)

    return () => clearInterval(interval)
  }, [updateStats])

  // ---- Main render loop ----
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function draw(timestamp: number) {
      const time = timestamp / 1000
      const { w, h } = sizeRef.current
      const dpr = window.devicePixelRatio || 1

      ctx!.save()
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)

      ctx!.fillStyle = '#000'
      ctx!.fillRect(0, 0, w, h)

      drawHorizonGlow(ctx!, w, h)
      drawBackgroundStars(ctx!, bgStarsRef.current, time)

      processSleepWakeAnimations(time)

      for (const ns of namespacesRef.current) {
        drawNebula(ctx!, ns)
        drawWakeGlow(ctx!, ns)
      }

      drawInterNamespaceLines(ctx!, namespacesRef.current)
      drawConstellationLines(ctx!, workloadsRef.current, podMapRef.current, focusedNsRef.current)

      for (const pod of podsRef.current) {
        const hovered = hoveredPodRef.current === pod.name
        drawPodStar(ctx!, pod, time, hovered, focusedNsRef.current)
      }

      const clusterCx = w * 0.5
      const clusterCy = h * 0.5
      drawLabels(ctx!, namespacesRef.current, workloadsRef.current, podMapRef.current, focusedNsRef.current, clusterCx, clusterCy)

      ctx!.restore()
      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  function processSleepWakeAnimations(time: number) {
    const SLEEP_DURATION = 2.5
    const WAKE_DURATION = 3

    for (const [nsName, anim] of sleepAnimsRef.current.entries()) {
      const elapsed = time - anim.startTime
      const ns = namespacesRef.current.find((n) => n.name === nsName)
      if (!ns) continue

      const nsPods = podsRef.current.filter((p) => p.namespace === nsName)

      if (anim.type === 'sleep') {
        const progress = Math.min(elapsed / SLEEP_DURATION, 1)
        ns.sleepProgress = easeInOutCubic(progress)

        for (let i = 0; i < nsPods.length; i++) {
          const podProgress = Math.max(0, (progress - i * 0.04) * 2)
          if (podProgress > 0) {
            nsPods[i].status = 'sleeping'
          }
        }

        ns.wakeGlowOpacity = 0
        ns.wakeGlowRadius = 0

        if (progress >= 1) {
          ns.sleeping = true
          sleepAnimsRef.current.delete(nsName)
          updateStats()
        }
      } else {
        const progress = Math.min(elapsed / WAKE_DURATION, 1)
        const ep = easeInOutCubic(progress)

        ns.wakeGlowRadius = ns.radius * ep * 1.5
        ns.wakeGlowOpacity = progress < 0.4
          ? progress / 0.4
          : 1 - (progress - 0.4) / 0.6

        ns.sleepProgress = 1 - ep

        for (let i = 0; i < nsPods.length; i++) {
          const podProgress = Math.max(0, (progress - i * 0.03) * 2)
          if (podProgress > 0.5) {
            nsPods[i].status = 'running'
            const supernovaT = Math.max(0, podProgress - 0.5) * 2
            if (supernovaT < 1) {
              nsPods[i].baseSize = (3 + Math.random() * 3) * (1 + Math.sin(supernovaT * Math.PI) * 1.2)
            } else {
              nsPods[i].baseSize = 3 + Math.random() * 3
            }
          }
        }

        if (progress >= 1) {
          ns.sleeping = false
          ns.sleepProgress = 0
          ns.wakeGlowOpacity = 0
          ns.wakeGlowRadius = 0
          sleepAnimsRef.current.delete(nsName)
          updateStats()
        }
      }
    }
  }

  useEffect(() => {
    simulatingRef.current = simulating
  }, [simulating])

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        minHeight: 700,
        bgcolor: '#000',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', top: 0, left: 0, cursor: 'crosshair' }}
      />

      {/* Header bar */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)',
          zIndex: 10,
          flexWrap: 'wrap',
        }}
      >
        <IconButton onClick={() => router.push('/prototypes/')} size="small" sx={{ color: '#aaa' }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography variant="subtitle2" sx={{ color: '#ccc', fontFamily: 'monospace', mr: 2 }}>
          FL9 — Constellation Map
        </Typography>

        <IconButton
          size="small"
          onClick={() => setSimulating((s) => !s)}
          sx={{ color: '#888', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 1 }}
        >
          {simulating ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
        </IconButton>

        <IconButton
          size="small"
          onClick={handleReset}
          sx={{ color: '#888', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 1 }}
        >
          <RestartAltIcon fontSize="small" />
        </IconButton>

        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {(['production', 'staging', 'dev'] as const).map((ns) => (
            <Button
              key={ns}
              size="small"
              variant="outlined"
              onClick={() => nsStates[ns] ? handleWake(ns) : handleSleep(ns)}
              sx={{
                color: nsStates[ns] ? '#FBBF24' : '#888',
                borderColor: nsStates[ns] ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.1)',
                fontSize: '0.65rem',
                textTransform: 'none',
                fontFamily: 'monospace',
                minWidth: 0,
                px: 1,
                py: 0.25,
              }}
            >
              {nsStates[ns] ? `Wake ${ns}` : `Sleep ${ns}`}
            </Button>
          ))}
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto', flexWrap: 'wrap' }}>
          <Chip label={`${stats.total} stars`} size="small" sx={chipStyle('#666')} />
          <Chip label={`${stats.running} running`} size="small" sx={chipStyle('#4ade80')} />
          <Chip label={`${stats.sleeping} sleeping`} size="small" sx={chipStyle('#888')} />
          <Chip label={`${stats.failed} failed`} size="small" sx={chipStyle('#EF4444')} />
        </Box>
      </Box>

      {/* Tooltip */}
      {tooltipData && (
        <Box
          sx={{
            position: 'absolute',
            left: tooltipData.x + 16,
            top: tooltipData.y - 10,
            bgcolor: 'rgba(10,10,20,0.92)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 1,
            px: 1.5,
            py: 1,
            zIndex: 20,
            pointerEvents: 'none',
            maxWidth: 260,
          }}
        >
          <Typography sx={{ color: '#FFF8DC', fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700 }}>
            {tooltipData.pod.name}
          </Typography>
          <Typography sx={{ color: '#aaa', fontFamily: 'monospace', fontSize: '0.65rem', mt: 0.3 }}>
            {tooltipData.pod.workload} / {tooltipData.pod.namespace}
          </Typography>
          <Typography sx={{ color: '#888', fontFamily: 'monospace', fontSize: '0.65rem' }}>
            node: {tooltipData.pod.node}
          </Typography>
          <Typography sx={{ color: '#888', fontFamily: 'monospace', fontSize: '0.65rem' }}>
            cpu: {tooltipData.pod.cpu.toFixed(0)}% &nbsp; mem: {tooltipData.pod.memory.toFixed(0)}Mi
          </Typography>
          <Typography sx={{
            color: statusColor(tooltipData.pod.status),
            fontFamily: 'monospace',
            fontSize: '0.65rem',
            fontWeight: 600,
          }}>
            {tooltipData.pod.status}
          </Typography>
        </Box>
      )}

      {/* Selected pod detail card */}
      {selectedPod && (
        <Card
          sx={{
            position: 'absolute',
            right: 20,
            bottom: 20,
            width: 280,
            bgcolor: 'rgba(10,10,25,0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            zIndex: 20,
          }}
        >
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Typography sx={{ color: '#FFF8DC', fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 700, mb: 1 }}>
              {selectedPod.name}
            </Typography>
            {[
              ['Workload', selectedPod.workload],
              ['Namespace', selectedPod.namespace],
              ['Node', selectedPod.node],
              ['CPU', `${selectedPod.cpu.toFixed(1)}%`],
              ['Memory', `${selectedPod.memory.toFixed(0)} Mi`],
              ['Status', selectedPod.status],
            ].map(([label, value]) => (
              <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                <Typography sx={{ color: '#666', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                  {label}
                </Typography>
                <Typography sx={{
                  color: label === 'Status' ? statusColor(value as PodStatus) : '#bbb',
                  fontFamily: 'monospace',
                  fontSize: '0.7rem',
                  fontWeight: label === 'Status' ? 600 : 400,
                }}>
                  {value}
                </Typography>
              </Box>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Focused namespace indicator */}
      {focusedNs && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            bgcolor: 'rgba(10,10,25,0.9)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 1,
            px: 2,
            py: 0.5,
            zIndex: 20,
          }}
        >
          <Typography sx={{ color: '#aaa', fontFamily: 'monospace', fontSize: '0.7rem' }}>
            Focused: <span style={{ color: '#FFF8DC' }}>{focusedNs}</span> — click namespace label to unfocus
          </Typography>
        </Box>
      )}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function statusColor(status: PodStatus): string {
  const map: Record<PodStatus, string> = {
    running: '#4ade80',
    pending: '#F59E0B',
    failed: '#EF4444',
    sleeping: '#666',
  }
  return map[status]
}

function chipStyle(color: string) {
  return {
    bgcolor: 'transparent',
    border: `1px solid ${color}33`,
    color,
    fontFamily: 'monospace',
    fontSize: '0.65rem',
    height: 22,
  }
}
