'use client'

import type React from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Switch from '@mui/material/Switch'
import Chip from '@mui/material/Chip'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined'
import AddIcon from '@mui/icons-material/Add'
import { useIsDark } from '@/lib/useIsDark'
import type { SleepWindow } from '@/lib/types'
import { windowsToText, isOvernight } from '@/lib/windowUtils'

const MAX_WINDOWS = 10

const DAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]

const DAY_NAMES_BY_VALUE = Object.fromEntries(DAYS.map(d => [d.value, d.label]))

function deriveWindowPlaceholder(w: SleepWindow, idx: number): string {
  if (w.daysOfWeek.length === 0) return `Window ${idx + 1}`

  const sorted = [...w.daysOfWeek].sort((a, b) => a - b)
  const isWeekdays = sorted.length === 5 && [1, 2, 3, 4, 5].every(d => sorted.includes(d))
  const isWeekends = sorted.length === 2 && sorted[0] === 0 && sorted[1] === 6
  const isDaily = sorted.length === 7

  let dayPart: string
  if (isDaily) dayPart = 'Daily'
  else if (isWeekdays) dayPart = 'Weekday'
  else if (isWeekends) dayPart = 'Weekend'
  else dayPart = sorted.map(d => DAY_NAMES_BY_VALUE[d]).join(', ')

  if (w.allDay) return isWeekdays ? 'Weekdays' : isWeekends ? 'Weekends' : dayPart

  const startHour = parseInt(w.startTime.split(':')[0], 10)
  let timePart: string
  if (startHour >= 17 || startHour < 4) timePart = 'Nights'
  else if (startHour >= 4 && startHour < 9) timePart = 'Mornings'
  else if (startHour >= 9 && startHour < 13) timePart = 'Midday'
  else timePart = 'Afternoons'

  return `${dayPart} ${timePart}`
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

function parseHM(time: string): [number, number] {
  const [h, m] = time.split(':').map(Number)
  return [h, m]
}

function toHM(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

interface Preset {
  label: string
  windows: SleepWindow[]
}

const PRESETS: Preset[] = [
  {
    label: 'Business hours',
    windows: [
      { name: 'After Hours', daysOfWeek: [1, 2, 3, 4, 5], startTime: '17:00', endTime: '09:00', allDay: false },
      { name: 'Weekends', daysOfWeek: [0, 6], startTime: '00:00', endTime: '00:00', allDay: true },
    ],
  },
  {
    label: 'Weekday nights',
    windows: [{ name: 'Weekday Nights', daysOfWeek: [1, 2, 3, 4, 5], startTime: '19:00', endTime: '07:00', allDay: false }],
  },
  {
    label: 'Weekends',
    windows: [{ name: 'Weekends', daysOfWeek: [0, 6], startTime: '00:00', endTime: '00:00', allDay: true }],
  },
]

// ── WindowCard sub-component ─────────────────────────────────────────────────

function WindowCard({
  window,
  idx,
  totalWindows,
  onUpdate,
  onRemove,
  onToggleDay,
}: {
  window: SleepWindow
  idx: number
  totalWindows: number
  onUpdate: (idx: number, patch: Partial<SleepWindow>) => void
  onRemove: (idx: number) => void
  onToggleDay: (windowIdx: number, day: number) => void
}) {
  const isDark = useIsDark()
  const [sH, sM] = window.allDay ? [0, 0] : parseHM(window.startTime)
  const [eH, eM] = window.allDay ? [0, 0] : parseHM(window.endTime)
  const overnightWin = !window.allDay && isOvernight(window)

  return (
    <Box
      sx={{
        mb: 1.5,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      {/* Header bar */}
      <Box
        sx={{
          px: 2,
          py: 1,
          bgcolor: isDark ? 'rgba(30, 30, 46, 0.6)' : 'rgba(0, 0, 0, 0.03)',
          borderBottom: '1px solid',
          borderColor: 'divider',
          borderTop: '1px solid',
          borderTopColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box
          component="input"
          value={window.name ?? ''}
          placeholder={totalWindows === 1 ? 'Sleep Window' : deriveWindowPlaceholder(window, idx)}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(idx, { name: e.target.value || undefined })}
          sx={{
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'text.secondary',
            fontSize: '0.68rem',
            fontFamily: 'inherit',
            border: 'none',
            outline: 'none',
            bgcolor: 'transparent',
            p: 0,
            width: '100%',
            maxWidth: 220,
            '&::placeholder': { color: 'text.disabled', opacity: 1 },
            '&:hover': { color: 'text.primary' },
            '&:focus': { color: 'text.primary' },
          }}
        />
        {totalWindows > 1 && (
          <IconButton
            size="small"
            onClick={() => onRemove(idx)}
            aria-label={`Remove ${window.name || deriveWindowPlaceholder(window, idx)}`}
            sx={{ ml: 0.5, p: 0.25 }}
          >
            <DeleteOutlineIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
      </Box>
      {/* Card body */}
      <Box sx={{ px: 2, py: 1.5 }}>
        {/* All-day toggle — slide switch */}
        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: "center",
            mb: 1.5
          }}>
          <Switch
            checked={window.allDay}
            onChange={e => onUpdate(idx, { allDay: e.target.checked })}
            size="small"
            aria-label="Toggle all day"
          />
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}>
              All day
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: "text.disabled",
                fontSize: 11,
                lineHeight: 1.2
              }}>
              No wake-up on selected days
            </Typography>
          </Box>
        </Stack>

        {/* Compact time pickers — only shown when not all-day */}
        {!window.allDay && (
          <Stack
            direction="row"
            spacing={1}
            sx={{
              alignItems: "center",
              mb: 1.5
            }}>
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                fontWeight: 600,
                fontSize: 11
              }}>
              Sleep
            </Typography>
            <TextField
              select size="small" value={sH}
              onChange={e => onUpdate(idx, { startTime: toHM(Number(e.target.value), sM) })}
              aria-label="Sleep hour"
              sx={{ width: 68, '& .MuiInputBase-input': { fontSize: 13, py: 0.75 } }}
            >
              {HOURS.map(h => <MenuItem key={h} value={h}>{String(h).padStart(2, '0')}</MenuItem>)}
            </TextField>
            <Typography
              sx={{
                color: "text.disabled",
                fontSize: 13,
                mx: -0.5
              }}>:</Typography>
            <TextField
              select size="small" value={sM}
              onChange={e => onUpdate(idx, { startTime: toHM(sH, Number(e.target.value)) })}
              aria-label="Sleep minute"
              sx={{ width: 62, '& .MuiInputBase-input': { fontSize: 13, py: 0.75 } }}
            >
              {MINUTES.map(m => <MenuItem key={m} value={m}>{String(m).padStart(2, '0')}</MenuItem>)}
            </TextField>

            <Box sx={{ width: 12 }} />

            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                fontWeight: 600,
                fontSize: 11
              }}>
              Wake
            </Typography>
            <TextField
              select size="small" value={eH}
              onChange={e => onUpdate(idx, { endTime: toHM(Number(e.target.value), eM) })}
              aria-label="Wake hour"
              sx={{ width: 68, '& .MuiInputBase-input': { fontSize: 13, py: 0.75 } }}
            >
              {HOURS.map(h => <MenuItem key={h} value={h}>{String(h).padStart(2, '0')}</MenuItem>)}
            </TextField>
            <Typography
              sx={{
                color: "text.disabled",
                fontSize: 13,
                mx: -0.5
              }}>:</Typography>
            <TextField
              select size="small" value={eM}
              onChange={e => onUpdate(idx, { endTime: toHM(eH, Number(e.target.value)) })}
              aria-label="Wake minute"
              sx={{ width: 62, '& .MuiInputBase-input': { fontSize: 13, py: 0.75 } }}
            >
              {MINUTES.map(m => <MenuItem key={m} value={m}>{String(m).padStart(2, '0')}</MenuItem>)}
            </TextField>

            {overnightWin && (
              <Chip label="next day" size="small"
                sx={{ fontSize: 10, height: 18, bgcolor: 'rgba(99,102,241,0.15)', color: isDark ? '#a5b4fc' : '#4F46E5' }}
              />
            )}
          </Stack>
        )}

        {/* Day buttons — slightly larger with active glow */}
        <Stack direction="row" spacing={0.75} sx={{
          alignItems: "center"
        }}>
          {DAYS.map(({ value, label }) => {
            const active = window.daysOfWeek.includes(value)
            return (
              <Box
                key={value}
                role="button"
                tabIndex={0}
                aria-label={`${label}${active ? ' (selected)' : ''}`}
                aria-pressed={active}
                onClick={() => onToggleDay(idx, value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onToggleDay(idx, value)
                  }
                }}
                sx={{
                  px: 1.75,
                  py: 1,
                  minWidth: 44,
                  minHeight: 44,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 1.5,
                  cursor: 'pointer',
                  border: '1px solid',
                  borderColor: active ? 'primary.main' : 'divider',
                  bgcolor: active ? 'rgba(124,58,237,0.15)' : 'transparent',
                  color: active ? 'primary.light' : 'text.disabled',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  userSelect: 'none',
                  transition: 'all 0.15s',
                  boxShadow: active
                    ? '0 0 0 1px rgba(124,58,237,0.15)'
                    : 'none',
                  '&:hover': {
                    borderColor: active ? 'primary.main' : 'text.disabled',
                    bgcolor: active ? 'rgba(124,58,237,0.2)' : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'),
                  },
                }}
              >
                {label}
              </Box>
            )
          })}
        </Stack>
      </Box>
    </Box>
  );
}

// ── WindowPicker ─────────────────────────────────────────────────────────────

function windowStableKey(w: SleepWindow, idx: number): string {
  return `${w.startTime}-${w.endTime}-${w.daysOfWeek.join(',')}-${idx}`
}

export default function WindowPicker({
  windows,
  onChange,
}: {
  windows: SleepWindow[]
  onChange: (windows: SleepWindow[]) => void
}) {
  function updateWindow(idx: number, patch: Partial<SleepWindow>) {
    onChange(windows.map((w, i) => (i === idx ? { ...w, ...patch } : w)))
  }

  function toggleDay(windowIdx: number, day: number) {
    const w = windows[windowIdx]
    const days = w.daysOfWeek.includes(day)
      ? w.daysOfWeek.filter(d => d !== day)
      : [...w.daysOfWeek, day]
    updateWindow(windowIdx, { daysOfWeek: days })
  }

  function addWindow() {
    onChange([...windows, { daysOfWeek: [], startTime: '19:00', endTime: '07:00', allDay: false }])
  }

  function removeWindow(idx: number) {
    onChange(windows.filter((_, i) => i !== idx))
  }

  // Check if all active windows are allDay on all 7 days (never-wake warning)
  const activeWindows = windows.filter(w => w.daysOfWeek.length > 0)
  const allDaysScheduled = new Set(activeWindows.flatMap(w => w.daysOfWeek))
  const neverWakes = activeWindows.length > 0 && activeWindows.every(w => w.allDay) && allDaysScheduled.size === 7

  return (
    <Box>
      {/* Presets — pill buttons with dots */}
      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        sx={{
          flexWrap: "wrap",
          mb: 2
        }}>
        {PRESETS.map(preset => (
          <Button
            key={preset.label}
            variant="text"
            size="small"
            onClick={() => onChange(preset.windows)}
            sx={{
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: '999px',
              px: 2,
              py: 0.75,
              minHeight: 34,
              bgcolor: 'rgba(124,58,237,0.08)',
              color: 'text.secondary',
              border: '1px solid',
              borderColor: 'rgba(124,58,237,0.12)',
              '&:hover': {
                bgcolor: 'rgba(124,58,237,0.18)',
                borderColor: 'rgba(124,58,237,0.3)',
              },
              '&::before': {
                content: '""',
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                bgcolor: 'primary.main',
                mr: 1,
                flexShrink: 0,
              },
            }}
          >
            {preset.label}
          </Button>
        ))}
      </Stack>
      {/* Window cards */}
      {windows.map((w, idx) => (
        <WindowCard
          key={windowStableKey(w, idx)}
          window={w}
          idx={idx}
          totalWindows={windows.length}
          onUpdate={updateWindow}
          onRemove={removeWindow}
          onToggleDay={toggleDay}
        />
      ))}
      <Button size="small" startIcon={<AddIcon />} onClick={addWindow} disabled={windows.length >= MAX_WINDOWS} sx={{ mt: 0.5, mb: 1 }}>
        {windows.length >= MAX_WINDOWS ? `Limit reached (${MAX_WINDOWS})` : 'Add window'}
      </Button>
      {/* Summary */}
      {windows.length > 0 && windows.some(w => w.daysOfWeek.length > 0) && (
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            mt: 0.5
          }}>
          {windowsToText(windows)}
        </Typography>
      )}
      {/* Never-wake warning */}
      {neverWakes && (
        <Typography
          variant="caption"
          sx={{
            color: "warning.main",
            mt: 0.5,
            display: 'block'
          }}>
          All 7 days are set to all-day sleep — workloads will never wake up automatically.
        </Typography>
      )}
    </Box>
  );
}
