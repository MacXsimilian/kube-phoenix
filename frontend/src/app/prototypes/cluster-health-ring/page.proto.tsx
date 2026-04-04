'use client'

import { useState, useEffect, useRef } from 'react'
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

function rw(prev: number, min: number, max: number, vol: number) {
  return Math.max(min, Math.min(max, prev + (Math.random() - 0.48) * vol))
}

interface Ring {
  label: string
  value: number
  max: number
  color: string
  vol: number
}

const INITIAL_RINGS: Ring[] = [
  { label: 'Cluster CPU', value: 62, max: 100, color: '#22D3EE', vol: 5 },
  { label: 'Cluster Memory', value: 71, max: 100, color: '#7C3AED', vol: 4 },
  { label: 'Pod Health', value: 94, max: 100, color: '#22C55E', vol: 3 },
  { label: 'Policy Coverage', value: 85, max: 100, color: '#F59E0B', vol: 2 },
]

export default function ClusterHealthRingPrototype() {
  const router = useRouter()
  const chartRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<echarts.ECharts | null>(null)
  const [streaming, setStreaming] = useState(false)
  const ringsRef = useRef<Ring[]>(INITIAL_RINGS.map(r => ({ ...r })))
  const [, forceUpdate] = useState(0)

  function renderChart() {
    const chart = instanceRef.current
    if (!chart) return
    const rings = ringsRef.current

    const series = rings.map((ring, i) => {
      const radius = 90 - i * 18
      const pct = Math.round((ring.value / ring.max) * 100)
      const warnColor = pct > 85 ? '#EF4444' : pct > 70 ? '#F59E0B' : ring.color
      return [
        {
          type: 'gauge' as const,
          center: ['50%', '50%'],
          radius: `${radius}%`,
          startAngle: 90,
          endAngle: -270,
          min: 0,
          max: ring.max,
          pointer: { show: false },
          progress: {
            show: true,
            width: 14,
            roundCap: true,
            itemStyle: { color: ring.label === 'Pod Health' && pct < 90 ? '#EF4444' : warnColor },
          },
          axisLine: { lineStyle: { width: 14, color: [[1, 'rgba(255,255,255,0.04)']] } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          anchor: { show: false },
          title: { show: false },
          detail: {
            show: i === 0,
            fontSize: 0,
            formatter: '',
          },
          data: [{ value: ring.value }],
          animationDuration: 800,
          animationDurationUpdate: 400,
          animationEasingUpdate: 'cubicInOut',
        },
      ]
    }).flat()

    chart.setOption({ series }, { replaceMerge: ['series'] })
  }

  useEffect(() => {
    if (!chartRef.current) return
    instanceRef.current?.dispose()
    const chart = echarts.init(chartRef.current, 'kube-phoenix-dark', { renderer: 'canvas' })
    instanceRef.current = chart
    ringsRef.current = INITIAL_RINGS.map(r => ({ ...r }))
    renderChart()
    forceUpdate(n => n + 1)
    const ob = new ResizeObserver(() => chart.resize())
    ob.observe(chartRef.current)
    return () => { ob.disconnect(); chart.dispose() }
  }, [])

  useEffect(() => {
    if (!streaming) return
    const interval = setInterval(() => {
      ringsRef.current = ringsRef.current.map(r => ({
        ...r,
        value: rw(r.value, 30, r.max, r.vol),
      }))
      renderChart()
      forceUpdate(n => n + 1)
    }, 1500)
    return () => clearInterval(interval)
  }, [streaming])

  const rings = ringsRef.current

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>H6 — Cluster Health Ring</Typography>
          <Typography variant="body2" color="text.secondary">
            Concentric gauge rings — CPU, Memory, Pod Health, Policy Coverage — live updating
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', alignItems: 'center' }}>
        <Button variant="contained" size="small" startIcon={streaming ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />} onClick={() => setStreaming(s => !s)} color={streaming ? 'warning' : 'primary'}>
          {streaming ? 'Pause' : 'Simulate'}
        </Button>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        <Box ref={chartRef} sx={{ width: '100%', height: 360, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }} />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, justifyContent: 'center' }}>
          {rings.map((ring, i) => {
            const pct = Math.round((ring.value / ring.max) * 100)
            const isWarn = pct > 70
            const isCrit = pct > 85
            return (
              <Box key={ring.label} sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: isCrit ? 'rgba(239,68,68,0.3)' : 'divider', transition: 'border-color 300ms ease' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: ring.color }} />
                  <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 12, flex: 1 }}>{ring.label}</Typography>
                  <Typography sx={{
                    fontFamily: 'monospace', fontSize: 18, fontWeight: 700,
                    color: isCrit && ring.label !== 'Policy Coverage' ? '#EF4444' : isWarn && ring.label !== 'Policy Coverage' ? '#F59E0B' : ring.color,
                    transition: 'color 300ms ease',
                  }}>
                    {pct}%
                  </Typography>
                </Box>
                <Box sx={{ height: 4, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <Box sx={{
                    height: '100%', borderRadius: 1, width: `${pct}%`,
                    bgcolor: isCrit && ring.label !== 'Policy Coverage' ? '#EF4444' : ring.color,
                    transition: 'width 400ms ease, background-color 300ms ease',
                  }} />
                </Box>
              </Box>
            )
          })}
        </Box>
      </Box>
    </Box>
  )
}
