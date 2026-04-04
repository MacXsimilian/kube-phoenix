'use client'

import { useState, useRef, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

type PodState = 'pending' | 'running' | 'succeeded' | 'failed' | 'crashloop' | 'terminating'

interface StateConfig {
  color: string
  label: string
  description: string
  animation: 'breathe' | 'solid' | 'fadeOut' | 'arrhythmia' | 'none'
  cycleDuration: string
}

const POD_STATES: Record<PodState, StateConfig> = {
  pending: {
    color: '#F59E0B',
    label: 'Pending',
    description: 'Waiting for scheduling — node assignment in progress',
    animation: 'breathe',
    cycleDuration: '2s',
  },
  running: {
    color: '#22C55E',
    label: 'Running',
    description: 'All containers started and healthy',
    animation: 'solid',
    cycleDuration: '0s',
  },
  succeeded: {
    color: '#6B7280',
    label: 'Succeeded',
    description: 'All containers completed with exit code 0',
    animation: 'none',
    cycleDuration: '0s',
  },
  failed: {
    color: '#EF4444',
    label: 'Failed',
    description: 'Container exited with non-zero exit code',
    animation: 'arrhythmia',
    cycleDuration: '1.8s',
  },
  crashloop: {
    color: '#EF4444',
    label: 'CrashLoopBackOff',
    description: 'Container crashing repeatedly — exponential backoff active',
    animation: 'arrhythmia',
    cycleDuration: '1s',
  },
  terminating: {
    color: '#94A3B8',
    label: 'Terminating',
    description: 'Graceful shutdown in progress — SIGTERM sent',
    animation: 'fadeOut',
    cycleDuration: '2s',
  },
}

const STATE_ORDER: PodState[] = ['pending', 'running', 'succeeded', 'failed', 'crashloop', 'terminating']

const LIFECYCLE_PATHS: { label: string; sequence: PodState[] }[] = [
  { label: 'Happy Path', sequence: ['pending', 'running', 'succeeded'] },
  { label: 'Crash Loop', sequence: ['pending', 'running', 'crashloop'] },
  { label: 'Failed Start', sequence: ['pending', 'failed'] },
  { label: 'Graceful Stop', sequence: ['running', 'terminating'] },
]

function PodDot({ state }: { state: PodState }) {
  const cfg = POD_STATES[state]

  const dotAnimations: Record<string, object> = {
    breathe: {
      animation: `breathe ${cfg.cycleDuration} ease-in-out infinite`,
      '@keyframes breathe': {
        '0%, 100%': { opacity: 1, transform: 'scale(1)' },
        '50%': { opacity: 0.4, transform: 'scale(0.9)' },
      },
    },
    solid: {
      animation: `confirmPulse 600ms ease-out`,
      '@keyframes confirmPulse': {
        '0%': { transform: 'scale(0.8)', opacity: 0.6 },
        '50%': { transform: 'scale(1.2)' },
        '100%': { transform: 'scale(1)', opacity: 1 },
      },
    },
    arrhythmia: {
      animation: `arrhythmia ${cfg.cycleDuration} ease-in-out infinite`,
      '@keyframes arrhythmia': {
        '0%': { opacity: 1, transform: 'scale(1)' },
        '10%': { opacity: 0.3, transform: 'scale(0.85)' },
        '20%': { opacity: 1, transform: 'scale(1.05)' },
        '30%': { opacity: 0.3, transform: 'scale(0.85)' },
        '40%': { opacity: 1, transform: 'scale(1)' },
        '100%': { opacity: 0.6, transform: 'scale(0.95)' },
      },
    },
    fadeOut: {
      animation: `fadeOut ${cfg.cycleDuration} ease-in-out infinite`,
      '@keyframes fadeOut': {
        '0%': { opacity: 0.8, transform: 'scale(1)' },
        '100%': { opacity: 0.15, transform: 'scale(0.6)' },
      },
    },
    none: {},
  }

  return (
    <Box sx={{ position: 'relative', width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Ring pulses for crashloop */}
      {state === 'crashloop' && (
        <>
          <Box sx={{
            position: 'absolute', width: 30, height: 30, borderRadius: '50%',
            border: `2px solid ${cfg.color}`,
            animation: 'crashRing 1s ease-out infinite',
            '@keyframes crashRing': { '0%': { transform: 'scale(1)', opacity: 0.6 }, '100%': { transform: 'scale(2.5)', opacity: 0 } },
          }} />
          <Box sx={{
            position: 'absolute', width: 30, height: 30, borderRadius: '50%',
            border: `2px solid ${cfg.color}`,
            animation: 'crashRing 1s ease-out infinite 0.5s',
          }} />
        </>
      )}

      {/* Rotation icon for crashloop */}
      {state === 'crashloop' && (
        <Typography
          sx={{
            position: 'absolute',
            top: 4,
            right: 4,
            fontSize: 14,
            animation: 'spin 2s linear infinite',
            '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
          }}
        >
          ↻
        </Typography>
      )}

      {/* Main dot */}
      <Box
        sx={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          bgcolor: cfg.color,
          boxShadow: `0 0 16px ${cfg.color}80`,
          zIndex: 1,
          transition: 'background-color 400ms ease, box-shadow 400ms ease',
          ...dotAnimations[cfg.animation],
        }}
      />

      {/* Checkmark for succeeded */}
      {state === 'succeeded' && (
        <Typography
          sx={{
            position: 'absolute',
            color: 'white',
            fontWeight: 700,
            fontSize: 16,
            zIndex: 2,
          }}
        >
          ✓
        </Typography>
      )}

      {/* X for failed */}
      {state === 'failed' && (
        <Typography
          sx={{
            position: 'absolute',
            color: 'white',
            fontWeight: 700,
            fontSize: 16,
            zIndex: 2,
          }}
        >
          ✕
        </Typography>
      )}
    </Box>
  )
}

export default function PhoenixLifecyclePrototype() {
  const router = useRouter()
  const [currentState, setCurrentState] = useState<PodState>('pending')
  const [sequenceIndex, setSequenceIndex] = useState(0)
  const [activeSequence, setActiveSequence] = useState<PodState[] | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  function playSequence(sequence: PodState[]) {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setActiveSequence(sequence)
    setSequenceIndex(0)
    setCurrentState(sequence[0])
    let i = 0
    intervalRef.current = setInterval(() => {
      i++
      if (i >= sequence.length) {
        clearInterval(intervalRef.current!)
        intervalRef.current = null
        setActiveSequence(null)
        return
      }
      setSequenceIndex(i)
      setCurrentState(sequence[i])
    }, 1500)
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>C1 — Phoenix Lifecycle</Typography>
          <Typography variant="body2" color="text.secondary">
            Pod state machine with distinct visual animations per state
          </Typography>
        </Box>
      </Box>

      {/* Manual state controls */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', flexWrap: 'wrap' }}>
        <Typography variant="caption" color="text.secondary" sx={{ width: '100%', mb: 0.5 }}>Manual state:</Typography>
        {STATE_ORDER.map((s) => (
          <Button
            key={s}
            variant={currentState === s ? 'contained' : 'outlined'}
            size="small"
            onClick={() => { setCurrentState(s); setActiveSequence(null) }}
            disabled={!!activeSequence}
            sx={{
              fontSize: 11,
              borderColor: POD_STATES[s].color + '60',
              color: currentState === s ? undefined : POD_STATES[s].color,
              '&.Mui-contained': { bgcolor: POD_STATES[s].color },
            }}
          >
            {POD_STATES[s].label}
          </Button>
        ))}
      </Box>

      {/* Lifecycle sequences */}
      <Box sx={{ display: 'flex', gap: 1, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', flexWrap: 'wrap' }}>
        <Typography variant="caption" color="text.secondary" sx={{ width: '100%', mb: 0.5 }}>Play lifecycle:</Typography>
        {LIFECYCLE_PATHS.map((path) => (
          <Button
            key={path.label}
            variant="outlined"
            size="small"
            onClick={() => playSequence(path.sequence)}
            disabled={!!activeSequence}
            sx={{ fontSize: 11 }}
          >
            {path.label}
          </Button>
        ))}
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
          alignItems: 'center',
          gap: 4,
        }}
      >
        {/* Active sequence progress */}
        {activeSequence && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {activeSequence.map((s, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: i <= sequenceIndex ? POD_STATES[s].color : 'rgba(255,255,255,0.15)',
                    transition: 'background-color 400ms ease',
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    color: i <= sequenceIndex ? POD_STATES[s].color : 'text.secondary',
                    fontWeight: i === sequenceIndex ? 700 : 400,
                    transition: 'color 400ms ease',
                  }}
                >
                  {POD_STATES[s].label}
                </Typography>
                {i < activeSequence.length - 1 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mx: 0.5 }}>→</Typography>
                )}
              </Box>
            ))}
          </Box>
        )}

        {/* Pod visualization */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentState}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <PodDot state={currentState} />
          </motion.div>
        </AnimatePresence>

        {/* State label */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentState}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            style={{ textAlign: 'center' }}
          >
            <Typography variant="h5" fontWeight={700} sx={{ color: POD_STATES[currentState].color }}>
              {POD_STATES[currentState].label}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 400 }}>
              {POD_STATES[currentState].description}
            </Typography>
          </motion.div>
        </AnimatePresence>

        {/* Inline table row demo */}
        <Box sx={{ mt: 4, width: '100%' }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
            As it appears in a table row:
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
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: POD_STATES[currentState].color,
                boxShadow: `0 0 8px ${POD_STATES[currentState].color}80`,
                flexShrink: 0,
                ...(currentState === 'crashloop' ? {
                  animation: 'tableArrhythmia 1s ease-in-out infinite',
                  '@keyframes tableArrhythmia': {
                    '0%': { opacity: 1 },
                    '10%': { opacity: 0.2 },
                    '20%': { opacity: 1 },
                    '30%': { opacity: 0.2 },
                    '40%': { opacity: 1 },
                    '100%': { opacity: 0.5 },
                  },
                } : currentState === 'pending' ? {
                  animation: 'tableBreathe 2s ease-in-out infinite',
                  '@keyframes tableBreathe': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.35 },
                  },
                } : currentState === 'terminating' ? {
                  animation: 'tableFade 2s ease-in-out infinite',
                  '@keyframes tableFade': {
                    '0%': { opacity: 0.7 },
                    '100%': { opacity: 0.15 },
                  },
                } : {}),
              }}
            />
            <Typography variant="body2" fontWeight={500} sx={{ fontFamily: 'monospace' }}>
              api-server-7d4f8b6c9-x2k4j
            </Typography>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentState}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.25 }}
              >
                <Box
                  sx={{
                    px: 1,
                    py: 0.25,
                    borderRadius: 1,
                    bgcolor: `${POD_STATES[currentState].color}18`,
                    color: POD_STATES[currentState].color,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {POD_STATES[currentState].label}
                </Box>
              </motion.div>
            </AnimatePresence>
            <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
              prod / api-server
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
