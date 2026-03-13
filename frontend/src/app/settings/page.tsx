'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { adminApi } from '@/lib/api'

const CONFIRM_WORD = 'reset'

export default function SettingsPage() {
  const qc = useQueryClient()
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleReset() {
    setLoading(true)
    setError(null)
    try {
      await adminApi.resetDB()
      // Invalidate every cached query so the UI reflects the clean state
      await qc.invalidateQueries()
      setDialogOpen(false)
      router.push('/overview')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset failed')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    if (loading) return
    setDialogOpen(false)
    setConfirmText('')
    setError(null)
  }

  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Settings</Typography>
      </Box>

      {/* Danger Zone */}
      <Paper
        sx={{
          border: '1px solid',
          borderColor: 'error.dark',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <Box sx={{ px: 3, py: 2, borderBottom: '1px solid', borderColor: 'error.dark', bgcolor: 'rgba(239,68,68,0.06)' }}>
          <Typography variant="subtitle2" color="error.main" fontWeight={700}>
            Danger Zone
          </Typography>
        </Box>

        <Box sx={{ px: 3, py: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Box>
            <Typography variant="body2" fontWeight={600}>Reset Database</Typography>
            <Typography variant="caption" color="text.secondary">
              Drop all tables, re-run migrations, and re-seed defaults. All policies, executions,
              history, and snapshots will be permanently deleted.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<DeleteForeverIcon />}
            onClick={() => setDialogOpen(true)}
            sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            Reset DB
          </Button>
        </Box>
      </Paper>

      {/* Confirmation dialog */}
      <Dialog open={dialogOpen} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <WarningAmberIcon color="error" />
          Reset Database
        </DialogTitle>

        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            This will permanently delete <strong>all data</strong> — policies, executions, history,
            snapshots, and notifications. The database will be re-seeded with defaults.
          </Alert>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Type <strong>{CONFIRM_WORD}</strong> to confirm.
          </Typography>

          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder={CONFIRM_WORD}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && confirmText === CONFIRM_WORD && !loading) handleReset()
            }}
            disabled={loading}
          />

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={loading}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            disabled={confirmText !== CONFIRM_WORD || loading}
            onClick={handleReset}
            startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <DeleteForeverIcon />}
          >
            {loading ? 'Resetting…' : 'Reset Database'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
