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

const MAX_POINTS = 30

function genPoint(prev: { cpu: number; mem: number }) {
  return {
    cpu: Math.max(5, Math.min(95, prev.cpu + (Math.random() - 0.48) * 15)),
    mem: Math.max(20, Math.min(90, prev.mem + (Math.random() - 0.48) * 8)),
    ts: Date.now(),
  }
}

export default function PodMetricsChartPrototype() {
  const router = useRouter()
  const chartRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<echarts.ECharts | null>(null)
  const [streaming, setStreaming] = useState(false)
  const dataRef = useRef<{ cpu: number; mem: number; ts: number }[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const initChart = useCallback(() => {
    if (!chartRef.current) return
    instanceRef.current?.dispose()
    const chart = echarts.init(chartRef.current, 'kube-phoenix-dark', { renderer: 'canvas' })
    instanceRef.current = chart

    const now = Date.now()
    dataRef.current = Array.from({ length: MAX_POINTS }, (_, i) => ({
      cpu: 30 + Math.random() * 20,
      mem: 40 + Math.random() * 15,
      ts: now - (MAX_POINTS - i) * 2000,
    }))

    updateChart(chart, dataRef.current)
    return chart
  }, [])

  function updateChart(chart: echarts.ECharts, data: typeof dataRef.current) {
    chart.setOption({
      animation: true,
      animationDurationUpdate: 300,
      animationEasingUpdate: 'cubicInOut',
      tooltip: {
        trigger: 'axis',
        formatter: (params: { seriesName: string; value: [number, number] }[]) => {
          const ts = new Date(params[0].value[0]).toLocaleTimeString()
          return params.map(p => `${p.seriesName}: ${p.value[1].toFixed(1)}%`).join('<br/>') + `<br/><span style="color:#64748B">${ts}</span>`
        },
      },
      grid: { left: 50, right: 50, top: 20, bottom: 32 },
      xAxis: { type: 'time', axisLabel: { formatter: (v: number) => new Date(v).toLocaleTimeString().slice(0, 5) } },
      yAxis: [
        { type: 'value', name: 'CPU %', min: 0, max: 100, position: 'left', axisLabel: { formatter: '{value}%' } },
        { type: 'value', name: 'MEM %', min: 0, max: 100, position: 'right', axisLabel: { formatter: '{value}%' } },
      ],
      series: [
        {
          name: 'CPU',
          type: 'line',
          yAxisIndex: 0,
          data: data.map(d => [d.ts, d.cpu]),
          symbol: 'none',
          lineStyle: { color: '#22D3EE', width: 2 },
          areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(34,211,238,0.15)' }, { offset: 1, color: 'rgba(34,211,238,0.02)' }]) },
          markLine: {
            silent: true,
            symbol: 'none',
            data: [
              { yAxis: 80, lineStyle: { color: '#F59E0B40', type: 'dashed' }, label: { show: false } },
              { yAxis: 90, lineStyle: { color: '#EF444440', type: 'dashed' }, label: { show: false } },
            ],
          },
        },
        {
          name: 'Memory',
          type: 'line',
          yAxisIndex: 1,
          data: data.map(d => [d.ts, d.mem]),
          symbol: 'none',
          lineStyle: { color: '#7C3AED', width: 2 },
          areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(124,58,237,0.15)' }, { offset: 1, color: 'rgba(124,58,237,0.02)' }]) },
        },
      ],
    })
  }

  useEffect(() => {
    const chart = initChart()
    const ob = new ResizeObserver(() => chart?.resize())
    if (chartRef.current) ob.observe(chartRef.current)
    return () => { ob.disconnect(); instanceRef.current?.dispose() }
  }, [initChart])

  useEffect(() => {
    if (streaming) {
      intervalRef.current = setInterval(() => {
        const prev = dataRef.current[dataRef.current.length - 1] ?? { cpu: 40, mem: 50 }
        const pt = genPoint(prev)
        dataRef.current.push(pt)
        if (dataRef.current.length > MAX_POINTS) dataRef.current.shift()
        if (instanceRef.current) updateChart(instanceRef.current, dataRef.current)
      }, 2000)
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [streaming])

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>F7 — Pod Metrics Chart</Typography>
          <Typography variant="body2" color="text.secondary">
            Dual-axis streaming CPU/Memory chart with eCharts real-time updates
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
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#22C55E', animation: 'metricDot 2s ease-in-out infinite', '@keyframes metricDot': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } } }} />
            <Typography variant="caption" color="text.secondary">Live — 2s interval</Typography>
          </Box>
        )}
      </Box>

      <Box
        ref={chartRef}
        sx={{ width: '100%', height: 320, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', p: 1 }}
      />

      <Box sx={{ display: 'flex', gap: 3, mt: 2, justifyContent: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{ width: 20, height: 3, bgcolor: '#22D3EE', borderRadius: 1 }} />
          <Typography variant="caption" color="text.secondary">CPU</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{ width: 20, height: 3, bgcolor: '#7C3AED', borderRadius: 1 }} />
          <Typography variant="caption" color="text.secondary">Memory</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{ width: 20, height: 1, bgcolor: '#F59E0B40', borderRadius: 1 }} />
          <Typography variant="caption" color="text.secondary">Warning (80%)</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{ width: 20, height: 1, bgcolor: '#EF444440', borderRadius: 1 }} />
          <Typography variant="caption" color="text.secondary">Critical (90%)</Typography>
        </Box>
      </Box>
    </Box>
  )
}
