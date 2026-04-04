'use client'

import { useState, useEffect, useRef } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ReplayIcon from '@mui/icons-material/Replay'
import { useRouter } from 'next/navigation'
import * as echarts from 'echarts'
import { darkTheme } from '@/lib/motion/echartsTheme'

echarts.registerTheme('kube-phoenix-dark', darkTheme)

interface Execution {
  id: number
  direction: 'sleep' | 'wake'
  status: 'success' | 'failed' | 'running'
  startHour: number
  durationMin: number
  scaled: number
}

const MOCK_EXECUTIONS: Execution[] = [
  { id: 8, direction: 'sleep', status: 'running', startHour: 20.0, durationMin: 5, scaled: 2 },
  { id: 7, direction: 'wake', status: 'success', startHour: 7.0, durationMin: 3, scaled: 4 },
  { id: 6, direction: 'sleep', status: 'success', startHour: 20.0, durationMin: 4, scaled: 4 },
  { id: 5, direction: 'sleep', status: 'failed', startHour: 20.0, durationMin: 8, scaled: 2 },
  { id: 4, direction: 'wake', status: 'success', startHour: 7.0, durationMin: 2, scaled: 4 },
  { id: 3, direction: 'sleep', status: 'success', startHour: 20.0, durationMin: 5, scaled: 4 },
  { id: 2, direction: 'wake', status: 'success', startHour: 7.0, durationMin: 3, scaled: 4 },
  { id: 1, direction: 'sleep', status: 'success', startHour: 20.0, durationMin: 6, scaled: 4 },
]

const COLORS = {
  sleep: { success: '#a5b4fc', failed: '#fca5a5', running: '#fcd34d' },
  wake: { success: '#86efac', failed: '#fca5a5', running: '#fcd34d' },
}

export default function ExecutionGanttPrototype() {
  const router = useRouter()
  const chartRef = useRef<HTMLDivElement>(null)
  const [key, setKey] = useState(0)

  useEffect(() => {
    if (!chartRef.current) return
    const chart = echarts.init(chartRef.current, 'kube-phoenix-dark', { renderer: 'canvas' })

    const categories = MOCK_EXECUTIONS.map(e => `#${e.id} ${e.direction}`)

    chart.setOption({
      animation: true,
      animationDuration: 600,
      animationEasing: 'cubicOut',
      animationDelay: (idx: number) => idx * 60,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      grid: { left: 100, right: 30, top: 20, bottom: 40 },
      xAxis: {
        type: 'value',
        min: 0,
        max: 24,
        axisLabel: { formatter: (v: number) => `${v}:00` },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      },
      yAxis: {
        type: 'category',
        data: categories,
        axisLabel: { fontSize: 11, fontFamily: 'monospace' },
      },
      series: [
        {
          name: 'Offset',
          type: 'bar',
          stack: 'gantt',
          data: MOCK_EXECUTIONS.map(e => e.startHour),
          itemStyle: { color: 'transparent' },
          emphasis: { itemStyle: { color: 'transparent' } },
          tooltip: { show: false },
        },
        {
          name: 'Duration',
          type: 'bar',
          stack: 'gantt',
          data: MOCK_EXECUTIONS.map(e => ({
            value: e.durationMin / 60,
            itemStyle: {
              color: COLORS[e.direction][e.status],
              borderRadius: [3, 3, 3, 3],
              borderColor: e.status === 'failed' ? '#EF4444' : 'transparent',
              borderWidth: e.status === 'failed' ? 1.5 : 0,
            },
          })),
          barWidth: '50%',
          animationDuration: 600,
          animationDelay: (idx: number) => idx * 60,
          animationEasing: 'cubicOut',
        },
      ],
    })

    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(chartRef.current)

    return () => { observer.disconnect(); chart.dispose() }
  }, [key])

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>F2 — Execution Gantt</Typography>
          <Typography variant="body2" color="text.secondary">
            Horizontal bar timeline of policy executions with staggered draw-in
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider' }}>
        <Button variant="contained" size="small" startIcon={<ReplayIcon fontSize="small" />} onClick={() => setKey(k => k + 1)}>
          Replay
        </Button>
        <Box sx={{ display: 'flex', gap: 2, ml: 'auto', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: '#a5b4fc' }} />
            <Typography variant="caption" color="text.secondary">Sleep</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: '#86efac' }} />
            <Typography variant="caption" color="text.secondary">Wake</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: '#fca5a5', border: '1px solid #EF4444' }} />
            <Typography variant="caption" color="text.secondary">Failed</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: '#fcd34d' }} />
            <Typography variant="caption" color="text.secondary">Running</Typography>
          </Box>
        </Box>
      </Box>

      <Box
        ref={chartRef}
        sx={{ width: '100%', height: 360, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', p: 1 }}
      />
    </Box>
  )
}
