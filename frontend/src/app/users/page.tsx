'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Switch from '@mui/material/Switch'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Alert from '@mui/material/Alert'
import Skeleton from '@mui/material/Skeleton'
import Tooltip from '@mui/material/Tooltip'
import Avatar from '@mui/material/Avatar'
import InputAdornment from '@mui/material/InputAdornment'
import SearchIcon from '@mui/icons-material/Search'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined'
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined'
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined'
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/shared/PageHeader'
import { getUsers, createUserAPI, updateUserAPI, deleteUserAPI } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { canManageUsers } from '@/lib/rbac'
import type { User, Role } from '@/lib/types'
import { TABLE_HEAD_CELL_SX, TABLE_BODY_CELL_SX } from '@/lib/tableStyles'

const ROLE_COLORS: Record<string, 'error' | 'warning' | 'default'> = {
  admin: 'error', operator: 'warning', viewer: 'default',
}

const ROLE_CHIP_SX: Record<string, { bgcolor: string; color: string }> = {
  admin: { bgcolor: 'rgba(239,68,68,0.12)', color: 'error.main' },
  operator: { bgcolor: 'rgba(245,158,11,0.12)', color: 'warning.main' },
  viewer: { bgcolor: 'action.hover', color: 'text.secondary' },
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days > 30) return new Date(iso).toLocaleDateString()
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (mins > 0) return `${mins}m ago`
  return 'Just now'
}

export default function UsersPage() {
  const { user: me } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: users, isLoading, isError } = useQuery({ queryKey: queryKeys.users(), queryFn: getUsers })

  const [search, setSearch] = useState('')
  const filteredUsers = useMemo(() => {
    if (!users) return []
    const q = search.toLowerCase()
    if (!q) return users
    return users.filter(u =>
      u.username.toLowerCase().includes(q) ||
      (u.givenName?.toLowerCase().includes(q)) ||
      (u.familyName?.toLowerCase().includes(q))
    )
  }, [users, search])

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'viewer' })
  const [createError, setCreateError] = useState('')

  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [mutationError, setMutationError] = useState('')

  const createMutation = useMutation({
    mutationFn: () => createUserAPI(form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.users() }); setCreateOpen(false); setForm({ username: '', email: '', password: '', role: 'viewer' }); setCreateError('') },
    onError: (err: Error) => setCreateError(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Pick<User, 'role' | 'enabled'>> }) => updateUserAPI(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.users() }); setMutationError('') },
    onError: (err: Error) => setMutationError(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteUserAPI(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.users() }); setDeleteTarget(null); setMutationError('') },
    onError: (err: Error) => { setMutationError(err.message); setDeleteTarget(null) },
  })

  useEffect(() => {
    if (me && !canManageUsers(me.permissions)) router.replace('/overview')
  }, [me, router])

  if (me && !canManageUsers(me.permissions)) return null

  return (
    <Box>
      <PageHeader
        title="Users"
        subtitle={`${users?.length ?? 0} users total`}
        actions={
          <Button variant="contained" startIcon={<PersonAddOutlinedIcon />} onClick={() => { setCreateOpen(true); setCreateError('') }}>
            Add User
          </Button>
        }
      />
      {isError && <Alert severity="error" sx={{ mb: 2 }}>Failed to load users. You may not have permission to view this page.</Alert>}
      {mutationError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setMutationError('')}>{mutationError}</Alert>}
      <TextField
        size="small"
        placeholder="Search by username or name…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        sx={{ mb: 2, width: 320 }}
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
      />
      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={TABLE_HEAD_CELL_SX}>User</TableCell>
                <TableCell sx={TABLE_HEAD_CELL_SX}>Email</TableCell>
                <TableCell sx={TABLE_HEAD_CELL_SX}>Role</TableCell>
                <TableCell sx={TABLE_HEAD_CELL_SX}>Source</TableCell>
                <TableCell sx={TABLE_HEAD_CELL_SX}>Enabled</TableCell>
                <TableCell sx={TABLE_HEAD_CELL_SX}>Last Login</TableCell>
                <TableCell width={60} />
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={7}><Skeleton /></TableCell></TableRow>
              ))}
              {filteredUsers.map(u => (
                <TableRow key={u.id} hover>
                  <TableCell sx={TABLE_BODY_CELL_SX}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar sx={{ width: 28, height: 28, fontSize: 11, fontWeight: 700 }}>
                        {(u.givenName?.[0] ?? u.username[0]).toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            fontSize: 13
                          }}>{u.username}</Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            color: "text.secondary",
                            fontSize: 11
                          }}>
                          {[u.givenName, u.familyName].filter(Boolean).join(' ') || '—'}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ fontSize: 13, color: 'text.secondary' }}>{u.email || '—'}</TableCell>
                  <TableCell>
                    {u.source === 'oidc' ? (
                      <Tooltip title="Role managed by AD groups">
                        <Chip label={u.role} size="small" sx={{ fontSize: 10, height: 20, ...(ROLE_CHIP_SX[u.role] ?? {}) }} />
                      </Tooltip>
                    ) : (
                      <TextField
                        select size="small" variant="standard" value={u.role}
                        disabled={u.id === me?.id || updateMutation.isPending}
                        onChange={e => updateMutation.mutate({ id: u.id, data: { role: e.target.value as Role } })}
                        sx={{ minWidth: 90 }}
                      >
                        <MenuItem value="admin">admin</MenuItem>
                        <MenuItem value="operator">operator</MenuItem>
                        <MenuItem value="viewer">viewer</MenuItem>
                      </TextField>
                    )}
                  </TableCell>
                  <TableCell>
                    <Tooltip title={u.source === 'oidc' ? 'Authenticated via OIDC / Single Sign-On — role managed by AD groups' : 'Local account — password stored in the application database'} arrow>
                      <Box sx={{
                        display: 'inline-flex', alignItems: 'center', gap: 0.4, px: 0.75, py: 0.25,
                        borderRadius: 2, border: '1.5px solid',
                        borderColor: u.source === 'oidc' ? 'primary.main' : 'divider',
                      }}>
                        {u.source === 'oidc'
                          ? <KeyOutlinedIcon sx={{ fontSize: 13, color: 'primary.main' }} />
                          : <StorageOutlinedIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                        }
                        <Typography sx={{ fontSize: 10, fontWeight: 600, color: u.source === 'oidc' ? 'primary.main' : 'text.secondary' }}>
                          {u.source === 'oidc' ? 'SSO' : 'Local'}
                        </Typography>
                      </Box>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Switch
                      aria-label={`Toggle ${u.username} enabled`}
                      checked={u.enabled} size="small"
                      disabled={u.id === me?.id || updateMutation.isPending}
                      onChange={(_, checked) => updateMutation.mutate({ id: u.id, data: { enabled: checked } })}
                    />
                  </TableCell>
                  <TableCell>
                    <Tooltip title={u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : ''}>
                      <Typography
                        variant="caption"
                        sx={{
                          color: "text.disabled",
                          fontVariantNumeric: 'tabular-nums'
                        }}>
                        {u.lastLoginAt ? relativeTime(u.lastLoginAt) : 'Never'}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    {u.id !== me?.id && (
                      <IconButton aria-label={`Delete user ${u.username}`} size="small" color="error" onClick={() => setDeleteTarget(u)} sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
      {/* Create user dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add User</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          {createError && <Alert severity="error">{createError}</Alert>}
          <TextField label="Username" fullWidth size="small" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} autoFocus />
          <TextField label="Email (optional)" fullWidth size="small" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          <TextField label="Password" type="password" fullWidth size="small" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} helperText="Minimum 8 characters" />
          <TextField label="Role" select fullWidth size="small" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
            <MenuItem value="admin">admin</MenuItem>
            <MenuItem value="operator">operator</MenuItem>
            <MenuItem value="viewer">viewer</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={createMutation.isPending || !form.username || form.password.length < 8}
            onClick={() => createMutation.mutate()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete user?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{
            color: "text.secondary"
          }}>
            Are you sure you want to delete <strong>{deleteTarget?.username}</strong>?
            {deleteTarget?.source === 'oidc' && ' This user may be re-created on next SSO login. Consider disabling instead.'}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" disabled={deleteMutation.isPending} onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
