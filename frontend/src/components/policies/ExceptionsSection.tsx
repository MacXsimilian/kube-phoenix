'use client'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import IconButton from '@mui/material/IconButton'
import AddIcon from '@mui/icons-material/Add'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import { EXECUTION_STATUS_COLORS, EXECUTION_STATUS_FALLBACK } from '@/lib/statusColors'
import type { ScheduledException } from '@/lib/types'

function fmtDt(iso: string | null | undefined) {
  if (!iso) return '\u2014'
  return new Date(iso).toLocaleString()
}

function StatusChip({ status }: { status: string }) {
  const s = EXECUTION_STATUS_COLORS[status] ?? EXECUTION_STATUS_FALLBACK
  return (
    <Chip
      label={status}
      size="small"
      sx={{ height: 18, fontSize: 10, bgcolor: s.bg, color: s.color }}
    />
  )
}

export default function ExceptionsSection({
  exceptions,
  canEdit,
  onAddException,
  onEditException,
}: {
  exceptions: ScheduledException[] | undefined
  canEdit: boolean
  onAddException: () => void
  onEditException: (ex: ScheduledException) => void
}) {
  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle1" fontWeight={600}>Scheduled Exceptions</Typography>
        {canEdit && (
          <Button size="small" startIcon={<AddIcon />} onClick={onAddException}>
            Add Exception
          </Button>
        )}
      </Box>
      {exceptions && exceptions.length === 0 && (
        <Typography variant="body2" color="text.secondary">No exceptions scheduled.</Typography>
      )}
      {exceptions && exceptions.length > 0 && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Type</TableCell>
              <TableCell>Window</TableCell>
              <TableCell>Ticket</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Sleep on End</TableCell>
              <TableCell>Details</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {exceptions.map(ex => (
              <TableRow key={ex.id}>
                <TableCell><Chip label={ex.exceptionType} size="small" sx={{ fontSize: 10 }} /></TableCell>
                <TableCell>{fmtDt(ex.startsAt)} \u2192 {fmtDt(ex.endsAt)}</TableCell>
                <TableCell>{ex.ticketRef || '\u2014'}</TableCell>
                <TableCell><StatusChip status={ex.status} /></TableCell>
                <TableCell>{ex.sleepOnEnd ? 'Yes' : 'No'}</TableCell>
                <TableCell>
                  {ex.status === 'cancelled' && ex.cancelReason && (
                    <Typography variant="caption" color="text.secondary">{ex.cancelReason}</Typography>
                  )}
                  {ex.startExecutionId && (
                    <Typography variant="caption" color="text.disabled">exec #{ex.startExecutionId}</Typography>
                  )}
                </TableCell>
                <TableCell>
                  {canEdit && ex.status === 'pending' && (
                    <IconButton size="small" onClick={() => onEditException(ex)}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  )
}
