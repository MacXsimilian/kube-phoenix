'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableSortLabel from '@mui/material/TableSortLabel'
import TablePagination from '@mui/material/TablePagination'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import RefreshIcon from '@mui/icons-material/Refresh'
import Tooltip from '@mui/material/Tooltip'
import { getWorkloads } from '@/lib/api'
import type { Workload } from '@/lib/types'
import { sinceMs } from '@/lib/formatters'
import { useTheme } from '@mui/material/styles'
import { statusColors } from '@/components/cluster/statusColors'
import { useColors } from '@/lib/colors'
import { WORKLOADS_REFETCH_MS } from '@/lib/constants'
import WorkloadDetailDrawer from './WorkloadDetailDrawer'

const validStatuses = ['running', 'sleeping', 'partial']

export default function WorkloadsTable() {
  const searchParams = useSearchParams()
  const { data: workloads = [], isLoading, isError, error, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['workloads'],
    queryFn: getWorkloads,
    refetchInterval: WORKLOADS_REFETCH_MS,
  })

  const [search, setSearch] = useState('')
  const [nsFilter, setNsFilter] = useState('all')
  const initialStatus = searchParams.get('status') ?? 'all'
  const [statusFilter, setStatusFilter] = useState(validStatuses.includes(initialStatus) ? initialStatus : 'all')

  useEffect(() => {
    const statusFromUrl = searchParams.get('status') ?? 'all'
    setStatusFilter(validStatuses.includes(statusFromUrl) ? statusFromUrl : 'all')
  }, [searchParams])
  const [sortCol, setSortCol] = useState<'namespace' | 'name' | 'kind' | 'replicas' | 'status' | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(20)
  const [selectedWorkload, setSelectedWorkload] = useState<Workload | null>(null)
  const isDark = useTheme().palette.mode === 'dark'
  const colors = useColors()
  const STATUS_COLORS = statusColors(isDark)

  const handleSort = useCallback((col: typeof sortCol) => {
    if (sortCol === col) {
      if (sortDir === 'asc') setSortDir('desc')
      else { setSortCol(null); setSortDir('asc') }
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }, [sortCol, sortDir])

  const namespaces = useMemo(
    () => ['all', ...Array.from(new Set(workloads.map((w) => w.namespace))).sort()],
    [workloads]
  )

  const filtered = useMemo(
    () =>
      workloads.filter((w) => {
        if (nsFilter !== 'all' && w.namespace !== nsFilter) return false
        if (statusFilter !== 'all' && w.status !== statusFilter) return false
        if (search && !w.name.toLowerCase().includes(search.toLowerCase())) return false
        return true
      }),
    [workloads, nsFilter, statusFilter, search]
  )

  const sorted = useMemo(() => {
    if (!sortCol) return filtered
    return [...filtered].sort((a, b) => {
      let cmp = 0
      switch (sortCol) {
        case 'namespace': cmp = a.namespace.localeCompare(b.namespace); break
        case 'name': cmp = a.name.localeCompare(b.name); break
        case 'kind': cmp = a.kind.localeCompare(b.kind); break
        case 'replicas': cmp = a.currentReplicas - b.currentReplicas; break
        case 'status': cmp = a.status.localeCompare(b.status); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortCol, sortDir])

  const paginatedRows = useMemo(
    () => sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [sorted, page, rowsPerPage],
  )

  // Reset page when filters change
  useEffect(() => { setPage(0) }, [search, nsFilter, statusFilter])

  return (
    <>
      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          label="Search"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 200 }}
        />
        <TextField
          select
          label="Namespace"
          size="small"
          value={nsFilter}
          onChange={(e) => setNsFilter(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          {namespaces.map((ns) => (
            <MenuItem key={ns} value={ns}>
              {ns === 'all' ? 'All Namespaces' : ns}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Status"
          size="small"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          sx={{ minWidth: 140 }}
        >
          {['all', 'running', 'sleeping', 'partial'].map((s) => (
            <MenuItem key={s} value={s}>
              {s === 'all' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}
            </MenuItem>
          ))}
        </TextField>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" color="text.disabled">
            {dataUpdatedAt ? `Updated ${sinceMs(dataUpdatedAt)}` : ''}
          </Typography>
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={() => refetch()} aria-label="Refresh workloads">
              <RefreshIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Row count */}
      {!isLoading && !isError && (
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1 }}>
          {sorted.length === workloads.length
            ? `${workloads.length} workload${workloads.length !== 1 ? 's' : ''}`
            : `Showing ${sorted.length} of ${workloads.length} workloads`}
        </Typography>
      )}

      {isError ? (
        <Alert severity="error">
          Failed to load workloads: {error instanceof Error ? error.message : 'Unknown error'}
        </Alert>
      ) : isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {(['namespace', 'name', 'kind'] as const).map((col) => (
                  <TableCell key={col} sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12 }}>
                    <TableSortLabel active={sortCol === col} direction={sortCol === col ? sortDir : 'asc'} onClick={() => handleSort(col)}>
                      {col.toUpperCase()}
                    </TableSortLabel>
                  </TableCell>
                ))}
                <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12 }}>
                  <Tooltip title="Current replicas / Saved replicas (pre-sleep)" arrow>
                    <TableSortLabel active={sortCol === 'replicas'} direction={sortCol === 'replicas' ? sortDir : 'asc'} onClick={() => handleSort('replicas')}>
                      REPLICAS
                    </TableSortLabel>
                  </Tooltip>
                </TableCell>
                <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12 }}>
                  <TableSortLabel active={sortCol === 'status'} direction={sortCol === 'status' ? sortDir : 'asc'} onClick={() => handleSort('status')}>
                    STATUS
                  </TableSortLabel>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                      No workloads match the current filters.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRows.map((w) => {
                  const statusColor = STATUS_COLORS[w.status]
                  const unhealthy = w.readyReplicas < w.currentReplicas && w.currentReplicas > 0
                  return (
                    <TableRow key={`${w.namespace}/${w.name}/${w.kind}`} hover onClick={() => setSelectedWorkload(w)} sx={{ cursor: 'pointer' }}>
                      <TableCell sx={{ color: 'text.secondary', fontSize: 13 }}>{w.namespace}</TableCell>
                      <TableCell sx={{ fontWeight: 500, fontSize: 13 }}>{w.name}</TableCell>
                      <TableCell>
                        <Chip
                          label={w.kind}
                          size="small"
                          sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(124,58,237,0.12)', color: 'primary.main' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          {unhealthy && (
                            <Tooltip title={`Only ${w.readyReplicas}/${w.currentReplicas} replicas ready`} arrow>
                              <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: colors.errorLight, flexShrink: 0 }} />
                            </Tooltip>
                          )}
                          <Typography component="span" sx={{ fontSize: 13, fontFamily: 'monospace' }}>
                            {w.currentReplicas}
                          </Typography>
                          {w.savedReplicas !== null && (
                            <Typography component="span" color="text.secondary" sx={{ fontSize: 12 }}>
                              / {w.savedReplicas}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={statusColor.label}
                          size="small"
                          sx={{ height: 20, fontSize: 11, bgcolor: statusColor.bgcolor, color: statusColor.color }}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={sorted.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0) }}
            rowsPerPageOptions={[10, 20, 50]}
          />
        </TableContainer>
      )}

      <WorkloadDetailDrawer
        workload={selectedWorkload}
        onClose={() => setSelectedWorkload(null)}
      />
    </>
  )
}
