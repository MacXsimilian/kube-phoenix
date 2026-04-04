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

const NAMESPACES = ['dev', 'staging', 'monitoring', 'kube-system', 'team-backend', 'team-web']
const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)

function generateHeatmapData() {
  const data: [number, number, number][] = []
  for (let ns = 0; ns < NAMESPACES.length; ns++) {
    const isSleepable = ns < 3
    for (let h = 0; h < 24; h++) {
      let value: number
      if (isSleepable && (h >= 20 || h < 7)) {
        value = Math.floor(Math.random() * 2)
      } else if (ns === 3) {
        value = 3 + Math.floor(Math.random() * 2)
      } else {
        value = 2 + Math.floor(Math.random() * 6)
      }
      data.push([h, ns, value])
    }
  }
  return data
}

export default function WorkloadHeatmapPrototype() {
  const router = useRouter()
  const chartRef = useRef<HTMLDivElement>(null)
  const [key, setKey] = useState(0)

  useEffect(() => {
    if (!chartRef.current) return
    const chart = echarts.init(chartRef.current, 'kube-phoenix-dark', { renderer: 'canvas' })
    const data = generateHeatmapData()

    chart.setOption({
      animation: true,
      animationDuration: 500,
      animationDurationUpdate: 400,
      tooltip: {
        position: 'top',
        formatter: (p: { value: [number, number, number] }) => {
          const [h, ns, val] = p.value
          return `<b>${NAMESPACES[ns]}</b><br/>${HOURS[h]}<br/>${val} active replicas`
        },
      },
      grid: { left: 100, right: 20, top: 20, bottom: 50 },
      xAxis: {
        type: 'category',
        data: HOURS,
        splitArea: { show: true },
        axisLabel: { interval: 2, fontSize: 10 },
      },
      yAxis: {
        type: 'category',
        data: NAMESPACES,
        axisLabel: { fontSize: 11, fontFamily: 'monospace' },
      },
      visualMap: {
        min: 0,
        max: 8,
        calculable: false,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        inRange: {
          color: ['#1A1A24', '#7C3AED30', '#7C3AED60', '#7C3AED90', '#22C55E60', '#22C55E90', '#F59E0B90', '#EF444490'],
        },
        textStyle: { color: '#64748B', fontSize: 10 },
      },
      series: [{
        type: 'heatmap',
        data,
        label: { show: false },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' },
        },
        itemStyle: { borderRadius: 2, borderWidth: 1, borderColor: '#0F0F13' },
        animationDuration: 500,
        animationDelay: (idx: number) => idx * 5,
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
          <Typography variant="h5" fontWeight={800}>G2 — Workload Heatmap</Typography>
          <Typography variant="body2" color="text.secondary">
            Namespace x Hour heatmap showing active replica counts across the cluster
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider' }}>
        <Button variant="contained" size="small" startIcon={<ReplayIcon fontSize="small" />} onClick={() => setKey(k => k + 1)}>
          Regenerate
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto', alignSelf: 'center' }}>
          Dark cells = sleeping (0 replicas) · Bright cells = active
        </Typography>
      </Box>

      <Box
        ref={chartRef}
        sx={{ width: '100%', height: 350, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', p: 1 }}
      />
    </Box>
  )
}
