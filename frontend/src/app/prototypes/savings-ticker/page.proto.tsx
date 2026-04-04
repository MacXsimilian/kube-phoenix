'use client'

import { useState, useEffect, useRef } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import ReplayIcon from '@mui/icons-material/Replay'
import { useRouter } from 'next/navigation'

const RATE_PER_SECOND = 0.0033 // ~$12/hr across sleeping nodes
const POLICIES = [
  { name: 'EU Dev Sleep', rate: 0.0018, sleeping: true },
  { name: 'US Staging Nightly', rate: 0.0012, sleeping: true },
  { name: 'Cost Optimization', rate: 0.0003, sleeping: false },
]

function formatMoney(val: number) {
  if (val >= 1000) return `$${(val / 1000).toFixed(2)}k`
  if (val >= 1) return `$${val.toFixed(2)}`
  return `$${val.toFixed(4)}`
}

function TickerDigit({ value }: { value: string }) {
  return (
    <Box
      sx={{
        width: value === '.' || value === ',' || value === '$' ? 'auto' : 36,
        height: 56,
        mx: value === '.' || value === ',' ? 0 : 0.25,
        bgcolor: value === '$' ? 'transparent' : 'rgba(255,255,255,0.04)',
        borderRadius: 1,
        border: value === '$' || value === '.' || value === ',' ? 'none' : '1px solid',
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Typography
        key={value}
        sx={{
          fontFamily: 'monospace',
          fontSize: value === '$' ? 28 : 32,
          fontWeight: 700,
          color: value === '$' ? '#22C55E' : '#E2E8F0',
          animation: 'digitFlip 200ms ease-out',
          '@keyframes digitFlip': {
            from: { transform: 'translateY(-8px)', opacity: 0.3 },
            to: { transform: 'translateY(0)', opacity: 1 },
          },
        }}
      >
        {value}
      </Typography>
    </Box>
  )
}

function MoneyTicker({ value }: { value: number }) {
  const formatted = formatMoney(value)
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {formatted.split('').map((char, i) => (
        <TickerDigit key={`${i}-${char}`} value={char} />
      ))}
    </Box>
  )
}

export default function SavingsTickerPrototype() {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [savedTotal, setSavedTotal] = useState(47.82)
  const [savedToday, setSavedToday] = useState(4.21)
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!running) return
    intervalRef.current = setInterval(() => {
      setSavedTotal(prev => prev + RATE_PER_SECOND)
      setSavedToday(prev => prev + RATE_PER_SECOND)
      setElapsed(prev => prev + 1)
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running])

  const reset = () => {
    setRunning(false)
    setSavedTotal(47.82)
    setSavedToday(4.21)
    setElapsed(0)
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>H1 — Savings Ticker</Typography>
          <Typography variant="body2" color="text.secondary">
            Real-time cost savings counter that ticks up while workloads are sleeping
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', alignItems: 'center' }}>
        <Button variant="contained" size="small" startIcon={running ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />} onClick={() => setRunning(s => !s)} color={running ? 'warning' : 'primary'}>
          {running ? 'Pause' : 'Start Ticking'}
        </Button>
        <Button variant="outlined" size="small" startIcon={<ReplayIcon fontSize="small" />} onClick={reset}>Reset</Button>
      </Box>

      {/* Main ticker */}
      <Box sx={{ p: 4, borderRadius: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', textAlign: 'center', mb: 3 }}>
        <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, display: 'block', mb: 2 }}>
          Total Saved This Week
        </Typography>
        <MoneyTicker value={savedTotal} />
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', gap: 4 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: '#22C55E' }}>
              {formatMoney(savedToday)}
            </Typography>
            <Typography variant="caption" color="text.secondary">Today</Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: '#7C3AED' }}>
              {POLICIES.filter(p => p.sleeping).length}
            </Typography>
            <Typography variant="caption" color="text.secondary">Policies Sleeping</Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: '#22D3EE' }}>
              {formatMoney(RATE_PER_SECOND * 3600)}
            </Typography>
            <Typography variant="caption" color="text.secondary">Per Hour</Typography>
          </Box>
        </Box>
      </Box>

      {/* Per-policy breakdown */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {POLICIES.map(p => (
          <Box key={p.name} sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', opacity: p.sleeping ? 1 : 0.4 }}>
            <Box sx={{
              width: 8, height: 8, borderRadius: '50%',
              bgcolor: p.sleeping ? '#22C55E' : '#94A3B8',
              ...(p.sleeping && running && {
                animation: 'tickDot 1s ease-in-out infinite',
                '@keyframes tickDot': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
              }),
            }} />
            <Typography variant="body2" fontWeight={500} sx={{ flex: 1 }}>{p.name}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
              {formatMoney(p.rate * 3600)}/hr
            </Typography>
            <Typography sx={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600, color: p.sleeping ? '#22C55E' : 'text.secondary', minWidth: 70, textAlign: 'right' }}>
              {p.sleeping ? formatMoney(p.rate * elapsed + Math.random() * 0.5 + 5) : '—'}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
