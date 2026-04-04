'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ReplayIcon from '@mui/icons-material/Replay'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import { useRouter } from 'next/navigation'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'

function AnimatedCounter({ value, color }: { value: number; color: string }) {
  const motionValue = useMotionValue(0)
  const rounded = useTransform(motionValue, (v) => Math.round(v))
  const displayRef = useRef<HTMLSpanElement>(null)
  const prevValue = useRef(value)

  useEffect(() => {
    const prev = prevValue.current
    prevValue.current = value
    const controls = animate(motionValue, value, { duration: 0.4, ease: [0.22, 1, 0.36, 1] })
    return controls.stop
  }, [value, motionValue])

  useEffect(() => {
    return rounded.on('change', (v) => {
      if (displayRef.current) displayRef.current.textContent = String(v)
    })
  }, [rounded])

  return (
    <motion.span
      ref={displayRef}
      style={{ fontWeight: 700, fontSize: 28, fontFamily: 'monospace', color }}
    >
      {value}
    </motion.span>
  )
}

function FlashChip({ label, value, color, bgColor, changed }: {
  label: string; value: number; color: string; bgColor: string; changed: boolean
}) {
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: changed ? `${bgColor}` : 'background.paper',
        border: '1px solid',
        borderColor: changed ? color : 'divider',
        transition: 'background-color 600ms ease, border-color 300ms ease',
        textAlign: 'center',
        minWidth: 140,
      }}
    >
      <AnimatedCounter value={value} color={color} />
      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.5 }}>
        {label}
      </Typography>
    </Box>
  )
}

export default function CounterAnimatePrototype() {
  const router = useRouter()
  const [stats, setStats] = useState({ nodes: 4, running: 24, sleeping: 8 })
  const [prev, setPrev] = useState(stats)
  const [streaming, setStreaming] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const simulateUpdate = useCallback(() => {
    setStats(s => {
      setPrev(s)
      const delta = Math.floor(Math.random() * 5) - 2
      const newSleeping = Math.max(0, Math.min(s.sleeping + delta, 30))
      const newRunning = Math.max(0, 32 - newSleeping)
      return { nodes: s.nodes, running: newRunning, sleeping: newSleeping }
    })
  }, [])

  useEffect(() => {
    if (streaming) {
      intervalRef.current = setInterval(simulateUpdate, 2000)
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [streaming, simulateUpdate])

  const nodesChanged = stats.nodes !== prev.nodes
  const runningChanged = stats.running !== prev.running
  const sleepingChanged = stats.sleeping !== prev.sleeping

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>F3 — Counter Animate</Typography>
          <Typography variant="body2" color="text.secondary">
            Dashboard stat counters with Framer Motion number interpolation and flash highlights
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', alignItems: 'center' }}>
        <Button
          variant="contained"
          size="small"
          startIcon={streaming ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
          onClick={() => setStreaming(s => !s)}
          color={streaming ? 'warning' : 'primary'}
        >
          {streaming ? 'Pause SSE' : 'Simulate SSE'}
        </Button>
        <Button variant="outlined" size="small" onClick={simulateUpdate} disabled={streaming}>
          Single Update
        </Button>
        {streaming && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, ml: 'auto' }}>
            <Box sx={{
              width: 7, height: 7, borderRadius: '50%', bgcolor: '#22C55E',
              animation: 'sseDot 2s ease-in-out infinite',
              '@keyframes sseDot': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
            }} />
            <Typography variant="caption" color="text.secondary">SSE stream active</Typography>
          </Box>
        )}
      </Box>

      {/* Stats display */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mb: 4 }}>
        <FlashChip label="Nodes Active" value={stats.nodes} color="#22C55E" bgColor="rgba(34,197,94,0.1)" changed={nodesChanged} />
        <FlashChip label="Workloads Running" value={stats.running} color="#3B82F6" bgColor="rgba(59,130,246,0.1)" changed={runningChanged} />
        <FlashChip label="Workloads Sleeping" value={stats.sleeping} color="#F59E0B" bgColor="rgba(245,158,11,0.1)" changed={sleepingChanged} />
      </Box>

      {/* Chip variant (as in ClusterStatusCard) */}
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
        Chip variant (as in ClusterStatusCard):
      </Typography>
      <Box sx={{ display: 'flex', gap: 1.5, p: 2, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
        <Chip
          label={<><AnimatedCounter value={stats.nodes} color="#22C55E" /> Nodes Active</>}
          size="small"
          sx={{ bgcolor: 'rgba(34,197,94,0.1)', color: '#22C55E', fontWeight: 600, '& .MuiChip-label': { display: 'flex', gap: 0.5, alignItems: 'center' } }}
        />
        <Chip
          label={<><AnimatedCounter value={stats.running} color="#3B82F6" /> Running</>}
          size="small"
          sx={{ bgcolor: 'rgba(59,130,246,0.1)', color: '#3B82F6', fontWeight: 600, '& .MuiChip-label': { display: 'flex', gap: 0.5, alignItems: 'center' } }}
        />
        <Chip
          label={<><AnimatedCounter value={stats.sleeping} color="#F59E0B" /> Sleeping</>}
          size="small"
          sx={{ bgcolor: 'rgba(245,158,11,0.1)', color: '#F59E0B', fontWeight: 600, '& .MuiChip-label': { display: 'flex', gap: 0.5, alignItems: 'center' } }}
        />
      </Box>
    </Box>
  )
}
