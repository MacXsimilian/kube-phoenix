'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import DeleteForeverOutlinedIcon from '@mui/icons-material/DeleteForeverOutlined'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import SettingsBrightnessOutlinedIcon from '@mui/icons-material/SettingsBrightnessOutlined'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import Chip from '@mui/material/Chip'
import { resetDatabaseStream, changePasswordAPI, getOIDCConfig, type ResetEvent } from '@/lib/api'
import { useTheme } from '@mui/material/styles'
import { useThemeMode } from '@/lib/themeMode'
import { useAuth } from '@/lib/auth'
import { canResetDB } from '@/lib/rbac'

const CONFIRM_PHRASE = 'RESET DATABASE'

function ResetProgressDialog({
  open,
  events,
  done,
  onClose,
}: {
  open: boolean
  events: ResetEvent[]
  done: boolean
  onClose: () => void
}) {
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
        {!done ? 'Resetting database…' : succeeded ? 'Reset complete' : 'Reset failed'}
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
                  {e.type === 'done' ? '✓' : e.type === 'error' ? '✗' : '›'}
                </Box>
                {e.message}
              </Box>
            )
          })}
          {!done && (
            <Box sx={{ color: 'text.disabled', lineHeight: 2 }}>
              <Box component="span" sx={{ mr: 1.5 }}>›</Box>
              <Box component="span" sx={{ opacity: 0.5 }}>waiting…</Box>
            </Box>
          )}
          <div ref={bottomRef} />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={!done} variant={done ? 'contained' : 'text'}>
          {done ? 'Close' : 'Running…'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default function SettingsPage() {
  const { mode, setMode } = useThemeMode()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: oidcCfg, isLoading: oidcLoading } = useQuery({
    queryKey: ['oidc-config'],
    queryFn: getOIDCConfig,
  })
  const [step1Open, setStep1Open] = useState(false)
  const [pwDialogOpen, setPwDialogOpen] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [step2Open, setStep2Open] = useState(false)
  const [phrase, setPhrase] = useState('')
  const [progressOpen, setProgressOpen] = useState(false)
  const [progressEvents, setProgressEvents] = useState<ResetEvent[]>([])
  const [progressDone, setProgressDone] = useState(false)

  function openStep1() {
    setStep1Open(true)
  }

  function confirmStep1() {
    setStep1Open(false)
    setPhrase('')
    setStep2Open(true)
  }

  async function confirmStep2() {
    if (phrase !== CONFIRM_PHRASE) return
    setStep2Open(false)
    setPhrase('')
    setProgressEvents([])
    setProgressDone(false)
    setProgressOpen(true)

    try {
      for await (const event of resetDatabaseStream()) {
        setProgressEvents((prev) => [...prev, event])
        if (event.type === 'done') {
          queryClient.clear()
          break
        }
        if (event.type === 'error') break
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setProgressEvents((prev) => [...prev, { type: 'error', message: msg }])
    } finally {
      setProgressDone(true)
    }
  }

  function closeProgress() {
    setProgressOpen(false)
    setProgressEvents([])
    setProgressDone(false)
  }

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', p: { xs: 2, md: 4 } }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={4}>
        Application configuration and administrative operations.
      </Typography>

      {/* Account */}
      {user && user.id !== 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              Account
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
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
      )}

      {/* Appearance */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Appearance
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2.5}>
            Choose how kube-phoenix looks. System follows your OS preference.
          </Typography>
          <ToggleButtonGroup
            value={mode}
            exclusive
            onChange={(_, v) => v && setMode(v)}
            aria-label="Theme mode"
          >
            <ToggleButton value="light" aria-label="Light mode" sx={{ gap: 1, px: 2.5 }}>
              <LightModeOutlinedIcon fontSize="small" />
              Light
            </ToggleButton>
            <ToggleButton value="system" aria-label="System default" sx={{ gap: 1, px: 2.5 }}>
              <SettingsBrightnessOutlinedIcon fontSize="small" />
              System
            </ToggleButton>
            <ToggleButton value="dark" aria-label="Dark mode" sx={{ gap: 1, px: 2.5 }}>
              <DarkModeOutlinedIcon fontSize="small" />
              Dark
            </ToggleButton>
          </ToggleButtonGroup>
        </CardContent>
      </Card>

      {/* OIDC / SSO */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            OIDC / SSO
          </Typography>
          {oidcLoading ? (
            <CircularProgress size={20} />
          ) : (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                {oidcCfg?.enabled ? (
                  <CheckCircleOutlineIcon fontSize="small" color="success" />
                ) : oidcCfg?.mounted ? (
                  <WarningAmberOutlinedIcon fontSize="small" color="warning" />
                ) : (
                  <ErrorOutlineIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                )}
                <Typography variant="body2" fontWeight={600}>
                  {oidcCfg?.enabled
                    ? 'Active — provider initialized successfully'
                    : oidcCfg?.mounted
                      ? 'Config mounted but provider failed to initialize'
                      : 'Not configured'}
                </Typography>
              </Box>

              {oidcCfg?.mounted && (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '1fr',
                    gap: 2,
                  }}
                >
                  {[
                    { label: 'Issuer URL', value: oidcCfg.issuerURL },
                    { label: 'Client ID', value: oidcCfg.clientID },
                    { label: 'Redirect URL', value: oidcCfg.redirectURL },
                    { label: 'Groups claim', value: oidcCfg.groupsClaim },
                  ].map(({ label, value }) => (
                    <Box key={label}>
                      <Typography variant="caption" color="text.secondary">{label}</Typography>
                      <Typography
                        variant="body2"
                        fontFamily="monospace"
                        sx={{ wordBreak: 'break-all', color: value ? 'text.primary' : 'text.disabled' }}
                      >
                        {value || '—'}
                      </Typography>
                    </Box>
                  ))}

                  <Box>
                    <Typography variant="caption" color="text.secondary">Admin groups</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                      {oidcCfg.roleAdminGroups?.length
                        ? oidcCfg.roleAdminGroups.map((g) => (
                            <Chip key={g} label={g} size="small" color="error" variant="outlined" />
                          ))
                        : <Typography variant="body2" color="text.disabled">—</Typography>}
                    </Box>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary">Operator groups</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                      {oidcCfg.roleOperatorGroups?.length
                        ? oidcCfg.roleOperatorGroups.map((g) => (
                            <Chip key={g} label={g} size="small" color="warning" variant="outlined" />
                          ))
                        : <Typography variant="body2" color="text.disabled">—</Typography>}
                    </Box>
                  </Box>
                </Box>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone — admin only */}
      {canResetDB(user?.permissions) && <Card sx={{ border: '1px solid', borderColor: 'error.main', bgcolor: 'rgba(239,68,68,0.04)' }}>
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
      </Card>}

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
      <Dialog open={step2Open} onClose={() => setStep2Open(false)} maxWidth="xs" fullWidth>
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
            onChange={(e) => setPhrase(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && phrase === CONFIRM_PHRASE && confirmStep2()}
            error={phrase.length > 0 && phrase !== CONFIRM_PHRASE}
            helperText={phrase.length > 0 && phrase !== CONFIRM_PHRASE ? 'Phrase does not match' : ' '}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setStep2Open(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmStep2}
            disabled={phrase !== CONFIRM_PHRASE}
            startIcon={<DeleteForeverOutlinedIcon />}
          >
            Reset Database
          </Button>
        </DialogActions>
      </Dialog>

      {/* Progress dialog */}
      <ResetProgressDialog
        open={progressOpen}
        events={progressEvents}
        done={progressDone}
        onClose={closeProgress}
      />
    </Box>
  )
}
