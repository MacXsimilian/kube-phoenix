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
import { deletePolicy, triggerPolicySleep, triggerPolicyWake } from '@/lib/api'
import type { Policy } from '@/lib/types'
import { windowsToText } from '@/lib/windowUtils'
import { STATE_COLORS, MODE_COLORS, SMALL_CHIP_SX } from '@/lib/statusColors'
import MiniTimeline from './MiniTimeline'

// ── Constants ────────────────────────────────────────────────────────────────

const MS_PER_MINUTE = 60_000
const DISABLED_OPACITY = 0.45

const HEADER_GRADIENTS: Record<string, string> = {
  sleeping:      'linear-gradient(90deg, #7C3AED 0%, #a5b4fc 50%, rgba(165,180,252,0.15) 100%)',
  awake:         'linear-gradient(90deg, #22C55E 0%, #86efac 50%, rgba(134,239,172,0.15) 100%)',
  transitioning: 'linear-gradient(90deg, #F59E0B 0%, #fcd34d 50%, rgba(252,211,77,0.15) 100%)',
  unknown:       'linear-gradient(90deg, #475569 0%, #64748b 40%, rgba(100,116,139,0.1) 100%)',
}

const LED_COLORS: Record<string, { bg: string; glow: string }> = {
  sleeping:      { bg: '#a5b4fc', glow: 'rgba(165,180,252,0.5)' },
  awake:         { bg: '#86efac', glow: 'rgba(134,239,172,0.5)' },
  transitioning: { bg: '#fcd34d', glow: 'rgba(252,211,77,0.5)' },
  unknown:       { bg: '#64748b', glow: 'none' },
}

const ACTION_BTN_SX = {
  width: 32,
  height: 32,
  borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.07)',
  bgcolor: 'rgba(255,255,255,0.03)',
  color: '#94a3b8',
  '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.12)' },
} as const

const STAT_LABEL_SX = { fontSize: 11, color: '#64748b', lineHeight: 1.3 } as const
const STAT_VALUE_SX = { fontSize: 13, lineHeight: 1.3 } as const

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const dateObj = new Date(iso)
  if (isNaN(dateObj.getTime())) return '—'
  const diff = dateObj.getTime() - Date.now()
  if (diff < 0) return 'now'
  const mins = Math.floor(diff / MS_PER_MINUTE)
  if (mins < 60) return `in ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `in ${hrs}h`
  return `in ${Math.floor(hrs / 24)}d`
}

function nextTransitionLabel(policy: Policy): string {
  if (!policy.nextTransitionAt) return '—'
  const relative = formatRelativeTime(policy.nextTransitionAt)
  if (policy.currentState === 'sleeping') return `Wake ${relative}`
  if (policy.currentState === 'awake') return `Sleep ${relative}`
  return relative
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
  onNotify?: (msg: string, severity: 'success' | 'error') => void
  canEdit?: boolean
  canTrigger?: boolean
}) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [deleteDialog, setDeleteDialog] = useState(false)
  const stateStyle = STATE_COLORS[policy.currentState] ?? STATE_COLORS.unknown
  const led = LED_COLORS[policy.currentState] ?? LED_COLORS.unknown

  function onTriggerSuccess({ executionId }: { executionId: number }) {
    queryClient.invalidateQueries({ queryKey: ['policies'] })
    queryClient.invalidateQueries({ queryKey: ['policy-executions'] })
    queryClient.invalidateQueries({ queryKey: ['policy-executions', policy.id] })
    router.push(`/policies/detail/?id=${policy.id}&exec=${executionId}`)
  }

  function onTriggerError(err: unknown, fallback: string) {
    onNotify?.(err instanceof Error ? err.message : fallback, 'error')
  }

  const deleteMut = useMutation({
    mutationFn: () => deletePolicy(policy.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] })
      onNotify?.(`"${policy.name}" deleted`, 'success')
    },
    onError: (err: unknown) => onTriggerError(err, 'Delete failed'),
  })

  const sleepMut = useMutation({
    mutationFn: () => triggerPolicySleep(policy.id),
    onSuccess: onTriggerSuccess,
    onError: (err: unknown) => onTriggerError(err, 'Trigger sleep failed'),
  })

  const wakeMut = useMutation({
    mutationFn: () => triggerPolicyWake(policy.id),
    onSuccess: onTriggerSuccess,
    onError: (err: unknown) => onTriggerError(err, 'Trigger wake failed'),
  })

  const isBusy = sleepMut.isPending || wakeMut.isPending
  const isDisabled = !policy.enabled
  const hasWindows = policy.sleepWindows && policy.sleepWindows.length > 0

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
            boxShadow: '0 0 0 1px rgba(124,58,237,0.08), 0 4px 24px rgba(0,0,0,0.3)',
          },
          transition: 'border-color 0.2s, box-shadow 0.2s, opacity 0.2s',
          p: 0,
        }}
      >
        {/* Gradient header bar */}
        <Box
          sx={{
            height: 3,
            background: HEADER_GRADIENTS[policy.currentState] ?? HEADER_GRADIENTS.unknown,
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
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    flexShrink: 0,
                    bgcolor: led.bg,
                    boxShadow: led.glow !== 'none' ? `0 0 8px ${led.glow}` : undefined,
                    ...(policy.currentState === 'transitioning' && {
                      animation: 'led-pulse 1.5s ease-in-out infinite',
                      '@keyframes led-pulse': {
                        '0%, 100%': { boxShadow: '0 0 4px rgba(252,211,77,0.4)' },
                        '50%': { boxShadow: '0 0 14px rgba(252,211,77,0.75), 0 0 28px rgba(252,211,77,0.25)' },
                      },
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
                    sx={{ ...SMALL_CHIP_SX, color: '#94a3b8', bgcolor: 'rgba(255,255,255,0.06)' }}
                  />
                )}
              </Box>

              {hasWindows && (
                <Typography variant="body2" sx={{ fontSize: 12, color: '#94a3b8', mb: 1 }}>
                  {windowsToText(policy.sleepWindows!)}
                </Typography>
              )}

              {hasWindows && (
                <MiniTimeline windows={policy.sleepWindows!} height={48} timezone={policy.timezone} />
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
                borderLeft: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <Box>
                <Typography sx={STAT_LABEL_SX}>State</Typography>
                <Typography sx={{ ...STAT_VALUE_SX, color: stateStyle.color, fontWeight: 600 }}>
                  {stateStyle.label}
                </Typography>
              </Box>
              <Box>
                <Typography sx={STAT_LABEL_SX}>Next</Typography>
                <Typography sx={{ ...STAT_VALUE_SX, color: 'text.primary' }}>
                  {nextTransitionLabel(policy)}
                </Typography>
              </Box>
              <Box>
                <Typography sx={STAT_LABEL_SX}>TZ</Typography>
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
              borderColor: 'rgba(255,255,255,0.05)',
              flexShrink: 0,
            }}
          >
            <Tooltip title="View details" placement="left">
              <IconButton
                size="small"
                onClick={() => router.push(`/policies/detail/?id=${policy.id}`)}
                aria-label="View policy"
                sx={ACTION_BTN_SX}
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
                  sx={{ ...ACTION_BTN_SX, color: '#a5b4fc', '&:hover': { bgcolor: 'rgba(99,102,241,0.15)' } }}
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
                  sx={{ ...ACTION_BTN_SX, color: '#fcd34d', '&:hover': { bgcolor: 'rgba(245,158,11,0.15)' } }}
                >
                  {wakeMut.isPending ? <CircularProgress size={14} /> : <WbSunnyIcon sx={{ fontSize: 14 }} />}
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={canEdit ? 'Edit' : 'No permission'} placement="left">
              <span>
                <IconButton size="small" onClick={onEdit} disabled={!canEdit} aria-label="Edit policy" sx={ACTION_BTN_SX}>
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
                  sx={{ ...ACTION_BTN_SX, color: '#f87171', '&:hover': { bgcolor: 'rgba(248,113,113,0.12)' } }}
                >
                  <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>
      </Paper>

      <Dialog
        open={deleteDialog}
        onClose={() => setDeleteDialog(false)}
        slotProps={{ paper: { sx: { bgcolor: 'background.paper', minWidth: 320 } } }}
      >
        <DialogTitle fontWeight={700}>Delete Policy?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Delete <strong>{policy.name}</strong>? All associated executions and snapshots will be retained.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialog(false)} sx={{ color: 'text.secondary' }}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            disabled={deleteMut.isPending}
            onClick={() => { setDeleteDialog(false); deleteMut.mutate() }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
