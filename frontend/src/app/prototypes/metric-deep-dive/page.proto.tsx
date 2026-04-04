'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
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

type MetricType = 'latency' | 'throughput' | 'errors'

const METRIC_CONFIG: Record<MetricType, { label: string; unit: string; color: string; min: number; max: number; vol: number; init: number; warn: number; crit: number }> = {
  latency: { label: 'HTTP P95 Latency', unit: 'ms', color: '#F59E0B', min: 5, max: 600, vol: 40, init: 45, warn: 200, crit: 400 },
  throughput: { label: 'Request Throughput', unit: 'req/s', color: '#22D3EE', min: 10, max: 300, vol: 30, init: 80, warn: 200, crit: 250 },
  errors: { label: 'Error Rate', unit: '/min', color: '#EF4444', min: 0, max: 50, vol: 6, init: 1, warn: 10, crit: 25 },
}

const MAX = 120
const ANNOTATIONS_LATENCY = [
  { x: 30, label: 'Deploy v1.5.2', color: '#7C3AED' },
  { x: 70, label: 'Sleep dev', color: '#a5b4fc' },
  { x: 95, label: 'Wake dev', color: '#86efac' },
]

export default function MetricDeepDivePrototype() {
  const router = useRouter()
  const chartRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<echarts.ECharts | null>(null)
  const [metric, setMetric] = useState<MetricType>('latency')
  const [streaming, setStreaming] = useState(false)
  const dataRef = useRef<{ ts: number; value: number; p50?: number; p99?: number }[]>([])

  const cfg = METRIC_CONFIG[metric]

  const initData = useCallback(() => {
    const now = Date.now()
    dataRef.current = Array.from({ length: MAX }, (_, i) => {
      const base = cfg.init + (Math.random() - 0.5) * cfg.vol
      return {
        ts: now - (MAX - i) * 1000,
        value: base,
        p50: base * 0.6 + (Math.random() - 0.5) * cfg.vol * 0.3,
        p99: base * 1.5 + Math.random() * cfg.vol * 0.5,
      }
    })
  }, [cfg])

  function renderChart() {
    const chart = instanceRef.current
    if (!chart) return
    const data = dataRef.current
    const annotations = metric === 'latency' ? ANNOTATIONS_LATENCY : []

    chart.setOption({
      animation: true,
      animationDuration: 600,
      animationDurationUpdate: 200,
      grid: { left: 60, right: 20, top: 40, bottom: 40 },
      tooltip: {
        trigger: 'axis',
        formatter: (params: { seriesName: string; value: [number, number] }[]) => {
          const ts = new Date(params[0].value[0]).toLocaleTimeString()
          return params.map(p => `<b>${p.seriesName}</b>: ${p.value[1].toFixed(1)} ${cfg.unit}`).join('<br/>') + `<br/><span style="color:#64748B">${ts}</span>`
        },
      },
      xAxis: {
        type: 'time',
        axisLabel: { formatter: (v: number) => new Date(v).toLocaleTimeString().slice(0, 5), fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        name: `${cfg.label} (${cfg.unit})`,
        nameTextStyle: { color: '#64748B', fontSize: 11 },
        axisLabel: { fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      },
      series: [
        // P50 band (lower)
        {
          name: 'P50',
          type: 'line',
          data: data.map(d => [d.ts, d.p50 ?? d.value * 0.6]),
          symbol: 'none',
          lineStyle: { width: 0 },
          areaStyle: { color: 'transparent' },
          stack: 'band',
        },
        // Band between P50 and P99
        {
          name: 'P50–P99 Band',
          type: 'line',
          data: data.map(d => [d.ts, (d.p99 ?? d.value * 1.5) - (d.p50 ?? d.value * 0.6)]),
          symbol: 'none',
          lineStyle: { width: 0 },
          areaStyle: { color: `${cfg.color}10` },
          stack: 'band',
        },
        // Main line (P95)
        {
          name: 'P95',
          type: 'line',
          data: data.map(d => [d.ts, d.value]),
          symbol: 'none',
          lineStyle: { color: cfg.color, width: 2 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: `${cfg.color}20` },
              { offset: 1, color: `${cfg.color}02` },
            ]),
          },
          markLine: {
            silent: true,
            symbol: 'none',
            data: [
              { yAxis: cfg.warn, lineStyle: { color: '#F59E0B40', type: 'dashed', width: 1 }, label: { formatter: 'WARN', fontSize: 9, color: '#F59E0B80', position: 'insideEndTop' } },
              { yAxis: cfg.crit, lineStyle: { color: '#EF444440', type: 'dashed', width: 1 }, label: { formatter: 'CRIT', fontSize: 9, color: '#EF444480', position: 'insideEndTop' } },
              ...annotations.map(a => ({
                xAxis: data[a.x]?.ts,
                lineStyle: { color: `${a.color}60`, type: 'solid' as const, width: 1 },
                label: { formatter: a.label, fontSize: 9, color: a.color, position: 'insideEndTop' as const },
              })),
            ],
          },
          markArea: {
            silent: true,
            data: [
              [{ yAxis: cfg.warn, itemStyle: { color: 'rgba(245,158,11,0.03)' } }, { yAxis: cfg.crit }],
              [{ yAxis: cfg.crit, itemStyle: { color: 'rgba(239,68,68,0.04)' } }, { yAxis: cfg.max * 1.2 }],
            ],
          },
        },
      ],
    }, { replaceMerge: ['series'] })
  }

  useEffect(() => {
    if (!chartRef.current) return
    instanceRef.current?.dispose()
    const chart = echarts.init(chartRef.current, 'kube-phoenix-dark', { renderer: 'canvas' })
    instanceRef.current = chart
    initData()
    renderChart()
    const ob = new ResizeObserver(() => chart.resize())
    ob.observe(chartRef.current)
    return () => { ob.disconnect(); chart.dispose() }
  }, [metric, initData])

  useEffect(() => {
    if (!streaming) return
    const interval = setInterval(() => {
      const prev = dataRef.current[dataRef.current.length - 1]
      const next = rw(prev.value, cfg.min, cfg.max, cfg.vol)
      dataRef.current.push({
        ts: Date.now(),
        value: next,
        p50: next * 0.6 + (Math.random() - 0.5) * cfg.vol * 0.2,
        p99: next * 1.5 + Math.random() * cfg.vol * 0.3,
      })
      if (dataRef.current.length > MAX) dataRef.current.shift()
      renderChart()
    }, 1000)
    return () => clearInterval(interval)
  }, [streaming, cfg])

  const latestVal = dataRef.current[dataRef.current.length - 1]?.value ?? 0
  const isWarn = latestVal >= cfg.warn
  const isCrit = latestVal >= cfg.crit

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>G1-v3 — Metric Deep Dive</Typography>
          <Typography variant="body2" color="text.secondary">
            Single-metric deep view with percentile bands, threshold zones, deploy annotations
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center', flexWrap: 'wrap' }}>
        <ToggleButtonGroup value={metric} exclusive onChange={(_, v) => v && setMetric(v)} size="small">
          <ToggleButton value="latency" sx={{ fontSize: 11, px: 2 }}>Latency</ToggleButton>
          <ToggleButton value="throughput" sx={{ fontSize: 11, px: 2 }}>Throughput</ToggleButton>
          <ToggleButton value="errors" sx={{ fontSize: 11, px: 2 }}>Errors</ToggleButton>
        </ToggleButtonGroup>
        <Button
          variant="contained"
          size="small"
          startIcon={streaming ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
          onClick={() => setStreaming(s => !s)}
          color={streaming ? 'warning' : 'primary'}
        >
          {streaming ? 'Pause' : 'Stream'}
        </Button>

        {/* Live value */}
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
          <Typography sx={{
            fontFamily: 'monospace', fontSize: 28, fontWeight: 700,
            color: isCrit ? '#EF4444' : isWarn ? '#F59E0B' : cfg.color,
            transition: 'color 300ms ease',
          }}>
            {latestVal < 10 ? latestVal.toFixed(1) : Math.round(latestVal)}
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{cfg.unit}</Typography>
          {isCrit && <Chip label="CRITICAL" size="small" sx={{ ml: 1, height: 18, fontSize: 9, bgcolor: 'rgba(239,68,68,0.15)', color: '#EF4444', animation: 'critBlink 1s ease-in-out infinite', '@keyframes critBlink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.5 } } }} />}
          {isWarn && !isCrit && <Chip label="WARNING" size="small" sx={{ ml: 1, height: 18, fontSize: 9, bgcolor: 'rgba(245,158,11,0.15)', color: '#F59E0B' }} />}
        </Box>
      </Box>

      <Box
        ref={chartRef}
        sx={{ width: '100%', height: 400, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: isCrit ? 'rgba(239,68,68,0.3)' : isWarn ? 'rgba(245,158,11,0.2)' : 'divider', transition: 'border-color 300ms ease' }}
      />

      <Box sx={{ display: 'flex', gap: 3, mt: 2, justifyContent: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><Box sx={{ width: 16, height: 2, bgcolor: cfg.color }} /><Typography variant="caption" color="text.secondary">P95</Typography></Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><Box sx={{ width: 16, height: 8, bgcolor: `${cfg.color}10`, borderRadius: 0.5 }} /><Typography variant="caption" color="text.secondary">P50–P99 band</Typography></Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><Box sx={{ width: 16, height: 8, bgcolor: 'rgba(245,158,11,0.05)', border: '1px dashed #F59E0B40', borderRadius: 0.5 }} /><Typography variant="caption" color="text.secondary">Warning zone</Typography></Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><Box sx={{ width: 16, height: 8, bgcolor: 'rgba(239,68,68,0.06)', border: '1px dashed #EF444440', borderRadius: 0.5 }} /><Typography variant="caption" color="text.secondary">Critical zone</Typography></Box>
      </Box>
    </Box>
  )
}
