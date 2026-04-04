'use client'

// PROTOTYPE: Rough.js Plan Mode Preview
// DEPS: framer-motion gsap
// LIBS: Canvas 2D, Framer Motion, GSAP
// DATA: Policy schedule, workload replicas, node grid
// DESCRIPTION: Draft-mode sketch aesthetic vs clean apply-mode with crossfade transition

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useRouter } from 'next/navigation'
import { useTheme } from '@mui/material/styles'
import gsap from 'gsap'
import { motion, AnimatePresence } from 'framer-motion'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PolicySchedule {
  name: string
  dayRange: string
  startHour: number
  endHour: number
}

interface Workload {
  name: string
  namespace: string
  currentReplicas: number
  sleepReplicas: number
}

interface NodeInfo {
  name: string
  status: 'ready' | 'sleeping' | 'cordoned'
  cpu: number
  memory: number
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const POLICY: PolicySchedule = {
  name: 'Non-production sleep',
  dayRange: 'Mon–Fri',
  startHour: 19,
  endHour: 7,
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const WORKLOADS: Workload[] = [
  { name: 'api-gateway', namespace: 'staging', currentReplicas: 3, sleepReplicas: 0 },
  { name: 'order-service', namespace: 'staging', currentReplicas: 2, sleepReplicas: 0 },
  { name: 'user-service', namespace: 'dev', currentReplicas: 4, sleepReplicas: 1 },
  { name: 'payment-worker', namespace: 'dev', currentReplicas: 2, sleepReplicas: 0 },
  { name: 'notification-svc', namespace: 'staging', currentReplicas: 1, sleepReplicas: 0 },
  { name: 'cache-warmer', namespace: 'dev', currentReplicas: 3, sleepReplicas: 0 },
]

const NODES: NodeInfo[] = [
  { name: 'node-01', status: 'ready', cpu: 72, memory: 65 },
  { name: 'node-02', status: 'sleeping', cpu: 0, memory: 12 },
  { name: 'node-03', status: 'ready', cpu: 45, memory: 58 },
  { name: 'node-04', status: 'cordoned', cpu: 10, memory: 20 },
  { name: 'node-05', status: 'sleeping', cpu: 0, memory: 8 },
  { name: 'node-06', status: 'ready', cpu: 88, memory: 74 },
]

// ---------------------------------------------------------------------------
// Sketch Utilities (manual Rough.js replacement)
// ---------------------------------------------------------------------------

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function sketchyLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rand: () => number,
  jitter = 1.5,
) {
  const passes = 2
  for (let p = 0; p < passes; p++) {
    ctx.beginPath()
    const steps = Math.max(Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 6), 4)
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const x = x1 + (x2 - x1) * t + (rand() - 0.5) * jitter
      const y = y1 + (y2 - y1) * t + (rand() - 0.5) * jitter
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
}

function sketchyRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rand: () => number,
  jitter = 1.5,
) {
  sketchyLine(ctx, x, y, x + w, y, rand, jitter)
  sketchyLine(ctx, x + w, y, x + w, y + h, rand, jitter)
  sketchyLine(ctx, x + w, y + h, x, y + h, rand, jitter)
  sketchyLine(ctx, x, y + h, x, y, rand, jitter)
}

function sketchyFillRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rand: () => number,
  fillColor: string,
  jitter = 1.5,
) {
  ctx.save()
  ctx.globalAlpha = 0.25
  ctx.strokeStyle = fillColor
  ctx.lineWidth = 1
  const gap = 4
  const angle = Math.PI / 4
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const diag = Math.hypot(w, h)
  for (let d = -diag; d < diag; d += gap) {
    const lx1 = x + d * cos
    const ly1 = y + d * sin
    const lx2 = lx1 + diag * sin
    const ly2 = ly1 - diag * cos
    ctx.beginPath()
    ctx.rect(x, y, w, h)
    ctx.save()
    ctx.clip()
    sketchyLine(ctx, lx1, ly1, lx2, ly2, rand, jitter * 0.5)
    ctx.restore()
  }
  ctx.restore()
}

function drawNoiseOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  rand: () => number,
) {
  ctx.save()
  ctx.globalAlpha = 0.03
  ctx.strokeStyle = '#000'
  ctx.lineWidth = 0.5
  for (let i = 0; i < 120; i++) {
    const sx = rand() * width
    const sy = rand() * height
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.lineTo(sx + (rand() - 0.5) * 20, sy + (rand() - 0.5) * 20)
    ctx.stroke()
  }
  ctx.restore()
}

// ---------------------------------------------------------------------------
// Canvas Components
// ---------------------------------------------------------------------------

function TimelineCanvas({
  mode,
  seed,
  palette,
}: {
  mode: 'plan' | 'apply'
  seed: number
  palette: { bg: string; line: string; sleep: string; wake: string; text: string; muted: string }
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const displayW = canvas.clientWidth
    const displayH = canvas.clientHeight
    canvas.width = displayW * dpr
    canvas.height = displayH * dpr
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, displayW, displayH)

    const rand = seededRandom(seed)
    const padLeft = 44
    const padTop = 24
    const cellW = (displayW - padLeft - 12) / 24
    const cellH = (displayH - padTop - 12) / 7

    ctx.font = '10px monospace'
    ctx.fillStyle = palette.muted
    for (let h = 0; h < 24; h += 3) {
      ctx.fillText(`${h.toString().padStart(2, '0')}`, padLeft + h * cellW + 2, padTop - 6)
    }
    for (let d = 0; d < 7; d++) {
      ctx.fillText(DAYS[d], 4, padTop + d * cellH + cellH / 2 + 4)
    }

    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        const x = padLeft + h * cellW
        const y = padTop + d * cellH
        const isSleep = d < 5 && (h >= POLICY.startHour || h < POLICY.endHour)

        if (mode === 'plan') {
          ctx.strokeStyle = palette.line
          ctx.lineWidth = 1
          sketchyRect(ctx, x, y, cellW, cellH, rand, 1.2)
          if (isSleep) {
            sketchyFillRect(ctx, x + 1, y + 1, cellW - 2, cellH - 2, rand, palette.sleep, 1)
          }
        } else {
          ctx.fillStyle = isSleep ? palette.sleep : palette.bg
          ctx.fillRect(x, y, cellW, cellH)
          ctx.strokeStyle = palette.line
          ctx.lineWidth = 0.5
          ctx.strokeRect(x, y, cellW, cellH)
        }
      }
    }

    if (mode === 'plan') {
      drawNoiseOverlay(ctx, displayW, displayH, rand)
      ctx.save()
      ctx.globalAlpha = 0.06
      ctx.font = 'bold 48px monospace'
      ctx.fillStyle = palette.text
      ctx.translate(displayW - 140, displayH - 20)
      ctx.rotate(-0.15)
      ctx.fillText('DRAFT', 0, 0)
      ctx.restore()
    }
  }, [mode, seed, palette])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: 220, display: 'block', borderRadius: 8 }}
    />
  )
}

function ReplicaBarCanvas({
  mode,
  seed,
  palette,
}: {
  mode: 'plan' | 'apply'
  seed: number
  palette: { bg: string; line: string; sleep: string; wake: string; text: string; muted: string; bar: string }
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const displayW = canvas.clientWidth
    const displayH = canvas.clientHeight
    canvas.width = displayW * dpr
    canvas.height = displayH * dpr
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, displayW, displayH)

    const rand = seededRandom(seed + 1000)
    const barH = 22
    const gap = 10
    const labelW = 120
    const maxReplicas = 5
    const barAreaW = displayW - labelW - 20

    WORKLOADS.forEach((wl, i) => {
      const y = i * (barH + gap) + 8
      const currentW = (wl.currentReplicas / maxReplicas) * barAreaW
      const sleepW = (wl.sleepReplicas / maxReplicas) * barAreaW

      ctx.font = '11px monospace'
      ctx.fillStyle = palette.text
      ctx.fillText(wl.name, 4, y + barH / 2 + 4)

      if (mode === 'plan') {
        ctx.strokeStyle = palette.bar
        ctx.lineWidth = 1.5
        sketchyRect(ctx, labelW, y, currentW, barH, rand, 1.8)
        sketchyFillRect(ctx, labelW + 1, y + 1, currentW - 2, barH - 2, rand, palette.bar, 1)

        if (sleepW > 0) {
          ctx.strokeStyle = palette.sleep
          sketchyRect(ctx, labelW, y, sleepW, barH, rand, 1.8)
        }

        ctx.fillStyle = palette.muted
        ctx.fillText(`${wl.currentReplicas} → ${wl.sleepReplicas}`, labelW + currentW + 8, y + barH / 2 + 4)
      } else {
        ctx.fillStyle = palette.bar
        ctx.fillRect(labelW, y, currentW, barH)
        ctx.globalAlpha = 0.4
        ctx.fillStyle = palette.sleep
        ctx.fillRect(labelW, y, sleepW, barH)
        ctx.globalAlpha = 1

        ctx.fillStyle = palette.text
        ctx.font = '11px monospace'
        ctx.fillText(`${wl.currentReplicas} → ${wl.sleepReplicas}`, labelW + currentW + 8, y + barH / 2 + 4)
      }
    })

    if (mode === 'plan') {
      drawNoiseOverlay(ctx, displayW, displayH, rand)
    }
  }, [mode, seed, palette])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: 200, display: 'block', borderRadius: 8 }}
    />
  )
}

function NodeGridCanvas({
  mode,
  seed,
  palette,
}: {
  mode: 'plan' | 'apply'
  seed: number
  palette: {
    bg: string
    line: string
    sleep: string
    wake: string
    text: string
    muted: string
    nodeReady: string
    nodeSleep: string
    nodeCordoned: string
  }
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const displayW = canvas.clientWidth
    const displayH = canvas.clientHeight
    canvas.width = displayW * dpr
    canvas.height = displayH * dpr
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, displayW, displayH)

    const rand = seededRandom(seed + 2000)
    const cols = 3
    const cellW = (displayW - 24) / cols
    const cellH = 80

    const statusColor = (status: NodeInfo['status']) => {
      if (status === 'ready') return palette.nodeReady
      if (status === 'sleeping') return palette.nodeSleep
      return palette.nodeCordoned
    }

    NODES.forEach((node, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = 8 + col * cellW + 4
      const y = 8 + row * (cellH + 12)
      const w = cellW - 12
      const h = cellH
      const color = statusColor(node.status)

      if (mode === 'plan') {
        ctx.strokeStyle = color
        ctx.lineWidth = 1.5
        sketchyRect(ctx, x, y, w, h, rand, 2)
        sketchyFillRect(ctx, x + 2, y + 2, w - 4, h - 4, rand, color, 1)

        ctx.fillStyle = palette.text
        ctx.font = 'bold 10px monospace'
        ctx.fillText(node.name, x + 6, y + 16)
        ctx.font = '9px monospace'
        ctx.fillStyle = palette.muted
        ctx.fillText(node.status, x + 6, y + 30)
        ctx.fillText(`CPU ${node.cpu}%  MEM ${node.memory}%`, x + 6, y + 44)
      } else {
        ctx.fillStyle = color
        ctx.globalAlpha = 0.15
        ctx.beginPath()
        ctx.roundRect(x, y, w, h, 6)
        ctx.fill()
        ctx.globalAlpha = 1

        ctx.strokeStyle = color
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.roundRect(x, y, w, h, 6)
        ctx.stroke()

        ctx.fillStyle = palette.text
        ctx.font = 'bold 11px monospace'
        ctx.fillText(node.name, x + 8, y + 20)
        ctx.font = '10px monospace'
        ctx.fillStyle = palette.muted
        ctx.fillText(node.status, x + 8, y + 34)
        ctx.fillText(`CPU ${node.cpu}%  MEM ${node.memory}%`, x + 8, y + 48)

        const barY = y + 56
        const barW = w - 16
        ctx.fillStyle = palette.bg
        ctx.fillRect(x + 8, barY, barW, 4)
        ctx.fillStyle = color
        ctx.fillRect(x + 8, barY, barW * (node.cpu / 100), 4)
        ctx.fillRect(x + 8, barY + 8, barW * (node.memory / 100), 4)
        ctx.fillStyle = palette.bg
        ctx.fillRect(x + 8, barY + 8, barW, 4)
        ctx.fillStyle = color
        ctx.globalAlpha = 0.6
        ctx.fillRect(x + 8, barY + 8, barW * (node.memory / 100), 4)
        ctx.globalAlpha = 1
      }
    })

    if (mode === 'plan') {
      drawNoiseOverlay(ctx, displayW, displayH, rand)
    }
  }, [mode, seed, palette])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: 190, display: 'block', borderRadius: 8 }}
    />
  )
}

// ---------------------------------------------------------------------------
// Main Prototype
// ---------------------------------------------------------------------------

export default function RoughjsPlanModePrototype() {
  const router = useRouter()
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const [mode, setMode] = useState<'plan' | 'apply'>('plan')
  const [seed, setSeed] = useState(42)
  const flashRef = useRef<HTMLDivElement>(null)
  const gsapTweens = useRef<gsap.core.Tween[]>([])

  const palette = useMemo(() => {
    if (mode === 'plan') {
      return {
        bg: isDark ? '#1a1a2e' : '#f5f0e8',
        line: isDark ? 'rgba(200,200,220,0.3)' : 'rgba(80,70,60,0.25)',
        sleep: isDark ? '#3d3068' : '#8b7bb5',
        wake: isDark ? '#2a4a3a' : '#6aaa78',
        text: isDark ? 'rgba(200,200,220,0.7)' : 'rgba(60,50,40,0.7)',
        muted: isDark ? 'rgba(180,180,200,0.4)' : 'rgba(100,90,80,0.4)',
        bar: isDark ? '#4a6fa5' : '#6889b8',
        nodeReady: isDark ? '#3a7a5a' : '#5a9a6a',
        nodeSleep: isDark ? '#5a4a8a' : '#8a7aba',
        nodeCordoned: isDark ? '#8a5a3a' : '#ba8a5a',
      }
    }
    return {
      bg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
      line: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
      sleep: isDark ? '#7C3AED' : '#8B5CF6',
      wake: isDark ? '#10B981' : '#34D399',
      text: isDark ? 'rgba(255,255,255,0.87)' : 'rgba(0,0,0,0.87)',
      muted: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
      bar: isDark ? '#3B82F6' : '#2563EB',
      nodeReady: isDark ? '#10B981' : '#059669',
      nodeSleep: isDark ? '#7C3AED' : '#6D28D9',
      nodeCordoned: isDark ? '#F59E0B' : '#D97706',
    }
  }, [mode, isDark])

  const handleToggle = useCallback(() => {
    if (flashRef.current) {
      const tween = gsap.fromTo(
        flashRef.current,
        { opacity: 0.6 },
        {
          opacity: 0,
          duration: 0.8,
          ease: 'power2.out',
          onComplete: () => {
            gsapTweens.current = gsapTweens.current.filter((t) => t !== tween)
          },
        },
      )
      gsapTweens.current.push(tween)
    }

    setMode((prev) => (prev === 'plan' ? 'apply' : 'plan'))
    setSeed((prev) => prev + Math.floor(Math.random() * 1000) + 1)
  }, [])

  const handleReset = useCallback(() => {
    setMode('plan')
    setSeed(42)
  }, [])

  useEffect(() => {
    return () => {
      gsapTweens.current.forEach((t) => t.kill())
      gsapTweens.current = []
    }
  }, [])

  const crossfadeInitial = { opacity: 0, filter: 'blur(8px)' }
  const crossfadeAnimate = { opacity: 1, filter: 'blur(0px)' }
  const crossfadeExit = { opacity: 0, filter: 'blur(6px)' }
  const crossfadeTransition = { duration: 0.8, ease: 'easeOut' as const }


  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: 10 }}>
      {/* Ink flash overlay */}
      <Box
        ref={flashRef}
        sx={{
          position: 'fixed',
          inset: 0,
          bgcolor: mode === 'apply' ? 'primary.main' : 'secondary.main',
          opacity: 0,
          pointerEvents: 'none',
          zIndex: 9998,
          mixBlendMode: 'overlay',
        }}
      />

      <Box sx={{ maxWidth: 900, mx: 'auto', py: 4, px: 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <IconButton onClick={() => router.push('/prototypes/')} size="small">
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" fontWeight={800}>
              J7 — Rough.js Plan Mode Preview
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Draft-mode sketch aesthetic vs clean apply-mode with crossfade transition
            </Typography>
          </Box>
          <Chip
            label={mode === 'plan' ? 'PLAN' : 'APPLY'}
            color={mode === 'plan' ? 'warning' : 'success'}
            variant="filled"
            size="small"
            sx={{ fontWeight: 700, fontFamily: 'monospace' }}
          />
        </Box>

        {/* Toggle button */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Button
            variant="contained"
            size="large"
            onClick={handleToggle}
            sx={{
              px: 5,
              py: 1.5,
              fontWeight: 700,
              fontSize: 16,
              borderRadius: 3,
              textTransform: 'none',
              bgcolor: mode === 'plan' ? 'warning.main' : 'success.main',
              '&:hover': {
                bgcolor: mode === 'plan' ? 'warning.dark' : 'success.dark',
              },
            }}
          >
            {mode === 'plan' ? 'Plan Mode → Apply Mode' : 'Apply Mode → Plan Mode'}
          </Button>
        </Box>

        {/* Policy info */}
        <Box
          sx={{
            mb: 3,
            p: 2,
            borderRadius: 2,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            Policy: {POLICY.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {POLICY.dayRange} · {POLICY.startHour}:00 – {POLICY.endHour}:00 · Sleep window
          </Typography>
        </Box>

        {/* Animated panels */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${mode}-${seed}`}
            initial={crossfadeInitial}
            animate={crossfadeAnimate}
            exit={crossfadeExit}
            transition={crossfadeTransition}
          >
            {/* Timeline */}
            <Box
              sx={{
                mb: 3,
                p: 2,
                borderRadius: 2,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                Schedule Timeline (24h × 7 days)
              </Typography>
              <TimelineCanvas mode={mode} seed={seed} palette={palette} />
            </Box>

            {/* Replica bars */}
            <Box
              sx={{
                mb: 3,
                p: 2,
                borderRadius: 2,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                Workload Replicas
              </Typography>
              <ReplicaBarCanvas mode={mode} seed={seed} palette={palette} />
            </Box>

            {/* Node grid */}
            <Box
              sx={{
                mb: 3,
                p: 2,
                borderRadius: 2,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                Node Grid
              </Typography>
              <NodeGridCanvas mode={mode} seed={seed} palette={palette} />
            </Box>
          </motion.div>
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
          borderTop: '1px solid',
          borderColor: 'divider',
          px: 3,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
          J7 Rough.js Plan Mode
        </Typography>
        <Button
          size="small"
          variant={mode === 'plan' ? 'contained' : 'outlined'}
          color="warning"
          onClick={() => {
            if (mode !== 'plan') handleToggle()
          }}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          Plan
        </Button>
        <Button
          size="small"
          variant={mode === 'apply' ? 'contained' : 'outlined'}
          color="success"
          onClick={() => {
            if (mode !== 'apply') handleToggle()
          }}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          Apply
        </Button>
        <Button size="small" variant="text" onClick={handleReset} sx={{ textTransform: 'none' }}>
          Reset
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
          seed: {seed}
        </Typography>
      </Box>
    </Box>
  )
}
