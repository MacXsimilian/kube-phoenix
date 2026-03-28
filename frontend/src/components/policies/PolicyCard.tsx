'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { useIsDark } from '@/lib/useIsDark'
import { deletePolicy } from '@/lib/api'
import type { Policy, SnackMessage } from '@/lib/types'
import { windowsToText, hasSleepWindows } from '@/lib/windowUtils'
import { stateColors, modeColors, SMALL_CHIP_SX, CARD_HEADER_GRADIENTS, LED_COLORS } from '@/lib/statusColors'
import { timeUntil } from '@/lib/formatters'
import { usePolicyTriggers } from '@/lib/usePolicyTriggers'
import { useColors } from '@/lib/colors'
import MiniTimeline from './MiniTimeline'

// ── Constants ────────────────────────────────────────────────────────────────

const DISABLED_OPACITY = 0.45

const LED_PULSE_KEYFRAMES = {
  '0%, 100%': { boxShadow: '0 0 4px rgba(252,211,77,0.4)' },
  '50%': { boxShadow: '0 0 14px rgba(252,211,77,0.75), 0 0 28px rgba(252,211,77,0.25)' },
} as const

const STAT_VALUE_SX = { fontSize: 13, lineHeight: 1.3 } as const

const ACTION_BTN_SX_DARK = {
  width: 40,
  height: 40,
  borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.07)',
  bgcolor: 'rgba(255,255,255,0.03)',
  color: '#94A3B8',
  '&:hover': {
    bgcolor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
} as const

const ACTION_BTN_SX_LIGHT = {
  width: 40,
  height: 40,
  borderRadius: '8px',
  border: '1px solid rgba(0,0,0,0.09)',
  bgcolor: 'rgba(0,0,0,0.03)',
  color: '#475569',
  '&:hover': {
    bgcolor: 'rgba(0,0,0,0.06)',
    borderColor: 'rgba(0,0,0,0.12)',
  },
} as const

// ── Helpers ──────────────────────────────────────────────────────────────────

function nextTransitionLabel(policy: Policy): string {
  if (!policy.nextTransitionAt) return '—'
  const relative = timeUntil(policy.nextTransitionAt)
  if (policy.currentState === 'sleeping') return `Wake ${relative}`
  if (policy.currentState === 'awake') return `Sleep ${relative}`
  return relative
}

// ── Delete confirmation sub-component ────────────────────────────────────────

function DeletePolicyDialog({
  open,
  policyName,
  isPending,
  onClose,
  onConfirm,
}: {
  open: boolean
  policyName: string
  isPending: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { bgcolor: 'background.paper', minWidth: 320 } } }}
    >
      <DialogTitle fontWeight={700}>Delete Policy?</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          Delete <strong>{policyName}</strong>? All associated executions and snapshots will be retained.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
        <Button
          variant="contained"
          color="error"
          disabled={isPending}
          onClick={() => { onClose(); onConfirm() }}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export default function PolicyCard({
  policy,
  onEdit,
  onNotify,
  canEdit = true,
  canTrigger = true,
}: {
  policy: Policy
  onEdit: () => void
  onNotify?: (msg: string, severity: SnackMessage['severity']) => void
  canEdit?: boolean
  canTrigger?: boolean
}) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const isDark = useIsDark()
  const [deleteDialog, setDeleteDialog] = useState(false)
  const STATE_COLORS = stateColors(isDark)
  const MODE_COLORS = modeColors(isDark)
  const stateStyle = STATE_COLORS[policy.currentState] ?? STATE_COLORS.unknown
  const led = LED_COLORS[policy.currentState] ?? LED_COLORS.unknown
  const { sleepMut, wakeMut, isBusy } = usePolicyTriggers(policy.id, onNotify)
  const colors = useColors()

  const actionBtnSx = isDark ? ACTION_BTN_SX_DARK : ACTION_BTN_SX_LIGHT

  const deleteMut = useMutation({
    mutationFn: () => deletePolicy(policy.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] })
      onNotify?.(`"${policy.name}" deleted`, 'success')
    },
    onError: (err: unknown) => {
      onNotify?.(err instanceof Error ? err.message : 'Delete failed', 'error')
    },
  })

  const isDisabled = !policy.enabled
  const windows = policy.sleepWindows ?? []

  const sleepIconColor = isDark ? '#a5b4fc' : '#4F46E5'
  const wakeIconColor = isDark ? '#fcd34d' : '#92400E'

  return (
    <>
      <Paper
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '12px',
          overflow: 'hidden',
          opacity: isDisabled ? DISABLED_OPACITY : 1,
          '&:hover': {
            borderColor: 'rgba(124,58,237,0.3)',
            boxShadow: isDark ? '0 0 0 1px rgba(124,58,237,0.08), 0 4px 24px rgba(0,0,0,0.3)' : '0 0 0 1px rgba(124,58,237,0.08), 0 4px 24px rgba(0,0,0,0.08)',
          },
          transition: 'border-color 0.2s, box-shadow 0.2s, opacity 0.2s',
          p: 0,
        }}
      >
        {/* Gradient header bar */}
        <Box
          sx={{
            height: 3,
            background: CARD_HEADER_GRADIENTS[policy.currentState] ?? CARD_HEADER_GRADIENTS.unknown,
            flexShrink: 0,
          }}
        />

        <Box sx={{ display: 'flex', alignItems: 'stretch' }}>
          {/* Main content — left 70% + right 30% stats */}
          <Box sx={{ flex: 1, minWidth: 0, p: '14px 20px', display: 'flex', gap: 2 }}>
            {/* Left column: name, chips, schedule, timeline */}
            <Box sx={{ flex: 70, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                <Box
                  title={policy.currentState}
                  aria-label={policy.currentState}
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    flexShrink: 0,
                    bgcolor: led.bg,
                    boxShadow: led.glow !== 'none' ? `0 0 8px ${led.glow}` : undefined,
                    ...(policy.currentState === 'transitioning' && {
                      animation: 'led-pulse 1.5s ease-in-out infinite',
                      '@keyframes led-pulse': LED_PULSE_KEYFRAMES,
                    }),
                  }}
                />
                <Typography variant="body1" fontWeight={600} noWrap sx={{ fontSize: 15, color: 'text.primary' }}>
                  {policy.name}
                </Typography>
                <Chip
                  label={stateStyle.label}
                  size="small"
                  sx={{ ...SMALL_CHIP_SX, bgcolor: stateStyle.bg, color: stateStyle.color }}
                />
                <Chip
                  label={policy.mode.toUpperCase()}
                  size="small"
                  sx={{
                    ...SMALL_CHIP_SX,
                    bgcolor: (MODE_COLORS[policy.mode] ?? MODE_COLORS.plan).bg,
                    color: (MODE_COLORS[policy.mode] ?? MODE_COLORS.plan).color,
                  }}
                />
                {isDisabled && (
                  <Chip label="Disabled" size="small" sx={{ ...SMALL_CHIP_SX, bgcolor: 'action.selected' }} />
                )}
                {policy.namespaceFilter && (
                  <Chip
                    label={`${policy.namespaceFilter.split(',').length} ns`}
                    size="small"
                    sx={{ ...SMALL_CHIP_SX, color: colors.muted, bgcolor: 'divider' }}
                  />
                )}
              </Box>

              {hasSleepWindows(windows) && (
                <Typography variant="body2" sx={{ fontSize: 12, color: colors.muted, mb: 1 }}>
                  {windowsToText(windows)}
                </Typography>
              )}

              {hasSleepWindows(windows) && (
                <MiniTimeline windows={windows} height={48} timezone={policy.timezone} />
              )}
            </Box>

            {/* Right column: State / Next / TZ */}
            <Box
              sx={{
                minWidth: 120,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: 0.75,
                pl: 2,
                borderLeft: '1px solid',
                borderLeftColor: 'divider',
              }}
            >
              <Box>
                <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.3 }}>State</Typography>
                <Typography sx={{ ...STAT_VALUE_SX, color: stateStyle.color, fontWeight: 600 }}>
                  {stateStyle.label}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.3 }}>Next</Typography>
                <Typography sx={{ ...STAT_VALUE_SX, color: 'text.primary' }}>
                  {nextTransitionLabel(policy)}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.3 }}>TZ</Typography>
                <Typography sx={{ ...STAT_VALUE_SX, color: 'text.primary' }}>
                  {policy.timezone || 'UTC'}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Vertical action buttons */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 0.5,
              p: 1.5,
              borderLeft: '1px solid',
              borderColor: 'divider',
              flexShrink: 0,
            }}
          >
            <Tooltip title="View details" placement="left">
              <IconButton
                size="small"
                onClick={() => router.push(`/policies/detail/?id=${policy.id}`)}
                aria-label="View policy"
                sx={actionBtnSx}
              >
                <OpenInNewIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={canTrigger ? 'Sleep Now' : 'No permission'} placement="left">
              <span>
                <IconButton
                  size="small"
                  onClick={() => sleepMut.mutate()}
                  disabled={!canTrigger || isBusy}
                  aria-label="Trigger sleep"
                  sx={{ ...actionBtnSx, color: sleepIconColor, '&:hover': { bgcolor: 'rgba(99,102,241,0.15)' } }}
                >
                  {sleepMut.isPending ? <CircularProgress size={14} /> : <BedtimeIcon sx={{ fontSize: 14 }} />}
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={canTrigger ? 'Wake Now' : 'No permission'} placement="left">
              <span>
                <IconButton
                  size="small"
                  onClick={() => wakeMut.mutate()}
                  disabled={!canTrigger || isBusy}
                  aria-label="Trigger wake"
                  sx={{ ...actionBtnSx, color: wakeIconColor, '&:hover': { bgcolor: 'rgba(245,158,11,0.15)' } }}
                >
                  {wakeMut.isPending ? <CircularProgress size={14} /> : <WbSunnyIcon sx={{ fontSize: 14 }} />}
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={canEdit ? 'Edit' : 'No permission'} placement="left">
              <span>
                <IconButton size="small" onClick={onEdit} disabled={!canEdit} aria-label="Edit policy" sx={actionBtnSx}>
                  <EditOutlinedIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={canEdit ? 'Delete' : 'No permission'} placement="left">
              <span>
                <IconButton
                  size="small"
                  onClick={() => setDeleteDialog(true)}
                  disabled={!canEdit}
                  aria-label="Delete policy"
                  sx={{ ...actionBtnSx, color: colors.errorLight, '&:hover': { bgcolor: colors.errorBg } }}
                >
                  <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>
      </Paper>

      <DeletePolicyDialog
        open={deleteDialog}
        policyName={policy.name}
        isPending={deleteMut.isPending}
        onClose={() => setDeleteDialog(false)}
        onConfirm={() => deleteMut.mutate()}
      />
    </>
  )
}
