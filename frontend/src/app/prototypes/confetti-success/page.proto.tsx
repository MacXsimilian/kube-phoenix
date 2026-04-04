'use client'

// PROTOTYPE: Confetti Policy Success
// DEPS: framer-motion gsap
// LIBS: Canvas 2D, Framer Motion, GSAP
// DATA: Wake execution results
// DESCRIPTION: Confetti celebration burst when wake execution completes successfully

import { useCallback, useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'

// ── Types ──────────────────────────────────────────────────────────────────

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  width: number
  height: number
  rotation: number
  rotationSpeed: number
  color: string
  shape: 'rect' | 'circle'
  opacity: number
  gravity: number
  drag: number
}

interface CounterState {
  workloads: number
  nodes: number
  timeSeconds: number
}

// ── Constants ──────────────────────────────────────────────────────────────

const PHOENIX_COLORS = ['#F97316', '#EAB308', '#EF4444', '#F59E0B']
const PARTICLE_COUNT = 120
const CANVAS_WIDTH = 700
const CANVAS_HEIGHT = 500
const FINAL_COUNTS: CounterState = { workloads: 9, nodes: 4, timeSeconds: 134 }

// ── Particle factory ───────────────────────────────────────────────────────

function createParticle(originX: number, originY: number): Particle {
  const angle = Math.random() * Math.PI * 2
  const speed = 4 + Math.random() * 10
  return {
    x: originX,
    y: originY,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 6,
    width: 4 + Math.random() * 8,
    height: 3 + Math.random() * 6,
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 12,
    color: PHOENIX_COLORS[Math.floor(Math.random() * PHOENIX_COLORS.length)],
    shape: Math.random() > 0.3 ? 'rect' : 'circle',
    opacity: 1,
    gravity: 0.15 + Math.random() * 0.1,
    drag: 0.98 + Math.random() * 0.015,
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function ConfettiSuccessPrototype() {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const animFrameRef = useRef<number>(0)
  const [showBadge, setShowBadge] = useState(false)
  const [counters, setCounters] = useState<CounterState>({ workloads: 0, nodes: 0, timeSeconds: 0 })
  const counterTweensRef = useRef<gsap.core.Tween[]>([])

  const stopAnimation = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = 0
    }
  }, [])

  const renderParticles = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    let activeCount = 0
    for (const p of particlesRef.current) {
      if (p.opacity <= 0.01) continue
      activeCount++

      p.vy += p.gravity
      p.vx *= p.drag
      p.vy *= p.drag
      p.x += p.vx
      p.y += p.vy
      p.rotation += p.rotationSpeed

      if (p.y > CANVAS_HEIGHT - 20) {
        p.opacity -= 0.03
      }

      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate((p.rotation * Math.PI) / 180)
      ctx.globalAlpha = p.opacity
      ctx.fillStyle = p.color

      if (p.shape === 'rect') {
        ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height)
      } else {
        ctx.beginPath()
        ctx.arc(0, 0, p.width / 2, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.restore()
    }

    if (activeCount > 0) {
      animFrameRef.current = requestAnimationFrame(renderParticles)
    }
  }, [])

  const startCounters = useCallback(() => {
    counterTweensRef.current.forEach((t) => t.kill())
    counterTweensRef.current = []

    const proxy = { workloads: 0, nodes: 0, timeSeconds: 0 }

    const tween = gsap.to(proxy, {
      workloads: FINAL_COUNTS.workloads,
      nodes: FINAL_COUNTS.nodes,
      timeSeconds: FINAL_COUNTS.timeSeconds,
      duration: 1.5,
      delay: 1.2,
      ease: 'power2.out',
      onUpdate: () => {
        setCounters({
          workloads: Math.round(proxy.workloads),
          nodes: Math.round(proxy.nodes),
          timeSeconds: Math.round(proxy.timeSeconds),
        })
      },
    })
    counterTweensRef.current.push(tween)
  }, [])

  const triggerSuccess = useCallback(() => {
    stopAnimation()
    setShowBadge(false)
    setCounters({ workloads: 0, nodes: 0, timeSeconds: 0 })

    const originX = CANVAS_WIDTH / 2
    const originY = CANVAS_HEIGHT / 2 - 40

    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () =>
      createParticle(originX, originY)
    )

    requestAnimationFrame(() => {
      setShowBadge(true)
      animFrameRef.current = requestAnimationFrame(renderParticles)
      startCounters()
    })
  }, [stopAnimation, renderParticles, startCounters])

  useEffect(() => {
    return () => {
      stopAnimation()
      counterTweensRef.current.forEach((t) => t.kill())
    }
  }, [stopAnimation])

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', py: 4, px: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>K10 — Confetti Policy Success</Typography>
          <Typography variant="body2" color="text.secondary">
            Confetti celebration burst when wake execution completes successfully
          </Typography>
        </Box>
      </Box>

      {/* Demo area */}
      <Box
        sx={{
          position: 'relative',
          p: 3,
          borderRadius: 2,
          bgcolor: 'background.default',
          border: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minHeight: CANVAS_HEIGHT + 60,
          overflow: 'hidden',
        }}
      >
        {/* Canvas overlay */}
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        />

        {/* Content */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: CANVAS_HEIGHT,
            gap: 3,
          }}
        >
          <AnimatePresence>
            {showBadge && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 12 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 3,
                    py: 1.5,
                    borderRadius: 2,
                    bgcolor: '#22C55E15',
                    border: '2px solid #22C55E',
                  }}
                >
                  <CheckCircleIcon sx={{ color: '#22C55E', fontSize: 28 }} />
                  <Typography variant="h6" fontWeight={700} sx={{ color: '#22C55E' }}>
                    Wake Complete
                  </Typography>
                </Box>

                {/* Counter stats */}
                <Box sx={{ display: 'flex', gap: 4, mt: 2 }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" fontWeight={800} sx={{ color: '#F97316' }}>
                      {counters.workloads}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Workloads Restored
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" fontWeight={800} sx={{ color: '#EAB308' }}>
                      {counters.nodes}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Nodes Up
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" fontWeight={800} sx={{ color: '#F59E0B' }}>
                      {formatTime(counters.timeSeconds)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Time Elapsed
                    </Typography>
                  </Box>
                </Box>
              </motion.div>
            )}
          </AnimatePresence>

          {!showBadge && (
            <Typography variant="body2" color="text.secondary">
              Press &quot;Trigger Success&quot; in the toolbar below
            </Typography>
          )}
        </Box>
      </Box>

      {/* Dev Toolbar */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          bgcolor: 'rgba(0,0,0,0.9)',
          backdropFilter: 'blur(8px)',
          borderTop: '1px solid',
          borderColor: 'divider',
          px: 3,
          py: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Typography variant="caption" fontWeight={700} sx={{ color: '#F97316' }}>
          DEV
        </Typography>
        <Button
          size="small"
          variant="contained"
          onClick={triggerSuccess}
          sx={{
            fontSize: 11,
            px: 2,
            py: 0.5,
            bgcolor: '#22C55E',
            '&:hover': { bgcolor: '#16A34A' },
          }}
        >
          Trigger Success
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          {PARTICLE_COUNT} particles &middot; Canvas 2D
        </Typography>
      </Box>
    </Box>
  )
}
