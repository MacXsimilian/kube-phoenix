'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Switch from '@mui/material/Switch'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import CloseIcon from '@mui/icons-material/Close'
import { policiesApi } from '@/lib/api'
import type { SleepPolicy } from '@/lib/types'

const DELETE_DELAY_MS = 5000

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'now'
  const m = Math.floor(diff / 60000)
  if (m < 60) {
    const h2 = Math.floor(m / 60)
    const rem = m % 60
    if (h2 === 0) return `in ${rem}m`
    return `in ${h2}h ${rem}m`
  }
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem > 0 ? `in ${h}h ${rem}m` : `in ${h}h`
}

function formatNextTime(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  if (isToday) return `today at ${timeStr}`
  const diff = d.getTime() - now.getTime()
  if (diff > 0 && diff < 24 * 60 * 60 * 1000) return timeUntil(iso)
  return timeStr
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function parseDaysOfWeek(raw: string): string[] {
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

const DAY_LABELS: Record<string, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
}

function summariseDays(days: string[]): string {
  if (days.length === 7) return 'Every day'
  const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri']
  const weekend = ['sat', 'sun']
  if (weekdays.every((d) => days.includes(d)) && days.length === 5) return 'Mon\u2013Fri'
  if (weekend.every((d) => days.includes(d)) && days.length === 2) return 'Sat\u2013Sun'
  if (days.length === 0) return '—'
  return days.map((d) => DAY_LABELS[d] ?? d).join(', ')
}

function WindowSummary({ policy }: { policy: SleepPolicy }) {
  const windows = policy.windows ?? []
  if (windows.length === 0) return <Typography variant="body2" color="text.secondary">No windows configured</Typography>

  const first = windows[0]
  const days = parseDaysOfWeek(first.daysOfWeek)
  const daySummary = summariseDays(days)
  const extra = windows.length > 1 ? ` +${windows.length - 1} more` : ''

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <Typography variant="body2" color="text.secondary">
        {daySummary}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Sleep {first.sleepAt}
        {first.wakeAt ? ` \u2192 Wake ${first.wakeAt}` : ' \u00B7 Manual wake'}
      </Typography>
      <Typography variant="caption" color="text.disabled">
        {policy.timezone}
      </Typography>
      {extra && (
        <Chip
          label={extra}
          size="small"
          sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(255,255,255,0.07)' }}
        />
      )}
    </Box>
  )
}

function SkipPill({
  policyId,
  occurrenceDate,
  edge,
  label,
}: {
  policyId: number
  occurrenceDate: string
  edge: string
  label: string
}) {
  const qc = useQueryClient()
  const remove = useMutation({
    mutationFn: () => policiesApi.deleteOverride(policyId, occurrenceDate, edge),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['policies'] }),
  })

  return (
    <Chip
      label={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <span>{label}</span>
          <CloseIcon sx={{ fontSize: 10 }} />
        </Box>
      }
      size="small"
      onClick={() => remove.mutate()}
      sx={{
        height: 18,
        fontSize: 10,
        bgcolor: 'rgba(245,158,11,0.18)',
        color: 'warning.main',
        cursor: 'pointer',
        '&:hover': { bgcolor: 'rgba(245,158,11,0.3)' },
      }}
    />
  )
}

export default function PolicyCard({
  policy,
  onEdit,
  onDelete,
}: {
  policy: SleepPolicy
  onEdit: () => void
  onDelete: () => void
}) {
  const qc = useQueryClient()
  const router = useRouter()

  const [deleteDialog, setDeleteDialog] = useState(false)
  const [modeDialog, setModeDialog] = useState(false)
  const [undoOpen, setUndoOpen] = useState(false)
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (deleteTimer.current) clearTimeout(deleteTimer.current)
    }
  }, [])

  const toggleEnabled = useMutation({
    mutationFn: () => policiesApi.update(policy.id, { enabled: !policy.enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['policies'] }),
  })

  const toggleMode = useMutation({
    mutationFn: () => policiesApi.update(policy.id, { mode: policy.mode === 'plan' ? 'apply' : 'plan' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['policies'] })
      setModeDialog(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => policiesApi.delete(policy.id),
    onSuccess: () => onDelete(),
  })

  function handleDeleteConfirm() {
    setDeleteDialog(false)
    setUndoOpen(true)
    deleteTimer.current = setTimeout(() => {
      setUndoOpen(false)
      deleteMutation.mutate()
    }, DELETE_DELAY_MS)
  }

  function handleUndo() {
    if (deleteTimer.current) clearTimeout(deleteTimer.current)
    setUndoOpen(false)
  }

  const tags = policy.tags ? policy.tags.split(',').map((t) => t.trim()).filter(Boolean) : []

  const namespaces = policy.namespaceFilter
    ? policy.namespaceFilter.split(',').map((n) => n.trim()).filter(Boolean)
    : []

  // Find active overrides for sleep/wake
  const today = new Date().toISOString().split('T')[0]
  const sleepOverride = policy.overrides?.find(
    (o) => o.occurrenceDate === today && (o.edge === 'sleep' || o.edge === 'both')
  )
  const wakeOverride = policy.overrides?.find(
    (o) => o.occurrenceDate === today && (o.edge === 'wake' || o.edge === 'both')
  )

  const nextSleepStr = formatNextTime(policy.nextSleep)
  const nextWakeStr = formatNextTime(policy.nextWake)

  const lastStatus = policy.lastExecution?.status
  const lastStatusColor =
    lastStatus === 'success' ? 'success.main' :
    lastStatus === 'failed' ? 'error.main' :
    lastStatus === 'running' ? 'info.main' : 'text.disabled'

  return (
    <>
      <Paper
        sx={{
          p: 2.5,
          '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
        }}
      >
        {/* Top row: toggle + name + mode + conflict tags + actions */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <Switch
            checked={policy.enabled}
            onChange={() => toggleEnabled.mutate()}
            color="primary"
            size="small"
            sx={{ mt: 0.25 }}
          />

          <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* Name + mode + conflict tags */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75, flexWrap: 'wrap' }}>
              <Typography variant="body1" fontWeight={700}>
                {policy.name}
              </Typography>

              {/* Mode chip — click to open activation dialog */}
              <Tooltip title={policy.mode === 'plan' ? 'Dry-run mode — click to go live' : 'Live mode — click to switch to plan'}>
                <Chip
                  label={policy.mode === 'apply' ? 'LIVE' : 'PLAN'}
                  size="small"
                  onClick={() => setModeDialog(true)}
                  sx={{
                    height: 18,
                    fontSize: 10,
                    cursor: 'pointer',
                    bgcolor: policy.mode === 'apply' ? 'rgba(245,158,11,0.18)' : 'rgba(59,130,246,0.18)',
                    color: policy.mode === 'apply' ? 'warning.main' : 'info.main',
                    '&:hover': { opacity: 0.75 },
                  }}
                />
              </Tooltip>

              {!policy.enabled && (
                <Chip
                  label="Disabled"
                  size="small"
                  sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(255,255,255,0.07)' }}
                />
              )}

              {/* Conflict tag chips */}
              {policy.conflictTags?.includes('CONFLICT') && (
                <Chip
                  label="⚠ CONFLICT"
                  size="small"
                  sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(245,158,11,0.18)', color: 'warning.main' }}
                />
              )}
              {policy.conflictTags?.includes('ABSORBED') && (
                <Chip
                  label="ABSORBED"
                  size="small"
                  sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(59,130,246,0.18)', color: 'info.main' }}
                />
              )}
              {policy.conflictTags?.includes('NO-OP') && (
                <Chip
                  label="NO-OP"
                  size="small"
                  sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(239,68,68,0.18)', color: 'error.main' }}
                />
              )}
            </Box>

            {/* Tags */}
            {tags.length > 0 && (
              <Box sx={{ display: 'flex', gap: 0.5, mb: 0.75, flexWrap: 'wrap' }}>
                {tags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    sx={{ height: 16, fontSize: 10, bgcolor: 'rgba(255,255,255,0.07)', color: 'text.secondary' }}
                  />
                ))}
              </Box>
            )}

            {/* Window summary */}
            <Box sx={{ mb: 0.75 }}>
              <WindowSummary policy={policy} />
            </Box>

            {/* Namespace filter + next sleep + next wake + last run */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              {/* Namespace filter */}
              <Tooltip title={namespaces.length > 0 ? `Targets: ${policy.namespaceFilter}` : 'Targets all namespaces'}>
                <Chip
                  label={namespaces.length > 0 ? `${namespaces.length} namespace(s)` : 'All namespaces'}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: 10,
                    bgcolor: namespaces.length > 0 ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.07)',
                    color: namespaces.length > 0 ? 'primary.light' : 'text.secondary',
                  }}
                />
              </Tooltip>

              {/* Next sleep */}
              {nextSleepStr && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <BedtimeIcon sx={{ fontSize: 12, color: 'primary.main' }} />
                  <Typography variant="caption" color="text.secondary">
                    Sleep {nextSleepStr}
                  </Typography>
                  {sleepOverride && (
                    <SkipPill
                      policyId={policy.id}
                      occurrenceDate={sleepOverride.occurrenceDate}
                      edge={sleepOverride.edge}
                      label="SKIPPED"
                    />
                  )}
                </Box>
              )}

              {/* Next wake */}
              {nextWakeStr && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <WbSunnyIcon sx={{ fontSize: 12, color: 'warning.main' }} />
                  <Typography variant="caption" color="text.secondary">
                    Wake {nextWakeStr}
                  </Typography>
                  {wakeOverride && (
                    <SkipPill
                      policyId={policy.id}
                      occurrenceDate={wakeOverride.occurrenceDate}
                      edge={wakeOverride.edge}
                      label="SKIPPED"
                    />
                  )}
                </Box>
              )}

              {/* Last run */}
              {policy.lastExecution && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Chip
                    label={lastStatus}
                    size="small"
                    sx={{
                      height: 16,
                      fontSize: 10,
                      bgcolor: lastStatus === 'success' ? 'rgba(34,197,94,0.12)' :
                               lastStatus === 'failed' ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)',
                      color: lastStatusColor,
                    }}
                  />
                  <Typography variant="caption" color="text.disabled">
                    {timeAgo(policy.lastExecution.finishedAt)}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>

          {/* Action buttons */}
          <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
            <Tooltip title="Run Sleep Now">
              <IconButton
                size="small"
                onClick={() => router.push(`/policies?run=${policy.id}&edge=sleep`)}
                aria-label="Run sleep now"
              >
                <BedtimeIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Run Wake Now">
              <IconButton
                size="small"
                onClick={() => router.push(`/policies?run=${policy.id}&edge=wake`)}
                aria-label="Run wake now"
              >
                <WbSunnyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Edit">
              <IconButton size="small" onClick={onEdit} aria-label="Edit policy">
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton
                size="small"
                color="error"
                onClick={() => setDeleteDialog(true)}
                aria-label="Delete policy"
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Paper>

      {/* Mode activation dialog */}
      <Dialog
        open={modeDialog}
        onClose={() => setModeDialog(false)}
        PaperProps={{ sx: { bgcolor: 'background.paper', minWidth: 360 } }}
      >
        {policy.mode === 'plan' ? (
          <>
            <DialogTitle fontWeight={700}>Activate &ldquo;{policy.name}&rdquo;</DialogTitle>
            <DialogContent>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Switching to Live mode means this policy will make real changes to your cluster on its next scheduled run.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Run a dry-run first to verify the schedule is correct:
              </Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={<PlayArrowIcon sx={{ fontSize: 14 }} />}
                onClick={() => { setModeDialog(false); router.push(`/policies?run=${policy.id}&edge=sleep`) }}
                sx={{ mt: 1.5, borderColor: 'rgba(255,255,255,0.15)', color: 'text.secondary' }}
              >
                Run Plan Now
              </Button>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setModeDialog(false)} sx={{ color: 'text.secondary' }}>
                Keep as Plan
              </Button>
              <Button
                variant="contained"
                color="warning"
                disabled={toggleMode.isPending}
                startIcon={toggleMode.isPending ? <CircularProgress size={14} /> : undefined}
                onClick={() => toggleMode.mutate()}
              >
                Go Live →
              </Button>
            </DialogActions>
          </>
        ) : (
          <>
            <DialogTitle fontWeight={700}>Switch to Plan mode?</DialogTitle>
            <DialogContent>
              <Typography variant="body2" color="text.secondary">
                Scheduled runs for <strong>{policy.name}</strong> will stop making real changes
                and will dry-run instead. You can switch back to Live at any time.
              </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setModeDialog(false)} sx={{ color: 'text.secondary' }}>Cancel</Button>
              <Button
                variant="outlined"
                disabled={toggleMode.isPending}
                startIcon={toggleMode.isPending ? <CircularProgress size={14} /> : undefined}
                onClick={() => toggleMode.mutate()}
              >
                Switch to Plan
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog
        open={deleteDialog}
        onClose={() => setDeleteDialog(false)}
        PaperProps={{ sx: { bgcolor: 'background.paper', minWidth: 320 } }}
      >
        <DialogTitle fontWeight={700}>Delete Policy?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to delete <strong>{policy.name}</strong>? This will also remove all windows and overrides.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialog(false)} sx={{ color: 'text.secondary' }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteConfirm}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Undo snackbar */}
      <Snackbar
        open={undoOpen}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        autoHideDuration={DELETE_DELAY_MS}
        onClose={(_, reason) => { if (reason !== 'clickaway') setUndoOpen(false) }}
      >
        <Alert
          severity="info"
          action={
            <Button color="inherit" size="small" onClick={handleUndo}>
              UNDO
            </Button>
          }
          sx={{ width: '100%' }}
        >
          &quot;{policy.name}&quot; will be deleted in 5s
        </Alert>
      </Snackbar>
    </>
  )
}
