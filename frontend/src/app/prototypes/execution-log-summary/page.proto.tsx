'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import ReplayIcon from '@mui/icons-material/Replay'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

interface WorkloadResult {
  namespace: string
  name: string
  kind: string
  action: 'scaled' | 'restored' | 'skipped' | 'error'
  replicas?: string
}

interface NodeResult {
  name: string
  action: 'drained' | 'protected' | 'error'
}

const LOG_SEQUENCE: { type: 'log' | 'workload' | 'node' | 'done'; data: string | WorkloadResult | NodeResult }[] = [
  { type: 'log', data: 'Starting scheduled sleep for policy "EU Dev Sleep"' },
  { type: 'log', data: 'Found 6 matching workloads in namespaces: dev, dev-tools' },
  { type: 'workload', data: { namespace: 'dev', name: 'api-server', kind: 'Deployment', action: 'scaled', replicas: '3 → 0' } },
  { type: 'workload', data: { namespace: 'dev', name: 'web-frontend', kind: 'Deployment', action: 'scaled', replicas: '2 → 0' } },
  { type: 'workload', data: { namespace: 'dev', name: 'worker', kind: 'Deployment', action: 'scaled', replicas: '2 → 0' } },
  { type: 'log', data: 'Slow API response from kube-apiserver (1.2s latency)' },
  { type: 'workload', data: { namespace: 'dev', name: 'redis', kind: 'StatefulSet', action: 'scaled', replicas: '1 → 0' } },
  { type: 'workload', data: { namespace: 'dev-tools', name: 'debug-pod', kind: 'Deployment', action: 'skipped', replicas: '0 → 0' } },
  { type: 'workload', data: { namespace: 'dev', name: 'event-processor', kind: 'Deployment', action: 'error' } },
  { type: 'node', data: { name: 'node-3', action: 'drained' } },
  { type: 'node', data: { name: 'node-2', action: 'protected' } },
  { type: 'log', data: 'Execution completed — 4 scaled, 1 skipped, 1 error' },
  { type: 'done', data: '' },
]

const ACTION_STYLE = {
  scaled: { color: '#7C3AED', bg: 'rgba(124,58,237,0.12)', label: 'Scaled' },
  restored: { color: '#22C55E', bg: 'rgba(34,197,94,0.12)', label: 'Restored' },
  skipped: { color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', label: 'Skipped' },
  error: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', label: 'Error' },
  drained: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', label: 'Drained' },
  protected: { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', label: 'Protected' },
}

export default function ExecutionLogSummaryPrototype() {
  const router = useRouter()
  const [items, setItems] = useState<typeof LOG_SEQUENCE>([])
  const [running, setRunning] = useState(false)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  const workloads = items.filter(i => i.type === 'workload').map(i => i.data as WorkloadResult)
  const nodes = items.filter(i => i.type === 'node').map(i => i.data as NodeResult)
  const logs = items.filter(i => i.type === 'log').map(i => i.data as string)
  const done = items.some(i => i.type === 'done')

  const reset = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
    setItems([])
    setRunning(false)
  }, [])

  const play = useCallback(() => {
    reset()
    setTimeout(() => {
      setRunning(true)
      let delay = 300
      for (const step of LOG_SEQUENCE) {
        const t = setTimeout(() => {
          setItems(prev => [...prev, step])
          if (step.type === 'done') setRunning(false)
        }, delay)
        timeoutsRef.current.push(t)
        delay += step.type === 'log' ? 400 : step.type === 'done' ? 200 : 600
      }
    }, 50)
  }, [reset])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [items])

  useEffect(() => () => timeoutsRef.current.forEach(clearTimeout), [])

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>G4 — Execution Log Summary</Typography>
          <Typography variant="body2" color="text.secondary">
            Animated workload/node summary that builds in real-time as log lines arrive
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', alignItems: 'center' }}>
        <Button variant="contained" size="small" startIcon={<PlayArrowIcon fontSize="small" />} onClick={play} disabled={running}>
          Play Execution
        </Button>
        <Button variant="outlined" size="small" startIcon={<ReplayIcon fontSize="small" />} onClick={reset}>Reset</Button>
        {running && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, ml: 'auto' }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#F59E0B', animation: 'esDot 1s ease-in-out infinite', '@keyframes esDot': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } } }} />
            <Typography variant="caption" color="text.secondary">Streaming...</Typography>
          </Box>
        )}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        {/* Summary panel */}
        <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Workloads ({workloads.length})
          </Typography>
          <AnimatePresence>
            {workloads.map((w, i) => {
              const style = ACTION_STYLE[w.action]
              return (
                <motion.div
                  key={`${w.namespace}/${w.name}`}
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  style={{ marginBottom: 6 }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 11, flex: 1 }}>
                      {w.namespace}/{w.name}
                    </Typography>
                    <Chip label={w.kind} size="small" sx={{ height: 16, fontSize: 9, bgcolor: 'rgba(124,58,237,0.08)', color: '#7C3AED' }} />
                    <Chip label={w.replicas ?? style.label} size="small" sx={{ height: 16, fontSize: 9, bgcolor: style.bg, color: style.color, fontWeight: 600 }} />
                  </Box>
                </motion.div>
              )
            })}
          </AnimatePresence>

          {nodes.length > 0 && (
            <>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2, mb: 1, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Nodes ({nodes.length})
              </Typography>
              <AnimatePresence>
                {nodes.map(n => {
                  const style = ACTION_STYLE[n.action]
                  return (
                    <motion.div
                      key={n.name}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      style={{ marginBottom: 6 }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 11, flex: 1 }}>{n.name}</Typography>
                        <Chip label={style.label} size="small" sx={{ height: 16, fontSize: 9, bgcolor: style.bg, color: style.color, fontWeight: 600 }} />
                      </Box>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </>
          )}

          {done && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
              <Box sx={{ mt: 2, p: 1.5, borderRadius: 1.5, bgcolor: 'rgba(34,197,94,0.08)', border: '1px solid', borderColor: 'rgba(34,197,94,0.2)' }}>
                <Typography variant="caption" sx={{ color: '#22C55E', fontWeight: 600 }}>
                  Complete — {workloads.filter(w => w.action === 'scaled').length} scaled, {workloads.filter(w => w.action === 'skipped').length} skipped, {workloads.filter(w => w.action === 'error').length} errors
                </Typography>
              </Box>
            </motion.div>
          )}

          {items.length === 0 && (
            <Typography variant="caption" color="text.secondary">Press &quot;Play Execution&quot; to start</Typography>
          )}
        </Box>

        {/* Log feed */}
        <Box
          ref={scrollRef}
          sx={{
            p: 1.5, borderRadius: 2, bgcolor: '#0A0A0F', border: '1px solid', borderColor: 'divider',
            fontFamily: 'monospace', fontSize: 12, lineHeight: 1.8, maxHeight: 400, overflow: 'auto',
            '&::-webkit-scrollbar': { width: 4 },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 2 },
          }}
        >
          {logs.length === 0 && <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'inherit' }}>Waiting for log lines...</Typography>}
          {logs.map((line, i) => (
            <Box key={i} sx={{
              animation: 'esLogIn 200ms ease-out',
              '@keyframes esLogIn': { from: { opacity: 0, transform: 'translateX(8px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
              color: line.includes('error') || line.includes('Error') ? '#F87171' : line.includes('completed') ? '#86efac' : line.includes('Slow') ? '#FBBF24' : 'inherit',
            }}>
              {line}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}
