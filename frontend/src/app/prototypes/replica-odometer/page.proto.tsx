'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import { useRouter } from 'next/navigation'

interface Workload { name: string; namespace: string; kind: string; saved: number; current: number }

const INITIAL: Workload[] = [
  { name: 'api-server', namespace: 'dev', kind: 'Deployment', saved: 3, current: 3 },
  { name: 'web-frontend', namespace: 'dev', kind: 'Deployment', saved: 2, current: 2 },
  { name: 'worker', namespace: 'dev', kind: 'Deployment', saved: 2, current: 2 },
  { name: 'redis', namespace: 'dev', kind: 'StatefulSet', saved: 1, current: 1 },
  { name: 'checkout-svc', namespace: 'staging', kind: 'Deployment', saved: 2, current: 2 },
  { name: 'product-api', namespace: 'staging', kind: 'Deployment', saved: 3, current: 3 },
]

function OdometerDigit({ value, color }: { value: number; color: string }) {
  return (
    <Box sx={{
      width: 28, height: 36, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.04)',
      border: '1px solid', borderColor: 'divider', overflow: 'hidden', position: 'relative',
    }}>
      <Box sx={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'transform 400ms cubic-bezier(0.22,1,0.36,1), color 400ms ease',
        transform: `translateY(${-value * 0}px)`,
        color,
      }}>
        <Typography sx={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, lineHeight: 1 }}>
          {value}
        </Typography>
      </Box>
      {/* Flash on change */}
      <Box sx={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        animation: 'odomFlash 600ms ease-out',
        '@keyframes odomFlash': {
          from: { backgroundColor: `${color}20` },
          to: { backgroundColor: 'transparent' },
        },
      }} />
    </Box>
  )
}

function WorkloadRow({ workload, animating }: { workload: Workload; animating: boolean }) {
  const isZero = workload.current === 0
  const color = isZero ? '#7C3AED' : '#22C55E'

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 2, p: 1.5, borderRadius: 2,
      bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
      opacity: isZero ? 0.6 : 1, transition: 'opacity 400ms ease',
    }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={500} sx={{ fontFamily: 'monospace', fontSize: 12 }}>
          {workload.namespace}/{workload.name}
        </Typography>
        <Chip label={workload.kind} size="small" sx={{ height: 16, fontSize: 9, mt: 0.25, bgcolor: 'rgba(124,58,237,0.08)', color: '#7C3AED' }} />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <OdometerDigit value={workload.current} color={color} />
        <Typography sx={{ color: 'text.disabled', fontSize: 12 }}>/</Typography>
        <Typography sx={{ fontFamily: 'monospace', fontSize: 14, color: 'text.secondary' }}>{workload.saved}</Typography>
      </Box>

      {/* Mini bar */}
      <Box sx={{ width: 60, height: 4, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <Box sx={{
          height: '100%', borderRadius: 1, bgcolor: color,
          width: `${(workload.current / Math.max(workload.saved, 1)) * 100}%`,
          transition: 'width 500ms cubic-bezier(0.22,1,0.36,1), background-color 400ms ease',
        }} />
      </Box>
    </Box>
  )
}

export default function ReplicaOdometerPrototype() {
  const router = useRouter()
  const [workloads, setWorkloads] = useState<Workload[]>(INITIAL)
  const [animating, setAnimating] = useState(false)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const sleepAll = useCallback(() => {
    setAnimating(true)
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
    workloads.forEach((_, i) => {
      const t = setTimeout(() => {
        setWorkloads(prev => prev.map((w, j) => j === i ? { ...w, current: 0 } : w))
        if (i === workloads.length - 1) setAnimating(false)
      }, i * 400)
      timeoutsRef.current.push(t)
    })
  }, [workloads])

  const wakeAll = useCallback(() => {
    setAnimating(true)
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
    workloads.forEach((_, i) => {
      const t = setTimeout(() => {
        setWorkloads(prev => prev.map((w, j) => j === i ? { ...w, current: w.saved } : w))
        if (i === workloads.length - 1) setAnimating(false)
      }, i * 300)
      timeoutsRef.current.push(t)
    })
  }, [workloads])

  useEffect(() => () => timeoutsRef.current.forEach(clearTimeout), [])

  const totalCurrent = workloads.reduce((s, w) => s + w.current, 0)
  const totalSaved = workloads.reduce((s, w) => s + w.saved, 0)

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small"><ArrowBackIcon fontSize="small" /></IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>I1 — Replica Odometer</Typography>
          <Typography variant="body2" color="text.secondary">Workload replica counters that roll down to 0 on sleep and back up on wake — staggered per workload</Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 3, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', alignItems: 'center' }}>
        <Button variant="contained" size="small" startIcon={<BedtimeIcon fontSize="small" />} onClick={sleepAll} disabled={animating || totalCurrent === 0} sx={{ bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' } }}>Sleep All</Button>
        <Button variant="contained" size="small" startIcon={<WbSunnyIcon fontSize="small" />} onClick={wakeAll} disabled={animating || totalCurrent === totalSaved} color="success">Wake All</Button>
        <Box sx={{ ml: 'auto' }}>
          <Typography variant="caption" sx={{ fontFamily: 'monospace', color: totalCurrent === 0 ? '#7C3AED' : '#22C55E', fontWeight: 700 }}>
            {totalCurrent}/{totalSaved} replicas
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {workloads.map(w => <WorkloadRow key={`${w.namespace}/${w.name}`} workload={w} animating={animating} />)}
      </Box>
    </Box>
  )
}
