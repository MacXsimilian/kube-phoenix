'use client'

import { useState, useEffect, useRef } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ReplayIcon from '@mui/icons-material/Replay'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import { useRouter } from 'next/navigation'

function formatCountdown(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function CountdownRing({ totalSeconds, remainingSeconds, color, size }: {
  totalSeconds: number; remainingSeconds: number; color: string; size: number
}) {
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const progress = 1 - (remainingSeconds / totalSeconds)
  const offset = circumference * (1 - progress)
  const isUrgent = remainingSeconds < 300

  return (
    <Box sx={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={4} />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      {isUrgent && (
        <Box sx={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          animation: 'urgentPulse 1s ease-in-out infinite',
          '@keyframes urgentPulse': {
            '0%, 100%': { boxShadow: `0 0 0 0 ${color}00` },
            '50%': { boxShadow: `0 0 0 8px ${color}20` },
          },
        }} />
      )}
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Typography sx={{ fontFamily: 'monospace', fontSize: size > 140 ? 24 : 16, fontWeight: 700, color, letterSpacing: 1 }}>
          {formatCountdown(remainingSeconds)}
        </Typography>
      </Box>
    </Box>
  )
}

interface PolicyCountdown {
  name: string
  direction: 'sleep' | 'wake'
  totalSeconds: number
  color: string
}

const MOCK_POLICIES: PolicyCountdown[] = [
  { name: 'EU Dev Sleep', direction: 'sleep', totalSeconds: 4 * 3600, color: '#7C3AED' },
  { name: 'US Staging Nightly', direction: 'wake', totalSeconds: 2 * 3600, color: '#22C55E' },
  { name: 'Cost Optimization', direction: 'sleep', totalSeconds: 8 * 3600, color: '#3B82F6' },
]

export default function NextRunCountdownPrototype() {
  const router = useRouter()
  const [elapsed, setElapsed] = useState(0)
  const [speed, setSpeed] = useState(1)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setElapsed(prev => prev + speed)
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [speed])

  const reset = () => setElapsed(0)

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>G5 — Next Run Countdown</Typography>
          <Typography variant="body2" color="text.secondary">
            Animated ring countdown for next scheduled policy transition
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', alignItems: 'center' }}>
        <Button variant="outlined" size="small" startIcon={<ReplayIcon fontSize="small" />} onClick={reset}>Reset</Button>
        {[1, 10, 60, 300].map(s => (
          <Button key={s} variant={speed === s ? 'contained' : 'outlined'} size="small" onClick={() => setSpeed(s)} sx={{ fontSize: 11 }}>
            {s}x
          </Button>
        ))}
      </Box>

      {/* Large hero countdown for nearest policy */}
      <Box sx={{ mb: 4, p: 4, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <Typography variant="subtitle2" color="text.secondary">NEXT TRANSITION</Typography>
        <CountdownRing
          totalSeconds={MOCK_POLICIES[0].totalSeconds}
          remainingSeconds={Math.max(0, MOCK_POLICIES[0].totalSeconds - elapsed)}
          color={MOCK_POLICIES[0].color}
          size={160}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BedtimeIcon sx={{ fontSize: 16, color: MOCK_POLICIES[0].color }} />
          <Typography variant="body2" fontWeight={600}>{MOCK_POLICIES[0].name}</Typography>
          <Typography variant="caption" color="text.secondary">→ Sleep</Typography>
        </Box>
      </Box>

      {/* Compact countdowns for all policies */}
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
        All upcoming transitions:
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
        {MOCK_POLICIES.map(p => {
          const remaining = Math.max(0, p.totalSeconds - elapsed)
          return (
            <Box key={p.name} sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
              <CountdownRing totalSeconds={p.totalSeconds} remainingSeconds={remaining} color={p.color} size={100} />
              <Box sx={{ textAlign: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}>
                  {p.direction === 'sleep' ? <BedtimeIcon sx={{ fontSize: 14, color: p.color }} /> : <WbSunnyIcon sx={{ fontSize: 14, color: p.color }} />}
                  <Typography variant="caption" fontWeight={600} sx={{ fontSize: 11 }}>{p.name}</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                  {remaining === 0 ? 'Transitioning...' : `${p.direction} in ${formatCountdown(remaining)}`}
                </Typography>
              </Box>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
