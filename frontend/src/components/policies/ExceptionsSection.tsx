'use client'

import { useState } from 'react'
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
import { TABLE_HEAD_CELL_SX } from '@/lib/tableStyles'
import IconButton from '@mui/material/IconButton'
import AddIcon from '@mui/icons-material/Add'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined'
import StatusChip from '@/components/shared/StatusChip'
import { fmtDt } from '@/lib/formatters'
import { useIsDark } from '@/lib/useIsDark'
import { getTypeLabel } from '@/lib/statusColors'
import { exportException } from '@/lib/api'
import ExportMenu from '@/components/import/ExportMenu'
import ImportDialog from '@/components/import/ImportDialog'
import type { ScheduledException, SnackMessage } from '@/lib/types'

const DEFAULT_VISIBLE = 5

export default function ExceptionsSection({
  exceptions,
  canEdit,
  onAddException,
  onEditException,
  onNotify,
}: {
  exceptions: ScheduledException[] | undefined
  canEdit: boolean
  onAddException: () => void
  onEditException: (ex: ScheduledException) => void
  onNotify?: (msg: string, severity: SnackMessage['severity']) => void
}) {
  const isDark = useIsDark()
  const [showAll, setShowAll] = useState(false)
  const [exportTarget, setExportTarget] = useState<{ anchor: HTMLElement; ex: ScheduledException } | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const total = exceptions?.length ?? 0
  const visible = showAll ? exceptions : exceptions?.slice(0, DEFAULT_VISIBLE)
  const isTruncated = total > DEFAULT_VISIBLE && !showAll

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle1" sx={{
          fontWeight: 600
        }}>Scheduled Exceptions</Typography>
        {canEdit && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" startIcon={<FileUploadOutlinedIcon />} onClick={() => setImportOpen(true)}>
              Import
            </Button>
            <Button size="small" startIcon={<AddIcon />} onClick={onAddException}>
              Add Exception
            </Button>
          </Box>
        )}
      </Box>
      {exceptions && exceptions.length === 0 && (
        <Typography variant="body2" sx={{
          color: "text.secondary"
        }}>No exceptions scheduled.</Typography>
      )}
      {visible && visible.length > 0 && (
        <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={TABLE_HEAD_CELL_SX}>Type</TableCell>
              <TableCell sx={TABLE_HEAD_CELL_SX}>Window</TableCell>
              <TableCell sx={TABLE_HEAD_CELL_SX}>Ticket</TableCell>
              <TableCell sx={TABLE_HEAD_CELL_SX}>Status</TableCell>
              <TableCell sx={TABLE_HEAD_CELL_SX}>Sleep on End</TableCell>
              <TableCell sx={TABLE_HEAD_CELL_SX}>Details</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map(ex => {
              const typeLabel = getTypeLabel(isDark, ex.exceptionType)
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
                      <Typography variant="caption" sx={{
                        color: "text.secondary"
                      }}>{ex.cancelReason}</Typography>
                    )}
                    {ex.startExecutionId && (
                      <Typography variant="caption" sx={{
                        color: "text.disabled"
                      }}>exec #{ex.startExecutionId}</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {canEdit && ex.status === 'pending' && (
                      <IconButton size="small" onClick={() => onEditException(ex)} aria-label="Edit exception">
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    )}
                    <IconButton
                      size="small"
                      onClick={(e) => setExportTarget({ anchor: e.currentTarget, ex })}
                      aria-label="Export exception"
                    >
                      <FileDownloadOutlinedIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </TableContainer>
      )}
      {total > DEFAULT_VISIBLE && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
          <Button size="small" onClick={() => setShowAll(s => !s)}>
            {isTruncated ? `Show all ${total}` : 'Show fewer'}
          </Button>
        </Box>
      )}
      <ExportMenu
        anchorEl={exportTarget?.anchor ?? null}
        open={Boolean(exportTarget)}
        onClose={() => setExportTarget(null)}
        fetchPayload={() => exportException(exportTarget!.ex.id)}
        downloadName={`kube-phoenix-exception-${exportTarget?.ex.ticketRef || exportTarget?.ex.id || 'export'}`}
        onNotify={onNotify}
      />
      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        kind="exception"
        onNotify={onNotify}
      />
    </Box>
  );
}
