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
import { createPolicy, updatePolicy } from '@/lib/api'
import { TIMEZONES } from '@/lib/constants'
import type { Policy, PolicyInput } from '@/lib/types'
import CronBuilder from '../schedules/CronBuilder'

const DEFAULTS: PolicyInput = {
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
}

function isValidCron(expr: string): boolean {
  if (!expr) return true // optional fields
  const parts = expr.trim().split(/\s+/)
  return parts.length === 5
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

  const [form, setForm] = useState<PolicyInput>(DEFAULTS)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      if (existing) {
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
        })
      } else {
        setForm(DEFAULTS)
      }
      setError('')
    }
  }, [open, existing])

  function set<K extends keyof PolicyInput>(key: K, val: PolicyInput[K]) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function validate(): string {
    if (!form.name.trim()) return 'Name is required'
    if (!form.sleepCron && !form.wakeCron) return 'At least one of Sleep Cron or Wake Cron is required'
    if (form.sleepCron && !isValidCron(form.sleepCron)) return 'Invalid sleep cron expression'
    if (form.wakeCron && !isValidCron(form.wakeCron)) return 'Invalid wake cron expression'
    if ((form.timeoutMinutes ?? 0) < 0 || (form.timeoutMinutes ?? 0) > 1440) return 'Timeout must be 0–1440 minutes'
    return ''
  }

  const mutation = useMutation({
    mutationFn: () => {
      const payload: PolicyInput = { ...form }
      if (!payload.sleepCron) delete payload.sleepCron
      if (!payload.wakeCron) delete payload.wakeCron
      if (!payload.namespaceFilter) delete payload.namespaceFilter
      if (!payload.labelSelector) delete payload.labelSelector
      if (!payload.description) delete payload.description
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

        <Divider><Typography variant="caption" color="text.disabled">Schedule</Typography></Divider>

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
