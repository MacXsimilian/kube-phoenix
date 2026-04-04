'use client'

import { useState, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import DeleteForeverOutlinedIcon from '@mui/icons-material/DeleteForeverOutlined'
import FlashOnIcon from '@mui/icons-material/FlashOn'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import { useTheme } from '@mui/material/styles'
import { resetDatabaseStream, emergencyScaleStream, type ResetEvent } from '@/lib/api'
import { canResetDB, canEmergencyScale } from '@/lib/rbac'
import { formatError } from '@/lib/formatters'

const RESET_CONFIRM_PHRASE = 'RESET DATABASE'
const EMERGENCY_CONFIRM_PHRASE = 'EMERGENCY SCALE'

interface ResetProgressDialogProps {
  open: boolean
  events: ResetEvent[]
  done: boolean
  onClose: () => void
}

function ResetProgressDialog({
  open,
  events,
  done,
  onClose,
}: ResetProgressDialogProps) {
  const theme = useTheme()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  const failed = events.some((e) => e.type === 'error')
  const succeeded = events.some((e) => e.type === 'done')

  return (
    <Dialog
      open={open}
      onClose={done ? onClose : undefined}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: { bgcolor: 'background.paper' } } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {!done && <CircularProgress size={18} sx={{ flexShrink: 0 }} />}
        {done && succeeded && <CheckCircleOutlineIcon color="success" sx={{ flexShrink: 0 }} />}
        {done && failed && <ErrorOutlineIcon color="error" sx={{ flexShrink: 0 }} />}
        {!done ? 'Resetting database\u2026' : succeeded ? 'Reset complete' : 'Reset failed'}
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        <Box
          sx={{
            bgcolor: 'background.default',
            mx: 0,
            px: 2,
            py: 1.5,
            minHeight: 160,
            maxHeight: 320,
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: 13,
          }}
        >
          {events.map((e, i) => {
            const color =
              e.type === 'done' ? theme.palette.success.main
              : e.type === 'error' ? theme.palette.error.main
              : theme.palette.info.main
            return (
              <Box key={i} sx={{ lineHeight: 2, color }}>
                <Box component="span" sx={{ opacity: 0.35, mr: 1.5, userSelect: 'none', fontSize: 11 }}>
                  {e.type === 'done' ? '\u2713' : e.type === 'error' ? '\u2717' : '\u203A'}
                </Box>
                {e.message}
              </Box>
            )
          })}
          {!done && (
            <Box sx={{ color: 'text.disabled', lineHeight: 2 }}>
              <Box component="span" sx={{ mr: 1.5 }}>{'\u203A'}</Box>
              <Box component="span" sx={{ opacity: 0.5 }}>waiting\u2026</Box>
            </Box>
          )}
          <div ref={bottomRef} />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={!done} variant={done ? 'contained' : 'text'}>
          {done ? 'Close' : 'Running\u2026'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

interface DangerZoneProps {
  permissions?: string[]
  bare?: boolean
}

export default function DatabaseSettings({ permissions, bare }: DangerZoneProps) {
  const queryClient = useQueryClient()

  // ── Reset Database state ─────────────────────────────────────────────
  const [resetStep1Open, setResetStep1Open] = useState(false)
  const [resetStep2Open, setResetStep2Open] = useState(false)
  const [resetPhrase, setResetPhrase] = useState('')
  const [resetProgressOpen, setResetProgressOpen] = useState(false)
  const [resetProgressEvents, setResetProgressEvents] = useState<ResetEvent[]>([])
  const [resetProgressDone, setResetProgressDone] = useState(false)

  // ── Emergency Scale state ────────────────────────────────────────────
  const [esStep1Open, setEsStep1Open] = useState(false)
  const [esStep2Open, setEsStep2Open] = useState(false)
  const [esPhrase, setEsPhrase] = useState('')
  const [esProgressOpen, setEsProgressOpen] = useState(false)
  const [esProgressEvents, setEsProgressEvents] = useState<ResetEvent[]>([])
  const [esProgressDone, setEsProgressDone] = useState(false)

  const showResetDB = canResetDB(permissions)
  const showEmergencyScale = canEmergencyScale(permissions)

  // ── Reset Database handlers ──────────────────────────────────────────
  function confirmResetStep1() {
    setResetStep1Open(false)
    setResetPhrase('')
    setResetStep2Open(true)
  }

  async function confirmResetStep2() {
    if (resetPhrase !== RESET_CONFIRM_PHRASE) return
    setResetStep2Open(false)
    setResetPhrase('')
    setResetProgressEvents([])
    setResetProgressDone(false)
    setResetProgressOpen(true)

    try {
      for await (const event of resetDatabaseStream()) {
        setResetProgressEvents((prev) => [...prev, event])
        if (event.type === 'done') {
          queryClient.clear()
          break
        }
        if (event.type === 'error') break
      }
    } catch (err) {
      const msg = formatError(err)
      setResetProgressEvents((prev) => [...prev, { type: 'error', message: msg }])
    } finally {
      setResetProgressDone(true)
    }
  }

  // ── Emergency Scale handlers ─────────────────────────────────────────
  function confirmEsStep1() {
    setEsStep1Open(false)
    setEsPhrase('')
    setEsStep2Open(true)
  }

  async function confirmEsStep2() {
    if (esPhrase !== EMERGENCY_CONFIRM_PHRASE) return
    setEsStep2Open(false)
    setEsPhrase('')
    setEsProgressEvents([])
    setEsProgressDone(false)
    setEsProgressOpen(true)

    try {
      for await (const event of emergencyScaleStream()) {
        setEsProgressEvents((prev) => [...prev, event])
        if (event.type === 'done') {
          queryClient.clear()
          break
        }
        if (event.type === 'error') break
      }
    } catch (err) {
      const msg = formatError(err)
      setEsProgressEvents((prev) => [...prev, { type: 'error', message: msg }])
    } finally {
      setEsProgressDone(true)
    }
  }

  const content = (
    <>
      {showEmergencyScale && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: showResetDB ? 3 : 0 }}>
          <Box>
            <Typography variant="body2" fontWeight={600}>
              Emergency Scale
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Immediately disables all policies and scales every sleeping workload to 1 replica.
              Use this in an emergency to restore minimum availability.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            color="error"
            startIcon={<FlashOnIcon />}
            onClick={() => setEsStep1Open(true)}
            sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            Emergency Scale
          </Button>
        </Box>
      )}

      {showEmergencyScale && showResetDB && <Divider sx={{ mb: 3 }} />}

      {showResetDB && (
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
            onClick={() => setResetStep1Open(true)}
            sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            Reset Database
          </Button>
        </Box>
      )}
    </>
  )

  return (
    <>
      {bare ? content : (
        <Card sx={{ border: '1px solid', borderColor: 'error.main', bgcolor: 'rgba(239,68,68,0.04)' }}>
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
            {content}
          </CardContent>
        </Card>
      )}

      {/* ── Reset Database dialogs ──────────────────────────────────────── */}
      <Dialog open={resetStep1Open} onClose={() => setResetStep1Open(false)} maxWidth="xs" fullWidth>
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
          <Button onClick={() => setResetStep1Open(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmResetStep1}>
            I understand, continue
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={resetStep2Open} onClose={() => setResetStep2Open(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm destructive operation</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            To confirm, type <strong>{RESET_CONFIRM_PHRASE}</strong> in the field below.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder={RESET_CONFIRM_PHRASE}
            value={resetPhrase}
            onChange={(e) => setResetPhrase(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && resetPhrase === RESET_CONFIRM_PHRASE && confirmResetStep2()}
            error={resetPhrase.length > 0 && resetPhrase !== RESET_CONFIRM_PHRASE}
            helperText={resetPhrase.length > 0 && resetPhrase !== RESET_CONFIRM_PHRASE ? 'Phrase does not match' : ' '}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setResetStep2Open(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmResetStep2}
            disabled={resetPhrase !== RESET_CONFIRM_PHRASE}
            startIcon={<DeleteForeverOutlinedIcon />}
          >
            Reset Database
          </Button>
        </DialogActions>
      </Dialog>

      <ResetProgressDialog
        open={resetProgressOpen}
        events={resetProgressEvents}
        done={resetProgressDone}
        onClose={() => { setResetProgressOpen(false); setResetProgressEvents([]); setResetProgressDone(false) }}
      />

      {/* ── Emergency Scale dialogs ─────────────────────────────────────── */}
      <Dialog open={esStep1Open} onClose={() => setEsStep1Open(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberRoundedIcon color="error" />
          Are you absolutely sure?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This will <strong>disable all policies</strong> and immediately scale every sleeping workload to
            {' '}<strong>1 replica</strong>. Policies will need to be manually re-enabled afterward.
          </Typography>
          <Typography variant="body2" color="error" mt={2} fontWeight={600}>
            All policies will be disabled. Workloads will not return to their original replica counts.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEsStep1Open(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmEsStep1}>
            I understand, continue
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={esStep2Open} onClose={() => setEsStep2Open(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm emergency operation</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            To confirm, type <strong>{EMERGENCY_CONFIRM_PHRASE}</strong> in the field below.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder={EMERGENCY_CONFIRM_PHRASE}
            value={esPhrase}
            onChange={(e) => setEsPhrase(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && esPhrase === EMERGENCY_CONFIRM_PHRASE && confirmEsStep2()}
            error={esPhrase.length > 0 && esPhrase !== EMERGENCY_CONFIRM_PHRASE}
            helperText={esPhrase.length > 0 && esPhrase !== EMERGENCY_CONFIRM_PHRASE ? 'Phrase does not match' : ' '}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEsStep2Open(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmEsStep2}
            disabled={esPhrase !== EMERGENCY_CONFIRM_PHRASE}
            startIcon={<FlashOnIcon />}
          >
            Emergency Scale
          </Button>
        </DialogActions>
      </Dialog>

      <ResetProgressDialog
        open={esProgressOpen}
        events={esProgressEvents}
        done={esProgressDone}
        onClose={() => { setEsProgressOpen(false); setEsProgressEvents([]); setEsProgressDone(false) }}
      />
    </>
  )
}
