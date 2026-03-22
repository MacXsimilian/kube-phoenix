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
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { createPolicy, updatePolicy } from '@/lib/api'
import { TIMEZONES } from '@/lib/constants'
import type { Policy, PolicyInput, SleepWindow } from '@/lib/types'
import CronBuilder from '../schedules/CronBuilder'
import WindowPicker from './WindowPicker'

type ScheduleMode = 'windows' | 'cron'

const DEFAULT_WINDOWS: SleepWindow[] = [
  { daysOfWeek: [1, 2, 3, 4, 5], startTime: '19:00', endTime: '07:00' },
]

const DEFAULTS: PolicyInput & { _windows: SleepWindow[]; _scheduleMode: ScheduleMode } = {
  name: '',
  description: '',
  sleepCron: '',
  wakeCron: '',
  timezone: 'UTC',
  mode: 'plan',
  enabled: true,
  timeoutMinutes: 30,
  namespaceFilter: '',
  labelSelector: '',
  _windows: DEFAULT_WINDOWS,
  _scheduleMode: 'windows',
}

function isValidCron(expr: string): boolean {
  if (!expr) return true
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return false
  const ranges = [
    [0, 59],  // minute
    [0, 23],  // hour
    [1, 31],  // day of month
    [1, 12],  // month
    [0, 7],   // day of week (0 and 7 both = Sunday)
  ]
  return parts.every((part, i) => {
    if (part === '*') return true
    // Handle comma-separated and ranges
    return part.split(',').every(seg => {
      const range = seg.split('-')
      return range.every(v => {
        const n = parseInt(v, 10)
        return !isNaN(n) && n >= ranges[i][0] && n <= ranges[i][1]
      })
    })
  })
}

export default function CreatePolicyDialog({
  open,
  onClose,
  onNotify,
  existing,
}: {
  open: boolean
  onClose: () => void
  onNotify?: (msg: string, severity: 'success' | 'error') => void
  existing?: Policy
}) {
  const qc = useQueryClient()
  const isEdit = !!existing

  const [form, setForm] = useState(DEFAULTS)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      if (existing) {
        const hasWindows = existing.sleepWindows && existing.sleepWindows.length > 0
        setForm({
          name: existing.name,
          description: existing.description || '',
          sleepCron: existing.sleepCron || '',
          wakeCron: existing.wakeCron || '',
          timezone: existing.timezone || 'UTC',
          mode: existing.mode,
          enabled: existing.enabled,
          timeoutMinutes: existing.timeoutMinutes,
          namespaceFilter: existing.namespaceFilter || '',
          labelSelector: existing.labelSelector || '',
          _windows: hasWindows ? existing.sleepWindows! : DEFAULT_WINDOWS,
          _scheduleMode: hasWindows ? 'windows' : 'cron',
        })
      } else {
        setForm(DEFAULTS)
      }
      setError('')
    }
  }, [open, existing])

  function set<K extends keyof typeof DEFAULTS>(key: K, val: (typeof DEFAULTS)[K]) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function validate(): string {
    if (!form.name.trim()) return 'Name is required'
    if (form._scheduleMode === 'windows') {
      if (form._windows.length === 0) return 'At least one sleep window is required'
      if (form._windows.every(w => w.daysOfWeek.length === 0)) return 'Select at least one day'
    } else {
      if (!form.sleepCron && !form.wakeCron) return 'At least one of Sleep Cron or Wake Cron is required'
      if (form.sleepCron && !isValidCron(form.sleepCron)) return 'Invalid sleep cron expression'
      if (form.wakeCron && !isValidCron(form.wakeCron)) return 'Invalid wake cron expression'
    }
    if ((form.timeoutMinutes ?? 0) < 0 || (form.timeoutMinutes ?? 0) > 1440) return 'Timeout must be 0\u20131440 minutes'
    return ''
  }

  const mutation = useMutation({
    mutationFn: () => {
      const payload: PolicyInput = {
        name: form.name,
        description: form.description || undefined,
        timezone: form.timezone,
        mode: form.mode,
        enabled: form.enabled,
        timeoutMinutes: form.timeoutMinutes,
        namespaceFilter: form.namespaceFilter || undefined,
        labelSelector: form.labelSelector || undefined,
      }
      if (form._scheduleMode === 'windows') {
        payload.sleepWindows = form._windows.filter(w => w.daysOfWeek.length > 0)
      } else {
        if (form.sleepCron) payload.sleepCron = form.sleepCron
        if (form.wakeCron) payload.wakeCron = form.wakeCron
      }
      return isEdit ? updatePolicy(existing!.id, payload) : createPolicy(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['policies'] })
      onNotify?.(isEdit ? 'Policy updated' : 'Policy created', 'success')
      onClose()
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Save failed')
    },
  })

  function handleSave() {
    const msg = validate()
    if (msg) { setError(msg); return }
    setError('')
    mutation.mutate()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { sx: { bgcolor: 'background.paper' } } }}
    >
      <DialogTitle fontWeight={700}>{isEdit ? 'Edit Policy' : 'New Policy'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
        {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}

        <TextField
          label="Name"
          value={form.name}
          onChange={e => set('name', e.target.value)}
          fullWidth
          size="small"
          required
          inputProps={{ maxLength: 255 }}
        />
        <TextField
          label="Description"
          value={form.description ?? ''}
          onChange={e => set('description', e.target.value)}
          fullWidth
          size="small"
          multiline
          rows={2}
          inputProps={{ maxLength: 1024 }}
        />

        <Divider>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="caption" color="text.disabled">Schedule</Typography>
            <ToggleButtonGroup
              value={form._scheduleMode}
              exclusive
              onChange={(_, v) => v && set('_scheduleMode', v)}
              size="small"
            >
              <ToggleButton value="windows" sx={{ fontSize: 11, px: 1.5, py: 0.25 }}>
                Windows
              </ToggleButton>
              <ToggleButton value="cron" sx={{ fontSize: 11, px: 1.5, py: 0.25 }}>
                Advanced (cron)
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Divider>

        <TextField
          label="Timezone"
          value={form.timezone ?? 'UTC'}
          onChange={e => set('timezone', e.target.value)}
          select
          fullWidth
          size="small"
        >
          {TIMEZONES.map(tz => (
            <MenuItem key={tz} value={tz}>{tz}</MenuItem>
          ))}
        </TextField>

        {form._scheduleMode === 'windows' ? (
          <WindowPicker
            windows={form._windows}
            onChange={w => set('_windows', w)}
          />
        ) : (
          <>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Sleep Cron (optional)
              </Typography>
              <CronBuilder
                value={form.sleepCron ?? ''}
                onChange={v => set('sleepCron', v)}
              />
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Wake Cron (optional)
              </Typography>
              <CronBuilder
                value={form.wakeCron ?? ''}
                onChange={v => set('wakeCron', v)}
              />
            </Box>
          </>
        )}

        <Divider><Typography variant="caption" color="text.disabled">Targeting</Typography></Divider>

        <TextField
          label="Namespace Filter"
          value={form.namespaceFilter ?? ''}
          onChange={e => set('namespaceFilter', e.target.value)}
          fullWidth
          size="small"
          placeholder="e.g. staging,dev  (empty = all)"
          helperText="Comma-separated namespace names, or empty for all namespaces"
        />
        <TextField
          label="Label Selector"
          value={form.labelSelector ?? ''}
          onChange={e => set('labelSelector', e.target.value)}
          fullWidth
          size="small"
          placeholder="e.g. app=api,tier!=db"
          helperText="Standard Kubernetes label selector syntax"
        />

        <Divider><Typography variant="caption" color="text.disabled">Settings</Typography></Divider>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            label="Mode"
            value={form.mode ?? 'plan'}
            onChange={e => set('mode', e.target.value as 'plan' | 'apply')}
            select
            size="small"
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="plan">Plan (dry-run)</MenuItem>
            <MenuItem value="apply">Apply (live)</MenuItem>
          </TextField>
          <TextField
            label="Timeout (minutes)"
            type="number"
            value={form.timeoutMinutes ?? 30}
            onChange={e => set('timeoutMinutes', Number(e.target.value))}
            size="small"
            sx={{ minWidth: 160 }}
            inputProps={{ min: 0, max: 1440 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.enabled ?? true}
                onChange={e => set('enabled', e.target.checked)}
                size="small"
              />
            }
            label="Enabled"
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
        <Button
          variant="contained"
          disabled={mutation.isPending}
          startIcon={mutation.isPending ? <CircularProgress size={14} /> : undefined}
          onClick={handleSave}
        >
          {isEdit ? 'Save' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
