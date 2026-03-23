'use client'

import React from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Switch from '@mui/material/Switch'
import Chip from '@mui/material/Chip'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import AddIcon from '@mui/icons-material/Add'
import type { SleepWindow } from '@/lib/types'
import { windowsToText, isOvernight } from '@/lib/windowUtils'

const DAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]

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
    label: 'Weekday nights',
    windows: [{ daysOfWeek: [1, 2, 3, 4, 5], startTime: '19:00', endTime: '07:00', allDay: false }],
  },
  {
    label: 'Weekends',
    windows: [{ daysOfWeek: [0, 6], startTime: '00:00', endTime: '00:00', allDay: true }],
  },
  {
    label: 'Nights + weekends',
    windows: [
      { daysOfWeek: [1, 2, 3, 4, 5], startTime: '19:00', endTime: '07:00', allDay: false },
      { daysOfWeek: [0, 6], startTime: '00:00', endTime: '00:00', allDay: true },
    ],
  },
  {
    label: 'Business hours',
    windows: [
      { daysOfWeek: [1, 2, 3, 4, 5], startTime: '17:00', endTime: '09:00', allDay: false },
      { daysOfWeek: [0, 6], startTime: '00:00', endTime: '00:00', allDay: true },
    ],
  },
]

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
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
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
      {windows.map((w, idx) => {
        const [sH, sM] = w.allDay ? [0, 0] : parseHM(w.startTime)
        const [eH, eM] = w.allDay ? [0, 0] : parseHM(w.endTime)
        const overnightWin = !w.allDay && isOvernight(w)
        return (
          <Box
            key={idx}
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
                bgcolor: 'rgba(30, 30, 46, 0.6)',
                borderBottom: '1px solid',
                borderColor: 'divider',
                borderTop: '2px solid',
                borderTopColor: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'text.secondary',
                  fontSize: '0.68rem',
                }}
              >
                {windows.length === 1 ? 'Sleep Window' : `Window ${idx + 1}`}
              </Typography>
              {windows.length > 1 && (
                <IconButton
                  size="small"
                  onClick={() => removeWindow(idx)}
                  aria-label={`Remove window ${idx + 1}`}
                  sx={{ ml: 0.5, p: 0.25 }}
                >
                  <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                </IconButton>
              )}
            </Box>

            {/* Card body */}
            <Box sx={{ px: 2, py: 1.5 }}>
              {/* All-day toggle — slide switch */}
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                <Switch
                  checked={w.allDay}
                  onChange={e => updateWindow(idx, { allDay: e.target.checked })}
                  size="small"
                  aria-label="Toggle all day"
                />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}>
                    All day
                  </Typography>
                  <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11, lineHeight: 1.2 }}>
                    No wake-up on selected days
                  </Typography>
                </Box>
              </Stack>

              {/* Compact time pickers — only shown when not all-day */}
              {!w.allDay && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, fontSize: 11 }}>
                    Sleep
                  </Typography>
                  <TextField
                    select size="small" value={sH}
                    onChange={e => updateWindow(idx, { startTime: toHM(Number(e.target.value), sM) })}
                    aria-label="Sleep hour"
                    sx={{ width: 68, '& .MuiInputBase-input': { fontSize: 13, py: 0.75 } }}
                  >
                    {HOURS.map(h => <MenuItem key={h} value={h}>{String(h).padStart(2, '0')}</MenuItem>)}
                  </TextField>
                  <Typography color="text.disabled" sx={{ fontSize: 13, mx: -0.5 }}>:</Typography>
                  <TextField
                    select size="small" value={sM}
                    onChange={e => updateWindow(idx, { startTime: toHM(sH, Number(e.target.value)) })}
                    aria-label="Sleep minute"
                    sx={{ width: 62, '& .MuiInputBase-input': { fontSize: 13, py: 0.75 } }}
                  >
                    {MINUTES.map(m => <MenuItem key={m} value={m}>{String(m).padStart(2, '0')}</MenuItem>)}
                  </TextField>

                  <Box sx={{ width: 12 }} />

                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, fontSize: 11 }}>
                    Wake
                  </Typography>
                  <TextField
                    select size="small" value={eH}
                    onChange={e => updateWindow(idx, { endTime: toHM(Number(e.target.value), eM) })}
                    aria-label="Wake hour"
                    sx={{ width: 68, '& .MuiInputBase-input': { fontSize: 13, py: 0.75 } }}
                  >
                    {HOURS.map(h => <MenuItem key={h} value={h}>{String(h).padStart(2, '0')}</MenuItem>)}
                  </TextField>
                  <Typography color="text.disabled" sx={{ fontSize: 13, mx: -0.5 }}>:</Typography>
                  <TextField
                    select size="small" value={eM}
                    onChange={e => updateWindow(idx, { endTime: toHM(eH, Number(e.target.value)) })}
                    aria-label="Wake minute"
                    sx={{ width: 62, '& .MuiInputBase-input': { fontSize: 13, py: 0.75 } }}
                  >
                    {MINUTES.map(m => <MenuItem key={m} value={m}>{String(m).padStart(2, '0')}</MenuItem>)}
                  </TextField>

                  {overnightWin && (
                    <Chip label="next day" size="small"
                      sx={{ fontSize: 10, height: 18, bgcolor: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}
                    />
                  )}
                </Stack>
              )}

              {/* Day buttons — slightly larger with active glow */}
              <Stack direction="row" spacing={0.75} alignItems="center">
                {DAYS.map(({ value, label }) => {
                  const active = w.daysOfWeek.includes(value)
                  return (
                    <Box
                      key={value}
                      role="button"
                      tabIndex={0}
                      aria-label={`${label}${active ? ' (selected)' : ''}`}
                      aria-pressed={active}
                      onClick={() => toggleDay(idx, value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          toggleDay(idx, value)
                        }
                      }}
                      sx={{
                        px: 1.75,
                        py: 1,
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
                          bgcolor: active ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
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
        )
      })}

      <Button size="small" startIcon={<AddIcon />} onClick={addWindow} sx={{ mt: 0.5, mb: 1 }}>
        Add window
      </Button>

      {/* Summary */}
      {windows.length > 0 && windows.some(w => w.daysOfWeek.length > 0) && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {windowsToText(windows)}
        </Typography>
      )}

      {/* Never-wake warning */}
      {neverWakes && (
        <Typography variant="caption" color="warning.main" sx={{ mt: 0.5, display: 'block' }}>
          All 7 days are set to all-day sleep — workloads will never wake up automatically.
        </Typography>
      )}
    </Box>
  )
}
