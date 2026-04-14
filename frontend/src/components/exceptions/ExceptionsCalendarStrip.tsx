'use client'

import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Collapse from '@mui/material/Collapse'
import Tooltip from '@mui/material/Tooltip'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import HistoryIcon from '@mui/icons-material/History'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import { fmtDt } from '@/lib/formatters'
import type { ScheduledException } from '@/lib/types'
import { TypeChip, StatusChipEx } from '@/components/exceptions/ExceptionChips'
import ExceptionActions from '@/components/exceptions/ExceptionActions'
import ExceptionDetailPanel from '@/components/exceptions/ExceptionDetailPanel'

// ── Helpers ──────────────────────────────────────────────────────────────────

function dayLabel(d: Date) {
  const today = new Date()
  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const tDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const diff = Math.round((dDay - tDay) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function shortDate(d: Date) {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function durationLabel(startsAt: string, endsAt: string): string {
  const ms = new Date(endsAt).getTime() - new Date(startsAt).getTime()
  const hours = Math.floor(ms / 3600000)
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    const rem = hours % 24
    return rem > 0 ? `${days}d ${rem}h` : `${days}d`
  }
  const mins = Math.floor((ms % 3600000) / 60000)
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

function timeOfDay(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isMultiDay(ex: ScheduledException): boolean {
  const s = new Date(ex.startsAt); s.setHours(0, 0, 0, 0)
  const e = new Date(ex.endsAt); e.setHours(0, 0, 0, 0)
  return e.getTime() > s.getTime()
}

// ── Row model ───────────────────────────────────────────────────────────────

type CalendarRow =
  | { type: 'day'; date: Date; key: string; exceptions: ScheduledException[] }
  | { type: 'span'; exception: ScheduledException; startDate: Date; endDate: Date }

function buildRows(exceptions: ScheduledException[]): CalendarRow[] {
  const singleDayByDate = new Map<string, ScheduledException[]>()
  const spans: CalendarRow[] = []

  for (const ex of exceptions) {
    if (isMultiDay(ex)) {
      const s = new Date(ex.startsAt); s.setHours(0, 0, 0, 0)
      const e = new Date(ex.endsAt); e.setHours(0, 0, 0, 0)
      spans.push({ type: 'span', exception: ex, startDate: s, endDate: e })
    } else {
      const d = new Date(ex.startsAt); d.setHours(0, 0, 0, 0)
      const k = dayKey(d)
      const arr = singleDayByDate.get(k) ?? []
      arr.push(ex)
      singleDayByDate.set(k, arr)
    }
  }

  const rows: CalendarRow[] = []
  for (const [k, exs] of singleDayByDate) {
    rows.push({ type: 'day', date: new Date(k + 'T00:00:00'), key: k, exceptions: exs })
  }
  rows.push(...spans)
  rows.sort((a, b) => {
    const aTime = a.type === 'day' ? a.date.getTime() : a.startDate.getTime()
    const bTime = b.type === 'day' ? b.date.getTime() : b.startDate.getTime()
    return aTime - bTime
  })
  return rows
}

// ── Styling ──────────────────────────────────────────────────────────────────

const TYPE_BG: Record<string, string> = {
  stay_awake: 'rgba(245,158,11,0.10)',
  force_sleep: 'rgba(239,68,68,0.10)',
}
const TYPE_BORDER: Record<string, string> = {
  stay_awake: 'rgba(245,158,11,0.35)',
  force_sleep: 'rgba(239,68,68,0.35)',
}
const TYPE_ACCENT: Record<string, string> = {
  stay_awake: 'rgba(245,158,11,0.6)',
  force_sleep: 'rgba(239,68,68,0.6)',
}

// ── Main component ──────────────────────────────────────────────────────────

export default function ExceptionsCalendarStrip({
  exceptions,
  isDark,
  canEdit,
  onEdit,
  onCancel,
}: {
  exceptions: ScheduledException[]
  isDark: boolean
  canEdit: boolean
  onEdit: (ex: ScheduledException) => void
  onCancel: (ex: ScheduledException) => void
}) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const { current, past } = useMemo(() => {
    const cur: ScheduledException[] = []
    const old: ScheduledException[] = []
    for (const ex of exceptions) {
      if (ex.status === 'completed' || ex.status === 'cancelled') old.push(ex)
      else cur.push(ex)
    }
    return { current: cur, past: old }
  }, [exceptions])

  const currentRows = useMemo(() => buildRows(current), [current])
  const pastRows = useMemo(() => buildRows(past), [past])
  const todayStr = dayKey(new Date())

  return (
    <>
      {/* ── History (collapsed) ───────────────────────────────── */}
      {past.length > 0 && (
        <>
          <Box
            onClick={() => setHistoryOpen(!historyOpen)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1, py: 1.5, px: 0.5,
              cursor: 'pointer', userSelect: 'none',
              mb: currentRows.length > 0 ? 1 : 0,
            }}
          >
            <HistoryIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                color: "text.secondary"
              }}>History</Typography>
            <Typography variant="caption" sx={{ bgcolor: 'action.hover', borderRadius: 1, px: 0.75, fontWeight: 600, fontSize: 11, color: 'text.disabled' }}>
              {past.length}
            </Typography>
            <Box sx={{ flex: 1 }} />
            <ExpandMoreIcon fontSize="small" sx={{ color: 'text.disabled', transform: historyOpen ? 'rotate(180deg)' : 'none', transition: '.2s' }} />
          </Box>
          <Collapse in={historyOpen}>
            <Box sx={{ mb: currentRows.length > 0 ? 2 : 0 }}>
              <RowList rows={pastRows} todayKey={todayStr} isDark={isDark} canEdit={canEdit} onEdit={onEdit} onCancel={onCancel} expandedId={expandedId} onToggleExpand={setExpandedId} dimmed />
            </Box>
          </Collapse>
        </>
      )}
      {/* ── Active + Upcoming ─────────────────────────────────── */}
      {currentRows.length > 0 && (
        <RowList rows={currentRows} todayKey={todayStr} isDark={isDark} canEdit={canEdit} onEdit={onEdit} onCancel={onCancel} expandedId={expandedId} onToggleExpand={setExpandedId} />
      )}
    </>
  );
}

// ── Row list ─────────────────────────────────────────────────────────────────

function RowList({
  rows, todayKey, isDark, canEdit, onEdit, onCancel, expandedId, onToggleExpand, dimmed,
}: {
  rows: CalendarRow[]
  todayKey: string
  isDark: boolean
  canEdit: boolean
  onEdit: (ex: ScheduledException) => void
  onCancel: (ex: ScheduledException) => void
  expandedId: number | null
  onToggleExpand: (id: number | null) => void
  dimmed?: boolean
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0, opacity: dimmed ? 0.55 : 1 }}>
      {rows.map((row) => {
        if (row.type === 'day') {
          return (
            <DayRow
              key={`day-${row.key}`}
              date={row.date} dateKey={row.key} exceptions={row.exceptions}
              isToday={row.key === todayKey} isDark={isDark} canEdit={canEdit}
              onEdit={onEdit} onCancel={onCancel}
              expandedId={expandedId} onToggleExpand={onToggleExpand}
            />
          )
        }
        return (
          <SpanRow
            key={`span-${row.exception.id}`}
            ex={row.exception} startDate={row.startDate} endDate={row.endDate}
            isDark={isDark} canEdit={canEdit} onEdit={onEdit} onCancel={onCancel}
            expandedId={expandedId} onToggleExpand={onToggleExpand}
          />
        )
      })}
    </Box>
  )
}

// ── Exception block (shared between day + span rows) ────────────────────────

function ExceptionBlock({
  ex, isDark, canEdit, onEdit, onCancel, isExpanded, onToggle,
}: {
  ex: ScheduledException
  isDark: boolean
  canEdit: boolean
  onEdit: () => void
  onCancel: () => void
  isExpanded: boolean
  onToggle: () => void
}) {
  const hasTargets = ex.workloadTargets && ex.workloadTargets.length > 0
  return (
    <Box
      onClick={onToggle}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, borderRadius: 1, cursor: 'pointer',
        bgcolor: TYPE_BG[ex.exceptionType] ?? 'action.hover',
        border: '1px solid', borderColor: TYPE_BORDER[ex.exceptionType] ?? 'divider',
        '&:hover': { borderColor: isExpanded ? undefined : 'text.disabled' },
      }}
    >
      <TypeChip isDark={isDark} type={ex.exceptionType} />
      <StatusChipEx status={ex.status} isDark={isDark} />
      {ex.ticketRef && (
        <Chip label={ex.ticketRef} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 600, height: 18 }} />
      )}
      <Chip
        icon={<AccessTimeIcon sx={{ fontSize: '11px !important' }} />}
        label={durationLabel(ex.startsAt, ex.endsAt)}
        size="small"
        sx={{ fontSize: 10, height: 18, bgcolor: 'action.hover' }}
      />
      {hasTargets && (
        <Chip label={`${ex.workloadTargets!.length} targets`} size="small" sx={{ fontSize: 10, height: 18 }} />
      )}
      <Tooltip title={`${fmtDt(ex.startsAt)} → ${fmtDt(ex.endsAt)}`}>
        <Typography
          variant="caption"
          noWrap
          sx={{
            color: "text.secondary",
            flex: 1
          }}>{ex.reason || '—'}</Typography>
      </Tooltip>
      <Typography
        variant="caption"
        sx={{
          color: "text.disabled",
          whiteSpace: 'nowrap',
          fontSize: 11,
          fontFamily: 'monospace'
        }}>
        {timeOfDay(ex.startsAt)}–{timeOfDay(ex.endsAt)}
      </Typography>
      <ExceptionActions ex={ex} canEdit={canEdit} onEdit={onEdit} onCancel={onCancel} />
      <ExpandMoreIcon sx={{ fontSize: 16, color: 'text.disabled', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: '.2s' }} />
    </Box>
  );
}

// ── Single-day row ──────────────────────────────────────────────────────────

function DayRow({
  date, dateKey, exceptions, isToday, isDark, canEdit, onEdit, onCancel, expandedId, onToggleExpand,
}: {
  date: Date; dateKey: string; exceptions: ScheduledException[]; isToday: boolean
  isDark: boolean; canEdit: boolean
  onEdit: (ex: ScheduledException) => void; onCancel: (ex: ScheduledException) => void
  expandedId: number | null; onToggleExpand: (id: number | null) => void
}) {
  return (
    <>
      <Box sx={{ display: 'flex', gap: 0, borderBottom: '1px solid', borderColor: 'divider', bgcolor: isToday ? 'rgba(108,140,255,0.03)' : 'transparent' }}>
        <Box sx={{ width: 120, flexShrink: 0, py: 1.5, pr: 2, textAlign: 'right', borderRight: '2px solid', borderColor: isToday ? 'primary.main' : 'divider' }}>
          <Typography
            variant="body2"
            color={isToday ? 'primary.main' : 'text.secondary'}
            sx={{
              fontWeight: isToday ? 700 : 500,
              fontSize: 13
            }}>{dayLabel(date)}</Typography>
          <Typography variant="caption" sx={{
            color: "text.disabled"
          }}>{shortDate(date)}</Typography>
        </Box>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, py: 1.5, pl: 2, pr: 1 }}>
          {exceptions.map(ex => (
            <ExceptionBlock
              key={ex.id} ex={ex} isDark={isDark} canEdit={canEdit}
              onEdit={() => onEdit(ex)} onCancel={() => onCancel(ex)}
              isExpanded={expandedId === ex.id}
              onToggle={() => onToggleExpand(expandedId === ex.id ? null : ex.id)}
            />
          ))}
        </Box>
      </Box>
      {exceptions.filter(ex => expandedId === ex.id).map(ex => (
        <Collapse key={`detail-${ex.id}`} in>
          <ExceptionDetailPanel ex={ex} />
        </Collapse>
      ))}
    </>
  );
}

// ── Multi-day span row ──────────────────────────────────────────────────────

function SpanRow({
  ex, startDate, endDate, isDark, canEdit, onEdit, onCancel, expandedId, onToggleExpand,
}: {
  ex: ScheduledException; startDate: Date; endDate: Date
  isDark: boolean; canEdit: boolean
  onEdit: (ex: ScheduledException) => void; onCancel: (ex: ScheduledException) => void
  expandedId: number | null; onToggleExpand: (id: number | null) => void
}) {
  const isExpanded = expandedId === ex.id
  return (
    <>
      <Box sx={{ display: 'flex', gap: 0, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{
          width: 120, flexShrink: 0, py: 1.5, pr: 2, textAlign: 'right',
          borderRight: '3px solid', borderColor: TYPE_ACCENT[ex.exceptionType] ?? 'divider',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
        }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: "text.secondary",
              fontSize: 13,
              lineHeight: 1.3
            }}>{dayLabel(startDate)}</Typography>
          <Typography
            variant="caption"
            sx={{
              color: "text.disabled",
              fontSize: 10
            }}>{shortDate(startDate)}</Typography>
          <Box sx={{ borderTop: '1px dashed', borderColor: 'divider', my: 0.5, width: '60%', ml: 'auto' }} />
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: "text.secondary",
              fontSize: 13,
              lineHeight: 1.3
            }}>{dayLabel(endDate)}</Typography>
          <Typography
            variant="caption"
            sx={{
              color: "text.disabled",
              fontSize: 10
            }}>{shortDate(endDate)}</Typography>
        </Box>
        <Box sx={{ flex: 1, py: 1.5, pl: 2, pr: 1 }}>
          <ExceptionBlock
            ex={ex} isDark={isDark} canEdit={canEdit}
            onEdit={() => onEdit(ex)} onCancel={() => onCancel(ex)}
            isExpanded={isExpanded}
            onToggle={() => onToggleExpand(isExpanded ? null : ex.id)}
          />
        </Box>
      </Box>
      <Collapse in={isExpanded}>
        <ExceptionDetailPanel ex={ex} />
      </Collapse>
    </>
  );
}
