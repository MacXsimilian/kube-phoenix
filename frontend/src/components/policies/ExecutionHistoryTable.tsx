'use client'

import { useState, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import CircularProgress from '@mui/material/CircularProgress'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import StatusChip from '@/components/shared/StatusChip'
import { fmtDtShort, fmtDuration } from '@/lib/formatters'
import { MODE_COLORS, SMALL_CHIP_SX } from '@/lib/statusColors'
import type { PolicyExecution, PolicyExecutionPage } from '@/lib/types'

const STATUS_OPTIONS = ['all', 'running', 'success', 'failed'] as const

export default function ExecutionHistoryTable({
  executions,
  policyId,
  onRowClick,
}: {
  executions: PolicyExecutionPage | undefined
  policyId: number
  onRowClick: (exec: PolicyExecution) => void
}) {
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filtered = useMemo(() => {
    if (!executions) return undefined
    if (statusFilter === 'all') return executions.items
    return executions.items.filter(ex => ex.status === statusFilter)
  }, [executions, statusFilter])

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle1" fontWeight={600}>Recent Executions</Typography>
        <TextField
          select
          size="small"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          label="Status"
          sx={{ minWidth: 120, '& .MuiInputBase-input': { fontSize: 13, py: 0.75 } }}
        >
          {STATUS_OPTIONS.map(opt => (
            <MenuItem key={opt} value={opt}>
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </MenuItem>
          ))}
        </TextField>
      </Box>
      {!executions && <CircularProgress size={20} />}
      {filtered && filtered.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          {statusFilter === 'all' ? 'No executions yet.' : `No ${statusFilter} executions.`}
        </Typography>
      )}
      {filtered && filtered.length > 0 && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Direction</TableCell>
              <TableCell>Trigger</TableCell>
              <TableCell>Mode</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Scaled</TableCell>
              <TableCell>Started</TableCell>
              <TableCell>Duration</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map(ex => {
              const counts = [
                ex.countScaled > 0 && `${ex.countScaled} scaled`,
                ex.countDrained > 0 && `${ex.countDrained} drained`,
                ex.countProtected > 0 && `${ex.countProtected} protected`,
                ex.countErrors > 0 && `${ex.countErrors} errors`,
              ].filter(Boolean).join(', ') || '0'
              const modeStyle = MODE_COLORS[ex.mode]
              return (
                <TableRow key={ex.id} hover sx={{ cursor: 'pointer' }} onClick={() => onRowClick(ex)}>
                  <TableCell>#{ex.id}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {ex.direction === 'sleep'
                        ? <BedtimeIcon sx={{ fontSize: 13, color: '#a5b4fc' }} />
                        : <WbSunnyIcon sx={{ fontSize: 13, color: '#fcd34d' }} />}
                      {ex.direction}
                    </Box>
                  </TableCell>
                  <TableCell>{ex.trigger}</TableCell>
                  <TableCell>
                    <Chip
                      label={ex.mode?.toUpperCase() ?? '\u2014'}
                      size="small"
                      sx={{
                        ...SMALL_CHIP_SX,
                        bgcolor: modeStyle?.bg, color: modeStyle?.color,
                      }}
                    />
                  </TableCell>
                  <TableCell><StatusChip status={ex.status} /></TableCell>
                  <TableCell>{counts}</TableCell>
                  <TableCell>{fmtDtShort(ex.startedAt)}</TableCell>
                  <TableCell>{fmtDuration(ex.startedAt, ex.finishedAt)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </Box>
  )
}
