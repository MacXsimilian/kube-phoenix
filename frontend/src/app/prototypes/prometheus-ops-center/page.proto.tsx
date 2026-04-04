'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import { useRouter } from 'next/navigation'
import * as echarts from 'echarts'
import { darkTheme } from '@/lib/motion/echartsTheme'

echarts.registerTheme('kube-phoenix-dark', darkTheme)

function rw(prev: number, min: number, max: number, vol: number) {
  return Math.max(min, Math.min(max, prev + (Math.random() - 0.48) * vol))
}

const MAX = 60

interface Metric {
  key: string; label: string; unit: string; color: string
  min: number; max: number; vol: number; init: number
  warn?: number; crit?: number
}

const METRICS: Metric[] = [
  { key: 'exec_rate', label: 'Execution Rate', unit: '/min', color: '#7C3AED', min: 0, max: 12, vol: 3, init: 2 },
  { key: 'k8s_api', label: 'K8s API Calls', unit: '/sec', color: '#22D3EE', min: 5, max: 120, vol: 18, init: 30, warn: 80, crit: 100 },
  { key: 'http_p95', label: 'HTTP P95 Latency', unit: 'ms', color: '#F59E0B', min: 8, max: 500, vol: 50, init: 45, warn: 200, crit: 400 },
  { key: 'http_rps', label: 'HTTP Requests', unit: '/sec', color: '#3B82F6', min: 10, max: 200, vol: 25, init: 60 },
  { key: 'ws_conns', label: 'WebSocket Conns', unit: '', color: '#22C55E', min: 0, max: 30, vol: 4, init: 5 },
  { key: 'cache_hit', label: 'Cache Hit Rate', unit: '%', color: '#14B8A6', min: 60, max: 100, vol: 8, init: 92 },
  { key: 'db_conns', label: 'DB Pool Active', unit: '', color: '#6366F1', min: 0, max: 20, vol: 5, init: 4, warn: 15, crit: 19 },
  { key: 'err_rate', label: 'Error Rate', unit: '/min', color: '#EF4444', min: 0, max: 20, vol: 4, init: 0.5, warn: 5, crit: 10 },
]

function MiniSparkline({ data, color, warn, crit }: { data: number[]; color: string; warn?: number; crit?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = canvas.width
    const h = canvas.height
    const max = Math.max(...data, warn ?? 0, crit ?? 0, 1)

    ctx.clearRect(0, 0, w, h)

    // Threshold zones
    if (crit != null) {
      ctx.fillStyle = 'rgba(239,68,68,0.06)'
      ctx.fillRect(0, 0, w, h * (1 - crit / max))
    }
    if (warn != null) {
      ctx.fillStyle = 'rgba(245,158,11,0.04)'
      const warnY = h * (1 - warn / max)
      const critY = crit != null ? h * (1 - crit / max) : 0
      ctx.fillRect(0, critY, w, warnY - critY)
    }

    // Line
    ctx.beginPath()
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    const step = w / (data.length - 1 || 1)
    for (let i = 0; i < data.length; i++) {
      const x = i * step
      const y = h - (data[i] / max) * h
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, h)
    gradient.addColorStop(0, color + '18')
    gradient.addColorStop(1, color + '02')
    ctx.lineTo(w, h)
    ctx.lineTo(0, h)
    ctx.closePath()
    ctx.fillStyle = gradient
    ctx.fill()

    // Tip dot
    if (data.length > 0) {
      const lastX = (data.length - 1) * step
      const lastY = h - (data[data.length - 1] / max) * h
      ctx.beginPath()
      ctx.fillStyle = color
      ctx.arc(lastX, lastY, 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [data, color, warn, crit])

  return <canvas ref={ref} width={200} height={48} style={{ width: '100%', height: 48 }} />
}

function CounterValue({ value, unit, color, warn, crit }: { value: number; unit: string; color: string; warn?: number; crit?: number }) {
  const displayColor = crit != null && value >= crit ? '#EF4444' : warn != null && value >= warn ? '#F59E0B' : color
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
      <Typography sx={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 700, color: displayColor, transition: 'color 300ms ease' }}>
        {value < 10 ? value.toFixed(1) : Math.round(value)}
      </Typography>
      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{unit}</Typography>
    </Box>
  )
}

export default function PrometheusOpsCenterPrototype() {
  const router = useRouter()
  const [streaming, setStreaming] = useState(false)
  const [incidents, setIncidents] = useState<{ time: string; msg: string; color: string }[]>([])
  const dataRef = useRef<Record<string, number[]>>({})

  const [, forceUpdate] = useState(0)

  const init = useCallback(() => {
    for (const m of METRICS) {
      dataRef.current[m.key] = Array.from({ length: MAX }, () => m.init + (Math.random() - 0.5) * m.vol * 0.5)
    }
    forceUpdate(n => n + 1)
  }, [])

  useEffect(() => { init() }, [init])

  useEffect(() => {
    if (!streaming) return
    const interval = setInterval(() => {
      for (const m of METRICS) {
        const arr = dataRef.current[m.key] ?? []
        const prev = arr[arr.length - 1] ?? m.init
        const next = rw(prev, m.min, m.max, m.vol)
        arr.push(next)
        if (arr.length > MAX) arr.shift()

        if (m.crit != null && next >= m.crit && prev < m.crit) {
          const ts = new Date().toLocaleTimeString()
          setIncidents(prev => [{ time: ts, msg: `${m.label} crossed critical threshold (${Math.round(next)}${m.unit})`, color: '#EF4444' }, ...prev].slice(0, 8))
        } else if (m.warn != null && next >= m.warn && prev < m.warn) {
          const ts = new Date().toLocaleTimeString()
          setIncidents(prev => [{ time: ts, msg: `${m.label} crossed warning threshold (${Math.round(next)}${m.unit})`, color: '#F59E0B' }, ...prev].slice(0, 8))
        }
      }
      forceUpdate(n => n + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [streaming])

  const latestValue = (key: string) => {
    const arr = dataRef.current[key]
    return arr?.[arr.length - 1] ?? 0
  }

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>G1-v2 — Ops Center</Typography>
          <Typography variant="body2" color="text.secondary">
            8-metric dashboard with live counters, sparklines, threshold alerts, and incident feed
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="small"
          startIcon={streaming ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
          onClick={() => setStreaming(s => !s)}
          color={streaming ? 'warning' : 'primary'}
        >
          {streaming ? 'Pause' : 'Go Live'}
        </Button>
      </Box>

      {/* Status bar */}
      <Box sx={{ display: 'flex', gap: 1, mb: 3, alignItems: 'center' }}>
        {streaming && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#22C55E', animation: 'opsDot 1s ease-in-out infinite', '@keyframes opsDot': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } } }} />
            <Typography variant="caption" sx={{ color: '#22C55E', fontWeight: 600 }}>LIVE</Typography>
          </Box>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          {streaming ? '1s refresh · 8 metrics' : 'Paused'}
        </Typography>
      </Box>

      {/* Metric cards grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1.5, mb: 3 }}>
        {METRICS.map(m => {
          const val = latestValue(m.key)
          const isWarn = m.warn != null && val >= m.warn
          const isCrit = m.crit != null && val >= m.crit
          return (
            <Box
              key={m.key}
              sx={{
                p: 1.5, borderRadius: 2, bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: isCrit ? 'rgba(239,68,68,0.4)' : isWarn ? 'rgba(245,158,11,0.3)' : 'divider',
                transition: 'border-color 300ms ease',
                ...(isCrit && {
                  animation: 'critPulse 1s ease-in-out infinite',
                  '@keyframes critPulse': {
                    '0%,100%': { boxShadow: '0 0 0 0 rgba(239,68,68,0)' },
                    '50%': { boxShadow: '0 0 0 3px rgba(239,68,68,0.15)' },
                  },
                }),
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: m.color }} />
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, fontWeight: 600, flex: 1 }}>
                  {m.label}
                </Typography>
                {isCrit && <Chip label="CRIT" size="small" sx={{ height: 14, fontSize: 8, bgcolor: 'rgba(239,68,68,0.15)', color: '#EF4444' }} />}
                {isWarn && !isCrit && <Chip label="WARN" size="small" sx={{ height: 14, fontSize: 8, bgcolor: 'rgba(245,158,11,0.15)', color: '#F59E0B' }} />}
              </Box>
              <CounterValue value={val} unit={m.unit} color={m.color} warn={m.warn} crit={m.crit} />
              <MiniSparkline data={dataRef.current[m.key] ?? []} color={m.color} warn={m.warn} crit={m.crit} />
            </Box>
          )
        })}
      </Box>

      {/* Incident feed */}
      <Box sx={{ p: 2, borderRadius: 2, bgcolor: '#0A0A0F', border: '1px solid', borderColor: 'divider', maxHeight: 200, overflow: 'auto' }}>
        <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', mb: 1 }}>
          Threshold Events
        </Typography>
        {incidents.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: 11 }}>
            {streaming ? 'Watching for threshold crossings...' : 'Start streaming to detect threshold events'}
          </Typography>
        )}
        {incidents.map((inc, i) => (
          <Box key={i} sx={{
            display: 'flex', gap: 1, py: 0.25, fontFamily: 'monospace', fontSize: 11,
            animation: 'incIn 200ms ease-out',
            '@keyframes incIn': { from: { opacity: 0, transform: 'translateX(8px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
          }}>
            <Typography component="span" sx={{ color: 'text.disabled', fontFamily: 'inherit', fontSize: 'inherit', flexShrink: 0 }}>{inc.time}</Typography>
            <Typography component="span" sx={{ color: inc.color, fontFamily: 'inherit', fontSize: 'inherit' }}>{inc.msg}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
