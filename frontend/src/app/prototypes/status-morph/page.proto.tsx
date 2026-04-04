'use client'

// PROTOTYPE: Morphing Status Badge
// DEPS: framer-motion
// LIBS: Framer Motion
// DATA: Policy status states
// DESCRIPTION: Status chip that morphs between all policy states with smooth transitions

import { useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

type PolicyState = 'awake' | 'transitioning-sleep' | 'sleeping' | 'transitioning-wake'

const STATE_ORDER: PolicyState[] = [
  'awake',
  'transitioning-sleep',
  'sleeping',
  'transitioning-wake',
]

interface StateConfig {
  color: string
  bgColor: string
  borderColor: string
  label: string
  shortLabel: string
  icon: React.ReactNode
  borderRadius: number
}

const STATE_CONFIG: Record<PolicyState, StateConfig> = {
  awake: {
    color: '#22C55E',
    bgColor: 'rgba(34,197,94,0.12)',
    borderColor: 'rgba(34,197,94,0.35)',
    label: 'Awake',
    shortLabel: 'Awake',
    icon: <WbSunnyIcon sx={{ fontSize: 22 }} />,
    borderRadius: 20,
  },
  'transitioning-sleep': {
    color: '#F59E0B',
    bgColor: 'rgba(245,158,11,0.12)',
    borderColor: 'rgba(245,158,11,0.35)',
    label: 'Transitioning to Sleep',
    shortLabel: 'To Sleep',
    icon: <SwapHorizIcon sx={{ fontSize: 22 }} />,
    borderRadius: 12,
  },
  sleeping: {
    color: '#3B82F6',
    bgColor: 'rgba(59,130,246,0.12)',
    borderColor: 'rgba(59,130,246,0.35)',
    label: 'Sleeping',
    shortLabel: 'Sleeping',
    icon: <BedtimeIcon sx={{ fontSize: 22 }} />,
    borderRadius: 20,
  },
  'transitioning-wake': {
    color: '#F59E0B',
    bgColor: 'rgba(245,158,11,0.12)',
    borderColor: 'rgba(245,158,11,0.35)',
    label: 'Transitioning to Wake',
    shortLabel: 'To Wake',
    icon: <SwapHorizIcon sx={{ fontSize: 22 }} />,
    borderRadius: 12,
  },
}

const CYCLE_INTERVAL_MS = 3000

function MorphingChip({ state, size = 'large' }: { state: PolicyState; size?: 'large' | 'small' }) {
  const cfg = STATE_CONFIG[state]
  const isTransitioning = state.startsWith('transitioning')
  const isLarge = size === 'large'
  const iconSize = isLarge ? 28 : 18
  const fontSize = isLarge ? 18 : 13
  const paddingX = isLarge ? 3 : 1.5
  const paddingY = isLarge ? 1.25 : 0.5

  return (
    <motion.div
      layout
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      style={{ display: 'inline-flex' }}
    >
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: isLarge ? 1.5 : 0.75,
          px: paddingX,
          py: paddingY,
          borderRadius: `${cfg.borderRadius}px`,
          bgcolor: cfg.bgColor,
          border: '1.5px solid',
          borderColor: cfg.borderColor,
          color: cfg.color,
          transition: 'background-color 500ms ease, border-color 500ms ease, color 500ms ease, border-radius 500ms ease',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {isTransitioning && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(90deg, transparent 0%, ${cfg.color}18 50%, transparent 100%)`,
              animation: 'chipShimmer 1.8s ease-in-out infinite',
              '@keyframes chipShimmer': {
                '0%': { transform: 'translateX(-100%)' },
                '100%': { transform: 'translateX(100%)' },
              },
            }}
          />
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={`icon-${state}`}
            initial={{ scale: 0.3, opacity: 0, rotate: -120 }}
            animate={{
              scale: 1,
              opacity: 1,
              rotate: isTransitioning ? 360 : 0,
            }}
            exit={{ scale: 0.3, opacity: 0, rotate: 120 }}
            transition={{
              duration: 0.4,
              ease: [0.22, 1, 0.36, 1],
              ...(isTransitioning
                ? { rotate: { duration: 2.5, repeat: Infinity, ease: 'linear' } }
                : {}),
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              position: 'relative',
              zIndex: 1,
            }}
          >
            {state === 'awake' && <WbSunnyIcon sx={{ fontSize: iconSize }} />}
            {state === 'sleeping' && <BedtimeIcon sx={{ fontSize: iconSize }} />}
            {state === 'transitioning-sleep' && <SwapHorizIcon sx={{ fontSize: iconSize }} />}
            {state === 'transitioning-wake' && <SwapHorizIcon sx={{ fontSize: iconSize }} />}
          </motion.div>
        </AnimatePresence>

        <AnimatePresence mode="wait">
          <motion.span
            key={`label-${state}`}
            initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{
              fontWeight: 700,
              fontSize,
              whiteSpace: 'nowrap',
              position: 'relative',
              zIndex: 1,
            }}
          >
            {cfg.label}
          </motion.span>
        </AnimatePresence>
      </Box>
    </motion.div>
  )
}

function TimelineReference({ currentState }: { currentState: PolicyState }) {
  const currentIndex = STATE_ORDER.indexOf(currentState)

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
        mt: 2,
      }}
    >
      {STATE_ORDER.map((state, index) => {
        const cfg = STATE_CONFIG[state]
        const isActive = index === currentIndex

        return (
          <Box
            key={state}
            sx={{ display: 'flex', alignItems: 'center' }}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.75,
              }}
            >
              <motion.div
                animate={{
                  scale: isActive ? 1.15 : 0.9,
                  opacity: isActive ? 1 : 0.4,
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              >
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: `${cfg.borderRadius * 0.6}px`,
                    bgcolor: isActive ? cfg.bgColor : 'rgba(255,255,255,0.04)',
                    border: '1.5px solid',
                    borderColor: isActive ? cfg.borderColor : 'rgba(255,255,255,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isActive ? cfg.color : 'text.disabled',
                    transition: 'all 400ms ease',
                  }}
                >
                  {state === 'awake' && <WbSunnyIcon sx={{ fontSize: 20 }} />}
                  {state === 'sleeping' && <BedtimeIcon sx={{ fontSize: 20 }} />}
                  {state.startsWith('transitioning') && <SwapHorizIcon sx={{ fontSize: 20 }} />}
                </Box>
              </motion.div>
              <Typography
                variant="caption"
                sx={{
                  color: isActive ? cfg.color : 'text.disabled',
                  fontWeight: isActive ? 700 : 400,
                  fontSize: 11,
                  transition: 'color 400ms ease',
                  textAlign: 'center',
                  maxWidth: 80,
                  lineHeight: 1.2,
                }}
              >
                {cfg.shortLabel}
              </Typography>
            </Box>

            {index < STATE_ORDER.length - 1 && (
              <Box
                sx={{
                  width: 40,
                  height: 2,
                  mx: 1,
                  mb: 2.5,
                  borderRadius: 1,
                  bgcolor: index < currentIndex
                    ? STATE_CONFIG[STATE_ORDER[index]].color
                    : 'rgba(255,255,255,0.08)',
                  opacity: index < currentIndex ? 0.6 : 1,
                  transition: 'background-color 400ms ease',
                }}
              />
            )}
          </Box>
        )
      })}
    </Box>
  )
}

function DevToolbar({
  state,
  autoCycle,
  onSetState,
  onToggleAutoCycle,
}: {
  state: PolicyState
  autoCycle: boolean
  onSetState: (s: PolicyState) => void
  onToggleAutoCycle: () => void
}) {
  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        bgcolor: 'rgba(15,15,15,0.95)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        px: 3,
        py: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
      }}
    >
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, mr: 1 }}>
        STATE
      </Typography>

      {STATE_ORDER.map((s) => {
        const cfg = STATE_CONFIG[s]
        const isActive = s === state

        return (
          <Button
            key={s}
            size="small"
            variant={isActive ? 'contained' : 'outlined'}
            onClick={() => onSetState(s)}
            sx={{
              textTransform: 'none',
              fontSize: 12,
              fontWeight: 600,
              minWidth: 0,
              px: 1.5,
              py: 0.5,
              borderRadius: 1.5,
              bgcolor: isActive ? `${cfg.color}20` : 'transparent',
              color: isActive ? cfg.color : 'text.secondary',
              borderColor: isActive ? cfg.borderColor : 'rgba(255,255,255,0.12)',
              '&:hover': {
                bgcolor: `${cfg.color}15`,
                borderColor: cfg.borderColor,
              },
            }}
          >
            {cfg.shortLabel}
          </Button>
        )
      })}

      <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
        <Button
          size="small"
          variant={autoCycle ? 'contained' : 'outlined'}
          startIcon={autoCycle ? <PauseIcon sx={{ fontSize: 14 }} /> : <PlayArrowIcon sx={{ fontSize: 14 }} />}
          onClick={onToggleAutoCycle}
          sx={{
            textTransform: 'none',
            fontSize: 12,
            fontWeight: 600,
            minWidth: 0,
            px: 1.5,
            py: 0.5,
            borderRadius: 1.5,
            bgcolor: autoCycle ? 'rgba(139,92,246,0.2)' : 'transparent',
            color: autoCycle ? '#A78BFA' : 'text.secondary',
            borderColor: autoCycle ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.12)',
            '&:hover': {
              bgcolor: 'rgba(139,92,246,0.15)',
              borderColor: 'rgba(139,92,246,0.3)',
            },
          }}
        >
          Auto-Cycle
        </Button>
      </Box>
    </Box>
  )
}

export default function StatusMorphPrototype() {
  const router = useRouter()
  const [state, setState] = useState<PolicyState>('awake')
  const [autoCycle, setAutoCycle] = useState(false)

  const advanceState = useCallback(() => {
    setState((prev) => {
      const currentIndex = STATE_ORDER.indexOf(prev)
      const nextIndex = (currentIndex + 1) % STATE_ORDER.length
      return STATE_ORDER[nextIndex]
    })
  }, [])

  useEffect(() => {
    if (!autoCycle) return

    const interval = setInterval(advanceState, CYCLE_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [autoCycle, advanceState])

  const handleToggleAutoCycle = useCallback(() => {
    setAutoCycle((prev) => !prev)
  }, [])

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', py: 4, px: 2, pb: 12 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 5 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>
            Morphing Status Badge
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Policy status chip with smooth state transitions via layoutId and AnimatePresence
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 8,
          px: 4,
          borderRadius: 3,
          bgcolor: 'rgba(255,255,255,0.02)',
          border: '1px solid',
          borderColor: 'divider',
          mb: 4,
        }}
      >
        <MorphingChip state={state} size="large" />
      </Box>

      <Box
        sx={{
          py: 4,
          px: 3,
          borderRadius: 3,
          bgcolor: 'rgba(255,255,255,0.02)',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', textAlign: 'center', mb: 2, fontWeight: 600, letterSpacing: 1 }}
        >
          STATE TIMELINE
        </Typography>
        <TimelineReference currentState={state} />
      </Box>

      <DevToolbar
        state={state}
        autoCycle={autoCycle}
        onSetState={setState}
        onToggleAutoCycle={handleToggleAutoCycle}
      />
    </Box>
  )
}
