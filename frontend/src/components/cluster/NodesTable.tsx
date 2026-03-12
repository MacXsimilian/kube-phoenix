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
import Tooltip from '@mui/material/Tooltip'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import { getNodes } from '@/lib/api'
import type { Node } from '@/lib/types'

const STATUS_MAP: Record<Node['status'], { bgcolor: string; color: string; label: string }> = {
  active: { bgcolor: 'rgba(34,197,94,0.12)', color: '#22C55E', label: 'Active' },
  protected: { bgcolor: 'rgba(59,130,246,0.12)', color: '#3B82F6', label: 'Protected' },
  'would-drain': { bgcolor: 'rgba(245,158,11,0.12)', color: '#F59E0B', label: 'Would Drain' },
}

export default function NodesTable() {
  const { data: nodes = [], isLoading } = useQuery({
    queryKey: ['nodes'],
    queryFn: getNodes,
    refetchInterval: 30_000,
  })

  const [search, setSearch] = useState('')

  const filtered = useMemo(
    () => nodes.filter((n) => !search || n.name.toLowerCase().includes(search.toLowerCase())),
    [nodes, search]
  )

  return (
    <>
      <Box sx={{ mb: 2 }}>
        <TextField
          label="Search nodes"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 260 }}
        />
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
                <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12 }}>NAME</TableCell>
                <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12 }}>INSTANCE TYPE</TableCell>
                <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12 }}>ZONE</TableCell>
                <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12 }}>PODS</TableCell>
                <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12 }}>STATUS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                      No nodes found.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((node) => {
                  const sc = STATUS_MAP[node.status]
                  const chip = (
                    <Chip
                      label={sc.label}
                      size="small"
                      sx={{ height: 20, fontSize: 11, bgcolor: sc.bgcolor, color: sc.color }}
                    />
                  )
                  return (
                    <TableRow key={node.name} hover>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{node.name}</TableCell>
                      <TableCell sx={{ fontSize: 13 }}>{node.instanceType || '—'}</TableCell>
                      <TableCell sx={{ fontSize: 13, color: 'text.secondary' }}>{node.zone || '—'}</TableCell>
                      <TableCell sx={{ fontSize: 13 }}>{node.podCount}</TableCell>
                      <TableCell>
                        {node.status === 'protected' && node.protectionReason ? (
                          <Tooltip title={node.protectionReason} arrow>
                            <span>{chip}</span>
                          </Tooltip>
                        ) : (
                          chip
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
