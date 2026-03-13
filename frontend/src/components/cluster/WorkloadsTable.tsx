'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableSortLabel from '@mui/material/TableSortLabel'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import RefreshIcon from '@mui/icons-material/Refresh'
import Tooltip from '@mui/material/Tooltip'
import { getWorkloads, getGuardrails } from '@/lib/api'
import type { Workload } from '@/lib/types'

const STATUS_COLORS: Record<string, { bgcolor: string; color: string; label: string }> = {
  running: { bgcolor: 'rgba(34,197,94,0.12)', color: '#22C55E', label: 'Running' },
  sleeping: { bgcolor: 'rgba(245,158,11,0.12)', color: '#F59E0B', label: 'Sleeping' },
  partial: { bgcolor: 'rgba(59,130,246,0.12)', color: '#3B82F6', label: 'Partial' },
  unmanaged: { bgcolor: 'rgba(255,255,255,0.07)', color: '#94A3B8', label: 'Unmanaged' },
}

export default function WorkloadsTable() {
  const { data: workloads = [], isLoading, isError, error, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['workloads'],
    queryFn: getWorkloads,
    refetchInterval: 30_000,
  })

  const { data: guardrails } = useQuery({ queryKey: ['guardrails'], queryFn: getGuardrails })

  const [search, setSearch] = useState('')
  const [nsFilter, setNsFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortCol, setSortCol] = useState<'namespace' | 'name' | 'kind' | 'replicas' | 'status' | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [affectedOnly, setAffectedOnly] = useState(false)

  function handleSort(col: typeof sortCol) {
    if (sortCol === col) {
      if (sortDir === 'asc') setSortDir('desc')
      else { setSortCol(null); setSortDir('asc') }
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  function sinceMs(ms: number): string {
    const s = Math.floor((Date.now() - ms) / 1000)
    if (s < 10) return 'just now'
    if (s < 60) return `${s}s ago`
    return `${Math.floor(s / 60)}m ago`
  }

  const namespaces = useMemo(
    () => ['all', ...Array.from(new Set(workloads.map((w) => w.namespace))).sort()],
    [workloads]
  )

  const skipNs = useMemo(() => {
    if (!guardrails?.skipNamespaces) return new Set<string>()
    return new Set(guardrails.skipNamespaces.split(',').map((s) => s.trim()).filter(Boolean))
  }, [guardrails])

  const filtered = useMemo(
    () =>
      workloads.filter((w) => {
        if (nsFilter !== 'all' && w.namespace !== nsFilter) return false
        if (statusFilter !== 'all' && w.status !== statusFilter) return false
        if (search && !w.name.toLowerCase().includes(search.toLowerCase())) return false
        if (affectedOnly && (w.status !== 'running' || skipNs.has(w.namespace))) return false
        return true
      }),
    [workloads, nsFilter, statusFilter, search, affectedOnly, skipNs]
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
          {['all', 'running', 'sleeping', 'partial', 'unmanaged'].map((s) => (
            <MenuItem key={s} value={s}>
              {s === 'all' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}
            </MenuItem>
          ))}
        </TextField>
        <FormControlLabel
          control={<Switch checked={affectedOnly} onChange={(e) => setAffectedOnly(e.target.checked)} size="small" />}
          label={<Typography variant="body2">Would be affected</Typography>}
          sx={{ ml: 0.5 }}
        />
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
                <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12 }}>
                  GOVERNED BY
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                      {affectedOnly ? 'No workloads would be affected by the next sleep run.' : 'No workloads match the current filters.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((w) => {
                  const statusKey = w.status in STATUS_COLORS ? w.status : 'unmanaged'
                  const sc = STATUS_COLORS[statusKey]
                  const unhealthy = w.readyReplicas < w.currentReplicas && w.currentReplicas > 0
                  return (
                    <TableRow key={`${w.namespace}/${w.name}/${w.kind}`} hover>
                      <TableCell sx={{ color: 'text.secondary', fontSize: 13 }}>{w.namespace}</TableCell>
                      <TableCell sx={{ fontWeight: 500, fontSize: 13 }}>{w.name}</TableCell>
                      <TableCell>
                        <Chip
                          label={w.kind === 'Deployment' ? 'Deployment' : 'StatefulSet'}
                          size="small"
                          sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(124,58,237,0.12)', color: 'primary.main' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          {unhealthy && (
                            <Tooltip title={`Only ${w.readyReplicas}/${w.currentReplicas} replicas ready`} arrow>
                              <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#F87171', flexShrink: 0 }} />
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
                          label={sc.label}
                          size="small"
                          sx={{ height: 20, fontSize: 11, bgcolor: sc.bgcolor, color: sc.color }}
                        />
                      </TableCell>
                      <TableCell>
                        {w.governedBy ? (
                          <Chip
                            label={w.governedBy}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: 11,
                              bgcolor: 'rgba(124,58,237,0.12)',
                              color: 'primary.light',
                              maxWidth: 160,
                            }}
                          />
                        ) : (
                          <Typography variant="caption" color="text.disabled">
                            Unmanaged
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </>
  )
}
