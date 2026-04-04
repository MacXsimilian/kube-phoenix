'use client'

// PROTOTYPE: Particle Search
// DEPS: framer-motion gsap
// LIBS: Canvas 2D, Framer Motion, GSAP
// DATA: Searchable workload names
// DESCRIPTION: Search input with particle burst effects and animated result filtering

import { useState, useRef, useCallback, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Slider from '@mui/material/Slider'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SearchIcon from '@mui/icons-material/Search'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import gsap from 'gsap'

// ── Data ────────────────────────────────────────────────────────────────────

interface Workload {
  name: string
  namespace: string
  replicas: number
}

const WORKLOADS: Workload[] = [
  { name: 'api-gateway', namespace: 'production', replicas: 3 },
  { name: 'checkout-service', namespace: 'production', replicas: 2 },
  { name: 'payment-processor', namespace: 'production', replicas: 4 },
  { name: 'user-auth', namespace: 'production', replicas: 3 },
  { name: 'session-manager', namespace: 'production', replicas: 2 },
  { name: 'kafka-consumer', namespace: 'data', replicas: 6 },
  { name: 'spark-driver', namespace: 'data', replicas: 1 },
  { name: 'feature-store', namespace: 'data', replicas: 2 },
  { name: 'grafana', namespace: 'monitoring', replicas: 1 },
  { name: 'prometheus', namespace: 'monitoring', replicas: 1 },
  { name: 'admin-portal', namespace: 'internal', replicas: 1 },
  { name: 'staging-api', namespace: 'staging', replicas: 2 },
  { name: 'dev-api', namespace: 'development', replicas: 1 },
  { name: 'redis-sentinel', namespace: 'data', replicas: 3 },
]

const NAMESPACE_COLORS: Record<string, string> = {
  production: '#22C55E',
  data: '#3B82F6',
  monitoring: '#F59E0B',
  internal: '#7C3AED',
  staging: '#F97316',
  development: '#06B6D4',
}

// ── Particle types ──────────────────────────────────────────────────────────

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
  alpha: number
}

type ParticleMode = 'burst' | 'implode' | 'trail' | 'idle'

// ── Particle engine ─────────────────────────────────────────────────────────

function createBurstParticles(
  cx: number,
  cy: number,
  width: number,
  height: number,
  count: number,
): Particle[] {
  const particles: Particle[] = []
  const edges = ['top', 'bottom', 'left', 'right'] as const

  for (let i = 0; i < count; i++) {
    const edge = edges[i % edges.length]
    let x = cx
    let y = cy

    if (edge === 'top') { x = cx - width / 2 + Math.random() * width; y = cy - height / 2 }
    if (edge === 'bottom') { x = cx - width / 2 + Math.random() * width; y = cy + height / 2 }
    if (edge === 'left') { x = cx - width / 2; y = cy - height / 2 + Math.random() * height }
    if (edge === 'right') { x = cx + width / 2; y = cy - height / 2 + Math.random() * height }

    const angle = Math.atan2(y - cy, x - cx) + (Math.random() - 0.5) * 0.8
    const speed = 1.5 + Math.random() * 3

    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      maxLife: 40 + Math.random() * 40,
      size: 1.5 + Math.random() * 2.5,
      color: ['#3B82F6', '#22C55E', '#F59E0B', '#7C3AED', '#F97316'][Math.floor(Math.random() * 5)],
      alpha: 0.9,
    })
  }
  return particles
}

function createImplodeParticles(cx: number, cy: number, count: number): Particle[] {
  const particles: Particle[] = []
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const dist = 80 + Math.random() * 120
    particles.push({
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      vx: 0,
      vy: 0,
      life: 1,
      maxLife: 50 + Math.random() * 30,
      size: 1 + Math.random() * 2,
      color: '#EF4444',
      alpha: 0.8,
    })
  }
  return particles
}

function createTrailParticle(x: number, y: number): Particle {
  return {
    x: x + (Math.random() - 0.5) * 6,
    y: y + (Math.random() - 0.5) * 6,
    vx: (Math.random() - 0.5) * 0.5,
    vy: -0.5 - Math.random() * 1,
    life: 1,
    maxLife: 20 + Math.random() * 15,
    size: 1 + Math.random() * 1.5,
    color: ['#3B82F6', '#22C55E', '#F59E0B'][Math.floor(Math.random() * 3)],
    alpha: 0.7,
  }
}

function updateParticles(
  particles: Particle[],
  mode: ParticleMode,
  centerX: number,
  centerY: number,
): Particle[] {
  return particles
    .map(p => {
      const age = 1 - p.life / p.maxLife
      let { vx, vy } = p

      if (mode === 'implode') {
        const dx = centerX - p.x
        const dy = centerY - p.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > 1) {
          vx += (dx / dist) * 0.15
          vy += (dy / dist) * 0.15
        }
      }

      return {
        ...p,
        x: p.x + vx,
        y: p.y + vy,
        vx: vx * 0.97,
        vy: vy * 0.97 + (mode === 'burst' ? 0.02 : 0),
        life: p.life - 1,
        alpha: p.alpha * (1 - age * 0.5),
      }
    })
    .filter(p => p.life > 0)
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  for (const p of particles) {
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
    ctx.fillStyle = p.color
    ctx.globalAlpha = Math.max(0, p.alpha * (p.life / p.maxLife))
    ctx.fill()

    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2)
    ctx.fillStyle = p.color
    ctx.globalAlpha = Math.max(0, p.alpha * (p.life / p.maxLife) * 0.15)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

// ── Result item variants ────────────────────────────────────────────────────

const resultVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: i * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  }),
  exit: { opacity: 0, y: -10, scale: 0.95, transition: { duration: 0.2 } },
}

// ── Component ───────────────────────────────────────────────────────────────

export default function ParticleSearchPrototype() {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const inputWrapperRef = useRef<HTMLDivElement>(null)
  const animFrameRef = useRef<number>(0)
  const particlesRef = useRef<Particle[]>([])
  const modeRef = useRef<ParticleMode>('idle')
  const mouseRef = useRef({ x: 0, y: 0, hovering: false })
  const trailCounterRef = useRef(0)

  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [maxParticles, setMaxParticles] = useState(120)

  const filtered = query.trim()
    ? WORKLOADS.filter(w =>
        w.name.includes(query.toLowerCase()) ||
        w.namespace.includes(query.toLowerCase()),
      )
    : WORKLOADS

  const noResults = query.trim().length > 0 && filtered.length === 0

  const getInputCenter = useCallback((): { cx: number; cy: number; w: number; h: number } => {
    const el = inputWrapperRef.current
    if (!el) return { cx: 0, cy: 0, w: 0, h: 0 }
    const rect = el.getBoundingClientRect()
    return {
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2,
      w: rect.width,
      h: rect.height,
    }
  }, [])

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
  }, [])

  // Canvas animation loop
  useEffect(() => {
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const { cx, cy } = getInputCenter()
      particlesRef.current = updateParticles(particlesRef.current, modeRef.current, cx, cy)

      if (mouseRef.current.hovering) {
        trailCounterRef.current++
        if (trailCounterRef.current % 3 === 0) {
          particlesRef.current.push(createTrailParticle(mouseRef.current.x, mouseRef.current.y))
        }
      }

      if (particlesRef.current.length > maxParticles) {
        particlesRef.current = particlesRef.current.slice(-maxParticles)
      }

      drawParticles(ctx, particlesRef.current)
      animFrameRef.current = requestAnimationFrame(loop)
    }

    animFrameRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [maxParticles, resizeCanvas, getInputCenter])

  const handleFocus = useCallback(() => {
    setFocused(true)
    modeRef.current = 'burst'
    const { cx, cy, w, h } = getInputCenter()
    const burst = createBurstParticles(cx, cy, w, h, Math.floor(maxParticles * 0.4))
    particlesRef.current.push(...burst)

    if (inputWrapperRef.current) {
      gsap.fromTo(inputWrapperRef.current,
        { boxShadow: '0 0 0 0 rgba(59,130,246,0)' },
        { boxShadow: '0 0 24px 4px rgba(59,130,246,0.3)', duration: 0.5, ease: 'power2.out' },
      )
    }

    setTimeout(() => { modeRef.current = 'idle' }, 800)
  }, [getInputCenter, maxParticles])

  const handleBlur = useCallback(() => {
    setFocused(false)
    if (inputWrapperRef.current) {
      gsap.to(inputWrapperRef.current, {
        boxShadow: '0 0 0 0 rgba(59,130,246,0)',
        duration: 0.4,
        ease: 'power2.inOut',
      })
    }
  }, [])

  const handleChange = useCallback((value: string) => {
    setQuery(value)
    const matches = value.trim()
      ? WORKLOADS.filter(w =>
          w.name.includes(value.toLowerCase()) ||
          w.namespace.includes(value.toLowerCase()),
        )
      : WORKLOADS

    if (value.trim() && matches.length === 0) {
      modeRef.current = 'implode'
      const { cx, cy } = getInputCenter()
      const implode = createImplodeParticles(cx, cy, Math.floor(maxParticles * 0.25))
      particlesRef.current.push(...implode)
      setTimeout(() => { modeRef.current = 'idle' }, 1200)
    }
  }, [getInputCenter, maxParticles])

  const handleResultHover = useCallback((hovering: boolean) => {
    mouseRef.current.hovering = hovering
    if (!hovering) trailCounterRef.current = 0
  }, [])

  const handleResultMouseMove = useCallback((e: React.MouseEvent) => {
    mouseRef.current.x = e.clientX
    mouseRef.current.y = e.clientY
  }, [])

  const handleReset = useCallback(() => {
    setQuery('')
    setFocused(false)
    particlesRef.current = []
    modeRef.current = 'idle'
    if (inputRef.current) inputRef.current.blur()
    if (inputWrapperRef.current) {
      gsap.set(inputWrapperRef.current, { boxShadow: '0 0 0 0 rgba(59,130,246,0)' })
    }
  }, [])

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0B1120', position: 'relative', overflow: 'hidden' }}>
      {/* Canvas overlay */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      {/* Header */}
      <Box sx={{ p: 3, position: 'relative', zIndex: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
          <IconButton onClick={() => router.push('/prototypes')} sx={{ color: '#94A3B8' }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" sx={{ color: '#F1F5F9', fontWeight: 600 }}>
            Particle Search
          </Typography>
        </Box>

        {/* Search input */}
        <Box sx={{ maxWidth: 560, mx: 'auto', mt: 6 }}>
          <Box
            ref={inputWrapperRef}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              bgcolor: '#1E293B',
              border: '1px solid',
              borderColor: focused ? '#3B82F6' : '#334155',
              borderRadius: 2,
              px: 2,
              py: 1,
              transition: 'border-color 0.3s',
            }}
          >
            <SearchIcon sx={{ color: focused ? '#3B82F6' : '#64748B', transition: 'color 0.3s' }} />
            <input
              ref={inputRef}
              value={query}
              onChange={e => handleChange(e.target.value)}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder="Search workloads..."
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                color: '#F1F5F9',
                fontSize: 16,
                fontFamily: 'inherit',
              }}
            />
            {query && (
              <Typography
                variant="caption"
                sx={{ color: '#64748B', whiteSpace: 'nowrap' }}
              >
                {filtered.length} result{filtered.length !== 1 ? 's' : ''}
              </Typography>
            )}
          </Box>

          {/* Results */}
          <Box sx={{ mt: 2, position: 'relative', zIndex: 3 }}>
            <AnimatePresence mode="popLayout">
              {noResults && (
                <motion.div
                  key="no-results"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                >
                  <Box sx={{
                    textAlign: 'center',
                    py: 6,
                    color: '#EF4444',
                    opacity: 0.7,
                  }}>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      No workloads found
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748B', mt: 0.5, display: 'block' }}>
                      Particles collapsing...
                    </Typography>
                  </Box>
                </motion.div>
              )}

              {filtered.map((workload, i) => (
                <motion.div
                  key={workload.name}
                  custom={i}
                  variants={resultVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  layout
                  onMouseEnter={() => handleResultHover(true)}
                  onMouseLeave={() => handleResultHover(false)}
                  onMouseMove={handleResultMouseMove}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      bgcolor: '#1E293B',
                      border: '1px solid #334155',
                      borderRadius: 1.5,
                      px: 2,
                      py: 1.5,
                      mb: 1,
                      cursor: 'pointer',
                      transition: 'border-color 0.2s, background-color 0.2s',
                      '&:hover': {
                        borderColor: NAMESPACE_COLORS[workload.namespace] ?? '#475569',
                        bgcolor: '#1E293B99',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: NAMESPACE_COLORS[workload.namespace] ?? '#475569',
                          flexShrink: 0,
                        }}
                      />
                      <Box>
                        <Typography
                          variant="body2"
                          sx={{ color: '#F1F5F9', fontWeight: 500, fontFamily: 'monospace' }}
                        >
                          {highlightMatch(workload.name, query)}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748B' }}>
                          {workload.namespace}
                        </Typography>
                      </Box>
                    </Box>
                    <Chip
                      label={`${workload.replicas} replica${workload.replicas !== 1 ? 's' : ''}`}
                      size="small"
                      sx={{
                        bgcolor: '#334155',
                        color: '#94A3B8',
                        fontSize: 11,
                        height: 22,
                      }}
                    />
                  </Box>
                </motion.div>
              ))}
            </AnimatePresence>
          </Box>
        </Box>
      </Box>

      {/* Dev toolbar */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          bgcolor: '#0F172A',
          borderTop: '1px solid #1E293B',
          px: 3,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 3,
        }}
      >
        <Typography variant="caption" sx={{ color: '#64748B', whiteSpace: 'nowrap' }}>
          DEV TOOLBAR
        </Typography>
        <Button
          size="small"
          startIcon={<RestartAltIcon />}
          onClick={handleReset}
          sx={{ color: '#94A3B8', textTransform: 'none', fontSize: 12 }}
        >
          Reset
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, maxWidth: 280 }}>
          <Typography variant="caption" sx={{ color: '#64748B', whiteSpace: 'nowrap' }}>
            Particles: {maxParticles}
          </Typography>
          <Slider
            value={maxParticles}
            onChange={(_, v) => setMaxParticles(v as number)}
            min={20}
            max={400}
            size="small"
            sx={{
              color: '#3B82F6',
              '& .MuiSlider-thumb': { width: 12, height: 12 },
            }}
          />
        </Box>
        <Typography variant="caption" sx={{ color: '#475569', ml: 'auto' }}>
          Active: {particlesRef.current.length}
        </Typography>
      </Box>
    </Box>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  const idx = lower.indexOf(q)
  if (idx === -1) return text

  return (
    <>
      {text.slice(0, idx)}
      <span style={{ color: '#3B82F6', fontWeight: 700 }}>{text.slice(idx, idx + q.length)}</span>
      {text.slice(idx + q.length)}
    </>
  )
}
