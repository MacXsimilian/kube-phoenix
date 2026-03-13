'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import CircularProgress from '@mui/material/CircularProgress'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import { policiesApi } from '@/lib/api'
import type { SleepPolicy } from '@/lib/types'

export default function RunPolicyDialog({
  open,
  policy,
  edge,
  onClose,
}: {
  open: boolean
  policy: SleepPolicy | null
  edge: 'sleep' | 'wake'
  onClose: () => void
}) {
  const qc = useQueryClient()
  const router = useRouter()
  const [mode, setMode] = useState<'plan' | 'apply'>('plan')

  const trigger = useMutation({
    mutationFn: () => {
      if (!policy) throw new Error('No policy selected')
      return edge === 'sleep'
        ? policiesApi.triggerSleep(policy.id, mode)
        : policiesApi.triggerWake(policy.id, mode)
    },
    onSuccess: (data) => {
      onClose()
      qc.invalidateQueries({ queryKey: ['executions'] })
      router.push(`/history?exec=${data.executionId}`)
    },
  })

  if (!policy) return null

  const isSleep = edge === 'sleep'

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { bgcolor: 'background.paper' } }}
    >
      <DialogTitle fontWeight={700}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isSleep
            ? <BedtimeIcon sx={{ color: 'primary.main', fontSize: 20 }} />
            : <WbSunnyIcon sx={{ color: 'warning.main', fontSize: 20 }} />}
          {isSleep ? 'Run Sleep Now' : 'Run Wake Now'} — {policy.name}
        </Box>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Select execution mode for this one-time run:
        </Typography>
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={(_, v) => v && setMode(v)}
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
        {mode === 'apply' && (
          <Alert severity="warning" sx={{ mt: 1.5, py: 0.5 }}>
            Apply mode will make real changes to your cluster.
          </Alert>
        )}
        {trigger.isError && (
          <Alert severity="error" sx={{ mt: 1.5, py: 0.5 }}>
            {trigger.error instanceof Error ? trigger.error.message : 'Failed to trigger run'}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
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
  )
}
