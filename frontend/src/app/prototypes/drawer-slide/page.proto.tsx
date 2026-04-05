'use client'

import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import LinearProgress from '@mui/material/LinearProgress'
import Slider from '@mui/material/Slider'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CloseIcon from '@mui/icons-material/Close'
import TerminalIcon from '@mui/icons-material/Terminal'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

const DRAWER_WIDTH = 540

const STAGGER = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
}

const FADE_UP = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const } },
}

interface MockPod {
  name: string
  status: string
  ready: string
  cpu: string
  mem: string
  age: string
}

interface MockWorkload {
  name: string
  namespace: string
  kind: string
  status: string
  statusColor: string
  statusBg: string
  currentReplicas: number
  readyReplicas: number
  savedReplicas: number | null
  pods: MockPod[]
}

const STATUS_STYLES = {
  Running: { color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  Sleeping: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  Partial: { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
} as const

const WORKLOAD_DEFS: { name: string; ns: string; kind: string; status: keyof typeof STATUS_STYLES; cur: number; ready: number; saved: number | null; podStatuses: string[] }[] = [
  { name: 'api-server', ns: 'team-backend', kind: 'Deployment', status: 'Running', cur: 3, ready: 3, saved: null, podStatuses: ['Running', 'Running', 'CrashLoopBackOff'] },
  { name: 'web-frontend', ns: 'team-web', kind: 'Deployment', status: 'Running', cur: 2, ready: 2, saved: null, podStatuses: ['Running', 'Running'] },
  { name: 'checkout-svc', ns: 'staging', kind: 'Deployment', status: 'Sleeping', cur: 0, ready: 0, saved: 3, podStatuses: [] },
  { name: 'redis', ns: 'team-backend', kind: 'StatefulSet', status: 'Running', cur: 3, ready: 3, saved: null, podStatuses: ['Running', 'Running', 'Running'] },
  { name: 'event-processor', ns: 'team-data', kind: 'Deployment', status: 'Partial', cur: 3, ready: 1, saved: null, podStatuses: ['Running', 'Pending', 'Failed'] },
  { name: 'payment-gateway', ns: 'team-payments', kind: 'Deployment', status: 'Running', cur: 4, ready: 4, saved: null, podStatuses: ['Running', 'Running', 'Running', 'Running'] },
  { name: 'ml-training-job', ns: 'team-ml', kind: 'Deployment', status: 'Sleeping', cur: 0, ready: 0, saved: 8, podStatuses: [] },
  { name: 'notification-worker', ns: 'team-backend', kind: 'Deployment', status: 'Running', cur: 2, ready: 2, saved: null, podStatuses: ['Running', 'Running'] },
  { name: 'postgres', ns: 'team-data', kind: 'StatefulSet', status: 'Running', cur: 2, ready: 2, saved: null, podStatuses: ['Running', 'Running'] },
  { name: 'grafana', ns: 'monitoring', kind: 'Deployment', status: 'Sleeping', cur: 0, ready: 0, saved: 1, podStatuses: [] },
  { name: 'mobile-bff', ns: 'team-mobile', kind: 'Deployment', status: 'Partial', cur: 3, ready: 2, saved: null, podStatuses: ['Running', 'Running', 'Pending'] },
  { name: 'load-generator', ns: 'staging-perf', kind: 'Deployment', status: 'Sleeping', cur: 0, ready: 0, saved: 5, podStatuses: [] },
  { name: 'search-indexer', ns: 'team-platform', kind: 'Deployment', status: 'Running', cur: 1, ready: 1, saved: null, podStatuses: ['Running'] },
  { name: 'ci-runner', ns: 'team-infra', kind: 'StatefulSet', status: 'Running', cur: 3, ready: 3, saved: null, podStatuses: ['Running', 'Running', 'Running'] },
  { name: 'auth-proxy', ns: 'team-backend', kind: 'Deployment', status: 'Running', cur: 2, ready: 2, saved: null, podStatuses: ['Running', 'Running'] },
  { name: 'cart-service', ns: 'staging', kind: 'Deployment', status: 'Sleeping', cur: 0, ready: 0, saved: 2, podStatuses: [] },
  { name: 'product-api', ns: 'staging', kind: 'Deployment', status: 'Sleeping', cur: 0, ready: 0, saved: 3, podStatuses: [] },
  { name: 'order-processor', ns: 'team-payments', kind: 'Deployment', status: 'Running', cur: 3, ready: 3, saved: null, podStatuses: ['Running', 'Running', 'Running'] },
  { name: 'email-sender', ns: 'team-backend', kind: 'Deployment', status: 'Running', cur: 1, ready: 1, saved: null, podStatuses: ['Running'] },
  { name: 'prometheus', ns: 'monitoring', kind: 'StatefulSet', status: 'Running', cur: 2, ready: 2, saved: null, podStatuses: ['Running', 'Running'] },
  { name: 'alertmanager', ns: 'monitoring', kind: 'StatefulSet', status: 'Running', cur: 1, ready: 1, saved: null, podStatuses: ['Running'] },
  { name: 'loki', ns: 'monitoring', kind: 'StatefulSet', status: 'Sleeping', cur: 0, ready: 0, saved: 2, podStatuses: [] },
  { name: 'recommendation-engine', ns: 'team-ml', kind: 'Deployment', status: 'Partial', cur: 4, ready: 2, saved: null, podStatuses: ['Running', 'Running', 'CrashLoopBackOff', 'Pending'] },
  { name: 'data-pipeline', ns: 'team-data', kind: 'Deployment', status: 'Running', cur: 5, ready: 5, saved: null, podStatuses: ['Running', 'Running', 'Running', 'Running', 'Running'] },
  { name: 'cdn-purge-worker', ns: 'team-web', kind: 'Deployment', status: 'Running', cur: 1, ready: 1, saved: null, podStatuses: ['Running'] },
  { name: 'debug-tools', ns: 'team-platform', kind: 'Deployment', status: 'Sleeping', cur: 0, ready: 0, saved: 1, podStatuses: [] },
  { name: 'vault', ns: 'team-infra', kind: 'StatefulSet', status: 'Running', cur: 3, ready: 3, saved: null, podStatuses: ['Running', 'Running', 'Running'] },
  { name: 'kafka', ns: 'team-data', kind: 'StatefulSet', status: 'Running', cur: 3, ready: 3, saved: null, podStatuses: ['Running', 'Running', 'Running'] },
  { name: 'zookeeper', ns: 'team-data', kind: 'StatefulSet', status: 'Running', cur: 3, ready: 3, saved: null, podStatuses: ['Running', 'Running', 'Running'] },
  { name: 'feature-flag-svc', ns: 'team-platform', kind: 'Deployment', status: 'Running', cur: 2, ready: 2, saved: null, podStatuses: ['Running', 'Running'] },
  { name: 'image-resizer', ns: 'team-web', kind: 'Deployment', status: 'Sleeping', cur: 0, ready: 0, saved: 2, podStatuses: [] },
  { name: 'invoice-generator', ns: 'team-payments', kind: 'Deployment', status: 'Running', cur: 1, ready: 1, saved: null, podStatuses: ['Running'] },
  { name: 'cron-scheduler', ns: 'team-infra', kind: 'Deployment', status: 'Running', cur: 1, ready: 1, saved: null, podStatuses: ['Running'] },
  { name: 'model-serving', ns: 'team-ml', kind: 'Deployment', status: 'Sleeping', cur: 0, ready: 0, saved: 4, podStatuses: [] },
  { name: 'user-profile-svc', ns: 'team-backend', kind: 'Deployment', status: 'Running', cur: 2, ready: 2, saved: null, podStatuses: ['Running', 'Running'] },
  { name: 'session-store', ns: 'team-backend', kind: 'StatefulSet', status: 'Running', cur: 1, ready: 1, saved: null, podStatuses: ['Running'] },
  { name: 'analytics-ingester', ns: 'team-data', kind: 'Deployment', status: 'Partial', cur: 2, ready: 1, saved: null, podStatuses: ['Running', 'Failed'] },
  { name: 'ab-test-router', ns: 'team-platform', kind: 'Deployment', status: 'Running', cur: 2, ready: 2, saved: null, podStatuses: ['Running', 'Running'] },
  { name: 'sms-gateway', ns: 'team-backend', kind: 'Deployment', status: 'Sleeping', cur: 0, ready: 0, saved: 1, podStatuses: [] },
  { name: 'perf-baseline', ns: 'staging-perf', kind: 'Deployment', status: 'Sleeping', cur: 0, ready: 0, saved: 3, podStatuses: [] },
]

const HASH_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'
function fakeHash(seed: number): string {
  let h = ''
  let s = seed
  for (let i = 0; i < 5; i++) { h += HASH_CHARS[s % HASH_CHARS.length]; s = (s * 7 + 13) % 997 }
  return h
}

const AGES = ['30s', '2m', '15m', '1h', '3h', '6h', '12h', '1d', '2d', '3d', '5d', '7d', '14d']
const CPUS = ['15m', '30m', '50m', '75m', '90m', '120m', '180m', '250m', '350m', '500m']
const MEMS = ['64Mi', '120Mi', '180Mi', '256Mi', '380Mi', '512Mi', '650Mi', '980Mi', '1.2Gi', '2.0Gi']

const WORKLOADS: MockWorkload[] = WORKLOAD_DEFS.map((d, wi) => ({
  name: d.name,
  namespace: d.ns,
  kind: d.kind,
  status: d.status,
  statusColor: STATUS_STYLES[d.status].color,
  statusBg: STATUS_STYLES[d.status].bg,
  currentReplicas: d.cur,
  readyReplicas: d.ready,
  savedReplicas: d.saved,
  pods: d.podStatuses.map((ps, pi) => {
    const isStatefulSet = d.kind === 'StatefulSet'
    const podName = isStatefulSet ? `${d.name}-${pi}` : `${d.name}-${fakeHash(wi * 100 + pi)}-${fakeHash(wi * 200 + pi + 50)}`
    const isDown = ps !== 'Running'
    return {
      name: podName,
      status: ps,
      ready: isDown ? '0/1' : '1/1',
      cpu: isDown ? '—' : CPUS[(wi * 3 + pi * 7) % CPUS.length],
      mem: isDown ? '—' : MEMS[(wi * 5 + pi * 3) % MEMS.length],
      age: AGES[(wi + pi * 4) % AGES.length],
    }
  }),
}))

const POD_DOT_COLORS: Record<string, string> = {
  Running: '#22C55E',
  Pending: '#F59E0B',
  Failed: '#EF4444',
  CrashLoopBackOff: '#EF4444',
  Succeeded: '#94A3B8',
  Terminating: '#94A3B8',
}

function PodDot({ status }: { status: string }) {
  const color = POD_DOT_COLORS[status] ?? '#94A3B8'
  const isCrash = status === 'CrashLoopBackOff'
  const isPending = status === 'Pending'
  return (
    <Box sx={{ position: 'relative', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {isCrash && (
        <Box sx={{
          position: 'absolute', width: 10, height: 10, borderRadius: '50%', border: `1px solid ${color}`,
          animation: 'protoRing 1s ease-out infinite',
          '@keyframes protoRing': { '0%': { transform: 'scale(1)', opacity: 0.5 }, '100%': { transform: 'scale(2)', opacity: 0 } },
        }} />
      )}
      <Box sx={{
        width: 8, height: 8, borderRadius: '50%', bgcolor: color, boxShadow: `0 0 5px ${color}80`, zIndex: 1,
        ...(isPending && {
          animation: 'protoBreathe 2s ease-in-out infinite',
          '@keyframes protoBreathe': { '0%,100%': { opacity: 1, transform: 'scale(1)' }, '50%': { opacity: 0.35, transform: 'scale(0.8)' } },
        }),
        ...(isCrash && {
          animation: 'protoArrhythmia 1s ease-in-out infinite',
          '@keyframes protoArrhythmia': {
            '0%': { opacity: 1, transform: 'scale(1)' }, '10%': { opacity: 0.2, transform: 'scale(0.7)' },
            '20%': { opacity: 1, transform: 'scale(1.1)' }, '30%': { opacity: 0.2, transform: 'scale(0.7)' },
            '40%': { opacity: 1, transform: 'scale(1)' }, '100%': { opacity: 0.5 },
          },
        }),
      }} />
    </Box>
  )
}

function ReplicaBar({ ready, current, saved }: { ready: number; current: number; saved: number | null }) {
  const total = saved ?? current
  const pctVal = total > 0 ? Math.round((ready / total) * 100) : 0
  const color = pctVal >= 100 ? '#22C55E' : pctVal > 0 ? '#F59E0B' : '#EF4444'
  return (
    <Box sx={{ minWidth: 120, mt: 1.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
        <Typography variant="caption" sx={{ color, fontWeight: 600, fontSize: 11 }}>
          {ready}/{current} ready
        </Typography>
        {saved !== null && (
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11 }}>saved: {saved}</Typography>
        )}
      </Box>
      <LinearProgress
        variant="determinate"
        value={Math.min(pctVal, 100)}
        sx={{ height: 4, borderRadius: 1, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 1 } }}
      />
    </Box>
  )
}

function DrawerContent({ workload, onBack }: { workload: MockWorkload; onBack: () => void }) {
  const [search, setSearch] = useState('')
  const [selectedPod, setSelectedPod] = useState<MockPod | null>(null)

  const filtered = search
    ? workload.pods.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : workload.pods

  if (selectedPod) {
    return (
      <motion.div variants={STAGGER} initial="hidden" animate="visible" key={selectedPod.name}>
        {/* Pod detail header */}
        <Box sx={{ px: 2.5, pt: 2.5, pb: 2 }}>
          <motion.div variants={FADE_UP}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <Tooltip title={`Back to ${workload.name}`}>
                  <IconButton size="small" onClick={() => setSelectedPod(null)} sx={{ mt: -0.25 }}>
                    <ArrowBackIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <Box>
                  <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11, display: 'block', mb: 0.25 }}>
                    {workload.name}
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 13, lineHeight: 1.4 }}>
                    {selectedPod.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>{workload.namespace}</Typography>
                </Box>
              </Box>
              <IconButton size="small" onClick={onBack}><CloseIcon sx={{ fontSize: 18 }} /></IconButton>
            </Box>
          </motion.div>
        </Box>
        <Divider />

        {/* Mock pod detail content */}
        <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <motion.div variants={FADE_UP}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {/* Lifecycle indicator */}
              <Box sx={{ position: 'relative', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {selectedPod.status === 'CrashLoopBackOff' && [0, 1, 2].map(i => (
                  <Box key={i} sx={{
                    position: 'absolute', width: 20, height: 20, borderRadius: '50%', border: `1.5px solid ${POD_DOT_COLORS[selectedPod.status]}`,
                    animation: `detailRing 1s ease-out infinite ${i * 0.33}s`,
                    '@keyframes detailRing': { '0%': { transform: 'scale(1)', opacity: 0.6 }, '100%': { transform: 'scale(2.4)', opacity: 0 } },
                  }} />
                ))}
                {selectedPod.status === 'CrashLoopBackOff' && (
                  <Typography sx={{
                    position: 'absolute', top: 0, right: 0, fontSize: 12, color: POD_DOT_COLORS[selectedPod.status],
                    animation: 'detailSpin 2s linear infinite',
                    '@keyframes detailSpin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
                  }}>↻</Typography>
                )}
                <Box sx={{
                  width: 20, height: 20, borderRadius: '50%', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  bgcolor: POD_DOT_COLORS[selectedPod.status] ?? '#94A3B8',
                  boxShadow: `0 0 12px ${POD_DOT_COLORS[selectedPod.status] ?? '#94A3B8'}60`,
                  ...(selectedPod.status === 'Pending' && {
                    animation: 'detailBreathe 2s ease-in-out infinite',
                    '@keyframes detailBreathe': { '0%,100%': { transform: 'scale(1)', opacity: 1 }, '50%': { transform: 'scale(0.85)', opacity: 0.4 } },
                  }),
                  ...(selectedPod.status === 'CrashLoopBackOff' && {
                    animation: 'detailArrhythmia 1s ease-in-out infinite',
                    '@keyframes detailArrhythmia': {
                      '0%': { transform: 'scale(1)', opacity: 1 }, '10%': { transform: 'scale(0.75)', opacity: 0.2 },
                      '20%': { transform: 'scale(1.1)', opacity: 1 }, '30%': { transform: 'scale(0.75)', opacity: 0.2 },
                      '40%': { transform: 'scale(1)', opacity: 1 }, '100%': { transform: 'scale(0.9)', opacity: 0.5 },
                    },
                  }),
                }}>
                  {selectedPod.status === 'Failed' && <Typography sx={{ color: 'white', fontWeight: 700, fontSize: 11 }}>✕</Typography>}
                </Box>
              </Box>
              <Box>
                <Typography variant="subtitle2" fontWeight={700} sx={{ color: POD_DOT_COLORS[selectedPod.status], lineHeight: 1.3 }}>
                  {selectedPod.status}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {selectedPod.status === 'CrashLoopBackOff' ? 'Crashing repeatedly · 7 restarts' : selectedPod.status === 'Pending' ? 'Waiting for scheduling' : 'All containers healthy'}
                </Typography>
              </Box>
              <Box sx={{ ml: 'auto' }}>
                <Chip label={selectedPod.ready} size="small" sx={{ fontSize: 11, height: 20 }} />
              </Box>
            </Box>
          </motion.div>

          <motion.div variants={FADE_UP}>
            <Divider />
          </motion.div>

          <motion.div variants={FADE_UP}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              {[['Node', 'node-1'], ['Instance', 'm5.xlarge'], ['Pod IP', '10.244.1.12'], ['CPU', selectedPod.cpu], ['Memory', selectedPod.mem], ['Age', selectedPod.age]].map(([k, v]) => (
                <Box key={k}>
                  <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block' }}>{k}</Typography>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Typography>
                </Box>
              ))}
            </Box>
          </motion.div>

          <motion.div variants={FADE_UP}>
            <Divider />
          </motion.div>

          <motion.div variants={FADE_UP}>
            <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 10, display: 'block', mb: 1 }}>
              Containers
            </Typography>
            <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2" fontWeight={600} sx={{ fontSize: 12 }}>{workload.name}</Typography>
                <PodDot status={selectedPod.status} />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: 11 }}>
                ghcr.io/example/{workload.name}:v1.5.2
              </Typography>
            </Box>
          </motion.div>

          <motion.div variants={FADE_UP}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button size="small" variant="outlined" startIcon={<TerminalIcon sx={{ fontSize: '14px !important' }} />} sx={{ fontSize: 11, textTransform: 'none' }}>
                Logs
              </Button>
            </Box>
          </motion.div>
        </Box>
      </motion.div>
    )
  }

  return (
    <motion.div variants={STAGGER} initial="hidden" animate="visible" key="root">
      {/* Workload header */}
      <Box sx={{ px: 2.5, pt: 2.5, pb: 2 }}>
        <motion.div variants={FADE_UP}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
            <Box>
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11, display: 'block', mb: 0.25 }}>
                {workload.namespace}
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 13, lineHeight: 1.4 }}>
                {workload.name}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.75, mt: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
                <Chip label={workload.kind} size="small" sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(124,58,237,0.12)', color: '#7C3AED' }} />
                <Chip label={workload.status} size="small" sx={{ height: 18, fontSize: 10, bgcolor: workload.statusBg, color: workload.statusColor }} />
              </Box>
            </Box>
            <IconButton size="small" onClick={onBack}><CloseIcon sx={{ fontSize: 18 }} /></IconButton>
          </Box>
        </motion.div>

        {/* Replica bar */}
        <motion.div variants={FADE_UP}>
          <ReplicaBar ready={workload.readyReplicas} current={workload.currentReplicas} saved={workload.savedReplicas} />
        </motion.div>
      </Box>
      <Divider />

      {/* Search toolbar */}
      <motion.div variants={FADE_UP}>
        <Box sx={{ px: 2.5, py: 1.25, display: 'flex', alignItems: 'center', gap: 1 }}>
          <TextField
            size="small"
            placeholder="Search pods..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flex: 1 }}
            slotProps={{ htmlInput: { sx: { fontSize: 13, py: 0.75 } } }}
          />
          <Typography variant="caption" color="text.disabled" sx={{ whiteSpace: 'nowrap', fontSize: 11 }}>just now</Typography>
        </Box>
      </motion.div>
      <Divider />

      {/* Pod table */}
      <motion.div variants={FADE_UP}>
        {filtered.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 5, textAlign: 'center' }}>
            {workload.pods.length === 0 ? 'No pods (workload is sleeping).' : 'No pods match your search.'}
          </Typography>
        ) : (
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {['POD', 'READY', 'CPU', 'MEM', 'AGE'].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 700, color: 'text.disabled', fontSize: 11, bgcolor: 'background.default', py: 0.75 }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((pod) => (
                <TableRow key={pod.name} hover onClick={() => setSelectedPod(pod)} sx={{ cursor: 'pointer' }}>
                  <TableCell sx={{ py: 0.75, maxWidth: 180 }}>
                    <Tooltip title={pod.name} arrow placement="top-start">
                      <Typography sx={{ fontSize: 12, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 170, display: 'block' }}>
                        {pod.name}
                      </Typography>
                    </Tooltip>
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                      <PodDot status={pod.status} />
                      <Chip label={pod.status} size="small" sx={{ height: 15, fontSize: 10, bgcolor: `${POD_DOT_COLORS[pod.status] ?? '#94A3B8'}18`, color: POD_DOT_COLORS[pod.status] ?? '#94A3B8' }} />
                    </Box>
                  </TableCell>
                  <TableCell sx={{ py: 0.75, fontSize: 12, fontFamily: 'monospace' }}>{pod.ready}</TableCell>
                  <TableCell sx={{ py: 0.75, fontSize: 12, fontFamily: 'monospace', color: 'text.secondary' }}>{pod.cpu}</TableCell>
                  <TableCell sx={{ py: 0.75, fontSize: 12, fontFamily: 'monospace', color: 'text.secondary' }}>{pod.mem}</TableCell>
                  <TableCell sx={{ py: 0.75, fontSize: 12, color: 'text.secondary' }}>{pod.age}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </motion.div>
    </motion.div>
  )
}

export default function DrawerSlidePrototype() {
  const router = useRouter()
  const [selectedWorkload, setSelectedWorkload] = useState<MockWorkload | null>(null)
  const [stiffness, setStiffness] = useState(300)
  const [damping, setDamping] = useState(30)

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>D4 — Drawer Slide</Typography>
          <Typography variant="body2" color="text.secondary">
            Detail drawer with spring physics and staggered content reveal — mirrors production WorkloadDetailDrawer
          </Typography>
        </Box>
      </Box>

      {/* Controls */}
      <Box sx={{ display: 'flex', gap: 2, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', alignItems: 'center', flexWrap: 'wrap' }}>
        <Button variant="contained" size="small" onClick={() => setSelectedWorkload(WORKLOADS[0])} disabled={!!selectedWorkload}>
          Open Drawer
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            Stiffness: {stiffness}
          </Typography>
          <Slider value={stiffness} onChange={(_, v) => setStiffness(v as number)} min={100} max={600} step={50} size="small" sx={{ width: 100 }} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            Damping: {damping}
          </Typography>
          <Slider value={damping} onChange={(_, v) => setDamping(v as number)} min={10} max={50} step={5} size="small" sx={{ width: 100 }} />
        </Box>
      </Box>

      {/* Workloads table (mirrors production WorkloadsTable) */}
      <Box
        sx={{
          borderRadius: 2,
          bgcolor: 'background.default',
          border: '1px solid',
          borderColor: 'divider',
          position: 'relative',
          overflow: 'hidden',
          minHeight: 500,
        }}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              {['NAMESPACE', 'NAME', 'KIND', 'REPLICAS', 'STATUS'].map(h => (
                <TableCell key={h} sx={{ fontWeight: 700, color: 'text.disabled', fontSize: 11, py: 1 }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {WORKLOADS.map((w) => (
              <TableRow key={`${w.namespace}/${w.name}`} hover onClick={() => setSelectedWorkload(w)} sx={{ cursor: 'pointer' }}>
                <TableCell sx={{ color: 'text.secondary', fontSize: 13 }}>{w.namespace}</TableCell>
                <TableCell sx={{ fontWeight: 500, fontSize: 13 }}>{w.name}</TableCell>
                <TableCell>
                  <Chip label={w.kind} size="small" sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(124,58,237,0.12)', color: '#7C3AED' }} />
                </TableCell>
                <TableCell>
                  <Typography component="span" sx={{ fontSize: 13, fontFamily: 'monospace' }}>
                    {w.currentReplicas}
                  </Typography>
                  {w.savedReplicas !== null && (
                    <Typography component="span" color="text.secondary" sx={{ fontSize: 12 }}> / {w.savedReplicas}</Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                    <PodDot status={w.status} />
                    <Chip label={w.status} size="small" sx={{ height: 20, fontSize: 11, bgcolor: w.statusBg, color: w.statusColor }} />
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Drawer */}
        <AnimatePresence>
          {selectedWorkload && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setSelectedWorkload(null)}
                style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 10, cursor: 'pointer' }}
              />

              {/* Drawer panel */}
              <motion.div
                initial={{ x: DRAWER_WIDTH }}
                animate={{ x: 0 }}
                exit={{ x: DRAWER_WIDTH }}
                transition={{ type: 'spring', stiffness, damping }}
                style={{
                  position: 'absolute', top: 0, right: 0, bottom: 0,
                  width: DRAWER_WIDTH, maxWidth: '90%',
                  backgroundColor: 'var(--mui-palette-background-paper, #1A1A24)',
                  borderLeft: '1px solid rgba(255,255,255,0.07)',
                  zIndex: 11, overflow: 'auto',
                  display: 'flex', flexDirection: 'column',
                }}
              >
                <DrawerContent workload={selectedWorkload} onBack={() => setSelectedWorkload(null)} />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </Box>
    </Box>
  )
}
