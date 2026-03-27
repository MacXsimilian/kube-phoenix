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
import LabeledSwitch from '@/components/common/LabeledSwitch'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import { createException, updateException } from '@/lib/api'
import type { ScheduledException, ScheduledExceptionInput } from '@/lib/types'

function toLocalDatetimeInput(iso: string | undefined): string {
  if (!iso) return ''
  // Convert ISO to local datetime-local input value (YYYY-MM-DDTHH:mm)
  const dateObj = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}T${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`
}

function toISO(localDT: string): string {
  if (!localDT) return ''
  return new Date(localDT).toISOString()
}

const DEFAULTS: ScheduledExceptionInput = {
  exceptionType: 'stay_awake',
  startsAt: '',
  endsAt: '',
  ticketRef: '',
  reason: '',
  sleepOnEnd: true,
  namespaceFilter: '',
  labelSelector: '',
}

export default function ExceptionDialog({
  open,
  onClose,
  onNotify,
  existing,
  defaultPolicyId,
}: {
  open: boolean
  onClose: () => void
  onNotify?: (msg: string, severity: 'success' | 'error') => void
  existing?: ScheduledException
  defaultPolicyId?: number
}) {
  const queryClient = useQueryClient()
  const isEdit = !!existing

  const [form, setForm] = useState<ScheduledExceptionInput & { startsAtLocal: string; endsAtLocal: string }>({
    ...DEFAULTS,
    startsAtLocal: '',
    endsAtLocal: '',
  })
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      if (existing) {
        setForm({
          policyId: existing.policyId ?? undefined,
          exceptionType: existing.exceptionType,
          startsAt: existing.startsAt,
          endsAt: existing.endsAt,
          startsAtLocal: toLocalDatetimeInput(existing.startsAt),
          endsAtLocal: toLocalDatetimeInput(existing.endsAt),
          ticketRef: existing.ticketRef || '',
          reason: existing.reason || '',
          sleepOnEnd: existing.sleepOnEnd,
          namespaceFilter: existing.namespaceFilter || '',
          labelSelector: existing.labelSelector || '',
        })
      } else {
        setForm({
          ...DEFAULTS,
          policyId: defaultPolicyId,
          startsAtLocal: '',
          endsAtLocal: '',
        })
      }
      setError('')
    }
  }, [open, existing, defaultPolicyId])

  function set<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm(f => {
      const next = { ...f, [key]: val }
      // Keep ISO fields in sync with local fields
      if (key === 'startsAtLocal') next.startsAt = toISO(val as string)
      if (key === 'endsAtLocal') next.endsAt = toISO(val as string)
      return next
    })
  }

  function validate(): string {
    if (!form.startsAtLocal) return 'Start time is required'
    if (!form.endsAtLocal) return 'End time is required'
    const start = new Date(form.startsAtLocal)
    const end = new Date(form.endsAtLocal)
    if (end <= start) return 'End time must be after start time'
    if (start <= new Date() && !isEdit) return 'Start time must be in the future'
    return ''
  }

  const mutation = useMutation({
    mutationFn: () => {
      const payload: ScheduledExceptionInput = {
        policyId: form.policyId ?? null,
        exceptionType: form.exceptionType,
        startsAt: form.startsAt,
        endsAt: form.endsAt,
        ticketRef: form.ticketRef || undefined,
        reason: form.reason || undefined,
        sleepOnEnd: form.sleepOnEnd,
        namespaceFilter: form.namespaceFilter || undefined,
        labelSelector: form.labelSelector || undefined,
      }
      return isEdit ? updateException(existing!.id, payload) : createException(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exceptions'] })
      onNotify?.(isEdit ? 'Exception updated' : 'Exception created', 'success')
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
      <DialogTitle fontWeight={700}>{isEdit ? 'Edit Exception' : 'New Exception'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '20px !important' }}>
        {error && <Alert severity="error">{error}</Alert>}

        <TextField
          label="Exception Type"
          value={form.exceptionType}
          onChange={e => set('exceptionType', e.target.value as 'stay_awake' | 'force_sleep')}
          select
          fullWidth
          size="small"
        >
          <MenuItem value="stay_awake">Stay Awake — keep workloads running despite policy</MenuItem>
          <MenuItem value="force_sleep">Force Sleep — put workloads to sleep despite policy</MenuItem>
        </TextField>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label="Starts At"
            type="datetime-local"
            value={form.startsAtLocal}
            onChange={e => set('startsAtLocal', e.target.value)}
            fullWidth
            size="small"
            InputLabelProps={{ shrink: true }}
            required
          />
          <TextField
            label="Ends At"
            type="datetime-local"
            value={form.endsAtLocal}
            onChange={e => set('endsAtLocal', e.target.value)}
            fullWidth
            size="small"
            InputLabelProps={{ shrink: true }}
            required
          />
        </Box>
        <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5 }}>
          Times are in your browser's local timezone
        </Typography>

        <TextField
          label="Ticket Reference"
          value={form.ticketRef ?? ''}
          onChange={e => set('ticketRef', e.target.value)}
          fullWidth
          size="small"
          placeholder="e.g. JIRA-1234 or GH#567"
        />
        <TextField
          label="Reason"
          value={form.reason ?? ''}
          onChange={e => set('reason', e.target.value)}
          fullWidth
          size="small"
          multiline
          rows={2}
        />

        <Divider><Typography variant="caption" color="text.disabled">Targeting (optional — defaults to policy scope)</Typography></Divider>

        <TextField
          label="Namespace Filter"
          value={form.namespaceFilter ?? ''}
          onChange={e => set('namespaceFilter', e.target.value)}
          fullWidth
          size="small"
          placeholder="e.g. staging,dev  (empty = policy default)"
        />
        <TextField
          label="Label Selector"
          value={form.labelSelector ?? ''}
          onChange={e => set('labelSelector', e.target.value)}
          fullWidth
          size="small"
          placeholder="e.g. app=api"
        />

        <LabeledSwitch
          label="Sleep on end"
          description="When the exception window ends, put workloads to sleep immediately"
          checked={form.sleepOnEnd ?? true}
          onChange={v => set('sleepOnEnd', v)}
        />
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
