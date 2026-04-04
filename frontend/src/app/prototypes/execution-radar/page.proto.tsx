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

const INDICATORS = [
  { name: 'Scaled', max: 20 },
  { name: 'Drained', max: 5 },
  { name: 'Skipped', max: 10 },
  { name: 'Errors', max: 5 },
  { name: 'Protected', max: 10 },
  { name: 'Duration (s)', max: 60 },
]

const EXECUTIONS = [
  { name: 'Sleep #8 (running)', values: [4, 0, 0, 1, 2, 25], color: '#F59E0B', lineType: 'dashed' as const },
  { name: 'Sleep #6 (success)', values: [8, 1, 0, 0, 0, 12], color: '#7C3AED', lineType: 'solid' as const },
  { name: 'Wake #7 (success)', values: [8, 0, 0, 0, 0, 8], color: '#22C55E', lineType: 'solid' as const },
  { name: 'Sleep #5 (failed)', values: [4, 0, 2, 3, 1, 45], color: '#EF4444', lineType: 'solid' as const },
]

export default function ExecutionRadarPrototype() {
  const router = useRouter()
  const chartRef = useRef<HTMLDivElement>(null)
  const [key, setKey] = useState(0)

  useEffect(() => {
    if (!chartRef.current) return
    const chart = echarts.init(chartRef.current, 'kube-phoenix-dark', { renderer: 'canvas' })

    chart.setOption({
      animation: true,
      animationDuration: 1000,
      animationEasing: 'cubicOut',
      tooltip: { trigger: 'item' },
      legend: {
        data: EXECUTIONS.map(e => e.name),
        bottom: 10,
        textStyle: { color: '#94A3B8', fontSize: 11 },
      },
      radar: {
        indicator: INDICATORS,
        shape: 'polygon',
        center: ['50%', '45%'],
        radius: '65%',
        axisName: { color: '#94A3B8', fontSize: 11 },
        splitArea: { areaStyle: { color: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.01)'] } },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      },
      series: [{
        type: 'radar',
        data: EXECUTIONS.map(e => ({
          value: e.values,
          name: e.name,
          symbol: 'circle',
          symbolSize: 5,
          lineStyle: { color: e.color, width: 2, type: e.lineType },
          areaStyle: { color: `${e.color}15` },
          itemStyle: { color: e.color },
        })),
        animationDuration: 1000,
        animationEasing: 'cubicOut',
      }],
    })

    const ob = new ResizeObserver(() => chart.resize())
    ob.observe(chartRef.current)
    return () => { ob.disconnect(); chart.dispose() }
  }, [key])

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small"><ArrowBackIcon fontSize="small" /></IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>I3 — Execution Radar</Typography>
          <Typography variant="body2" color="text.secondary">Radar chart comparing executions across 6 dimensions — overlay multiple runs to spot anomalies</Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider' }}>
        <Button variant="contained" size="small" startIcon={<ReplayIcon fontSize="small" />} onClick={() => setKey(k => k + 1)}>Replay</Button>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto', alignSelf: 'center' }}>
          Dashed = running · Failed shows high errors + duration
        </Typography>
      </Box>

      <Box ref={chartRef} sx={{ width: '100%', height: 480, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }} />
    </Box>
  )
}
