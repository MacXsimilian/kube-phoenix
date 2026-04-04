'use client'

import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ReplayIcon from '@mui/icons-material/Replay'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

interface SwimExec { id: number; direction: 'sleep' | 'wake'; status: 'success' | 'failed' | 'running'; startHour: number; durationHours: number; scaled: number }

interface PolicyLane { name: string; state: string; color: string; executions: SwimExec[] }

const LANES: PolicyLane[] = [
  {
    name: 'EU Dev Sleep', state: 'transitioning', color: '#7C3AED',
    executions: [
      { id: 1, direction: 'sleep', status: 'success', startHour: 0, durationHours: 2, scaled: 4 },
      { id: 2, direction: 'wake', status: 'success', startHour: 7, durationHours: 1.5, scaled: 4 },
      { id: 5, direction: 'sleep', status: 'success', startHour: 14, durationHours: 2, scaled: 4 },
      { id: 8, direction: 'sleep', status: 'running', startHour: 20, durationHours: 1, scaled: 2 },
    ],
  },
  {
    name: 'US Staging Nightly', state: 'sleeping', color: '#3B82F6',
    executions: [
      { id: 3, direction: 'sleep', status: 'success', startHour: 2, durationHours: 1.5, scaled: 4 },
      { id: 4, direction: 'wake', status: 'success', startHour: 6, durationHours: 1, scaled: 4 },
      { id: 6, direction: 'sleep', status: 'success', startHour: 16, durationHours: 2, scaled: 4 },
    ],
  },
  {
    name: 'Cost Optimization', state: 'awake', color: '#22C55E',
    executions: [
      { id: 7, direction: 'sleep', status: 'failed', startHour: 10, durationHours: 3, scaled: 0 },
    ],
  },
]

const DIR_COLORS = { sleep: { bg: 'rgba(124,58,237,0.25)', border: '#7C3AED' }, wake: { bg: 'rgba(34,197,94,0.25)', border: '#22C55E' } }
const STATUS_STYLE: Record<string, { opacity: number; borderStyle: string }> = {
  success: { opacity: 1, borderStyle: 'solid' },
  failed: { opacity: 0.8, borderStyle: 'dashed' },
  running: { opacity: 1, borderStyle: 'solid' },
}

export default function PolicySwimlanPrototype() {
  const router = useRouter()
  const [key, setKey] = useState(0)

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small"><ArrowBackIcon fontSize="small" /></IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>I4 — Policy Swimlane</Typography>
          <Typography variant="body2" color="text.secondary">Horizontal swimlane timeline — one lane per policy, executions as blocks on a 24h axis</Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider' }}>
        <Button variant="contained" size="small" startIcon={<ReplayIcon fontSize="small" />} onClick={() => setKey(k => k + 1)}>Replay</Button>
        <Box sx={{ ml: 'auto', display: 'flex', gap: 2 }}>
          {[{ l: 'Sleep', c: '#7C3AED' }, { l: 'Wake', c: '#22C55E' }, { l: 'Failed', c: '#EF4444' }, { l: 'Running', c: '#F59E0B' }].map(x => (
            <Box key={x.l} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: 1, bgcolor: x.c }} />
              <Typography variant="caption" color="text.secondary">{x.l}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Hour axis */}
      <Box sx={{ display: 'flex', ml: '140px', mb: 0.5 }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <Typography key={i} variant="caption" sx={{ flex: 1, color: 'text.disabled', fontSize: 10, fontFamily: 'monospace' }}>
            {i * 3}:00
          </Typography>
        ))}
      </Box>

      {/* Lanes */}
      <Box sx={{ borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        {LANES.map((lane, li) => (
          <Box key={lane.name} sx={{ display: 'flex', borderBottom: li < LANES.length - 1 ? '1px solid' : 'none', borderColor: 'divider' }}>
            {/* Label */}
            <Box sx={{ width: 140, p: 1.5, borderRight: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <Typography variant="caption" fontWeight={600} sx={{ fontSize: 11 }}>{lane.name}</Typography>
              <Chip label={lane.state} size="small" sx={{ height: 16, fontSize: 9, mt: 0.25, bgcolor: `${lane.color}18`, color: lane.color }} />
            </Box>

            {/* Timeline */}
            <Box sx={{ flex: 1, position: 'relative', height: 56 }}>
              {/* Hour gridlines */}
              {Array.from({ length: 8 }).map((_, i) => (
                <Box key={i} sx={{ position: 'absolute', left: `${((i + 1) * 3 / 24) * 100}%`, top: 0, bottom: 0, width: 1, bgcolor: 'rgba(255,255,255,0.03)' }} />
              ))}

              {/* Now marker */}
              <Box sx={{ position: 'absolute', left: `${(20.5 / 24) * 100}%`, top: 0, bottom: 0, width: 1.5, bgcolor: '#f87171', zIndex: 2, borderRadius: 1 }} />

              <AnimatePresence>
                {lane.executions.map((exec, i) => {
                  const left = (exec.startHour / 24) * 100
                  const width = (exec.durationHours / 24) * 100
                  const dc = DIR_COLORS[exec.direction]
                  const ss = STATUS_STYLE[exec.status]
                  return (
                    <motion.div
                      key={`${exec.id}-${key}`}
                      initial={{ scaleX: 0, opacity: 0 }}
                      animate={{ scaleX: 1, opacity: ss.opacity }}
                      transition={{ duration: 0.4, delay: li * 0.1 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                      style={{
                        position: 'absolute', left: `${left}%`, width: `${width}%`,
                        top: 10, bottom: 10, transformOrigin: 'left center',
                      }}
                    >
                      <Box sx={{
                        height: '100%', borderRadius: 1, bgcolor: exec.status === 'failed' ? 'rgba(239,68,68,0.2)' : dc.bg,
                        border: `1.5px ${ss.borderStyle} ${exec.status === 'failed' ? '#EF4444' : exec.status === 'running' ? '#F59E0B' : dc.border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, px: 0.5, overflow: 'hidden',
                        ...(exec.status === 'running' && {
                          backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255,255,255,0.05) 4px, rgba(255,255,255,0.05) 8px)',
                          backgroundSize: '16px 16px',
                          animation: 'swimPole 600ms linear infinite',
                          '@keyframes swimPole': { from: { backgroundPosition: '0 0' }, to: { backgroundPosition: '16px 0' } },
                        }),
                      }}>
                        {exec.direction === 'sleep' ? <BedtimeIcon sx={{ fontSize: 11, color: dc.border }} /> : <WbSunnyIcon sx={{ fontSize: 11, color: dc.border }} />}
                        <Typography variant="caption" sx={{ fontSize: 9, color: '#E2E8F0', whiteSpace: 'nowrap' }}>
                          {exec.scaled > 0 ? `${exec.scaled}wl` : ''}
                        </Typography>
                      </Box>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
