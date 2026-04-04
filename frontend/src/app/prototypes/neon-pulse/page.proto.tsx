'use client'

// PROTOTYPE: Neon Border Pulse
// DEPS: framer-motion gsap
// LIBS: GSAP, Framer Motion, CSS
// DATA: Policy cards with different states
// DESCRIPTION: Policy cards with animated neon borders encoding state

import { useCallback, useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import gsap from 'gsap'

// ── Types ──────────────────────────────────────────────────────────────────

type PolicyState = 'awake' | 'sleeping' | 'transitioning' | 'error'

interface NeonConfig {
  color: string
  pulseSpeed: number
  minOpacity: number
  maxOpacity: number
  blurMin: number
  blurMax: number
  label: string
}

interface PolicyCard {
  id: string
  name: string
  schedule: string
  state: PolicyState
}

// ── Config ─────────────────────────────────────────────────────────────────

const NEON_CONFIGS: Record<PolicyState, NeonConfig> = {
  awake: {
    color: '#22C55E',
    pulseSpeed: 3,
    minOpacity: 0.3,
    maxOpacity: 0.8,
    blurMin: 8,
    blurMax: 20,
    label: 'Awake',
  },
  sleeping: {
    color: '#3B82F6',
    pulseSpeed: 6,
    minOpacity: 0.15,
    maxOpacity: 0.5,
    blurMin: 6,
    blurMax: 14,
    label: 'Sleeping',
  },
  transitioning: {
    color: '#F59E0B',
    pulseSpeed: 0.5,
    minOpacity: 0.4,
    maxOpacity: 1,
    blurMin: 10,
    blurMax: 25,
    label: 'Transitioning',
  },
  error: {
    color: '#EF4444',
    pulseSpeed: 0.3,
    minOpacity: 0.2,
    maxOpacity: 0.9,
    blurMin: 8,
    blurMax: 22,
    label: 'Error',
  },
}

const ALL_STATES: PolicyState[] = ['awake', 'sleeping', 'transitioning', 'error']

const INITIAL_POLICIES: PolicyCard[] = [
  { id: 'policy-1', name: 'prod-sleep-weeknights', schedule: 'Mon-Fri 20:00-08:00', state: 'awake' },
  { id: 'policy-2', name: 'staging-weekend-off', schedule: 'Sat-Sun all day', state: 'sleeping' },
  { id: 'policy-3', name: 'dev-scale-morning', schedule: 'Mon-Fri 08:00', state: 'transitioning' },
  { id: 'policy-4', name: 'ci-runner-cleanup', schedule: 'Daily 03:00', state: 'error' },
]

// ── Neon Card Component ────────────────────────────────────────────────────

function NeonPolicyCard({
  policy,
  cardRef,
}: {
  policy: PolicyCard
  cardRef: (el: HTMLDivElement | null) => void
}) {
  const config = NEON_CONFIGS[policy.state]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Box
        ref={cardRef}
        sx={{
          p: 2.5,
          borderRadius: 2,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: `${config.color}40`,
          boxShadow: `0 0 ${config.blurMin}px ${config.color}40, inset 0 0 ${config.blurMin / 2}px ${config.color}10`,
          transition: 'border-color 0.5s ease',
          minHeight: 140,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: 13 }}>
            {policy.name}
          </Typography>
          <Chip
            label={config.label}
            size="small"
            sx={{
              height: 20,
              fontSize: 10,
              fontWeight: 600,
              bgcolor: `${config.color}15`,
              color: config.color,
              border: '1px solid',
              borderColor: `${config.color}30`,
            }}
          />
        </Box>

        <Typography variant="caption" color="text.secondary">
          Schedule: {policy.schedule}
        </Typography>

        <Box
          sx={{
            mt: 'auto',
            height: 3,
            borderRadius: 1.5,
            bgcolor: `${config.color}20`,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              height: '100%',
              width: policy.state === 'awake' ? '100%' : policy.state === 'sleeping' ? '0%' : '50%',
              bgcolor: config.color,
              borderRadius: 1.5,
              transition: 'width 0.5s ease',
            }}
          />
        </Box>
      </Box>
    </motion.div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function NeonPulsePrototype() {
  const router = useRouter()
  const [policies, setPolicies] = useState<PolicyCard[]>(INITIAL_POLICIES)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const tweensRef = useRef<gsap.core.Tween[]>([])

  const clearTweens = useCallback(() => {
    tweensRef.current.forEach((t) => t.kill())
    tweensRef.current = []
  }, [])

  useEffect(() => {
    clearTweens()

    policies.forEach((policy, i) => {
      const el = cardRefs.current[i]
      if (!el) return

      const config = NEON_CONFIGS[policy.state]

      if (policy.state === 'error') {
        const flickerTween = gsap.to(el, {
          boxShadow: `0 0 ${config.blurMax}px ${config.color}80, inset 0 0 ${config.blurMax / 2}px ${config.color}20`,
          borderColor: `${config.color}90`,
          duration: config.pulseSpeed,
          repeat: -1,
          ease: 'rough({ template: power0, strength: 2, points: 20, taper: none, randomize: true, clamp: false })',
          yoyo: true,
          onRepeat: () => {
            const nextDur = 0.1 + Math.random() * 0.4
            flickerTween.duration(nextDur)
          },
        })
        tweensRef.current.push(flickerTween)
        return
      }

      const tween = gsap.to(el, {
        boxShadow: `0 0 ${config.blurMax}px ${config.color}80, inset 0 0 ${config.blurMax / 2}px ${config.color}20`,
        borderColor: `${config.color}90`,
        duration: config.pulseSpeed / 2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      })
      tweensRef.current.push(tween)
    })

    return clearTweens
  }, [policies, clearTweens])

  const cycleState = useCallback((policyIndex: number) => {
    setPolicies((prev) => {
      const updated = [...prev]
      const current = updated[policyIndex]
      const currentIdx = ALL_STATES.indexOf(current.state)
      const nextState = ALL_STATES[(currentIdx + 1) % ALL_STATES.length]
      updated[policyIndex] = { ...current, state: nextState }
      return updated
    })
  }, [])

  const setCardRef = useCallback((i: number) => (el: HTMLDivElement | null) => {
    cardRefs.current[i] = el
  }, [])

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', py: 4, px: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>K11 — Neon Border Pulse</Typography>
          <Typography variant="body2" color="text.secondary">
            Policy cards with animated neon borders encoding state
          </Typography>
        </Box>
      </Box>

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {ALL_STATES.map((s) => (
          <Box key={s} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: NEON_CONFIGS[s].color,
                boxShadow: `0 0 6px ${NEON_CONFIGS[s].color}`,
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
              {s} ({NEON_CONFIGS[s].pulseSpeed}s)
            </Typography>
          </Box>
        ))}
      </Box>

      {/* 2x2 Grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 2,
          p: 3,
          borderRadius: 2,
          bgcolor: 'background.default',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        {policies.map((policy, i) => (
          <NeonPolicyCard
            key={policy.id}
            policy={policy}
            cardRef={setCardRef(i)}
          />
        ))}
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
          overflowX: 'auto',
        }}
      >
        <Typography variant="caption" fontWeight={700} sx={{ color: '#F97316', flexShrink: 0 }}>
          DEV
        </Typography>
        {policies.map((policy, i) => (
          <Button
            key={policy.id}
            size="small"
            variant="outlined"
            onClick={() => cycleState(i)}
            sx={{
              fontSize: 10,
              px: 1,
              py: 0.25,
              minWidth: 0,
              flexShrink: 0,
              borderColor: NEON_CONFIGS[policy.state].color,
              color: NEON_CONFIGS[policy.state].color,
              '&:hover': {
                borderColor: NEON_CONFIGS[policy.state].color,
                bgcolor: `${NEON_CONFIGS[policy.state].color}15`,
              },
            }}
          >
            {policy.name.split('-')[0]}: {policy.state}
          </Button>
        ))}
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto', flexShrink: 0 }}>
          Click to cycle states
        </Typography>
      </Box>
    </Box>
  )
}
