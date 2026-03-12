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
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import { getWorkloads } from '@/lib/api'
import type { Workload } from '@/lib/types'

const STATUS_COLORS: Record<Workload['status'], { bgcolor: string; color: string; label: string }> = {
  running: { bgcolor: 'rgba(34,197,94,0.12)', color: '#22C55E', label: 'Running' },
  sleeping: { bgcolor: 'rgba(245,158,11,0.12)', color: '#F59E0B', label: 'Sleeping' },
  partial: { bgcolor: 'rgba(59,130,246,0.12)', color: '#3B82F6', label: 'Partial' },
}

export default function WorkloadsTable() {
  const { data: workloads = [], isLoading } = useQuery({
    queryKey: ['workloads'],
    queryFn: getWorkloads,
    refetchInterval: 30_000,
  })

  const [search, setSearch] = useState('')
  const [nsFilter, setNsFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

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

  return (
    <>
      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
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
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12 }}>NAMESPACE</TableCell>
                <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12 }}>NAME</TableCell>
                <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12 }}>KIND</TableCell>
                <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12 }}>REPLICAS</TableCell>
                <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12 }}>STATUS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                      No workloads match the current filters.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((w) => {
                  const sc = STATUS_COLORS[w.status]
                  return (
                    <TableRow key={`${w.namespace}/${w.name}/${w.kind}`} hover>
                      <TableCell sx={{ color: 'text.secondary', fontSize: 13 }}>{w.namespace}</TableCell>
                      <TableCell sx={{ fontWeight: 500, fontSize: 13 }}>{w.name}</TableCell>
                      <TableCell>
                        <Chip
                          label={w.kind === 'Deployment' ? 'Deploy' : 'SS'}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: 10,
                            bgcolor: 'rgba(124,58,237,0.12)',
                            color: 'primary.main',
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: 13, fontFamily: 'monospace' }}>
                        {w.currentReplicas}
                        {w.savedReplicas !== null && (
                          <Typography component="span" color="text.secondary" sx={{ fontSize: 12, ml: 0.5 }}>
                            / {w.savedReplicas}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={sc.label}
                          size="small"
                          sx={{ height: 20, fontSize: 11, bgcolor: sc.bgcolor, color: sc.color }}
                        />
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
