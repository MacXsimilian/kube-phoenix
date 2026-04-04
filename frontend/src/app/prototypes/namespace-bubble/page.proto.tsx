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

const NAMESPACES = [
  { name: 'dev', workloads: 4, replicas: 8, cpu: 1650, status: 'running', color: '#22C55E' },
  { name: 'staging', workloads: 4, replicas: 0, cpu: 0, status: 'sleeping', color: '#7C3AED' },
  { name: 'monitoring', workloads: 4, replicas: 4, cpu: 650, status: 'running', color: '#22D3EE' },
  { name: 'kube-system', workloads: 2, replicas: 5, cpu: 180, status: 'system', color: '#F59E0B' },
  { name: 'dev-tools', workloads: 1, replicas: 1, cpu: 50, status: 'running', color: '#22C55E' },
  { name: 'staging-perf', workloads: 2, replicas: 0, cpu: 0, status: 'sleeping', color: '#7C3AED' },
  { name: 'team-backend', workloads: 6, replicas: 15, cpu: 2400, status: 'running', color: '#22C55E' },
  { name: 'team-web', workloads: 4, replicas: 10, cpu: 800, status: 'running', color: '#22C55E' },
]

export default function NamespaceBubblePrototype() {
  const router = useRouter()
  const chartRef = useRef<HTMLDivElement>(null)
  const [key, setKey] = useState(0)

  useEffect(() => {
    if (!chartRef.current) return
    const chart = echarts.init(chartRef.current, 'kube-phoenix-dark', { renderer: 'canvas' })

    chart.setOption({
      animation: true,
      animationDuration: 1000,
      animationEasing: 'elasticOut',
      tooltip: {
        formatter: (p: { data: [number, number, number, string, string] }) => {
          const [wl, rep, cpu, name, status] = p.data
          return `<b>${name}</b><br/>Status: ${status}<br/>Workloads: ${wl}<br/>Replicas: ${rep}<br/>CPU: ${cpu}m`
        },
      },
      grid: { left: 60, right: 40, top: 40, bottom: 50 },
      xAxis: {
        name: 'Workloads',
        nameTextStyle: { color: '#64748B', fontSize: 11 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      },
      yAxis: {
        name: 'Replicas',
        nameTextStyle: { color: '#64748B', fontSize: 11 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      },
      series: [{
        type: 'scatter',
        symbolSize: (val: [number, number, number]) => Math.max(12, Math.sqrt(val[2]) * 2),
        data: NAMESPACES.map(ns => ({
          value: [ns.workloads, ns.replicas, ns.cpu, ns.name, ns.status],
          itemStyle: {
            color: ns.color,
            opacity: ns.status === 'sleeping' ? 0.4 : 0.85,
            shadowBlur: ns.cpu > 1000 ? 10 : 0,
            shadowColor: `${ns.color}40`,
          },
        })),
        label: {
          show: true,
          formatter: (p: { data: { value: [number, number, number, string] } }) => p.data.value[3],
          position: 'top',
          fontSize: 10,
          color: '#94A3B8',
          fontFamily: 'monospace',
        },
        emphasis: {
          itemStyle: { shadowBlur: 15, shadowColor: 'rgba(124,58,237,0.5)' },
          label: { fontSize: 12, fontWeight: 'bold' },
        },
        animationDuration: 1000,
        animationDelay: (idx: number) => idx * 100,
        animationEasing: 'elasticOut',
      }],
    })

    const ob = new ResizeObserver(() => chart.resize())
    ob.observe(chartRef.current)
    return () => { ob.disconnect(); chart.dispose() }
  }, [key])

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small"><ArrowBackIcon fontSize="small" /></IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>I5 — Namespace Bubble</Typography>
          <Typography variant="body2" color="text.secondary">Bubble chart — X = workload count, Y = replica count, size = CPU. Sleeping namespaces are faded.</Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', alignItems: 'center' }}>
        <Button variant="contained" size="small" startIcon={<ReplayIcon fontSize="small" />} onClick={() => setKey(k => k + 1)}>Replay</Button>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>Bubble size = CPU millicores · Faded = sleeping (0 CPU)</Typography>
      </Box>

      <Box ref={chartRef} sx={{ width: '100%', height: 450, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }} />
    </Box>
  )
}
