'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import CircularProgress from '@mui/material/CircularProgress'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import Brightness4Icon from '@mui/icons-material/Brightness4'
import { getWorkloads, getNodes, getSchedules, triggerRun } from '@/lib/api'
import { useRouter } from 'next/navigation'

type TriggerType = 'scale_down' | 'scale_up'

export default function ClusterStatusCard() {
  const qc = useQueryClient()
  const router = useRouter()

  const { data: workloads = [] } = useQuery({ queryKey: ['workloads'], queryFn: getWorkloads })
  const { data: nodes = [] } = useQuery({ queryKey: ['nodes'], queryFn: getNodes })
  const { data: schedules = [] } = useQuery({ queryKey: ['schedules'], queryFn: getSchedules })

  const [dialog, setDialog] = useState<{ open: boolean; type: TriggerType } | null>(null)
  const [mode, setMode] = useState<'plan' | 'apply'>('plan')
  const [triggerError, setTriggerError] = useState<string | null>(null)

  const trigger = useMutation({
    mutationFn: ({ type, m }: { type: TriggerType; m: 'plan' | 'apply' }) => {
      const sc = schedules.find((s) => s.type === type)
      if (!sc) throw new Error(`No ${type} schedule found`)
      return triggerRun(sc.id, m)
    },
    onSuccess: () => {
      setDialog(null)
      qc.invalidateQueries({ queryKey: ['executions'] })
      router.push('/history/')
    },
    onError: (err: unknown) => {
      setDialog(null)
      setTriggerError(err instanceof Error ? err.message : 'Trigger failed')
    },
  })

  const sleeping = workloads.filter((w) => w.status === 'sleeping').length
  const running = workloads.filter((w) => w.status === 'running').length
  const activeNodes = nodes.length

  const isPartial = sleeping > 0 && running > 0
  const isSleeping = sleeping > 0 && running === 0

  const statusColor = isSleeping ? '#F59E0B' : isPartial ? '#F97316' : '#22C55E'
  const statusLabel = isSleeping ? 'Cluster Sleeping' : isPartial ? 'Partially Sleeping' : 'Cluster Awake'
  const StatusIcon = isSleeping ? BedtimeIcon : isPartial ? Brightness4Icon : WbSunnyIcon

  return (
    <>
      <Card sx={{ height: '100%' }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" mb={2}>
            CLUSTER STATUS
          </Typography>

          {/* Status indicator */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: statusColor,
                boxShadow: `0 0 8px ${statusColor}`,
                flexShrink: 0,
              }}
            />
            <StatusIcon sx={{ fontSize: 18, color: statusColor }} />
            <Typography variant="h6" fontWeight={700}>
              {statusLabel}
            </Typography>
          </Box>

          {/* Stats row */}
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 3 }}>
            <Chip
              label={`${activeNodes} Nodes Active`}
              size="small"
              onClick={() => router.push('/cluster/?tab=nodes')}
              sx={{ bgcolor: 'rgba(34,197,94,0.1)', color: 'success.main', fontWeight: 600, cursor: 'pointer' }}
            />
            <Chip
              label={`${running} Workloads Running`}
              size="small"
              onClick={() => router.push('/cluster/')}
              sx={{ bgcolor: 'rgba(59,130,246,0.1)', color: 'info.main', fontWeight: 600, cursor: 'pointer' }}
            />
            <Chip
              label={`${sleeping} Workloads Sleeping`}
              size="small"
              onClick={() => router.push('/cluster/')}
              sx={{ bgcolor: 'rgba(245,158,11,0.1)', color: 'warning.main', fontWeight: 600, cursor: 'pointer' }}
            />
          </Box>

          {/* Action buttons */}
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              variant="outlined"
              startIcon={<BedtimeIcon fontSize="small" />}
              onClick={() => { setMode('plan'); setDialog({ open: true, type: 'scale_down' }) }}
              sx={{ borderColor: 'rgba(255,255,255,0.15)', color: 'text.secondary' }}
            >
              Run Sleep Now
            </Button>
            <Button
              variant="outlined"
              startIcon={<WbSunnyIcon fontSize="small" />}
              onClick={() => { setMode('plan'); setDialog({ open: true, type: 'scale_up' }) }}
              sx={{ borderColor: 'rgba(255,255,255,0.15)', color: 'text.secondary' }}
            >
              Run Wake Now
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Trigger dialog */}
      <Dialog
        open={dialog?.open ?? false}
        onClose={() => setDialog(null)}
        PaperProps={{ sx: { bgcolor: 'background.paper', minWidth: 360 } }}
      >
        <DialogTitle fontWeight={700}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {dialog?.type === 'scale_down'
              ? <BedtimeIcon sx={{ color: 'primary.main', fontSize: 20 }} />
              : <WbSunnyIcon sx={{ color: 'warning.main', fontSize: 20 }} />}
            {dialog?.type === 'scale_down' ? 'Run Sleep' : 'Run Wake'}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Choose execution mode:
          </Typography>
          <ToggleButtonGroup
            value={mode}
            exclusive
            onChange={(_, v) => v && setMode(v)}
            fullWidth
            size="small"
          >
            <ToggleButton value="plan" sx={{ fontWeight: 600 }}>
              Plan (dry-run)
            </ToggleButton>
            <ToggleButton
              value="apply"
              sx={{ fontWeight: 600, '&.Mui-selected': { bgcolor: 'rgba(245,158,11,0.2)', color: 'warning.main' } }}
            >
              Apply (live)
            </ToggleButton>
          </ToggleButtonGroup>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialog(null)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={trigger.isPending}
            startIcon={trigger.isPending ? <CircularProgress size={14} /> : undefined}
            onClick={() => dialog && trigger.mutate({ type: dialog.type, m: mode })}
          >
            Run
          </Button>
        </DialogActions>
      </Dialog>

      {/* Trigger error snackbar */}
      <Snackbar
        open={triggerError !== null}
        autoHideDuration={6000}
        onClose={() => setTriggerError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setTriggerError(null)} sx={{ width: '100%' }}>
          {triggerError}
        </Alert>
      </Snackbar>
    </>
  )
}
