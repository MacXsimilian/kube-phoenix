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
import Snackbar from '@mui/material/Snackbar'
import Typography from '@mui/material/Typography'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import { createSchedule, updateSchedule } from '@/lib/api'
import { cronToText } from '@/lib/cronToText'
import { TIMEZONES } from '@/lib/constants'
import type { Schedule, ScheduleInput } from '@/lib/types'

function isValidCronField(field: string, min: number, max: number): boolean {
  if (field === '*') return true
  // Handle step values like */5 or 1-5/2
  const [range, step] = field.split('/')
  if (step !== undefined && (!/^\d+$/.test(step) || Number(step) < 1)) return false
  if (range === '*') return true
  // Handle ranges like 1-5
  if (range.includes('-')) {
    const [lo, hi] = range.split('-')
    if (!/^\d+$/.test(lo) || !/^\d+$/.test(hi)) return false
    const n1 = Number(lo), n2 = Number(hi)
    return n1 >= min && n2 <= max && n1 <= n2
  }
  // Handle lists like 1,2,3
  return range.split(',').every((v) => /^\d+$/.test(v) && Number(v) >= min && Number(v) <= max)
}

function isValidCron(expr: string): boolean {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return false
  const [minute, hour, dom, month, dow] = parts
  return (
    isValidCronField(minute, 0, 59) &&
    isValidCronField(hour, 0, 23) &&
    isValidCronField(dom, 1, 31) &&
    isValidCronField(month, 1, 12) &&
    isValidCronField(dow, 0, 7)
  )
}

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
  onSaved,
}: {
  open: boolean
  schedule?: Schedule
  defaultType?: 'scale_down' | 'scale_up'
  onClose: () => void
  onSaved?: () => void
}) {
  const qc = useQueryClient()
  const isEdit = !!schedule

  const [form, setForm] = useState<ScheduleInput>(DEFAULTS)
  const [mutError, setMutError] = useState<string | null>(null)
  const [saveSnack, setSaveSnack] = useState(false)

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
      setMutError(null)
    }
  }, [open, schedule, defaultType])

  const set = <K extends keyof ScheduleInput>(key: K, value: ScheduleInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const mutation = useMutation({
    mutationFn: () =>
      isEdit ? updateSchedule(schedule!.id, form) : createSchedule(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules'] })
      setMutError(null)
      setSaveSnack(true)
      onSaved?.()
      onClose()
    },
    onError: (err: unknown) => {
      setMutError(err instanceof Error ? err.message : 'Operation failed')
    },
  })

  const isSleep = form.type === 'scale_down'

  return (
    <>
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
                  aria-label="Schedule type"
                >
                  <ToggleButton value="scale_down" sx={{ gap: 0.75 }}>
                    <BedtimeIcon fontSize="small" /> Sleep (Scale Down)
                  </ToggleButton>
                  <ToggleButton value="scale_up" sx={{ gap: 0.75 }}>
                    <WbSunnyIcon fontSize="small" /> Wake (Scale Up)
                  </ToggleButton>
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
              error={form.cronExpr.length > 0 && !isValidCron(form.cronExpr)}
              helperText={
                form.cronExpr.length > 0 && !isValidCron(form.cronExpr)
                  ? 'Invalid cron expression — must be 5 fields (e.g. 0 22 * * 1-5)'
                  : cronToText(form.cronExpr)
              }
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
                aria-label="Execution mode"
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

            {/* Mutation error */}
            {mutError && (
              <Alert severity="error" sx={{ py: 0.5 }}>
                {mutError}
              </Alert>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
          <Button
            variant="contained"
            disabled={mutation.isPending || !form.name || !form.cronExpr || !isValidCron(form.cronExpr)}
            startIcon={mutation.isPending ? <CircularProgress size={14} /> : undefined}
            onClick={() => mutation.mutate()}
          >
            {isEdit ? 'Save Changes' : 'Create Schedule'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={saveSnack}
        autoHideDuration={3000}
        onClose={() => setSaveSnack(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert severity="success" onClose={() => setSaveSnack(false)} sx={{ width: '100%' }}>
          Schedule {isEdit ? 'updated' : 'created'} successfully.
        </Alert>
      </Snackbar>
    </>
  )
}
