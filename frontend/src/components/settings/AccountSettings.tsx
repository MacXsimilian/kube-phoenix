'use client'

import { useState } from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import { changePasswordAPI } from '@/lib/api'
import type { User } from '@/lib/types'

export default function AccountSettings({ user }: { user: User }) {
  const [pwDialogOpen, setPwDialogOpen] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)

  return (
    <>
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Account
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
            {(user.givenName || user.familyName) && (
              <Box>
                <Typography variant="caption" color="text.secondary">Name</Typography>
                <Typography variant="body2" fontWeight={600}>{[user.givenName, user.familyName].filter(Boolean).join(' ')}</Typography>
              </Box>
            )}
            <Box>
              <Typography variant="caption" color="text.secondary">Username</Typography>
              <Typography variant="body2" fontWeight={600}>{user.username}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Role</Typography>
              <Typography variant="body2">
                <Chip label={user.role} size="small" color={user.role === 'admin' ? 'error' : user.role === 'operator' ? 'warning' : 'default'} />
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Source</Typography>
              <Typography variant="body2">{user.source === 'oidc' ? 'SSO (OIDC)' : 'Local'}</Typography>
            </Box>
          </Box>
          {user.source === 'local' && (
            <Button variant="outlined" size="small" onClick={() => { setPwDialogOpen(true); setPwError(''); setPwSuccess(false); setCurrentPw(''); setNewPw('') }}>
              Change Password
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Password change dialog */}
      <Dialog open={pwDialogOpen} onClose={() => setPwDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          {pwError && <Alert severity="error">{pwError}</Alert>}
          {pwSuccess && <Alert severity="success">Password changed successfully.</Alert>}
          <TextField label="Current password" type="password" fullWidth size="small" value={currentPw} onChange={e => setCurrentPw(e.target.value)} disabled={pwLoading} />
          <TextField label="New password" type="password" fullWidth size="small" value={newPw} onChange={e => setNewPw(e.target.value)} disabled={pwLoading} helperText="Minimum 8 characters" />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPwDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={pwLoading || !currentPw || newPw.length < 8} onClick={async () => {
            setPwLoading(true); setPwError(''); setPwSuccess(false)
            try {
              await changePasswordAPI(currentPw, newPw)
              setPwSuccess(true); setCurrentPw(''); setNewPw('')
            } catch (err) {
              setPwError(err instanceof Error ? err.message : 'Failed')
            } finally { setPwLoading(false) }
          }}>
            {pwLoading ? <CircularProgress size={20} /> : 'Change'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
