'use client'

// PROTOTYPE: Floating Metric Bubbles
// DEPS: framer-motion
// LIBS: Canvas 2D Physics, Framer Motion
// DATA: Dashboard metrics
// DESCRIPTION: Dashboard stats as floating physics bubbles that drift and softly collide

import { useState, useRef, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ReplayIcon from '@mui/icons-material/Replay'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import PublicIcon from '@mui/icons-material/Public'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MetricDef {
  id: string
  label: string
  value: number
  displayValue: string
  color: string
  icon: string
}

interface Bubble {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  targetRadius: number
  metric: MetricDef
  popped: boolean
  popTime: number
}

interface BurstParticle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color: string
  radius: number
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const METRICS: MetricDef[] = [
  { id: 'pods', label: 'Active Pods', value: 139, displayValue: '139', color: '#22C55E', icon: '⬡' },
  { id: 'rps', label: 'HTTP RPS', value: 2400, displayValue: '2,400', color: '#3B82F6', icon: '⚡' },
  { id: 'savings', label: 'Savings Today', value: 1842, displayValue: '$18.42', color: '#F59E0B', icon: '💰' },
  { id: 'sleep', label: 'Sleep Hours', value: 1200, displayValue: '12h', color: '#7C3AED', icon: '🌙' },
  { id: 'errors', label: 'Error Rate', value: 200, displayValue: '0.02%', color: '#EF4444', icon: '⚠' },
  { id: 'cache', label: 'Cache Hit', value: 940, displayValue: '94%', color: '#22D3EE', icon: '🎯' },
]

const EXTRA_METRICS: MetricDef[] = [
  { id: 'latency', label: 'P99 Latency', value: 450, displayValue: '45ms', color: '#EC4899', icon: '⏱' },
  { id: 'nodes', label: 'Nodes', value: 800, displayValue: '8', color: '#10B981', icon: '🖥' },
  { id: 'deploys', label: 'Deploys/Day', value: 600, displayValue: '6', color: '#6366F1', icon: '🚀' },
]

// ---------------------------------------------------------------------------
// Physics helpers
// ---------------------------------------------------------------------------

function valueToRadius(value: number): number {
  const minR = 32
  const maxR = 68
  const minV = 200
  const maxV = 2400
  const clamped = Math.max(minV, Math.min(maxV, value))
  return minR + ((clamped - minV) / (maxV - minV)) * (maxR - minR)
}

function initBubble(metric: MetricDef, containerW: number, containerH: number): Bubble {
  const radius = valueToRadius(metric.value)
  const padding = radius + 10
  return {
    id: metric.id,
    x: padding + Math.random() * (containerW - 2 * padding),
    y: padding + Math.random() * (containerH - 2 * padding),
    vx: (Math.random() - 0.5) * 0.8,
    vy: (Math.random() - 0.5) * 0.8,
    radius,
    targetRadius: radius,
    metric,
    popped: false,
    popTime: 0,
  }
}

function resolveCollision(a: Bubble, b: Bubble): void {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  const minDist = a.radius + b.radius

  if (dist >= minDist || dist === 0) return

  const nx = dx / dist
  const ny = dy / dist
  const overlap = (minDist - dist) / 2

  a.x -= nx * overlap
  a.y -= ny * overlap
  b.x += nx * overlap
  b.y += ny * overlap

  const dvx = a.vx - b.vx
  const dvy = a.vy - b.vy
  const dotProduct = dvx * nx + dvy * ny

  if (dotProduct <= 0) return

  const restitution = 0.6
  const impulse = dotProduct * restitution

  a.vx -= impulse * nx
  a.vy -= impulse * ny
  b.vx += impulse * nx
  b.vy += impulse * ny
}

function constrainToWalls(bubble: Bubble, w: number, h: number): void {
  const r = bubble.radius
  if (bubble.x - r < 0) { bubble.x = r; bubble.vx = Math.abs(bubble.vx) * 0.5 }
  if (bubble.x + r > w) { bubble.x = w - r; bubble.vx = -Math.abs(bubble.vx) * 0.5 }
  if (bubble.y - r < 0) { bubble.y = r; bubble.vy = Math.abs(bubble.vy) * 0.5 }
  if (bubble.y + r > h) { bubble.y = h - r; bubble.vy = -Math.abs(bubble.vy) * 0.5 }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MetricBubblesPrototype() {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const bubblesRef = useRef<Bubble[]>([])
  const particlesRef = useRef<BurstParticle[]>([])
  const rafRef = useRef<number>(0)
  const gravityRef = useRef(false)
  const extraIndexRef = useRef(0)

  const [renderTick, setRenderTick] = useState(0)
  const [gravity, setGravity] = useState(false)
  const [selectedBubble, setSelectedBubble] = useState<Bubble | null>(null)
  const [bubbleCount, setBubbleCount] = useState(METRICS.length)

  const getContainerSize = useCallback(() => {
    if (!containerRef.current) return { w: 800, h: 500 }
    const rect = containerRef.current.getBoundingClientRect()
    return { w: rect.width, h: rect.height }
  }, [])

  const spawnBurstParticles = useCallback((x: number, y: number, color: string) => {
    const count = 12
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5
      const speed = 2 + Math.random() * 3
      particlesRef.current.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color,
        radius: 3 + Math.random() * 4,
      })
    }
  }, [])

  const handleBubbleClick = useCallback((bubbleId: string) => {
    const bubble = bubblesRef.current.find(b => b.id === bubbleId)
    if (!bubble || bubble.popped) return

    bubble.popped = true
    bubble.popTime = Date.now()
    bubble.targetRadius = 0
    spawnBurstParticles(bubble.x, bubble.y, bubble.metric.color)
    setSelectedBubble({ ...bubble })

    setTimeout(() => {
      bubble.popped = false
      bubble.targetRadius = valueToRadius(bubble.metric.value)
      setSelectedBubble(null)
    }, 3000)
  }, [spawnBurstParticles])

  const reset = useCallback(() => {
    const { w, h } = getContainerSize()
    bubblesRef.current = METRICS.map(m => initBubble(m, w, h))
    particlesRef.current = []
    extraIndexRef.current = 0
    setBubbleCount(METRICS.length)
    setSelectedBubble(null)
    setGravity(false)
    gravityRef.current = false
  }, [getContainerSize])

  const addMetric = useCallback(() => {
    if (extraIndexRef.current >= EXTRA_METRICS.length) return
    const metric = EXTRA_METRICS[extraIndexRef.current]
    extraIndexRef.current++
    const { w, h } = getContainerSize()
    bubblesRef.current.push(initBubble(metric, w, h))
    setBubbleCount(bubblesRef.current.length)
  }, [getContainerSize])

  const removeMetric = useCallback(() => {
    if (bubblesRef.current.length <= 1) return
    const removed = bubblesRef.current.pop()
    if (removed) {
      spawnBurstParticles(removed.x, removed.y, removed.metric.color)
    }
    setBubbleCount(bubblesRef.current.length)
  }, [spawnBurstParticles])

  const toggleGravity = useCallback(() => {
    setGravity(prev => {
      gravityRef.current = !prev
      return !prev
    })
  }, [])

  useEffect(() => {
    const { w, h } = getContainerSize()
    bubblesRef.current = METRICS.map(m => initBubble(m, w, h))

    const step = () => {
      const { w: cw, h: ch } = getContainerSize()
      const bubbles = bubblesRef.current
      const particles = particlesRef.current

      for (const bubble of bubbles) {
        if (bubble.popped && bubble.radius <= 1) continue

        bubble.vx += (Math.random() - 0.5) * 0.05
        bubble.vy += (Math.random() - 0.5) * 0.05

        if (gravityRef.current) {
          bubble.vy += 0.15
        }

        bubble.vx *= 0.995
        bubble.vy *= 0.995

        const speed = Math.sqrt(bubble.vx * bubble.vx + bubble.vy * bubble.vy)
        const maxSpeed = 3
        if (speed > maxSpeed) {
          bubble.vx = (bubble.vx / speed) * maxSpeed
          bubble.vy = (bubble.vy / speed) * maxSpeed
        }

        bubble.x += bubble.vx
        bubble.y += bubble.vy

        const radiusDiff = bubble.targetRadius - bubble.radius
        bubble.radius += radiusDiff * 0.08

        constrainToWalls(bubble, cw, ch)
      }

      const activeBubbles = bubbles.filter(b => !b.popped || b.radius > 1)
      for (let i = 0; i < activeBubbles.length; i++) {
        for (let j = i + 1; j < activeBubbles.length; j++) {
          resolveCollision(activeBubbles[i], activeBubbles[j])
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.08
        p.life -= 0.025
        if (p.life <= 0) particles.splice(i, 1)
      }

      setRenderTick(t => t + 1)
      rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [getContainerSize])

  void renderTick

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>K7 — Floating Metric Bubbles</Typography>
          <Typography variant="body2" color="text.secondary">
            Physics-driven bubbles — size ∝ value, click to pop, soft elastic collisions
          </Typography>
        </Box>
      </Box>

      <Box
        ref={containerRef}
        sx={{
          position: 'relative',
          width: '100%',
          height: 520,
          borderRadius: 3,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
          cursor: 'default',
        }}
      >
        <AnimatePresence>
          {bubblesRef.current.map(bubble => (
            <BubbleElement
              key={bubble.id}
              bubble={bubble}
              onClick={handleBubbleClick}
            />
          ))}
        </AnimatePresence>

        {particlesRef.current.map((p, i) => (
          <Box
            key={`particle-${i}`}
            sx={{
              position: 'absolute',
              left: p.x - p.radius,
              top: p.y - p.radius,
              width: p.radius * 2,
              height: p.radius * 2,
              borderRadius: '50%',
              bgcolor: p.color,
              opacity: p.life,
              pointerEvents: 'none',
            }}
          />
        ))}

        <AnimatePresence>
          {selectedBubble && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 10,
              }}
            >
              <DetailCard metric={selectedBubble.metric} />
            </motion.div>
          )}
        </AnimatePresence>
      </Box>

      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          display: 'flex',
          gap: 1,
          p: 1.5,
          bgcolor: 'rgba(15, 23, 42, 0.95)',
          borderTop: '1px solid',
          borderColor: 'divider',
          justifyContent: 'center',
          alignItems: 'center',
          backdropFilter: 'blur(8px)',
        }}
      >
        <Button
          variant="contained"
          size="small"
          startIcon={<ReplayIcon fontSize="small" />}
          onClick={reset}
        >
          Reset
        </Button>
        <Button
          variant={gravity ? 'contained' : 'outlined'}
          size="small"
          color={gravity ? 'warning' : 'inherit'}
          startIcon={<PublicIcon fontSize="small" />}
          onClick={toggleGravity}
        >
          Gravity {gravity ? 'ON' : 'OFF'}
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon fontSize="small" />}
          onClick={addMetric}
          disabled={extraIndexRef.current >= EXTRA_METRICS.length}
        >
          Add Metric
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<RemoveIcon fontSize="small" />}
          onClick={removeMetric}
          disabled={bubbleCount <= 1}
        >
          Remove
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
          {bubbleCount} bubbles
        </Typography>
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Bubble element
// ---------------------------------------------------------------------------

interface BubbleElementProps {
  bubble: Bubble
  onClick: (id: string) => void
}

function BubbleElement({ bubble, onClick }: BubbleElementProps) {
  if (bubble.radius < 1) return null

  const diameter = bubble.radius * 2
  const showLabel = bubble.radius > 15

  return (
    <motion.div
      layout={false}
      style={{
        position: 'absolute',
        left: bubble.x - bubble.radius,
        top: bubble.y - bubble.radius,
        width: diameter,
        height: diameter,
        borderRadius: '50%',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: `radial-gradient(circle at 35% 35%, ${bubble.metric.color}44, ${bubble.metric.color}BB)`,
        border: `2px solid ${bubble.metric.color}66`,
        boxShadow: `0 0 ${bubble.radius * 0.4}px ${bubble.metric.color}33, inset 0 -${bubble.radius * 0.2}px ${bubble.radius * 0.4}px ${bubble.metric.color}22`,
        userSelect: 'none',
      }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => onClick(bubble.id)}
    >
      {showLabel && (
        <>
          <span style={{
            fontSize: Math.max(10, bubble.radius * 0.28),
            fontWeight: 700,
            color: '#fff',
            lineHeight: 1.2,
            textAlign: 'center',
          }}>
            {bubble.metric.displayValue}
          </span>
          <span style={{
            fontSize: Math.max(8, bubble.radius * 0.18),
            color: 'rgba(255,255,255,0.7)',
            lineHeight: 1.1,
            textAlign: 'center',
            maxWidth: diameter - 12,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {bubble.metric.label}
          </span>
        </>
      )}
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Detail card
// ---------------------------------------------------------------------------

interface DetailCardProps {
  metric: MetricDef
}

function DetailCard({ metric }: DetailCardProps) {
  return (
    <Paper
      elevation={8}
      sx={{
        p: 3,
        borderRadius: 3,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: metric.color,
        minWidth: 220,
        textAlign: 'center',
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
        {metric.label}
      </Typography>
      <Typography variant="h3" fontWeight={800} sx={{ color: metric.color, mb: 1 }}>
        {metric.displayValue}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Click anywhere to dismiss
      </Typography>
    </Paper>
  )
}
