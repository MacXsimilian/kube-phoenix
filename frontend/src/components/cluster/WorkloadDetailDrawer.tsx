'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import LinearProgress from '@mui/material/LinearProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CloseIcon from '@mui/icons-material/Close'
import RefreshIcon from '@mui/icons-material/Refresh'
import { getWorkloadPods } from '@/lib/api'
import { sinceMs } from '@/lib/formatters'
import { statusColors } from '@/components/cluster/statusColors'
import { useTheme } from '@mui/material/styles'
import { useColors } from '@/lib/colors'
import { useDrawerResize } from '@/lib/useDrawerResize'
import type { NodePod, Workload } from '@/lib/types'
import PodDetailContent from './PodDetailContent'
import PodRow from './PodRow'

// ── sub-components ────────────────────────────────────────────────────────────

function ReplicaBar({ ready, current, saved, isDark, colors }: { ready: number; current: number; saved: number | null; isDark: boolean; colors: ReturnType<typeof import('@/lib/colors').useColors> }) {
  const total = saved ?? current
  const pct = total > 0 ? Math.round((ready / total) * 100) : 0
  const color = pct >= 100 ? colors.success : pct > 0 ? colors.warning : colors.errorLight
  return (
    <Box sx={{ minWidth: 120 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
        <Typography variant="caption" sx={{ color, fontWeight: 600, fontSize: 11 }}>
          {ready}/{current} ready
        </Typography>
        {saved !== null && (
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11 }}>
            saved: {saved}
          </Typography>
        )}
      </Box>
      <LinearProgress
        variant="determinate"
        value={Math.min(pct, 100)}
        sx={{ height: 4, borderRadius: 1, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 1 } }}
      />
    </Box>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function WorkloadDetailDrawer({ workload, onClose }: { workload: Workload | null; onClose: () => void }) {
  const [drawerWidth, handleResizeMouseDown, handleResizeTouchStart] = useDrawerResize(560)
  const [search, setSearch] = useState('')
  const [selectedPod, setSelectedPod] = useState<NodePod | null>(null)
  const isDark = useTheme().palette.mode === 'dark'
  const colors = useColors()

  const { data: pods = [], isLoading, isError, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['workload-pods', workload?.namespace, workload?.kind, workload?.name],
    queryFn: () => getWorkloadPods(workload!.namespace, workload!.kind, workload!.name),
    enabled: workload != null,
    refetchInterval: 15_000,
  })

  const filtered = useMemo(
    () => !search ? pods : pods.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase())
    ),
    [pods, search]
  )

  const sc = workload ? statusColors(isDark)[workload.status] : null

  function handleClose() {
    setSelectedPod(null)
    onClose()
  }

  return (
    <Drawer
      anchor="right"
      open={workload != null}
      onClose={handleClose}
      slotProps={{ paper: {
        sx: {
          width: { xs: '100vw', md: drawerWidth },
          bgcolor: 'background.paper',
          borderLeft: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'visible',
        },
      } }}
    >
      {/* Resize handle */}
      <Box
        onMouseDown={handleResizeMouseDown}
        onTouchStart={handleResizeTouchStart}
        sx={{
          position: 'absolute',
          left: -4, top: 0, bottom: 0, width: 8,
          cursor: 'col-resize', zIndex: 1,
          '&:hover': { bgcolor: 'primary.main', opacity: 0.4 },
          display: { xs: 'none', md: 'block' },
        }}
      />

      {workload && (
        <>
          {/* Header */}
          <Box sx={{ px: 2.5, pt: 2.5, pb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
              <Box sx={{ minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                {selectedPod && (
                  <Tooltip title={`Back to ${workload.name}`}>
                    <IconButton size="small" onClick={() => setSelectedPod(null)} sx={{ mt: -0.25, flexShrink: 0 }} aria-label="Back to workload">
                      <ArrowBackIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                )}
                <Box sx={{ minWidth: 0 }}>
                  {selectedPod ? (
                    <>
                      <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11, display: 'block', mb: 0.25 }}>
                        {workload.name}
                      </Typography>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 13, wordBreak: 'break-all', lineHeight: 1.4 }}>
                        {selectedPod.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                        {selectedPod.namespace}
                      </Typography>
                    </>
                  ) : (
                    <>
                      <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11, display: 'block', mb: 0.25 }}>
                        {workload.namespace}
                      </Typography>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 13, wordBreak: 'break-all', lineHeight: 1.4 }}>
                        {workload.name}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.75, mt: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Chip
                          label={workload.kind}
                          size="small"
                          sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(124,58,237,0.12)', color: 'primary.main' }}
                        />
                        {sc && <Chip label={sc.label} size="small" sx={{ height: 18, fontSize: 10, bgcolor: sc.bgcolor, color: sc.color }} />}
                      </Box>
                    </>
                  )}
                </Box>
              </Box>
              <IconButton size="small" onClick={handleClose} sx={{ mt: -0.25, flexShrink: 0 }} aria-label="Close workload detail">
                <CloseIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>

            {/* Replica bar — hidden in pod detail view */}
            {!selectedPod && (
              <Box sx={{ mt: 1.5 }}>
                <ReplicaBar
                  ready={workload.readyReplicas}
                  current={workload.currentReplicas}
                  saved={workload.savedReplicas}
                  isDark={isDark}
                  colors={colors}
                />
              </Box>
            )}
          </Box>

          <Divider />

          {/* Pod detail content — replaces toolbar + pod list */}
          {selectedPod && (
            <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
              <PodDetailContent namespace={selectedPod.namespace} podName={selectedPod.name} />
            </Box>
          )}

          {/* Toolbar — hidden in pod detail view */}
          {!selectedPod && (
            <Box sx={{ px: 2.5, py: 1.25, display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextField
                size="small"
                placeholder="Search pods…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                sx={{ flex: 1 }}
                slotProps={{ htmlInput: { sx: { fontSize: 13, py: 0.75 } } }}
              />
              <Typography variant="caption" color="text.disabled" sx={{ whiteSpace: 'nowrap', fontSize: 11 }}>
                {dataUpdatedAt ? sinceMs(dataUpdatedAt) : ''}
              </Typography>
              <Tooltip title="Refresh">
                <IconButton size="small" onClick={() => refetch()} aria-label="Refresh pods">
                  <RefreshIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>
          )}

          {!selectedPod && <Divider />}

          {/* Pod list — hidden in pod detail view */}
          {!selectedPod && (
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              {isError ? (
                <Alert severity="error" sx={{ m: 2 }}>
                  Failed to load pods: {error instanceof Error ? error.message : 'Unknown error'}
                </Alert>
              ) : isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                  <CircularProgress size={28} />
                </Box>
              ) : filtered.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 5, textAlign: 'center' }}>
                  {search ? 'No pods match your search.' : 'No pods found for this workload.'}
                </Typography>
              ) : (
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {['POD', 'READY', 'CPU', 'MEM', 'AGE'].map((h) => (
                        <TableCell key={h} sx={{ fontWeight: 700, color: 'text.disabled', fontSize: 11, bgcolor: 'background.default', py: 0.75 }}>
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filtered.map((pod) => (
                      <PodRow key={pod.name} pod={pod} onClick={() => setSelectedPod(pod)} isDark={isDark} colors={colors} />
                    ))}
                  </TableBody>
                </Table>
              )}
            </Box>
          )}
        </>
      )}
    </Drawer>
  )
}
