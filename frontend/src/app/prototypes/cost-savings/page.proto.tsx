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

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const SAVINGS = [42, 38, 45, 41, 44, 58, 56]
const TOTAL = SAVINGS.reduce((a, b) => a + b, 0)
const RATE_PER_HOUR = 0.12

function SavingsBarChart({ chartKey }: { chartKey: number }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const chart = echarts.init(ref.current, 'kube-phoenix-dark', { renderer: 'canvas' })

    chart.setOption({
      animation: true,
      animationDuration: 800,
      animationEasing: 'cubicOut',
      animationDelay: (idx: number) => idx * 100,
      grid: { left: 50, right: 16, top: 16, bottom: 32 },
      tooltip: {
        trigger: 'axis',
        formatter: (params: { name: string; value: number }[]) => {
          const d = params[0]
          return `<b>${d.name}</b><br/>${d.value}h sleeping<br/>~$${(d.value * 4 * RATE_PER_HOUR).toFixed(2)} saved`
        },
      },
      xAxis: { type: 'category', data: DAYS },
      yAxis: { type: 'value', name: 'Hours', axisLabel: { formatter: '{value}h' } },
      series: [{
        type: 'bar',
        data: SAVINGS.map((v, i) => ({
          value: v,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#7C3AED' },
              { offset: 1, color: '#7C3AED30' },
            ]),
            borderRadius: [4, 4, 0, 0],
          },
        })),
        barWidth: '50%',
        animationDuration: 800,
        animationDelay: (idx: number) => idx * 100,
      }],
    })

    const ob = new ResizeObserver(() => chart.resize())
    ob.observe(ref.current)
    return () => { ob.disconnect(); chart.dispose() }
  }, [chartKey])

  return <Box ref={ref} sx={{ width: '100%', height: 260 }} />
}

function SavingsGauge({ chartKey }: { chartKey: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const pct = Math.round((TOTAL / (7 * 24)) * 100)

  useEffect(() => {
    if (!ref.current) return
    const chart = echarts.init(ref.current, 'kube-phoenix-dark', { renderer: 'canvas' })

    chart.setOption({
      series: [{
        type: 'gauge',
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        radius: '90%',
        animationDuration: 1200,
        animationEasing: 'elasticOut',
        progress: { show: true, width: 14, itemStyle: { color: '#7C3AED' } },
        axisLine: { lineStyle: { width: 14, color: [[1, 'rgba(255,255,255,0.06)']] } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        pointer: { show: false },
        anchor: { show: false },
        title: { show: false },
        detail: {
          fontSize: 24,
          fontWeight: 700,
          fontFamily: '"Inter", monospace',
          color: '#E2E8F0',
          offsetCenter: [0, '10%'],
          formatter: `$${(TOTAL * 4 * RATE_PER_HOUR).toFixed(0)}`,
        },
        data: [{ value: pct }],
      }],
    })

    const ob = new ResizeObserver(() => chart.resize())
    ob.observe(ref.current)
    return () => { ob.disconnect(); chart.dispose() }
  }, [chartKey, pct])

  return <Box ref={ref} sx={{ width: '100%', height: 200 }} />
}

export default function CostSavingsPrototype() {
  const router = useRouter()
  const [key, setKey] = useState(0)

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>F4 — Cost Savings</Typography>
          <Typography variant="body2" color="text.secondary">
            Weekly savings bar chart + radial gauge with eCharts
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider' }}>
        <Button variant="contained" size="small" startIcon={<ReplayIcon fontSize="small" />} onClick={() => setKey(k => k + 1)}>
          Replay
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto', alignSelf: 'center' }}>
          {TOTAL}h sleeping this week · ~${(TOTAL * 4 * RATE_PER_HOUR).toFixed(0)} saved · ${RATE_PER_HOUR}/node-hr
        </Typography>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 2 }}>
        <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>WEEKLY SLEEP HOURS</Typography>
          <SavingsBarChart chartKey={key} />
        </Box>
        <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>SAVINGS THIS WEEK</Typography>
          <SavingsGauge chartKey={key} />
          <Typography variant="caption" color="text.secondary">
            {Math.round((TOTAL / (7 * 24)) * 100)}% utilization of sleep windows
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
