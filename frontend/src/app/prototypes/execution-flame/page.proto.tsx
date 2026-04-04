'use client'

import { useState, useEffect, useRef } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ReplayIcon from '@mui/icons-material/Replay'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

interface FlameSpan {
  id: string
  label: string
  start: number
  duration: number
  level: number
  color: string
  status: 'ok' | 'warn' | 'error'
}

const TOTAL_DURATION = 45

const MOCK_SPANS: FlameSpan[] = [
  { id: 'root', label: 'Sleep Execution #8', start: 0, duration: 45, level: 0, color: '#7C3AED', status: 'ok' },
  { id: 'validate', label: 'Validate guardrails', start: 0, duration: 3, level: 1, color: '#3B82F6', status: 'ok' },
  { id: 'scale-ns-dev', label: 'Scale namespace: dev', start: 3, duration: 18, level: 1, color: '#22C55E', status: 'ok' },
  { id: 'api-server', label: 'dev/api-server 3→0', start: 3, duration: 5, level: 2, color: '#22C55E', status: 'ok' },
  { id: 'web-fe', label: 'dev/web-frontend 2→0', start: 8, duration: 4, level: 2, color: '#22C55E', status: 'ok' },
  { id: 'worker', label: 'dev/worker 2→0', start: 12, duration: 4, level: 2, color: '#22C55E', status: 'ok' },
  { id: 'redis', label: 'dev/redis 1→0', start: 16, duration: 5, level: 2, color: '#F59E0B', status: 'warn' },
  { id: 'redis-retry', label: 'retry (timeout)', start: 18, duration: 3, level: 3, color: '#F59E0B', status: 'warn' },
  { id: 'scale-ns-stg', label: 'Scale namespace: staging', start: 21, duration: 14, level: 1, color: '#22D3EE', status: 'ok' },
  { id: 'checkout', label: 'staging/checkout-svc 2→0', start: 21, duration: 4, level: 2, color: '#22D3EE', status: 'ok' },
  { id: 'product', label: 'staging/product-api 3→0', start: 25, duration: 5, level: 2, color: '#22D3EE', status: 'ok' },
  { id: 'cart', label: 'staging/cart-svc 2→0', start: 30, duration: 3, level: 2, color: '#22D3EE', status: 'ok' },
  { id: 'postgres', label: 'staging/postgres 1→0', start: 33, duration: 2, level: 2, color: '#22D3EE', status: 'ok' },
  { id: 'drain', label: 'Drain node-3', start: 35, duration: 7, level: 1, color: '#F59E0B', status: 'ok' },
  { id: 'cordon', label: 'Cordon node-3', start: 35, duration: 2, level: 2, color: '#F59E0B', status: 'ok' },
  { id: 'evict', label: 'Evict pods', start: 37, duration: 5, level: 2, color: '#F59E0B', status: 'ok' },
  { id: 'verify', label: 'Verify completion', start: 42, duration: 3, level: 1, color: '#3B82F6', status: 'ok' },
]

const STATUS_BORDER = { ok: 'transparent', warn: '#F59E0B', error: '#EF4444' }

export default function ExecutionFlamePrototype() {
  const router = useRouter()
  const [key, setKey] = useState(0)
  const [hoveredSpan, setHoveredSpan] = useState<string | null>(null)

  const maxLevel = Math.max(...MOCK_SPANS.map(s => s.level))
  const rowHeight = 32
  const totalHeight = (maxLevel + 1) * (rowHeight + 4) + 40

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>H5 — Execution Flame</Typography>
          <Typography variant="body2" color="text.secondary">
            Flame graph of a sleep execution — each span shows a scaling operation with timing
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', alignItems: 'center' }}>
        <Button variant="contained" size="small" startIcon={<ReplayIcon fontSize="small" />} onClick={() => setKey(k => k + 1)}>Replay</Button>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          Total: {TOTAL_DURATION}s · {MOCK_SPANS.length} spans · Hover for details
        </Typography>
      </Box>

      {/* Time axis */}
      <Box sx={{ px: 2, mb: 0.5, display: 'flex' }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <Typography key={i} variant="caption" sx={{ flex: 1, color: 'text.disabled', fontSize: 10, fontFamily: 'monospace' }}>
            {Math.round((i / 9) * TOTAL_DURATION)}s
          </Typography>
        ))}
      </Box>

      {/* Flame chart */}
      <Box
        sx={{
          position: 'relative', height: totalHeight, borderRadius: 2, bgcolor: 'background.paper',
          border: '1px solid', borderColor: 'divider', overflow: 'hidden', p: 2,
        }}
      >
        {/* Grid lines */}
        {Array.from({ length: 10 }).map((_, i) => (
          <Box key={i} sx={{ position: 'absolute', left: `${(i / 9) * 100}%`, top: 0, bottom: 0, width: 1, bgcolor: 'rgba(255,255,255,0.03)' }} />
        ))}

        <AnimatePresence>
          {MOCK_SPANS.map((span, i) => {
            const leftPct = (span.start / TOTAL_DURATION) * 100
            const widthPct = (span.duration / TOTAL_DURATION) * 100
            const top = span.level * (rowHeight + 4)
            const isHovered = hoveredSpan === span.id

            return (
              <motion.div
                key={`${span.id}-${key}`}
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ duration: 0.4, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  position: 'absolute',
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  top,
                  height: rowHeight,
                  transformOrigin: 'left center',
                }}
                onMouseEnter={() => setHoveredSpan(span.id)}
                onMouseLeave={() => setHoveredSpan(null)}
              >
                <Box
                  sx={{
                    height: '100%', borderRadius: 1, bgcolor: `${span.color}${isHovered ? 'DD' : '90'}`,
                    border: `1px solid ${STATUS_BORDER[span.status] || span.color}40`,
                    display: 'flex', alignItems: 'center', px: 0.75, overflow: 'hidden',
                    cursor: 'pointer', transition: 'background-color 150ms ease',
                    ...(span.status === 'warn' && { borderLeftWidth: 3, borderLeftColor: '#F59E0B' }),
                    ...(span.status === 'error' && { borderLeftWidth: 3, borderLeftColor: '#EF4444' }),
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: 10, fontFamily: 'monospace', color: '#E2E8F0', whiteSpace: 'nowrap',
                      overflow: 'hidden', textOverflow: 'ellipsis',
                    }}
                  >
                    {span.label} ({span.duration}s)
                  </Typography>
                </Box>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </Box>

      {/* Tooltip */}
      {hoveredSpan && (() => {
        const span = MOCK_SPANS.find(s => s.id === hoveredSpan)
        if (!span) return null
        return (
          <Box sx={{ mt: 2, p: 1.5, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', display: 'flex', gap: 2 }}>
            <Box sx={{ width: 4, borderRadius: 1, bgcolor: span.color }} />
            <Box>
              <Typography variant="body2" fontWeight={600}>{span.label}</Typography>
              <Typography variant="caption" color="text.secondary">
                Start: {span.start}s · Duration: {span.duration}s · End: {span.start + span.duration}s
                {span.status !== 'ok' && ` · ${span.status.toUpperCase()}`}
              </Typography>
            </Box>
          </Box>
        )
      })()}
    </Box>
  )
}
