'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TablePagination from '@mui/material/TablePagination'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import ListSubheader from '@mui/material/ListSubheader'
import Chip from '@mui/material/Chip'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import DownloadIcon from '@mui/icons-material/Download'
import { getAuditLogs } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { canViewAudit } from '@/lib/rbac'
import { useRouter } from 'next/navigation'
import type { AuditLogEntry } from '@/lib/types'
import { formatActionLabel, actionColor } from '@/lib/statusColors'

const ACTION_GROUPS = [
  { label: 'Auth',       actions: ['auth.login', 'auth.logout', 'auth.password_change'] },
  { label: 'Policy',     actions: ['policy.create', 'policy.update', 'policy.delete', 'policy.sleep', 'policy.wake'] },
  { label: 'Override',   actions: ['policy.override.create', 'policy.override.delete'] },
  { label: 'Exception',  actions: ['exception.create', 'exception.update', 'exception.delete'] },
  { label: 'Guardrail',  actions: ['guardrail.update'] },
  { label: 'User',       actions: ['user.create', 'user.update', 'user.delete'] },
  { label: 'Admin',      actions: ['admin.reset_db'] },
]

const TABLE_COLS = 6

function toUTCString(ts: string): string {
  return new Date(ts).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
}

function downloadCSV(items: AuditLogEntry[]): void {
  const header = ['Time (UTC)', 'User', 'Action', 'Resource', 'IP Address']
  const rows = items.map(e => [
    toUTCString(e.timestamp),
    e.username,
    e.action,
    e.resourceType ? `${e.resourceType}${e.resourceId != null ? ' #' + e.resourceId : ''}` : '',
    e.ipAddress ?? '',
  ])
  const csv = [header, ...rows]
    .map(row => row.map(v => `"${v.replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `audit-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── JSON diff ─────────────────────────────────────────────────────────────────

const NULL_SNAPSHOT = 'null'

function isEmptySnapshot(json?: string): boolean {
  return !json || json === NULL_SNAPSHOT
}

function flattenToLeaves(value: unknown, prefix = ''): Record<string, string> {
  if (value === null || value === undefined) return prefix ? { [prefix]: 'null' } : {}
  if (typeof value !== 'object' || Array.isArray(value)) return { [prefix]: JSON.stringify(value) }
  const result: Record<string, string> = {}
  for (const [fieldKey, child] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${fieldKey}` : fieldKey
    Object.assign(result, flattenToLeaves(child, path))
  }
  return result
}

function parseSnapshot(json: string): Record<string, string> | null {
  try {
    return flattenToLeaves(JSON.parse(json))
  } catch {
    return null
  }
}

type DiffType = 'added' | 'removed' | 'changed' | 'unchanged'

type DiffLine = {
  key: string
  type: DiffType
  before?: string
  after?: string
}

function classifyLine(key: string, beforeValue: string | undefined, afterValue: string | undefined): DiffLine {
  if (beforeValue === undefined) return { key, type: 'added', after: afterValue }
  if (afterValue === undefined) return { key, type: 'removed', before: beforeValue }
  if (beforeValue !== afterValue) return { key, type: 'changed', before: beforeValue, after: afterValue }
  return { key, type: 'unchanged', before: beforeValue, after: afterValue }
}

function computeDiff(beforeJson?: string, afterJson?: string): DiffLine[] | null {
  if (isEmptySnapshot(beforeJson) && isEmptySnapshot(afterJson)) return null

  const flatBefore = isEmptySnapshot(beforeJson) ? {} : parseSnapshot(beforeJson!)
  const flatAfter  = isEmptySnapshot(afterJson)  ? {} : parseSnapshot(afterJson!)

  if (flatBefore === null || flatAfter === null) return null

  const allKeys = Array.from(new Set([...Object.keys(flatBefore), ...Object.keys(flatAfter)])).sort()
  return allKeys.map(key => classifyLine(key, flatBefore[key], flatAfter[key]))
}

function formatChangeSummary(changedCount: number): string {
  if (changedCount === 0) return 'No fields changed'
  return `${changedCount} field${changedCount !== 1 ? 's' : ''} changed`
}

type DiffStyle = { bg: string; border: string; text: string; prefix: string }

const DIFF_STYLE: Record<DiffType, DiffStyle> = {
  added:     { bg: 'rgba(34,197,94,0.10)',  border: '#86efac', text: '#86efac', prefix: '+' },
  removed:   { bg: 'rgba(239,68,68,0.10)',  border: '#fca5a5', text: '#fca5a5', prefix: '-' },
  changed:   { bg: 'rgba(245,158,11,0.10)', border: '#fcd34d', text: '#fcd34d', prefix: '~' },
  unchanged: { bg: 'transparent',           border: 'transparent', text: '',    prefix: ' ' },
}

function DiffLineRow({ line }: { line: DiffLine }) {
  const style = DIFF_STYLE[line.type]
  const isChanged = line.type !== 'unchanged'
  return (
    <Box sx={{
      display: 'flex', gap: 1, px: 1.5, py: '2px',
      bgcolor: style.bg,
      borderLeft: `2px solid ${style.border}`,
      opacity: isChanged ? 1 : 0.35,
      fontFamily: 'monospace', fontSize: 12,
    }}>
      <Box component="span" sx={{ color: style.border || 'text.disabled', width: 10, flexShrink: 0, userSelect: 'none' }}>
        {style.prefix}
      </Box>
      <Box component="span" sx={{ color: 'text.secondary', flexShrink: 0, mr: 0.5 }}>
        {line.key}:
      </Box>
      {line.type === 'changed' ? (
        <Box component="span" sx={{ wordBreak: 'break-all' }}>
          <Box component="span" sx={{ color: '#fca5a5', textDecoration: 'line-through', mr: 1 }}>{line.before}</Box>
          <Box component="span" sx={{ color: '#86efac' }}>{line.after}</Box>
        </Box>
      ) : (
        <Box component="span" sx={{ color: isChanged ? style.text : 'text.primary', wordBreak: 'break-all' }}>
          {line.before ?? line.after}
        </Box>
      )}
    </Box>
  )
}

function JsonDiffView({ before, after }: { before?: string; after?: string }) {
  const lines = useMemo(() => computeDiff(before, after), [before, after])
  if (!lines) return null
  const changedCount = lines.filter(line => line.type !== 'unchanged').length
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
        {formatChangeSummary(changedCount)}
      </Typography>
      <Box sx={{ borderRadius: 1, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', maxHeight: 320, overflowY: 'auto' }}>
        {lines.map(line => <DiffLineRow key={line.key} line={line} />)}
      </Box>
    </Box>
  )
}

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  const [open, setOpen] = useState(false)
  const hasDiff = !isEmptySnapshot(entry.before) || !isEmptySnapshot(entry.after)

  return (
    <>
      <TableRow>
        <TableCell sx={{ width: 40 }}>
          {hasDiff && (
            <IconButton size="small" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label="Show changes">
              {open ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
            </IconButton>
          )}
        </TableCell>
        <TableCell>
          <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {toUTCString(entry.timestamp)}
          </Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2" fontWeight={600}>{entry.username}</Typography>
        </TableCell>
        <TableCell>
          <Chip label={formatActionLabel(entry.action)} size="small" color={actionColor(entry.action)} variant="outlined" />
        </TableCell>
        <TableCell>
          {entry.resourceType && (
            <Typography variant="caption" color="text.secondary">
              {entry.resourceType}{entry.resourceId != null ? ` #${entry.resourceId}` : ''}
            </Typography>
          )}
        </TableCell>
        <TableCell>
          <Typography variant="caption" color="text.secondary">{entry.ipAddress}</Typography>
        </TableCell>
      </TableRow>
      {hasDiff && (
        <TableRow>
          <TableCell colSpan={TABLE_COLS} sx={{ py: 0 }}>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <Box sx={{ p: 2 }}>
                <JsonDiffView before={entry.before} after={entry.after} />
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

export default function AuditLogPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [userFilter, setUserFilter] = useState('')
  const [debouncedUserFilter, setDebouncedUserFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [fromFilter, setFromFilter] = useState('')
  const [toFilter, setToFilter] = useState('')
  const [exportError, setExportError] = useState<string | null>(null)

  const hasPermission = !!user && canViewAudit(user.permissions)

  useEffect(() => {
    if (user && !hasPermission) router.replace('/overview')
  }, [user, hasPermission, router])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedUserFilter(userFilter), 300)
    return () => clearTimeout(t)
  }, [userFilter])

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['audit-logs', page, pageSize, debouncedUserFilter, actionFilter, fromFilter, toFilter],
    queryFn: () => getAuditLogs({
      user: debouncedUserFilter || undefined,
      action: actionFilter || undefined,
      from: fromFilter ? `${fromFilter}T00:00:00Z` : undefined,
      to: toFilter ? `${toFilter}T23:59:59Z` : undefined,
      page,
      pageSize,
    }),
    enabled: hasPermission,
  })

  const handleExport = async () => {
    setExportError(null)
    try {
      const result = await getAuditLogs({
        user: debouncedUserFilter || undefined,
        action: actionFilter || undefined,
        from: fromFilter ? `${fromFilter}T00:00:00Z` : undefined,
        to: toFilter ? `${toFilter}T23:59:59Z` : undefined,
        page: 0,
        pageSize: 1000,
      })
      downloadCSV(result.items)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    }
  }

  if (user && !hasPermission) return null

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} gutterBottom>Audit Log</Typography>
          <Typography variant="body2" color="text.secondary">
            Track who did what and when.
          </Typography>
        </Box>
        <Button
          size="small"
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={handleExport}
          disabled={isLoading}
        >
          Export CSV
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          label="User"
          size="small"
          value={userFilter}
          onChange={e => { setUserFilter(e.target.value); setPage(0) }}
          sx={{ minWidth: 150 }}
          placeholder="Search by username"
        />
        <TextField
          label="Action"
          select
          size="small"
          value={actionFilter}
          onChange={e => { setActionFilter(e.target.value); setPage(0) }}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">All actions</MenuItem>
          {ACTION_GROUPS.flatMap(group => [
            <ListSubheader key={`h-${group.label}`} sx={{ lineHeight: '32px', fontSize: 11 }}>
              {group.label}
            </ListSubheader>,
            ...group.actions.map(a => (
              <MenuItem key={a} value={a}>{formatActionLabel(a)}</MenuItem>
            )),
          ])}
        </TextField>
        <TextField
          label="From"
          type="date"
          size="small"
          value={fromFilter}
          onChange={e => { setFromFilter(e.target.value); setPage(0) }}
          sx={{ minWidth: 160 }}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label="To"
          type="date"
          size="small"
          value={toFilter}
          onChange={e => { setToFilter(e.target.value); setPage(0) }}
          sx={{ minWidth: 160 }}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Box>

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error instanceof Error ? error.message : 'Failed to load audit logs'}
        </Alert>
      )}
      {exportError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setExportError(null)}>
          Export failed: {exportError}
        </Alert>
      )}

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width={40} />
                <TableCell>Time (UTC)</TableCell>
                <TableCell>User</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Resource</TableCell>
                <TableCell>IP</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && Array.from({ length: Math.min(pageSize, 8) }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell sx={{ width: 40 }} />
                  <TableCell><Skeleton width={140} /></TableCell>
                  <TableCell><Skeleton width={80} /></TableCell>
                  <TableCell><Skeleton width={100} /></TableCell>
                  <TableCell><Skeleton width={60} /></TableCell>
                  <TableCell><Skeleton width={100} /></TableCell>
                </TableRow>
              ))}
              {!isLoading && data?.items?.map(entry => <AuditRow key={entry.id} entry={entry} />)}
              {!isLoading && !isError && data?.items?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={TABLE_COLS} align="center">
                    <Typography variant="body2" color="text.secondary" py={4}>No audit log entries found.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={data?.total ?? 0}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={pageSize}
          onRowsPerPageChange={e => { setPageSize(parseInt(e.target.value, 10)); setPage(0) }}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </Card>
    </Box>
  )
}
