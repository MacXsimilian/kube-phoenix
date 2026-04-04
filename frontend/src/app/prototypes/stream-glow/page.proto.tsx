'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import { useRouter } from 'next/navigation'

interface MetricRow {
  name: string
  value: number
  prev: number
  max: number
  unit: string
}

function randomShift(current: number, max: number): number {
  const delta = (Math.random() - 0.45) * max * 0.12
  return Math.max(0, Math.min(max, Math.round(current + delta)))
}

function AnimatedNumber({ value, duration = 300 }: { value: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const prevRef = useRef(value)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const from = prevRef.current
    const to = value
    prevRef.current = value
    if (from === to) return

    const start = performance.now()
    let frame: number

    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      el!.textContent = String(Math.round(from + (to - from) * eased))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])

  return <span ref={ref}>{value}</span>
}

function MetricBar({ row }: { row: MetricRow }) {
  const pct = (row.value / row.max) * 100
  const changed = row.value !== row.prev
  const increased = row.value > row.prev

  const flashColor = increased
    ? 'rgba(245,158,11,0.25)'
    : 'rgba(34,197,94,0.25)'

  const barColor = pct > 80
    ? '#EF4444'
    : pct > 60
      ? '#F59E0B'
      : '#22C55E'

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 1.5,
        bgcolor: changed ? flashColor : 'transparent',
        transition: 'background-color 600ms ease',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <Typography variant="body2" sx={{ width: 160, fontFamily: 'monospace', fontWeight: 500 }}>
        {row.name}
      </Typography>

      <Box sx={{ flex: 1, position: 'relative', height: 20, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            width: `${pct}%`,
            bgcolor: barColor,
            borderRadius: 1,
            transition: 'width 500ms cubic-bezier(0.22,1,0.36,1), background-color 500ms ease',
          }}
        />
        {/* Glow tip */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${pct}%`,
            width: 6,
            transform: 'translateX(-3px)',
            bgcolor: 'white',
            borderRadius: 1,
            opacity: changed ? 0.8 : 0,
            boxShadow: `0 0 10px ${barColor}, 0 0 20px ${barColor}60`,
            transition: 'left 500ms cubic-bezier(0.22,1,0.36,1), opacity 400ms ease',
          }}
        />
      </Box>

      <Typography
        variant="body2"
        sx={{
          width: 80,
          textAlign: 'right',
          fontFamily: 'monospace',
          fontWeight: 600,
          color: pct > 80 ? '#EF4444' : 'text.primary',
        }}
      >
        <AnimatedNumber value={row.value} /> {row.unit}
      </Typography>
    </Box>
  )
}

const INITIAL_METRICS: MetricRow[] = [
  { name: 'api-server', value: 45, prev: 45, max: 100, unit: '%' },
  { name: 'etcd-cluster', value: 320, prev: 320, max: 1000, unit: 'MB' },
  { name: 'controller-mgr', value: 22, prev: 22, max: 100, unit: '%' },
  { name: 'scheduler', value: 12, prev: 12, max: 100, unit: '%' },
  { name: 'coredns', value: 68, prev: 68, max: 512, unit: 'MB' },
  { name: 'ingress-nginx', value: 55, prev: 55, max: 100, unit: '%' },
  { name: 'prometheus', value: 740, prev: 740, max: 2048, unit: 'MB' },
  { name: 'grafana', value: 31, prev: 31, max: 100, unit: '%' },
]

export default function StreamGlowPrototype() {
  const router = useRouter()
  const [metrics, setMetrics] = useState<MetricRow[]>(INITIAL_METRICS)
  const [streaming, setStreaming] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const tick = useCallback(() => {
    setMetrics((prev) =>
      prev.map((row) => ({
        ...row,
        prev: row.value,
        value: randomShift(row.value, row.max),
      }))
    )
  }, [])

  useEffect(() => {
    if (streaming) {
      intervalRef.current = setInterval(tick, 1500)
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [streaming, tick])

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>B2 — Stream Glow</Typography>
          <Typography variant="body2" color="text.secondary">
            Real-time metric updates with glowing change highlights
          </Typography>
        </Box>
      </Box>

      {/* Controls */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', alignItems: 'center' }}>
        <Button
          variant="contained"
          size="small"
          startIcon={streaming ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
          onClick={() => setStreaming((s) => !s)}
          color={streaming ? 'warning' : 'primary'}
        >
          {streaming ? 'Pause Stream' : 'Start Stream'}
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={tick}
          disabled={streaming}
        >
          Single Tick
        </Button>
        {streaming && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, ml: 'auto' }}>
            <Box
              sx={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                bgcolor: '#22C55E',
                animation: 'streamDot 1.5s ease-in-out infinite',
                '@keyframes streamDot': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
              }}
            />
            <Typography variant="caption" color="text.secondary">Streaming every 1.5s</Typography>
          </Box>
        )}
      </Box>

      {/* Demo area */}
      <Box
        sx={{
          p: 2,
          borderRadius: 2,
          bgcolor: 'background.default',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, px: 1.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ width: 160 }}>COMPONENT</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>USAGE</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ width: 80, textAlign: 'right' }}>VALUE</Typography>
        </Box>
        {metrics.map((row) => (
          <MetricBar key={row.name} row={row} />
        ))}
      </Box>
    </Box>
  )
}
