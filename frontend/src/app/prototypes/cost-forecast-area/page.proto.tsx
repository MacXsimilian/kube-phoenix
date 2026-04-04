'use client'

import { useState, useEffect, useRef } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ReplayIcon from '@mui/icons-material/Replay'
import { useRouter } from 'next/navigation'
import * as echarts from 'echarts'
import { darkTheme } from '@/lib/motion/echartsTheme'

echarts.registerTheme('kube-phoenix-dark', darkTheme)

type Range = '7d' | '30d' | '90d'

function generateForecastData(range: Range) {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
  const now = new Date()
  const actual: [string, number][] = []
  const forecast: [string, number][] = []
  const withoutPhoenix: [string, number][] = []

  let cum = 0
  let cumFull = 0
  for (let i = -days; i <= days; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().slice(0, 10)
    const dow = d.getDay()
    const isWeekend = dow === 0 || dow === 6
    const dailyCost = isWeekend ? 2.5 : 8 + Math.random() * 3
    const fullCost = isWeekend ? 24 : 24
    cumFull += fullCost * 0.48

    if (i <= 0) {
      cum += dailyCost
      actual.push([dateStr, Math.round(cum * 100) / 100])
    } else {
      cum += dailyCost * (0.9 + Math.random() * 0.2)
      forecast.push([dateStr, Math.round(cum * 100) / 100])
    }
    withoutPhoenix.push([dateStr, Math.round(cumFull * 100) / 100])
  }
  return { actual, forecast, withoutPhoenix }
}

export default function CostForecastAreaPrototype() {
  const router = useRouter()
  const chartRef = useRef<HTMLDivElement>(null)
  const [range, setRange] = useState<Range>('30d')
  const [key, setKey] = useState(0)

  useEffect(() => {
    if (!chartRef.current) return
    const chart = echarts.init(chartRef.current, 'kube-phoenix-dark', { renderer: 'canvas' })
    const { actual, forecast, withoutPhoenix } = generateForecastData(range)

    chart.setOption({
      animation: true,
      animationDuration: 1000,
      animationEasing: 'cubicOut',
      tooltip: {
        trigger: 'axis',
        formatter: (params: { seriesName: string; value: [string, number] }[]) => {
          const date = params[0]?.value[0]
          return `<b>${date}</b><br/>` + params.map(p => `${p.seriesName}: $${p.value[1].toFixed(2)}`).join('<br/>')
        },
      },
      legend: {
        data: ['Actual Cost', 'Forecast', 'Without kube-phoenix'],
        bottom: 10,
        textStyle: { color: '#94A3B8', fontSize: 11 },
      },
      grid: { left: 60, right: 20, top: 20, bottom: 50 },
      xAxis: { type: 'category', boundaryGap: false },
      yAxis: {
        type: 'value',
        axisLabel: { formatter: (v: number) => `$${v}` },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      },
      series: [
        {
          name: 'Without kube-phoenix',
          type: 'line',
          data: withoutPhoenix,
          symbol: 'none',
          lineStyle: { color: '#EF4444', width: 1, type: 'dashed' },
          areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(239,68,68,0.08)' }, { offset: 1, color: 'rgba(239,68,68,0.01)' }]) },
        },
        {
          name: 'Actual Cost',
          type: 'line',
          data: actual,
          symbol: 'none',
          lineStyle: { color: '#22C55E', width: 2 },
          areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(34,197,94,0.15)' }, { offset: 1, color: 'rgba(34,197,94,0.02)' }]) },
        },
        {
          name: 'Forecast',
          type: 'line',
          data: forecast,
          symbol: 'none',
          lineStyle: { color: '#7C3AED', width: 2, type: 'dashed' },
          areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(124,58,237,0.1)' }, { offset: 1, color: 'rgba(124,58,237,0.02)' }]) },
        },
      ],
    })

    const ob = new ResizeObserver(() => chart.resize())
    ob.observe(chartRef.current)
    return () => { ob.disconnect(); chart.dispose() }
  }, [range, key])

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small"><ArrowBackIcon fontSize="small" /></IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>I6 — Cost Forecast</Typography>
          <Typography variant="body2" color="text.secondary">Cumulative cost area chart — actual vs forecast vs what it would cost without kube-phoenix</Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', alignItems: 'center' }}>
        <ToggleButtonGroup value={range} exclusive onChange={(_, v) => v && setRange(v)} size="small">
          <ToggleButton value="7d" sx={{ fontSize: 11, px: 2 }}>7 days</ToggleButton>
          <ToggleButton value="30d" sx={{ fontSize: 11, px: 2 }}>30 days</ToggleButton>
          <ToggleButton value="90d" sx={{ fontSize: 11, px: 2 }}>90 days</ToggleButton>
        </ToggleButtonGroup>
        <Button variant="outlined" size="small" startIcon={<ReplayIcon fontSize="small" />} onClick={() => setKey(k => k + 1)}>Replay</Button>
      </Box>

      <Box ref={chartRef} sx={{ width: '100%', height: 400, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }} />
    </Box>
  )
}
