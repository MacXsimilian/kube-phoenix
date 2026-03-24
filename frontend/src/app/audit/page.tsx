'use client'

import { useState, useEffect } from 'react'
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
import Chip from '@mui/material/Chip'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import { getAuditLogs } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { canViewAudit } from '@/lib/rbac'
import { useRouter } from 'next/navigation'
import type { AuditLogEntry } from '@/lib/types'
import { formatActionLabel } from '@/lib/statusColors'

const ACTIONS = [
  '', 'schedule.create', 'schedule.update', 'schedule.delete', 'schedule.reorder',
  'guardrail.update', 'trigger.manual', 'admin.reset_db',
  'user.create', 'user.update', 'user.delete',
  'auth.login', 'auth.logout', 'auth.password_change',
]

const ACTION_COLORS: Record<string, 'error' | 'warning' | 'info' | 'success' | 'default'> = {
  'admin.reset_db': 'error', 'trigger.manual': 'warning',
  'auth.login': 'success', 'auth.logout': 'default',
}

function DiffView({ label, json }: { label: string; json?: string }) {
  if (!json || json === 'null') return null
  let parsed: unknown
  try { parsed = JSON.parse(json) } catch { return <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{json}</Typography> }
  return (
    <Box sx={{ mb: 1 }}>
      <Typography variant="caption" color="text.secondary" fontWeight={600}>{label}:</Typography>
      <Box sx={{ bgcolor: 'background.default', borderRadius: 1, p: 1, mt: 0.5, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 200, overflowY: 'auto' }}>
        {JSON.stringify(parsed, null, 2)}
      </Box>
    </Box>
  )
}

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  const [open, setOpen] = useState(false)
  const hasDiff = (entry.before && entry.before !== 'null') || (entry.after && entry.after !== 'null')

  return (
    <>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell sx={{ width: 40 }}>
          {hasDiff && (
            <IconButton size="small" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Show changes">
              {open ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
            </IconButton>
          )}
        </TableCell>
        <TableCell>
          <Typography variant="caption" color="text.secondary">
            {new Date(entry.timestamp).toLocaleString()}
          </Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2" fontWeight={600}>{entry.username}</Typography>
        </TableCell>
        <TableCell>
          <Chip label={formatActionLabel(entry.action)} size="small" color={ACTION_COLORS[entry.action] ?? 'info'} variant="outlined" />
        </TableCell>
        <TableCell>
          {entry.resourceType && (
            <Typography variant="caption" color="text.secondary">
              {entry.resourceType}{entry.resourceId ? ` #${entry.resourceId}` : ''}
            </Typography>
          )}
        </TableCell>
        <TableCell>
          <Typography variant="caption" color="text.secondary">{entry.ipAddress}</Typography>
        </TableCell>
      </TableRow>
      {hasDiff && (
        <TableRow>
          <TableCell colSpan={6} sx={{ py: 0 }}>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <Box sx={{ p: 2 }}>
                <DiffView label="Before" json={entry.before} />
                <DiffView label="After" json={entry.after} />
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

  useEffect(() => {
    if (user && !canViewAudit(user.permissions)) router.replace('/overview')
  }, [user, router])

  useEffect(() => {
    const debounceTimer = setTimeout(() => setDebouncedUserFilter(userFilter), 300)
    return () => clearTimeout(debounceTimer)
  }, [userFilter])

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, pageSize, debouncedUserFilter, actionFilter],
    queryFn: () => getAuditLogs({ user: debouncedUserFilter || undefined, action: actionFilter || undefined, page, pageSize }),
  })

  // Permission guard — return null after all hooks.
  if (user && !canViewAudit(user.permissions)) return null

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', p: { xs: 2, md: 4 } }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>Audit Log</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Track who did what and when.
      </Typography>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          label="User" size="small" value={userFilter}
          onChange={e => { setUserFilter(e.target.value); setPage(0) }}
          sx={{ minWidth: 150 }}
        />
        <TextField
          label="Action" select size="small" value={actionFilter}
          onChange={e => { setActionFilter(e.target.value); setPage(0) }}
          sx={{ minWidth: 200 }}
        >
          {ACTIONS.map(a => <MenuItem key={a} value={a}>{a ? formatActionLabel(a) : 'All actions'}</MenuItem>)}
        </TextField>
      </Box>

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width={40} />
                <TableCell>Time</TableCell>
                <TableCell>User</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Resource</TableCell>
                <TableCell>IP</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={6}><Skeleton /></TableCell></TableRow>
              ))}
              {data?.items?.map(entry => <AuditRow key={entry.id} entry={entry} />)}
              {!isLoading && data?.items?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
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
