'use client'

import { useState, useEffect, useRef } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import ReplayIcon from '@mui/icons-material/Replay'
import { useRouter } from 'next/navigation'

interface MatrixCell {
  namespace: string
  workload: string
  replicas: number
  maxReplicas: number
  status: 'running' | 'sleeping' | 'scaling'
}

const INITIAL_MATRIX: MatrixCell[] = [
  { namespace: 'dev', workload: 'api-server', replicas: 3, maxReplicas: 3, status: 'running' },
  { namespace: 'dev', workload: 'web-fe', replicas: 2, maxReplicas: 2, status: 'running' },
  { namespace: 'dev', workload: 'worker', replicas: 2, maxReplicas: 2, status: 'running' },
  { namespace: 'dev', workload: 'redis', replicas: 1, maxReplicas: 1, status: 'running' },
  { namespace: 'staging', workload: 'checkout', replicas: 2, maxReplicas: 2, status: 'running' },
  { namespace: 'staging', workload: 'product', replicas: 3, maxReplicas: 3, status: 'running' },
  { namespace: 'staging', workload: 'cart', replicas: 2, maxReplicas: 2, status: 'running' },
  { namespace: 'staging', workload: 'postgres', replicas: 1, maxReplicas: 1, status: 'running' },
  { namespace: 'monitoring', workload: 'prometheus', replicas: 1, maxReplicas: 1, status: 'running' },
  { namespace: 'monitoring', workload: 'grafana', replicas: 1, maxReplicas: 1, status: 'running' },
]

function ReplicaDots({ replicas, maxReplicas, status }: { replicas: number; maxReplicas: number; status: string }) {
  return (
    <Box sx={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
      {Array.from({ length: maxReplicas }).map((_, i) => {
        const alive = i < replicas
        const scaling = status === 'scaling' && i === replicas
        return (
          <Box
            key={i}
            sx={{
              width: 10, height: 10, borderRadius: '50%',
              bgcolor: alive ? '#22C55E' : status === 'sleeping' ? '#7C3AED40' : 'rgba(255,255,255,0.08)',
              transition: 'background-color 400ms ease, transform 300ms ease, box-shadow 300ms ease',
              boxShadow: alive ? '0 0 4px rgba(34,197,94,0.4)' : 'none',
              transform: alive ? 'scale(1)' : 'scale(0.7)',
              ...(scaling && {
                animation: 'scaleDot 0.6s ease-in-out infinite',
                '@keyframes scaleDot': { '0%,100%': { transform: 'scale(0.7)', opacity: 0.5 }, '50%': { transform: 'scale(1.1)', opacity: 1 } },
                bgcolor: '#F59E0B',
              }),
            }}
          />
        )
      })}
    </Box>
  )
}

export default function ScalingMatrixPrototype() {
  const router = useRouter()
  const [matrix, setMatrix] = useState(INITIAL_MATRIX)
  const [playing, setPlaying] = useState(false)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const reset = () => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
    setMatrix(INITIAL_MATRIX)
    setPlaying(false)
  }

  const playSleep = () => {
    reset()
    setTimeout(() => {
      setPlaying(true)
      let delay = 0
      INITIAL_MATRIX.forEach((cell, i) => {
        if (cell.namespace === 'monitoring') return
        const scaleDelay = delay
        for (let r = cell.replicas; r >= 0; r--) {
          const d = scaleDelay + (cell.replicas - r) * 300
          const t = setTimeout(() => {
            setMatrix(prev => prev.map((c, j) =>
              j === i ? { ...c, replicas: r, status: r === 0 ? 'sleeping' : r < cell.maxReplicas ? 'scaling' : 'running' } : c
            ))
          }, d)
          timeoutsRef.current.push(t)
        }
        delay += cell.replicas * 300 + 200
      })
      const endT = setTimeout(() => setPlaying(false), delay)
      timeoutsRef.current.push(endT)
    }, 50)
  }

  useEffect(() => () => timeoutsRef.current.forEach(clearTimeout), [])

  const namespaces = [...new Set(matrix.map(c => c.namespace))]
  const totalAlive = matrix.reduce((s, c) => s + c.replicas, 0)
  const totalMax = matrix.reduce((s, c) => s + c.maxReplicas, 0)

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small"><ArrowBackIcon fontSize="small" /></IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>I8 — Scaling Matrix</Typography>
          <Typography variant="body2" color="text.secondary">Dot matrix of all replicas — each dot represents one pod. Watch them turn off one by one during sleep.</Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 3, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', alignItems: 'center' }}>
        <Button variant="contained" size="small" startIcon={<PlayArrowIcon fontSize="small" />} onClick={playSleep} disabled={playing}>Play Sleep</Button>
        <Button variant="outlined" size="small" startIcon={<ReplayIcon fontSize="small" />} onClick={reset}>Reset</Button>
        <Chip label={`${totalAlive}/${totalMax} replicas`} size="small" sx={{ ml: 'auto', fontFamily: 'monospace', fontWeight: 600, bgcolor: totalAlive === totalMax ? 'rgba(34,197,94,0.12)' : totalAlive === 0 ? 'rgba(124,58,237,0.12)' : 'rgba(245,158,11,0.12)', color: totalAlive === totalMax ? '#22C55E' : totalAlive === 0 ? '#7C3AED' : '#F59E0B' }} />
      </Box>

      <Box sx={{ borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        {namespaces.map((ns, ni) => (
          <Box key={ns}>
            {ni > 0 && <Box sx={{ height: 1, bgcolor: 'divider' }} />}
            <Box sx={{ p: 1, bgcolor: 'rgba(124,58,237,0.04)' }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.light', textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 10 }}>{ns}</Typography>
            </Box>
            {matrix.filter(c => c.namespace === ns).map(cell => (
              <Box key={`${cell.namespace}/${cell.workload}`} sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 11, width: 100, color: cell.status === 'sleeping' ? 'text.disabled' : 'text.primary', transition: 'color 400ms ease' }}>
                  {cell.workload}
                </Typography>
                <ReplicaDots replicas={cell.replicas} maxReplicas={cell.maxReplicas} status={cell.status} />
                <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 11, color: 'text.disabled', ml: 'auto' }}>
                  {cell.replicas}/{cell.maxReplicas}
                </Typography>
              </Box>
            ))}
          </Box>
        ))}
      </Box>
    </Box>
  )
}
