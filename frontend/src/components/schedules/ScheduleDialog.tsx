'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import { createSchedule, updateSchedule } from '@/lib/api'
import { cronToText } from '@/lib/cronToText'
import type { Schedule, ScheduleInput } from '@/lib/types'

const TIMEZONES = [
  'UTC', 'Europe/Budapest', 'Europe/London', 'Europe/Berlin', 'Europe/Paris',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Asia/Tokyo', 'Asia/Singapore', 'Asia/Shanghai', 'Australia/Sydney',
]

const DEFAULTS: ScheduleInput = {
  name: '',
  type: 'scale_down',
  cronExpr: '5 19 * * 1-5',
  timezone: 'Europe/Budapest',
  mode: 'plan',
  enabled: false,
  namespaceFilter: '',
}

export default function ScheduleDialog({
  open,
  schedule,
  defaultType,
  onClose,
}: {
  open: boolean
  schedule?: Schedule
  defaultType?: 'scale_down' | 'scale_up'
  onClose: () => void
}) {
  const qc = useQueryClient()
  const isEdit = !!schedule

  const [form, setForm] = useState<ScheduleInput>(DEFAULTS)

  useEffect(() => {
    if (open) {
      setForm(
        schedule
          ? {
              name: schedule.name,
              type: schedule.type,
              cronExpr: schedule.cronExpr,
              timezone: schedule.timezone,
              mode: schedule.mode,
              enabled: schedule.enabled,
              namespaceFilter: schedule.namespaceFilter,
            }
          : { ...DEFAULTS, type: defaultType ?? 'scale_down' }
      )
    }
  }, [open, schedule, defaultType])

  const set = <K extends keyof ScheduleInput>(key: K, value: ScheduleInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const mutation = useMutation({
    mutationFn: () =>
      isEdit ? updateSchedule(schedule!.id, form) : createSchedule(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules'] })
      onClose()
    },
  })

  const isSleep = form.type === 'scale_down'

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { bgcolor: 'background.paper' } }}
    >
      <DialogTitle fontWeight={700}>
        {isEdit ? 'Edit Schedule' : `New ${isSleep ? 'Sleep' : 'Wake'} Schedule`}
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 0.5 }}>
          {/* Type (only for new schedules) */}
          {!isEdit && (
            <Box>
              <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                Type
              </Typography>
              <ToggleButtonGroup
                value={form.type}
                exclusive
                onChange={(_, v) => v && set('type', v)}
                size="small"
                fullWidth
              >
                <ToggleButton value="scale_down">🌙 Sleep (Scale Down)</ToggleButton>
                <ToggleButton value="scale_up">☀️ Wake (Scale Up)</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          )}

          {/* Name */}
          <TextField
            label="Name"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            fullWidth
            size="small"
            placeholder={isSleep ? 'e.g. Weekday Sleep' : 'e.g. Weekday Wake'}
          />

          {/* Cron expression */}
          <TextField
            label="Cron Expression"
            value={form.cronExpr}
            onChange={(e) => set('cronExpr', e.target.value)}
            fullWidth
            size="small"
            helperText={cronToText(form.cronExpr)}
            inputProps={{ style: { fontFamily: 'monospace' } }}
          />

          {/* Timezone */}
          <TextField
            select
            label="Timezone"
            value={form.timezone}
            onChange={(e) => set('timezone', e.target.value)}
            fullWidth
            size="small"
          >
            {TIMEZONES.map((tz) => (
              <MenuItem key={tz} value={tz}>{tz}</MenuItem>
            ))}
          </TextField>

          {/* Mode */}
          <Box>
            <Typography variant="caption" color="text.secondary" display="block" mb={1}>
              Execution Mode
            </Typography>
            <ToggleButtonGroup
              value={form.mode}
              exclusive
              onChange={(_, v) => v && set('mode', v)}
              size="small"
              fullWidth
            >
              <ToggleButton value="plan">Plan (dry-run)</ToggleButton>
              <ToggleButton
                value="apply"
                sx={{ '&.Mui-selected': { bgcolor: 'rgba(245,158,11,0.18)', color: 'warning.main' } }}
              >
                Apply (live)
              </ToggleButton>
            </ToggleButtonGroup>
            {form.mode === 'apply' && (
              <Alert severity="warning" sx={{ mt: 1, py: 0.5 }}>
                Apply mode will make real changes to your cluster.
              </Alert>
            )}
          </Box>

          {/* Namespace filter */}
          <TextField
            label="Namespace Filter (optional)"
            value={form.namespaceFilter}
            onChange={(e) => set('namespaceFilter', e.target.value)}
            fullWidth
            size="small"
            helperText="Comma-separated namespaces to target. Leave empty to target all namespaces."
            inputProps={{ style: { fontFamily: 'monospace' } }}
            placeholder="e.g. staging,preview"
          />

          {/* Enabled */}
          <FormControlLabel
            control={
              <Switch
                checked={form.enabled}
                onChange={(e) => set('enabled', e.target.checked)}
                color="primary"
              />
            }
            label="Enable schedule"
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
        <Button
          variant="contained"
          disabled={mutation.isPending || !form.name || !form.cronExpr}
          startIcon={mutation.isPending ? <CircularProgress size={14} /> : undefined}
          onClick={() => mutation.mutate()}
        >
          {isEdit ? 'Save Changes' : 'Create Schedule'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
