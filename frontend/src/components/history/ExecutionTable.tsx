'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import Alert from '@mui/material/Alert'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TablePagination from '@mui/material/TablePagination'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import { getPolicyExecutions } from '@/lib/api'
import { fmtDtShort, fmtDuration } from '@/lib/formatters'
import { useIsDark } from '@/lib/useIsDark'
import { EXECUTIONS_REFETCH_MS } from '@/lib/constants'
import { getModeStyle, SMALL_CHIP_SX } from '@/lib/statusColors'
import StatusChip from '@/components/shared/StatusChip'
import type { PolicyExecution } from '@/lib/types'
import { TABLE_HEAD_CELL_SX } from '@/lib/tableStyles'

function SummaryCell({ exec }: { exec: PolicyExecution }) {
  const isWake = exec.direction === 'wake'
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Tooltip title={isWake ? 'Restored' : 'Scaled'}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
          {isWake
            ? <ArrowUpwardIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
            : <ArrowDownwardIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
          }
          <Typography variant="caption" color="text.secondary">{exec.countScaled}</Typography>
        </Box>
      </Tooltip>
      {exec.countDrained > 0 && (
        <Tooltip title="Drained">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            <CloudOffIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">{exec.countDrained}</Typography>
          </Box>
        </Tooltip>
      )}
      {exec.countDeleted > 0 && (
        <Tooltip title="Deleted">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            <DeleteOutlineIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">{exec.countDeleted}</Typography>
          </Box>
        </Tooltip>
      )}
      {exec.countErrors > 0 && (
        <Tooltip title="Errors">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            <ErrorOutlineIcon sx={{ fontSize: 12, color: 'error.main' }} />
            <Typography variant="caption" color="error.main">{exec.countErrors}</Typography>
          </Box>
        </Tooltip>
      )}
    </Box>
  )
}

export default function PolicyExecutionTable({
  onSelect,
  initialExecId,
}: {
  onSelect: (e: PolicyExecution) => void
  initialExecId?: number
}) {
  const isDark = useIsDark()
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(20)
  const [autoOpened, setAutoOpened] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [directionFilter, setDirectionFilter] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['policy-executions', page, rowsPerPage, statusFilter, directionFilter],
    queryFn: () => getPolicyExecutions({
      page,
      pageSize: rowsPerPage,
      status: statusFilter || undefined,
      direction: directionFilter || undefined,
    }),
    refetchInterval: EXECUTIONS_REFETCH_MS,
  })

  useEffect(() => {
    if (autoOpened || !initialExecId || !data?.items?.length) return
    const exec = data.items.find((e) => e.id === initialExecId)
    if (exec) {
      setAutoOpened(true)
      onSelect(exec)
    }
  }, [data, initialExecId, autoOpened, onSelect])

  if (isError && !data?.items?.length) {
    return (
      <Alert severity="warning">
        Could not load executions.
      </Alert>
    )
  }

  return (
    <>
      {/* Filters — outside the card, matching the Cluster State layout */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          label="Status" select size="small" value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(0) }}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="">All Statuses</MenuItem>
          <MenuItem value="running">Running</MenuItem>
          <MenuItem value="success">Success</MenuItem>
          <MenuItem value="failed">Failed</MenuItem>
          <MenuItem value="interrupted">Interrupted</MenuItem>
          <MenuItem value="skipped">Skipped</MenuItem>
        </TextField>
        <TextField
          label="Direction" select size="small" value={directionFilter}
          onChange={e => { setDirectionFilter(e.target.value); setPage(0) }}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="">All Directions</MenuItem>
          <MenuItem value="sleep">Sleep</MenuItem>
          <MenuItem value="wake">Wake</MenuItem>
        </TextField>
      </Box>

      <Paper>
      {isError && (
        <Alert severity="warning" sx={{ mx: 2, mt: 2 }}>
          Could not load executions — showing last known data.
        </Alert>
      )}

      {isLoading ? (
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} variant="rounded" height={44} />
          ))}
        </Box>
      ) : (
        <>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={TABLE_HEAD_CELL_SX}>STARTED</TableCell>
                  <TableCell sx={TABLE_HEAD_CELL_SX}>POLICY</TableCell>
                  <TableCell sx={TABLE_HEAD_CELL_SX}>DIRECTION</TableCell>
                  <TableCell sx={TABLE_HEAD_CELL_SX}>MODE</TableCell>
                  <TableCell sx={TABLE_HEAD_CELL_SX}>STATUS</TableCell>
                  <TableCell sx={TABLE_HEAD_CELL_SX}>DURATION</TableCell>
                  <TableCell sx={TABLE_HEAD_CELL_SX}>SUMMARY</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!data?.items?.length ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                        {isError ? 'Could not load executions.' : 'No executions yet.'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  data.items.map((exec) => {
                    const modeStyle = getModeStyle(isDark, exec.mode)
                    return (
                      <TableRow
                        key={exec.id}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => onSelect(exec)}
                      >
                        <TableCell sx={{ fontSize: 13 }}>{fmtDtShort(exec.startedAt)}</TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 160 }}>
                            {exec.policy?.name ?? `Policy #${exec.policyId}`}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            {exec.direction === 'sleep' ? (
                              <BedtimeIcon sx={{ fontSize: 14, color: 'primary.main' }} />
                            ) : (
                              <WbSunnyIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                            )}
                            <Typography variant="body2">{exec.direction === 'sleep' ? 'Sleep' : 'Wake'}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={exec.mode.toUpperCase()}
                            size="small"
                            sx={{
                              ...SMALL_CHIP_SX,
                              bgcolor: modeStyle?.bg, color: modeStyle?.color,
                            }}
                          />
                        </TableCell>
                        <TableCell><StatusChip status={exec.status} /></TableCell>
                        <TableCell sx={{ fontSize: 13, color: 'text.secondary' }}>{fmtDuration(exec.startedAt, exec.finishedAt)}</TableCell>
                        <TableCell><SummaryCell exec={exec} /></TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={data?.total ?? 0}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0) }}
            rowsPerPageOptions={[10, 20, 50]}
          />
        </>
      )}
    </Paper>
    </>
  )
}
