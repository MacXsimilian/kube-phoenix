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
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import TouchAppOutlinedIcon from '@mui/icons-material/TouchAppOutlined'
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined'
import SkipNextOutlinedIcon from '@mui/icons-material/SkipNextOutlined'
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
  if (status === 'skipped') {
    return <Chip label="Skipped" color="default" size="small" sx={{ height: 20, fontSize: 11 }} />
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

function ExecutionTypeIcon({ type }: { type: Execution['executionType'] }) {
  if (!type || type === 'scheduled') {
    return (
      <Tooltip title="Scheduled">
        <AccessTimeIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
      </Tooltip>
    )
  }
  if (type === 'manual') {
    return (
      <Tooltip title="Manual trigger">
        <TouchAppOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
      </Tooltip>
    )
  }
  if (type === 'drift_correction') {
    return (
      <Tooltip title="Drift correction">
        <SyncOutlinedIcon sx={{ fontSize: 14, color: 'info.main' }} />
      </Tooltip>
    )
  }
  if (type === 'skipped') {
    return (
      <Tooltip title="Skipped">
        <SkipNextOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
      </Tooltip>
    )
  }
  return null
}

function SummaryCell({ exec }: { exec: Execution }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Tooltip title="Scaled">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
          <ArrowDownwardIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
          <Typography variant="caption" color="text.secondary">{exec.countScaled}</Typography>
        </Box>
      </Tooltip>
      <Tooltip title="Drained">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
          <CloudOffIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
          <Typography variant="caption" color="text.secondary">{exec.countDrained}</Typography>
        </Box>
      </Tooltip>
      <Tooltip title="Deleted">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
          <DeleteOutlineIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
          <Typography variant="caption" color="text.secondary">{exec.countDeleted}</Typography>
        </Box>
      </Tooltip>
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

const EXECUTION_TYPE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'manual', label: 'Manual' },
  { value: 'drift_correction', label: 'Drift Correction' },
  { value: 'skipped', label: 'Skipped' },
]

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
  const [typeFilter, setTypeFilter] = useState('all')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['executions', page, rowsPerPage, typeFilter],
    queryFn: () => getExecutions({
      page,
      pageSize: rowsPerPage,
      executionType: typeFilter !== 'all' ? typeFilter : undefined,
    }),
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
      {/* Type filter */}
      <Box sx={{ p: 2, pb: 0 }}>
        <TextField
          select
          label="Execution Type"
          size="small"
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(0) }}
          sx={{ minWidth: 180 }}
        >
          {EXECUTION_TYPE_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
          ))}
        </TextField>
      </Box>

      {isError && (
        <Alert severity="warning" sx={{ mx: 2, mt: 1.5 }}>
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
                  <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12 }}>TYPE</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12 }}>POLICY / SCHEDULE</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12 }}>MODE</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12 }}>STATUS</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12 }}>DURATION</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12 }}>SUMMARY</TableCell>
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
                  data.items.map((exec) => (
                    <TableRow
                      key={exec.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => onSelect(exec)}
                    >
                      <TableCell sx={{ fontSize: 13 }}>{formatDate(exec.startedAt)}</TableCell>
                      <TableCell>
                        <ExecutionTypeIcon type={exec.executionType} />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          {exec.action === 'scale_down' ? (
                            <BedtimeIcon sx={{ fontSize: 14, color: 'primary.main' }} />
                          ) : (
                            <WbSunnyIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                          )}
                          <Typography variant="body2">
                            {exec.policy?.name ?? '—'}
                          </Typography>
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
