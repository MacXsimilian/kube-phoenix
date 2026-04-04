'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import ReplayIcon from '@mui/icons-material/Replay'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import { useRouter } from 'next/navigation'
import * as echarts from 'echarts'
import { darkTheme } from '@/lib/motion/echartsTheme'

echarts.registerTheme('kube-phoenix-dark', darkTheme)

type PodState = 'running' | 'sleeping' | 'pending' | 'failed' | 'terminating'

interface PodNode {
  id: string
  name: string
  namespace: string
  node: string
  state: PodState
  cpu: number
}

const STATE_COLOR: Record<PodState, string> = {
  running: '#22C55E',
  sleeping: '#7C3AED',
  pending: '#F59E0B',
  failed: '#EF4444',
  terminating: '#64748B',
}

const NODES = [
  { name: 'node-1', cpu: 4000, mem: 16000, zone: 'eu-west-1a' },
  { name: 'node-2', cpu: 4000, mem: 16000, zone: 'eu-west-1b' },
  { name: 'node-3', cpu: 2000, mem: 8000, zone: 'eu-west-1a' },
]

function generateInitialPods(): PodNode[] {
  const pods: PodNode[] = []
  const workloads = [
    { ns: 'dev', name: 'api-server', count: 3, node: ['node-1', 'node-1', 'node-2'] },
    { ns: 'dev', name: 'web-frontend', count: 2, node: ['node-1', 'node-2'] },
    { ns: 'dev', name: 'redis', count: 1, node: ['node-1'] },
    { ns: 'dev', name: 'worker', count: 2, node: ['node-1', 'node-2'] },
    { ns: 'staging', name: 'checkout-svc', count: 2, node: ['node-2', 'node-3'] },
    { ns: 'staging', name: 'product-api', count: 3, node: ['node-2', 'node-3', 'node-3'] },
    { ns: 'monitoring', name: 'prometheus', count: 1, node: ['node-2'] },
    { ns: 'monitoring', name: 'grafana', count: 1, node: ['node-2'] },
    { ns: 'kube-system', name: 'coredns', count: 2, node: ['node-1', 'node-3'] },
  ]
  let id = 0
  for (const wl of workloads) {
    for (let i = 0; i < wl.count; i++) {
      pods.push({
        id: `pod-${id++}`,
        name: `${wl.name}-${Math.random().toString(36).slice(2, 5)}`,
        namespace: wl.ns,
        node: wl.node[i],
        state: 'running',
        cpu: 50 + Math.random() * 200,
      })
    }
  }
  return pods
}

function buildChart(chart: echarts.ECharts, pods: PodNode[]) {
  const nodes: object[] = [
    { name: 'cluster', x: 400, y: 40, symbolSize: 32, category: 0, label: { show: true, fontSize: 12, fontWeight: 'bold' }, itemStyle: { color: '#7C3AED', shadowBlur: 15, shadowColor: '#7C3AED40' } },
  ]
  const links: object[] = []
  const categories = [
    { name: 'Cluster' }, { name: 'Node' },
    { name: 'Running' }, { name: 'Sleeping' }, { name: 'Pending' }, { name: 'Failed' }, { name: 'Terminating' },
  ]
  const catMap: Record<PodState, number> = { running: 2, sleeping: 3, pending: 4, failed: 5, terminating: 6 }

  const nodePositions = [{ x: 200, y: 160 }, { x: 400, y: 160 }, { x: 600, y: 160 }]

  NODES.forEach((n, i) => {
    const podCount = pods.filter(p => p.node === n.name).length
    const cpuUsed = pods.filter(p => p.node === n.name).reduce((s, p) => s + p.cpu, 0)
    const pct = Math.round((cpuUsed / n.cpu) * 100)
    nodes.push({
      name: n.name,
      x: nodePositions[i].x,
      y: nodePositions[i].y,
      symbolSize: 24 + podCount * 1.5,
      category: 1,
      label: { show: true, position: 'bottom', fontSize: 10, color: '#94A3B8', formatter: `{bold|${n.name}}\n${podCount} pods · ${pct}% CPU` },
      itemStyle: { color: '#22D3EE', borderWidth: 2, borderColor: pct > 80 ? '#EF4444' : pct > 60 ? '#F59E0B' : '#22D3EE40' },
    })
    links.push({ source: 'cluster', target: n.name, lineStyle: { width: 2, color: 'rgba(255,255,255,0.08)' } })
  })

  const podsByNode = new Map<string, PodNode[]>()
  for (const p of pods) {
    if (!podsByNode.has(p.node)) podsByNode.set(p.node, [])
    podsByNode.get(p.node)!.push(p)
  }

  podsByNode.forEach((nodePods, nodeName) => {
    const nodeIdx = NODES.findIndex(n => n.name === nodeName)
    const baseX = nodePositions[nodeIdx]?.x ?? 400
    const baseY = nodePositions[nodeIdx]?.y ?? 160
    const cols = Math.ceil(Math.sqrt(nodePods.length))
    nodePods.forEach((p, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      nodes.push({
        name: p.id,
        x: baseX - cols * 15 + col * 30,
        y: baseY + 60 + row * 28,
        symbolSize: 8 + p.cpu / 50,
        category: catMap[p.state],
        label: { show: false },
        itemStyle: {
          color: STATE_COLOR[p.state],
          shadowBlur: p.state === 'failed' ? 8 : 0,
          shadowColor: p.state === 'failed' ? '#EF444480' : 'transparent',
          opacity: p.state === 'terminating' ? 0.4 : p.state === 'sleeping' ? 0.6 : 1,
        },
        tooltip: { formatter: `<b>${p.name}</b><br/>${p.namespace}<br/>CPU: ${Math.round(p.cpu)}m<br/>State: ${p.state}` },
      })
      links.push({ source: nodeName, target: p.id, lineStyle: { width: 0.5, color: `${STATE_COLOR[p.state]}30` } })
    })
  })

  chart.setOption({
    animation: true,
    animationDurationUpdate: 500,
    animationEasingUpdate: 'cubicInOut',
    tooltip: { trigger: 'item' },
    legend: {
      data: categories.map(c => c.name),
      bottom: 10,
      textStyle: { color: '#64748B', fontSize: 10 },
      itemWidth: 10,
      itemHeight: 10,
    },
    series: [{
      type: 'graph',
      layout: 'none',
      categories: categories.map((c, i) => ({
        name: c.name,
        itemStyle: { color: ['#7C3AED', '#22D3EE', '#22C55E', '#7C3AED', '#F59E0B', '#EF4444', '#64748B'][i] },
      })),
      nodes,
      links,
      roam: true,
      lineStyle: { curveness: 0.15 },
      emphasis: { focus: 'adjacency', lineStyle: { width: 2 } },
      label: { rich: { bold: { fontWeight: 'bold', fontSize: 11 } } },
    }],
  }, { replaceMerge: ['series'] })
}

export default function TopologyLivePrototype() {
  const router = useRouter()
  const chartRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<echarts.ECharts | null>(null)
  const podsRef = useRef<PodNode[]>(generateInitialPods())
  const [streaming, setStreaming] = useState(false)
  const [stats, setStats] = useState({ total: 0, running: 0, sleeping: 0, failed: 0 })
  const [key, setKey] = useState(0)

  const updateStats = useCallback(() => {
    const pods = podsRef.current
    setStats({
      total: pods.length,
      running: pods.filter(p => p.state === 'running').length,
      sleeping: pods.filter(p => p.state === 'sleeping').length,
      failed: pods.filter(p => p.state === 'failed').length,
    })
  }, [])

  useEffect(() => {
    if (!chartRef.current) return
    instanceRef.current?.dispose()
    const chart = echarts.init(chartRef.current, 'kube-phoenix-dark', { renderer: 'canvas' })
    instanceRef.current = chart
    podsRef.current = generateInitialPods()
    buildChart(chart, podsRef.current)
    updateStats()
    const ob = new ResizeObserver(() => chart.resize())
    ob.observe(chartRef.current)
    return () => { ob.disconnect(); chart.dispose() }
  }, [key, updateStats])

  useEffect(() => {
    if (!streaming || !instanceRef.current) return
    const interval = setInterval(() => {
      const pods = podsRef.current
      const idx = Math.floor(Math.random() * pods.length)
      const pod = pods[idx]
      const rand = Math.random()
      if (rand < 0.05 && pod.state === 'running') {
        pod.state = 'failed'
        pod.cpu = 0
      } else if (rand < 0.15 && pod.state === 'running') {
        pod.state = 'pending'
      } else if (pod.state === 'pending') {
        pod.state = 'running'
        pod.cpu = 50 + Math.random() * 200
      } else if (pod.state === 'failed') {
        pod.state = 'running'
        pod.cpu = 50 + Math.random() * 150
      } else {
        pod.cpu = Math.max(10, Math.min(400, pod.cpu + (Math.random() - 0.5) * 40))
      }
      buildChart(instanceRef.current!, pods)
      updateStats()
    }, 1500)
    return () => clearInterval(interval)
  }, [streaming, updateStats])

  const sleepNamespace = useCallback((ns: string) => {
    podsRef.current.forEach(p => { if (p.namespace === ns) { p.state = 'sleeping'; p.cpu = 0 } })
    if (instanceRef.current) buildChart(instanceRef.current, podsRef.current)
    updateStats()
  }, [updateStats])

  const wakeNamespace = useCallback((ns: string) => {
    podsRef.current.forEach(p => { if (p.namespace === ns && p.state === 'sleeping') { p.state = 'running'; p.cpu = 50 + Math.random() * 200 } })
    if (instanceRef.current) buildChart(instanceRef.current, podsRef.current)
    updateStats()
  }, [updateStats])

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>G3-v2 — Live Topology</Typography>
          <Typography variant="body2" color="text.secondary">
            Cluster graph with live pod state changes, namespace sleep/wake, CPU-sized nodes
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button variant="contained" size="small" startIcon={streaming ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />} onClick={() => setStreaming(s => !s)} color={streaming ? 'warning' : 'primary'}>
          {streaming ? 'Pause' : 'Simulate'}
        </Button>
        <Button variant="outlined" size="small" startIcon={<ReplayIcon fontSize="small" />} onClick={() => { setStreaming(false); setKey(k => k + 1) }}>
          Reset
        </Button>
        <Box sx={{ mx: 1, height: 20, borderLeft: '1px solid', borderColor: 'divider' }} />
        <Button size="small" startIcon={<BedtimeIcon sx={{ fontSize: 14 }} />} onClick={() => sleepNamespace('staging')} sx={{ fontSize: 11, color: '#7C3AED' }}>
          Sleep staging
        </Button>
        <Button size="small" startIcon={<WbSunnyIcon sx={{ fontSize: 14 }} />} onClick={() => wakeNamespace('staging')} sx={{ fontSize: 11, color: '#22C55E' }}>
          Wake staging
        </Button>
        <Button size="small" startIcon={<BedtimeIcon sx={{ fontSize: 14 }} />} onClick={() => sleepNamespace('dev')} sx={{ fontSize: 11, color: '#7C3AED' }}>
          Sleep dev
        </Button>
        <Button size="small" startIcon={<WbSunnyIcon sx={{ fontSize: 14 }} />} onClick={() => wakeNamespace('dev')} sx={{ fontSize: 11, color: '#22C55E' }}>
          Wake dev
        </Button>
      </Box>

      {/* Stats bar */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
        <Chip label={`${stats.total} pods`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.06)', fontWeight: 600 }} />
        <Chip label={`${stats.running} running`} size="small" sx={{ bgcolor: 'rgba(34,197,94,0.12)', color: '#22C55E', fontWeight: 600 }} />
        <Chip label={`${stats.sleeping} sleeping`} size="small" sx={{ bgcolor: 'rgba(124,58,237,0.12)', color: '#7C3AED', fontWeight: 600 }} />
        {stats.failed > 0 && <Chip label={`${stats.failed} failed`} size="small" sx={{ bgcolor: 'rgba(239,68,68,0.12)', color: '#EF4444', fontWeight: 600 }} />}
      </Box>

      <Box
        ref={chartRef}
        sx={{ width: '100%', height: 550, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}
      />
    </Box>
  )
}
