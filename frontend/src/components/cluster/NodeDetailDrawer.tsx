'use client'

import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
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
import { getNodePods } from '@/lib/api'
import { fmtCpu, fmtMem, podAge, sinceMs } from '@/lib/formatters'
import { POD_STATUS_STYLE, NODE_STATUS_MAP } from '@/components/cluster/statusColors'
import { useDrawerResize } from '@/lib/useDrawerResize'
import type { Node, NodePod } from '@/lib/types'
import PodDetailContent from './PodDetailContent'

// ── helpers ───────────────────────────────────────────────────────────────────

function pct(used: number, total: number) {
  return total > 0 ? Math.round((used / total) * 100) : 0
}
function pctColor(p: number) {
  if (p >= 85) return '#F87171'
  if (p >= 65) return '#FBBF24'
  return '#22C55E'
}
function podStatusStyle(status: string) {
  return POD_STATUS_STYLE[status] ?? { color: '#94A3B8', bgcolor: 'rgba(148,163,184,0.12)' }
}
function ownerStyle(kind: string) {
  if (kind === 'Deployment')  return { color: '#7C3AED', bgcolor: 'rgba(124,58,237,0.12)' }
  if (kind === 'StatefulSet') return { color: '#6366F1', bgcolor: 'rgba(99,102,241,0.12)' }
  if (kind === 'Job' || kind === 'CronJob') return { color: '#14B8A6', bgcolor: 'rgba(20,184,166,0.12)' }
  return { color: '#94A3B8', bgcolor: 'rgba(148,163,184,0.12)' }
}

// ── sub-components ────────────────────────────────────────────────────────────

function MiniBar({ used, total, label }: { used: number; total: number; label: string }) {
  const p = pct(used, total)
  const color = pctColor(p)
  return (
    <Tooltip title={label} arrow>
      <Box sx={{ minWidth: 80 }}>
        <Typography variant="caption" sx={{ color, fontWeight: 600, display: 'block', mb: 0.25, fontSize: 11 }}>
          {p}%
        </Typography>
        <LinearProgress
          variant="determinate"
          value={Math.min(p, 100)}
          aria-label={label}
          sx={{ height: 5, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.08)', '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 1 } }}
        />
      </Box>
    </Tooltip>
  )
}

function PodRow({ pod, onClick }: { pod: NodePod; onClick?: () => void }) {
  const ss = podStatusStyle(pod.status)
  const os = pod.ownerKind ? ownerStyle(pod.ownerKind) : null
  const readyColor = pod.readyContainers === pod.totalContainers
    ? '#22C55E'
    : pod.readyContainers > 0
    ? '#F59E0B'
    : '#F87171'

  return (
    <TableRow hover onClick={onClick} sx={{ cursor: onClick ? 'pointer' : 'default' }}>
      <TableCell sx={{ maxWidth: 170, py: 0.75 }}>
        <Tooltip title={pod.name} arrow placement="top-start">
          <Typography sx={{ fontSize: 12, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160, display: 'block' }}>
            {pod.name}
          </Typography>
        </Tooltip>
        <Chip label={pod.status} size="small" sx={{ height: 15, fontSize: 10, bgcolor: ss.bgcolor, color: ss.color, mt: 0.25 }} />
      </TableCell>
      <TableCell sx={{ py: 0.75 }}>
        {os ? (
          <Tooltip title={`${pod.ownerKind}: ${pod.ownerName}`} arrow>
            <Chip
              label={pod.ownerName}
              size="small"
              sx={{ height: 18, fontSize: 10, bgcolor: os.bgcolor, color: os.color, maxWidth: 130, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
            />
          </Tooltip>
        ) : (
          <Typography color="text.disabled" sx={{ fontSize: 12 }}>—</Typography>
        )}
      </TableCell>
      <TableCell sx={{ py: 0.75 }}>
        <Typography sx={{ fontSize: 12, color: readyColor, fontFamily: 'monospace' }}>
          {pod.readyContainers}/{pod.totalContainers}
        </Typography>
      </TableCell>
      <TableCell sx={{ py: 0.75 }}>
        <Typography sx={{ fontSize: 12, fontFamily: 'monospace', color: 'text.secondary' }}>
          {pod.cpuRequest > 0 ? fmtCpu(pod.cpuRequest) : '—'}
        </Typography>
      </TableCell>
      <TableCell sx={{ py: 0.75 }}>
        <Typography sx={{ fontSize: 12, fontFamily: 'monospace', color: 'text.secondary' }}>
          {pod.memRequest > 0 ? fmtMem(pod.memRequest) : '—'}
        </Typography>
      </TableCell>
      <TableCell sx={{ py: 0.75 }}>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
          {podAge(pod.startedAt)}
        </Typography>
      </TableCell>
    </TableRow>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function NodeDetailDrawer({ node, onClose }: { node: Node | null; onClose: () => void }) {
  const [search, setSearch] = useState('')
  const [drawerWidth, handleResizeMouseDown, handleResizeTouchStart] = useDrawerResize(540)
  const [selectedPod, setSelectedPod] = useState<NodePod | null>(null)

  function handleClose() {
    setSelectedPod(null)
    onClose()
  }

  const { data: pods = [], isLoading, isError, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['node-pods', node?.name],
    queryFn: () => getNodePods(node!.name),
    enabled: node != null,
    refetchInterval: 15_000,
  })

  const filtered = useMemo(
    () => !search ? pods : pods.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.ownerName ?? '').toLowerCase().includes(search.toLowerCase()) ||
      p.namespace.toLowerCase().includes(search.toLowerCase())
    ),
    [pods, search]
  )

  const grouped = useMemo(() => {
    const map = new Map<string, NodePod[]>()
    for (const p of filtered) {
      if (!map.has(p.namespace)) map.set(p.namespace, [])
      map.get(p.namespace)!.push(p)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  const sc = node ? NODE_STATUS_MAP[node.status] : null

  return (
    <Drawer
      anchor="right"
      open={node != null}
      onClose={handleClose}
      PaperProps={{
        sx: {
          width: { xs: '100vw', md: drawerWidth },
          bgcolor: '#1A1A24',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'visible',
        },
      }}
    >
      {/* Resize handle */}
      <Box
        onMouseDown={handleResizeMouseDown}
        onTouchStart={handleResizeTouchStart}
        sx={{
          position: 'absolute',
          left: -4,
          top: 0,
          bottom: 0,
          width: 8,
          cursor: 'col-resize',
          zIndex: 1,
          '&:hover': { bgcolor: 'primary.main', opacity: 0.4 },
          display: { xs: 'none', md: 'block' },
        }}
      />
      {node && (
        <>
          {/* Header */}
          <Box sx={{ px: 2.5, pt: 2.5, pb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
              <Box sx={{ minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                {selectedPod && (
                  <Tooltip title={`Back to ${node.name}`}>
                    <IconButton size="small" onClick={() => setSelectedPod(null)} sx={{ mt: -0.25, flexShrink: 0 }} aria-label="Back to node">
                      <ArrowBackIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                )}
                <Box sx={{ minWidth: 0 }}>
                  {selectedPod ? (
                    <>
                      <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11, display: 'block', mb: 0.25 }}>
                        {node.name}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 13, wordBreak: 'break-all', lineHeight: 1.4 }}
                      >
                        {selectedPod.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                        {selectedPod.namespace}
                      </Typography>
                    </>
                  ) : (
                    <Typography
                      variant="body2"
                      sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 13, wordBreak: 'break-all', lineHeight: 1.4 }}
                    >
                      {node.name}
                    </Typography>
                  )}
                {!selectedPod && (
                  <Box sx={{ display: 'flex', gap: 0.75, mt: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
                    {node.instanceType && (
                      <Typography variant="caption" color="text.secondary">{node.instanceType}</Typography>
                    )}
                    {node.zone && (
                      <>
                        <Typography variant="caption" color="text.disabled">·</Typography>
                        <Typography variant="caption" color="text.secondary">{node.zone}</Typography>
                      </>
                    )}
                    <Typography variant="caption" color="text.disabled">·</Typography>
                    {sc && <Chip label={sc.label} size="small" sx={{ height: 18, fontSize: 10, bgcolor: sc.bgcolor, color: sc.color }} />}
                    {node.cordoned && (
                      <Chip label="Cordoned" size="small" sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(248,113,113,0.15)', color: '#F87171' }} />
                    )}
                  </Box>
                )}
                </Box>
              </Box>
              <IconButton size="small" onClick={handleClose} sx={{ mt: -0.25, flexShrink: 0 }} aria-label="Close node detail">
                <CloseIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>

            {/* Resource bars — hidden in pod detail view */}
            {!selectedPod && (
              <Box sx={{ display: 'flex', gap: 3, mt: 1.5, flexWrap: 'wrap' }}>
                <MiniBar
                  used={node.cpuRequested}
                  total={node.cpuAllocatable}
                  label={`CPU: ${fmtCpu(node.cpuRequested)} / ${fmtCpu(node.cpuAllocatable)} reserved`}
                />
                <MiniBar
                  used={node.memRequested}
                  total={node.memAllocatable}
                  label={`MEM: ${fmtMem(node.memRequested)} / ${fmtMem(node.memAllocatable)} reserved`}
                />
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mb: 0.25, fontSize: 11 }}>PODS</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 11 }}>{node.podCount}</Typography>
                </Box>
              </Box>
            )}
          </Box>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

          {/* Pod detail content — replaces toolbar + pod list */}
          {selectedPod && (
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              <PodDetailContent namespace={selectedPod.namespace} podName={selectedPod.name} />
            </Box>
          )}

          {/* Toolbar — hidden in pod detail view */}
          {!selectedPod && <Box sx={{ px: 2.5, py: 1.25, display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              size="small"
              placeholder="Search pods…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ flex: 1 }}
              inputProps={{ sx: { fontSize: 13, py: 0.75 } }}
            />
            <Typography variant="caption" color="text.disabled" sx={{ whiteSpace: 'nowrap', fontSize: 11 }}>
              {dataUpdatedAt ? sinceMs(dataUpdatedAt) : ''}
            </Typography>
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={() => refetch()} aria-label="Refresh pod list">
                <RefreshIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>}

          {!selectedPod && <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />}

          {/* Pod list — hidden in pod detail view */}
          {!selectedPod && <Box sx={{ flex: 1, overflow: 'auto' }}>
            {isError ? (
              <Alert severity="error" sx={{ m: 2 }}>
                Failed to load pods: {error instanceof Error ? error.message : 'Unknown error'}
              </Alert>
            ) : isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress size={28} />
              </Box>
            ) : grouped.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 5, textAlign: 'center' }}>
                {search ? 'No pods match your search.' : 'No non-daemonset pods on this node.'}
              </Typography>
            ) : (
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {['POD', 'OWNER', 'READY', 'CPU', 'MEM', 'AGE'].map((h) => (
                      <TableCell key={h} sx={{ fontWeight: 700, color: 'text.disabled', fontSize: 11, bgcolor: '#1A1A24', py: 0.75 }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {grouped.map(([ns, nsPods]) => (
                    <React.Fragment key={ns}>
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          sx={{ bgcolor: 'rgba(124,58,237,0.06)', borderBottom: '1px solid rgba(255,255,255,0.04)', py: 0.5 }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" fontWeight={700} sx={{ color: 'primary.light', textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 10 }}>
                              {ns}
                            </Typography>
                            <Chip
                              label={`${nsPods.length} pod${nsPods.length !== 1 ? 's' : ''}`}
                              size="small"
                              sx={{ height: 15, fontSize: 10 }}
                            />
                          </Box>
                        </TableCell>
                      </TableRow>
                      {nsPods.map((pod) => (
                        <PodRow key={pod.name} pod={pod} onClick={() => setSelectedPod(pod)} />
                      ))}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            )}
          </Box>}
        </>
      )}
    </Drawer>
  )
}
