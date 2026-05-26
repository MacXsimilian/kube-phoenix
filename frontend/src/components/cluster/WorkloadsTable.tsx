'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { useSearchParams } from 'next/navigation'
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
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Alert from '@mui/material/Alert'
import CenteredSpinner from '@/components/common/CenteredSpinner'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import { getWorkloads, getGuardrails } from '@/lib/api'
import type { Workload } from '@/lib/types'
import { sinceMs, formatError } from '@/lib/formatters'
import { useIsDark } from '@/lib/useIsDark'
import { statusColors } from '@/components/cluster/statusColors'
import { useColors } from '@/lib/colors'
import { WORKLOADS_REFETCH_MS } from '@/lib/constants'
import { useTriStateSort } from '@/lib/useTriStateSort'
import SortHeader from '@/lib/SortHeader'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import WorkloadDetailDrawer from './WorkloadDetailDrawer'

const validStatuses = ['running', 'sleeping', 'partial']

type WorkloadSortCol = 'namespace' | 'name' | 'kind' | 'replicas' | 'status'

export default function WorkloadsTable() {
  const searchParams = useSearchParams()
  const { data: workloads = [], isLoading, isError, error, dataUpdatedAt } = useQuery({
    queryKey: queryKeys.workloads(),
    queryFn: getWorkloads,
    refetchInterval: WORKLOADS_REFETCH_MS,
  })

  const { data: guardrails } = useQuery({ queryKey: queryKeys.guardrails(), queryFn: getGuardrails })
  const protectedNamespaces = useMemo(
    () => new Set(guardrails?.protectedNamespaces.split(',').map((s) => s.trim()).filter(Boolean) ?? []),
    [guardrails],
  )

  const [search, setSearch] = useState('')
  const [nsFilter, setNsFilter] = useState('all')
  const [protectionFilter, setProtectionFilter] = useState<'all' | 'protected' | 'unprotected'>('all')
  const initialStatus = searchParams.get('status') ?? 'all'
  const [statusFilter, setStatusFilter] = useState(validStatuses.includes(initialStatus) ? initialStatus : 'all')

  useEffect(() => {
    const statusFromUrl = searchParams.get('status') ?? 'all'
    setStatusFilter(validStatuses.includes(statusFromUrl) ? statusFromUrl : 'all')
  }, [searchParams])
  const { sortCol, sortDir, handleSort } = useTriStateSort<WorkloadSortCol>()
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(20)
  const [selectedWorkload, setSelectedWorkload] = useState<Workload | null>(null)
  const isDark = useIsDark()
  const colors = useColors()
  const STATUS_COLORS = statusColors(isDark)

  const namespaces = useMemo(
    () => ['all', ...Array.from(new Set(workloads.map((w) => w.namespace))).sort()],
    [workloads]
  )

  const filtered = useMemo(
    () =>
      workloads.filter((w) => {
        if (nsFilter !== 'all' && w.namespace !== nsFilter) return false
        if (statusFilter !== 'all' && w.status !== statusFilter) return false
        if (protectionFilter === 'protected' && !protectedNamespaces.has(w.namespace)) return false
        if (protectionFilter === 'unprotected' && protectedNamespaces.has(w.namespace)) return false
        if (search && !w.name.toLowerCase().includes(search.toLowerCase())) return false
        return true
      }),
    [workloads, nsFilter, statusFilter, protectionFilter, protectedNamespaces, search]
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
  useEffect(() => { setPage(0) }, [search, nsFilter, statusFilter, protectionFilter])

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
        <TextField
          select
          label="Protection"
          size="small"
          value={protectionFilter}
          onChange={(e) => setProtectionFilter(e.target.value as 'all' | 'protected' | 'unprotected')}
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="protected">Protected</MenuItem>
          <MenuItem value="unprotected">Unprotected</MenuItem>
        </TextField>
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" sx={{
          color: "text.disabled"
        }}>
          {dataUpdatedAt ? `Updated ${sinceMs(dataUpdatedAt)}` : ''}
        </Typography>
      </Box>
      {/* Row count */}
      {!isLoading && !isError && (
        <Typography
          variant="caption"
          sx={{
            color: "text.disabled",
            display: 'block',
            mb: 1
          }}>
          {sorted.length === workloads.length
            ? `${workloads.length} workload${workloads.length !== 1 ? 's' : ''}`
            : `Showing ${sorted.length} of ${workloads.length} workloads`}
        </Typography>
      )}
      {isError ? (
        <Alert severity="error">
          Failed to load workloads: {formatError(error)}
        </Alert>
      ) : isLoading ? (
        <CenteredSpinner />
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {(['namespace', 'name', 'kind'] as const).map((col) => (
                  <SortHeader key={col} col={col} label={col.toUpperCase()} active={sortCol} dir={sortDir} onSort={handleSort} />
                ))}
                <SortHeader col="replicas" label="REPLICAS" active={sortCol} dir={sortDir} onSort={handleSort} />
                <SortHeader col="status" label="STATUS" active={sortCol} dir={sortDir} onSort={handleSort} />
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography
                      variant="body2"
                      sx={{
                        color: "text.secondary",
                        py: 2,
                        textAlign: 'center'
                      }}>
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
                      <TableCell sx={{ color: 'text.secondary', fontSize: 13 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          {w.namespace}
                          {protectedNamespaces.has(w.namespace) && (
                            <Tooltip title="System-protected namespace" arrow>
                              <ShieldOutlinedIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
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
                            <Typography
                              component="span"
                              sx={{
                                color: "text.secondary",
                                fontSize: 12
                              }}>
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
                  );
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
            rowsPerPageOptions={[10, 20, 50, 100]}
          />
        </TableContainer>
      )}
      <WorkloadDetailDrawer
        workload={selectedWorkload}
        onClose={() => setSelectedWorkload(null)}
      />
    </>
  );
}
