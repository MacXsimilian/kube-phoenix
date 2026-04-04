'use client'

// PROTOTYPE: Liquid Policy Toggle
// DEPS: framer-motion gsap
// LIBS: Framer Motion, GSAP, SVG
// DATA: Plan/Apply mode state
// DESCRIPTION: Liquid morphing toggle button between Plan and Apply modes

import { useState, useRef, useCallback, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ReplayIcon from '@mui/icons-material/Replay'
import { useRouter } from 'next/navigation'
import gsap from 'gsap'
import { motion, AnimatePresence } from 'framer-motion'

type PolicyMode = 'plan' | 'apply'

const PLAN_COLOR = '#3B82F6'
const APPLY_COLOR = '#10B981'

const PLAN_PATH =
  'M 50 10 C 70 8, 88 18, 92 35 C 96 52, 90 72, 78 85 C 66 98, 42 100, 28 90 C 14 80, 6 60, 8 42 C 10 24, 30 12, 50 10 Z'

const APPLY_PATH =
  'M 50 5 L 85 15 L 95 50 L 85 85 L 50 95 L 15 85 L 5 50 L 15 15 Z'

const MODE_CONFIG: Record<PolicyMode, {
  color: string
  path: string
  label: string
  description: string
}> = {
  plan: {
    color: PLAN_COLOR,
    path: PLAN_PATH,
    label: 'Plan Mode',
    description: 'Dry-run only — executions are logged but nothing scales. Safe to experiment.',
  },
  apply: {
    color: APPLY_COLOR,
    path: APPLY_PATH,
    label: 'Apply Mode',
    description: 'Live scaling — workloads will actually scale on sleep and restore on wake.',
  },
}

const FILL_PLAN_PATH =
  'M 0 100 L 100 100 L 100 100 L 0 100 Z'

const FILL_APPLY_PATH =
  'M 0 0 L 100 0 L 100 100 L 0 100 Z'

function LiquidBlob({
  mode,
  onToggle,
  animating,
}: {
  mode: PolicyMode
  onToggle: () => void
  animating: boolean
}) {
  const blobRef = useRef<SVGPathElement>(null)
  const fillRef = useRef<SVGPathElement>(null)
  const glowRef = useRef<SVGCircleElement>(null)
  const timelineRef = useRef<gsap.core.Timeline | null>(null)

  useEffect(() => {
    return () => {
      timelineRef.current?.kill()
    }
  }, [])

  useEffect(() => {
    if (!blobRef.current || !fillRef.current) return

    timelineRef.current?.kill()

    const config = MODE_CONFIG[mode]
    const tl = gsap.timeline()
    timelineRef.current = tl

    tl.to(blobRef.current, {
      attr: { d: config.path },
      stroke: config.color,
      duration: 0.6,
      ease: 'elastic.out(1, 0.5)',
    }, 0)

    tl.to(fillRef.current, {
      attr: { d: mode === 'apply' ? FILL_APPLY_PATH : FILL_PLAN_PATH },
      fill: config.color,
      duration: 0.5,
      ease: 'power2.inOut',
    }, 0)

    if (glowRef.current) {
      tl.fromTo(glowRef.current, {
        attr: { r: 30 },
        opacity: 0.4,
      }, {
        attr: { r: 55 },
        opacity: 0,
        duration: 0.8,
        ease: 'power2.out',
      }, 0)
    }
  }, [mode])

  const cfg = MODE_CONFIG[mode]

  return (
    <Box
      onClick={animating ? undefined : onToggle}
      sx={{
        cursor: animating ? 'default' : 'pointer',
        display: 'inline-flex',
        position: 'relative',
        transition: 'transform 0.2s ease',
        '&:hover': animating ? {} : { transform: 'scale(1.05)' },
        '&:active': animating ? {} : { transform: 'scale(0.97)' },
      }}
    >
      <svg
        viewBox="0 0 100 100"
        width={220}
        height={220}
        style={{ overflow: 'visible' }}
      >
        <defs>
          <clipPath id="blob-clip">
            <path d={cfg.path} />
          </clipPath>
          <filter id="blob-glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle
          ref={glowRef}
          cx={50}
          cy={50}
          r={30}
          fill={cfg.color}
          opacity={0}
        />

        <path
          ref={blobRef}
          d={cfg.path}
          fill="none"
          stroke={cfg.color}
          strokeWidth={2.5}
          filter="url(#blob-glow)"
        />

        <g clipPath="url(#blob-clip)">
          <path
            ref={fillRef}
            d={mode === 'apply' ? FILL_APPLY_PATH : FILL_PLAN_PATH}
            fill={cfg.color}
            opacity={0.15}
          />
        </g>

        <text
          x={50}
          y={48}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={cfg.color}
          fontSize={16}
          fontWeight={800}
          fontFamily="Inter, sans-serif"
          letterSpacing={3}
        >
          {mode === 'plan' ? 'PLAN' : 'APPLY'}
        </text>

        <text
          x={50}
          y={63}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={cfg.color}
          fontSize={7}
          fontWeight={400}
          fontFamily="Inter, sans-serif"
          opacity={0.6}
        >
          click to toggle
        </text>
      </svg>
    </Box>
  )
}

function ModeIndicator({ mode }: { mode: PolicyMode }) {
  const cfg = MODE_CONFIG[mode]

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={mode}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <Box sx={{ textAlign: 'center', mt: 4 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              py: 0.75,
              borderRadius: 2,
              bgcolor: `${cfg.color}18`,
              border: '1px solid',
              borderColor: `${cfg.color}40`,
              mb: 2,
            }}
          >
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: cfg.color,
                boxShadow: `0 0 8px ${cfg.color}`,
              }}
            />
            <Typography
              variant="body2"
              fontWeight={700}
              sx={{ color: cfg.color, letterSpacing: 1 }}
            >
              {cfg.label}
            </Typography>
          </Box>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ maxWidth: 360, mx: 'auto', lineHeight: 1.6 }}
          >
            {cfg.description}
          </Typography>
        </Box>
      </motion.div>
    </AnimatePresence>
  )
}

export default function LiquidTogglePrototype() {
  const router = useRouter()
  const [mode, setMode] = useState<PolicyMode>('plan')
  const [animating, setAnimating] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const handleToggle = useCallback(() => {
    if (animating) return
    setAnimating(true)
    const next: PolicyMode = mode === 'plan' ? 'apply' : 'plan'
    setMode(next)
    timeoutRef.current = setTimeout(() => setAnimating(false), 700)
  }, [mode, animating])

  const handleReset = useCallback(() => {
    setMode('plan')
    setAnimating(false)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }, [])

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>
            K2 — Liquid Policy Toggle
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Liquid morphing toggle between Plan and Apply modes with SVG path animation
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 400,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'rgba(255,255,255,0.02)',
          p: 4,
        }}
      >
        <LiquidBlob
          mode={mode}
          onToggle={handleToggle}
          animating={animating}
        />
        <ModeIndicator mode={mode} />
      </Box>

      {/* Dev toolbar */}
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
          py: 1.5,
          bgcolor: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ mr: 'auto' }}>
          K2 Liquid Toggle — Current: {MODE_CONFIG[mode].label}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<ReplayIcon fontSize="small" />}
          onClick={handleReset}
        >
          Reset
        </Button>
      </Box>
    </Box>
  )
}
