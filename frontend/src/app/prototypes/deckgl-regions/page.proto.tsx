'use client'

// PROTOTYPE: Deck.gl Multi-Region Map
// DEPS: framer-motion gsap
// LIBS: Canvas 2D, SVG, Framer Motion, GSAP
// DATA: Cloud regions, cluster health, traffic arcs
// DESCRIPTION: Multi-region cluster map with animated arcs and sleep state visualization

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import SpeedIcon from '@mui/icons-material/Speed'
import PublicIcon from '@mui/icons-material/Public'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import LightModeIcon from '@mui/icons-material/LightMode'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useTheme } from '@mui/material/styles'
import { useRouter } from 'next/navigation'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RegionStatus = 'healthy' | 'sleeping'

interface CloudRegion {
  id: string
  name: string
  label: string
  xPercent: number
  yPercent: number
  nodeCount: number
  podCount: number
  replicaCount: number
  status: RegionStatus
}

interface TrafficArc {
  from: string
  to: string
  reqPerMin: number
  label: string
}

interface Particle {
  t: number
  speed: number
  arcIndex: number
}

interface GridDot {
  x: number
  y: number
  brightness: number
  phase: number
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const INITIAL_REGIONS: CloudRegion[] = [
  {
    id: 'eu-west-1',
    name: 'EU West (Ireland)',
    label: 'eu-west-1',
    xPercent: 0.30,
    yPercent: 0.30,
    nodeCount: 6,
    podCount: 139,
    replicaCount: 12,
    status: 'healthy',
  },
  {
    id: 'us-east-1',
    name: 'US East (Virginia)',
    label: 'us-east-1',
    xPercent: 0.20,
    yPercent: 0.40,
    nodeCount: 8,
    podCount: 212,
    replicaCount: 18,
    status: 'healthy',
  },
  {
    id: 'ap-southeast-1',
    name: 'AP Southeast (Singapore)',
    label: 'ap-southeast-1',
    xPercent: 0.75,
    yPercent: 0.55,
    nodeCount: 4,
    podCount: 87,
    replicaCount: 8,
    status: 'healthy',
  },
]

const TRAFFIC_ARCS: TrafficArc[] = [
  { from: 'eu-west-1', to: 'us-east-1', reqPerMin: 2400, label: 'Replication' },
  { from: 'eu-west-1', to: 'ap-southeast-1', reqPerMin: 800, label: 'Sync' },
  { from: 'us-east-1', to: 'ap-southeast-1', reqPerMin: 1200, label: 'Mirror' },
]

const HEALTH_COLORS: Record<RegionStatus, string> = {
  healthy: '#22C55E',
  sleeping: '#64748B',
}

const ARC_COLOR_AWAKE = '#22C55E'
const ARC_COLOR_SLEEP = '#475569'
const PARTICLE_COLOR = '#86EFAC'
const GRID_COLOR = 'rgba(100, 116, 139, 0.15)'
const BAR_COLOR_AWAKE = '#3B82F6'
const BAR_COLOR_SLEEP = '#334155'

const SPEED_OPTIONS = [0.5, 1, 2, 4]
const PARTICLES_PER_ARC = 6

// ---------------------------------------------------------------------------
// Continent outlines (simplified mercator-projected polygons, normalized 0-1)
// ---------------------------------------------------------------------------

const CONTINENT_PATHS: number[][][] = [
  // North America
  [
    [0.05, 0.15], [0.12, 0.12], [0.18, 0.15], [0.22, 0.20],
    [0.25, 0.28], [0.22, 0.35], [0.20, 0.42], [0.18, 0.48],
    [0.15, 0.50], [0.10, 0.48], [0.08, 0.42], [0.05, 0.35],
    [0.03, 0.25],
  ],
  // South America
  [
    [0.18, 0.55], [0.22, 0.52], [0.25, 0.55], [0.26, 0.62],
    [0.25, 0.70], [0.22, 0.78], [0.20, 0.82], [0.18, 0.78],
    [0.17, 0.70], [0.16, 0.62],
  ],
  // Europe
  [
    [0.30, 0.15], [0.35, 0.13], [0.38, 0.15], [0.40, 0.20],
    [0.38, 0.28], [0.35, 0.32], [0.32, 0.30], [0.30, 0.25],
    [0.28, 0.20],
  ],
  // Africa
  [
    [0.32, 0.38], [0.36, 0.35], [0.40, 0.38], [0.42, 0.45],
    [0.40, 0.55], [0.38, 0.65], [0.35, 0.70], [0.32, 0.65],
    [0.30, 0.55], [0.30, 0.45],
  ],
  // Asia
  [
    [0.42, 0.12], [0.50, 0.10], [0.58, 0.12], [0.65, 0.15],
    [0.72, 0.18], [0.78, 0.22], [0.80, 0.30], [0.78, 0.38],
    [0.72, 0.42], [0.65, 0.45], [0.58, 0.42], [0.50, 0.38],
    [0.45, 0.32], [0.42, 0.25], [0.40, 0.18],
  ],
  // Southeast Asia / Indonesia
  [
    [0.70, 0.48], [0.74, 0.50], [0.78, 0.52], [0.82, 0.55],
    [0.80, 0.58], [0.76, 0.56], [0.72, 0.54], [0.68, 0.52],
  ],
  // Australia
  [
    [0.78, 0.65], [0.82, 0.62], [0.86, 0.65], [0.88, 0.70],
    [0.86, 0.75], [0.82, 0.78], [0.78, 0.75], [0.76, 0.70],
  ],
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateGridDots(count: number): GridDot[] {
  const dots: GridDot[] = []
  for (let i = 0; i < count; i++) {
    dots.push({
      x: Math.random(),
      y: Math.random(),
      brightness: 0.2 + Math.random() * 0.6,
      phase: Math.random() * Math.PI * 2,
    })
  }
  return dots
}

function generateParticles(): Particle[] {
  const particles: Particle[] = []
  for (let a = 0; a < TRAFFIC_ARCS.length; a++) {
    for (let p = 0; p < PARTICLES_PER_ARC; p++) {
      particles.push({
        t: p / PARTICLES_PER_ARC,
        speed: 0.002 + Math.random() * 0.001,
        arcIndex: a,
      })
    }
  }
  return particles
}

function bezierPoint(
  x0: number, y0: number,
  cx: number, cy: number,
  x1: number, y1: number,
  t: number,
): [number, number] {
  const u = 1 - t
  return [
    u * u * x0 + 2 * u * t * cx + t * t * x1,
    u * u * y0 + 2 * u * t * cy + t * t * y1,
  ]
}

function arcControlPoint(
  x0: number, y0: number,
  x1: number, y1: number,
): [number, number] {
  const mx = (x0 + x1) / 2
  const my = (y0 + y1) / 2
  const dist = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2)
  return [mx, my - dist * 0.35]
}

// ---------------------------------------------------------------------------
// Canvas Renderer
// ---------------------------------------------------------------------------

function useCanvasRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  regions: CloudRegion[],
  playing: boolean,
  speed: number,
  sleepTransitions: Record<string, number>,
) {
  const particlesRef = useRef<Particle[]>(generateParticles())
  const gridDotsRef = useRef<GridDot[]>(generateGridDots(120))
  const animFrameRef = useRef<number>(0)
  const timeRef = useRef(0)

  const regionMapRef = useRef(new Map<string, CloudRegion>())
  useEffect(() => {
    const m = new Map<string, CloudRegion>()
    for (const r of regions) m.set(r.id, r)
    regionMapRef.current = m
  }, [regions])

  const sleepRef = useRef(sleepTransitions)
  useEffect(() => { sleepRef.current = sleepTransitions }, [sleepTransitions])

  const playingRef = useRef(playing)
  useEffect(() => { playingRef.current = playing }, [playing])

  const speedRef = useRef(speed)
  useEffect(() => { speedRef.current = speed }, [speed])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function resizeCanvas() {
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    function render() {
      if (!canvas || !ctx) return
      const rect = canvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      const regionMap = regionMapRef.current
      const sleep = sleepRef.current

      ctx.clearRect(0, 0, w, h)

      drawContinents(ctx, w, h)
      drawGridDots(ctx, w, h, gridDotsRef.current, timeRef.current)
      drawArcs(ctx, w, h, regionMap, sleep, particlesRef.current, timeRef.current)
      drawRegionBars(ctx, w, h, regionMap, sleep)
      drawRegionMarkers(ctx, w, h, regionMap, sleep, timeRef.current)

      if (playingRef.current) {
        const dt = speedRef.current
        timeRef.current += 0.016 * dt

        for (const p of particlesRef.current) {
          const arc = TRAFFIC_ARCS[p.arcIndex]
          const fromR = regionMap.get(arc.from)
          const toR = regionMap.get(arc.to)
          if (!fromR || !toR) continue
          const fromSleep = sleep[arc.from] ?? 1
          const toSleep = sleep[arc.to] ?? 1
          if (fromSleep < 0.1 || toSleep < 0.1) continue
          p.t += p.speed * dt
          if (p.t > 1) p.t -= 1
        }
      }

      animFrameRef.current = requestAnimationFrame(render)
    }

    animFrameRef.current = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [canvasRef])
}

function drawContinents(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save()
  for (const path of CONTINENT_PATHS) {
    ctx.beginPath()
    for (let i = 0; i < path.length; i++) {
      const x = path[i][0] * w
      const y = path[i][1] * h
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fillStyle = 'rgba(51, 65, 85, 0.25)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.3)'
    ctx.lineWidth = 1
    ctx.stroke()
  }
  ctx.restore()
}

function drawGridDots(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  dots: GridDot[],
  time: number,
) {
  ctx.save()
  for (const dot of dots) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 0.8 + dot.phase)
    const alpha = dot.brightness * pulse * 0.4
    ctx.fillStyle = `rgba(100, 116, 139, ${alpha})`
    ctx.beginPath()
    ctx.arc(dot.x * w, dot.y * h, 1.5, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawArcs(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  regionMap: Map<string, CloudRegion>,
  sleep: Record<string, number>,
  particles: Particle[],
  time: number,
) {
  ctx.save()

  for (let i = 0; i < TRAFFIC_ARCS.length; i++) {
    const arc = TRAFFIC_ARCS[i]
    const fromR = regionMap.get(arc.from)
    const toR = regionMap.get(arc.to)
    if (!fromR || !toR) continue

    const fromAlive = sleep[arc.from] ?? 1
    const toAlive = sleep[arc.to] ?? 1
    const arcAlive = Math.min(fromAlive, toAlive)

    const x0 = fromR.xPercent * w
    const y0 = fromR.yPercent * h
    const x1 = toR.xPercent * w
    const y1 = toR.yPercent * h
    const [cx, cy] = arcControlPoint(x0, y0, x1, y1)

    const lineWidth = 1 + (arc.reqPerMin / 1000) * 1.5
    const arcColor = arcAlive > 0.5 ? ARC_COLOR_AWAKE : ARC_COLOR_SLEEP

    ctx.globalAlpha = arcAlive * 0.6
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.quadraticCurveTo(cx, cy, x1, y1)
    ctx.strokeStyle = arcColor
    ctx.lineWidth = lineWidth
    ctx.stroke()

    const glowAlpha = arcAlive * 0.15
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.quadraticCurveTo(cx, cy, x1, y1)
    ctx.strokeStyle = arcColor
    ctx.lineWidth = lineWidth + 4
    ctx.globalAlpha = glowAlpha
    ctx.stroke()

    ctx.globalAlpha = 1
  }

  for (const p of particles) {
    const arc = TRAFFIC_ARCS[p.arcIndex]
    const fromR = regionMap.get(arc.from)
    const toR = regionMap.get(arc.to)
    if (!fromR || !toR) continue

    const fromAlive = sleep[arc.from] ?? 1
    const toAlive = sleep[arc.to] ?? 1
    const arcAlive = Math.min(fromAlive, toAlive)
    if (arcAlive < 0.05) continue

    const x0 = fromR.xPercent * w
    const y0 = fromR.yPercent * h
    const x1 = toR.xPercent * w
    const y1 = toR.yPercent * h
    const [cx, cy] = arcControlPoint(x0, y0, x1, y1)

    const [px, py] = bezierPoint(x0, y0, cx, cy, x1, y1, p.t)
    const size = 2 + (arc.reqPerMin / 2400) * 2

    ctx.globalAlpha = arcAlive
    ctx.fillStyle = PARTICLE_COLOR
    ctx.beginPath()
    ctx.arc(px, py, size, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = PARTICLE_COLOR
    ctx.globalAlpha = arcAlive * 0.3
    ctx.beginPath()
    ctx.arc(px, py, size + 3, 0, Math.PI * 2)
    ctx.fill()

    ctx.globalAlpha = 1
  }

  ctx.restore()
}

function drawRegionBars(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  regionMap: Map<string, CloudRegion>,
  sleep: Record<string, number>,
) {
  ctx.save()

  for (const region of regionMap.values()) {
    const alive = sleep[region.id] ?? 1
    const x = region.xPercent * w
    const y = region.yPercent * h

    const maxBarHeight = 60
    const barWidth = 8
    const barGap = 4
    const barCount = 3
    const totalWidth = barCount * barWidth + (barCount - 1) * barGap
    const startX = x - totalWidth / 2
    const barBase = y - 35

    const heights = [
      region.replicaCount / 18 * maxBarHeight * alive,
      region.podCount / 212 * maxBarHeight * 0.7 * alive,
      region.nodeCount / 8 * maxBarHeight * 0.5 * alive,
    ]

    const colors = alive > 0.5
      ? [BAR_COLOR_AWAKE, '#6366F1', '#8B5CF6']
      : [BAR_COLOR_SLEEP, BAR_COLOR_SLEEP, BAR_COLOR_SLEEP]

    for (let i = 0; i < barCount; i++) {
      const bx = startX + i * (barWidth + barGap)
      const bh = heights[i]

      ctx.fillStyle = colors[i]
      ctx.globalAlpha = 0.8
      ctx.fillRect(bx, barBase - bh, barWidth, bh)

      ctx.fillStyle = colors[i]
      ctx.globalAlpha = 0.2
      ctx.fillRect(bx, barBase - bh - 2, barWidth, bh + 2)
    }
  }

  ctx.globalAlpha = 1
  ctx.restore()
}

function drawRegionMarkers(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  regionMap: Map<string, CloudRegion>,
  sleep: Record<string, number>,
  time: number,
) {
  ctx.save()

  for (const region of regionMap.values()) {
    const alive = sleep[region.id] ?? 1
    const x = region.xPercent * w
    const y = region.yPercent * h

    const baseRadius = 10 + region.nodeCount * 2
    const pulse = alive > 0.5 ? 1 + 0.08 * Math.sin(time * 2) : 1
    const radius = baseRadius * pulse

    const color = alive > 0.5 ? HEALTH_COLORS.healthy : HEALTH_COLORS.sleeping

    ctx.beginPath()
    ctx.arc(x, y, radius + 8, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.globalAlpha = alive * 0.12
    ctx.fill()

    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.globalAlpha = alive * 0.3 + 0.15
    ctx.fill()

    ctx.beginPath()
    ctx.arc(x, y, radius * 0.6, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.globalAlpha = 0.9
    ctx.fill()

    ctx.globalAlpha = 1
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 11px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(region.label, x, y + baseRadius + 12)

    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.font = '10px system-ui, sans-serif'
    ctx.fillText(
      `${region.nodeCount}N · ${region.podCount}P`,
      x, y + baseRadius + 26,
    )
  }

  ctx.globalAlpha = 1
  ctx.restore()
}

// ---------------------------------------------------------------------------
// Sleeping label overlay
// ---------------------------------------------------------------------------

function SleepingLabels({
  regions,
  sleepTransitions,
  containerRef,
}: {
  regions: CloudRegion[]
  sleepTransitions: Record<string, number>
  containerRef: React.RefObject<HTMLDivElement | null>
}) {
  const [dims, setDims] = useState({ w: 0, h: 0 })

  useEffect(() => {
    function measure() {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      setDims({ w: rect.width, h: rect.height })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [containerRef])

  return (
    <AnimatePresence>
      {regions
        .filter((r) => (sleepTransitions[r.id] ?? 1) < 0.3)
        .map((r) => (
          <motion.div
            key={`sleep-${r.id}`}
            initial={{ opacity: 0, scale: 0.6, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: -10 }}
            transition={{ duration: 0.4 }}
            style={{
              position: 'absolute',
              left: r.xPercent * dims.w - 40,
              top: r.yPercent * dims.h - 50,
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            <Box
              sx={{
                bgcolor: 'rgba(30, 41, 59, 0.9)',
                border: '1px solid rgba(100, 116, 139, 0.5)',
                borderRadius: 1,
                px: 1.5,
                py: 0.5,
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
              }}
            >
              <BedtimeIcon sx={{ fontSize: 14, color: '#94A3B8' }} />
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  color: '#94A3B8',
                  letterSpacing: 1.5,
                  fontSize: 10,
                }}
              >
                SLEEPING
              </Typography>
            </Box>
          </motion.div>
        ))}
    </AnimatePresence>
  )
}

// ---------------------------------------------------------------------------
// Traffic Legend
// ---------------------------------------------------------------------------

function TrafficLegend({ regions, sleepTransitions }: {
  regions: CloudRegion[]
  sleepTransitions: Record<string, number>
}) {
  const theme = useTheme()

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 5,
        bgcolor: theme.palette.mode === 'dark'
          ? 'rgba(15, 23, 42, 0.85)'
          : 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(8px)',
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
        p: 2,
        minWidth: 200,
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 700, color: theme.palette.text.secondary, mb: 1.5, display: 'block' }}>
        TRAFFIC FLOWS
      </Typography>
      {TRAFFIC_ARCS.map((arc) => {
        const fromAlive = sleepTransitions[arc.from] ?? 1
        const toAlive = sleepTransitions[arc.to] ?? 1
        const active = Math.min(fromAlive, toAlive) > 0.3
        return (
          <Box key={`${arc.from}-${arc.to}`} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8, opacity: active ? 1 : 0.4 }}>
            <Box sx={{ width: 20, height: 2, bgcolor: active ? ARC_COLOR_AWAKE : ARC_COLOR_SLEEP, borderRadius: 1 }} />
            <Typography variant="caption" sx={{ fontSize: 10, color: theme.palette.text.secondary, fontFamily: 'monospace' }}>
              {arc.from.split('-').slice(0, 2).join('-')} → {arc.to.split('-').slice(0, 2).join('-')}
            </Typography>
            <Typography variant="caption" sx={{ fontSize: 10, color: theme.palette.text.primary, fontWeight: 600, ml: 'auto' }}>
              {active ? `${(arc.reqPerMin / 1000).toFixed(1)}k/m` : '—'}
            </Typography>
          </Box>
        )
      })}

      <Box sx={{ mt: 2, pt: 1.5, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: theme.palette.text.secondary, mb: 1, display: 'block' }}>
          REGIONS
        </Typography>
        {regions.map((r) => {
          const alive = sleepTransitions[r.id] ?? 1
          const isSleeping = alive < 0.3
          return (
            <Box key={r.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: isSleeping ? HEALTH_COLORS.sleeping : HEALTH_COLORS.healthy }} />
              <Typography variant="caption" sx={{ fontSize: 10, color: theme.palette.text.secondary }}>
                {r.label}
              </Typography>
              <Chip
                label={isSleeping ? 'Sleep' : 'Awake'}
                size="small"
                sx={{
                  ml: 'auto',
                  height: 18,
                  fontSize: 9,
                  fontWeight: 600,
                  bgcolor: isSleeping ? 'rgba(100,116,139,0.2)' : 'rgba(34,197,94,0.15)',
                  color: isSleeping ? '#94A3B8' : '#22C55E',
                }}
              />
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Dev Toolbar
// ---------------------------------------------------------------------------

function DevToolbar({
  regions,
  sleepTransitions,
  onToggleSleep,
  playing,
  onTogglePlay,
  onReset,
  speed,
  onCycleSpeed,
}: {
  regions: CloudRegion[]
  sleepTransitions: Record<string, number>
  onToggleSleep: (id: string) => void
  playing: boolean
  onTogglePlay: () => void
  onReset: () => void
  speed: number
  onCycleSpeed: () => void
}) {
  const theme = useTheme()

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        bgcolor: theme.palette.mode === 'dark'
          ? 'rgba(15, 23, 42, 0.95)'
          : 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(12px)',
        borderTop: `1px solid ${theme.palette.divider}`,
        px: 2,
        py: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <Chip
        icon={<PublicIcon />}
        label="J9 Regions"
        size="small"
        sx={{ fontWeight: 700, fontFamily: 'monospace' }}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Tooltip title={playing ? 'Pause' : 'Play'}>
          <IconButton size="small" onClick={onTogglePlay}>
            {playing ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        <Tooltip title="Reset">
          <IconButton size="small" onClick={onReset}>
            <RestartAltIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title={`Speed: ${speed}x`}>
          <IconButton size="small" onClick={onCycleSpeed}>
            <SpeedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: theme.palette.text.secondary }}>
          {speed}x
        </Typography>
      </Box>

      <Box sx={{ height: 20, width: 1, bgcolor: theme.palette.divider }} />

      {regions.map((region) => {
        const alive = sleepTransitions[region.id] ?? 1
        const isSleeping = alive < 0.3
        return (
          <Tooltip key={region.id} title={`${isSleeping ? 'Wake' : 'Sleep'} ${region.id}`}>
            <Button
              size="small"
              variant={isSleeping ? 'outlined' : 'contained'}
              startIcon={isSleeping ? <BedtimeIcon /> : <LightModeIcon />}
              onClick={() => onToggleSleep(region.id)}
              sx={{
                textTransform: 'none',
                fontFamily: 'monospace',
                fontSize: 11,
                minWidth: 0,
                ...(isSleeping && {
                  borderColor: theme.palette.divider,
                  color: theme.palette.text.secondary,
                }),
                ...(!isSleeping && {
                  bgcolor: '#22C55E',
                  '&:hover': { bgcolor: '#16A34A' },
                }),
              }}
            >
              {region.label.split('-').slice(0, 2).join('-')}
            </Button>
          </Tooltip>
        )
      })}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function DeckglRegionsPrototype() {
  const theme = useTheme()
  const router = useRouter()

  const [regions, setRegions] = useState<CloudRegion[]>(INITIAL_REGIONS)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [sleepTransitions, setSleepTransitions] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {}
    for (const r of INITIAL_REGIONS) m[r.id] = 1
    return m
  })

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const tweensRef = useRef<Map<string, gsap.core.Tween>>(new Map())

  useCanvasRenderer(canvasRef, regions, playing, speed, sleepTransitions)

  const handleToggleSleep = useCallback((id: string) => {
    const current = sleepTransitions[id] ?? 1
    const target = current > 0.5 ? 0 : 1

    const existing = tweensRef.current.get(id)
    if (existing) existing.kill()

    const obj = { value: current }
    const tween = gsap.to(obj, {
      value: target,
      duration: 1,
      ease: 'power2.inOut',
      onUpdate: () => {
        setSleepTransitions((prev) => ({ ...prev, [id]: obj.value }))
      },
      onComplete: () => {
        setRegions((prev) =>
          prev.map((r) =>
            r.id === id ? { ...r, status: target < 0.5 ? 'sleeping' as const : 'healthy' as const } : r,
          ),
        )
        tweensRef.current.delete(id)
      },
    })
    tweensRef.current.set(id, tween)
  }, [sleepTransitions])

  const handleReset = useCallback(() => {
    for (const tween of tweensRef.current.values()) tween.kill()
    tweensRef.current.clear()

    setRegions(INITIAL_REGIONS)
    const m: Record<string, number> = {}
    for (const r of INITIAL_REGIONS) m[r.id] = 1
    setSleepTransitions(m)
    setPlaying(true)
    setSpeed(1)
  }, [])

  const handleCycleSpeed = useCallback(() => {
    setSpeed((prev) => {
      const idx = SPEED_OPTIONS.indexOf(prev)
      return SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length]
    })
  }, [])

  useEffect(() => {
    return () => {
      for (const tween of tweensRef.current.values()) tween.kill()
    }
  }, [])

  return (
    <Box
      sx={{
        width: '100vw',
        height: '100vh',
        bgcolor: theme.palette.mode === 'dark' ? '#0B1120' : '#F1F5F9',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 5,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          px: 3,
          py: 2,
        }}
      >
        <Tooltip title="Back to prototypes">
          <IconButton size="small" onClick={() => router.push('/prototypes')}>
            <ArrowBackIcon />
          </IconButton>
        </Tooltip>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Multi-Region Map
        </Typography>
        <Chip
          label="J9"
          size="small"
          sx={{
            fontWeight: 700,
            fontFamily: 'monospace',
            bgcolor: theme.palette.mode === 'dark' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
            color: '#3B82F6',
          }}
        />
        <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
          Canvas 2D · Animated traffic arcs · Sleep/wake state
        </Typography>
      </Box>

      {/* Canvas container */}
      <Box
        ref={containerRef}
        sx={{
          position: 'absolute',
          inset: 0,
          top: 60,
          bottom: 56,
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />

        <SleepingLabels
          regions={regions}
          sleepTransitions={sleepTransitions}
          containerRef={containerRef}
        />
      </Box>

      {/* Traffic Legend */}
      <Box sx={{ position: 'absolute', top: 60, right: 0, bottom: 56 }}>
        <TrafficLegend regions={regions} sleepTransitions={sleepTransitions} />
      </Box>

      {/* Dev Toolbar */}
      <DevToolbar
        regions={regions}
        sleepTransitions={sleepTransitions}
        onToggleSleep={handleToggleSleep}
        playing={playing}
        onTogglePlay={() => setPlaying((p) => !p)}
        onReset={handleReset}
        speed={speed}
        onCycleSpeed={handleCycleSpeed}
      />
    </Box>
  )
}
