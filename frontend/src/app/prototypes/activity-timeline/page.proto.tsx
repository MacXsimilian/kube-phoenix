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

interface TimelineEvent {
  id: number
  direction: 'sleep' | 'wake'
  status: 'success' | 'failed' | 'running'
  policy: string
  scaled: number
  errors: number
  time: string
}

const MOCK_EVENTS: TimelineEvent[] = [
  { id: 8, direction: 'sleep', status: 'running', policy: 'EU Dev Sleep', scaled: 2, errors: 0, time: '3 min ago' },
  { id: 7, direction: 'wake', status: 'success', policy: 'EU Dev Sleep', scaled: 4, errors: 0, time: '10h ago' },
  { id: 6, direction: 'sleep', status: 'success', policy: 'US Staging Nightly', scaled: 4, errors: 0, time: '6h ago' },
  { id: 5, direction: 'sleep', status: 'failed', policy: 'EU Dev Sleep', scaled: 2, errors: 1, time: '34h ago' },
  { id: 4, direction: 'wake', status: 'success', policy: 'US Staging Nightly', scaled: 4, errors: 0, time: '18h ago' },
  { id: 3, direction: 'sleep', status: 'success', policy: 'US Staging Nightly', scaled: 4, errors: 0, time: '30h ago' },
  { id: 2, direction: 'wake', status: 'success', policy: 'EU Dev Sleep', scaled: 4, errors: 0, time: '46h ago' },
  { id: 1, direction: 'sleep', status: 'success', policy: 'EU Dev Sleep', scaled: 4, errors: 0, time: '58h ago' },
]

const STATUS_COLORS = {
  success: '#22C55E',
  failed: '#EF4444',
  running: '#F59E0B',
}

export default function ActivityTimelinePrototype() {
  const router = useRouter()
  const [key, setKey] = useState(0)

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>G6 — Activity Timeline</Typography>
          <Typography variant="body2" color="text.secondary">
            Vertical timeline with animated entry points for execution history
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider' }}>
        <Button variant="contained" size="small" startIcon={<ReplayIcon fontSize="small" />} onClick={() => setKey(k => k + 1)}>
          Replay
        </Button>
      </Box>

      <Box sx={{ position: 'relative', pl: 4 }}>
        {/* Vertical line */}
        <Box sx={{ position: 'absolute', left: 15, top: 0, bottom: 0, width: 2, bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 1 }} />

        <AnimatePresence>
          {MOCK_EVENTS.map((evt, i) => {
            const color = STATUS_COLORS[evt.status]
            return (
              <motion.div
                key={`${evt.id}-${key}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                style={{ position: 'relative', marginBottom: 16 }}
              >
                {/* Dot on timeline */}
                <Box
                  sx={{
                    position: 'absolute',
                    left: -25,
                    top: 16,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: color,
                    border: '2px solid',
                    borderColor: 'background.paper',
                    boxShadow: `0 0 6px ${color}60`,
                    zIndex: 1,
                    ...(evt.status === 'running' && {
                      animation: 'tlDotPulse 1.5s ease-in-out infinite',
                      '@keyframes tlDotPulse': {
                        '0%, 100%': { boxShadow: `0 0 6px ${color}60` },
                        '50%': { boxShadow: `0 0 14px ${color}90` },
                      },
                    }),
                  }}
                />

                {/* Card */}
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: evt.status === 'failed' ? 'rgba(239,68,68,0.3)' : 'divider',
                    '&:hover': { borderColor: `${color}40` },
                    transition: 'border-color 200ms ease',
                    cursor: 'pointer',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                    <Box sx={{
                      width: 28, height: 28, borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      bgcolor: evt.direction === 'sleep' ? 'rgba(124,58,237,0.12)' : 'rgba(245,158,11,0.1)',
                    }}>
                      {evt.direction === 'sleep'
                        ? <BedtimeIcon sx={{ fontSize: 14, color: '#7C3AED' }} />
                        : <WbSunnyIcon sx={{ fontSize: 14, color: '#F59E0B' }} />}
                    </Box>
                    <Typography variant="body2" fontWeight={600}>
                      {evt.direction === 'sleep' ? 'Sleep' : 'Wake'} #{evt.id}
                    </Typography>
                    <Chip
                      label={evt.status}
                      size="small"
                      sx={{ height: 18, fontSize: 10, bgcolor: `${color}18`, color }}
                    />
                    {evt.errors > 0 && (
                      <Chip label={`${evt.errors} error`} size="small" sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(239,68,68,0.15)', color: '#EF4444' }} />
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>{evt.time}</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {evt.policy} · {evt.direction === 'wake' ? `Restored ${evt.scaled}` : `Scaled ${evt.scaled}`} workloads
                  </Typography>
                </Box>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </Box>
    </Box>
  )
}
