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

function generateSunburstData() {
  return [
    {
      name: 'node-1',
      itemStyle: { color: '#22D3EE' },
      children: [
        { name: 'dev', itemStyle: { color: '#22C55E' }, children: [
          { name: 'api-server', value: 750, itemStyle: { color: '#22C55E' } },
          { name: 'web-frontend', value: 300, itemStyle: { color: '#22C55E' } },
          { name: 'redis', value: 200, itemStyle: { color: '#22C55E' } },
          { name: 'worker', value: 400, itemStyle: { color: '#22C55E' } },
        ]},
        { name: 'monitoring', itemStyle: { color: '#22D3EE' }, children: [
          { name: 'alertmanager', value: 100, itemStyle: { color: '#22D3EE' } },
          { name: 'loki', value: 300, itemStyle: { color: '#22D3EE' } },
        ]},
        { name: 'kube-system', itemStyle: { color: '#F59E0B' }, children: [
          { name: 'coredns', value: 100, itemStyle: { color: '#F59E0B' } },
          { name: 'kube-proxy', value: 100, itemStyle: { color: '#F59E0B' } },
        ]},
      ],
    },
    {
      name: 'node-2',
      itemStyle: { color: '#3B82F6' },
      children: [
        { name: 'dev', itemStyle: { color: '#22C55E' }, children: [
          { name: 'api-server', value: 250, itemStyle: { color: '#22C55E' } },
          { name: 'web-frontend', value: 256, itemStyle: { color: '#22C55E' } },
          { name: 'worker', value: 200, itemStyle: { color: '#22C55E' } },
        ]},
        { name: 'monitoring', itemStyle: { color: '#22D3EE' }, children: [
          { name: 'prometheus', value: 500, itemStyle: { color: '#EF4444' } },
          { name: 'grafana', value: 200, itemStyle: { color: '#22D3EE' } },
        ]},
        { name: 'staging', itemStyle: { color: '#7C3AED' }, children: [
          { name: 'checkout-svc', value: 0, itemStyle: { color: '#7C3AED40' } },
          { name: 'product-api', value: 0, itemStyle: { color: '#7C3AED40' } },
        ]},
      ],
    },
    {
      name: 'node-3',
      itemStyle: { color: '#6366F1' },
      children: [
        { name: 'kube-system', itemStyle: { color: '#F59E0B' }, children: [
          { name: 'coredns', value: 100, itemStyle: { color: '#F59E0B' } },
          { name: 'kube-proxy', value: 100, itemStyle: { color: '#F59E0B' } },
        ]},
        { name: 'staging', itemStyle: { color: '#7C3AED' }, children: [
          { name: 'cart-svc', value: 0, itemStyle: { color: '#7C3AED40' } },
          { name: 'postgres', value: 0, itemStyle: { color: '#7C3AED40' } },
        ]},
      ],
    },
  ]
}

export default function ResourceSunburstPrototype() {
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
      tooltip: {
        formatter: (p: { name: string; value?: number; treePathInfo: { name: string }[] }) => {
          const path = p.treePathInfo.map(n => n.name).filter(Boolean).join(' → ')
          return `<b>${path}</b>${p.value ? `<br/>CPU: ${p.value}m` : ''}`
        },
      },
      series: [{
        type: 'sunburst',
        data: generateSunburstData(),
        radius: ['15%', '90%'],
        sort: undefined,
        emphasis: { focus: 'ancestor' },
        label: {
          rotate: 'radial',
          fontSize: 10,
          color: '#E2E8F0',
          fontFamily: '"Inter", sans-serif',
          minAngle: 15,
        },
        itemStyle: {
          borderColor: '#0F0F13',
          borderWidth: 2,
          borderRadius: 4,
        },
        levels: [
          {},
          { r0: '15%', r: '40%', label: { fontSize: 12, fontWeight: 'bold' }, itemStyle: { borderWidth: 3 } },
          { r0: '40%', r: '65%', label: { fontSize: 10 } },
          { r0: '65%', r: '90%', label: { fontSize: 9 }, itemStyle: { borderWidth: 1 } },
        ],
        animationDuration: 1000,
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
          <Typography variant="h5" fontWeight={800}>H4 — Resource Sunburst</Typography>
          <Typography variant="body2" color="text.secondary">
            Sunburst: Node → Namespace → Workload. Arc size = CPU millicore. Click to zoom ring.
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', alignItems: 'center' }}>
        <Button variant="contained" size="small" startIcon={<ReplayIcon fontSize="small" />} onClick={() => setKey(k => k + 1)}>Replay</Button>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          Inner ring = Nodes · Middle = Namespaces · Outer = Workloads · Faded = Sleeping (0 CPU)
        </Typography>
      </Box>

      <Box ref={chartRef} sx={{ width: '100%', height: 520, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }} />
    </Box>
  )
}
