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
import StatusChip from '@/components/shared/StatusChip'
import { fmtDt } from '@/lib/formatters'
import { TYPE_LABELS, TYPE_LABEL_FALLBACK } from '@/lib/statusColors'
import type { ScheduledException } from '@/lib/types'

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
            {exceptions.map(ex => {
              const typeLabel = TYPE_LABELS[ex.exceptionType] ?? TYPE_LABEL_FALLBACK
              return (
              <TableRow key={ex.id}>
                <TableCell>
                  <Chip label={typeLabel.label} size="small" sx={{ fontSize: 10, color: typeLabel.color, bgcolor: typeLabel.bg }} />
                </TableCell>
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
                    <IconButton size="small" onClick={() => onEditException(ex)} aria-label="Edit exception">
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </Box>
  )
}
