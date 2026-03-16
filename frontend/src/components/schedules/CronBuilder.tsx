'use client'

import { useState, useEffect, useRef } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import CodeIcon from '@mui/icons-material/Code'
import ScheduleIcon from '@mui/icons-material/Schedule'
import { cronToText } from '@/lib/cronToText'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 45]

const DAY_TO_NUM: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 }
const NUM_TO_DAY: Record<number, string> = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' }

function daysToDow(days: string[]): string {
  if (days.length === 7) return '*'
  return days.map((d) => DAY_TO_NUM[d]).sort((a, b) => a - b).join(',')
}

function parseCronToVisual(expr: string): { days: string[]; hour: number; minute: number } | null {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return null
  const [min, hr, dom, mon, dow] = parts
  if (dom !== '*' || mon !== '*') return null
  if (!/^\d+$/.test(min) || !/^\d+$/.test(hr)) return null
  const minuteNum = Number(min)
  const hourNum = Number(hr)
  if (minuteNum < 0 || minuteNum > 59 || hourNum < 0 || hourNum > 23) return null
  if (!MINUTES.includes(minuteNum)) return null
  let days: string[]
  if (dow === '*') {
    days = [...DAYS]
  } else {
    const nums = new Set<number>()
    for (const part of dow.split(',')) {
      if (part.includes('-')) {
        const [lo, hi] = part.split('-').map(Number)
        for (let i = lo; i <= hi; i++) nums.add(i % 7)
      } else {
        const n = Number(part)
        if (isNaN(n)) return null
        nums.add(n % 7)
      }
    }
    const order = [1, 2, 3, 4, 5, 6, 0]
    days = order.filter((n) => nums.has(n)).map((n) => NUM_TO_DAY[n])
  }
  return { days, hour: hourNum, minute: minuteNum }
}

interface CronBuilderProps {
  value: string
  onChange: (cron: string) => void
  error?: boolean
}

export default function CronBuilder({ value, onChange, error }: CronBuilderProps) {
  const initial = parseCronToVisual(value)
  const [selectedDays, setSelectedDays] = useState<string[]>(
    initial ? initial.days : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  )
  const [hour, setHour] = useState(initial ? initial.hour : 19)
  const [minute, setMinute] = useState(initial ? initial.minute : 5)
  const [advanced, setAdvanced] = useState(!initial)
  const [rawCron, setRawCron] = useState(value)
  const skipSync = useRef(false)

  useEffect(() => {
    if (skipSync.current) {
      skipSync.current = false
      return
    }
    const visual = parseCronToVisual(value)
    if (visual) {
      setSelectedDays(visual.days)
      setHour(visual.hour)
      setMinute(visual.minute)
      setAdvanced(false)
    } else {
      setRawCron(value)
      setAdvanced(true)
    }
  }, [value])

  const generatedCron = `${minute} ${hour} * * ${daysToDow(selectedDays)}`
  const displayCron = advanced ? rawCron : generatedCron

  function emit(cron: string) {
    skipSync.current = true
    onChange(cron)
  }

  function toggleDay(day: string) {
    setSelectedDays((prev) => {
      const next = prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
      if (next.length === 0) return prev
      emit(`${minute} ${hour} * * ${daysToDow(next)}`)
      return next
    })
  }

  function handleHour(h: number) {
    setHour(h)
    emit(`${minute} ${h} * * ${daysToDow(selectedDays)}`)
  }

  function handleMinute(m: number) {
    setMinute(m)
    emit(`${m} ${hour} * * ${daysToDow(selectedDays)}`)
  }

  function handleAdvancedToggle(checked: boolean) {
    if (checked) {
      setRawCron(generatedCron)
      setAdvanced(true)
    } else {
      const visual = parseCronToVisual(rawCron)
      if (visual) {
        setSelectedDays(visual.days)
        setHour(visual.hour)
        setMinute(visual.minute)
        setAdvanced(false)
        emit(rawCron)
      }
    }
  }

  return (
    <Box sx={{ border: '1px solid', borderColor: error ? 'error.main' : 'divider', borderRadius: 1, p: 2 }}>
      {/* Header: label + advanced toggle */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          Schedule Timing
        </Typography>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={advanced}
              onChange={(e) => handleAdvancedToggle(e.target.checked)}
            />
          }
          label={<Typography variant="caption" color="text.secondary">Advanced raw cron</Typography>}
          labelPlacement="start"
          sx={{ m: 0, gap: 0.75 }}
        />
      </Stack>

      {advanced ? (
        /* Raw cron input */
        <TextField
          fullWidth
          size="small"
          label="Cron expression (5-field)"
          value={rawCron}
          onChange={(e) => { setRawCron(e.target.value); emit(e.target.value) }}
          placeholder="0 18 * * 1-5"
          error={error}
          slotProps={{
            htmlInput: { style: { fontFamily: 'monospace' } },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <CodeIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
                </InputAdornment>
              ),
            },
          }}
          helperText="minute  hour  day-of-month  month  day-of-week"
        />
      ) : (
        <>
          {/* Day picker */}
          <Typography variant="caption" color="text.disabled" display="block" mb={0.75}>
            Days of week
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ mb: 2 }}>
            {DAYS.map((day) => {
              const active = selectedDays.includes(day)
              return (
                <Box
                  key={day}
                  onClick={() => toggleDay(day)}
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
                  {day}
                </Box>
              )
            })}
          </Stack>

          {/* Time pickers */}
          <Typography variant="caption" color="text.disabled" display="block" mb={0.75}>
            Time
          </Typography>
          <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }}>
            <FormControl size="small" sx={{ width: 130 }}>
              <InputLabel>Hour</InputLabel>
              <Select value={hour} label="Hour" onChange={(e) => handleHour(Number(e.target.value))}>
                {HOURS.map((h) => (
                  <MenuItem key={h} value={h}>{String(h).padStart(2, '0')}:00</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ width: 130 }}>
              <InputLabel>Minute</InputLabel>
              <Select value={minute} label="Minute" onChange={(e) => handleMinute(Number(e.target.value))}>
                {MINUTES.map((m) => (
                  <MenuItem key={m} value={m}>:{String(m).padStart(2, '0')}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          {/* Live preview */}
          <Box
            sx={{
              p: 1.5,
              bgcolor: 'background.default',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Stack direction="row" alignItems="flex-start" spacing={1}>
              <ScheduleIcon sx={{ color: 'primary.main', fontSize: 18, mt: 0.25 }} />
              <Box>
                <Typography variant="caption" color="text.disabled">Preview</Typography>
                <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.4 }}>
                  {cronToText(displayCron)}
                </Typography>
                <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace' }}>
                  {displayCron}
                </Typography>
              </Box>
            </Stack>
          </Box>
        </>
      )}
    </Box>
  )
}
