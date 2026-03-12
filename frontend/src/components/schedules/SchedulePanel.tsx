'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import CircularProgress from '@mui/material/CircularProgress'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import SaveIcon from '@mui/icons-material/Save'
import { updateSchedule, triggerRun } from '@/lib/api'
import { cronToText } from '@/lib/cronToText'
import type { Schedule } from '@/lib/types'

const TIMEZONES = [
  'UTC', 'Europe/Budapest', 'Europe/London', 'Europe/Berlin', 'Europe/Paris',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Asia/Tokyo', 'Asia/Singapore', 'Asia/Shanghai', 'Australia/Sydney',
]

export default function SchedulePanel({ schedule }: { schedule: Schedule }) {
  const qc = useQueryClient()
  const isSleep = schedule.type === 'scale_down'

  const [enabled, setEnabled] = useState(schedule.enabled)
  const [cronExpr, setCronExpr] = useState(schedule.cronExpr)
  const [timezone, setTimezone] = useState(schedule.timezone)
  const [mode, setMode] = useState<'plan' | 'apply'>(schedule.mode)
  const [runDialog, setRunDialog] = useState(false)
  const [runMode, setRunMode] = useState<'plan' | 'apply'>('plan')

  const save = useMutation({
    mutationFn: () => updateSchedule(schedule.id, { enabled, cronExpr, timezone, mode }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
  })

  const trigger = useMutation({
    mutationFn: () => triggerRun(schedule.id, runMode),
    onSuccess: () => {
      setRunDialog(false)
      qc.invalidateQueries({ queryKey: ['executions'] })
    },
  })

  const isDirty =
    enabled !== schedule.enabled ||
    cronExpr !== schedule.cronExpr ||
    timezone !== schedule.timezone ||
    mode !== schedule.mode

  return (
    <>
      <Card>
        <CardContent sx={{ p: 3 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                bgcolor: isSleep ? 'rgba(124,58,237,0.15)' : 'rgba(245,158,11,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isSleep ? (
                <BedtimeIcon sx={{ color: 'primary.main' }} />
              ) : (
                <WbSunnyIcon sx={{ color: 'warning.main' }} />
              )}
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" fontWeight={700}>
                {schedule.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {isSleep ? 'Scale down workloads & drain nodes' : 'Restore workloads from annotations'}
              </Typography>
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  color="primary"
                />
              }
              label={enabled ? 'Enabled' : 'Disabled'}
              labelPlacement="start"
              sx={{ mr: 0 }}
            />
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* Cron expression */}
          <Box sx={{ mb: 3 }}>
            <TextField
              label="Cron Expression"
              value={cronExpr}
              onChange={(e) => setCronExpr(e.target.value)}
              fullWidth
              size="small"
              helperText={cronToText(cronExpr)}
              inputProps={{ style: { fontFamily: 'monospace' } }}
            />
          </Box>

          {/* Timezone */}
          <Box sx={{ mb: 3 }}>
            <TextField
              select
              label="Timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              fullWidth
              size="small"
            >
              {TIMEZONES.map((tz) => (
                <MenuItem key={tz} value={tz}>
                  {tz}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          {/* Mode toggle */}
          <Box sx={{ mb: mode === 'apply' ? 2 : 3 }}>
            <Typography variant="caption" color="text.secondary" display="block" mb={1}>
              Execution Mode
            </Typography>
            <ToggleButtonGroup
              value={mode}
              exclusive
              onChange={(_, v) => v && setMode(v)}
              size="small"
              fullWidth
            >
              <ToggleButton value="plan" sx={{ fontWeight: 600 }}>
                Plan (dry-run)
              </ToggleButton>
              <ToggleButton
                value="apply"
                sx={{
                  fontWeight: 600,
                  '&.Mui-selected': { bgcolor: 'rgba(245,158,11,0.18)', color: 'warning.main' },
                }}
              >
                Apply (live)
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {mode === 'apply' && (
            <Alert severity="warning" sx={{ mb: 3, py: 0.5 }}>
              Apply mode will make real changes to your cluster.
            </Alert>
          )}

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              variant="contained"
              startIcon={save.isPending ? <CircularProgress size={14} /> : <SaveIcon fontSize="small" />}
              disabled={!isDirty || save.isPending}
              onClick={() => save.mutate()}
              sx={{ flex: 1 }}
            >
              Save
            </Button>
            <Button
              variant="outlined"
              startIcon={<PlayArrowIcon fontSize="small" />}
              onClick={() => setRunDialog(true)}
              sx={{ borderColor: 'rgba(255,255,255,0.15)' }}
            >
              Run Now
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Run now dialog */}
      <Dialog
        open={runDialog}
        onClose={() => setRunDialog(false)}
        PaperProps={{ sx: { bgcolor: 'background.paper', minWidth: 340 } }}
      >
        <DialogTitle fontWeight={700}>
          {isSleep ? '🌙 Run Sleep Now' : '☀️ Run Wake Now'}
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
          <Button onClick={() => setRunDialog(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
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
    </>
  )
}
