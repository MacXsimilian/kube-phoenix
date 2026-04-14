'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import LabeledSwitch from '@/components/common/LabeledSwitch'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import { formatError } from '@/lib/formatters'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import { createException, updateException, getPolicies } from '@/lib/api'
import type { ScheduledException, ScheduledExceptionInput } from '@/lib/types'
import ExceptionWindowPicker from './ExceptionWindowPicker'

const EMPTY_FORM: ScheduledExceptionInput = {
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
  const showPolicyPicker = !defaultPolicyId && !existing

  const { data: policies } = useQuery({
    queryKey: queryKeys.policies(),
    queryFn: getPolicies,
    enabled: open && showPolicyPicker,
  })

  const [form, setForm] = useState<ScheduledExceptionInput>({ ...EMPTY_FORM })
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    if (existing) {
      setForm({
        policyId: existing.policyId ?? undefined,
        exceptionType: existing.exceptionType,
        startsAt: existing.startsAt,
        endsAt: existing.endsAt,
        ticketRef: existing.ticketRef || '',
        reason: existing.reason || '',
        sleepOnEnd: existing.sleepOnEnd,
        namespaceFilter: existing.namespaceFilter || '',
        labelSelector: existing.labelSelector || '',
      })
    } else {
      setForm({ ...EMPTY_FORM, policyId: defaultPolicyId })
    }
    setError('')
  }, [open, existing, defaultPolicyId])

  function setField<K extends keyof ScheduledExceptionInput>(key: K, val: ScheduledExceptionInput[K]) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function validate(): string {
    if (!form.policyId) return 'Policy is required'
    if (!form.startsAt) return 'Start time is required'
    if (!form.endsAt) return 'End time is required'
    const start = new Date(form.startsAt)
    const end = new Date(form.endsAt)
    if (end <= start) return 'End time must be after start time'
    if (!existing && start <= new Date()) return 'Start time must be in the future'
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
      if (existing) {
        return updateException(existing.id, payload)
      }
      return createException(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.exceptions() })
      onNotify?.(existing ? 'Exception updated' : 'Exception created', 'success')
      onClose()
    },
    onError: (err: unknown) => {
      setError(formatError(err))
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
      maxWidth="md"
      slotProps={{ paper: { sx: { bgcolor: 'background.paper' } } }}
    >
      <DialogTitle fontWeight={700}>{existing ? 'Edit Exception' : 'New Exception'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '20px !important' }}>
        {error && <Alert severity="error">{error}</Alert>}

        {showPolicyPicker && (
          <TextField
            label="Policy"
            value={form.policyId ?? ''}
            onChange={e => setField('policyId', e.target.value ? Number(e.target.value) : undefined)}
            select
            fullWidth
            size="small"
            required
          >
            <MenuItem value="" disabled>Select a policy</MenuItem>
            {policies?.map(p => (
              <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
            ))}
          </TextField>
        )}

        <TextField
          label="Exception Type"
          value={form.exceptionType}
          onChange={e => setField('exceptionType', e.target.value as 'stay_awake' | 'force_sleep')}
          select
          fullWidth
          size="small"
        >
          <MenuItem value="stay_awake">Stay Awake — keep workloads running despite policy</MenuItem>
          <MenuItem value="force_sleep">Force Sleep — put workloads to sleep despite policy</MenuItem>
        </TextField>

        <ExceptionWindowPicker
          value={{ startISO: form.startsAt, endISO: form.endsAt }}
          onChange={v => setForm(f => ({ ...f, startsAt: v.startISO, endsAt: v.endISO }))}
          minDate={existing ? undefined : new Date()}
        />

        <TextField
          label="Ticket Reference"
          value={form.ticketRef ?? ''}
          onChange={e => setField('ticketRef', e.target.value)}
          fullWidth
          size="small"
          placeholder="e.g. JIRA-1234 or GH#567"
        />
        <TextField
          label="Reason"
          value={form.reason ?? ''}
          onChange={e => setField('reason', e.target.value)}
          fullWidth
          size="small"
          multiline
          rows={2}
        />

        <Divider><Typography variant="caption" color="text.disabled">Targeting (optional — defaults to policy scope)</Typography></Divider>

        <TextField
          label="Namespace Filter"
          value={form.namespaceFilter ?? ''}
          onChange={e => setField('namespaceFilter', e.target.value)}
          fullWidth
          size="small"
          placeholder="e.g. staging,dev  (empty = policy default)"
        />
        <TextField
          label="Label Selector"
          value={form.labelSelector ?? ''}
          onChange={e => setField('labelSelector', e.target.value)}
          fullWidth
          size="small"
          placeholder="e.g. app=api"
        />

        <LabeledSwitch
          label="Sleep on end"
          description="When the exception window ends, put workloads to sleep immediately"
          checked={form.sleepOnEnd ?? true}
          onChange={v => setField('sleepOnEnd', v)}
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
          {existing ? 'Save' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
