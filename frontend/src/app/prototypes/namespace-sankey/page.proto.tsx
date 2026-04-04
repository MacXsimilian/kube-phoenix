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

export default function NamespaceSankeyPrototype() {
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
      tooltip: { trigger: 'item', triggerOn: 'mousemove' },
      series: [{
        type: 'sankey',
        layout: 'none',
        emphasis: { focus: 'adjacency' },
        nodeAlign: 'left',
        nodeGap: 12,
        nodeWidth: 20,
        layoutIterations: 0,
        label: { color: '#E2E8F0', fontSize: 11, fontFamily: '"Inter", sans-serif' },
        lineStyle: { color: 'gradient', curveness: 0.5, opacity: 0.3 },
        itemStyle: { borderWidth: 0 },
        data: [
          { name: 'Policies', itemStyle: { color: '#7C3AED' } },
          { name: 'EU Dev Sleep', itemStyle: { color: '#7C3AED' } },
          { name: 'US Staging', itemStyle: { color: '#7C3AED' } },
          { name: 'Cost Opt', itemStyle: { color: '#7C3AED' } },
          { name: 'dev', itemStyle: { color: '#22C55E' } },
          { name: 'dev-tools', itemStyle: { color: '#22C55E' } },
          { name: 'staging', itemStyle: { color: '#F59E0B' } },
          { name: 'staging-perf', itemStyle: { color: '#F59E0B' } },
          { name: 'monitoring', itemStyle: { color: '#22D3EE' } },
          { name: 'api-server', itemStyle: { color: '#22C55E' } },
          { name: 'web-frontend', itemStyle: { color: '#22C55E' } },
          { name: 'worker', itemStyle: { color: '#22C55E' } },
          { name: 'redis', itemStyle: { color: '#22C55E' } },
          { name: 'checkout-svc', itemStyle: { color: '#F59E0B' } },
          { name: 'product-api', itemStyle: { color: '#F59E0B' } },
          { name: 'cart-svc', itemStyle: { color: '#F59E0B' } },
          { name: 'prometheus', itemStyle: { color: '#22D3EE' } },
          { name: 'grafana', itemStyle: { color: '#22D3EE' } },
          { name: 'debug-tools', itemStyle: { color: '#22C55E' } },
          { name: 'load-gen', itemStyle: { color: '#F59E0B' } },
        ],
        links: [
          { source: 'Policies', target: 'EU Dev Sleep', value: 6 },
          { source: 'Policies', target: 'US Staging', value: 5 },
          { source: 'Policies', target: 'Cost Opt', value: 2 },
          { source: 'EU Dev Sleep', target: 'dev', value: 4 },
          { source: 'EU Dev Sleep', target: 'dev-tools', value: 2 },
          { source: 'US Staging', target: 'staging', value: 3 },
          { source: 'US Staging', target: 'staging-perf', value: 2 },
          { source: 'Cost Opt', target: 'monitoring', value: 2 },
          { source: 'dev', target: 'api-server', value: 3 },
          { source: 'dev', target: 'web-frontend', value: 2 },
          { source: 'dev', target: 'worker', value: 2 },
          { source: 'dev', target: 'redis', value: 1 },
          { source: 'dev-tools', target: 'debug-tools', value: 1 },
          { source: 'staging', target: 'checkout-svc', value: 2 },
          { source: 'staging', target: 'product-api', value: 3 },
          { source: 'staging', target: 'cart-svc', value: 2 },
          { source: 'staging-perf', target: 'load-gen', value: 2 },
          { source: 'monitoring', target: 'prometheus', value: 1 },
          { source: 'monitoring', target: 'grafana', value: 1 },
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
          <Typography variant="h5" fontWeight={800}>H2 — Namespace Sankey</Typography>
          <Typography variant="body2" color="text.secondary">
            Flow diagram: Policies → Namespaces → Workloads — showing which policy controls what
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', alignItems: 'center' }}>
        <Button variant="contained" size="small" startIcon={<ReplayIcon fontSize="small" />} onClick={() => setKey(k => k + 1)}>Replay</Button>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>Hover to highlight flow path · Width = replica count</Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 4, mb: 2, justifyContent: 'center' }}>
        {[{ l: 'Policies', c: '#7C3AED' }, { l: 'Namespaces', c: '#22C55E' }, { l: 'Workloads', c: '#E2E8F0' }].map(x => (
          <Typography key={x.l} variant="caption" sx={{ color: x.c, fontWeight: 600, fontSize: 11 }}>{x.l}</Typography>
        ))}
      </Box>

      <Box ref={chartRef} sx={{ width: '100%', height: 450, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }} />
    </Box>
  )
}
