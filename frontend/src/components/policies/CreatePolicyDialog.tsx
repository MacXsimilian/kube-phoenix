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
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import { createPolicy, updatePolicy } from '@/lib/api'
import { TIMEZONES } from '@/lib/constants'
import type { Policy, PolicyInput, SleepWindow } from '@/lib/types'
import { windowsToText, computeWeeklyStats } from '@/lib/windowUtils'
import WindowPicker from './WindowPicker'
import WeeklyTimeline from './WeeklyTimeline'

const DEFAULT_WINDOWS: SleepWindow[] = [
  { daysOfWeek: [1, 2, 3, 4, 5], startTime: '19:00', endTime: '07:00', allDay: false },
]

const DEFAULTS: PolicyInput & { editingWindows: SleepWindow[] } = {
  name: '',
  description: '',
  sleepWindows: DEFAULT_WINDOWS,
  timezone: 'UTC',
  mode: 'plan',
  enabled: true,
  timeoutMinutes: 30,
  namespaceFilter: '',
  labelSelector: '',
  editingWindows: DEFAULT_WINDOWS,
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
  const queryClient = useQueryClient()
  const isEdit = !!existing

  const [form, setForm] = useState(DEFAULTS)
  const [error, setError] = useState('')
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (open) {
      if (existing) {
        const hasWindows = existing.sleepWindows && existing.sleepWindows.length > 0
        const windows = hasWindows ? existing.sleepWindows! : DEFAULT_WINDOWS
        setForm({
          name: existing.name,
          description: existing.description || '',
          sleepWindows: windows,
          timezone: existing.timezone || 'UTC',
          mode: existing.mode,
          enabled: existing.enabled,
          timeoutMinutes: existing.timeoutMinutes,
          namespaceFilter: existing.namespaceFilter || '',
          labelSelector: existing.labelSelector || '',
          editingWindows: windows,
        })
      } else {
        setForm(DEFAULTS)
      }
      setError('')
      setTouched({})
    }
  }, [open, existing])

  function set<K extends keyof typeof DEFAULTS>(key: K, val: (typeof DEFAULTS)[K]) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function validate(): string {
    if (!form.name.trim()) return 'Name is required'
    if (form.editingWindows.length === 0) return 'At least one sleep window is required'
    if (form.editingWindows.every(w => w.daysOfWeek.length === 0)) return 'Select at least one day'
    if ((form.timeoutMinutes ?? 0) < 0 || (form.timeoutMinutes ?? 0) > 1440) return 'Timeout must be 0\u20131440 minutes'
    return ''
  }

  const mutation = useMutation({
    mutationFn: () => {
      const payload: PolicyInput = {
        name: form.name,
        description: form.description || undefined,
        sleepWindows: form.editingWindows.filter(w => w.daysOfWeek.length > 0),
        timezone: form.timezone,
        mode: form.mode,
        enabled: form.enabled,
        timeoutMinutes: form.timeoutMinutes,
        namespaceFilter: form.namespaceFilter || undefined,
        labelSelector: form.labelSelector || undefined,
      }
      return isEdit ? updatePolicy(existing!.id, payload) : createPolicy(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] })
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

  const activeWindows = form.editingWindows.filter(w => w.daysOfWeek.length > 0)
  const weeklyStats = activeWindows.length > 0 ? computeWeeklyStats(activeWindows) : null

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { sx: { bgcolor: 'background.paper' } } }}
    >
      <DialogTitle fontWeight={700}>{isEdit ? 'Edit Policy' : 'New Policy'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '20px !important' }}>
        {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}

        <TextField
          label="Name"
          value={form.name}
          onChange={e => set('name', e.target.value)}
          onBlur={() => setTouched(t => ({ ...t, name: true }))}
          fullWidth
          size="small"
          required
          error={touched.name && !form.name.trim()}
          helperText={touched.name && !form.name.trim() ? 'Name is required' : undefined}
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

        <WindowPicker
          windows={form.editingWindows}
          onChange={w => set('editingWindows', w)}
        />

        {/* Live preview — Dashboard Mini-Card */}
        {form.editingWindows.length > 0 && form.editingWindows.some(w => w.daysOfWeek.length > 0) && (
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden', bgcolor: 'rgba(255,255,255,0.01)' }}>
            {/* Card header */}
            <Box sx={{
              px: 2, py: 1.25,
              borderBottom: '1px solid', borderColor: 'divider',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              bgcolor: 'rgba(255,255,255,0.02)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" fontWeight={700} letterSpacing={0.5} textTransform="uppercase" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                  Schedule Preview
                </Typography>
              </Box>
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11 }}>
                {form.timezone ?? 'UTC'}
              </Typography>
            </Box>

            {/* Timeline grid */}
            <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
              <WeeklyTimeline windows={form.editingWindows} timezone={form.timezone} />
            </Box>

            {/* Stats footer */}
            {weeklyStats && (
              <Box sx={{
                px: 2, py: 1.25,
                borderTop: '1px solid', borderColor: 'divider',
                display: 'flex', alignItems: 'center', gap: 2.5,
                bgcolor: 'rgba(255,255,255,0.015)',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <BedtimeIcon sx={{ fontSize: 13, color: '#A78BFA' }} />
                  <Typography variant="caption" sx={{ color: '#A78BFA', fontWeight: 600, fontSize: 12 }}>
                    {weeklyStats.sleepHours}h sleep
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <WbSunnyIcon sx={{ fontSize: 13, color: '#86EFAC' }} />
                  <Typography variant="caption" sx={{ color: '#86EFAC', fontWeight: 600, fontSize: 12 }}>
                    {weeklyStats.awakeHours}h awake
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.disabled" sx={{ ml: 'auto', fontSize: 11 }}>
                  {windowsToText(activeWindows)}
                </Typography>
              </Box>
            )}
          </Box>
        )}

        <Divider><Typography variant="caption" color="text.disabled">Targeting</Typography></Divider>

        <TextField
          label="Namespace Filter"
          value={form.namespaceFilter ?? ''}
          onChange={e => set('namespaceFilter', e.target.value)}
          fullWidth
          size="small"
          placeholder="e.g. staging,dev  (empty = all)"
          helperText="Comma-separated namespace list, e.g. default,staging"
        />
        <TextField
          label="Label Selector"
          value={form.labelSelector ?? ''}
          onChange={e => set('labelSelector', e.target.value)}
          fullWidth
          size="small"
          placeholder="e.g. app=api,tier!=db"
          helperText="Kubernetes label selector, e.g. app=web,tier=frontend"
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
            inputProps={{ min: 1, max: 1440 }}
            helperText="Execution timeout in minutes (1-1440)"
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
