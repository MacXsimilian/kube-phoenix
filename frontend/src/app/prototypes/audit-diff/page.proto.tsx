'use client'

import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ReplayIcon from '@mui/icons-material/Replay'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

interface DiffField {
  key: string
  type: 'added' | 'removed' | 'changed' | 'unchanged'
  oldValue?: string
  newValue?: string
}

const MOCK_DIFFS: { title: string; fields: DiffField[] }[] = [
  {
    title: 'policy.update — EU Dev Sleep',
    fields: [
      { key: 'mode', type: 'changed', oldValue: 'plan', newValue: 'apply' },
      { key: 'timeoutMinutes', type: 'changed', oldValue: '10', newValue: '15' },
      { key: 'namespaceFilter', type: 'unchanged', newValue: 'dev,dev-*' },
      { key: 'enabled', type: 'unchanged', newValue: 'true' },
      { key: 'labelSelector', type: 'added', newValue: 'cost-tier=standard' },
    ],
  },
  {
    title: 'guardrail.update',
    fields: [
      { key: 'protectCriticalPodNodes', type: 'changed', oldValue: 'false', newValue: 'true' },
      { key: 'scalingConcurrency', type: 'changed', oldValue: '3', newValue: '5' },
      { key: 'systemNamespaces', type: 'unchanged', newValue: 'kube-system,kube-node-lease' },
      { key: 'wakeWaveSize', type: 'added', newValue: '10' },
      { key: 'skipNsNode', type: 'removed', oldValue: 'monitoring' },
    ],
  },
]

const TYPE_COLORS = {
  added: { bg: 'rgba(34,197,94,0.08)', border: '#22C55E', label: 'Added', labelBg: 'rgba(34,197,94,0.15)' },
  removed: { bg: 'rgba(239,68,68,0.08)', border: '#EF4444', label: 'Removed', labelBg: 'rgba(239,68,68,0.15)' },
  changed: { bg: 'rgba(245,158,11,0.08)', border: '#F59E0B', label: 'Changed', labelBg: 'rgba(245,158,11,0.15)' },
  unchanged: { bg: 'transparent', border: 'transparent', label: '', labelBg: 'transparent' },
}

function DiffRow({ field, index }: { field: DiffField; index: number }) {
  const cfg = TYPE_COLORS[field.type]
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
    >
      <Box
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.5, py: 1, px: 1.5, borderRadius: 1.5,
          bgcolor: cfg.bg, borderLeft: `3px solid ${cfg.border}`,
          mb: 0.5,
        }}
      >
        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, minWidth: 180 }}>
          {field.key}
        </Typography>

        {field.type === 'changed' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
            <motion.div
              initial={{ opacity: 1, x: 0 }}
              animate={{ opacity: 0.4, x: -8 }}
              transition={{ duration: 0.4, delay: index * 0.06 + 0.2 }}
            >
              <Typography
                variant="body2"
                sx={{ fontFamily: 'monospace', fontSize: 12, color: '#EF4444', textDecoration: 'line-through' }}
              >
                {field.oldValue}
              </Typography>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: index * 0.06 + 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12, color: '#22C55E', fontWeight: 600 }}>
                {field.newValue}
              </Typography>
            </motion.div>
          </Box>
        )}

        {field.type === 'added' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: index * 0.06 + 0.2 }}
            style={{ flex: 1 }}
          >
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12, color: '#22C55E' }}>
              {field.newValue}
            </Typography>
          </motion.div>
        )}

        {field.type === 'removed' && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 0.4 }}
            transition={{ duration: 0.5, delay: index * 0.06 + 0.2 }}
            style={{ flex: 1 }}
          >
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12, color: '#EF4444', textDecoration: 'line-through' }}>
              {field.oldValue}
            </Typography>
          </motion.div>
        )}

        {field.type === 'unchanged' && (
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12, color: 'text.secondary', flex: 1 }}>
            {field.newValue}
          </Typography>
        )}

        {cfg.label && (
          <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 600, color: cfg.border, bgcolor: cfg.labelBg, px: 0.75, py: 0.15, borderRadius: 0.5 }}>
            {cfg.label}
          </Typography>
        )}
      </Box>
    </motion.div>
  )
}

export default function AuditDiffPrototype() {
  const router = useRouter()
  const [key, setKey] = useState(0)
  const [activeDiff, setActiveDiff] = useState(0)

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>F11 — Audit Diff</Typography>
          <Typography variant="body2" color="text.secondary">
            Field-level before/after diff with staggered slide animations
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', alignItems: 'center', flexWrap: 'wrap' }}>
        <Button variant="contained" size="small" startIcon={<ReplayIcon fontSize="small" />} onClick={() => setKey(k => k + 1)}>
          Replay
        </Button>
        {MOCK_DIFFS.map((d, i) => (
          <Button
            key={i}
            variant={activeDiff === i ? 'contained' : 'outlined'}
            size="small"
            onClick={() => { setActiveDiff(i); setKey(k => k + 1) }}
            sx={{ fontSize: 11 }}
          >
            {d.title}
          </Button>
        ))}
      </Box>

      <Box sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={600}>{MOCK_DIFFS[activeDiff].title}</Typography>
          <Typography variant="caption" color="text.secondary">admin · 2h ago · 192.168.1.42</Typography>
        </Box>

        {/* Column headers */}
        <Box sx={{ display: 'flex', gap: 1.5, px: 1.5, mb: 1 }}>
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10, fontWeight: 700, minWidth: 180, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Field
          </Typography>
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10, fontWeight: 700, flex: 1, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Value
          </Typography>
        </Box>

        <AnimatePresence mode="wait">
          <motion.div key={`${activeDiff}-${key}`}>
            {MOCK_DIFFS[activeDiff].fields.map((field, i) => (
              <DiffRow key={field.key} field={field} index={i} />
            ))}
          </motion.div>
        </AnimatePresence>
      </Box>
    </Box>
  )
}
