'use client'

import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Collapse from '@mui/material/Collapse'
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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import RefreshIcon from '@mui/icons-material/Refresh'
import { getNodePods } from '@/lib/api'
import { fmtCpu, fmtMem, sinceMs, pct, pctColor } from '@/lib/formatters'
import { nodeStatusMap } from '@/components/cluster/statusColors'
import { useTheme } from '@mui/material/styles'
import { semanticColors, useColors } from '@/lib/colors'
import { useDrawerResize } from '@/lib/useDrawerResize'
import { NODE_PODS_REFETCH_MS } from '@/lib/constants'
import type { Node, NodePod, NodeTaint } from '@/lib/types'
import PodDetailContent from './PodDetailContent'
import PodRow from './PodRow'

// ── sub-components ────────────────────────────────────────────────────────────

function MiniBar({ used, total, label }: { used: number; total: number; label: string }) {
  const isDark = useTheme().palette.mode === 'dark'
  const percentUsed = pct(used, total)
  const color = pctColor(percentUsed, isDark)
  return (
    <Tooltip title={label} arrow>
      <Box sx={{ minWidth: 80 }}>
        <Typography variant="caption" sx={{ color, fontWeight: 600, display: 'block', mb: 0.25, fontSize: 11 }}>
          {percentUsed}%
        </Typography>
        <LinearProgress
          variant="determinate"
          value={Math.min(percentUsed, 100)}
          aria-label={label}
          sx={{ height: 5, borderRadius: 1, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 1 } }}
        />
      </Box>
    </Tooltip>
  )
}

const HIGHLIGHTED_LABEL_KEYS = new Set([
  'node.kubernetes.io/instance-type',
  'beta.kubernetes.io/instance-type',
  'topology.kubernetes.io/zone',
  'failure-domain.beta.kubernetes.io/zone',
  'eks.amazonaws.com/nodegroup',
  'karpenter.sh/nodepool',
  'kubernetes.io/arch',
])

function taintEffectColors(isDark: boolean) {
  const c = semanticColors(isDark)
  return {
    NoSchedule:       { color: c.orange,   bg: c.orangeBg,  borderColor: isDark ? 'rgba(249,115,22,0.2)' : 'rgba(194,65,12,0.2)' },
    NoExecute:        { color: c.error,    bg: c.errorBg,   borderColor: isDark ? 'rgba(239,68,68,0.2)'  : 'rgba(185,28,28,0.2)' },
    PreferNoSchedule: { color: c.warning,  bg: c.warningBg, borderColor: isDark ? 'rgba(245,158,11,0.2)' : 'rgba(146,64,14,0.2)' },
  } as Record<string, { color: string; bg: string; borderColor: string }>
}
const TAINT_EFFECT_FALLBACK = { color: '#9e9e9e', bg: 'rgba(158,158,158,0.12)', borderColor: 'rgba(158,158,158,0.2)' }

function CollapsibleSection({ title, count, defaultOpen = false, children }: {
  title: string; count: number; defaultOpen?: boolean; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
      <ButtonBase
        onClick={() => setOpen((v) => !v)}
        sx={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          px: 2.5, py: 1, textAlign: 'left',
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 12 }}>
          {title}<Typography component="span" variant="caption" sx={{ color: 'text.disabled', ml: 0.75 }}>{count}</Typography>
        </Typography>
        <ExpandMoreIcon sx={{ fontSize: 16, color: 'text.disabled', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }} />
      </ButtonBase>
      <Collapse in={open}>
        <Box sx={{ px: 2.5, pb: 1.5 }}>
          {children}
        </Box>
      </Collapse>
    </Box>
  )
}

function LabelChip({ labelKey, value, highlight }: { labelKey: string; value: string; highlight: boolean }) {
  const isDark = useTheme().palette.mode === 'dark'
  const mutedBg    = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
  const mutedBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'
  const accentBg    = isDark ? 'rgba(124,58,237,0.06)'  : 'rgba(109,40,217,0.06)'
  const accentBorder = isDark ? 'rgba(124,58,237,0.15)' : 'rgba(109,40,217,0.15)'
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block', fontFamily: 'monospace', fontSize: 11, lineHeight: 1.3,
        px: 1, py: 0.375, borderRadius: 0.5,
        bgcolor: highlight ? accentBg : mutedBg,
        border: '1px solid',
        borderColor: highlight ? accentBorder : mutedBorder,
      }}
    >
      <Box component="span" sx={{ color: 'text.disabled' }}>{labelKey}</Box>
      <Box component="span" sx={{ color: 'text.disabled', mx: '1px' }}>=</Box>
      <Box component="span" sx={{ color: highlight ? 'primary.light' : 'text.primary' }}>{value}</Box>
    </Box>
  )
}

function TaintChip({ taint, effectColors }: { taint: NodeTaint; effectColors: Record<string, { color: string; bg: string; borderColor: string }> }) {
  const style = effectColors[taint.effect] ?? TAINT_EFFECT_FALLBACK
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.75,
        fontFamily: 'monospace', fontSize: 11, lineHeight: 1.3,
        px: 1.25, py: 0.5, borderRadius: 0.5,
        bgcolor: style.bg, border: '1px solid', borderColor: style.borderColor,
        color: style.color,
      }}
    >
      <span>{taint.key}{taint.value ? `=${taint.value}` : ''}</span>
      <Box
        component="span"
        sx={{
          fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
          px: 0.625, py: '1px', borderRadius: '3px', bgcolor: 'rgba(0,0,0,0.2)',
        }}
      >
        {taint.effect}
      </Box>
    </Box>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function NodeDetailDrawer({ node, onClose }: { node: Node | null; onClose: () => void }) {
  const [search, setSearch] = useState('')
  const [drawerWidth, handleResizeMouseDown, handleResizeTouchStart] = useDrawerResize(540)
  const [selectedPod, setSelectedPod] = useState<NodePod | null>(null)
  const isDark = useTheme().palette.mode === 'dark'
  const colors = useColors()

  function handleClose() {
    setSelectedPod(null)
    onClose()
  }

  const { data: pods = [], isLoading, isError, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['node-pods', node?.name],
    queryFn: () => getNodePods(node!.name),
    enabled: node != null,
    refetchInterval: NODE_PODS_REFETCH_MS,
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
    for (const pod of filtered) {
      if (!map.has(pod.namespace)) map.set(pod.namespace, [])
      map.get(pod.namespace)!.push(pod)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  const statusColor = node ? nodeStatusMap(isDark)[node.status] : null
  const effectColors = useMemo(() => taintEffectColors(isDark), [isDark])

  const sortedLabels = useMemo(() => {
    if (!node?.labels) return []
    return Object.entries(node.labels)
      .map(([key, value]) => ({ key, value, highlight: HIGHLIGHTED_LABEL_KEYS.has(key) }))
      .sort((a, b) => {
        if (a.highlight !== b.highlight) return a.highlight ? -1 : 1
        return a.key.localeCompare(b.key)
      })
  }, [node?.labels])

  return (
    <Drawer
      anchor="right"
      open={node != null}
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
                    {statusColor && <Chip label={statusColor.label} size="small" sx={{ height: 18, fontSize: 10, bgcolor: statusColor.bgcolor, color: statusColor.color }} />}
                    {node.cordoned && (
                      <Chip label="Cordoned" size="small" sx={{ height: 18, fontSize: 10, bgcolor: colors.errorBg, color: colors.errorLight }} />
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

          {/* Labels & Taints — hidden in pod detail view */}
          {!selectedPod && (
            <>
              <Divider />
              <CollapsibleSection title="Labels" count={sortedLabels.length}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {sortedLabels.map((l) => (
                    <LabelChip key={l.key} labelKey={l.key} value={l.value} highlight={l.highlight} />
                  ))}
                </Box>
              </CollapsibleSection>
              {(node.taints ?? []).length > 0 && (
                <CollapsibleSection title="Taints" count={node.taints.length} defaultOpen>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {node.taints.map((t) => (
                      <TaintChip key={`${t.key}-${t.effect}`} taint={t} effectColors={effectColors} />
                    ))}
                  </Box>
                </CollapsibleSection>
              )}
            </>
          )}

          <Divider />

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
              slotProps={{ htmlInput: { sx: { fontSize: 13, py: 0.75 } } }}
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
                      <TableCell key={h} sx={{ fontWeight: 700, color: 'text.disabled', fontSize: 11, bgcolor: 'background.default', py: 0.75 }}>
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
                          sx={{ bgcolor: 'rgba(124,58,237,0.06)', borderBottom: '1px solid', borderColor: 'divider', py: 0.5 }}
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
                        <PodRow key={pod.name} pod={pod} onClick={() => setSelectedPod(pod)} showOwner />
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
