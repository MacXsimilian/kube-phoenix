import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import HelpOutlineIcon from '@mui/icons-material/HelpOutlineOutlined'
import { useIsDark } from '@/lib/useIsDark'
import {
  stateColors, getModeStyle, SMALL_CHIP_SX,
  HERO_HEADER_GRADIENTS, subtleBorder,
} from '@/lib/statusColors'
import type { Policy } from '@/lib/types'
import { BLEED_MARGIN_X, BLEED_PADDING_X } from '@/lib/layoutConstants'

const STATE_ICONS: Record<string, React.ReactNode> = {
  sleeping:      <BedtimeIcon sx={{ fontSize: 32 }} />,
  awake:         <WbSunnyIcon sx={{ fontSize: 32 }} />,
  transitioning: <WbSunnyIcon sx={{ fontSize: 32 }} />,
  unknown:       <HelpOutlineIcon sx={{ fontSize: 32 }} />,
}

interface TriggerActions {
  isBusy: boolean
  sleepPending: boolean
  wakePending: boolean
  onSleep: () => void
  onWake: () => void
}

interface PolicyHeroBandProps {
  policy: Policy
  canEdit: boolean
  canTrigger: boolean
  trigger: TriggerActions
  onBack: () => void
  onEdit: () => void
}

export default function PolicyHeroBand({
  policy, canEdit, canTrigger, trigger,
  onBack, onEdit,
}: PolicyHeroBandProps) {
  const { isBusy, sleepPending, wakePending, onSleep, onWake } = trigger
  const isDark = useIsDark()
  const STATE_COLORS = stateColors(isDark)
  const stateStyle = STATE_COLORS[policy.currentState] ?? STATE_COLORS.unknown
  const modeStyle = getModeStyle(isDark, policy.mode)

  return (
    <Box
      sx={{
        mx: BLEED_MARGIN_X,
        px: BLEED_PADDING_X,
        py: { xs: 3, md: 4 },
        background: HERO_HEADER_GRADIENTS[policy.currentState] ?? HERO_HEADER_GRADIENTS.unknown,
        borderBottom: '1px solid',
        borderColor: subtleBorder(isDark),
      }}
    >
      <Box sx={{ mb: 2 }}>
        <IconButton size="small" onClick={onBack} aria-label="Back to policies">
          <ArrowBackIcon />
        </IconButton>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap' }}>
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '20px',
            bgcolor: stateStyle.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: stateStyle.color,
            flexShrink: 0,
          }}
        >
          {STATE_ICONS[policy.currentState] ?? STATE_ICONS.unknown}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h4" noWrap sx={{
            fontWeight: 700
          }}>
            {policy.name}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              mt: 0.25
            }}>
            {policy.description || 'No description'}
            {policy.namespaceFilter && (
              <Typography
                component="span"
                sx={{
                  fontFamily: "monospace",
                  ml: 1,
                  color: 'text.disabled'
                }}>
                {policy.namespaceFilter}
              </Typography>
            )}
          </Typography>
        </Box>

        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              color: stateStyle.color,
              textTransform: 'uppercase',
              lineHeight: 1.2
            }}>
            {stateStyle.label}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 0.5 }}>
            <Chip
              label={policy.mode.toUpperCase()}
              size="small"
              sx={{ ...SMALL_CHIP_SX, bgcolor: modeStyle.bg, color: modeStyle.color }}
            />
            {policy.enabled ? (
              <Chip label="Enabled" size="small" sx={{ ...SMALL_CHIP_SX, bgcolor: STATE_COLORS.awake.bg, color: STATE_COLORS.awake.color }} />
            ) : (
              <Chip label="Disabled" size="small" sx={{ ...SMALL_CHIP_SX, bgcolor: 'action.selected' }} />
            )}
          </Box>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 1.5, mt: 2.5, flexWrap: 'wrap' }}>
        <Tooltip title={canTrigger ? '' : 'No permission'}>
          <span>
            <Button
              variant="contained"
              size="small"
              startIcon={sleepPending ? <CircularProgress size={14} /> : <BedtimeIcon />}
              disabled={!canTrigger || isBusy}
              onClick={onSleep}
              sx={{ bgcolor: STATE_COLORS.sleeping.bg, color: STATE_COLORS.sleeping.color, '&:hover': { bgcolor: 'rgba(99,102,241,0.3)' } }}
            >
              Sleep Now
            </Button>
          </span>
        </Tooltip>
        <Tooltip title={canTrigger ? '' : 'No permission'}>
          <span>
            <Button
              variant="contained"
              size="small"
              startIcon={wakePending ? <CircularProgress size={14} /> : <WbSunnyIcon />}
              disabled={!canTrigger || isBusy}
              onClick={onWake}
              sx={{ bgcolor: STATE_COLORS.awake.bg, color: STATE_COLORS.awake.color, '&:hover': { bgcolor: 'rgba(34,197,94,0.25)' } }}
            >
              Wake Now
            </Button>
          </span>
        </Tooltip>
        {canEdit && (
          <Button size="small" startIcon={<EditOutlinedIcon />} onClick={onEdit}>
            Edit Policy
          </Button>
        )}
      </Box>
    </Box>
  );
}
