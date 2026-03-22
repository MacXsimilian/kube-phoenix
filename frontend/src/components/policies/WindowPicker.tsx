'use client'

import React from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
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
    windows: [{ daysOfWeek: [1, 2, 3, 4, 5], startTime: '19:00', endTime: '07:00' }],
  },
  {
    label: 'Weekends',
    windows: [{ daysOfWeek: [0, 6], startTime: '00:00', endTime: '23:59' }],
  },
  {
    label: 'Nights + weekends',
    windows: [
      { daysOfWeek: [1, 2, 3, 4, 5], startTime: '19:00', endTime: '07:00' },
      { daysOfWeek: [0, 6], startTime: '00:00', endTime: '23:59' },
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
    const next = windows.map((w, i) => (i === idx ? { ...w, ...patch } : w))
    // V1 constraint: sync times across all windows
    if (patch.startTime !== undefined || patch.endTime !== undefined) {
      const ref = next[idx] // This already has the patch applied
      for (let i = 0; i < next.length; i++) {
        if (i === idx) continue // skip the already-patched window
        if (patch.startTime !== undefined) next[i] = { ...next[i], startTime: ref.startTime }
        if (patch.endTime !== undefined) next[i] = { ...next[i], endTime: ref.endTime }
      }
    }
    onChange(next)
  }

  function toggleDay(windowIdx: number, day: number) {
    const w = windows[windowIdx]
    const days = w.daysOfWeek.includes(day)
      ? w.daysOfWeek.filter(d => d !== day)
      : [...w.daysOfWeek, day]
    updateWindow(windowIdx, { daysOfWeek: days })
  }

  function addWindow() {
    const ref = windows[0] ?? { startTime: '19:00', endTime: '07:00' }
    onChange([...windows, { daysOfWeek: [], startTime: ref.startTime, endTime: ref.endTime }])
  }

  function removeWindow(idx: number) {
    onChange(windows.filter((_, i) => i !== idx))
  }

  const [startH, startM] = windows[0] ? parseHM(windows[0].startTime) : [19, 0]
  const [endH, endM] = windows[0] ? parseHM(windows[0].endTime) : [7, 0]
  const overnight = windows[0] ? isOvernight(windows[0]) : false

  return (
    <Box>
      {/* Presets */}
      <Stack direction="row" spacing={0.75} sx={{ mb: 1.5 }}>
        {PRESETS.map(preset => (
          <Chip
            key={preset.label}
            label={preset.label}
            size="small"
            onClick={() => onChange(preset.windows)}
            sx={{
              fontSize: 11,
              cursor: 'pointer',
              bgcolor: 'rgba(124,58,237,0.08)',
              '&:hover': { bgcolor: 'rgba(124,58,237,0.18)' },
            }}
          />
        ))}
      </Stack>

      {/* Shared time pickers */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 50 }}>
          Sleep at
        </Typography>
        <TextField
          select
          size="small"
          value={startH}
          onChange={e => {
            const t = toHM(Number(e.target.value), startM)
            windows.forEach((_, i) => updateWindow(i, { startTime: t }))
          }}
          sx={{ width: 80 }}
        >
          {HOURS.map(h => (
            <MenuItem key={h} value={h}>
              {String(h).padStart(2, '0')}
            </MenuItem>
          ))}
        </TextField>
        <Typography color="text.disabled">:</Typography>
        <TextField
          select
          size="small"
          value={startM}
          onChange={e => {
            const t = toHM(startH, Number(e.target.value))
            windows.forEach((_, i) => updateWindow(i, { startTime: t }))
          }}
          sx={{ width: 72 }}
        >
          {MINUTES.map(m => (
            <MenuItem key={m} value={m}>
              {String(m).padStart(2, '0')}
            </MenuItem>
          ))}
        </TextField>

        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 55, ml: 1 }}>
          Wake at
        </Typography>
        <TextField
          select
          size="small"
          value={endH}
          onChange={e => {
            const t = toHM(Number(e.target.value), endM)
            windows.forEach((_, i) => updateWindow(i, { endTime: t }))
          }}
          sx={{ width: 80 }}
        >
          {HOURS.map(h => (
            <MenuItem key={h} value={h}>
              {String(h).padStart(2, '0')}
            </MenuItem>
          ))}
        </TextField>
        <Typography color="text.disabled">:</Typography>
        <TextField
          select
          size="small"
          value={endM}
          onChange={e => {
            const t = toHM(endH, Number(e.target.value))
            windows.forEach((_, i) => updateWindow(i, { endTime: t }))
          }}
          sx={{ width: 72 }}
        >
          {MINUTES.map(m => (
            <MenuItem key={m} value={m}>
              {String(m).padStart(2, '0')}
            </MenuItem>
          ))}
        </TextField>

        {overnight && (
          <Chip
            label="next day"
            size="small"
            sx={{ fontSize: 10, height: 18, bgcolor: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}
          />
        )}
      </Stack>

      {/* Per-window day selectors */}
      {windows.map((w, idx) => (
        <Box key={idx} sx={{ mb: 1.5 }}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Typography variant="caption" color="text.disabled" sx={{ minWidth: 50 }}>
              {windows.length > 1 ? `Days ${idx + 1}` : 'Days'}
            </Typography>
            {DAYS.map(({ value, label }) => {
              const active = w.daysOfWeek.includes(value)
              return (
                <Box
                  key={value}
                  onClick={() => toggleDay(idx, value)}
                  sx={{
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 1,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: active ? 'primary.main' : 'divider',
                    bgcolor: active ? 'rgba(124,58,237,0.15)' : 'transparent',
                    color: active ? 'primary.light' : 'text.disabled',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    userSelect: 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  {label}
                </Box>
              )
            })}
            {windows.length > 1 && (
              <IconButton size="small" onClick={() => removeWindow(idx)} sx={{ ml: 0.5 }}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>
        </Box>
      ))}

      <Button size="small" startIcon={<AddIcon />} onClick={addWindow} sx={{ mt: 0.5, mb: 1 }}>
        Add day group
      </Button>

      {/* Summary */}
      {windows.length > 0 && windows.some(w => w.daysOfWeek.length > 0) && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {windowsToText(windows)}
        </Typography>
      )}
    </Box>
  )
}
