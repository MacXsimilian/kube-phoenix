'use client'

import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import Brightness4Icon from '@mui/icons-material/Brightness4'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

type PolicyState = 'sleeping' | 'transitioning-wake' | 'awake' | 'transitioning-sleep'

interface StateConfig {
  color: string
  bgColor: string
  borderColor: string
  label: string
  icon: React.ReactNode
}

const STATE_CONFIG: Record<PolicyState, StateConfig> = {
  sleeping: {
    color: '#7C3AED',
    bgColor: 'rgba(124,58,237,0.12)',
    borderColor: 'rgba(124,58,237,0.3)',
    label: 'Sleeping',
    icon: <BedtimeIcon sx={{ fontSize: 18 }} />,
  },
  'transitioning-wake': {
    color: '#F59E0B',
    bgColor: 'rgba(245,158,11,0.12)',
    borderColor: 'rgba(245,158,11,0.3)',
    label: 'Waking Up...',
    icon: <Brightness4Icon sx={{ fontSize: 18 }} />,
  },
  awake: {
    color: '#22C55E',
    bgColor: 'rgba(34,197,94,0.12)',
    borderColor: 'rgba(34,197,94,0.3)',
    label: 'Awake',
    icon: <WbSunnyIcon sx={{ fontSize: 18 }} />,
  },
  'transitioning-sleep': {
    color: '#F59E0B',
    bgColor: 'rgba(245,158,11,0.12)',
    borderColor: 'rgba(245,158,11,0.3)',
    label: 'Falling Asleep...',
    icon: <Brightness4Icon sx={{ fontSize: 18 }} />,
  },
}

function StatusChipAnimated({ state }: { state: PolicyState }) {
  const cfg = STATE_CONFIG[state]
  const isTransitioning = state.startsWith('transitioning')

  return (
    <motion.div
      layout
      style={{ display: 'inline-flex' }}
    >
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 0.75,
          borderRadius: 2,
          bgcolor: cfg.bgColor,
          border: '1px solid',
          borderColor: cfg.borderColor,
          color: cfg.color,
          transition: 'background-color 600ms ease, border-color 600ms ease, color 600ms ease',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Shimmer for transitioning state */}
        {isTransitioning && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(90deg, transparent 0%, ${cfg.color}15 50%, transparent 100%)`,
              animation: 'shimmer 1.5s ease-in-out infinite',
              '@keyframes shimmer': {
                '0%': { transform: 'translateX(-100%)' },
                '100%': { transform: 'translateX(100%)' },
              },
            }}
          />
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={state}
            initial={{ scale: 0.5, opacity: 0, rotate: -90 }}
            animate={{
              scale: 1,
              opacity: 1,
              rotate: isTransitioning ? 360 : 0,
            }}
            exit={{ scale: 0.5, opacity: 0, rotate: 90 }}
            transition={{
              duration: 0.4,
              ease: [0.22, 1, 0.36, 1],
              ...(isTransitioning ? {
                rotate: { duration: 3, repeat: Infinity, ease: 'linear' },
              } : {}),
            }}
            style={{ display: 'flex', alignItems: 'center' }}
          >
            {cfg.icon}
          </motion.div>
        </AnimatePresence>

        <AnimatePresence mode="wait">
          <motion.span
            key={state}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            style={{ fontWeight: 600, fontSize: 14, position: 'relative', zIndex: 1 }}
          >
            {cfg.label}
          </motion.span>
        </AnimatePresence>
      </Box>
    </motion.div>
  )
}

function HeroBand({ state }: { state: PolicyState }) {
  const cfg = STATE_CONFIG[state]
  const isTransitioning = state.startsWith('transitioning')

  return (
    <Box
      sx={{
        p: 3,
        borderRadius: 2,
        bgcolor: cfg.bgColor,
        border: '1px solid',
        borderColor: cfg.borderColor,
        transition: 'background-color 600ms ease, border-color 600ms ease',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Shimmer overlay for transitioning */}
      {isTransitioning && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(90deg, transparent 0%, ${cfg.color}10 50%, transparent 100%)`,
            animation: 'bandShimmer 2s ease-in-out infinite',
            '@keyframes bandShimmer': {
              '0%': { transform: 'translateX(-100%)' },
              '100%': { transform: 'translateX(100%)' },
            },
          }}
        />
      )}

      {/* Border glow */}
      <Box
        sx={{
          position: 'absolute',
          inset: -1,
          borderRadius: 2,
          boxShadow: `0 0 20px ${cfg.color}30, inset 0 0 20px ${cfg.color}10`,
          transition: 'box-shadow 600ms ease',
          pointerEvents: 'none',
        }}
      />

      <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={state}
            initial={{ scale: 0, opacity: 0 }}
            animate={{
              scale: 1,
              opacity: 1,
              rotate: isTransitioning ? 360 : 0,
            }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{
              duration: 0.5,
              ease: [0.22, 1, 0.36, 1],
              ...(isTransitioning ? {
                rotate: { duration: 4, repeat: Infinity, ease: 'linear' },
              } : {}),
            }}
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              backgroundColor: `${cfg.color}20`,
              color: cfg.color,
              flexShrink: 0,
            }}
          >
            {state === 'sleeping' && <BedtimeIcon sx={{ fontSize: 28 }} />}
            {state === 'awake' && <WbSunnyIcon sx={{ fontSize: 28 }} />}
            {isTransitioning && <Brightness4Icon sx={{ fontSize: 28 }} />}
          </motion.div>
        </AnimatePresence>

        <Box>
          <AnimatePresence mode="wait">
            <motion.div
              key={state}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.3 }}
            >
              <Typography
                variant="h5"
                fontWeight={700}
                sx={{ color: cfg.color, transition: 'color 600ms ease' }}
              >
                {cfg.label}
              </Typography>
            </motion.div>
          </AnimatePresence>
          <Typography variant="body2" color="text.secondary">
            production-sleep-policy
          </Typography>
        </Box>

        <Box sx={{ ml: 'auto' }}>
          <StatusChipAnimated state={state} />
        </Box>
      </Box>
    </Box>
  )
}

export default function SleepWakeMorphPrototype() {
  const router = useRouter()
  const [state, setState] = useState<PolicyState>('awake')

  function triggerSleep() {
    setState('transitioning-sleep')
    setTimeout(() => setState('sleeping'), 2000)
  }

  function triggerWake() {
    setState('transitioning-wake')
    setTimeout(() => setState('awake'), 2000)
  }

  const isSleeping = state === 'sleeping'
  const isAwake = state === 'awake'
  const isTransitioning = state.startsWith('transitioning')

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>C4 — Sleep / Wake Morph</Typography>
          <Typography variant="body2" color="text.secondary">
            Policy state chip and hero band morphing between sleep and awake
          </Typography>
        </Box>
      </Box>

      {/* Controls */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', alignItems: 'center' }}>
        <Button
          variant="contained"
          size="small"
          startIcon={<BedtimeIcon fontSize="small" />}
          onClick={triggerSleep}
          disabled={!isAwake}
          sx={{ bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' } }}
        >
          Sleep
        </Button>
        <Button
          variant="contained"
          size="small"
          startIcon={<WbSunnyIcon fontSize="small" />}
          onClick={triggerWake}
          disabled={!isSleeping}
          color="success"
        >
          Wake
        </Button>
        {isTransitioning && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, ml: 'auto' }}>
            <Box
              sx={{
                width: 7, height: 7, borderRadius: '50%', bgcolor: '#F59E0B',
                animation: 'transDot 1s ease-in-out infinite',
                '@keyframes transDot': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
              }}
            />
            <Typography variant="caption" color="text.secondary">Transitioning...</Typography>
          </Box>
        )}
      </Box>

      {/* Demo area */}
      <Box
        sx={{
          p: 4,
          borderRadius: 2,
          bgcolor: 'background.default',
          border: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {/* Hero band variant */}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
            Hero Band (policy detail page header):
          </Typography>
          <HeroBand state={state} />
        </Box>

        {/* Standalone chips */}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
            Status Chip (policy card, overview):
          </Typography>
          <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            <StatusChipAnimated state={state} />
          </Box>
        </Box>

        {/* Inline card variant */}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
            Inline in a policy card:
          </Typography>
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" fontWeight={600}>production-sleep-policy</Typography>
              <Typography variant="caption" color="text.secondary">Sleep 20:00 UTC · Wake 06:00 UTC</Typography>
            </Box>
            <StatusChipAnimated state={state} />
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
