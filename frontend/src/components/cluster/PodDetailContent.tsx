'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Collapse from '@mui/material/Collapse'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import TerminalIcon from '@mui/icons-material/Terminal'
import { useIsDark } from '@/lib/useIsDark'
import { getPodDetail } from '@/lib/api'
import { fmtCpu, fmtMem, podAge, formatError } from '@/lib/formatters'
import { useColors } from '@/lib/colors'
import { POD_DETAIL_REFETCH_MS } from '@/lib/constants'
import PodLogViewer from './PodLogViewer'
import type { PodContainer, PodCondition, PodEvent } from '@/lib/types'

function resourceCell(req: number, limit: number, fmt: (n: number) => string) {
  const requestFormatted = req > 0 ? fmt(req) : '—'
  const limitFormatted = limit > 0 ? fmt(limit) : '∞'
  return `${requestFormatted} / ${limitFormatted}`
}

const CONDITION_ORDER = ['Ready', 'ContainersReady', 'Initialized', 'PodScheduled']
function conditionColor(status: PodCondition['status'], isDark: boolean) {
  if (status === 'True')  return { color: isDark ? '#22C55E' : '#15803D', bgcolor: isDark ? 'rgba(34,197,94,0.12)' : 'rgba(21,128,61,0.10)' }
  if (status === 'False') return { color: isDark ? '#F87171' : '#B91C1C', bgcolor: isDark ? 'rgba(248,113,113,0.12)' : 'rgba(185,28,28,0.10)' }
  return { color: isDark ? '#94A3B8' : '#475569', bgcolor: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(71,85,105,0.10)' }
}

// ── sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="caption"
      sx={{ color: 'text.disabled', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 10, display: 'block', mb: 1 }}
    >
      {children}
    </Typography>
  )
}

function ContainersSection({ containers }: { containers: PodContainer[] }) {
  const isDark = useIsDark()
  const colors = useColors()
  return (
    <Box>
      <SectionLabel>Containers</SectionLabel>
      <Box sx={{ overflowX: 'auto' }}>
      <Table size="small" sx={{ '& td, & th': { fontSize: 12 } }}>
        <TableHead>
          <TableRow>
            {['NAME', 'IMAGE', 'READY', 'RESTARTS', 'CPU req/lim', 'MEM req/lim', 'LAST STATE'].map((h) => (
              <TableCell key={h} sx={{ color: 'text.disabled', fontSize: 10, fontWeight: 700, py: 0.5, whiteSpace: 'nowrap' }}>
                {h}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {containers.map((c) => (
            <TableRow key={c.name} hover>
              <TableCell sx={{ fontFamily: 'monospace', py: 0.75, whiteSpace: 'nowrap' }}>{c.name}</TableCell>
              <TableCell sx={{ py: 0.75, maxWidth: 180 }}>
                <Tooltip title={c.image} arrow>
                  <Typography sx={{ fontSize: 11, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 170, display: 'block', color: 'text.secondary' }}>
                    {c.image.split('/').pop()}
                  </Typography>
                </Tooltip>
              </TableCell>
              <TableCell sx={{ py: 0.75 }}>
                <Box
                  role="img"
                  aria-label={c.ready ? 'Container ready' : 'Container not ready'}
                  sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c.ready ? colors.success : colors.errorLight }}
                />
              </TableCell>
              <TableCell sx={{ py: 0.75, fontFamily: 'monospace', color: c.restartCount > 0 ? (isDark ? '#FBBF24' : '#92400E') : 'text.primary' }}>
                {c.restartCount}
              </TableCell>
              <TableCell sx={{ py: 0.75, fontFamily: 'monospace', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                {resourceCell(c.cpuRequest, c.cpuLimit, fmtCpu)}
              </TableCell>
              <TableCell sx={{ py: 0.75, fontFamily: 'monospace', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                {resourceCell(c.memRequest, c.memLimit, fmtMem)}
              </TableCell>
              <TableCell sx={{ py: 0.75 }}>
                {c.lastState ? (
                  <Chip label={c.lastState} size="small" sx={{ height: 16, fontSize: 10, bgcolor: colors.errorBg, color: colors.errorLight }} />
                ) : (
                  <Typography
                    sx={{
                      color: "text.disabled",
                      fontSize: 12
                    }}>—</Typography>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </Box>
    </Box>
  );
}

function ConditionsSection({ conditions }: { conditions: PodCondition[] }) {
  const isDark = useIsDark()
  const ordered = [...conditions].sort(
    (a, b) => CONDITION_ORDER.indexOf(a.type) - CONDITION_ORDER.indexOf(b.type)
  )
  return (
    <Box>
      <SectionLabel>Conditions</SectionLabel>
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
        {ordered.map((c) => {
          const statusStyle = conditionColor(c.status, isDark)
          return (
            <Chip
              key={c.type}
              label={`${c.type}: ${c.status}`}
              size="small"
              sx={{ height: 20, fontSize: 11, bgcolor: statusStyle.bgcolor, color: statusStyle.color }}
            />
          )
        })}
      </Box>
    </Box>
  )
}

function EventsSection({ events }: { events: PodEvent[] }) {
  const isDark = useIsDark()
  const colors = useColors()
  if (!events?.length) return null
  return (
    <Box>
      <SectionLabel>Events</SectionLabel>
      <Table size="small" sx={{ '& td': { fontSize: 12 } }}>
        <TableBody>
          {events.map((e, i) => (
            <TableRow key={`${e.reason}-${e.message}-${i}`} sx={{ bgcolor: e.type === 'Warning' ? (isDark ? 'rgba(248,113,113,0.05)' : 'rgba(185,28,28,0.05)') : 'transparent' }}>
              <TableCell sx={{ py: 0.5, width: 70 }}>
                <Chip
                  label={e.type}
                  size="small"
                  sx={{
                    height: 16, fontSize: 10,
                    bgcolor: e.type === 'Warning' ? colors.errorBg : colors.successBg,
                    color: e.type === 'Warning' ? colors.errorLight : colors.success,
                  }}
                />
              </TableCell>
              <TableCell sx={{ py: 0.5, width: 100, color: 'text.secondary', fontFamily: 'monospace', fontSize: 11 }}>{e.reason}</TableCell>
              <TableCell sx={{ py: 0.5, color: e.type === 'Warning' ? colors.errorLight : 'text.primary' }}>{e.message}</TableCell>
              <TableCell sx={{ py: 0.5, width: 40, textAlign: 'right', color: 'text.disabled', fontSize: 11 }}>×{e.count}</TableCell>
              <TableCell sx={{ py: 0.5, width: 60, textAlign: 'right', color: 'text.disabled', fontSize: 11, whiteSpace: 'nowrap' }}>
                {podAge(e.lastSeen)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  )
}

function CollapsibleKVSection({ title, entries }: { title: string; entries: [string, string][] }) {
  const [open, setOpen] = useState(false)
  if (entries.length === 0) return null
  return (
    <Box>
      <Box
        onClick={() => setOpen((o) => !o)}
        sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none', mb: open ? 1 : 0 }}
      >
        <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 10, flex: 1 }}>
          {title} ({entries.length})
        </Typography>
        <IconButton size="small" sx={{ p: 0 }} aria-label={open ? 'Collapse section' : 'Expand section'}>
          <ExpandMoreIcon sx={{ fontSize: 16, color: 'text.disabled', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </IconButton>
      </Box>
      <Collapse in={open}>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {entries.map(([k, v]) => (
            <Tooltip key={k} title={`${k}=${v}`} arrow>
              <Chip label={`${k}=${v}`} size="small" sx={{ height: 18, fontSize: 10, fontFamily: 'monospace', maxWidth: 300 }} />
            </Tooltip>
          ))}
        </Box>
      </Collapse>
    </Box>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function PodDetailContent({ namespace, podName }: { namespace: string; podName: string }) {
  const colors = useColors()
  const [view, setView] = useState<'detail' | 'logs'>('detail')

  // Reset to detail view when pod changes
  useEffect(() => {
    setView('detail')
  }, [namespace, podName])

  const { data: pod, isLoading, isError, error } = useQuery({
    queryKey: queryKeys.podDetail(namespace, podName),
    queryFn: () => getPodDetail(namespace, podName),
    refetchInterval: POD_DETAIL_REFETCH_MS,
  })

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={28} />
      </Box>
    )
  }

  if (isError || !pod) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Failed to load pod: {formatError(error)}
      </Alert>
    )
  }

  if (view === 'logs') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <PodLogViewer
          namespace={namespace}
          podName={podName}
          containers={pod.containers ?? []}
          onBack={() => setView('detail')}
        />
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, p: 2.5 }}>
      {/* Overview row */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip
          label={pod.phase}
          size="small"
          sx={{
            height: 20, fontSize: 11,
            bgcolor: pod.phase === 'Running' ? colors.successBg : pod.phase === 'Pending' ? colors.warningBg : colors.errorBg,
            color: pod.phase === 'Running' ? colors.success : pod.phase === 'Pending' ? colors.warning : colors.errorLight,
          }}
        />
        {pod.qosClass && (
          <Chip label={pod.qosClass} size="small" sx={{ height: 20, fontSize: 11 }} />
        )}
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          variant="outlined"
          startIcon={<TerminalIcon sx={{ fontSize: '14px !important' }} />}
          onClick={() => setView('logs')}
          sx={{ fontSize: 11, textTransform: 'none', py: 0.25, px: 1.5 }}
        >
          Logs
        </Button>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        {[
          ['Node', pod.nodeName || '—'],
          ['Instance Type', pod.nodeInstanceType || '—'],
          ['Pod IP', pod.podIP || '—'],
          ['Host IP', pod.hostIP || '—'],
          ['Age', podAge(pod.startedAt)],
        ].map(([label, value]) => (
          <Box key={label}>
            <Typography
              variant="caption"
              sx={{
                color: "text.disabled",
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                display: 'block'
              }}>
              {label}
            </Typography>
            <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 12 }}>{value}</Typography>
          </Box>
        ))}
      </Box>
      <Divider />
      <ContainersSection containers={pod.containers ?? []} />
      {(pod.conditions ?? []).length > 0 && (
        <>
          <Divider />
          <ConditionsSection conditions={pod.conditions ?? []} />
        </>
      )}
      {(pod.events ?? []).length > 0 && (
        <>
          <Divider />
          <EventsSection events={pod.events ?? []} />
        </>
      )}
      {Object.keys(pod.labels ?? {}).length > 0 && (
        <>
          <Divider />
          <CollapsibleKVSection title="Labels" entries={Object.entries(pod.labels ?? {})} />
        </>
      )}
      {Object.keys(pod.annotations ?? {}).length > 0 && (
        <>
          <Divider />
          <CollapsibleKVSection title="Annotations" entries={Object.entries(pod.annotations ?? {})} />
        </>
      )}
    </Box>
  );
}
