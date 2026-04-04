'use client'

// PROTOTYPE: Breathing Cluster Health
// DEPS: framer-motion gsap
// LIBS: GSAP, Framer Motion, SVG
// DATA: Cluster health status
// DESCRIPTION: Cluster health as a breathing organism with rhythmic expansion/contraction

import { useCallback, useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import gsap from 'gsap'

// ── Types ──────────────────────────────────────────────────────────────────

type ClusterState = 'healthy' | 'degraded' | 'critical' | 'sleeping'

interface StateConfig {
  label: string
  color: string
  glowColor: string
  cycleDuration: number
  scaleRange: [number, number]
  description: string
}

interface Namespace {
  name: string
  angle: number
  orbitRadius: number
  breathRate: number
}

// ── Config ─────────────────────────────────────────────────────────────────

const STATE_CONFIGS: Record<ClusterState, StateConfig> = {
  healthy: {
    label: 'Healthy',
    color: '#22C55E',
    glowColor: 'rgba(34, 197, 94, 0.3)',
    cycleDuration: 4,
    scaleRange: [1, 1.15],
    description: 'Slow deep breath — all systems nominal',
  },
  degraded: {
    label: 'Degraded',
    color: '#F59E0B',
    glowColor: 'rgba(245, 158, 11, 0.3)',
    cycleDuration: 2,
    scaleRange: [1, 1.08],
    description: 'Faster shallow breath — investigating issues',
  },
  critical: {
    label: 'Critical',
    color: '#EF4444',
    glowColor: 'rgba(239, 68, 68, 0.4)',
    cycleDuration: 0.8,
    scaleRange: [0.95, 1.1],
    description: 'Rapid irregular breath — immediate attention needed',
  },
  sleeping: {
    label: 'Sleeping',
    color: '#3B82F6',
    glowColor: 'rgba(59, 130, 246, 0.2)',
    cycleDuration: 8,
    scaleRange: [1, 1.06],
    description: 'Very slow breath — workloads scaled down',
  },
}

const NAMESPACES: Namespace[] = [
  { name: 'production', angle: 0, orbitRadius: 120, breathRate: 1.0 },
  { name: 'staging', angle: 40, orbitRadius: 130, breathRate: 0.8 },
  { name: 'dev', angle: 80, orbitRadius: 115, breathRate: 1.2 },
  { name: 'monitoring', angle: 120, orbitRadius: 125, breathRate: 0.7 },
  { name: 'ingress', angle: 160, orbitRadius: 110, breathRate: 1.1 },
  { name: 'cert-mgr', angle: 200, orbitRadius: 135, breathRate: 0.9 },
  { name: 'logging', angle: 240, orbitRadius: 120, breathRate: 0.6 },
  { name: 'storage', angle: 280, orbitRadius: 128, breathRate: 1.3 },
  { name: 'auth', angle: 320, orbitRadius: 118, breathRate: 0.85 },
]

const CENTER = 200

// ── Main Component ─────────────────────────────────────────────────────────

export default function BreathingHealthPrototype() {
  const router = useRouter()
  const [state, setState] = useState<ClusterState>('healthy')
  const coreRef = useRef<SVGCircleElement>(null)
  const glowRef = useRef<SVGCircleElement>(null)
  const satelliteRefs = useRef<(SVGGElement | null)[]>([])
  const tweensRef = useRef<gsap.core.Tween[]>([])

  const config = STATE_CONFIGS[state]

  const clearTweens = useCallback(() => {
    tweensRef.current.forEach((t) => t.kill())
    tweensRef.current = []
  }, [])

  useEffect(() => {
    clearTweens()

    if (!coreRef.current || !glowRef.current) return

    const inhaleRatio = 0.35
    const exhaleRatio = 0.45
    const pauseRatio = 0.2
    const inhaleDur = config.cycleDuration * inhaleRatio
    const exhaleDur = config.cycleDuration * exhaleRatio
    const pauseDur = config.cycleDuration * pauseRatio / 2

    const buildBreathTimeline = (
      element: SVGElement,
      scaleMin: number,
      scaleMax: number,
      duration: number,
      delay: number
    ) => {
      const tl = gsap.timeline({ repeat: -1, delay })
      tl.to(element, {
        attr: { r: 40 * scaleMax },
        duration: duration * inhaleRatio,
        ease: 'power2.out',
      })
      tl.to(element, {
        attr: { r: 40 * scaleMax },
        duration: pauseDur,
      })
      tl.to(element, {
        attr: { r: 40 * scaleMin },
        duration: duration * exhaleRatio,
        ease: 'power1.inOut',
      })
      tl.to(element, {
        attr: { r: 40 * scaleMin },
        duration: pauseDur,
      })
      return tl
    }

    const coreTl = buildBreathTimeline(
      coreRef.current,
      config.scaleRange[0],
      config.scaleRange[1],
      config.cycleDuration,
      0
    )
    tweensRef.current.push(coreTl as unknown as gsap.core.Tween)

    const glowTl = gsap.timeline({ repeat: -1 })
    glowTl.to(glowRef.current, {
      attr: { r: 60 * config.scaleRange[1] },
      opacity: 0.5,
      duration: config.cycleDuration * inhaleRatio,
      ease: 'power2.out',
    })
    glowTl.to(glowRef.current, {
      attr: { r: 60 * config.scaleRange[0] },
      opacity: 0.15,
      duration: config.cycleDuration * exhaleRatio,
      ease: 'power1.inOut',
    })
    tweensRef.current.push(glowTl as unknown as gsap.core.Tween)

    satelliteRefs.current.forEach((ref, i) => {
      if (!ref) return
      const ns = NAMESPACES[i]
      const circle = ref.querySelector('circle')
      if (!circle) return

      const satDuration = config.cycleDuration * ns.breathRate
      const satTl = buildBreathTimeline(
        circle,
        config.scaleRange[0],
        config.scaleRange[1],
        satDuration,
        i * 0.2
      )
      tweensRef.current.push(satTl as unknown as gsap.core.Tween)

      const orbitTl = gsap.to(ref, {
        rotation: '+=360',
        duration: 30 + i * 5,
        repeat: -1,
        ease: 'none',
        transformOrigin: `${CENTER}px ${CENTER}px`,
      })
      tweensRef.current.push(orbitTl)
    })

    return clearTweens
  }, [state, config, clearTweens])

  const setSatelliteRef = useCallback((i: number) => (el: SVGGElement | null) => {
    satelliteRefs.current[i] = el
  }, [])

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', py: 4, px: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>K9 — Breathing Cluster Health</Typography>
          <Typography variant="body2" color="text.secondary">
            Cluster health as a breathing organism with rhythmic expansion/contraction
          </Typography>
        </Box>
      </Box>

      {/* Demo area */}
      <Box
        sx={{
          p: 3,
          borderRadius: 2,
          bgcolor: 'background.default',
          border: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minHeight: 500,
          gap: 3,
        }}
      >
        <motion.div
          key={state}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <svg width={CENTER * 2} height={CENTER * 2} style={{ overflow: 'visible' }}>
            <defs>
              <radialGradient id="coreGradient">
                <stop offset="0%" stopColor={config.color} stopOpacity={0.8} />
                <stop offset="100%" stopColor={config.color} stopOpacity={0.2} />
              </radialGradient>
            </defs>

            {/* Glow */}
            <circle
              ref={glowRef}
              cx={CENTER}
              cy={CENTER}
              r={60}
              fill="none"
              stroke={config.glowColor}
              strokeWidth={20}
              opacity={0.2}
            />

            {/* Orbit rings */}
            {NAMESPACES.map((ns) => (
              <circle
                key={`orbit-${ns.name}`}
                cx={CENTER}
                cy={CENTER}
                r={ns.orbitRadius}
                fill="none"
                stroke="rgba(255,255,255,0.04)"
                strokeWidth={0.5}
              />
            ))}

            {/* Satellites */}
            {NAMESPACES.map((ns, i) => {
              const x = CENTER + ns.orbitRadius * Math.cos((ns.angle * Math.PI) / 180)
              const y = CENTER + ns.orbitRadius * Math.sin((ns.angle * Math.PI) / 180)
              return (
                <g key={ns.name} ref={setSatelliteRef(i)}>
                  <circle
                    cx={x}
                    cy={y}
                    r={6}
                    fill={config.color}
                    opacity={0.6}
                  />
                  <text
                    x={x}
                    y={y + 16}
                    fill="rgba(255,255,255,0.35)"
                    fontSize={8}
                    textAnchor="middle"
                  >
                    {ns.name}
                  </text>
                </g>
              )
            })}

            {/* Core */}
            <circle
              ref={coreRef}
              cx={CENTER}
              cy={CENTER}
              r={40}
              fill={`url(#coreGradient)`}
              stroke={config.color}
              strokeWidth={2}
            />

            {/* Center label */}
            <text
              x={CENTER}
              y={CENTER - 4}
              fill="white"
              fontSize={12}
              fontWeight={700}
              textAnchor="middle"
            >
              {config.label}
            </text>
            <text
              x={CENTER}
              y={CENTER + 12}
              fill="rgba(255,255,255,0.5)"
              fontSize={9}
              textAnchor="middle"
            >
              {config.cycleDuration}s cycle
            </text>
          </svg>
        </motion.div>

        <Typography variant="body2" color="text.secondary" textAlign="center">
          {config.description}
        </Typography>
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
        {(Object.keys(STATE_CONFIGS) as ClusterState[]).map((s) => (
          <Button
            key={s}
            size="small"
            variant={state === s ? 'contained' : 'outlined'}
            onClick={() => setState(s)}
            sx={{
              fontSize: 11,
              px: 1.5,
              py: 0.25,
              minWidth: 0,
              textTransform: 'capitalize',
              bgcolor: state === s ? STATE_CONFIGS[s].color : 'transparent',
              borderColor: STATE_CONFIGS[s].color,
              color: state === s ? 'black' : STATE_CONFIGS[s].color,
              '&:hover': {
                bgcolor: state === s ? STATE_CONFIGS[s].color : `${STATE_CONFIGS[s].color}20`,
                borderColor: STATE_CONFIGS[s].color,
              },
            }}
          >
            {s}
          </Button>
        ))}
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          9 namespaces orbiting
        </Typography>
      </Box>
    </Box>
  )
}
