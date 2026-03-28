'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import { createPolicyOverride } from '@/lib/api'
import { formatError } from '@/lib/formatters'
import type { PolicyOverride } from '@/lib/types'

export function validateDateRange(
  startsAt: string,
  endsAt: string,
  required: boolean,
): { startsAtError?: string; endsAtError?: string } {
  const hasStart = startsAt !== ''
  const hasEnd = endsAt !== ''
  const hasBoth = hasStart && hasEnd
  const endAfterStart = hasBoth && new Date(endsAt) > new Date(startsAt)

  if (required) {
    return {
      startsAtError: !hasStart ? 'Required' : undefined,
      endsAtError: !hasEnd
        ? 'Required'
        : hasBoth && !endAfterStart
          ? 'Must be after start date'
          : undefined,
    }
  }

  if (hasStart || hasEnd) {
    return {
      startsAtError: !hasBoth ? 'Both dates required' : undefined,
      endsAtError: !hasBoth
        ? 'Both dates required'
        : !endAfterStart
          ? 'Must be after start date'
          : undefined,
    }
  }

  return {}
}

export default function CreateOverrideForm({
  policyId,
  onSave,
  onCancel,
  onNotify,
}: {
  policyId: number
  onSave: () => void
  onCancel: () => void
  onNotify: (msg: string, severity: 'success' | 'error') => void
}) {
  const [form, setForm] = useState({ type: 'stay_awake', reason: '', startsAt: '', endsAt: '', targetCronTime: '' })

  const isWindowed = form.type === 'stay_awake' || form.type === 'force_sleep'
  const { startsAtError, endsAtError } = validateDateRange(form.startsAt, form.endsAt, isWindowed)
  const hasDateError = !!startsAtError || !!endsAtError

  const createMut = useMutation({
    mutationFn: () => {
      return createPolicyOverride(policyId, {
        overrideType: form.type as PolicyOverride['overrideType'],
        reason: form.reason,
        startsAt: isWindowed ? new Date(form.startsAt).toISOString() : null,
        endsAt: isWindowed ? new Date(form.endsAt).toISOString() : null,
        targetCronTime: !isWindowed ? new Date(form.targetCronTime).toISOString() : null,
      })
    },
    onSuccess: () => {
      onNotify('Override created', 'success')
      onSave()
    },
    onError: (err: unknown) => onNotify(formatError(err), 'error'),
  })

  const saveDisabled = createMut.isPending || hasDateError

  return (
    <Paper sx={{ p: 2, mb: 2, border: '1px solid', borderColor: 'divider' }}>
      <Typography variant="subtitle2" fontWeight={600} mb={1.5}>New Override</Typography>
      <Stack direction="row" spacing={1.5} flexWrap="wrap" alignItems="flex-start" useFlexGap>
        <TextField
          select
          size="small"
          label="Type"
          value={form.type}
          onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="stay_awake">Stay Awake (windowed)</MenuItem>
          <MenuItem value="force_sleep">Force Sleep (windowed)</MenuItem>
          <MenuItem value="skip_sleep">Skip Next Sleep</MenuItem>
          <MenuItem value="skip_wake">Skip Next Wake</MenuItem>
        </TextField>
        {isWindowed ? (
          <>
            <TextField
              type="datetime-local"
              size="small"
              label="Starts At"
              value={form.startsAt}
              onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ minWidth: 200 }}
              error={!!startsAtError}
              helperText={startsAtError}
            />
            <TextField
              type="datetime-local"
              size="small"
              label="Ends At"
              value={form.endsAt}
              onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ minWidth: 200 }}
              error={!!endsAtError}
              helperText={endsAtError}
            />
          </>
        ) : (
          <TextField
            type="datetime-local"
            size="small"
            label="Target Cron Time"
            value={form.targetCronTime}
            onChange={e => setForm(f => ({ ...f, targetCronTime: e.target.value }))}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ minWidth: 200 }}
          />
        )}
        <TextField
          size="small"
          label="Reason"
          placeholder="Optional"
          value={form.reason}
          onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
          sx={{ flex: 1, minWidth: 160 }}
        />
        <Button size="small" variant="contained" onClick={() => createMut.mutate()} disabled={saveDisabled}>
          Save
        </Button>
        <Button size="small" onClick={onCancel} sx={{ color: 'text.secondary' }}>
          Cancel
        </Button>
      </Stack>
    </Paper>
  )
}
