'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import Paper from '@mui/material/Paper'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { deletePolicyOverride, createPolicyOverride } from '@/lib/api'
import { fmtDt } from '@/lib/formatters'
import { useTheme } from '@mui/material/styles'
import { typeLabels, typeLabelFallback } from '@/lib/statusColors'
import type { PolicyOverride } from '@/lib/types'

export default function OverridesSection({
  policyId,
  overrides,
  canEdit,
  onRefetch,
  onInvalidateExceptions,
  onNotify,
}: {
  policyId: number
  overrides: PolicyOverride[] | undefined
  canEdit: boolean
  onRefetch: () => void
  onInvalidateExceptions: () => void
  onNotify: (msg: string, severity: 'success' | 'error') => void
}) {
  const isDark = useTheme().palette.mode === 'dark'
  const TYPE_LABELS = typeLabels(isDark)
  const TYPE_LABEL_FALLBACK = typeLabelFallback(isDark)
  const [addOverrideOpen, setAddOverrideOpen] = useState(false)
  const [overrideForm, setOverrideForm] = useState({ type: 'stay_awake', reason: '', startsAt: '', endsAt: '', targetCronTime: '' })
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

  const isWindowed = overrideForm.type === 'stay_awake' || overrideForm.type === 'force_sleep'

  // Form validation
  const hasEitherDate = overrideForm.startsAt !== '' || overrideForm.endsAt !== ''
  const hasBothDates = overrideForm.startsAt !== '' && overrideForm.endsAt !== ''
  const endAfterStart = hasBothDates && new Date(overrideForm.endsAt) > new Date(overrideForm.startsAt)

  let dateError = ''
  if (isWindowed) {
    if (!hasBothDates) dateError = 'Both start and end dates are required'
    else if (!endAfterStart) dateError = 'End date must be after start date'
  } else if (hasEitherDate) {
    if (!hasBothDates) dateError = 'Both start and end dates are required'
    else if (!endAfterStart) dateError = 'End date must be after start date'
  }

  const startsAtError = isWindowed && overrideForm.startsAt === '' ? 'Required' : ''
  const endsAtError = isWindowed && overrideForm.endsAt === ''
    ? 'Required'
    : hasBothDates && !endAfterStart
      ? 'Must be after start date'
      : ''

  const deleteOverrideMut = useMutation({
    mutationFn: (overrideId: number) => deletePolicyOverride(policyId, overrideId),
    onSuccess: () => { onRefetch(); onNotify('Override deleted', 'success') },
    onError: (err: unknown) => onNotify(err instanceof Error ? err.message : 'Delete failed', 'error'),
  })

  const createOverrideMut = useMutation({
    mutationFn: () => {
      const windowed = overrideForm.type === 'stay_awake' || overrideForm.type === 'force_sleep'
      return createPolicyOverride(policyId, {
        overrideType: overrideForm.type as PolicyOverride['overrideType'],
        reason: overrideForm.reason,
        startsAt: windowed ? new Date(overrideForm.startsAt).toISOString() : null,
        endsAt: windowed ? new Date(overrideForm.endsAt).toISOString() : null,
        targetCronTime: !windowed ? new Date(overrideForm.targetCronTime).toISOString() : null,
      })
    },
    onSuccess: () => {
      onRefetch()
      onInvalidateExceptions()
      setAddOverrideOpen(false)
      onNotify('Override created', 'success')
    },
    onError: (err: unknown) => onNotify(err instanceof Error ? err.message : 'Create failed', 'error'),
  })

  const saveDisabled = createOverrideMut.isPending || dateError !== ''

  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle1" fontWeight={600}>Overrides</Typography>
          {canEdit && (
            <Button size="small" startIcon={<AddIcon />} onClick={() => setAddOverrideOpen(true)}>
              Add Override
            </Button>
          )}
        </Box>
        {overrides && overrides.length === 0 && (
          <Typography variant="body2" color="text.secondary">No active overrides.</Typography>
        )}
        {overrides && overrides.length > 0 && (
          <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell>Window / Target</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>By</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {overrides.map(ov => {
                const typeLabel = TYPE_LABELS[ov.overrideType] ?? TYPE_LABEL_FALLBACK
                return (
                <TableRow key={ov.id}>
                  <TableCell>
                    <Chip label={typeLabel.label} size="small" sx={{ fontSize: 10, color: typeLabel.color, bgcolor: typeLabel.bg }} />
                  </TableCell>
                  <TableCell>
                    {ov.startsAt ? `${fmtDt(ov.startsAt)} \u2192 ${fmtDt(ov.endsAt)}` : fmtDt(ov.targetCronTime)}
                  </TableCell>
                  <TableCell>{ov.reason || '\u2014'}</TableCell>
                  <TableCell>{ov.createdBy}</TableCell>
                  <TableCell>
                    {canEdit && (
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => setDeleteTarget(ov.id)}
                        aria-label="Delete override"
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
                )
              })}
            </TableBody>
          </Table>
          </TableContainer>
        )}
      </Box>

      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete this override?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently delete the override. This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              if (deleteTarget !== null) deleteOverrideMut.mutate(deleteTarget)
              setDeleteTarget(null)
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add override form */}
      {addOverrideOpen && (
        <Paper sx={{ p: 2, mb: 2, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" fontWeight={600} mb={1.5}>New Override</Typography>
          <Stack direction="row" spacing={1.5} flexWrap="wrap" alignItems="flex-start" useFlexGap>
            <TextField
              select
              size="small"
              label="Type"
              value={overrideForm.type}
              onChange={e => setOverrideForm(f => ({ ...f, type: e.target.value }))}
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
                  value={overrideForm.startsAt}
                  onChange={e => setOverrideForm(f => ({ ...f, startsAt: e.target.value }))}
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ minWidth: 200 }}
                  error={!!startsAtError}
                  helperText={startsAtError}
                />
                <TextField
                  type="datetime-local"
                  size="small"
                  label="Ends At"
                  value={overrideForm.endsAt}
                  onChange={e => setOverrideForm(f => ({ ...f, endsAt: e.target.value }))}
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
                value={overrideForm.targetCronTime}
                onChange={e => setOverrideForm(f => ({ ...f, targetCronTime: e.target.value }))}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ minWidth: 200 }}
              />
            )}
            <TextField
              size="small"
              label="Reason"
              placeholder="Optional"
              value={overrideForm.reason}
              onChange={e => setOverrideForm(f => ({ ...f, reason: e.target.value }))}
              sx={{ flex: 1, minWidth: 160 }}
            />
            <Button size="small" variant="contained" onClick={() => createOverrideMut.mutate()} disabled={saveDisabled}>
              Save
            </Button>
            <Button size="small" onClick={() => setAddOverrideOpen(false)} sx={{ color: 'text.secondary' }}>
              Cancel
            </Button>
          </Stack>
        </Paper>
      )}
    </>
  )
}
