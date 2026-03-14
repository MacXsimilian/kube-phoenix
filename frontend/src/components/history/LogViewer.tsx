'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Tooltip from '@mui/material/Tooltip'
import Snackbar from '@mui/material/Snackbar'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableRow from '@mui/material/TableRow'
import CloseIcon from '@mui/icons-material/Close'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import DnsIcon from '@mui/icons-material/Dns'
import StorageIcon from '@mui/icons-material/Storage'
import ReportProblemIcon from '@mui/icons-material/ReportProblem'
import { getExecutionLogs, wsLogsUrl } from '@/lib/api'
import type { Execution, LogLine } from '@/lib/types'

const LEVEL_COLORS: Record<LogLine['level'], string> = {
  info: '#22D3EE',
  ok: '#22C55E',
  plan: '#C084FC',
  error: '#F87171',
  warn: '#FBBF24',
}

// ── Summary parsing ──────────────────────────────────────────────────────────

type WorkloadEntry = {
  kind: 'Deployment' | 'StatefulSet'
  ns: string
  name: string
  to: number
  action: 'scaled' | 'restored' | 'plan'
}

type NodeEntry = {
  name: string
  action: 'drained' | 'deleted' | 'plan' | 'protected'
}

type ParsedSummary = {
  workloads: WorkloadEntry[]
  nodes: NodeEntry[]
  errors: string[]
}

function parseSummary(lines: LogLine[]): ParsedSummary {
  const workloads: WorkloadEntry[] = []
  const nodeMap = new Map<string, NodeEntry>()
  const errors: string[] = []

  for (const line of lines) {
    const m = line.message

    // scale-down: "Scaled Deployment ns/name → 0"
    const scaled = m.match(/^Scaled (Deployment|StatefulSet) (\S+)\/(\S+) → (\d+)$/)
    if (scaled) {
      workloads.push({ kind: scaled[1] as WorkloadEntry['kind'], ns: scaled[2], name: scaled[3], to: parseInt(scaled[4]), action: 'scaled' })
      continue
    }

    // scale-up: "Restored Deployment ns/name → N"
    const restored = m.match(/^Restored (Deployment|StatefulSet) (\S+)\/(\S+) → (\d+)$/)
    if (restored) {
      workloads.push({ kind: restored[1] as WorkloadEntry['kind'], ns: restored[2], name: restored[3], to: parseInt(restored[4]), action: 'restored' })
      continue
    }

    // plan: "Would scale|restore Deployment ns/name → N"
    const planned = m.match(/^Would (?:scale|restore) (Deployment|StatefulSet) (\S+)\/(\S+) → (\d+)$/)
    if (planned) {
      workloads.push({ kind: planned[1] as WorkloadEntry['kind'], ns: planned[2], name: planned[3], to: parseInt(planned[4]), action: 'plan' })
      continue
    }

    // nodes
    const drained = m.match(/^Drained node (\S+)$/)
    if (drained) { nodeMap.set(drained[1], { name: drained[1], action: 'drained' }); continue }

    const deleted = m.match(/^Deleted node object (\S+)$/)
    if (deleted) { nodeMap.set(deleted[1], { name: deleted[1], action: 'deleted' }); continue }

    const wouldDrain = m.match(/^Would drain node (\S+)/)
    if (wouldDrain && !nodeMap.has(wouldDrain[1])) { nodeMap.set(wouldDrain[1], { name: wouldDrain[1], action: 'plan' }); continue }

    const protected_ = m.match(/^Protected node (\S+)/)
    if (protected_) { nodeMap.set(protected_[1], { name: protected_[1], action: 'protected' }); continue }

    if (line.level === 'error') errors.push(m)
  }

  return { workloads, nodes: Array.from(nodeMap.values()), errors }
}

const ACTION_CHIP: Record<WorkloadEntry['action'], { label: string; color: string }> = {
  scaled:   { label: '→ 0',     color: '#7C3AED' },
  restored: { label: 'restored', color: '#22C55E' },
  plan:     { label: 'plan',     color: '#3B82F6' },
}

const NODE_CHIP: Record<NodeEntry['action'], { label: string; color: string }> = {
  drained:   { label: 'drained',   color: '#F59E0B' },
  deleted:   { label: 'deleted',   color: '#EF4444' },
  plan:      { label: 'plan',      color: '#3B82F6' },
  protected: { label: 'protected', color: '#6B7280' },
}

function ExecutionSummary({ lines, isRunning }: { lines: LogLine[]; isRunning: boolean }) {
  const { workloads, nodes, errors } = parseSummary(lines)

  if (workloads.length === 0 && nodes.length === 0 && errors.length === 0) return null

  // Group workloads by namespace
  const byNs = workloads.reduce<Record<string, WorkloadEntry[]>>((acc, w) => {
    ;(acc[w.ns] ??= []).push(w)
    return acc
  }, {})

  return (
    <Accordion
      defaultExpanded={!isRunning}
      disableGutters
      sx={{
        bgcolor: 'background.paper',
        '&:before': { display: 'none' },
        borderBottom: '1px solid',
        borderColor: 'divider',
        boxShadow: 'none',
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />}
        sx={{ minHeight: 40, px: 2.5, py: 0, '& .MuiAccordionSummary-content': { my: 0, display: 'flex', alignItems: 'center', gap: 1 } }}
      >
        <Typography variant="caption" fontWeight={700} letterSpacing={0.8} sx={{ color: 'text.secondary', textTransform: 'uppercase' }}>
          Summary
        </Typography>
        {(workloads.length + nodes.length) > 0 && (
          <Chip
            label={workloads.length + nodes.length}
            size="small"
            sx={{ height: 16, fontSize: 10, bgcolor: 'rgba(124,58,237,0.2)', color: 'primary.main', '& .MuiChip-label': { px: 0.75 } }}
          />
        )}
        {errors.length > 0 && (
          <Chip
            label={`${errors.length} err`}
            size="small"
            sx={{ height: 16, fontSize: 10, bgcolor: 'rgba(248,113,113,0.15)', color: '#F87171', '& .MuiChip-label': { px: 0.75 } }}
          />
        )}
      </AccordionSummary>

      <AccordionDetails sx={{ p: 0, pb: 1.5, maxHeight: 320, overflowY: 'auto' }}>
        {/* Workloads */}
        {workloads.length > 0 && (
          <Box sx={{ px: 2.5, pt: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
              <DnsIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                WORKLOADS ({workloads.length})
              </Typography>
            </Box>
            {Object.entries(byNs).map(([ns, items]) => (
              <Box key={ns} sx={{ mb: 1 }}>
                <Typography variant="caption" sx={{ color: '#94A3B8', pl: 0.5, fontFamily: 'monospace', display: 'block', mb: 0.25 }}>
                  {ns}
                </Typography>
                <Table size="small" sx={{ '& td': { border: 0, py: 0.25, px: 0.5 } }}>
                  <TableBody>
                    {items.map((w, i) => {
                      const chip = ACTION_CHIP[w.action]
                      return (
                        <TableRow key={i}>
                          <TableCell sx={{ width: 90, pr: 1 }}>
                            <Typography variant="caption" sx={{ color: '#64748B', fontFamily: 'monospace', fontSize: 11 }}>
                              {w.kind}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ flex: 1 }}>
                            <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 12, color: '#E2E8F0' }}>
                              {w.name}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ width: 70, textAlign: 'right' }}>
                            <Chip
                              label={w.action === 'restored' ? `→ ${w.to}` : chip.label}
                              size="small"
                              sx={{ height: 16, fontSize: 10, bgcolor: `${chip.color}22`, color: chip.color, '& .MuiChip-label': { px: 0.75 } }}
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </Box>
            ))}
          </Box>
        )}

        {/* Nodes */}
        {nodes.length > 0 && (
          <Box sx={{ px: 2.5, pt: workloads.length > 0 ? 1 : 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
              <StorageIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                NODES ({nodes.length})
              </Typography>
            </Box>
            <Table size="small" sx={{ '& td': { border: 0, py: 0.25, px: 0.5 } }}>
              <TableBody>
                {nodes.map((n, i) => {
                  const chip = NODE_CHIP[n.action]
                  return (
                    <TableRow key={i}>
                      <TableCell sx={{ flex: 1 }}>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 12, color: '#E2E8F0' }}>
                          {n.name}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ width: 70, textAlign: 'right' }}>
                        <Chip
                          label={chip.label}
                          size="small"
                          sx={{ height: 16, fontSize: 10, bgcolor: `${chip.color}22`, color: chip.color, '& .MuiChip-label': { px: 0.75 } }}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Box>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <Box sx={{ px: 2, pt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {errors.map((e, i) => (
              <Alert key={i} severity="error" sx={{ py: 0, fontSize: 11 }}>
                {e}
              </Alert>
            ))}
          </Box>
        )}
      </AccordionDetails>
    </Accordion>
  )
}

// ── Log line row ──────────────────────────────────────────────────────────────

function LogLineRow({ line }: { line: LogLine }) {
  return (
    <Box
      component="div"
      sx={{
        fontFamily: 'monospace',
        fontSize: 12,
        lineHeight: 1.7,
        color: LEVEL_COLORS[line.level] ?? '#CBD5E1',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}
    >
      <Box component="span" sx={{ opacity: 0.4, mr: 1.5, userSelect: 'none' }}>
        {new Date(line.timestamp).toLocaleTimeString()}
      </Box>
      {line.message}
    </Box>
  )
}

export default function LogViewer({
  execution,
  onClose,
}: {
  execution: Execution | null
  onClose: () => void
}) {
  const [liveLines, setLiveLines] = useState<LogLine[]>([])
  const [copied, setCopied] = useState(false)
  const [wsError, setWsError] = useState(false)
  const [drawerWidth, setDrawerWidth] = useState(640)
  const [currentErrorIdx, setCurrentErrorIdx] = useState(-1)
  const bottomRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const lineEls = useRef<(HTMLElement | null)[]>([])

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = drawerWidth

    const onMouseMove = (mv: MouseEvent) => {
      const delta = startX - mv.clientX
      const next = Math.min(Math.max(startWidth + delta, 360), window.innerWidth * 0.9)
      setDrawerWidth(Math.round(next))
    }
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [drawerWidth])

  const isRunning = execution?.status === 'running'

  const { data: historicLines = [], isError: logsError } = useQuery({
    queryKey: ['logs', execution?.id],
    queryFn: () => getExecutionLogs(execution!.id),
    enabled: !!execution && !isRunning,
  })

  // Reset error cursor when switching executions
  useEffect(() => {
    setCurrentErrorIdx(-1)
    lineEls.current = []
  }, [execution?.id])

  // WebSocket for live executions
  useEffect(() => {
    if (!execution || !isRunning) return
    setLiveLines([])
    setWsError(false)

    const ws = new WebSocket(wsLogsUrl(execution.id))
    wsRef.current = ws

    ws.onmessage = (e) => {
      try {
        const line: LogLine = JSON.parse(e.data)
        setLiveLines((prev) => [...prev, line])
      } catch {
        // ignore parse errors
      }
    }
    ws.onerror = () => {
      setWsError(true)
      ws.close()
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [execution?.id, isRunning])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [liveLines, historicLines])

  const lines = isRunning ? liveLines : historicLines

  const errorIndices = lines.reduce<number[]>((acc, l, i) => {
    if (l.level === 'error') acc.push(i)
    return acc
  }, [])

  function jumpToError() {
    if (errorIndices.length === 0) return
    const next = (currentErrorIdx + 1) % errorIndices.length
    setCurrentErrorIdx(next)
    lineEls.current[errorIndices[next]]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function handleCopy() {
    const text = lines
      .map((l) => `${new Date(l.timestamp).toLocaleTimeString()}  ${l.message}`)
      .join('\n')
    navigator.clipboard.writeText(text).then(() => setCopied(true)).catch(() => {})
  }

  return (
    <>
      <Drawer
        anchor="right"
        open={!!execution}
        onClose={onClose}
        PaperProps={{
          sx: {
            width: { xs: '100vw', md: drawerWidth },
            bgcolor: 'background.paper',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'visible',
          },
        }}
      >
        {/* Resize handle */}
        <Box
          onMouseDown={handleResizeMouseDown}
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

        {execution && (
          <>
            {/* Header */}
            <Box sx={{ p: 2.5, display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  {execution.schedule?.type === 'scale_down' ? (
                    <BedtimeIcon sx={{ color: 'primary.main', fontSize: 18 }} />
                  ) : (
                    <WbSunnyIcon sx={{ color: 'warning.main', fontSize: 18 }} />
                  )}
                  <Typography variant="subtitle1" fontWeight={700}>
                    {execution.schedule?.name ?? 'Execution'} #{execution.id}
                  </Typography>
                  {isRunning && <CircularProgress size={14} />}
                </Box>
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                  <Chip
                    label={execution.mode.toUpperCase()}
                    size="small"
                    sx={{
                      height: 18, fontSize: 10,
                      bgcolor: execution.mode === 'apply' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)',
                      color: execution.mode === 'apply' ? 'warning.main' : 'info.main',
                    }}
                  />
                  {execution.schedule?.type === 'scale_up' ? (
                    <Chip
                      icon={<ArrowUpwardIcon sx={{ fontSize: '12px !important' }} />}
                      label={`${execution.countScaled} restored`}
                      size="small"
                      sx={{ height: 18, fontSize: 10 }}
                    />
                  ) : (
                    <Chip
                      icon={<ArrowDownwardIcon sx={{ fontSize: '12px !important' }} />}
                      label={`${execution.countScaled} scaled`}
                      size="small"
                      sx={{ height: 18, fontSize: 10 }}
                    />
                  )}
                  {execution.countDrained > 0 && (
                    <Chip
                      icon={<CloudOffIcon sx={{ fontSize: '12px !important' }} />}
                      label={`${execution.countDrained} drained`}
                      size="small"
                      sx={{ height: 18, fontSize: 10 }}
                    />
                  )}
                  {execution.countErrors > 0 && (
                    <Chip
                      icon={<ErrorOutlineIcon sx={{ fontSize: '12px !important' }} />}
                      label={`${execution.countErrors} errors`}
                      size="small"
                      color="error"
                      sx={{ height: 18, fontSize: 10 }}
                    />
                  )}
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {errorIndices.length > 0 && (
                  <Tooltip title={`Jump to error${errorIndices.length > 1 ? ` (${currentErrorIdx === -1 ? 1 : currentErrorIdx + 1}/${errorIndices.length})` : ''}`}>
                    <IconButton size="small" onClick={jumpToError} aria-label="Jump to error">
                      <ReportProblemIcon fontSize="small" sx={{ color: '#F87171' }} />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Copy logs">
                  <span>
                    <IconButton size="small" onClick={handleCopy} disabled={lines.length === 0} aria-label="Copy logs">
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <IconButton size="small" onClick={onClose} aria-label="Close log viewer">
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>

            <Divider />

            <ExecutionSummary lines={lines} isRunning={isRunning} />

            {/* Log area */}
            {wsError && (
              <Alert severity="error" sx={{ borderRadius: 0 }}>
                WebSocket connection lost. Logs may be incomplete.
              </Alert>
            )}
            {logsError && !isRunning && (
              <Alert severity="warning" sx={{ borderRadius: 0 }}>
                Could not load logs — they may have been pruned.
              </Alert>
            )}
            <Box sx={{ flex: 1, overflow: 'auto', p: 2, bgcolor: '#0A0A0F' }}>
              {lines.length === 0 && !isRunning && !logsError && (
                <Typography variant="body2" color="text.secondary">
                  No log lines found.
                </Typography>
              )}
              {lines.map((line, i) => (
                <Box key={`${line.id ?? line.seq}-${i}`} ref={(el) => { lineEls.current[i] = el as HTMLElement | null }}>
                  <LogLineRow line={line} />
                </Box>
              ))}
              <div ref={bottomRef} />
            </Box>
          </>
        )}
      </Drawer>

      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        message="Logs copied to clipboard"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  )
}
