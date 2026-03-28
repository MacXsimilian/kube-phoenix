'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatError } from '@/lib/formatters'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CenteredSpinner from '@/components/common/CenteredSpinner'
import Alert from '@mui/material/Alert'
import Table from '@mui/material/Table'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import IconButton from '@mui/material/IconButton'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import AddIcon from '@mui/icons-material/Add'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import Tooltip from '@mui/material/Tooltip'
import CloseIcon from '@mui/icons-material/Close'
import { getExceptions, deleteException } from '@/lib/api'
import type { ScheduledException } from '@/lib/types'
import ExceptionDialog from '@/components/policies/ExceptionDialog'
import { useAuth } from '@/lib/auth'
import { canEditSchedules } from '@/lib/rbac'
import { fmtDt } from '@/lib/formatters'
import { useIsDark } from '@/lib/useIsDark'
import { executionStatusColors, executionStatusFallback, getTypeLabel } from '@/lib/statusColors'
import { EXCEPTIONS_REFETCH_MS } from '@/lib/constants'
import { useSnackbar } from '@/lib/useSnackbar'

const STATUS_TABS = ['all', 'pending', 'active', 'completed', 'cancelled']

export default function ExceptionsPage() {
  const { user } = useAuth()
  const isDark = useIsDark()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ScheduledException | undefined>()
  const [tab, setTab] = useState(0)
  const { notify, SnackbarAlert } = useSnackbar()
  const [pendingDelete, setPendingDelete] = useState<ScheduledException | null>(null)

  const statusFilter = tab === 0 ? undefined : STATUS_TABS[tab]

  const { data: exceptions, isLoading, isError } = useQuery({
    queryKey: ['exceptions', statusFilter],
    queryFn: () => getExceptions(statusFilter ? { status: statusFilter } : undefined),
    refetchInterval: EXCEPTIONS_REFETCH_MS,
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteException(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exceptions'] })
      notify('Exception cancelled', 'success')
    },
    onError: (err: unknown) => {
      notify(formatError(err), 'error')
    },
  })

  function confirmDelete(ex: ScheduledException) {
    setPendingDelete(ex)
  }

  function handleDeleteConfirmed() {
    if (pendingDelete) {
      deleteMut.mutate(pendingDelete.id)
    }
    setPendingDelete(null)
  }

  const STATUS_COLORS = executionStatusColors(isDark)
  const STATUS_FALLBACK = executionStatusFallback(isDark)

  const canEdit = canEditSchedules(user?.permissions)

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>Scheduled Exceptions</Typography>
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

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        One-time windows that override the normal sleep/wake schedule — e.g. keeping workloads awake over a release weekend.
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        {STATUS_TABS.map(s => <Tab key={s} label={s.charAt(0).toUpperCase() + s.slice(1)} />)}
      </Tabs>

      {isError && <Alert severity="error" sx={{ mb: 2 }}>Failed to load exceptions</Alert>}

      {isLoading && <CenteredSpinner />}

      {exceptions && exceptions.length === 0 && (
        <Box
          sx={{
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
          }}
        >
          <Typography variant="body2" color="text.secondary">
            No exceptions found.
          </Typography>
        </Box>
      )}

      {exceptions && exceptions.length > 0 && (
        <TableContainer>
        <Table aria-label="Scheduled exceptions">
          <TableHead>
            <TableRow>
              <TableCell>Type</TableCell>
              <TableCell>Window</TableCell>
              <TableCell>Ticket</TableCell>
              <TableCell>Reason</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Sleep on End</TableCell>
              <TableCell>Created By</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {exceptions.map(ex => {
              const statusColor = STATUS_COLORS[ex.status] ?? STATUS_FALLBACK
              const typeLabel = getTypeLabel(isDark, ex.exceptionType)
              return (
                <TableRow key={ex.id} hover>
                  <TableCell>
                    <Chip label={typeLabel.label} size="small" sx={{ fontSize: 10, color: typeLabel.color, bgcolor: typeLabel.bg }} />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {fmtDt(ex.startsAt)}<br />
                    <Typography variant="caption" color="text.disabled">→ {fmtDt(ex.endsAt)}</Typography>
                  </TableCell>
                  <TableCell>{ex.ticketRef || '—'}</TableCell>
                  <TableCell sx={{ maxWidth: 200 }}>
                    <Typography variant="body2" noWrap>{ex.reason || '—'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={ex.status}
                      size="small"
                      sx={{ height: 18, fontSize: 10, bgcolor: statusColor.bg, color: statusColor.color }}
                    />
                  </TableCell>
                  <TableCell>{ex.sleepOnEnd ? 'Yes' : 'No'}</TableCell>
                  <TableCell>{ex.createdBy}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {canEdit && ex.status === 'pending' && (
                        <IconButton size="small" onClick={() => { setEditing(ex); setDialogOpen(true) }} aria-label="Edit exception">
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      )}
                      {canEdit && (ex.status === 'pending' || ex.status === 'active') && (
                        <Tooltip title="Cancel exception">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => confirmDelete(ex)}
                            aria-label="Cancel exception"
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        </TableContainer>
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
        onConfirm={handleDeleteConfirmed}
        onClose={() => setPendingDelete(null)}
      />

      {SnackbarAlert}
    </Box>
  )
}
