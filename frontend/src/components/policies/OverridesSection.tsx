'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { formatError } from '@/lib/formatters'
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
import IconButton from '@mui/material/IconButton'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { deletePolicyOverride } from '@/lib/api'
import { fmtDt } from '@/lib/formatters'
import { useIsDark } from '@/lib/useIsDark'
import { getTypeLabel } from '@/lib/statusColors'
import type { PolicyOverride } from '@/lib/types'
import CreateOverrideForm from './CreateOverrideForm'

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
  const isDark = useIsDark()
  const [addOverrideOpen, setAddOverrideOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

  const deleteOverrideMut = useMutation({
    mutationFn: (overrideId: number) => deletePolicyOverride(policyId, overrideId),
    onSuccess: () => { onRefetch(); onNotify('Override deleted', 'success') },
    onError: (err: unknown) => onNotify(formatError(err), 'error'),
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
                const typeLabel = getTypeLabel(isDark, ov.overrideType)
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

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this override?"
        message="This will permanently delete the override. This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => { if (deleteTarget !== null) deleteOverrideMut.mutate(deleteTarget) }}
        onClose={() => setDeleteTarget(null)}
      />

      {addOverrideOpen && (
        <CreateOverrideForm
          policyId={policyId}
          onSave={() => {
            onRefetch()
            onInvalidateExceptions()
            setAddOverrideOpen(false)
          }}
          onCancel={() => setAddOverrideOpen(false)}
          onNotify={onNotify}
        />
      )}
    </>
  )
}
