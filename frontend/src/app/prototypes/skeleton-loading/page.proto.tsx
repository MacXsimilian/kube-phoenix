'use client'

import { useState, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ReplayIcon from '@mui/icons-material/Replay'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

const MOCK_WORKLOADS = [
  { ns: 'dev', name: 'api-server', kind: 'Deployment', replicas: '3/3', status: 'Running', statusColor: '#22C55E' },
  { ns: 'dev', name: 'web-frontend', kind: 'Deployment', replicas: '2/2', status: 'Running', statusColor: '#22C55E' },
  { ns: 'staging', name: 'checkout-svc', kind: 'Deployment', replicas: '0/2', status: 'Sleeping', statusColor: '#F59E0B' },
  { ns: 'dev', name: 'redis', kind: 'StatefulSet', replicas: '1/1', status: 'Running', statusColor: '#22C55E' },
  { ns: 'staging', name: 'product-api', kind: 'Deployment', replicas: '0/3', status: 'Sleeping', statusColor: '#F59E0B' },
  { ns: 'monitoring', name: 'prometheus', kind: 'StatefulSet', replicas: '1/1', status: 'Running', statusColor: '#22C55E' },
]

function TableSkeleton() {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          {['NAMESPACE', 'NAME', 'KIND', 'REPLICAS', 'STATUS'].map(h => (
            <TableCell key={h}>
              <Skeleton variant="text" width={60 + Math.random() * 40} height={14} animation="wave" />
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {Array.from({ length: 6 }).map((_, i) => (
          <TableRow key={i}>
            <TableCell><Skeleton variant="rounded" width={80} height={14} animation="wave" /></TableCell>
            <TableCell><Skeleton variant="rounded" width={100} height={14} animation="wave" /></TableCell>
            <TableCell><Skeleton variant="rounded" width={70} height={20} animation="wave" sx={{ borderRadius: 2 }} /></TableCell>
            <TableCell><Skeleton variant="rounded" width={40} height={14} animation="wave" /></TableCell>
            <TableCell><Skeleton variant="rounded" width={60} height={20} animation="wave" sx={{ borderRadius: 2 }} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function RealTable() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Table size="small">
        <TableHead>
          <TableRow>
            {['NAMESPACE', 'NAME', 'KIND', 'REPLICAS', 'STATUS'].map(h => (
              <TableCell key={h} sx={{ fontWeight: 700, color: 'text.disabled', fontSize: 11 }}>{h}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {MOCK_WORKLOADS.map((w, i) => (
            <TableRow
              key={w.name}
              hover
              sx={{
                cursor: 'pointer',
                animation: `skelRowIn 300ms ease-out ${i * 40}ms both`,
                '@keyframes skelRowIn': {
                  from: { opacity: 0, transform: 'translateY(8px)' },
                  to: { opacity: 1, transform: 'translateY(0)' },
                },
              }}
            >
              <TableCell sx={{ fontSize: 13, color: 'text.secondary' }}>{w.ns}</TableCell>
              <TableCell sx={{ fontSize: 13, fontWeight: 500 }}>{w.name}</TableCell>
              <TableCell>
                <Chip label={w.kind} size="small" sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(124,58,237,0.12)', color: '#7C3AED' }} />
              </TableCell>
              <TableCell sx={{ fontFamily: 'monospace', fontSize: 13 }}>{w.replicas}</TableCell>
              <TableCell>
                <Chip label={w.status} size="small" sx={{ height: 20, fontSize: 11, bgcolor: `${w.statusColor}18`, color: w.statusColor }} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </motion.div>
  )
}

function DashboardSkeleton() {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
      <Card sx={{ bgcolor: 'background.paper' }}>
        <CardContent sx={{ p: 3 }}>
          <Skeleton variant="text" width={120} height={14} animation="wave" sx={{ mb: 2 }} />
          <Skeleton variant="rounded" width={200} height={28} animation="wave" sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Skeleton variant="rounded" width={100} height={24} animation="wave" sx={{ borderRadius: 2 }} />
            <Skeleton variant="rounded" width={130} height={24} animation="wave" sx={{ borderRadius: 2 }} />
            <Skeleton variant="rounded" width={110} height={24} animation="wave" sx={{ borderRadius: 2 }} />
          </Box>
        </CardContent>
      </Card>
      <Card sx={{ bgcolor: 'background.paper' }}>
        <CardContent sx={{ p: 3 }}>
          <Skeleton variant="text" width={130} height={14} animation="wave" sx={{ mb: 2 }} />
          {[0, 1, 2].map(i => (
            <Skeleton key={i} variant="rounded" height={48} animation="wave" sx={{ mb: 1, borderRadius: 2 }} />
          ))}
        </CardContent>
      </Card>
    </Box>
  )
}

function RealDashboard() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
          <Card sx={{ bgcolor: 'background.paper' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>CLUSTER STATUS</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#22C55E', boxShadow: '0 0 8px #22C55E' }} />
                <Typography variant="h6" fontWeight={700}>Cluster Awake</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Chip label="4 Nodes" size="small" sx={{ bgcolor: 'rgba(34,197,94,0.1)', color: '#22C55E', fontWeight: 600 }} />
                <Chip label="24 Running" size="small" sx={{ bgcolor: 'rgba(59,130,246,0.1)', color: '#3B82F6', fontWeight: 600 }} />
                <Chip label="8 Sleeping" size="small" sx={{ bgcolor: 'rgba(245,158,11,0.1)', color: '#F59E0B', fontWeight: 600 }} />
              </Box>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}>
          <Card sx={{ bgcolor: 'background.paper' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>RECENT ACTIVITY</Typography>
              {['Sleep #8 — 4 scaled', 'Wake #7 — 4 restored', 'Sleep #6 — 4 scaled'].map((t, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.05, duration: 0.3 }}>
                  <Box sx={{ p: 1.5, mb: 0.5, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.03)' }}>
                    <Typography variant="body2" fontWeight={500}>{t}</Typography>
                    <Typography variant="caption" color="text.secondary">{(i + 1) * 3}h ago</Typography>
                  </Box>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </Box>
    </motion.div>
  )
}

export default function SkeletonLoadingPrototype() {
  const router = useRouter()
  const [tableLoaded, setTableLoaded] = useState(false)
  const [dashLoaded, setDashLoaded] = useState(false)
  const [key, setKey] = useState(0)

  const replay = useCallback(() => {
    setTableLoaded(false)
    setDashLoaded(false)
    setKey(k => k + 1)
  }, [])

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>F20 — Skeleton Loading</Typography>
          <Typography variant="body2" color="text.secondary">
            Content-shaped skeletons → crossfade to real data with staggered rows
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', alignItems: 'center', flexWrap: 'wrap' }}>
        <Button variant="contained" size="small" onClick={() => setDashLoaded(true)} disabled={dashLoaded}>
          Load Dashboard
        </Button>
        <Button variant="contained" size="small" onClick={() => setTableLoaded(true)} disabled={tableLoaded}>
          Load Table
        </Button>
        <Button variant="outlined" size="small" startIcon={<ReplayIcon fontSize="small" />} onClick={replay}>
          Replay
        </Button>
      </Box>

      {/* Dashboard skeleton → reveal */}
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>Overview Dashboard:</Typography>
      <Box sx={{ mb: 4, p: 2, borderRadius: 2, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
        <AnimatePresence mode="wait">
          {!dashLoaded ? (
            <motion.div key={`dash-skel-${key}`} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <DashboardSkeleton />
            </motion.div>
          ) : (
            <RealDashboard key={`dash-real-${key}`} />
          )}
        </AnimatePresence>
      </Box>

      {/* Table skeleton → reveal */}
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>Workloads Table:</Typography>
      <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
        <AnimatePresence mode="wait">
          {!tableLoaded ? (
            <motion.div key={`tbl-skel-${key}`} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <TableSkeleton />
            </motion.div>
          ) : (
            <RealTable key={`tbl-real-${key}`} />
          )}
        </AnimatePresence>
      </Box>
    </Box>
  )
}
