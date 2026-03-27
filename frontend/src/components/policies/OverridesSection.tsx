'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import Paper from '@mui/material/Paper'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { deletePolicyOverride, createPolicyOverride } from '@/lib/api'
import { formatDateTime } from '@/lib/formatters'
import { TYPE_LABELS, TYPE_LABEL_FALLBACK } from '@/lib/statusColors'
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
  const [addOverrideOpen, setAddOverrideOpen] = useState(false)
  const [overrideForm, setOverrideForm] = useState({ type: 'stay_awake', reason: '', startsAt: '', endsAt: '', targetCronTime: '' })

  const isWindowed = overrideForm.type === 'stay_awake' || overrideForm.type === 'force_sleep'

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
              {overrides.map(ov => (
                <TableRow key={ov.id}>
                  <TableCell>
                    {(() => {
                      const typeLabel = TYPE_LABELS[ov.overrideType] ?? TYPE_LABEL_FALLBACK
                      return <Chip label={typeLabel.label} size="small" sx={{ fontSize: 10, color: typeLabel.color, bgcolor: typeLabel.bg }} />
                    })()}
                  </TableCell>
                  <TableCell>
                    {ov.startsAt ? `${formatDateTime(ov.startsAt)} \u2192 ${formatDateTime(ov.endsAt)}` : formatDateTime(ov.targetCronTime)}
                  </TableCell>
                  <TableCell>{ov.reason || '\u2014'}</TableCell>
                  <TableCell>{ov.createdBy}</TableCell>
                  <TableCell>
                    {canEdit && (
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => deleteOverrideMut.mutate(ov.id)}
                        aria-label="Delete override"
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Box>

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
                />
                <TextField
                  type="datetime-local"
                  size="small"
                  label="Ends At"
                  value={overrideForm.endsAt}
                  onChange={e => setOverrideForm(f => ({ ...f, endsAt: e.target.value }))}
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ minWidth: 200 }}
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
            <Button size="small" variant="contained" onClick={() => createOverrideMut.mutate()} disabled={createOverrideMut.isPending}>
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
