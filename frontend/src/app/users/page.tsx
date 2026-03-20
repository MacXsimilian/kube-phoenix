'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined'
import { useRouter } from 'next/navigation'
import { getUsers, createUserAPI, updateUserAPI, deleteUserAPI } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { canManageUsers } from '@/lib/rbac'
import type { User } from '@/lib/types'

const ROLE_COLORS: Record<string, 'error' | 'warning' | 'default'> = {
  admin: 'error', operator: 'warning', viewer: 'default',
}

export default function UsersPage() {
  const { user: me } = useAuth()
  const router = useRouter()
  const qc = useQueryClient()
  const { data: users, isLoading, isError } = useQuery({ queryKey: ['users'], queryFn: getUsers })

  // Permission guard — redirect if user lacks user.manage permission.
  if (me && !canManageUsers(me.permissions)) {
    router.replace('/overview')
    return null
  }

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'viewer' })
  const [createError, setCreateError] = useState('')

  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [mutationError, setMutationError] = useState('')

  const createMutation = useMutation({
    mutationFn: () => createUserAPI(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setCreateOpen(false); setForm({ username: '', email: '', password: '', role: 'viewer' }); setCreateError('') },
    onError: (err: Error) => setCreateError(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => updateUserAPI(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setMutationError('') },
    onError: (err: Error) => setMutationError(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteUserAPI(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setDeleteTarget(null); setMutationError('') },
    onError: (err: Error) => { setMutationError(err.message); setDeleteTarget(null) },
  })

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', p: { xs: 2, md: 4 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Users</Typography>
          <Typography variant="body2" color="text.secondary">Manage user accounts and roles.</Typography>
        </Box>
        <Button variant="contained" startIcon={<PersonAddOutlinedIcon />} onClick={() => { setCreateOpen(true); setCreateError('') }}>
          Add User
        </Button>
      </Box>

      {isError && <Alert severity="error" sx={{ mb: 2 }}>Failed to load users. You may not have permission to view this page.</Alert>}
      {mutationError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setMutationError('')}>{mutationError}</Alert>}

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Username</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Enabled</TableCell>
                <TableCell>Last Login</TableCell>
                <TableCell width={60} />
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={7}><Skeleton /></TableCell></TableRow>
              ))}
              {users?.map(u => (
                <TableRow key={u.id} sx={{ opacity: u.enabled ? 1 : 0.5 }}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{u.username}</Typography>
                  </TableCell>
                  <TableCell>{u.email || '—'}</TableCell>
                  <TableCell>
                    {u.source === 'oidc' ? (
                      <Tooltip title="Role managed by AD groups"><Chip label={u.role} size="small" color={ROLE_COLORS[u.role]} /></Tooltip>
                    ) : (
                      <TextField
                        select size="small" variant="standard" value={u.role}
                        disabled={u.id === me?.id || updateMutation.isPending}
                        onChange={e => updateMutation.mutate({ id: u.id, data: { role: e.target.value } })}
                        sx={{ minWidth: 100 }}
                      >
                        <MenuItem value="admin">admin</MenuItem>
                        <MenuItem value="operator">operator</MenuItem>
                        <MenuItem value="viewer">viewer</MenuItem>
                      </TextField>
                    )}
                  </TableCell>
                  <TableCell><Chip label={u.source} size="small" variant="outlined" /></TableCell>
                  <TableCell>
                    <Switch
                      checked={u.enabled} size="small"
                      disabled={u.id === me?.id || updateMutation.isPending}
                      onChange={(_, checked) => updateMutation.mutate({ id: u.id, data: { enabled: checked } })}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {u.id !== me?.id && (
                      <IconButton size="small" color="error" onClick={() => setDeleteTarget(u)}>
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
          <Typography variant="body2" color="text.secondary">
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
  )
}
