'use client'

import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

interface PolicyVersion {
  name: string
  mode: string
  timezone: string
  namespaceFilter: string
  timeout: number
  sleepWindows: { name: string; days: string; start: string; end: string }[]
  guardrails: { protectCritical: boolean; concurrency: number; waveSize: number }
}

const BEFORE: PolicyVersion = {
  name: 'EU Dev Sleep',
  mode: 'plan',
  timezone: 'UTC',
  namespaceFilter: 'dev',
  timeout: 10,
  sleepWindows: [
    { name: 'Weeknight', days: 'Mon–Fri', start: '20:00', end: '07:00' },
  ],
  guardrails: { protectCritical: false, concurrency: 3, waveSize: 0 },
}

const AFTER: PolicyVersion = {
  name: 'EU Dev Sleep',
  mode: 'apply',
  timezone: 'Europe/Berlin',
  namespaceFilter: 'dev,dev-*',
  timeout: 15,
  sleepWindows: [
    { name: 'Weeknight', days: 'Mon–Fri', start: '20:00', end: '07:00' },
    { name: 'Weekend', days: 'Sat–Sun', start: '00:00', end: '23:59' },
  ],
  guardrails: { protectCritical: true, concurrency: 5, waveSize: 10 },
}

type DiffType = 'unchanged' | 'changed' | 'added' | 'removed'

interface DiffRow {
  field: string
  before: string
  after: string
  type: DiffType
}

function computeDiffs(): DiffRow[] {
  const diffs: DiffRow[] = []
  const addDiff = (field: string, before: string, after: string) => {
    if (before === after) diffs.push({ field, before, after, type: 'unchanged' })
    else if (!before) diffs.push({ field, before, after, type: 'added' })
    else if (!after) diffs.push({ field, before, after, type: 'removed' })
    else diffs.push({ field, before, after, type: 'changed' })
  }
  addDiff('mode', BEFORE.mode, AFTER.mode)
  addDiff('timezone', BEFORE.timezone, AFTER.timezone)
  addDiff('namespaceFilter', BEFORE.namespaceFilter, AFTER.namespaceFilter)
  addDiff('timeoutMinutes', String(BEFORE.timeout), String(AFTER.timeout))
  addDiff('sleepWindows count', String(BEFORE.sleepWindows.length), String(AFTER.sleepWindows.length))
  addDiff('Weekend window', '', 'Sat–Sun 00:00–23:59')
  addDiff('protectCriticalPodNodes', String(BEFORE.guardrails.protectCritical), String(AFTER.guardrails.protectCritical))
  addDiff('scalingConcurrency', String(BEFORE.guardrails.concurrency), String(AFTER.guardrails.concurrency))
  addDiff('wakeWaveSize', String(BEFORE.guardrails.waveSize), String(AFTER.guardrails.waveSize))
  return diffs
}

const TYPE_COLORS: Record<DiffType, { bg: string; border: string; label: string }> = {
  unchanged: { bg: 'transparent', border: 'transparent', label: '' },
  changed: { bg: 'rgba(245,158,11,0.06)', border: '#F59E0B', label: 'Changed' },
  added: { bg: 'rgba(34,197,94,0.06)', border: '#22C55E', label: 'Added' },
  removed: { bg: 'rgba(239,68,68,0.06)', border: '#EF4444', label: 'Removed' },
}

export default function PolicyCompareDiffPrototype() {
  const router = useRouter()
  const [showDiff, setShowDiff] = useState(false)
  const [key, setKey] = useState(0)
  const diffs = computeDiffs()

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>H8 — Policy Compare</Typography>
          <Typography variant="body2" color="text.secondary">
            Side-by-side policy diff with animated field highlighting and before/after comparison
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider' }}>
        <Button variant="contained" size="small" startIcon={<SwapHorizIcon fontSize="small" />} onClick={() => { setShowDiff(true); setKey(k => k + 1) }}>
          Show Diff
        </Button>
      </Box>

      {/* Side-by-side headers */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
        <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(239,68,68,0.04)', border: '1px solid', borderColor: 'rgba(239,68,68,0.15)' }}>
          <Typography variant="caption" sx={{ color: '#EF4444', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>Before</Typography>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mt: 0.5 }}>{BEFORE.name}</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
            <Chip label={BEFORE.mode.toUpperCase()} size="small" sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(59,130,246,0.15)', color: '#3B82F6' }} />
            <Chip label={BEFORE.timezone} size="small" sx={{ height: 18, fontSize: 10 }} />
          </Box>
        </Box>
        <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(34,197,94,0.04)', border: '1px solid', borderColor: 'rgba(34,197,94,0.15)' }}>
          <Typography variant="caption" sx={{ color: '#22C55E', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>After</Typography>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mt: 0.5 }}>{AFTER.name}</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
            <Chip label={AFTER.mode.toUpperCase()} size="small" sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(245,158,11,0.15)', color: '#F59E0B' }} />
            <Chip label={AFTER.timezone} size="small" sx={{ height: 18, fontSize: 10 }} />
          </Box>
        </Box>
      </Box>

      {/* Diff table */}
      <AnimatePresence>
        {showDiff && (
          <motion.div key={key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            <Box sx={{ borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
              {/* Header */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr 80px', px: 2, py: 1, bgcolor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', fontSize: 10, textTransform: 'uppercase' }}>Field</Typography>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#EF4444', fontSize: 10, textTransform: 'uppercase' }}>Before</Typography>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#22C55E', fontSize: 10, textTransform: 'uppercase' }}>After</Typography>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', fontSize: 10, textTransform: 'uppercase', textAlign: 'right' }}>Status</Typography>
              </Box>

              {diffs.map((diff, i) => {
                const cfg = TYPE_COLORS[diff.type]
                return (
                  <motion.div
                    key={diff.field}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <Box sx={{
                      display: 'grid', gridTemplateColumns: '160px 1fr 1fr 80px', px: 2, py: 1,
                      bgcolor: cfg.bg, borderLeft: `3px solid ${cfg.border}`,
                      borderBottom: '1px solid', borderColor: 'divider',
                    }}>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600 }}>{diff.field}</Typography>
                      <Typography variant="caption" sx={{
                        fontFamily: 'monospace', fontSize: 11,
                        color: diff.type === 'changed' || diff.type === 'removed' ? '#EF4444' : 'text.secondary',
                        textDecoration: diff.type === 'changed' ? 'line-through' : 'none',
                      }}>
                        {diff.before || '—'}
                      </Typography>
                      <Typography variant="caption" sx={{
                        fontFamily: 'monospace', fontSize: 11,
                        color: diff.type === 'changed' || diff.type === 'added' ? '#22C55E' : 'text.secondary',
                        fontWeight: diff.type !== 'unchanged' ? 600 : 400,
                      }}>
                        {diff.after || '—'}
                      </Typography>
                      <Box sx={{ textAlign: 'right' }}>
                        {cfg.label && <Chip label={cfg.label} size="small" sx={{ height: 16, fontSize: 9, bgcolor: `${cfg.border}18`, color: cfg.border }} />}
                      </Box>
                    </Box>
                  </motion.div>
                )
              })}
            </Box>

            {/* Summary */}
            <Box sx={{ display: 'flex', gap: 1.5, mt: 2, justifyContent: 'center' }}>
              <Chip label={`${diffs.filter(d => d.type === 'changed').length} changed`} size="small" sx={{ bgcolor: 'rgba(245,158,11,0.12)', color: '#F59E0B' }} />
              <Chip label={`${diffs.filter(d => d.type === 'added').length} added`} size="small" sx={{ bgcolor: 'rgba(34,197,94,0.12)', color: '#22C55E' }} />
              <Chip label={`${diffs.filter(d => d.type === 'unchanged').length} unchanged`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.06)' }} />
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  )
}
