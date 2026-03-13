'use client'

import { useRef, useState } from 'react'
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
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import CircularProgress from '@mui/material/CircularProgress'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import { updateSchedule, deleteSchedule, triggerRun } from '@/lib/api'
import { cronToText } from '@/lib/cronToText'
import type { Schedule } from '@/lib/types'

const DELETE_DELAY_MS = 5000

export default function ScheduleCard({
  schedule,
  onEdit,
  onDelete,
}: {
  schedule: Schedule
  onEdit: () => void
  onDelete: () => void
}) {
  const qc = useQueryClient()
  const router = useRouter()
  const [runDialog, setRunDialog] = useState(false)
  const [runMode, setRunMode] = useState<'plan' | 'apply'>('plan')
  const [deleteDialog, setDeleteDialog] = useState(false)
  const [undoOpen, setUndoOpen] = useState(false)
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toggleEnabled = useMutation({
    mutationFn: () => updateSchedule(schedule.id, { enabled: !schedule.enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
  })

  const trigger = useMutation({
    mutationFn: () => triggerRun(schedule.id, runMode),
    onSuccess: () => {
      setRunDialog(false)
      qc.invalidateQueries({ queryKey: ['executions'] })
      router.push('/history/')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteSchedule(schedule.id),
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

  const isSleep = schedule.type === 'scale_down'

  return (
    <>
      <Paper
        sx={{
          p: 2.5,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
        }}
      >
        {/* Enable toggle */}
        <Switch
          checked={schedule.enabled}
          onChange={() => toggleEnabled.mutate()}
          color="primary"
          size="small"
        />

        {/* Main info */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography variant="body1" fontWeight={600}>
              {schedule.name}
            </Typography>
            <Chip
              label={schedule.mode.toUpperCase()}
              size="small"
              sx={{
                height: 18,
                fontSize: 10,
                bgcolor: schedule.mode === 'apply' ? 'rgba(245,158,11,0.18)' : 'rgba(59,130,246,0.18)',
                color: schedule.mode === 'apply' ? 'warning.main' : 'info.main',
              }}
            />
            {!schedule.enabled && (
              <Chip
                label="Disabled"
                size="small"
                sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(255,255,255,0.07)' }}
              />
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary">
              {cronToText(schedule.cronExpr)}
            </Typography>
            <Typography variant="caption" color="text.disabled" fontFamily="monospace">
              {schedule.cronExpr}
            </Typography>
            <Typography variant="caption" color="text.disabled">
              {schedule.timezone}
            </Typography>
            {schedule.namespaceFilter && (
              <Tooltip title={`Targets: ${schedule.namespaceFilter}`}>
                <Chip
                  label={`${schedule.namespaceFilter.split(',').length} namespace(s)`}
                  size="small"
                  sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(124,58,237,0.12)', color: 'primary.light' }}
                />
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
          <Tooltip title="Run Now">
            <IconButton size="small" onClick={() => setRunDialog(true)}>
              <PlayArrowIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={onEdit}>
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => setDeleteDialog(true)}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>

      {/* Run Now dialog */}
      <Dialog
        open={runDialog}
        onClose={() => setRunDialog(false)}
        PaperProps={{ sx: { bgcolor: 'background.paper', minWidth: 340 } }}
      >
        <DialogTitle fontWeight={700}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isSleep
              ? <BedtimeIcon sx={{ color: 'primary.main', fontSize: 20 }} />
              : <WbSunnyIcon sx={{ color: 'warning.main', fontSize: 20 }} />}
            {isSleep ? 'Run Sleep Now' : 'Run Wake Now'} — {schedule.name}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Select execution mode for this one-time run:
          </Typography>
          <ToggleButtonGroup
            value={runMode}
            exclusive
            onChange={(_, v) => v && setRunMode(v)}
            fullWidth
            size="small"
          >
            <ToggleButton value="plan">Plan (dry-run)</ToggleButton>
            <ToggleButton
              value="apply"
              sx={{ '&.Mui-selected': { bgcolor: 'rgba(245,158,11,0.2)', color: 'warning.main' } }}
            >
              Apply (live)
            </ToggleButton>
          </ToggleButtonGroup>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRunDialog(false)} sx={{ color: 'text.secondary' }}>Cancel</Button>
          <Button
            variant="contained"
            disabled={trigger.isPending}
            startIcon={trigger.isPending ? <CircularProgress size={14} /> : undefined}
            onClick={() => trigger.mutate()}
          >
            Run
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog
        open={deleteDialog}
        onClose={() => setDeleteDialog(false)}
        PaperProps={{ sx: { bgcolor: 'background.paper', minWidth: 320 } }}
      >
        <DialogTitle fontWeight={700}>Delete Schedule?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to delete <strong>{schedule.name}</strong>?
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
          &quot;{schedule.name}&quot; will be deleted in 5s
        </Alert>
      </Snackbar>
    </>
  )
}
