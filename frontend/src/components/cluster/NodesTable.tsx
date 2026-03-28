'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import React from 'react'
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
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import RefreshIcon from '@mui/icons-material/Refresh'
import { getNodes } from '@/lib/api'
import type { Node } from '@/lib/types'
import { fmtCpu, fmtMem, podAge, sinceMs, pct, pctColor } from '@/lib/formatters'
import { nodeStatusMap } from '@/components/cluster/statusColors'
import { useTheme } from '@mui/material/styles'
import { useColors } from '@/lib/colors'
import { NODES_REFETCH_MS } from '@/lib/constants'
import MiniBar from './MiniBar'
import NodeDetailDrawer from './NodeDetailDrawer'

type SortCol = 'name' | 'age' | 'instanceType' | 'zone' | 'pods' | 'cpu' | 'mem' | 'status'
type SortDir = 'asc' | 'desc'

const SELECTED_ROW_BG = 'rgba(124,58,237,0.08)'

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

interface NodeRowProps {
  node: Node
  groupByZone: boolean
  isSelected: boolean
  onSelect: (n: Node | null) => void
}

function NodeRow({ node, groupByZone, isSelected, onSelect }: NodeRowProps) {
  const isDark = useTheme().palette.mode === 'dark'
  const colors = useColors()
  const statusColor = nodeStatusMap(isDark)[node.status]
  const statusChip = (
    <Chip label={statusColor.label} size="small" sx={{ height: 20, fontSize: 11, bgcolor: statusColor.bgcolor, color: statusColor.color }} />
  )
  return (
    <TableRow
      hover
      onClick={() => onSelect(isSelected ? null : node)}
      sx={{ cursor: 'pointer', ...(isSelected ? { bgcolor: SELECTED_ROW_BG } : {}) }}
    >
      <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{node.name}</TableCell>
      <TableCell sx={{ fontSize: 13, color: 'text.secondary' }}>{podAge(node.createdAt)}</TableCell>
      <TableCell sx={{ fontSize: 13 }}>{node.instanceType || '—'}</TableCell>
      {!groupByZone && <TableCell sx={{ fontSize: 13, color: 'text.secondary' }}>{node.zone || '—'}</TableCell>}
      <TableCell sx={{ fontSize: 13 }}>{node.podCount}</TableCell>
      <TableCell>
        <MiniBar
          used={node.cpuRequested}
          total={node.cpuAllocatable}
          label={`${fmtCpu(node.cpuRequested)} / ${fmtCpu(node.cpuAllocatable)} reserved`}
        />
      </TableCell>
      <TableCell>
        <MiniBar
          used={node.memRequested}
          total={node.memAllocatable}
          label={`${fmtMem(node.memRequested)} / ${fmtMem(node.memAllocatable)} reserved`}
        />
      </TableCell>
      <TableCell>
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
          {node.status === 'protected' && node.protectionReason ? (
            <Tooltip title={node.protectionReason} arrow><span>{statusChip}</span></Tooltip>
          ) : statusChip}
          {node.cordoned && (
            <Chip label="Cordoned" size="small" sx={{ height: 18, fontSize: 10, bgcolor: colors.errorBg, color: colors.errorLight }} />
          )}
        </Box>
      </TableCell>
    </TableRow>
  )
}

export default function NodesTable() {
  const { data: nodes = [], isLoading, isError, error, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['nodes'],
    queryFn: getNodes,
    refetchInterval: NODES_REFETCH_MS,
  })

  const [search, setSearch] = useState('')
  const [groupByZone, setGroupByZone] = useState(false)
  const [sortCol, setSortCol] = useState<SortCol | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const isDark = useTheme().palette.mode === 'dark'
  const colors = useColors()

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
    for (const node of sorted) {
      const zoneKey = node.zone || '(unknown)'
      if (!map.has(zoneKey)) map.set(zoneKey, { nodes: [], totalPods: 0, cpuAllocatable: 0, cpuRequested: 0, memAllocatable: 0, memRequested: 0, cordoned: 0 })
      const zoneStats = map.get(zoneKey)!
      zoneStats.nodes.push(node)
      zoneStats.totalPods += node.podCount
      zoneStats.cpuAllocatable += node.cpuAllocatable
      zoneStats.cpuRequested += node.cpuRequested
      zoneStats.memAllocatable += node.memAllocatable
      zoneStats.memRequested += node.memRequested
      if (node.cordoned) zoneStats.cordoned++
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [sorted, groupByZone])

  const headerProps = { active: sortCol, dir: sortDir, onSort: handleSort }

  const colCount = groupByZone ? 7 : 8

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
            <IconButton size="small" onClick={() => refetch()} aria-label="Refresh nodes">
              <RefreshIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {isError ? (
        <Alert severity="error">
          Failed to load nodes: {error instanceof Error ? error.message : 'Unknown error'}
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
                    <React.Fragment key={zone}>
                      <TableRow sx={{ bgcolor: 'rgba(124,58,237,0.06)' }}>
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
                              sx={{ height: 18, fontSize: 10, bgcolor: `${pctColor(cpuZonePct, isDark)}22`, color: pctColor(cpuZonePct, isDark) }}
                            />
                            <Chip
                              label={`MEM ${memZonePct}%`}
                              size="small"
                              sx={{ height: 18, fontSize: 10, bgcolor: `${pctColor(memZonePct, isDark)}22`, color: pctColor(memZonePct, isDark) }}
                            />
                            {stats.cordoned > 0 && (
                              <Chip label={`${stats.cordoned} cordoned`} size="small" sx={{ height: 18, fontSize: 10, bgcolor: colors.errorBg, color: colors.errorLight }} />
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                      {stats.nodes.map((node) => (
                        <NodeRow
                          key={node.name}
                          node={node}
                          groupByZone={groupByZone}
                          isSelected={selectedNode?.name === node.name}
                          onSelect={setSelectedNode}
                        />
                      ))}
                    </React.Fragment>
                  )
                })
              ) : (
                sorted.map((node) => (
                  <NodeRow
                    key={node.name}
                    node={node}
                    groupByZone={groupByZone}
                    isSelected={selectedNode?.name === node.name}
                    onSelect={setSelectedNode}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <NodeDetailDrawer node={selectedNode} onClose={() => setSelectedNode(null)} />
    </>
  )
}
