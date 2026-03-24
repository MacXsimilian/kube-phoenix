'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import IconButton from '@mui/material/IconButton'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import AddIcon from '@mui/icons-material/Add'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { getExceptions, deleteException } from '@/lib/api'
import type { ScheduledException } from '@/lib/types'
import ExceptionDialog from '@/components/policies/ExceptionDialog'
import { useAuth } from '@/lib/auth'
import { canEditSchedules } from '@/lib/rbac'
import { fmtDt } from '@/lib/formatters'
import { EXECUTION_STATUS_COLORS, EXECUTION_STATUS_FALLBACK, TYPE_LABELS, TYPE_LABEL_FALLBACK } from '@/lib/statusColors'

const STATUS_TABS = ['all', 'pending', 'active', 'completed', 'cancelled']

export default function ExceptionsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ScheduledException | undefined>()
  const [tab, setTab] = useState(0)
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null)

  const statusFilter = tab === 0 ? undefined : STATUS_TABS[tab]

  const { data: exceptions, isLoading } = useQuery({
    queryKey: ['exceptions', statusFilter],
    queryFn: () => getExceptions(statusFilter ? { status: statusFilter } : undefined),
    refetchInterval: 30_000,
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteException(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exceptions'] })
      setSnack({ msg: 'Exception cancelled', severity: 'success' })
    },
    onError: (err: unknown) => {
      setSnack({ msg: err instanceof Error ? err.message : 'Cancel failed', severity: 'error' })
    },
  })

  const canEdit = canEditSchedules(user?.permissions)

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>Scheduled Exceptions</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => { setEditing(undefined); setDialogOpen(true) }}
          disabled={!canEdit}
        >
          New Exception
        </Button>
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

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

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
        <Table>
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
              const statusColor = EXECUTION_STATUS_COLORS[ex.status] ?? EXECUTION_STATUS_FALLBACK
              const typeLabel = TYPE_LABELS[ex.exceptionType] ?? TYPE_LABEL_FALLBACK
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
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => deleteMut.mutate(ex.id)}
                          aria-label="Cancel exception"
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      <ExceptionDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(undefined) }}
        existing={editing}
        onNotify={(msg, severity) => setSnack({ msg, severity })}
      />

      <Snackbar
        open={!!snack}
        autoHideDuration={4000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snack ? (
          <Alert severity={snack.severity} onClose={() => setSnack(null)} sx={{ width: '100%' }}>
            {snack.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  )
}
