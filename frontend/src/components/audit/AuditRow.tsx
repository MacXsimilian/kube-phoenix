'use client'

import { useState } from 'react'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import Box from '@mui/material/Box'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import Tooltip from '@mui/material/Tooltip'
import { formatActionLabel, actionColor } from '@/components/audit/auditFormatters'
import { fmtDt } from '@/lib/formatters'
import type { AuditLogEntry } from '@/lib/types'
import JsonDiffView from './JsonDiffView'

const TABLE_COLS = 6
const NULL_SNAPSHOT = 'null'

function isEmptySnapshot(json?: string): boolean {
  return !json || json === NULL_SNAPSHOT
}

function fmtUTC(iso: string): string {
  return new Date(iso).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
}

export default function AuditRow({ entry }: { entry: AuditLogEntry }) {
  const [open, setOpen] = useState(false)
  const hasDiff = !isEmptySnapshot(entry.before) || !isEmptySnapshot(entry.after)

  return (
    <>
      <TableRow>
        <TableCell sx={{ width: 40 }}>
          {hasDiff && (
            <IconButton size="small" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label="Show changes">
              {open ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
            </IconButton>
          )}
        </TableCell>
        <TableCell>
          <Tooltip title={fmtUTC(entry.timestamp)} arrow placement="top">
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                fontVariantNumeric: 'tabular-nums',
                cursor: 'default'
              }}>
              {fmtDt(entry.timestamp)}
            </Typography>
          </Tooltip>
        </TableCell>
        <TableCell>
          <Typography variant="body2" sx={{
            fontWeight: 600
          }}>{entry.username}</Typography>
        </TableCell>
        <TableCell>
          <Chip label={formatActionLabel(entry.action)} size="small" color={actionColor(entry.action)} variant="outlined" />
        </TableCell>
        <TableCell>
          {entry.resourceType && (
            <Typography variant="caption" sx={{
              color: "text.secondary"
            }}>
              {entry.resourceType}{entry.resourceId != null ? ` #${entry.resourceId}` : ''}
            </Typography>
          )}
        </TableCell>
        <TableCell>
          <Typography variant="caption" sx={{
            color: "text.secondary"
          }}>{entry.ipAddress}</Typography>
        </TableCell>
      </TableRow>
      {hasDiff && (
        <TableRow>
          <TableCell colSpan={TABLE_COLS} sx={{ py: 0 }}>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <Box sx={{ p: 2 }}>
                <JsonDiffView before={entry.before} after={entry.after} />
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
