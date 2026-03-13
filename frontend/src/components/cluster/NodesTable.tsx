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
import Tooltip from '@mui/material/Tooltip'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import CircularProgress from '@mui/material/CircularProgress'
import LinearProgress from '@mui/material/LinearProgress'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import RefreshIcon from '@mui/icons-material/Refresh'
import { getNodes } from '@/lib/api'
import type { Node } from '@/lib/types'

const STATUS_MAP: Record<Node['status'], { bgcolor: string; color: string; label: string }> = {
  active: { bgcolor: 'rgba(34,197,94,0.12)', color: '#22C55E', label: 'Active' },
  protected: { bgcolor: 'rgba(59,130,246,0.12)', color: '#3B82F6', label: 'Protected' },
  'would-drain': { bgcolor: 'rgba(245,158,11,0.12)', color: '#F59E0B', label: 'Would Drain' },
}

type SortCol = 'name' | 'age' | 'instanceType' | 'zone' | 'pods' | 'cpu' | 'mem' | 'status'
type SortDir = 'asc' | 'desc'

function pct(used: number, total: number): number {
  return total > 0 ? Math.round((used / total) * 100) : 0
}

function fmtCpu(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}` : `${m}m`
}

function fmtMem(bytes: number): string {
  const gib = bytes / 1073741824
  return gib >= 1 ? `${gib.toFixed(1)}G` : `${Math.round(bytes / 1048576)}M`
}

function pctColor(p: number): string {
  if (p >= 85) return '#F87171'
  if (p >= 65) return '#FBBF24'
  return '#22C55E'
}

function nodeAge(createdAt: string): string {
  const ms = Date.now() - new Date(createdAt).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

function sinceMs(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 10) return 'just now'
  if (s < 60) return `${s}s ago`
  return `${Math.floor(s / 60)}m ago`
}

function ResourceBar({ used, total, usedLabel, totalLabel }: { used: number; total: number; usedLabel: string; totalLabel: string }) {
  const p = pct(used, total)
  const color = pctColor(p)
  return (
    <Tooltip title={`${usedLabel} / ${totalLabel} reserved`} arrow>
      <Box sx={{ minWidth: 72 }}>
        <Typography variant="caption" sx={{ fontSize: 11, color, fontWeight: 600, display: 'block', mb: 0.25 }}>
          {p}%
        </Typography>
        <LinearProgress
          variant="determinate"
          value={Math.min(p, 100)}
          sx={{
            height: 5,
            borderRadius: 1,
            bgcolor: 'rgba(255,255,255,0.08)',
            '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 1 },
          }}
        />
      </Box>
    </Tooltip>
  )
}

function sortNodes(nodes: Node[], col: SortCol, dir: SortDir): Node[] {
  return [...nodes].sort((a, b) => {
    let cmp = 0
    switch (col) {
      case 'name': cmp = a.name.localeCompare(b.name); break
      case 'age': cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break
      case 'instanceType': cmp = (a.instanceType || '').localeCompare(b.instanceType || ''); break
      case 'zone': cmp = (a.zone || '').localeCompare(b.zone || ''); break
      case 'pods': cmp = a.podCount - b.podCount; break
      case 'cpu': cmp = pct(a.cpuRequested, a.cpuAllocatable) - pct(b.cpuRequested, b.cpuAllocatable); break
      case 'mem': cmp = pct(a.memRequested, a.memAllocatable) - pct(b.memRequested, b.memAllocatable); break
      case 'status': cmp = a.status.localeCompare(b.status); break
    }
    return dir === 'asc' ? cmp : -cmp
  })
}

function SortHeader({
  col, label, active, dir, onSort, align,
}: {
  col: SortCol; label: string; active: SortCol | null; dir: SortDir; onSort: (c: SortCol) => void; align?: 'left' | 'right'
}) {
  return (
    <TableCell align={align} sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12, whiteSpace: 'nowrap' }}>
      <TableSortLabel
        active={active === col}
        direction={active === col ? dir : 'asc'}
        onClick={() => onSort(col)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  )
}

interface ZoneStats {
  nodes: Node[]
  totalPods: number
  cpuAllocatable: number
  cpuRequested: number
  memAllocatable: number
  memRequested: number
  cordoned: number
}

export default function NodesTable() {
  const { data: nodes = [], isLoading, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['nodes'],
    queryFn: getNodes,
    refetchInterval: 30_000,
  })

  const [search, setSearch] = useState('')
  const [groupByZone, setGroupByZone] = useState(false)
  const [sortCol, setSortCol] = useState<SortCol | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      if (sortDir === 'asc') setSortDir('desc')
      else { setSortCol(null); setSortDir('asc') }
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const filtered = useMemo(
    () => nodes.filter((n) => !search || n.name.toLowerCase().includes(search.toLowerCase())),
    [nodes, search],
  )

  const sorted = useMemo(
    () => (sortCol ? sortNodes(filtered, sortCol, sortDir) : filtered),
    [filtered, sortCol, sortDir],
  )

  const zoneGroups = useMemo<[string, ZoneStats][]>(() => {
    if (!groupByZone) return []
    const map = new Map<string, ZoneStats>()
    for (const n of sorted) {
      const z = n.zone || '(unknown)'
      if (!map.has(z)) map.set(z, { nodes: [], totalPods: 0, cpuAllocatable: 0, cpuRequested: 0, memAllocatable: 0, memRequested: 0, cordoned: 0 })
      const s = map.get(z)!
      s.nodes.push(n)
      s.totalPods += n.podCount
      s.cpuAllocatable += n.cpuAllocatable
      s.cpuRequested += n.cpuRequested
      s.memAllocatable += n.memAllocatable
      s.memRequested += n.memRequested
      if (n.cordoned) s.cordoned++
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [sorted, groupByZone])

  const headerProps = { active: sortCol, dir: sortDir, onSort: handleSort }

  const colCount = groupByZone ? 7 : 8

  function NodeRow({ node }: { node: Node }) {
    const sc = STATUS_MAP[node.status]
    const statusChip = (
      <Chip label={sc.label} size="small" sx={{ height: 20, fontSize: 11, bgcolor: sc.bgcolor, color: sc.color }} />
    )
    return (
      <TableRow hover>
        <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{node.name}</TableCell>
        <TableCell sx={{ fontSize: 13, color: 'text.secondary' }}>{nodeAge(node.createdAt)}</TableCell>
        <TableCell sx={{ fontSize: 13 }}>{node.instanceType || '—'}</TableCell>
        {!groupByZone && <TableCell sx={{ fontSize: 13, color: 'text.secondary' }}>{node.zone || '—'}</TableCell>}
        <TableCell sx={{ fontSize: 13 }}>{node.podCount}</TableCell>
        <TableCell>
          <ResourceBar
            used={node.cpuRequested}
            total={node.cpuAllocatable}
            usedLabel={fmtCpu(node.cpuRequested)}
            totalLabel={fmtCpu(node.cpuAllocatable)}
          />
        </TableCell>
        <TableCell>
          <ResourceBar
            used={node.memRequested}
            total={node.memAllocatable}
            usedLabel={fmtMem(node.memRequested)}
            totalLabel={fmtMem(node.memAllocatable)}
          />
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
            {node.status === 'protected' && node.protectionReason ? (
              <Tooltip title={node.protectionReason} arrow><span>{statusChip}</span></Tooltip>
            ) : statusChip}
            {node.cordoned && (
              <Chip label="Cordoned" size="small" sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(248,113,113,0.15)', color: '#F87171' }} />
            )}
          </Box>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <>
      {/* Toolbar */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          label="Search nodes"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 240 }}
        />
        <FormControlLabel
          control={<Switch checked={groupByZone} onChange={(e) => setGroupByZone(e.target.checked)} size="small" />}
          label={<Typography variant="body2">Group by zone</Typography>}
          sx={{ ml: 0.5 }}
        />
        <Box sx={{ flex: 1 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" color="text.disabled">
            {dataUpdatedAt ? `Updated ${sinceMs(dataUpdatedAt)}` : ''}
          </Typography>
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={() => refetch()}>
              <RefreshIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
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
                <SortHeader col="name" label="NAME" {...headerProps} />
                <SortHeader col="age" label="AGE" {...headerProps} />
                <SortHeader col="instanceType" label="INSTANCE TYPE" {...headerProps} />
                {!groupByZone && <SortHeader col="zone" label="ZONE" {...headerProps} />}
                <SortHeader col="pods" label="PODS" {...headerProps} />
                <SortHeader col="cpu" label="CPU RESERVED" {...headerProps} />
                <SortHeader col="mem" label="MEM RESERVED" {...headerProps} />
                <SortHeader col="status" label="STATUS" {...headerProps} />
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colCount}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                      {search ? 'No nodes match your search.' : 'No nodes found.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : groupByZone ? (
                zoneGroups.map(([zone, stats]) => {
                  const cpuZonePct = pct(stats.cpuRequested, stats.cpuAllocatable)
                  const memZonePct = pct(stats.memRequested, stats.memAllocatable)
                  return (
                    <>
                      <TableRow key={`zone-${zone}`} sx={{ bgcolor: 'rgba(124,58,237,0.06)' }}>
                        <TableCell colSpan={7} sx={{ py: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                            <Typography variant="caption" fontWeight={700} sx={{ color: 'primary.light', textTransform: 'uppercase', letterSpacing: 1 }}>
                              {zone}
                            </Typography>
                            <Chip label={`${stats.nodes.length} node${stats.nodes.length !== 1 ? 's' : ''}`} size="small" sx={{ height: 18, fontSize: 10 }} />
                            <Chip label={`${stats.totalPods} pods`} size="small" sx={{ height: 18, fontSize: 10 }} />
                            <Chip
                              label={`CPU ${cpuZonePct}%`}
                              size="small"
                              sx={{ height: 18, fontSize: 10, bgcolor: `${pctColor(cpuZonePct)}22`, color: pctColor(cpuZonePct) }}
                            />
                            <Chip
                              label={`MEM ${memZonePct}%`}
                              size="small"
                              sx={{ height: 18, fontSize: 10, bgcolor: `${pctColor(memZonePct)}22`, color: pctColor(memZonePct) }}
                            />
                            {stats.cordoned > 0 && (
                              <Chip label={`${stats.cordoned} cordoned`} size="small" sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(248,113,113,0.15)', color: '#F87171' }} />
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                      {stats.nodes.map((node) => <NodeRow key={node.name} node={node} />)}
                    </>
                  )
                })
              ) : (
                sorted.map((node) => <NodeRow key={node.name} node={node} />)
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </>
  )
}
