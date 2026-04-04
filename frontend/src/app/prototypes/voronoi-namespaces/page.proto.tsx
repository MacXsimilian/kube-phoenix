'use client'

// PROTOTYPE: D3 Voronoi Namespace Map
// DEPS: framer-motion gsap
// LIBS: SVG, Voronoi Algorithm, Framer Motion, GSAP
// DATA: Namespaces, pod counts, CPU utilization
// DESCRIPTION: Namespaces as Voronoi cells — area encodes pod count, color encodes CPU%

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Slider from '@mui/material/Slider'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import CloseIcon from '@mui/icons-material/Close'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NamespaceStatus = 'active' | 'sleeping'

interface Workload {
  name: string
  kind: 'Deployment' | 'StatefulSet' | 'DaemonSet'
  replicas: number
  cpuPercent: number
}

interface NamespaceData {
  name: string
  pods: number
  cpuPercent: number
  status: NamespaceStatus
  workloads: Workload[]
}

interface CellState {
  namespace: NamespaceData
  x: number
  y: number
  radius: number
  scale: number
  saturation: number
  hovered: boolean
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const INITIAL_NAMESPACES: NamespaceData[] = [
  {
    name: 'production',
    pods: 11,
    cpuPercent: 72,
    status: 'active',
    workloads: [
      { name: 'api-gateway', kind: 'Deployment', replicas: 3, cpuPercent: 82 },
      { name: 'web-frontend', kind: 'Deployment', replicas: 3, cpuPercent: 65 },
      { name: 'order-service', kind: 'Deployment', replicas: 2, cpuPercent: 71 },
      { name: 'postgres', kind: 'StatefulSet', replicas: 3, cpuPercent: 68 },
    ],
  },
  {
    name: 'payments',
    pods: 7,
    cpuPercent: 58,
    status: 'active',
    workloads: [
      { name: 'payment-processor', kind: 'Deployment', replicas: 3, cpuPercent: 62 },
      { name: 'fraud-detector', kind: 'Deployment', replicas: 2, cpuPercent: 55 },
      { name: 'ledger-db', kind: 'StatefulSet', replicas: 2, cpuPercent: 51 },
    ],
  },
  {
    name: 'auth-service',
    pods: 8,
    cpuPercent: 45,
    status: 'active',
    workloads: [
      { name: 'auth-api', kind: 'Deployment', replicas: 3, cpuPercent: 48 },
      { name: 'session-store', kind: 'StatefulSet', replicas: 2, cpuPercent: 40 },
      { name: 'token-issuer', kind: 'Deployment', replicas: 3, cpuPercent: 44 },
    ],
  },
  {
    name: 'data-pipeline',
    pods: 5,
    cpuPercent: 81,
    status: 'active',
    workloads: [
      { name: 'kafka-consumer', kind: 'Deployment', replicas: 2, cpuPercent: 85 },
      { name: 'spark-worker', kind: 'Deployment', replicas: 2, cpuPercent: 79 },
      { name: 'etl-scheduler', kind: 'Deployment', replicas: 1, cpuPercent: 76 },
    ],
  },
  {
    name: 'ml-training',
    pods: 6,
    cpuPercent: 89,
    status: 'active',
    workloads: [
      { name: 'training-gpu', kind: 'Deployment', replicas: 2, cpuPercent: 95 },
      { name: 'model-server', kind: 'Deployment', replicas: 2, cpuPercent: 88 },
      { name: 'feature-store', kind: 'StatefulSet', replicas: 2, cpuPercent: 82 },
    ],
  },
  {
    name: 'internal-tools',
    pods: 3,
    cpuPercent: 22,
    status: 'active',
    workloads: [
      { name: 'admin-panel', kind: 'Deployment', replicas: 1, cpuPercent: 18 },
      { name: 'wiki', kind: 'Deployment', replicas: 1, cpuPercent: 25 },
      { name: 'ci-runner', kind: 'DaemonSet', replicas: 1, cpuPercent: 22 },
    ],
  },
  {
    name: 'staging',
    pods: 6,
    cpuPercent: 35,
    status: 'active',
    workloads: [
      { name: 'api-gateway', kind: 'Deployment', replicas: 2, cpuPercent: 38 },
      { name: 'web-frontend', kind: 'Deployment', replicas: 2, cpuPercent: 30 },
      { name: 'postgres', kind: 'StatefulSet', replicas: 2, cpuPercent: 34 },
    ],
  },
  {
    name: 'monitoring',
    pods: 3,
    cpuPercent: 41,
    status: 'active',
    workloads: [
      { name: 'prometheus', kind: 'StatefulSet', replicas: 1, cpuPercent: 45 },
      { name: 'grafana', kind: 'Deployment', replicas: 1, cpuPercent: 32 },
      { name: 'alertmanager', kind: 'Deployment', replicas: 1, cpuPercent: 44 },
    ],
  },
  {
    name: 'dev-sandbox',
    pods: 2,
    cpuPercent: 15,
    status: 'active',
    workloads: [
      { name: 'sandbox-api', kind: 'Deployment', replicas: 1, cpuPercent: 12 },
      { name: 'sandbox-db', kind: 'StatefulSet', replicas: 1, cpuPercent: 18 },
    ],
  },
]

// ---------------------------------------------------------------------------
// Color utilities
// ---------------------------------------------------------------------------

function cpuToColor(cpuPercent: number, saturation: number): string {
  const t = Math.max(0, Math.min(1, cpuPercent / 100))
  const r = Math.round(30 + t * 200)
  const g = Math.round(120 - t * 80)
  const b = Math.round(220 - t * 180)
  if (saturation < 1) {
    const gray = Math.round(r * 0.3 + g * 0.59 + b * 0.11)
    return `rgb(${Math.round(gray + (r - gray) * saturation)},${Math.round(gray + (g - gray) * saturation)},${Math.round(gray + (b - gray) * saturation)})`
  }
  return `rgb(${r},${g},${b})`
}

function statusBorderColor(ns: NamespaceData): string {
  if (ns.status === 'sleeping') return '#6B7280'
  if (ns.cpuPercent >= 80) return '#EF4444'
  if (ns.cpuPercent >= 50) return '#F59E0B'
  return '#22C55E'
}

// ---------------------------------------------------------------------------
// Layout: force-directed circle packing
// ---------------------------------------------------------------------------

const VIEW_WIDTH = 800
const VIEW_HEIGHT = 600
const CENTER_X = VIEW_WIDTH / 2
const CENTER_Y = VIEW_HEIGHT / 2

function radiusFromPods(pods: number): number {
  return 30 + Math.sqrt(pods) * 28
}

interface LayoutCell {
  x: number
  y: number
  radius: number
  name: string
}

function computeLayout(namespaces: NamespaceData[], sleepingSet: Set<string>): LayoutCell[] {
  const cells: LayoutCell[] = namespaces.map((ns, i) => {
    const isSleeping = sleepingSet.has(ns.name)
    const radius = isSleeping ? radiusFromPods(ns.pods) * 0.6 : radiusFromPods(ns.pods)
    const angle = (Math.PI * 2 * i) / namespaces.length - Math.PI / 2
    const dist = ns.name === 'production' ? 0 : 160 + (9 - ns.pods) * 12
    return {
      x: CENTER_X + dist * Math.cos(angle),
      y: CENTER_Y + dist * Math.sin(angle),
      radius,
      name: ns.name,
    }
  })

  const prodIndex = cells.findIndex(c => c.name === 'production')
  if (prodIndex >= 0) {
    cells[prodIndex].x = CENTER_X
    cells[prodIndex].y = CENTER_Y
  }

  for (let iter = 0; iter < 120; iter++) {
    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        const dx = cells[j].x - cells[i].x
        const dy = cells[j].y - cells[i].y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const minDist = cells[i].radius + cells[j].radius + 8
        if (dist < minDist && dist > 0) {
          const overlap = (minDist - dist) / 2
          const nx = dx / dist
          const ny = dy / dist
          const pushI = cells[i].name === 'production' ? 0.1 : 1
          const pushJ = cells[j].name === 'production' ? 0.1 : 1
          cells[i].x -= nx * overlap * pushI
          cells[i].y -= ny * overlap * pushI
          cells[j].x += nx * overlap * pushJ
          cells[j].y += ny * overlap * pushJ
        }
      }
    }

    for (const cell of cells) {
      const dx = CENTER_X - cell.x
      const dy = CENTER_Y - cell.y
      const gravity = cell.name === 'production' ? 0.15 : 0.03
      cell.x += dx * gravity
      cell.y += dy * gravity
    }
  }

  return cells
}

function generatePolygonPath(cx: number, cy: number, radius: number, sides: number, jitter: number): string {
  const points: string[] = []
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 * i) / sides - Math.PI / 2
    const r = radius + (Math.sin(i * 2.7 + cx * 0.01) * jitter)
    points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`)
  }
  return `M${points.join('L')}Z`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VoronoiNamespacesPrototype() {
  const router = useRouter()
  const svgRef = useRef<SVGSVGElement>(null)
  const cellRefs = useRef<(SVGGElement | null)[]>([])
  const timelineRef = useRef<gsap.core.Timeline | null>(null)
  const sleepTimelinesRef = useRef<Map<string, gsap.core.Timeline>>(new Map())
  const containerRef = useRef<HTMLDivElement>(null)

  const [namespaces, setNamespaces] = useState<NamespaceData[]>(() =>
    INITIAL_NAMESPACES.map(ns => ({ ...ns, workloads: ns.workloads.map(w => ({ ...w })) })),
  )
  const [sleepingSet, setSleepingSet] = useState<Set<string>>(new Set())
  const [hoveredNs, setHoveredNs] = useState<string | null>(null)
  const [selectedNs, setSelectedNs] = useState<string | null>(null)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const speedRef = useRef(speed)
  speedRef.current = speed

  const layout = useMemo(
    () => computeLayout(namespaces, sleepingSet),
    [namespaces, sleepingSet],
  )

  const cellStates: CellState[] = useMemo(
    () =>
      namespaces.map((ns, i) => {
        const cell = layout[i]
        const isSleeping = sleepingSet.has(ns.name)
        return {
          namespace: ns,
          x: cell.x,
          y: cell.y,
          radius: cell.radius,
          scale: 1,
          saturation: isSleeping ? 0.2 : 1,
          hovered: hoveredNs === ns.name,
        }
      }),
    [namespaces, layout, sleepingSet, hoveredNs],
  )

  // -----------------------------------------------------------------------
  // GSAP entrance animation
  // -----------------------------------------------------------------------
  useEffect(() => {
    const cells = cellRefs.current.filter(Boolean)
    if (cells.length === 0) return

    const tl = gsap.timeline()
    timelineRef.current = tl

    cells.forEach((cell, i) => {
      if (!cell) return
      gsap.set(cell, { scale: 0, transformOrigin: 'center center' })
      tl.to(cell, {
        scale: 1,
        duration: 0.4,
        ease: 'back.out(1.7)',
      }, i * 0.06)
    })

    return () => {
      tl.kill()
    }
  }, [])

  // -----------------------------------------------------------------------
  // Sleep animation
  // -----------------------------------------------------------------------
  const triggerSleep = useCallback((nsName: string) => {
    setSleepingSet(prev => {
      const next = new Set(prev)
      next.add(nsName)
      return next
    })
    setNamespaces(prev =>
      prev.map(ns =>
        ns.name === nsName ? { ...ns, status: 'sleeping' as NamespaceStatus } : ns,
      ),
    )

    const idx = namespaces.findIndex(ns => ns.name === nsName)
    const cell = cellRefs.current[idx]
    if (!cell) return

    const existing = sleepTimelinesRef.current.get(nsName)
    if (existing) existing.kill()

    const tl = gsap.timeline()
    tl.to(cell, {
      scale: 0.6,
      duration: 1.5 / speedRef.current,
      ease: 'power2.inOut',
    })
    sleepTimelinesRef.current.set(nsName, tl)
  }, [namespaces])

  const triggerWake = useCallback((nsName: string) => {
    setSleepingSet(prev => {
      const next = new Set(prev)
      next.delete(nsName)
      return next
    })
    setNamespaces(prev =>
      prev.map(ns =>
        ns.name === nsName ? { ...ns, status: 'active' as NamespaceStatus } : ns,
      ),
    )

    const idx = namespaces.findIndex(ns => ns.name === nsName)
    const cell = cellRefs.current[idx]
    if (!cell) return

    const existing = sleepTimelinesRef.current.get(nsName)
    if (existing) existing.kill()

    const tl = gsap.timeline()
    tl.to(cell, {
      scale: 1,
      duration: 0.8 / speedRef.current,
      ease: 'back.out(1.4)',
    })
    sleepTimelinesRef.current.set(nsName, tl)
  }, [namespaces])

  // -----------------------------------------------------------------------
  // Reset
  // -----------------------------------------------------------------------
  const handleReset = useCallback(() => {
    sleepTimelinesRef.current.forEach(tl => tl.kill())
    sleepTimelinesRef.current.clear()
    if (timelineRef.current) timelineRef.current.kill()

    setSleepingSet(new Set())
    setSelectedNs(null)
    setHoveredNs(null)
    setNamespaces(
      INITIAL_NAMESPACES.map(ns => ({ ...ns, workloads: ns.workloads.map(w => ({ ...w })) })),
    )

    requestAnimationFrame(() => {
      const cells = cellRefs.current.filter(Boolean)
      const tl = gsap.timeline()
      timelineRef.current = tl
      cells.forEach((cell, i) => {
        if (!cell) return
        gsap.set(cell, { scale: 0, transformOrigin: 'center center' })
        tl.to(cell, { scale: 1, duration: 0.4, ease: 'back.out(1.7)' }, i * 0.06)
      })
    })
  }, [])

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------
  useEffect(() => {
    return () => {
      if (timelineRef.current) timelineRef.current.kill()
      sleepTimelinesRef.current.forEach(tl => tl.kill())
      sleepTimelinesRef.current.clear()
    }
  }, [])

  // -----------------------------------------------------------------------
  // Selected namespace detail
  // -----------------------------------------------------------------------
  const selectedData = selectedNs
    ? namespaces.find(ns => ns.name === selectedNs) ?? null
    : null

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default', color: 'text.primary' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small" sx={{ color: 'text.secondary' }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
            J5 — Voronoi Namespace Map
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Territory cells — area encodes pod count, color encodes CPU utilization
          </Typography>
        </Box>
      </Box>

      {/* Main canvas */}
      <Box
        ref={containerRef}
        sx={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pb: '56px',
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          style={{ width: '100%', maxWidth: 900, height: '100%', maxHeight: 700 }}
        >
          {/* Background grid dots */}
          <defs>
            <pattern id="grid-dots" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="10" cy="10" r="0.5" fill="currentColor" opacity="0.08" />
            </pattern>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <rect width={VIEW_WIDTH} height={VIEW_HEIGHT} fill="url(#grid-dots)" />

          {/* Cells */}
          {cellStates.map((cell, i) => {
            const isSleeping = sleepingSet.has(cell.namespace.name)
            const isHovered = hoveredNs === cell.namespace.name
            const isSelected = selectedNs === cell.namespace.name
            const sides = 7 + Math.floor(cell.namespace.pods / 3)
            const jitter = cell.radius * 0.08
            const path = generatePolygonPath(cell.x, cell.y, cell.radius, sides, jitter)
            const fillColor = cpuToColor(cell.namespace.cpuPercent, isSleeping ? 0.2 : 1)
            const borderColor = statusBorderColor(cell.namespace)
            const hoverRadius = cell.radius * 1.08

            return (
              <g
                key={cell.namespace.name}
                ref={el => { cellRefs.current[i] = el }}
                style={{ cursor: 'pointer', transformOrigin: `${cell.x}px ${cell.y}px` }}
                onMouseEnter={() => setHoveredNs(cell.namespace.name)}
                onMouseLeave={() => setHoveredNs(null)}
                onClick={() => setSelectedNs(prev => prev === cell.namespace.name ? null : cell.namespace.name)}
              >
                {/* Outer glow on hover */}
                {isHovered && (
                  <path
                    d={generatePolygonPath(cell.x, cell.y, hoverRadius + 6, sides, jitter)}
                    fill="none"
                    stroke={borderColor}
                    strokeWidth={1.5}
                    opacity={0.3}
                    filter="url(#glow)"
                  />
                )}

                {/* Main cell */}
                <path
                  d={isHovered ? generatePolygonPath(cell.x, cell.y, hoverRadius, sides, jitter) : path}
                  fill={fillColor}
                  fillOpacity={isSleeping ? 0.4 : 0.85}
                  stroke={borderColor}
                  strokeWidth={isSelected ? 3 : isHovered ? 2.5 : 1.5}
                  strokeOpacity={isSleeping ? 0.4 : 1}
                  style={{ transition: 'fill 0.6s ease, fill-opacity 0.6s ease, stroke-width 0.2s ease' }}
                />

                {/* Namespace name */}
                <text
                  x={cell.x}
                  y={cell.y - 6}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={isSleeping ? '#6B7280' : '#F1F5F9'}
                  fontSize={cell.radius > 60 ? 13 : 11}
                  fontWeight={700}
                  fontFamily="Inter, system-ui, sans-serif"
                  style={{ pointerEvents: 'none', transition: 'fill 0.6s ease' }}
                >
                  {cell.namespace.name}
                </text>

                {/* Pod count */}
                <text
                  x={cell.x}
                  y={cell.y + 10}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={isSleeping ? '#4B5563' : '#CBD5E1'}
                  fontSize={10}
                  fontFamily="Inter, system-ui, sans-serif"
                  style={{ pointerEvents: 'none', transition: 'fill 0.6s ease' }}
                >
                  {cell.namespace.pods} pods
                </text>

                {/* CPU badge */}
                <text
                  x={cell.x}
                  y={cell.y + 24}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={isSleeping ? '#4B5563' : '#94A3B8'}
                  fontSize={9}
                  fontFamily="monospace"
                  style={{ pointerEvents: 'none', transition: 'fill 0.6s ease' }}
                >
                  {cell.namespace.cpuPercent}% CPU
                </text>

                {/* Sleep icon */}
                {isSleeping && (
                  <text
                    x={cell.x}
                    y={cell.y + 40}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#7C3AED"
                    fontSize={16}
                    style={{ pointerEvents: 'none' }}
                  >
                    ☽
                  </text>
                )}

                {/* Workload list on hover (only for larger cells) */}
                {isHovered && cell.radius > 50 && (
                  <>
                    {cell.namespace.workloads.slice(0, 4).map((wl, wi) => (
                      <text
                        key={wl.name}
                        x={cell.x}
                        y={cell.y + 40 + wi * 13}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#94A3B8"
                        fontSize={8}
                        fontFamily="monospace"
                        style={{ pointerEvents: 'none' }}
                      >
                        {wl.name} ({wl.replicas}r)
                      </text>
                    ))}
                  </>
                )}
              </g>
            )
          })}
        </svg>

        {/* Detail panel */}
        <AnimatePresence>
          {selectedData && (
            <motion.div
              initial={{ x: 320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 320, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: 56,
                width: 320,
                overflow: 'auto',
              }}
            >
              <Box
                sx={{
                  height: '100%',
                  bgcolor: 'background.paper',
                  borderLeft: 1,
                  borderColor: 'divider',
                  p: 2.5,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="h6" fontWeight={700}>
                    {selectedData.name}
                  </Typography>
                  <IconButton size="small" onClick={() => setSelectedNs(null)} sx={{ color: 'text.secondary' }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip
                    label={selectedData.status}
                    size="small"
                    sx={{
                      bgcolor: selectedData.status === 'sleeping' ? 'rgba(124,58,237,0.15)' : 'rgba(34,197,94,0.15)',
                      color: selectedData.status === 'sleeping' ? '#A78BFA' : '#4ADE80',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      fontSize: 10,
                    }}
                  />
                  <Chip
                    label={`${selectedData.pods} pods`}
                    size="small"
                    sx={{ bgcolor: 'action.hover', color: 'text.secondary' }}
                  />
                  <Chip
                    label={`${selectedData.cpuPercent}% CPU`}
                    size="small"
                    sx={{
                      bgcolor: selectedData.cpuPercent >= 80 ? 'rgba(239,68,68,0.15)' : 'action.hover',
                      color: selectedData.cpuPercent >= 80 ? '#F87171' : 'text.secondary',
                    }}
                  />
                </Box>

                {/* CPU bar */}
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                    CPU Utilization
                  </Typography>
                  <Box sx={{ height: 8, borderRadius: 1, bgcolor: 'action.hover', overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${selectedData.cpuPercent}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      style={{
                        height: '100%',
                        borderRadius: 4,
                        background: selectedData.cpuPercent >= 80
                          ? 'linear-gradient(90deg, #F59E0B, #EF4444)'
                          : selectedData.cpuPercent >= 50
                            ? 'linear-gradient(90deg, #22C55E, #F59E0B)'
                            : 'linear-gradient(90deg, #3B82F6, #22C55E)',
                      }}
                    />
                  </Box>
                </Box>

                {/* Workloads */}
                <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 1 }}>
                  Workloads
                </Typography>
                {selectedData.workloads.map(wl => (
                  <Box
                    key={wl.name}
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: 'action.hover',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 0.5,
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" fontWeight={600} sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                        {wl.name}
                      </Typography>
                      <Chip
                        label={wl.kind}
                        size="small"
                        sx={{ fontSize: 9, height: 18, bgcolor: 'action.selected', color: 'text.secondary' }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">
                        {wl.replicas} replicas
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: wl.cpuPercent >= 80 ? '#F87171' : wl.cpuPercent >= 50 ? '#FBBF24' : '#4ADE80',
                          fontWeight: 600,
                          fontFamily: 'monospace',
                        }}
                      >
                        {wl.cpuPercent}%
                      </Typography>
                    </Box>
                    <Box sx={{ height: 4, borderRadius: 0.5, bgcolor: 'action.disabledBackground', overflow: 'hidden' }}>
                      <Box
                        sx={{
                          height: '100%',
                          width: `${wl.cpuPercent}%`,
                          borderRadius: 0.5,
                          bgcolor: wl.cpuPercent >= 80 ? '#EF4444' : wl.cpuPercent >= 50 ? '#F59E0B' : '#22C55E',
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </Box>
                  </Box>
                ))}
              </Box>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>

      {/* Dev Toolbar */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 0.75,
          flexWrap: 'wrap',
        }}
      >
        {/* Play/Pause */}
        <IconButton
          size="small"
          onClick={() => setPlaying(p => !p)}
          sx={{ color: playing ? '#22C55E' : 'text.secondary' }}
        >
          {playing ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
        </IconButton>

        {/* Reset */}
        <IconButton size="small" onClick={handleReset} sx={{ color: 'text.secondary' }}>
          <RestartAltIcon fontSize="small" />
        </IconButton>

        {/* Speed */}
        <Typography variant="caption" sx={{ color: 'text.secondary', ml: 1, minWidth: 32 }}>
          {speed}×
        </Typography>
        <Slider
          value={speed}
          min={0.25}
          max={3}
          step={0.25}
          onChange={(_, v) => setSpeed(v as number)}
          sx={{ width: 80, color: 'text.secondary', '& .MuiSlider-thumb': { width: 12, height: 12 } }}
          size="small"
        />

        <Box sx={{ width: 1, height: 24, bgcolor: 'divider', mx: 1 }} />

        {/* Sleep namespace selectors */}
        {namespaces.map(ns => {
          const isSleeping = sleepingSet.has(ns.name)
          return (
            <Button
              key={ns.name}
              size="small"
              variant="outlined"
              startIcon={isSleeping ? <WbSunnyIcon /> : <BedtimeIcon />}
              onClick={() => isSleeping ? triggerWake(ns.name) : triggerSleep(ns.name)}
              sx={{
                color: isSleeping ? '#F59E0B' : '#7C3AED',
                borderColor: isSleeping ? '#78350F' : '#4C1D95',
                textTransform: 'none',
                fontSize: 11,
                py: 0.25,
                px: 1,
                minWidth: 0,
              }}
            >
              {ns.name}
            </Button>
          )
        })}
      </Box>
    </Box>
  )
}
