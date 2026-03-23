'use client'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import CircularProgress from '@mui/material/CircularProgress'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import { EXECUTION_STATUS_COLORS, EXECUTION_STATUS_FALLBACK } from '@/lib/statusColors'
import type { PolicyExecution, PolicyExecutionPage } from '@/lib/types'

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

export default function ExecutionHistoryTable({
  executions,
  policyId,
  onRowClick,
}: {
  executions: PolicyExecutionPage | undefined
  policyId: number
  onRowClick: (exec: PolicyExecution) => void
}) {
  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={600} mb={1}>Recent Executions</Typography>
      {!executions && <CircularProgress size={20} />}
      {executions && executions.items.length === 0 && (
        <Typography variant="body2" color="text.secondary">No executions yet.</Typography>
      )}
      {executions && executions.items.length > 0 && (
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
            {executions.items.map(ex => {
              const duration = ex.finishedAt
                ? `${Math.round((new Date(ex.finishedAt).getTime() - new Date(ex.startedAt).getTime()) / 1000)}s`
                : '\u2014'
              const counts = [
                ex.countScaled > 0 && `${ex.countScaled} scaled`,
                ex.countDrained > 0 && `${ex.countDrained} drained`,
                ex.countProtected > 0 && `${ex.countProtected} protected`,
                ex.countErrors > 0 && `${ex.countErrors} errors`,
              ].filter(Boolean).join(', ') || '0'
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
                        height: 18, fontSize: 10,
                        bgcolor: ex.mode === 'apply' ? 'rgba(245,158,11,0.18)' : 'rgba(59,130,246,0.18)',
                        color: ex.mode === 'apply' ? 'warning.main' : 'info.main',
                      }}
                    />
                  </TableCell>
                  <TableCell><StatusChip status={ex.status} /></TableCell>
                  <TableCell>{counts}</TableCell>
                  <TableCell>{fmtDt(ex.startedAt)}</TableCell>
                  <TableCell>{duration}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </Box>
  )
}
