'use client'

import { useState, useEffect, useCallback, memo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
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
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined'
import { getPolicyExecutions } from '@/lib/api'
import { fmtDtShort, fmtDuration } from '@/lib/formatters'
import { useIsDark } from '@/lib/useIsDark'
import { EXECUTIONS_REFETCH_MS } from '@/lib/constants'
import { getModeStyle, SMALL_CHIP_SX } from '@/lib/statusColors'
import StatusChip from '@/components/shared/StatusChip'
import TriggerChip from '@/components/shared/TriggerChip'
import type { PolicyExecution } from '@/lib/types'
import { TABLE_HEAD_CELL_SX } from '@/lib/tableStyles'

const FILTER_BAR_SX = { display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap', alignItems: 'center' } as const
const FILTER_FIELD_SX = { minWidth: 140 } as const
const ERROR_ALERT_SX = { mx: 2, mt: 2 } as const
const LOADING_BOX_SX = { p: 2, display: 'flex', flexDirection: 'column', gap: 1 } as const
const EMPTY_CELL_SX = { color: 'text.secondary', py: 3, textAlign: 'center' } as const
const ROW_SX = { cursor: 'pointer' } as const
const STARTED_CELL_SX = { fontSize: 13 } as const
const POLICY_NAME_SX = { maxWidth: 160 } as const
const DIRECTION_INNER_SX = { display: 'flex', alignItems: 'center', gap: 0.75 } as const
const SLEEP_ICON_SX = { fontSize: 14, color: 'primary.main' } as const
const WAKE_ICON_SX = { fontSize: 14, color: 'warning.main' } as const
const DURATION_CELL_SX = { fontSize: 13, color: 'text.secondary' } as const
const SUMMARY_OUTER_SX = { display: 'flex', alignItems: 'center', gap: 1 } as const
const SUMMARY_ITEM_SX = { display: 'flex', alignItems: 'center', gap: 0.25 } as const
const SUMMARY_ICON_SX = { fontSize: 12, color: 'text.secondary' } as const
const SUMMARY_TEXT_SX = { color: 'text.secondary' } as const
const SUMMARY_ERROR_ICON_SX = { fontSize: 12, color: 'error.main' } as const
const SUMMARY_ERROR_TEXT_SX = { color: 'error.main' } as const

function SummaryCell({ exec }: { exec: PolicyExecution }) {
  const isWake = exec.direction === 'wake'
  return (
    <Box sx={SUMMARY_OUTER_SX}>
      <Tooltip title={isWake ? 'Restored' : 'Scaled'}>
        <Box sx={SUMMARY_ITEM_SX}>
          {isWake
            ? <ArrowUpwardIcon sx={SUMMARY_ICON_SX} />
            : <ArrowDownwardIcon sx={SUMMARY_ICON_SX} />
          }
          <Typography variant="caption" sx={SUMMARY_TEXT_SX}>{exec.countScaled}</Typography>
        </Box>
      </Tooltip>
      {exec.countDrained > 0 && (
        <Tooltip title="Drained">
          <Box sx={SUMMARY_ITEM_SX}>
            <CloudOffIcon sx={SUMMARY_ICON_SX} />
            <Typography variant="caption" sx={SUMMARY_TEXT_SX}>{exec.countDrained}</Typography>
          </Box>
        </Tooltip>
      )}
      {exec.countDeleted > 0 && (
        <Tooltip title="Deleted">
          <Box sx={SUMMARY_ITEM_SX}>
            <DeleteOutlineIcon sx={SUMMARY_ICON_SX} />
            <Typography variant="caption" sx={SUMMARY_TEXT_SX}>{exec.countDeleted}</Typography>
          </Box>
        </Tooltip>
      )}
      {exec.countErrors > 0 && (
        <Tooltip title="Errors">
          <Box sx={SUMMARY_ITEM_SX}>
            <ErrorOutlineIcon sx={SUMMARY_ERROR_ICON_SX} />
            <Typography variant="caption" sx={SUMMARY_ERROR_TEXT_SX}>{exec.countErrors}</Typography>
          </Box>
        </Tooltip>
      )}
    </Box>
  );
}

type ExecutionRowProps = {
  exec: PolicyExecution
  modeStyle: { bg: string; color: string } | undefined
  onClick: (exec: PolicyExecution) => void
}

const ExecutionRow = memo(function ExecutionRow({ exec, modeStyle, onClick }: ExecutionRowProps) {
  return (
    <TableRow hover sx={ROW_SX} onClick={() => onClick(exec)}>
      <TableCell sx={STARTED_CELL_SX}>{fmtDtShort(exec.startedAt)}</TableCell>
      <TableCell>
        <Typography variant="body2" noWrap sx={POLICY_NAME_SX}>
          {exec.policy?.name ?? `Policy #${exec.policyId}`}
        </Typography>
      </TableCell>
      <TableCell>
        <Box sx={DIRECTION_INNER_SX}>
          {exec.direction === 'sleep' ? (
            <BedtimeIcon sx={SLEEP_ICON_SX} />
          ) : (
            <WbSunnyIcon sx={WAKE_ICON_SX} />
          )}
          <Typography variant="body2">{exec.direction === 'sleep' ? 'Sleep' : 'Wake'}</Typography>
        </Box>
      </TableCell>
      <TableCell><TriggerChip trigger={exec.trigger} /></TableCell>
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
      <TableCell><StatusChip status={exec.status} hideSpinner /></TableCell>
      <TableCell sx={DURATION_CELL_SX}>{fmtDuration(exec.startedAt, exec.finishedAt)}</TableCell>
      <TableCell><SummaryCell exec={exec} /></TableCell>
    </TableRow>
  )
})

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
    queryKey: queryKeys.policyExecutionsTable(page, rowsPerPage, statusFilter, directionFilter),
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

  const handleRowClick = useCallback((exec: PolicyExecution) => onSelect(exec), [onSelect])

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
      <Box sx={FILTER_BAR_SX}>
        <TextField
          label="Status" select size="small" value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(0) }}
          sx={FILTER_FIELD_SX}
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
          sx={FILTER_FIELD_SX}
        >
          <MenuItem value="">All Directions</MenuItem>
          <MenuItem value="sleep">Sleep</MenuItem>
          <MenuItem value="wake">Wake</MenuItem>
        </TextField>
      </Box>
      <Paper>
      {isError && (
        <Alert severity="warning" sx={ERROR_ALERT_SX}>
          Could not load executions — showing last known data.
        </Alert>
      )}

      {isLoading ? (
        <Box sx={LOADING_BOX_SX}>
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
                  <TableCell sx={TABLE_HEAD_CELL_SX}>TRIGGER</TableCell>
                  <TableCell sx={TABLE_HEAD_CELL_SX}>MODE</TableCell>
                  <TableCell sx={TABLE_HEAD_CELL_SX}>STATUS</TableCell>
                  <TableCell sx={TABLE_HEAD_CELL_SX}>DURATION</TableCell>
                  <TableCell sx={TABLE_HEAD_CELL_SX}>SUMMARY</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!data?.items?.length ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <Typography variant="body2" sx={EMPTY_CELL_SX}>
                        {isError ? 'Could not load executions.' : 'No executions yet.'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  data.items.map((exec) => (
                    <ExecutionRow
                      key={exec.id}
                      exec={exec}
                      modeStyle={getModeStyle(isDark, exec.mode)}
                      onClick={handleRowClick}
                    />
                  ))
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
            rowsPerPageOptions={[10, 20, 50, 100]}
          />
        </>
      )}
    </Paper>
    </>
  );
}
