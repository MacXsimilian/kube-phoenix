'use client'

import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import EventIcon from '@mui/icons-material/Event'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']
const DEFAULT_START_TIME = '09:00'
const DEFAULT_END_TIME = '17:00'

export type ExceptionWindowValue = {
  startISO: string
  endISO: string
}

type Props = {
  value: ExceptionWindowValue
  onChange: (next: ExceptionWindowValue) => void
  minDate?: Date
}

function startOfDay(d: Date): Date {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  return out
}

function addMonths(d: Date, n: number): Date {
  const out = new Date(d)
  out.setMonth(out.getMonth() + n)
  return out
}

function addHours(d: Date, n: number): Date {
  const out = new Date(d)
  out.setHours(out.getHours() + n)
  return out
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '0m'
  const mins = Math.floor(ms / 60000)
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  const parts: string[] = []
  if (d) parts.push(`${d}d`)
  if (h) parts.push(`${h}h`)
  if (m) parts.push(`${m}m`)
  return parts.join(' ')
}

function formatDateChip(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function buildMonthGrid(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const gridStart = new Date(first)
  gridStart.setDate(1 - ((first.getDay() + 6) % 7))
  const days: Date[] = []
  for (let i = 0; i < 42; i++) {
    days.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i))
  }
  return days
}

function timeOf(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function combineDateTime(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(n => parseInt(n, 10) || 0)
  const out = new Date(day)
  out.setHours(h, m, 0, 0)
  return out
}

function parseISO(iso: string): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d
}

type MonthProps = {
  anchor: Date
  startDay: Date | null
  endDay: Date | null
  hoverDay: Date | null
  minDate?: Date
  onPick: (d: Date) => void
  onHover: (d: Date | null) => void
}

function MonthView({ anchor, startDay, endDay, hoverDay, minDate, onPick, onHover }: MonthProps) {
  const days = useMemo(() => buildMonthGrid(anchor), [anchor])
  const today = startOfDay(new Date())
  const minDay = minDate ? startOfDay(minDate) : null
  const previewEnd = !endDay && startDay && hoverDay && hoverDay > startDay ? hoverDay : null

  return (
    <Box sx={{ flex: 1, minWidth: 240 }}>
      <Typography variant="subtitle2" fontWeight={700} sx={{ textAlign: 'center', mb: 1 }}>
        {monthLabel(anchor)}
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.25 }}>
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
          <Typography key={d} variant="caption" color="text.disabled" sx={{ textAlign: 'center', py: 0.5, fontWeight: 600 }}>
            {d}
          </Typography>
        ))}
        {days.map((d, idx) => {
          const inMonth = d.getMonth() === anchor.getMonth()
          const isBeforeMin = minDay ? d < minDay : false
          const isToday = sameDay(d, today)
          const isStart = startDay && sameDay(d, startDay)
          const isEnd = endDay && sameDay(d, endDay)
          const inRange = startDay && endDay && d >= startDay && d <= endDay
          const inPreview = startDay && previewEnd && d > startDay && d <= previewEnd
          const isPreviewEnd = previewEnd && sameDay(d, previewEnd)
          const selected = isStart || isEnd
          const disabled = isBeforeMin || !inMonth

          return (
            <Box
              key={idx}
              onClick={() => !disabled && onPick(d)}
              onMouseEnter={() => !disabled && onHover(d)}
              onMouseLeave={() => onHover(null)}
              sx={{
                position: 'relative',
                textAlign: 'center',
                py: 0.75,
                borderRadius: 1,
                cursor: disabled ? 'default' : 'pointer',
                fontSize: 13,
                fontWeight: selected || isToday ? 600 : 400,
                color: !inMonth
                  ? 'text.disabled'
                  : isBeforeMin
                    ? 'text.disabled'
                    : selected
                      ? 'primary.contrastText'
                      : 'text.primary',
                bgcolor: selected
                  ? 'primary.main'
                  : inRange
                    ? 'action.selected'
                    : inPreview
                      ? 'action.hover'
                      : 'transparent',
                border: '1px solid',
                borderColor: isToday && !selected ? 'primary.main' : isPreviewEnd ? 'primary.light' : 'transparent',
                borderStyle: isPreviewEnd ? 'dashed' : 'solid',
                opacity: disabled ? 0.4 : 1,
                transition: 'background-color 120ms ease, border-color 120ms ease',
                '&:hover': disabled
                  ? undefined
                  : {
                      bgcolor: selected ? 'primary.dark' : 'action.hover',
                    },
              }}
            >
              {d.getDate()}
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

type TimeStepperProps = {
  label: string
  value: string
  onChange: (v: string) => void
}

function TimeStepper({ label, value, onChange }: TimeStepperProps) {
  const [hh, mm] = value.split(':')

  function step(deltaMin: number) {
    const total = parseInt(hh, 10) * 60 + parseInt(mm, 10) + deltaMin
    const wrapped = ((total % 1440) + 1440) % 1440
    const h = String(Math.floor(wrapped / 60)).padStart(2, '0')
    const m = String(wrapped % 60).padStart(2, '0')
    onChange(`${h}:${m}`)
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 36, fontWeight: 600 }}>
        {label}
      </Typography>
      <Tooltip title="−15 min">
        <IconButton size="small" onClick={() => step(-15)} sx={{ width: 24, height: 24, fontSize: 14 }}>−</IconButton>
      </Tooltip>
      <TextField
        select
        size="small"
        value={hh}
        onChange={e => onChange(`${e.target.value}:${mm}`)}
        sx={{ width: 68 }}
        slotProps={{ select: { MenuProps: { PaperProps: { sx: { maxHeight: 280 } } } } }}
      >
        {HOURS.map(h => <MenuItem key={h} value={h}>{h}</MenuItem>)}
      </TextField>
      <Typography sx={{ color: 'text.secondary' }}>:</Typography>
      <TextField
        select
        size="small"
        value={mm}
        onChange={e => onChange(`${hh}:${e.target.value}`)}
        sx={{ width: 68 }}
        slotProps={{ select: { MenuProps: { PaperProps: { sx: { maxHeight: 280 } } } } }}
      >
        {MINUTES.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
      </TextField>
      <Tooltip title="+15 min">
        <IconButton size="small" onClick={() => step(15)} sx={{ width: 24, height: 24, fontSize: 14 }}>+</IconButton>
      </Tooltip>
    </Box>
  )
}

export default function ExceptionWindowPicker({ value, onChange, minDate }: Props) {
  const startDate = parseISO(value.startISO)
  const endDate = parseISO(value.endISO)
  const startDay = startDate ? startOfDay(startDate) : null
  const endDay = endDate ? startOfDay(endDate) : null
  const startTime = startDate ? timeOf(startDate) : DEFAULT_START_TIME
  const endTime = endDate ? timeOf(endDate) : DEFAULT_END_TIME

  const [anchor, setAnchor] = useState<Date>(startOfDay(startDate ?? new Date()))
  const [hoverDay, setHoverDay] = useState<Date | null>(null)

  function emit(nextStartDay: Date | null, nextEndDay: Date | null, nextStartTime: string, nextEndTime: string) {
    onChange({
      startISO: nextStartDay ? combineDateTime(nextStartDay, nextStartTime).toISOString() : '',
      endISO: nextEndDay ? combineDateTime(nextEndDay, nextEndTime).toISOString() : '',
    })
  }

  function pickDay(d: Date) {
    if (!startDay || (startDay && endDay)) {
      emit(d, null, startTime, endTime)
      return
    }
    if (d < startDay) {
      emit(d, startDay, startTime, endTime)
      return
    }
    let nextEndTime = endTime
    if (sameDay(d, startDay)) {
      const sStart = combineDateTime(d, startTime)
      const sEnd = combineDateTime(d, endTime)
      if (sEnd <= sStart) {
        const bumped = addHours(sStart, 1)
        nextEndTime = `${String(bumped.getHours()).padStart(2, '0')}:${String(bumped.getMinutes()).padStart(2, '0')}`
      }
    }
    emit(startDay, d, startTime, nextEndTime)
  }

  function setStartTime(v: string) { emit(startDay, endDay, v, endTime) }
  function setEndTime(v: string) { emit(startDay, endDay, startTime, v) }

  function clearSelection() {
    onChange({ startISO: '', endISO: '' })
    setHoverDay(null)
  }

  const duration = startDate && endDate && endDate > startDate
    ? formatDuration(endDate.getTime() - startDate.getTime())
    : null

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography variant="subtitle2" fontWeight={700}>Exception Window</Typography>
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          {(startDay || endDay) && (
            <Button size="small" onClick={clearSelection} sx={{ color: 'text.secondary', mr: 1 }}>
              Clear
            </Button>
          )}
          <Tooltip title="Previous month">
            <IconButton size="small" onClick={() => setAnchor(addMonths(anchor, -1))}>
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Jump to today">
            <IconButton size="small" onClick={() => setAnchor(startOfDay(new Date()))}>
              <EventIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Next month">
            <IconButton size="small" onClick={() => setAnchor(addMonths(anchor, 1))}>
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Paper
        variant="outlined"
        sx={{
          px: 2,
          py: 1.25,
          mb: 2,
          bgcolor: 'action.hover',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          flexWrap: 'wrap',
        }}
      >
        {startDate ? (
          <>
            <Box>
              <Typography variant="caption" color="text.disabled" sx={{ display: 'block', lineHeight: 1 }}>FROM</Typography>
              <Typography variant="body2" fontWeight={600}>
                {formatDateChip(startDate)} · {formatTime(startDate)}
              </Typography>
            </Box>
            <ArrowForwardIcon fontSize="small" sx={{ color: 'text.disabled' }} />
            <Box>
              <Typography variant="caption" color="text.disabled" sx={{ display: 'block', lineHeight: 1 }}>TO</Typography>
              <Typography variant="body2" fontWeight={600}>
                {endDate ? `${formatDateChip(endDate)} · ${formatTime(endDate)}` : 'Pick end day…'}
              </Typography>
            </Box>
            {duration && (
              <Chip
                label={duration}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ ml: 'auto', fontWeight: 600 }}
              />
            )}
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Click a day on the calendar to start the window.
          </Typography>
        )}
      </Paper>

      <Box sx={{ display: 'flex', gap: 3 }}>
        <MonthView
          anchor={anchor}
          startDay={startDay}
          endDay={endDay}
          hoverDay={hoverDay}
          minDate={minDate}
          onPick={pickDay}
          onHover={setHoverDay}
        />
        <MonthView
          anchor={addMonths(anchor, 1)}
          startDay={startDay}
          endDay={endDay}
          hoverDay={hoverDay}
          minDate={minDate}
          onPick={pickDay}
          onHover={setHoverDay}
        />
      </Box>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        <TimeStepper label="Start" value={startTime} onChange={setStartTime} />
        <TimeStepper label="End" value={endTime} onChange={setEndTime} />
      </Box>

      <Typography variant="caption" color="text.disabled" sx={{ mt: 1.5, display: 'block' }}>
        Timezone: {TZ}
      </Typography>
    </Paper>
  )
}
