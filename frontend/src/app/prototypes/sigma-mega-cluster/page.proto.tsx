'use client'

// PROTOTYPE: Sigma.js Mega Cluster
// DEPS: framer-motion
// LIBS: Canvas 2D WebGL, Framer Motion, Force-Directed Layout
// DATA: Large cluster graph (500+ nodes)
// DESCRIPTION: WebGL-accelerated 2D graph for large enterprise clusters

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Slider from '@mui/material/Slider'
import Tooltip from '@mui/material/Tooltip'
import { useTheme } from '@mui/material/styles'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import NightsStayIcon from '@mui/icons-material/NightsStay'
import SearchIcon from '@mui/icons-material/Search'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NodeKind = 'namespace' | 'deployment' | 'pod'
type NodeStatus = 'running' | 'pending' | 'failed' | 'sleeping'
type ColorMode = 'status' | 'namespace' | 'cpu'

interface GraphNode {
  id: string
  kind: NodeKind
  label: string
  namespace: string
  cluster: string
  status: NodeStatus
  cpu: number
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  sleeping: boolean
  sleepOpacity: number
  highlighted: boolean
  mass: number
}

interface GraphEdge {
  source: string
  target: string
}

interface Camera {
  x: number
  y: number
  zoom: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_NAMESPACES = [
  'production',
  'payments',
  'auth-service',
  'data-pipeline',
  'ml-training',
  'internal-tools',
  'staging',
  'monitoring',
  'dev-sandbox',
]

const CLUSTERS = ['us-east-1', 'eu-west-1', 'ap-south-1']

const DEPLOYMENT_TEMPLATES = [
  'api-gateway',
  'web-frontend',
  'worker',
  'scheduler',
  'cache',
  'database',
  'ingress',
  'logger',
]

const STATUS_COLORS: Record<NodeStatus, string> = {
  running: '#22C55E',
  pending: '#F59E0B',
  failed: '#EF4444',
  sleeping: '#64748B',
}

const NAMESPACE_COLORS: Record<string, string> = {
  production: '#3B82F6',
  payments: '#8B5CF6',
  'auth-service': '#EC4899',
  'data-pipeline': '#14B8A6',
  'ml-training': '#F97316',
  'internal-tools': '#6366F1',
  staging: '#A855F7',
  monitoring: '#06B6D4',
  'dev-sandbox': '#84CC16',
}

const CPU_GRADIENT = ['#22C55E', '#84CC16', '#EAB308', '#F97316', '#EF4444']

const REPULSION_STRENGTH = 800
const ATTRACTION_STRENGTH = 0.005
const DAMPING = 0.92
const MIN_DISTANCE = 20
const LAYOUT_COOLING = 0.998

// ---------------------------------------------------------------------------
// Mock data generation
// ---------------------------------------------------------------------------

function generateMockGraph(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const rng = seedRandom(42)

  for (const cluster of CLUSTERS) {
    for (const ns of BASE_NAMESPACES) {
      const nsId = `${cluster}/${ns}`
      const deploymentCount = 5 + Math.floor(rng() * 4)
      const centerX = (rng() - 0.5) * 2000
      const centerY = (rng() - 0.5) * 2000

      nodes.push({
        id: nsId,
        kind: 'namespace',
        label: ns,
        namespace: ns,
        cluster,
        status: 'running',
        cpu: 0,
        x: centerX,
        y: centerY,
        vx: 0,
        vy: 0,
        radius: 15,
        sleeping: false,
        sleepOpacity: 1,
        highlighted: false,
        mass: 5,
      })

      for (let d = 0; d < deploymentCount; d++) {
        const tmpl = DEPLOYMENT_TEMPLATES[d % DEPLOYMENT_TEMPLATES.length]
        const depName = `${tmpl}-${d}`
        const depId = `${nsId}/${depName}`
        const depCpu = Math.round(rng() * 100)
        const depStatus = pickStatus(rng)

        nodes.push({
          id: depId,
          kind: 'deployment',
          label: depName,
          namespace: ns,
          cluster,
          status: depStatus,
          cpu: depCpu,
          x: centerX + (rng() - 0.5) * 400,
          y: centerY + (rng() - 0.5) * 400,
          vx: 0,
          vy: 0,
          radius: 8,
          sleeping: false,
          sleepOpacity: 1,
          highlighted: false,
          mass: 2,
        })

        edges.push({ source: nsId, target: depId })

        const podCount = 3 + Math.floor(rng() * 3)
        for (let p = 0; p < podCount; p++) {
          const podId = `${depId}/pod-${p}`
          const podCpu = Math.round(rng() * 100)
          const podStatus = pickStatus(rng)

          nodes.push({
            id: podId,
            kind: 'pod',
            label: `${depName}-pod-${p}`,
            namespace: ns,
            cluster,
            status: podStatus,
            cpu: podCpu,
            x: centerX + (rng() - 0.5) * 500,
            y: centerY + (rng() - 0.5) * 500,
            vx: 0,
            vy: 0,
            radius: 3,
            sleeping: false,
            sleepOpacity: 1,
            highlighted: false,
            mass: 1,
          })

          edges.push({ source: depId, target: podId })
        }
      }
    }
  }

  return { nodes, edges }
}

function pickStatus(rng: () => number): NodeStatus {
  const val = rng()
  if (val < 0.7) return 'running'
  if (val < 0.85) return 'pending'
  if (val < 0.92) return 'sleeping'
  return 'failed'
}

function seedRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 16807 + 0) % 2147483647
    return (state - 1) / 2147483646
  }
}

function cpuToColor(cpu: number): string {
  const idx = Math.min(Math.floor(cpu / 25), 4)
  return CPU_GRADIENT[idx]
}

// ---------------------------------------------------------------------------
// Force-directed layout helpers
// ---------------------------------------------------------------------------

function applyForces(
  nodes: GraphNode[],
  edges: GraphEdge[],
  nodeIndex: Map<string, number>,
  temperature: number,
) {
  const len = nodes.length

  for (let i = 0; i < len; i++) {
    for (let j = i + 1; j < len; j++) {
      const a = nodes[i]
      const b = nodes[j]
      const dx = a.x - b.x
      const dy = a.y - b.y
      const distSq = dx * dx + dy * dy
      const minDistSq = MIN_DISTANCE * MIN_DISTANCE

      if (distSq < minDistSq || distSq === 0) {
        const angle = Math.random() * Math.PI * 2
        const push = REPULSION_STRENGTH * temperature * 0.1
        a.vx += Math.cos(angle) * push
        a.vy += Math.sin(angle) * push
        b.vx -= Math.cos(angle) * push
        b.vy -= Math.sin(angle) * push
        continue
      }

      const force = (REPULSION_STRENGTH * temperature) / distSq
      const dist = Math.sqrt(distSq)
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force

      a.vx += fx / a.mass
      a.vy += fy / a.mass
      b.vx -= fx / b.mass
      b.vy -= fy / b.mass
    }
  }

  for (const edge of edges) {
    const ai = nodeIndex.get(edge.source)
    const bi = nodeIndex.get(edge.target)
    if (ai === undefined || bi === undefined) continue
    const a = nodes[ai]
    const b = nodes[bi]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist === 0) continue

    const force = ATTRACTION_STRENGTH * dist * temperature
    const fx = (dx / dist) * force
    const fy = (dy / dist) * force

    a.vx += fx / a.mass
    a.vy += fy / a.mass
    b.vx -= fx / b.mass
    b.vy -= fy / b.mass
  }

  for (let i = 0; i < len; i++) {
    const n = nodes[i]
    n.vx *= DAMPING
    n.vy *= DAMPING
    n.x += n.vx
    n.y += n.vy
  }
}

// ---------------------------------------------------------------------------
// Barnes-Hut Quadtree for O(n log n) repulsion
// ---------------------------------------------------------------------------

interface QuadBody {
  x: number
  y: number
  mass: number
}

interface QuadNode {
  cx: number
  cy: number
  totalMass: number
  comX: number
  comY: number
  size: number
  body: QuadBody | null
  children: (QuadNode | null)[]
}

function createQuadNode(cx: number, cy: number, size: number): QuadNode {
  return {
    cx,
    cy,
    totalMass: 0,
    comX: 0,
    comY: 0,
    size,
    body: null,
    children: [null, null, null, null],
  }
}

function insertBody(node: QuadNode, body: QuadBody): void {
  if (node.totalMass === 0 && node.body === null) {
    node.body = body
    node.totalMass = body.mass
    node.comX = body.x
    node.comY = body.y
    return
  }

  if (node.size < 1) return

  if (node.body !== null) {
    const existing = node.body
    node.body = null
    insertIntoChild(node, existing)
  }

  node.comX = (node.comX * node.totalMass + body.x * body.mass) / (node.totalMass + body.mass)
  node.comY = (node.comY * node.totalMass + body.y * body.mass) / (node.totalMass + body.mass)
  node.totalMass += body.mass

  insertIntoChild(node, body)
}

function insertIntoChild(node: QuadNode, body: QuadBody): void {
  const halfSize = node.size / 2
  const xIdx = body.x > node.cx ? 1 : 0
  const yIdx = body.y > node.cy ? 1 : 0
  const quadrant = yIdx * 2 + xIdx

  if (node.children[quadrant] === null) {
    const childCx = node.cx + (xIdx === 1 ? halfSize / 2 : -halfSize / 2)
    const childCy = node.cy + (yIdx === 1 ? halfSize / 2 : -halfSize / 2)
    node.children[quadrant] = createQuadNode(childCx, childCy, halfSize)
  }

  insertBody(node.children[quadrant]!, body)
}

function computeBarnesHutForce(
  node: QuadNode,
  target: GraphNode,
  theta: number,
  temperature: number,
): { fx: number; fy: number } {
  if (node.totalMass === 0) return { fx: 0, fy: 0 }

  const dx = target.x - node.comX
  const dy = target.y - node.comY
  const distSq = dx * dx + dy * dy

  if (distSq < MIN_DISTANCE * MIN_DISTANCE) {
    return { fx: 0, fy: 0 }
  }

  const dist = Math.sqrt(distSq)

  if (node.body !== null || node.size / dist < theta) {
    const force = (REPULSION_STRENGTH * temperature * node.totalMass) / distSq
    return {
      fx: (dx / dist) * force,
      fy: (dy / dist) * force,
    }
  }

  let fx = 0
  let fy = 0
  for (const child of node.children) {
    if (child === null) continue
    const cf = computeBarnesHutForce(child, target, theta, temperature)
    fx += cf.fx
    fy += cf.fy
  }
  return { fx, fy }
}

function applyForcesBarnesHut(
  nodes: GraphNode[],
  edges: GraphEdge[],
  nodeIndex: Map<string, number>,
  temperature: number,
) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of nodes) {
    if (n.x < minX) minX = n.x
    if (n.y < minY) minY = n.y
    if (n.x > maxX) maxX = n.x
    if (n.y > maxY) maxY = n.y
  }

  const size = Math.max(maxX - minX, maxY - minY, 100)
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const root = createQuadNode(cx, cy, size * 1.1)

  for (const n of nodes) {
    insertBody(root, { x: n.x, y: n.y, mass: n.mass })
  }

  for (const n of nodes) {
    const { fx, fy } = computeBarnesHutForce(root, n, 0.5, temperature)
    n.vx += fx / n.mass
    n.vy += fy / n.mass
  }

  for (const edge of edges) {
    const ai = nodeIndex.get(edge.source)
    const bi = nodeIndex.get(edge.target)
    if (ai === undefined || bi === undefined) continue
    const a = nodes[ai]
    const b = nodes[bi]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist === 0) continue

    const force = ATTRACTION_STRENGTH * dist * temperature
    const fx = (dx / dist) * force
    const fy = (dy / dist) * force

    a.vx += fx / a.mass
    a.vy += fy / a.mass
    b.vx -= fx / b.mass
    b.vy -= fy / b.mass
  }

  for (const n of nodes) {
    n.vx *= DAMPING
    n.vy *= DAMPING
    n.x += n.vx
    n.y += n.vy
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function getNodeColor(node: GraphNode, colorMode: ColorMode): string {
  switch (colorMode) {
    case 'status':
      return STATUS_COLORS[node.status]
    case 'namespace':
      return NAMESPACE_COLORS[node.namespace] ?? '#94A3B8'
    case 'cpu':
      return cpuToColor(node.cpu)
  }
}

function renderGraph(
  ctx: CanvasRenderingContext2D,
  nodes: GraphNode[],
  edges: GraphEdge[],
  nodeIndex: Map<string, number>,
  camera: Camera,
  colorMode: ColorMode,
  isDark: boolean,
  hoveredNodeId: string | null,
  width: number,
  height: number,
) {
  const bg = isDark ? '#0F172A' : '#F8FAFC'
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)

  ctx.save()
  ctx.translate(width / 2, height / 2)
  ctx.scale(camera.zoom, camera.zoom)
  ctx.translate(-camera.x, -camera.y)

  const edgeAlpha = isDark ? 0.08 : 0.06
  ctx.strokeStyle = isDark
    ? `rgba(148, 163, 184, ${edgeAlpha})`
    : `rgba(100, 116, 139, ${edgeAlpha})`
  ctx.lineWidth = 0.5

  for (const edge of edges) {
    const ai = nodeIndex.get(edge.source)
    const bi = nodeIndex.get(edge.target)
    if (ai === undefined || bi === undefined) continue
    const a = nodes[ai]
    const b = nodes[bi]
    const alpha = Math.min(a.sleepOpacity, b.sleepOpacity) * edgeAlpha
    ctx.globalAlpha = alpha / edgeAlpha
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }

  ctx.globalAlpha = 1

  for (const node of nodes) {
    const color = getNodeColor(node, colorMode)
    const opacity = node.sleeping ? node.sleepOpacity : 1
    const isHovered = hoveredNodeId === node.id
    const isHighlighted = node.highlighted
    const drawRadius = isHovered
      ? node.radius * 1.8
      : isHighlighted
        ? node.radius * 1.5
        : node.radius

    if (isHighlighted || isHovered) {
      ctx.globalAlpha = opacity * 0.4
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(node.x, node.y, drawRadius * 2.5, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.globalAlpha = opacity
    if (node.sleeping) {
      ctx.fillStyle = desaturate(color, 0.7)
    } else {
      ctx.fillStyle = color
    }

    ctx.beginPath()
    ctx.arc(node.x, node.y, drawRadius, 0, Math.PI * 2)
    ctx.fill()

    if (node.kind === 'namespace') {
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    if ((isHovered || isHighlighted) && camera.zoom > 0.3) {
      ctx.globalAlpha = opacity
      ctx.fillStyle = isDark ? '#E2E8F0' : '#1E293B'
      ctx.font = `${Math.max(10, 12 / camera.zoom)}px Inter, sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(node.label, node.x, node.y - drawRadius - 6)
    }
  }

  ctx.restore()
  ctx.globalAlpha = 1
}

function desaturate(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const gray = 0.299 * r + 0.587 * g + 0.114 * b
  const nr = Math.round(r + (gray - r) * amount)
  const ng = Math.round(g + (gray - g) * amount)
  const nb = Math.round(b + (gray - b) * amount)
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SigmaMegaClusterPrototype() {
  const theme = useTheme()
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const nodesRef = useRef<GraphNode[]>([])
  const edgesRef = useRef<GraphEdge[]>([])
  const nodeIndexRef = useRef<Map<string, number>>(new Map())
  const cameraRef = useRef<Camera>({ x: 0, y: 0, zoom: 0.35 })
  const temperatureRef = useRef(1)
  const isDraggingRef = useRef(false)
  const lastMouseRef = useRef({ x: 0, y: 0 })
  const hoveredNodeRef = useRef<string | null>(null)

  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [colorMode, setColorMode] = useState<ColorMode>('status')
  const [isDark, setIsDark] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [nodeCount, setNodeCount] = useState(0)
  const [sleepWaveActive, setSleepWaveActive] = useState(false)
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null)

  const playingRef = useRef(playing)
  const speedRef = useRef(speed)
  const colorModeRef = useRef(colorMode)
  const isDarkRef = useRef(isDark)
  const searchTermRef = useRef(searchTerm)

  useEffect(() => { playingRef.current = playing }, [playing])
  useEffect(() => { speedRef.current = speed }, [speed])
  useEffect(() => { colorModeRef.current = colorMode }, [colorMode])
  useEffect(() => { isDarkRef.current = isDark }, [isDark])
  useEffect(() => { searchTermRef.current = searchTerm }, [searchTerm])

  const initGraph = useCallback(() => {
    const { nodes, edges } = generateMockGraph()
    nodesRef.current = nodes
    edgesRef.current = edges
    const idx = new Map<string, number>()
    nodes.forEach((n, i) => idx.set(n.id, i))
    nodeIndexRef.current = idx
    setNodeCount(nodes.length)
    temperatureRef.current = 1
    cameraRef.current = { x: 0, y: 0, zoom: 0.35 }
  }, [])

  useEffect(() => {
    initGraph()
  }, [initGraph])

  useEffect(() => {
    const term = searchTerm.toLowerCase().trim()
    const nodes = nodesRef.current
    if (!term) {
      for (const n of nodes) n.highlighted = false
      return
    }

    let targetX = 0
    let targetY = 0
    let matchCount = 0

    for (const n of nodes) {
      const matches = n.label.toLowerCase().includes(term) || n.namespace.toLowerCase().includes(term)
      n.highlighted = matches
      if (matches) {
        targetX += n.x
        targetY += n.y
        matchCount++
      }
    }

    if (matchCount > 0) {
      gsap.to(cameraRef.current, {
        x: targetX / matchCount,
        y: targetY / matchCount,
        zoom: Math.max(cameraRef.current.zoom, 0.5),
        duration: 0.8,
        ease: 'power2.out',
      })
    }
  }, [searchTerm])

  const triggerSleepWave = useCallback(() => {
    if (sleepWaveActive) return
    setSleepWaveActive(true)

    const nodes = nodesRef.current
    const productionNodes = nodes.filter((n) => n.namespace === 'production' && n.kind === 'pod')
    if (productionNodes.length === 0) {
      setSleepWaveActive(false)
      return
    }

    const originNode = productionNodes[0]
    const originX = originNode.x
    const originY = originNode.y
    const maxDist = findMaxDistance(nodes, originX, originY)
    const waveState = { radius: 0 }

    gsap.to(waveState, {
      radius: maxDist * 1.2,
      duration: 4,
      ease: 'power1.inOut',
      onUpdate: () => {
        for (const n of nodes) {
          if (n.kind === 'namespace') continue
          const dx = n.x - originX
          const dy = n.y - originY
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < waveState.radius) {
            n.sleeping = true
            const fadeDepth = Math.max(0, 1 - (dist / waveState.radius))
            n.sleepOpacity = 0.15 + 0.85 * (1 - fadeDepth * 0.85)
          }
        }
      },
      onComplete: () => {
        setSleepWaveActive(false)
      },
    })
  }, [sleepWaveActive])

  const resetSleepState = useCallback(() => {
    for (const n of nodesRef.current) {
      n.sleeping = false
      n.sleepOpacity = 1
    }
  }, [])

  const handleReset = useCallback(() => {
    resetSleepState()
    initGraph()
    setSearchTerm('')
  }, [initGraph, resetSleepState])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.scale(dpr, dpr)
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    const loop = () => {
      const rect = canvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height

      if (playingRef.current && temperatureRef.current > 0.01) {
        const iterations = Math.ceil(speedRef.current)
        for (let i = 0; i < iterations; i++) {
          applyForcesBarnesHut(
            nodesRef.current,
            edgesRef.current,
            nodeIndexRef.current,
            temperatureRef.current,
          )
          temperatureRef.current *= LAYOUT_COOLING
        }
      }

      renderGraph(
        ctx,
        nodesRef.current,
        edgesRef.current,
        nodeIndexRef.current,
        cameraRef.current,
        colorModeRef.current,
        isDarkRef.current,
        hoveredNodeRef.current,
        w,
        h,
      )

      drawHUD(ctx, nodesRef.current, w, isDarkRef.current, temperatureRef.current)

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const cam = cameraRef.current
      const zoomFactor = e.deltaY > 0 ? 0.92 : 1.08
      cam.zoom = Math.max(0.05, Math.min(5, cam.zoom * zoomFactor))
    }

    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true
      lastMouseRef.current = { x: e.clientX, y: e.clientY }
    }

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()

      if (isDraggingRef.current) {
        const dx = e.clientX - lastMouseRef.current.x
        const dy = e.clientY - lastMouseRef.current.y
        cameraRef.current.x -= dx / cameraRef.current.zoom
        cameraRef.current.y -= dy / cameraRef.current.zoom
        lastMouseRef.current = { x: e.clientX, y: e.clientY }
        return
      }

      const cam = cameraRef.current
      const mx = (e.clientX - rect.left - rect.width / 2) / cam.zoom + cam.x
      const my = (e.clientY - rect.top - rect.height / 2) / cam.zoom + cam.y

      let closestId: string | null = null
      let closestDist = Infinity
      const hitRadius = 15 / cam.zoom

      for (const node of nodesRef.current) {
        const dx = node.x - mx
        const dy = node.y - my
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < hitRadius + node.radius && dist < closestDist) {
          closestDist = dist
          closestId = node.id
        }
      }

      hoveredNodeRef.current = closestId

      if (closestId !== null) {
        const idx = nodeIndexRef.current.get(closestId)
        if (idx !== undefined) {
          const n = nodesRef.current[idx]
          setHoveredLabel(`${n.label} (${n.kind}) — ${n.namespace}/${n.cluster} — CPU: ${n.cpu}%`)
        }
        canvas.style.cursor = 'pointer'
      } else {
        setHoveredLabel(null)
        canvas.style.cursor = isDraggingRef.current ? 'grabbing' : 'grab'
      }
    }

    const handleMouseUp = () => {
      isDraggingRef.current = false
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('mouseleave', handleMouseUp)

    return () => {
      canvas.removeEventListener('wheel', handleWheel)
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('mouseleave', handleMouseUp)
    }
  }, [])

  return (
    <Box
      sx={{
        width: '100vw',
        height: '100vh',
        position: 'relative',
        overflow: 'hidden',
        bgcolor: isDark ? '#0F172A' : '#F8FAFC',
      }}
    >
      {/* Back button */}
      <Box sx={{ position: 'absolute', top: 16, left: 16, zIndex: 10 }}>
        <IconButton
          onClick={() => router.push('/prototypes')}
          sx={{
            bgcolor: isDark ? 'rgba(15,23,42,0.8)' : 'rgba(248,250,252,0.8)',
            color: isDark ? '#E2E8F0' : '#1E293B',
            backdropFilter: 'blur(8px)',
            '&:hover': { bgcolor: isDark ? 'rgba(30,41,59,0.9)' : 'rgba(226,232,240,0.9)' },
          }}
        >
          <ArrowBackIcon />
        </IconButton>
      </Box>

      {/* Title + stats overlay */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          textAlign: 'center',
        }}
      >
        <Typography
          variant="h5"
          sx={{
            fontWeight: 700,
            color: isDark ? '#E2E8F0' : '#1E293B',
            textShadow: isDark ? '0 2px 8px rgba(0,0,0,0.5)' : 'none',
          }}
        >
          Mega Cluster Graph
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mt: 0.5 }}>
          <Chip
            size="small"
            label={`${nodeCount} nodes`}
            sx={{
              bgcolor: isDark ? 'rgba(30,41,59,0.8)' : 'rgba(226,232,240,0.8)',
              color: isDark ? '#94A3B8' : '#475569',
              backdropFilter: 'blur(4px)',
            }}
          />
          <Chip
            size="small"
            label={`${edgesRef.current.length} edges`}
            sx={{
              bgcolor: isDark ? 'rgba(30,41,59,0.8)' : 'rgba(226,232,240,0.8)',
              color: isDark ? '#94A3B8' : '#475569',
              backdropFilter: 'blur(4px)',
            }}
          />
          <Chip
            size="small"
            label={`${CLUSTERS.length} clusters`}
            sx={{
              bgcolor: isDark ? 'rgba(30,41,59,0.8)' : 'rgba(226,232,240,0.8)',
              color: isDark ? '#94A3B8' : '#475569',
              backdropFilter: 'blur(4px)',
            }}
          />
        </Box>
      </Box>

      {/* Hover tooltip */}
      <AnimatePresence>
        {hoveredLabel && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              top: 80,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10,
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: 13,
              fontFamily: 'monospace',
              background: isDark ? 'rgba(15,23,42,0.9)' : 'rgba(248,250,252,0.95)',
              color: isDark ? '#E2E8F0' : '#1E293B',
              border: `1px solid ${isDark ? 'rgba(148,163,184,0.2)' : 'rgba(100,116,139,0.2)'}`,
              backdropFilter: 'blur(8px)',
              pointerEvents: 'none',
            }}
          >
            {hoveredLabel}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 10,
          p: 1.5,
          borderRadius: 2,
          bgcolor: isDark ? 'rgba(15,23,42,0.85)' : 'rgba(248,250,252,0.9)',
          backdropFilter: 'blur(8px)',
          border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : 'rgba(100,116,139,0.15)'}`,
        }}
      >
        <Typography
          variant="caption"
          sx={{ color: isDark ? '#94A3B8' : '#64748B', fontWeight: 600, mb: 0.5, display: 'block' }}
        >
          Node Size
        </Typography>
        {([
          ['Namespace', 15],
          ['Deployment', 8],
          ['Pod', 3],
        ] as const).map(([label, size]) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.3 }}>
            <Box
              sx={{
                width: size * 2,
                height: size * 2,
                borderRadius: '50%',
                bgcolor: isDark ? '#94A3B8' : '#64748B',
                flexShrink: 0,
              }}
            />
            <Typography variant="caption" sx={{ color: isDark ? '#94A3B8' : '#64748B', fontSize: 11 }}>
              {label}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          cursor: 'grab',
          display: 'block',
        }}
      />

      {/* Dev Toolbar */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1,
          bgcolor: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(248,250,252,0.95)',
          backdropFilter: 'blur(12px)',
          borderTop: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : 'rgba(100,116,139,0.15)'}`,
        }}
      >
        {/* Play/Pause */}
        <Tooltip title={playing ? 'Pause layout' : 'Resume layout'}>
          <IconButton
            size="small"
            onClick={() => setPlaying((p) => !p)}
            sx={{ color: isDark ? '#E2E8F0' : '#1E293B' }}
          >
            {playing ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        {/* Reset */}
        <Tooltip title="Reset graph">
          <IconButton
            size="small"
            onClick={handleReset}
            sx={{ color: isDark ? '#E2E8F0' : '#1E293B' }}
          >
            <RestartAltIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* Speed */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 120 }}>
          <Typography variant="caption" sx={{ color: isDark ? '#94A3B8' : '#64748B', whiteSpace: 'nowrap' }}>
            Speed
          </Typography>
          <Slider
            size="small"
            min={0.1}
            max={5}
            step={0.1}
            value={speed}
            onChange={(_, v) => setSpeed(v as number)}
            sx={{
              width: 80,
              color: isDark ? '#3B82F6' : '#2563EB',
              '& .MuiSlider-thumb': { width: 12, height: 12 },
            }}
          />
          <Typography variant="caption" sx={{ color: isDark ? '#94A3B8' : '#64748B', minWidth: 28 }}>
            {speed.toFixed(1)}x
          </Typography>
        </Box>

        {/* Color mode */}
        <ToggleButtonGroup
          size="small"
          exclusive
          value={colorMode}
          onChange={(_, v) => { if (v) setColorMode(v) }}
          sx={{
            '& .MuiToggleButton-root': {
              color: isDark ? '#94A3B8' : '#64748B',
              borderColor: isDark ? 'rgba(148,163,184,0.2)' : 'rgba(100,116,139,0.2)',
              fontSize: 11,
              px: 1,
              py: 0.3,
              '&.Mui-selected': {
                bgcolor: isDark ? 'rgba(59,130,246,0.2)' : 'rgba(37,99,235,0.15)',
                color: isDark ? '#60A5FA' : '#2563EB',
              },
            },
          }}
        >
          <ToggleButton value="status">Status</ToggleButton>
          <ToggleButton value="namespace">Namespace</ToggleButton>
          <ToggleButton value="cpu">CPU%</ToggleButton>
        </ToggleButtonGroup>

        {/* Dark/Light toggle */}
        <Tooltip title={isDark ? 'Light mode' : 'Dark mode'}>
          <IconButton
            size="small"
            onClick={() => setIsDark((d) => !d)}
            sx={{ color: isDark ? '#E2E8F0' : '#1E293B' }}
          >
            {isDark ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        {/* Search */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
          <SearchIcon sx={{ color: isDark ? '#94A3B8' : '#64748B', fontSize: 18 }} />
          <TextField
            size="small"
            placeholder="Search nodes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            variant="outlined"
            sx={{
              width: 180,
              '& .MuiOutlinedInput-root': {
                height: 28,
                fontSize: 12,
                color: isDark ? '#E2E8F0' : '#1E293B',
                '& fieldset': {
                  borderColor: isDark ? 'rgba(148,163,184,0.2)' : 'rgba(100,116,139,0.2)',
                },
              },
            }}
          />
        </Box>

        {/* Sleep wave trigger */}
        <Tooltip title="Trigger sleep wave from production">
          <span>
            <Button
              size="small"
              variant="outlined"
              startIcon={<NightsStayIcon />}
              disabled={sleepWaveActive}
              onClick={triggerSleepWave}
              sx={{
                fontSize: 11,
                textTransform: 'none',
                borderColor: isDark ? 'rgba(124,58,237,0.4)' : 'rgba(124,58,237,0.3)',
                color: isDark ? '#A78BFA' : '#7C3AED',
                '&:hover': {
                  borderColor: '#7C3AED',
                  bgcolor: 'rgba(124,58,237,0.1)',
                },
              }}
            >
              Sleep Wave
            </Button>
          </span>
        </Tooltip>
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// HUD overlay (drawn on canvas for performance)
// ---------------------------------------------------------------------------

function drawHUD(
  ctx: CanvasRenderingContext2D,
  nodes: GraphNode[],
  width: number,
  isDark: boolean,
  temperature: number,
) {
  const sleeping = nodes.filter((n) => n.sleeping).length
  const running = nodes.filter((n) => n.status === 'running' && !n.sleeping).length
  const failed = nodes.filter((n) => n.status === 'failed').length

  ctx.globalAlpha = 1
  ctx.font = '11px Inter, sans-serif'
  ctx.fillStyle = isDark ? '#64748B' : '#94A3B8'
  ctx.textAlign = 'left'

  const y = 20
  const lines = [
    `Running: ${running}`,
    `Sleeping: ${sleeping}`,
    `Failed: ${failed}`,
    `Temp: ${temperature.toFixed(3)}`,
  ]

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], 12, y + i * 16)
  }
}

function findMaxDistance(nodes: GraphNode[], ox: number, oy: number): number {
  let max = 0
  for (const n of nodes) {
    const dx = n.x - ox
    const dy = n.y - oy
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > max) max = dist
  }
  return max
}
