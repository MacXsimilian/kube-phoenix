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

function generateTreemapData() {
  return [
    {
      name: 'dev',
      itemStyle: { borderColor: '#22C55E40' },
      children: [
        { name: 'api-server', value: 3, itemStyle: { color: '#22C55E' }, info: { kind: 'Deployment', replicas: '3/3', cpu: '480m', status: 'running' } },
        { name: 'web-frontend', value: 2, itemStyle: { color: '#22C55E' }, info: { kind: 'Deployment', replicas: '2/2', cpu: '115m', status: 'running' } },
        { name: 'worker', value: 2, itemStyle: { color: '#22C55E' }, info: { kind: 'Deployment', replicas: '2/2', cpu: '210m', status: 'running' } },
        { name: 'redis', value: 1, itemStyle: { color: '#22C55E' }, info: { kind: 'StatefulSet', replicas: '1/1', cpu: '50m', status: 'running' } },
        { name: 'event-processor', value: 3, itemStyle: { color: '#3B82F6' }, info: { kind: 'Deployment', replicas: '1/3', cpu: '90m', status: 'partial' } },
      ],
    },
    {
      name: 'staging',
      itemStyle: { borderColor: '#7C3AED40' },
      children: [
        { name: 'checkout-svc', value: 2, itemStyle: { color: '#7C3AED60' }, info: { kind: 'Deployment', replicas: '0/2', cpu: '0m', status: 'sleeping' } },
        { name: 'product-api', value: 3, itemStyle: { color: '#7C3AED60' }, info: { kind: 'Deployment', replicas: '0/3', cpu: '0m', status: 'sleeping' } },
        { name: 'cart-svc', value: 2, itemStyle: { color: '#7C3AED60' }, info: { kind: 'Deployment', replicas: '0/2', cpu: '0m', status: 'sleeping' } },
        { name: 'postgres', value: 1, itemStyle: { color: '#7C3AED60' }, info: { kind: 'StatefulSet', replicas: '0/1', cpu: '0m', status: 'sleeping' } },
      ],
    },
    {
      name: 'monitoring',
      itemStyle: { borderColor: '#22D3EE40' },
      children: [
        { name: 'prometheus', value: 2, itemStyle: { color: '#22D3EE' }, info: { kind: 'StatefulSet', replicas: '1/1', cpu: '350m', status: 'running' } },
        { name: 'grafana', value: 1, itemStyle: { color: '#22D3EE' }, info: { kind: 'Deployment', replicas: '1/1', cpu: '80m', status: 'running' } },
        { name: 'alertmanager', value: 1, itemStyle: { color: '#22D3EE' }, info: { kind: 'Deployment', replicas: '1/1', cpu: '20m', status: 'running' } },
        { name: 'loki', value: 1, itemStyle: { color: '#22D3EE' }, info: { kind: 'StatefulSet', replicas: '1/1', cpu: '200m', status: 'running' } },
      ],
    },
    {
      name: 'kube-system',
      itemStyle: { borderColor: '#F59E0B40' },
      children: [
        { name: 'coredns', value: 2, itemStyle: { color: '#F59E0B' }, info: { kind: 'Deployment', replicas: '2/2', cpu: '27m', status: 'running' } },
        { name: 'kube-proxy', value: 3, itemStyle: { color: '#F59E0B' }, info: { kind: 'Deployment', replicas: '3/3', cpu: '27m', status: 'running' } },
      ],
    },
  ]
}

export default function TopologyTreemapPrototype() {
  const router = useRouter()
  const chartRef = useRef<HTMLDivElement>(null)
  const [key, setKey] = useState(0)

  useEffect(() => {
    if (!chartRef.current) return
    const chart = echarts.init(chartRef.current, 'kube-phoenix-dark', { renderer: 'canvas' })

    chart.setOption({
      animation: true,
      animationDuration: 800,
      animationEasing: 'cubicOut',
      tooltip: {
        formatter: (p: { data: { name: string; info?: { kind: string; replicas: string; cpu: string; status: string } }; treePathInfo: { name: string }[] }) => {
          const { data, treePathInfo } = p
          const path = treePathInfo.map(n => n.name).join(' / ')
          if (!data.info) return `<b>${path}</b>`
          return `<b>${path}</b><br/>Kind: ${data.info.kind}<br/>Replicas: ${data.info.replicas}<br/>CPU: ${data.info.cpu}<br/>Status: ${data.info.status}`
        },
      },
      series: [{
        type: 'treemap',
        data: generateTreemapData(),
        width: '100%',
        height: '100%',
        roam: false,
        nodeClick: 'zoomToNode',
        breadcrumb: {
          show: true,
          bottom: 10,
          itemStyle: { color: '#1A1A24', borderColor: 'rgba(255,255,255,0.1)' },
          textStyle: { color: '#94A3B8', fontSize: 12 },
        },
        levels: [
          {
            itemStyle: {
              borderColor: 'rgba(255,255,255,0.1)',
              borderWidth: 2,
              gapWidth: 3,
            },
            upperLabel: {
              show: true,
              height: 28,
              color: '#E2E8F0',
              fontWeight: 'bold',
              fontSize: 13,
              backgroundColor: 'rgba(15,15,19,0.8)',
              padding: [4, 8],
              borderRadius: 4,
            },
          },
          {
            itemStyle: {
              borderColor: 'rgba(255,255,255,0.05)',
              borderWidth: 1,
              gapWidth: 1,
            },
            label: {
              show: true,
              fontSize: 11,
              color: '#E2E8F0',
              fontFamily: 'monospace',
              formatter: (p: { data: { name: string; info?: { replicas: string } } }) =>
                p.data.info ? `${p.data.name}\n${p.data.info.replicas}` : p.data.name,
            },
          },
        ],
        animationDuration: 800,
        animationEasing: 'cubicOut',
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
          <Typography variant="h5" fontWeight={800}>G3-v3 — Topology Treemap</Typography>
          <Typography variant="body2" color="text.secondary">
            Hierarchical treemap: cluster → namespace → workload — size = replicas, color = status. Click to drill down.
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', alignItems: 'center' }}>
        <Button variant="contained" size="small" startIcon={<ReplayIcon fontSize="small" />} onClick={() => setKey(k => k + 1)}>
          Replay
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          Click a namespace to zoom in · Breadcrumb to zoom out
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        {[
          { label: 'Running', color: '#22C55E' },
          { label: 'Sleeping', color: '#7C3AED' },
          { label: 'Partial', color: '#3B82F6' },
          { label: 'System', color: '#F59E0B' },
          { label: 'Monitoring', color: '#22D3EE' },
        ].map(l => (
          <Box key={l.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: 1, bgcolor: l.color }} />
            <Typography variant="caption" color="text.secondary">{l.label}</Typography>
          </Box>
        ))}
      </Box>

      <Box
        ref={chartRef}
        sx={{ width: '100%', height: 480, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}
      />
    </Box>
  )
}
