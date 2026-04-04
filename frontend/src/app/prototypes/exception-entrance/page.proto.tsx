'use client'

import { useState, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Slider from '@mui/material/Slider'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ReplayIcon from '@mui/icons-material/Replay'
import AddIcon from '@mui/icons-material/Add'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

interface MockException {
  id: number
  type: 'stay_awake' | 'force_sleep'
  reason: string
  ticketRef: string
  status: 'pending' | 'active' | 'completed'
  date: string
  time: string
}

const INITIAL: MockException[] = [
  { id: 1, type: 'stay_awake', reason: 'Black Friday traffic test', ticketRef: 'OPS-1234', status: 'active', date: 'Today', time: '08:00 – 20:00' },
  { id: 2, type: 'force_sleep', reason: 'Emergency cost reduction', ticketRef: 'COST-42', status: 'completed', date: 'Yesterday', time: 'All day' },
  { id: 3, type: 'stay_awake', reason: 'QA regression suite', ticketRef: 'STAGING-99', status: 'pending', date: 'Tomorrow', time: '06:00 – 18:00' },
]

let nextId = 10

const TYPE_CONFIG = {
  stay_awake: { label: 'Stay Awake', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.35)' },
  force_sleep: { label: 'Force Sleep', color: '#EF4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.35)' },
}

const STATUS_CONFIG = {
  pending: { color: '#94A3B8', bg: 'rgba(148,163,184,0.15)' },
  active: { color: '#22C55E', bg: 'rgba(34,197,94,0.15)' },
  completed: { color: '#64748B', bg: 'rgba(100,116,139,0.15)' },
}

export default function ExceptionEntrancePrototype() {
  const router = useRouter()
  const [exceptions, setExceptions] = useState<MockException[]>(INITIAL)
  const [staggerMs, setStaggerMs] = useState(60)
  const [key, setKey] = useState(0)

  const replay = useCallback(() => {
    setExceptions([])
    setKey(k => k + 1)
    setTimeout(() => setExceptions(INITIAL), 50)
  }, [])

  const addException = useCallback(() => {
    const id = nextId++
    const newExc: MockException = {
      id,
      type: Math.random() > 0.5 ? 'stay_awake' : 'force_sleep',
      reason: `New exception #${id}`,
      ticketRef: `TICKET-${id}`,
      status: 'pending',
      date: 'Next Week',
      time: '00:00 – 23:59',
    }
    setExceptions(prev => [newExc, ...prev])
  }, [])

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>F9 — Exception Entrance</Typography>
          <Typography variant="body2" color="text.secondary">
            Exception blocks with staggered slide-in, layout animation, and active pulse
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', alignItems: 'center', flexWrap: 'wrap' }}>
        <Button variant="contained" size="small" startIcon={<ReplayIcon fontSize="small" />} onClick={replay}>
          Replay
        </Button>
        <Button variant="outlined" size="small" startIcon={<AddIcon fontSize="small" />} onClick={addException}>
          Add Exception
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 2, minWidth: 180 }}>
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            Stagger: {staggerMs}ms
          </Typography>
          <Slider value={staggerMs} onChange={(_, v) => setStaggerMs(v as number)} min={20} max={200} step={10} size="small" sx={{ width: 100 }} />
        </Box>
      </Box>

      <Box sx={{ p: 3, borderRadius: 2, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
        <AnimatePresence mode="popLayout">
          {exceptions.map((exc, i) => {
            const typeCfg = TYPE_CONFIG[exc.type]
            const statusCfg = STATUS_CONFIG[exc.status]
            return (
              <motion.div
                key={exc.id}
                layout
                initial={{ opacity: 0, x: -20, scale: 0.97 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.97 }}
                transition={{
                  layout: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
                  opacity: { duration: 0.3, delay: i * (staggerMs / 1000) },
                  x: { duration: 0.3, delay: i * (staggerMs / 1000), ease: [0.22, 1, 0.36, 1] },
                  scale: { duration: 0.3, delay: i * (staggerMs / 1000) },
                }}
                style={{ marginBottom: 8 }}
              >
                <Box
                  sx={{
                    p: 2, borderRadius: 2, bgcolor: typeCfg.bg, borderLeft: `3px solid ${typeCfg.border}`,
                    border: `1px solid ${typeCfg.border}`,
                    ...(exc.status === 'active' && {
                      animation: 'activePulse 3s ease-in-out infinite',
                      '@keyframes activePulse': {
                        '0%, 100%': { borderColor: typeCfg.border },
                        '50%': { borderColor: typeCfg.color, boxShadow: `0 0 8px ${typeCfg.color}30` },
                      },
                    }),
                    opacity: exc.status === 'completed' ? 0.5 : 1,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                    <Chip label={typeCfg.label} size="small" sx={{ height: 20, fontSize: 10, bgcolor: `${typeCfg.color}20`, color: typeCfg.color, fontWeight: 600 }} />
                    <Chip label={exc.status} size="small" sx={{ height: 20, fontSize: 10, bgcolor: statusCfg.bg, color: statusCfg.color }} />
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', ml: 'auto' }}>
                      {exc.ticketRef}
                    </Typography>
                  </Box>
                  <Typography variant="body2" fontWeight={500} sx={{ mb: 0.25 }}>{exc.reason}</Typography>
                  <Typography variant="caption" color="text.secondary">{exc.date} · {exc.time}</Typography>
                </Box>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {exceptions.length === 0 && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">No exceptions. Press &quot;Replay&quot; to load.</Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}
