'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Slider from '@mui/material/Slider'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ReplayIcon from '@mui/icons-material/Replay'
import { useRouter } from 'next/navigation'

type ExecutionStatus = 'idle' | 'running' | 'success' | 'failed'

interface Phase {
  label: string
  weight: number
}

const PHASES: Phase[] = [
  { label: 'Validate', weight: 0.1 },
  { label: 'Scale Down', weight: 0.4 },
  { label: 'Drain Nodes', weight: 0.3 },
  { label: 'Verify', weight: 0.15 },
  { label: 'Complete', weight: 0.05 },
]

function phaseBoundaries(): number[] {
  const bounds: number[] = [0]
  let sum = 0
  for (const p of PHASES) {
    sum += p.weight
    bounds.push(sum)
  }
  return bounds
}

export default function RolloutWavePrototype() {
  const router = useRouter()
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<ExecutionStatus>('idle')
  const [speed, setSpeed] = useState(40)
  const [failAt, setFailAt] = useState<number | null>(null)
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const bounds = phaseBoundaries()

  const currentPhaseIndex = bounds.findIndex((b, i) => i < bounds.length - 1 && progress >= b && progress < bounds[i + 1])
  const activePhase = currentPhaseIndex >= 0 ? currentPhaseIndex : PHASES.length - 1

  const start = useCallback(() => {
    setProgress(0)
    setStatus('running')
    setFailAt(null)
  }, [])

  const startWithFailure = useCallback(() => {
    setProgress(0)
    setStatus('running')
    setFailAt(0.55 + Math.random() * 0.2)
  }, [])

  const reset = useCallback(() => {
    if (animRef.current) clearInterval(animRef.current)
    setProgress(0)
    setStatus('idle')
    setFailAt(null)
  }, [])

  useEffect(() => {
    if (status !== 'running') {
      if (animRef.current) clearInterval(animRef.current)
      return
    }

    animRef.current = setInterval(() => {
      setProgress((prev) => {
        const next = prev + (speed / 10000)
        if (failAt !== null && next >= failAt) {
          setStatus('failed')
          return failAt
        }
        if (next >= 1) {
          setStatus('success')
          return 1
        }
        return next
      })
    }, 30)

    return () => { if (animRef.current) clearInterval(animRef.current) }
  }, [status, speed, failAt])

  const barColor = status === 'failed' ? '#EF4444' : status === 'success' ? '#22C55E' : '#7C3AED'

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>C3 — Rollout Wave</Typography>
          <Typography variant="body2" color="text.secondary">
            Execution progress bar with wave fill, glow, and barberpole pattern
          </Typography>
        </Box>
      </Box>

      {/* Controls */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', alignItems: 'center', flexWrap: 'wrap' }}>
        <Button variant="contained" size="small" onClick={start} disabled={status === 'running'}>
          Run (Success)
        </Button>
        <Button variant="outlined" size="small" onClick={startWithFailure} disabled={status === 'running'} color="error">
          Run (Fail)
        </Button>
        <Button variant="outlined" size="small" startIcon={<ReplayIcon fontSize="small" />} onClick={reset}>
          Reset
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 2, minWidth: 160 }}>
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            Speed: {speed}%
          </Typography>
          <Slider
            value={speed}
            onChange={(_, v) => setSpeed(v as number)}
            min={10}
            max={100}
            step={10}
            size="small"
            sx={{ width: 100 }}
          />
        </Box>
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
          gap: 3,
        }}
      >
        {/* Phase labels */}
        <Box sx={{ display: 'flex', position: 'relative' }}>
          {PHASES.map((phase, i) => (
            <Box
              key={phase.label}
              sx={{
                flex: phase.weight,
                textAlign: 'center',
                position: 'relative',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: i === activePhase && status === 'running' ? 700 : 400,
                  color: i < activePhase || status === 'success'
                    ? '#22C55E'
                    : i === activePhase && status === 'running'
                      ? barColor
                      : status === 'failed' && progress >= bounds[i] && progress < bounds[i + 1]
                        ? '#EF4444'
                        : 'text.secondary',
                  transition: 'color 300ms ease, font-weight 200ms ease',
                  fontSize: 11,
                }}
              >
                {phase.label}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Main progress bar */}
        <Box
          sx={{
            position: 'relative',
            height: 28,
            borderRadius: 2,
            bgcolor: 'rgba(255,255,255,0.06)',
            overflow: 'hidden',
          }}
        >
          {/* Phase dividers */}
          {bounds.slice(1, -1).map((b, i) => (
            <Box
              key={i}
              sx={{
                position: 'absolute',
                left: `${b * 100}%`,
                top: 0,
                bottom: 0,
                width: 1,
                bgcolor: 'rgba(255,255,255,0.1)',
                zIndex: 3,
              }}
            />
          ))}

          {/* Fill */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              width: `${progress * 100}%`,
              bgcolor: barColor,
              borderRadius: 2,
              transition: status === 'idle' ? 'width 300ms ease' : undefined,
              backgroundImage: status === 'running'
                ? `repeating-linear-gradient(
                    -45deg,
                    transparent,
                    transparent 8px,
                    rgba(255,255,255,0.08) 8px,
                    rgba(255,255,255,0.08) 16px
                  )`
                : undefined,
              backgroundSize: status === 'running' ? '32px 32px' : undefined,
              animation: status === 'running' ? 'barberpole 600ms linear infinite' : undefined,
              '@keyframes barberpole': {
                '0%': { backgroundPosition: '0 0' },
                '100%': { backgroundPosition: '32px 0' },
              },
            }}
          />

          {/* Glow tip */}
          {status === 'running' && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${progress * 100}%`,
                width: 8,
                transform: 'translateX(-4px)',
                borderRadius: 1,
                bgcolor: 'white',
                opacity: 0.7,
                boxShadow: `0 0 12px ${barColor}, 0 0 24px ${barColor}60`,
                zIndex: 2,
                animation: 'tipPulse 0.8s ease-in-out infinite',
                '@keyframes tipPulse': {
                  '0%, 100%': { opacity: 0.7 },
                  '50%': { opacity: 0.4 },
                },
              }}
            />
          )}

          {/* Success flash */}
          {status === 'success' && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                bgcolor: 'rgba(255,255,255,0.3)',
                borderRadius: 2,
                animation: 'successFlash 600ms ease-out forwards',
                '@keyframes successFlash': {
                  '0%': { opacity: 0.5 },
                  '100%': { opacity: 0 },
                },
              }}
            />
          )}

          {/* Failure shake */}
          {status === 'failed' && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                animation: 'failShake 400ms ease-out',
                '@keyframes failShake': {
                  '0%, 100%': { transform: 'translateX(0)' },
                  '20%': { transform: 'translateX(-3px)' },
                  '40%': { transform: 'translateX(3px)' },
                  '60%': { transform: 'translateX(-2px)' },
                  '80%': { transform: 'translateX(2px)' },
                },
              }}
            />
          )}

          {/* Percentage label */}
          <Typography
            variant="caption"
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontWeight: 700,
              fontSize: 12,
              zIndex: 4,
              color: 'white',
              textShadow: '0 1px 3px rgba(0,0,0,0.5)',
            }}
          >
            {Math.round(progress * 100)}%
          </Typography>
        </Box>

        {/* Status text */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: status === 'success' ? '#22C55E' : status === 'failed' ? '#EF4444' : status === 'running' ? barColor : 'text.secondary',
            }}
          >
            {status === 'idle' && 'Ready to execute'}
            {status === 'running' && `Executing — ${PHASES[activePhase]?.label ?? 'Processing'}...`}
            {status === 'success' && 'Execution completed successfully'}
            {status === 'failed' && `Execution failed during ${PHASES[activePhase]?.label ?? 'processing'}`}
          </Typography>
          {status === 'running' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box
                sx={{
                  width: 7, height: 7, borderRadius: '50%', bgcolor: barColor,
                  animation: 'runDot 1s ease-in-out infinite',
                  '@keyframes runDot': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
                }}
              />
              <Typography variant="caption" color="text.secondary">In progress</Typography>
            </Box>
          )}
        </Box>

        {/* Mini variant */}
        <Box sx={{ mt: 3 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Mini variant (as seen in execution table rows):
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, borderRadius: 1.5, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="body2" fontWeight={500} sx={{ width: 100 }}>Sleep #42</Typography>
            <Box sx={{ flex: 1, height: 6, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.06)', overflow: 'hidden', position: 'relative' }}>
              <Box
                sx={{
                  height: '100%',
                  width: `${progress * 100}%`,
                  bgcolor: barColor,
                  borderRadius: 1,
                  backgroundImage: status === 'running'
                    ? 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255,255,255,0.1) 4px, rgba(255,255,255,0.1) 8px)'
                    : undefined,
                  backgroundSize: '16px 16px',
                  animation: status === 'running' ? 'miniPole 400ms linear infinite' : undefined,
                  '@keyframes miniPole': { '0%': { backgroundPosition: '0 0' }, '100%': { backgroundPosition: '16px 0' } },
                }}
              />
            </Box>
            <Typography variant="caption" sx={{ color: barColor, fontWeight: 600, width: 40, textAlign: 'right' }}>
              {Math.round(progress * 100)}%
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
