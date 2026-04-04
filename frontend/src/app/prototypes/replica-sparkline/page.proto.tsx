'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
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

function generateSparklineData(sleepHour: number, wakeHour: number, replicas: number) {
  const data: [number, number][] = []
  for (let h = 0; h <= 24; h += 0.25) {
    const isAsleep = sleepHour < wakeHour
      ? h >= sleepHour && h < wakeHour
      : h >= sleepHour || h < wakeHour
    data.push([h, isAsleep ? 0 : replicas])
  }
  return data
}

const POLICIES = [
  { name: 'EU Dev Sleep', replicas: 3, sleepHour: 20, wakeHour: 7, color: '#7C3AED' },
  { name: 'US Staging Nightly', replicas: 4, sleepHour: 22, wakeHour: 6, color: '#3B82F6' },
  { name: 'Cost Optimization', replicas: 2, sleepHour: 19, wakeHour: 8, color: '#F59E0B' },
]

function SparklineChart({ policy, height }: { policy: typeof POLICIES[0]; height: number }) {
  const chartRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<echarts.ECharts | null>(null)
  const [key, setKey] = useState(0)

  useEffect(() => {
    if (!chartRef.current) return
    instanceRef.current?.dispose()

    const chart = echarts.init(chartRef.current, 'kube-phoenix-dark', { renderer: 'canvas' })
    instanceRef.current = chart

    const data = generateSparklineData(policy.sleepHour, policy.wakeHour, policy.replicas)

    chart.setOption({
      animation: true,
      animationDuration: 800,
      animationEasing: 'cubicOut',
      grid: { left: 0, right: 0, top: 4, bottom: 0, containLabel: false },
      xAxis: {
        type: 'value',
        min: 0,
        max: 24,
        show: false,
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: policy.replicas + 1,
        show: false,
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params: { data: [number, number] }[]) => {
          const [hour, count] = params[0]?.data ?? [0, 0]
          const h = Math.floor(hour)
          const m = Math.round((hour - h) * 60)
          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} — ${count} replicas`
        },
      },
      series: [
        {
          type: 'line',
          step: 'end',
          data,
          symbol: 'none',
          lineStyle: { color: policy.color, width: 2 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: `${policy.color}30` },
              { offset: 1, color: `${policy.color}05` },
            ]),
          },
          markLine: {
            silent: true,
            symbol: 'none',
            data: [
              {
                xAxis: new Date().getHours() + new Date().getMinutes() / 60,
                lineStyle: { color: '#f87171', width: 1, type: 'solid' },
                label: { show: false },
              },
            ],
          },
        },
      ],
    })

    const handleResize = () => chart.resize()
    const observer = new ResizeObserver(handleResize)
    observer.observe(chartRef.current)

    return () => {
      observer.disconnect()
      chart.dispose()
    }
  }, [policy, key])

  return (
    <Box sx={{ position: 'relative' }}>
      <Box ref={chartRef} sx={{ width: '100%', height }} />
      <IconButton
        size="small"
        onClick={() => setKey(k => k + 1)}
        sx={{ position: 'absolute', top: 4, right: 4, opacity: 0.5, '&:hover': { opacity: 1 } }}
      >
        <ReplayIcon sx={{ fontSize: 14 }} />
      </IconButton>
    </Box>
  )
}

export default function ReplicaSparklinePrototype() {
  const router = useRouter()
  const [key, setKey] = useState(0)

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>F1 — Replica Sparkline</Typography>
          <Typography variant="body2" color="text.secondary">
            eCharts step-line chart showing 24h sleep/wake pattern per policy
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider' }}>
        <Button variant="contained" size="small" startIcon={<ReplayIcon fontSize="small" />} onClick={() => setKey(k => k + 1)}>
          Replay All
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto', alignSelf: 'center' }}>
          eCharts · animationDuration: 800 · cubicOut
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {POLICIES.map(p => (
          <Box
            key={`${p.name}-${key}`}
            sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Box>
                <Typography variant="subtitle2" fontWeight={600}>{p.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Sleep {p.sleepHour}:00 → Wake {p.wakeHour}:00 · {p.replicas} replicas
                </Typography>
              </Box>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: p.color, boxShadow: `0 0 8px ${p.color}80` }} />
            </Box>
            <SparklineChart policy={p} height={80} />
          </Box>
        ))}
      </Box>

      {/* Inline card variant */}
      <Typography variant="caption" color="text.secondary" sx={{ mt: 4, mb: 1.5, display: 'block' }}>
        Inline variant (as it appears inside a PolicyCard 70/30 split):
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, p: 2, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ flex: 7 }}>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>EU Dev Sleep</Typography>
          <SparklineChart key={`inline-${key}`} policy={POLICIES[0]} height={56} />
        </Box>
        <Box sx={{ flex: 3, pl: 2, borderLeft: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0.5 }}>
          <Box><Typography sx={{ fontSize: 11, color: 'text.secondary' }}>State</Typography><Typography sx={{ fontSize: 13, color: '#22C55E', fontWeight: 600 }}>Awake</Typography></Box>
          <Box><Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Next</Typography><Typography sx={{ fontSize: 13 }}>Sleep in 4h</Typography></Box>
        </Box>
      </Box>
    </Box>
  )
}
