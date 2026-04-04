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
import * as echarts from 'echarts'
import { darkTheme } from '@/lib/motion/echartsTheme'

echarts.registerTheme('kube-phoenix-dark', darkTheme)

function randomWalk(prev: number, min: number, max: number, volatility: number) {
  return Math.max(min, Math.min(max, prev + (Math.random() - 0.48) * volatility))
}

const METRICS = [
  { key: 'executions', label: 'Policy Executions / min', color: '#7C3AED', min: 0, max: 8, vol: 2, init: 2 },
  { key: 'k8s_api', label: 'K8s API Calls / sec', color: '#22D3EE', min: 5, max: 80, vol: 12, init: 25 },
  { key: 'ws_conns', label: 'WebSocket Connections', color: '#22C55E', min: 0, max: 20, vol: 3, init: 4 },
  { key: 'http_latency', label: 'HTTP P95 Latency (ms)', color: '#F59E0B', min: 5, max: 200, vol: 30, init: 35 },
]

const MAX_POINTS = 40

export default function PrometheusDashboardPrototype() {
  const router = useRouter()
  const [streaming, setStreaming] = useState(false)
  const chartsRef = useRef<Record<string, echarts.ECharts>>({})
  const dataRef = useRef<Record<string, { ts: number; value: number }[]>>({})
  const containerRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const initCharts = useCallback(() => {
    const now = Date.now()
    for (const m of METRICS) {
      dataRef.current[m.key] = Array.from({ length: MAX_POINTS }, (_, i) => ({
        ts: now - (MAX_POINTS - i) * 2000,
        value: m.init + (Math.random() - 0.5) * m.vol,
      }))
    }
    for (const m of METRICS) {
      const el = containerRefs.current[m.key]
      if (!el) continue
      chartsRef.current[m.key]?.dispose()
      const chart = echarts.init(el, 'kube-phoenix-dark', { renderer: 'canvas' })
      chartsRef.current[m.key] = chart
      updateChart(m.key, chart)
    }
  }, [])

  function updateChart(key: string, chart: echarts.ECharts) {
    const m = METRICS.find(x => x.key === key)!
    const data = dataRef.current[key]
    chart.setOption({
      animation: true,
      animationDuration: 800,
      animationDurationUpdate: 300,
      grid: { left: 45, right: 12, top: 8, bottom: 24 },
      xAxis: {
        type: 'time',
        axisLabel: { formatter: (v: number) => new Date(v).toLocaleTimeString().slice(0, 5), fontSize: 10 },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        min: m.min,
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
        axisLabel: { fontSize: 10 },
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params: { value: [number, number] }[]) => {
          const [ts, val] = params[0]?.value ?? [0, 0]
          return `${new Date(ts).toLocaleTimeString()}<br/><b>${val.toFixed(1)}</b>`
        },
      },
      series: [{
        type: 'line',
        data: data.map(d => [d.ts, d.value]),
        symbol: 'none',
        lineStyle: { color: m.color, width: 2 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: `${m.color}20` },
            { offset: 1, color: `${m.color}03` },
          ]),
        },
      }],
    })
  }

  useEffect(() => {
    initCharts()
    const ob = new ResizeObserver(() => {
      Object.values(chartsRef.current).forEach(c => c.resize())
    })
    for (const el of Object.values(containerRefs.current)) {
      if (el) ob.observe(el)
    }
    return () => {
      ob.disconnect()
      Object.values(chartsRef.current).forEach(c => c.dispose())
    }
  }, [initCharts])

  useEffect(() => {
    if (!streaming) return
    const interval = setInterval(() => {
      for (const m of METRICS) {
        const data = dataRef.current[m.key]
        const prev = data[data.length - 1]?.value ?? m.init
        data.push({ ts: Date.now(), value: randomWalk(prev, m.min, m.max, m.vol) })
        if (data.length > MAX_POINTS) data.shift()
        const chart = chartsRef.current[m.key]
        if (chart) updateChart(m.key, chart)
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [streaming])

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>G1 — Prometheus Dashboard</Typography>
          <Typography variant="body2" color="text.secondary">
            4-panel metric dashboard with eCharts streaming line charts
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', alignItems: 'center' }}>
        <Button
          variant="contained"
          size="small"
          startIcon={streaming ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
          onClick={() => setStreaming(s => !s)}
          color={streaming ? 'warning' : 'primary'}
        >
          {streaming ? 'Pause' : 'Stream Metrics'}
        </Button>
        {streaming && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, ml: 'auto' }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#22C55E', animation: 'promDot 2s ease-in-out infinite', '@keyframes promDot': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } } }} />
            <Typography variant="caption" color="text.secondary">Streaming 4 metrics · 2s interval</Typography>
          </Box>
        )}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        {METRICS.map(m => (
          <Box key={m.key} sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: m.color }} />
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11, fontWeight: 600 }}>
                {m.label}
              </Typography>
            </Box>
            <Box
              ref={(el: HTMLDivElement | null) => { containerRefs.current[m.key] = el }}
              sx={{ width: '100%', height: 140 }}
            />
          </Box>
        ))}
      </Box>
    </Box>
  )
}
