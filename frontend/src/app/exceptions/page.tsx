'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { formatError } from '@/lib/formatters'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CenteredSpinner from '@/components/common/CenteredSpinner'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import AddIcon from '@mui/icons-material/Add'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { getExceptions, deleteException } from '@/lib/api'
import type { ScheduledException } from '@/lib/types'
import ExceptionDialog from '@/components/policies/ExceptionDialog'
import ExceptionsCalendarStrip from '@/components/exceptions/ExceptionsCalendarStrip'
import { useAuth } from '@/lib/auth'
import { canEditSchedules } from '@/lib/rbac'
import { useIsDark } from '@/lib/useIsDark'
import { EXCEPTIONS_REFETCH_MS } from '@/lib/constants'
import { useSnackbar } from '@/lib/useSnackbar'

export default function ExceptionsPage() {
  const { user } = useAuth()
  const isDark = useIsDark()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ScheduledException | undefined>()
  const [pendingDelete, setPendingDelete] = useState<ScheduledException | null>(null)
  const { notify, SnackbarAlert } = useSnackbar()

  const canEdit = canEditSchedules(user?.permissions)

  const { data: exceptions, isLoading, isError } = useQuery({
    queryKey: queryKeys.exceptions(),
    queryFn: () => getExceptions(),
    refetchInterval: EXCEPTIONS_REFETCH_MS,
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteException(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.exceptions() })
      notify('Exception cancelled', 'success')
    },
    onError: (err: unknown) => {
      notify(formatError(err), 'error')
    },
  })

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" sx={{
          fontWeight: 700
        }}>Scheduled Exceptions</Typography>
        <Tooltip title={!canEdit ? 'You do not have permission to create exceptions' : ''}>
          <span>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => { setEditing(undefined); setDialogOpen(true) }}
              disabled={!canEdit}
            >
              New Exception
            </Button>
          </span>
        </Tooltip>
      </Box>
      {isError && <Alert severity="error" sx={{ mb: 2 }}>Failed to load exceptions</Alert>}
      {isLoading && <CenteredSpinner />}
      {exceptions && exceptions.length === 0 && (
        <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 2, p: 4, textAlign: 'center' }}>
          <Typography variant="body2" sx={{
            color: "text.secondary"
          }}>No exceptions found.</Typography>
        </Box>
      )}
      {exceptions && exceptions.length > 0 && (
        <ExceptionsCalendarStrip
          exceptions={exceptions}
          isDark={isDark}
          canEdit={canEdit}
          onEdit={(ex) => { setEditing(ex); setDialogOpen(true) }}
          onCancel={(ex) => setPendingDelete(ex)}
        />
      )}
      <ExceptionDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(undefined) }}
        existing={editing}
        onNotify={notify}
      />
      <ConfirmDialog
        open={!!pendingDelete}
        title="Cancel exception?"
        message={pendingDelete?.ticketRef
          ? `This will cancel exception ${pendingDelete.ticketRef}. This action cannot be undone.`
          : 'This will cancel the exception. This action cannot be undone.'}
        confirmLabel="Cancel exception"
        onConfirm={() => { if (pendingDelete) deleteMut.mutate(pendingDelete.id); setPendingDelete(null) }}
        onClose={() => setPendingDelete(null)}
      />
      {SnackbarAlert}
    </Box>
  );
}
