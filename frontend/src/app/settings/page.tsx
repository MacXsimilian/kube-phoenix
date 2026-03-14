'use client'

import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import DeleteForeverOutlinedIcon from '@mui/icons-material/DeleteForeverOutlined'
import { resetDatabase } from '@/lib/api'

const CONFIRM_PHRASE = 'RESET DATABASE'

export default function SettingsPage() {
  // Step 1: "are you sure?" dialog
  const [step1Open, setStep1Open] = useState(false)
  // Step 2: type the phrase to confirm
  const [step2Open, setStep2Open] = useState(false)
  const [phrase, setPhrase] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  function openStep1() {
    setResult(null)
    setStep1Open(true)
  }

  function confirmStep1() {
    setStep1Open(false)
    setPhrase('')
    setStep2Open(true)
  }

  async function confirmStep2() {
    if (phrase !== CONFIRM_PHRASE) return
    setLoading(true)
    try {
      await resetDatabase()
      setResult({ type: 'success', message: 'Database reset and reseeded successfully.' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setResult({ type: 'error', message: `Reset failed: ${msg}` })
    } finally {
      setLoading(false)
      setStep2Open(false)
      setPhrase('')
    }
  }

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', p: { xs: 2, md: 4 } }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={4}>
        Application configuration and administrative operations.
      </Typography>

      {result && (
        <Alert severity={result.type} sx={{ mb: 3 }} onClose={() => setResult(null)}>
          {result.message}
        </Alert>
      )}

      {/* Danger Zone */}
      <Card
        sx={{
          border: '1px solid',
          borderColor: 'error.main',
          bgcolor: 'rgba(239,68,68,0.04)',
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <WarningAmberRoundedIcon sx={{ color: 'error.main' }} />
            <Typography variant="subtitle1" fontWeight={700} color="error.main">
              Danger Zone
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" mb={3}>
            These operations are irreversible. Proceed with extreme caution.
          </Typography>

          <Divider sx={{ mb: 3 }} />

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="body2" fontWeight={600}>
                Reset Database
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Drops all tables, recreates the schema, and reseeds default schedules and guardrails.
                All execution history and custom schedules will be permanently deleted.
              </Typography>
            </Box>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteForeverOutlinedIcon />}
              onClick={openStep1}
              sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              Reset Database
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Step 1: Initial warning */}
      <Dialog open={step1Open} onClose={() => setStep1Open(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberRoundedIcon color="error" />
          Are you absolutely sure?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This will permanently delete <strong>all schedules, execution history, and guardrail settings</strong>.
            The database will be wiped and reseeded with factory defaults.
          </Typography>
          <Typography variant="body2" color="error" mt={2} fontWeight={600}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setStep1Open(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmStep1}>
            I understand, continue
          </Button>
        </DialogActions>
      </Dialog>

      {/* Step 2: Type the confirmation phrase */}
      <Dialog open={step2Open} onClose={() => !loading && setStep2Open(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm destructive operation</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            To confirm, type <strong>{CONFIRM_PHRASE}</strong> in the field below.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder={CONFIRM_PHRASE}
            value={phrase}
            onChange={e => setPhrase(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && phrase === CONFIRM_PHRASE && confirmStep2()}
            disabled={loading}
            error={phrase.length > 0 && phrase !== CONFIRM_PHRASE}
            helperText={phrase.length > 0 && phrase !== CONFIRM_PHRASE ? 'Phrase does not match' : ' '}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setStep2Open(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmStep2}
            disabled={phrase !== CONFIRM_PHRASE || loading}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <DeleteForeverOutlinedIcon />}
          >
            {loading ? 'Resetting…' : 'Reset Database'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
