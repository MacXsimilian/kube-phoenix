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

interface TopoNode {
  name: string
  category: number
  symbolSize: number
  value: string
}

interface TopoLink {
  source: string
  target: string
}

const CATEGORIES = [
  { name: 'Cluster', itemStyle: { color: '#7C3AED' } },
  { name: 'Node', itemStyle: { color: '#22D3EE' } },
  { name: 'Running Pod', itemStyle: { color: '#22C55E' } },
  { name: 'Sleeping Pod', itemStyle: { color: '#F59E0B' } },
  { name: 'Failed Pod', itemStyle: { color: '#EF4444' } },
]

function generateTopology(): { nodes: TopoNode[]; links: TopoLink[] } {
  const nodes: TopoNode[] = [
    { name: 'dev-cluster', category: 0, symbolSize: 40, value: 'Cluster' },
  ]
  const links: TopoLink[] = []

  const nodesData = [
    { name: 'node-1', pods: ['api-server-x2k', 'api-server-m9p', 'web-fe-h8j', 'redis-0', 'worker-d2e', 'alertmanager-n5o', 'loki-0', 'coredns-a3b'] },
    { name: 'node-2', pods: ['api-server-q4r', 'web-fe-p3n', 'worker-g7h', 'prometheus-0', 'grafana-k4l', 'kube-proxy-g7h'] },
    { name: 'node-3', pods: ['coredns-x1y', 'kube-proxy-j9k'] },
  ]

  const sleepingPods = new Set(['checkout-svc-a1', 'product-api-b2', 'cart-svc-c3', 'postgres-0'])
  const failedPods = new Set(['api-server-crash1'])

  for (const nd of nodesData) {
    nodes.push({ name: nd.name, category: 1, symbolSize: 28, value: `${nd.pods.length} pods` })
    links.push({ source: 'dev-cluster', target: nd.name })
    for (const pod of nd.pods) {
      const cat = failedPods.has(pod) ? 4 : sleepingPods.has(pod) ? 3 : 2
      nodes.push({ name: pod, category: cat, symbolSize: 14, value: CATEGORIES[cat].name })
      links.push({ source: nd.name, target: pod })
    }
  }

  for (const pod of sleepingPods) {
    nodes.push({ name: pod, category: 3, symbolSize: 14, value: 'Sleeping' })
    links.push({ source: 'node-3', target: pod })
  }
  nodes.push({ name: 'api-server-crash1', category: 4, symbolSize: 14, value: 'CrashLoopBackOff' })
  links.push({ source: 'node-1', target: 'api-server-crash1' })

  return { nodes, links }
}

export default function ClusterTopologyPrototype() {
  const router = useRouter()
  const chartRef = useRef<HTMLDivElement>(null)
  const [key, setKey] = useState(0)

  useEffect(() => {
    if (!chartRef.current) return
    const chart = echarts.init(chartRef.current, 'kube-phoenix-dark', { renderer: 'canvas' })
    const { nodes, links } = generateTopology()

    chart.setOption({
      animation: true,
      animationDuration: 1200,
      animationEasing: 'cubicOut',
      tooltip: {
        trigger: 'item',
        formatter: (p: { data: { name: string; value?: string } }) =>
          `<b>${p.data.name}</b>${p.data.value ? `<br/>${p.data.value}` : ''}`,
      },
      legend: {
        data: CATEGORIES.map(c => c.name),
        bottom: 10,
        textStyle: { color: '#94A3B8', fontSize: 11 },
      },
      series: [{
        type: 'graph',
        layout: 'force',
        categories: CATEGORIES,
        nodes: nodes.map(n => ({
          ...n,
          label: {
            show: n.category <= 1,
            position: 'bottom',
            fontSize: n.category === 0 ? 13 : 11,
            color: '#94A3B8',
          },
          itemStyle: {
            shadowBlur: n.category === 4 ? 10 : 0,
            shadowColor: n.category === 4 ? '#EF444480' : 'transparent',
          },
        })),
        links,
        roam: true,
        draggable: true,
        force: {
          repulsion: 120,
          edgeLength: [40, 100],
          gravity: 0.1,
        },
        lineStyle: { color: 'rgba(255,255,255,0.08)', width: 1, curveness: 0.1 },
        emphasis: {
          focus: 'adjacency',
          lineStyle: { width: 3, color: '#7C3AED' },
        },
        animationDuration: 1200,
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
          <Typography variant="h5" fontWeight={800}>G3 — Cluster Topology</Typography>
          <Typography variant="body2" color="text.secondary">
            Force-directed graph of nodes and pods with eCharts — drag, zoom, focus adjacency
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider' }}>
        <Button variant="contained" size="small" startIcon={<ReplayIcon fontSize="small" />} onClick={() => setKey(k => k + 1)}>
          Replay
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto', alignSelf: 'center' }}>
          Drag nodes · Scroll to zoom · Click to focus adjacency
        </Typography>
      </Box>

      <Box
        ref={chartRef}
        sx={{ width: '100%', height: 500, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}
      />
    </Box>
  )
}
