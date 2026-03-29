import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'

export type TriggerDirection = 'sleep' | 'wake'

export interface TriggerModeDialogProps {
  open: boolean
  direction: TriggerDirection
  policyName?: string
  onConfirm: (mode: 'plan' | 'apply') => void
  onClose: () => void
}

export default function TriggerModeDialog({
  open,
  direction,
  policyName,
  onConfirm,
  onClose,
}: TriggerModeDialogProps) {
  const [hoverApply, setHoverApply] = useState(false)
  const isSleep = direction === 'sleep'
  const DirectionIcon = isSleep ? BedtimeIcon : WbSunnyIcon
  const label = isSleep ? 'Sleep' : 'Wake'

  return (
    <Dialog
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { bgcolor: 'background.paper', minWidth: 380, maxWidth: 440 } } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700, pb: 0.5 }}>
        <DirectionIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
        {label} Now
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {policyName && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Policy: <strong>{policyName}</strong>
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary">
          Choose how to run this action:
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2 }}>
          {/* Plan (dry-run) option */}
          <Button
            fullWidth
            variant="outlined"
            onClick={() => { onClose(); onConfirm('plan') }}
            startIcon={<VisibilityOutlinedIcon />}
            sx={{
              justifyContent: 'flex-start',
              textAlign: 'left',
              py: 1.5,
              px: 2,
              borderColor: 'divider',
              color: 'text.primary',
              textTransform: 'none',
              '&:hover': {
                borderColor: 'info.main',
                bgcolor: 'rgba(59,130,246,0.06)',
              },
            }}
          >
            <Box>
              <Typography variant="subtitle2" fontWeight={600}>Plan (dry-run)</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                Preview what would change — no resources affected
              </Typography>
            </Box>
          </Button>

          {/* Apply option */}
          <Button
            fullWidth
            variant="outlined"
            onMouseEnter={() => setHoverApply(true)}
            onMouseLeave={() => setHoverApply(false)}
            onClick={() => { onClose(); onConfirm('apply') }}
            startIcon={<PlayArrowIcon />}
            sx={{
              justifyContent: 'flex-start',
              textAlign: 'left',
              py: 1.5,
              px: 2,
              borderColor: 'divider',
              color: 'text.primary',
              textTransform: 'none',
              transition: 'all 0.15s ease',
              '&:hover': {
                borderColor: 'warning.main',
                bgcolor: 'rgba(245,158,11,0.08)',
                color: 'warning.dark',
                '& .MuiButton-startIcon': { color: 'warning.main' },
              },
            }}
          >
            <Box>
              <Typography
                variant="subtitle2"
                fontWeight={600}
                sx={{ transition: 'color 0.15s ease', color: hoverApply ? 'warning.dark' : 'text.primary' }}
              >
                Apply (live)
              </Typography>
              <Typography
                variant="caption"
                sx={{ display: 'block', mt: 0.25, transition: 'color 0.15s ease', color: hoverApply ? 'warning.dark' : 'text.secondary' }}
              >
                Execute immediately — workloads will be scaled
              </Typography>
            </Box>
          </Button>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
      </DialogActions>
    </Dialog>
  )
}
