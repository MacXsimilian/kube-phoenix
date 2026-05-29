'use client'

import { memo, useState } from 'react'
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

const TOGGLE_CELL_SX = { width: 40 } as const
const TIMESTAMP_TEXT_SX = {
  color: 'text.secondary',
  fontVariantNumeric: 'tabular-nums',
  cursor: 'default',
} as const
const USERNAME_TEXT_SX = { fontWeight: 600 } as const
const SECONDARY_CAPTION_SX = { color: 'text.secondary' } as const
const DIFF_CELL_SX = { py: 0 } as const
const DIFF_INNER_SX = { p: 2 } as const

function isEmptySnapshot(json?: string): boolean {
  return !json || json === NULL_SNAPSHOT
}

function fmtUTC(iso: string): string {
  return new Date(iso).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
}

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  const [open, setOpen] = useState(false)
  const hasDiff = !isEmptySnapshot(entry.before) || !isEmptySnapshot(entry.after)

  return (
    <>
      <TableRow>
        <TableCell sx={TOGGLE_CELL_SX}>
          {hasDiff && (
            <IconButton size="small" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label="Show changes">
              {open ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
            </IconButton>
          )}
        </TableCell>
        <TableCell>
          <Tooltip title={fmtUTC(entry.timestamp)} arrow placement="top">
            <Typography variant="caption" sx={TIMESTAMP_TEXT_SX}>
              {fmtDt(entry.timestamp)}
            </Typography>
          </Tooltip>
        </TableCell>
        <TableCell>
          <Typography variant="body2" sx={USERNAME_TEXT_SX}>{entry.username}</Typography>
        </TableCell>
        <TableCell>
          <Chip label={formatActionLabel(entry.action)} size="small" color={actionColor(entry.action)} variant="outlined" />
        </TableCell>
        <TableCell>
          {entry.resourceType && (
            <Typography variant="caption" sx={SECONDARY_CAPTION_SX}>
              {entry.resourceType}{entry.resourceId != null ? ` #${entry.resourceId}` : ''}
            </Typography>
          )}
        </TableCell>
        <TableCell>
          <Typography variant="caption" sx={SECONDARY_CAPTION_SX}>{entry.ipAddress}</Typography>
        </TableCell>
      </TableRow>
      {hasDiff && (
        <TableRow>
          <TableCell colSpan={TABLE_COLS} sx={DIFF_CELL_SX}>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <Box sx={DIFF_INNER_SX}>
                <JsonDiffView before={entry.before} after={entry.after} />
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default memo(AuditRow)
