'use client'

import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import { useRouter } from 'next/navigation'

interface NodeData {
  name: string; zone: string; type: string; status: string
  cpuUsed: number; cpuTotal: number; memUsed: number; memTotal: number; pods: number; maxPods: number
}

const INITIAL_NODES: NodeData[] = [
  { name: 'node-1', zone: 'eu-west-1a', type: 'm5.xlarge', status: 'active', cpuUsed: 2800, cpuTotal: 4000, memUsed: 10500, memTotal: 16000, pods: 12, maxPods: 58 },
  { name: 'node-2', zone: 'eu-west-1b', type: 'm5.xlarge', status: 'protected', cpuUsed: 1900, cpuTotal: 4000, memUsed: 8200, memTotal: 16000, pods: 8, maxPods: 58 },
  { name: 'node-3', zone: 'eu-west-1a', type: 'm5.large', status: 'would-drain', cpuUsed: 400, cpuTotal: 2000, memUsed: 1200, memTotal: 8000, pods: 3, maxPods: 29 },
  { name: 'node-4', zone: 'eu-west-1c', type: 'm5.large', status: 'cordoned', cpuUsed: 0, cpuTotal: 2000, memUsed: 0, memTotal: 8000, pods: 0, maxPods: 29 },
]

function pctColor(pct: number) {
  if (pct > 85) return '#EF4444'
  if (pct > 65) return '#F59E0B'
  return '#22C55E'
}

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  active: { color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  protected: { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  'would-drain': { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  cordoned: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
}

function CapacityBar({ used, total, label, unit }: { used: number; total: number; label: string; unit: string }) {
  const pct = total > 0 ? Math.round((used / total) * 100) : 0
  const color = pctColor(pct)
  return (
    <Box sx={{ flex: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
        <Typography variant="caption" sx={{ fontSize: 10, color: 'text.secondary' }}>{label}</Typography>
        <Typography variant="caption" sx={{ fontSize: 10, fontFamily: 'monospace', color }}>{pct}%</Typography>
      </Box>
      <Box sx={{ height: 12, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.04)', overflow: 'hidden', position: 'relative' }}>
        <Box sx={{
          height: '100%', borderRadius: 1.5, bgcolor: color,
          width: `${pct}%`, transition: 'width 600ms cubic-bezier(0.22,1,0.36,1), background-color 400ms ease',
          ...(pct > 85 && {
            animation: 'capPulse 1.5s ease-in-out infinite',
            '@keyframes capPulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.7 } },
          }),
        }} />
        {/* Glow tip */}
        <Box sx={{
          position: 'absolute', top: 0, bottom: 0, left: `${pct}%`, width: 3, transform: 'translateX(-1.5px)',
          bgcolor: 'white', opacity: 0.4, borderRadius: 1,
          boxShadow: `0 0 6px ${color}`, transition: 'left 600ms cubic-bezier(0.22,1,0.36,1)',
        }} />
      </Box>
      <Typography variant="caption" sx={{ fontSize: 9, color: 'text.disabled', fontFamily: 'monospace' }}>
        {used}{unit} / {total}{unit}
      </Typography>
    </Box>
  )
}

function rw(prev: number, min: number, max: number, vol: number) {
  return Math.max(min, Math.min(max, Math.round(prev + (Math.random() - 0.48) * vol)))
}

export default function NodeCapacityBarPrototype() {
  const router = useRouter()
  const [nodes, setNodes] = useState(INITIAL_NODES)
  const [streaming, setStreaming] = useState(false)

  useEffect(() => {
    if (!streaming) return
    const interval = setInterval(() => {
      setNodes(prev => prev.map(n => ({
        ...n,
        cpuUsed: rw(n.cpuUsed, 0, n.cpuTotal, 200),
        memUsed: rw(n.memUsed, 0, n.memTotal, 800),
        pods: rw(n.pods, 0, n.maxPods, 2),
      })))
    }, 2000)
    return () => clearInterval(interval)
  }, [streaming])

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small"><ArrowBackIcon fontSize="small" /></IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>I2 — Node Capacity Bars</Typography>
          <Typography variant="body2" color="text.secondary">Per-node CPU/Memory/Pod capacity bars with glow tip, threshold pulse, and live streaming</Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', alignItems: 'center' }}>
        <Button variant="contained" size="small" startIcon={streaming ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />} onClick={() => setStreaming(s => !s)} color={streaming ? 'warning' : 'primary'}>
          {streaming ? 'Pause' : 'Simulate Load'}
        </Button>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {nodes.map(n => {
          const st = STATUS_STYLE[n.status] ?? STATUS_STYLE.active
          return (
            <Box key={n.name} sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Typography variant="body2" fontWeight={600} sx={{ fontFamily: 'monospace' }}>{n.name}</Typography>
                <Typography variant="caption" color="text.secondary">{n.type}</Typography>
                <Typography variant="caption" color="text.disabled">·</Typography>
                <Typography variant="caption" color="text.secondary">{n.zone}</Typography>
                <Chip label={n.status} size="small" sx={{ height: 18, fontSize: 10, bgcolor: st.bg, color: st.color, ml: 'auto' }} />
              </Box>
              <Box sx={{ display: 'flex', gap: 3 }}>
                <CapacityBar used={n.cpuUsed} total={n.cpuTotal} label="CPU" unit="m" />
                <CapacityBar used={n.memUsed} total={n.memTotal} label="Memory" unit="Mi" />
                <CapacityBar used={n.pods} total={n.maxPods} label="Pods" unit="" />
              </Box>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
