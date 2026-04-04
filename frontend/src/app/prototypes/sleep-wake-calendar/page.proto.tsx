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

function generateCalendarData() {
  const data: [string, number][] = []
  const start = new Date('2026-03-01')
  for (let i = 0; i < 34; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const dow = d.getDay()
    const isWeekend = dow === 0 || dow === 6
    const sleepHours = isWeekend ? 24 : 11 + Math.floor(Math.random() * 3)
    data.push([d.toISOString().slice(0, 10), sleepHours])
  }
  return data
}

export default function SleepWakeCalendarPrototype() {
  const router = useRouter()
  const chartRef = useRef<HTMLDivElement>(null)
  const [key, setKey] = useState(0)

  useEffect(() => {
    if (!chartRef.current) return
    const chart = echarts.init(chartRef.current, 'kube-phoenix-dark', { renderer: 'canvas' })
    const data = generateCalendarData()

    chart.setOption({
      animation: true,
      animationDuration: 600,
      animationDelay: (idx: number) => idx * 20,
      tooltip: {
        formatter: (p: { value: [string, number] }) => {
          const [date, hours] = p.value
          const awake = 24 - hours
          return `<b>${date}</b><br/>Sleep: ${hours}h<br/>Awake: ${awake}h<br/>Savings: ~$${(hours * 0.48).toFixed(2)}`
        },
      },
      visualMap: {
        min: 0,
        max: 24,
        orient: 'horizontal',
        left: 'center',
        bottom: 10,
        inRange: {
          color: ['#1A1A2440', '#22C55E30', '#7C3AED40', '#7C3AED80', '#7C3AEDCC'],
        },
        textStyle: { color: '#64748B', fontSize: 10 },
        formatter: (val: number) => `${val}h`,
      },
      calendar: {
        top: 60,
        left: 40,
        right: 40,
        cellSize: ['auto', 40],
        range: '2026-03',
        itemStyle: {
          borderWidth: 2,
          borderColor: '#0F0F13',
          borderRadius: 4,
        },
        yearLabel: { show: false },
        monthLabel: {
          color: '#E2E8F0',
          fontSize: 14,
          fontWeight: 'bold',
          fontFamily: '"Inter", sans-serif',
        },
        dayLabel: {
          color: '#64748B',
          fontSize: 11,
          fontFamily: '"Inter", sans-serif',
          firstDay: 1,
          nameMap: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        },
        splitLine: { show: false },
      },
      series: [{
        type: 'heatmap',
        coordinateSystem: 'calendar',
        data,
        label: {
          show: true,
          formatter: (p: { value: [string, number] }) => `${p.value[1]}h`,
          fontSize: 10,
          fontFamily: 'monospace',
          color: '#E2E8F0',
        },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(124,58,237,0.5)' },
        },
        animationDuration: 600,
        animationDelay: (idx: number) => idx * 20,
      }],
    })

    const ob = new ResizeObserver(() => chart.resize())
    ob.observe(chartRef.current)
    return () => { ob.disconnect(); chart.dispose() }
  }, [key])

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>H3 — Sleep/Wake Calendar</Typography>
          <Typography variant="body2" color="text.secondary">
            GitHub-style calendar heatmap showing daily sleep hours — darker = more sleep = more savings
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider' }}>
        <Button variant="contained" size="small" startIcon={<ReplayIcon fontSize="small" />} onClick={() => setKey(k => k + 1)}>Replay</Button>
      </Box>

      <Box ref={chartRef} sx={{ width: '100%', height: 340, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }} />
    </Box>
  )
}
