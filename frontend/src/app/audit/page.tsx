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
import ListSubheader from '@mui/material/ListSubheader'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import DownloadIcon from '@mui/icons-material/Download'
import { getAuditLogs } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { canViewAudit } from '@/lib/rbac'
import { useRouter } from 'next/navigation'
import { formatActionLabel } from '@/components/audit/auditFormatters'
import { downloadCSV } from '@/components/audit/auditDiff'
import AuditRow from '@/components/audit/AuditRow'
import { useDebouncedValue } from '@/lib/useDebouncedValue'

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

export default function AuditLogPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [userFilter, setUserFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [fromFilter, setFromFilter] = useState('')
  const [toFilter, setToFilter] = useState('')
  const [exportError, setExportError] = useState<string | null>(null)

  const debouncedUserFilter = useDebouncedValue(userFilter, 300)
  const hasPermission = !!user && canViewAudit(user.permissions)

  useEffect(() => {
    if (user && !hasPermission) router.replace('/overview')
  }, [user, hasPermission, router])

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['audit-logs', page, pageSize, debouncedUserFilter, actionFilter, fromFilter, toFilter],
    queryFn: () => getAuditLogs({
      user: debouncedUserFilter || undefined,
      action: actionFilter || undefined,
      from: fromFilter ? new Date(`${fromFilter}T00:00:00`).toISOString() : undefined,
      to: toFilter ? new Date(`${toFilter}T23:59:59`).toISOString() : undefined,
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
        from: fromFilter ? new Date(`${fromFilter}T00:00:00`).toISOString() : undefined,
        to: toFilter ? new Date(`${toFilter}T23:59:59`).toISOString() : undefined,
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
                <TableCell>Time <Typography component="span" variant="caption" sx={{ color: 'text.disabled', fontWeight: 400, fontSize: 10 }}>— local time, hover for UTC</Typography></TableCell>
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
