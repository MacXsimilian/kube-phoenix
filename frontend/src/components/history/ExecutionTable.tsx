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
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import { getExecutions } from '@/lib/api'
import type { Execution } from '@/lib/types'

function duration(exec: Execution): string {
  if (!exec.finishedAt) return 'Running...'
  const ms = new Date(exec.finishedAt).getTime() - new Date(exec.startedAt).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function StatusChip({ status }: { status: Execution['status'] }) {
  if (status === 'running') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <CircularProgress size={12} />
        <Chip label="Running" color="info" size="small" sx={{ height: 20, fontSize: 11 }} />
      </Box>
    )
  }
  return (
    <Chip
      label={status === 'success' ? 'Success' : 'Failed'}
      color={status === 'success' ? 'success' : 'error'}
      size="small"
      sx={{ height: 20, fontSize: 11 }}
    />
  )
}

function SummaryCell({ exec }: { exec: Execution }) {
  const isWake = exec.schedule?.type === 'scale_up'
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

export default function ExecutionTable({
  onSelect,
  initialExecId,
}: {
  onSelect: (e: Execution) => void
  initialExecId?: number
}) {
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(20)
  const [autoOpened, setAutoOpened] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['executions', page, rowsPerPage],
    queryFn: () => getExecutions({ page, pageSize: rowsPerPage }),
    refetchInterval: 10_000,
  })

  useEffect(() => {
    if (autoOpened || !initialExecId || !data?.items?.length) return
    const exec = data.items.find((e) => e.id === initialExecId)
    if (exec) {
      setAutoOpened(true)
      onSelect(exec)
    }
  }, [data, initialExecId, autoOpened, onSelect])

  return (
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
                  <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12 }}>STARTED</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12 }}>SCHEDULE</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12 }}>MODE</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12 }}>STATUS</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12 }}>DURATION</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12 }}>SUMMARY</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!data?.items?.length ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                        {isError ? 'Could not load executions.' : 'No executions yet.'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  data.items.map((exec) => (
                    <TableRow
                      key={exec.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => onSelect(exec)}
                    >
                      <TableCell sx={{ fontSize: 13 }}>{formatDate(exec.startedAt)}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          {exec.schedule?.type === 'scale_down' ? (
                            <BedtimeIcon sx={{ fontSize: 14, color: 'primary.main' }} />
                          ) : (
                            <WbSunnyIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                          )}
                          <Typography variant="body2">{exec.schedule?.name ?? '—'}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={exec.mode.toUpperCase()}
                          size="small"
                          sx={{
                            height: 18, fontSize: 10,
                            bgcolor: exec.mode === 'apply' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)',
                            color: exec.mode === 'apply' ? 'warning.main' : 'info.main',
                          }}
                        />
                      </TableCell>
                      <TableCell><StatusChip status={exec.status} /></TableCell>
                      <TableCell sx={{ fontSize: 13, color: 'text.secondary' }}>{duration(exec)}</TableCell>
                      <TableCell><SummaryCell exec={exec} /></TableCell>
                    </TableRow>
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
            rowsPerPageOptions={[10, 20, 50]}
          />
        </>
      )}
    </Paper>
  )
}
