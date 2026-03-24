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
import { windowsToText, computeWeeklyStats } from '@/lib/windowUtils'
import { STATE_COLORS, MODE_COLORS } from '@/lib/statusColors'
import MiniTimeline from './MiniTimeline'

function fmtNext(iso: string | null | undefined): string {
  if (!iso) return '—'
  const dateObj = new Date(iso)
  const now = new Date()
  const diff = dateObj.getTime() - now.getTime()
  if (diff < 0) return 'now'
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `in ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `in ${hrs}h`
  return `in ${Math.floor(hrs / 24)}d`
}

function nextTransitionLabel(policy: Policy): string | null {
  if (!policy.nextTransitionAt) return null
  if (policy.currentState === 'sleeping') return `Wake ${fmtNext(policy.nextTransitionAt)}`
  if (policy.currentState === 'awake') return `Sleep ${fmtNext(policy.nextTransitionAt)}`
  return null
}

const STAT_CAPTION_SX = { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 } as const
const STAT_VALUE_SX = { fontSize: 12, mt: 0.25 } as const

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
  const transitionLabel = nextTransitionLabel(policy)
  const weeklyStats = policy.sleepWindows ? computeWeeklyStats(policy.sleepWindows) : null

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

  const sleepMut = useMutation({
    mutationFn: () => triggerPolicySleep(policy.id),
    onSuccess: ({ executionId }) => {
      queryClient.invalidateQueries({ queryKey: ['policies'] })
      queryClient.invalidateQueries({ queryKey: ['policy-executions'] })
      queryClient.invalidateQueries({ queryKey: ['policy-executions', policy.id] })
      router.push(`/policies/detail/?id=${policy.id}&exec=${executionId}`)
    },
    onError: (err: unknown) => {
      onNotify?.(err instanceof Error ? err.message : 'Trigger sleep failed', 'error')
    },
  })

  const wakeMut = useMutation({
    mutationFn: () => triggerPolicyWake(policy.id),
    onSuccess: ({ executionId }) => {
      queryClient.invalidateQueries({ queryKey: ['policies'] })
      queryClient.invalidateQueries({ queryKey: ['policy-executions'] })
      queryClient.invalidateQueries({ queryKey: ['policy-executions', policy.id] })
      router.push(`/policies/detail/?id=${policy.id}&exec=${executionId}`)
    },
    onError: (err: unknown) => {
      onNotify?.(err instanceof Error ? err.message : 'Trigger wake failed', 'error')
    },
  })

  const isBusy = sleepMut.isPending || wakeMut.isPending

  return (
    <>
      <Paper
        sx={{
          p: 2.5,
          border: '1px solid',
          borderColor: 'divider',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
          transition: 'background-color 0.15s',
        }}
      >
        {/* Row 1: Header — name, badges, actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body1" fontWeight={600} noWrap>
              {policy.name}
            </Typography>
            <Chip
              label={stateStyle.label}
              size="small"
              sx={{ height: 18, fontSize: 10, bgcolor: stateStyle.bg, color: stateStyle.color }}
            />
            <Chip
              label={policy.mode.toUpperCase()}
              size="small"
              sx={{
                height: 18,
                fontSize: 10,
                bgcolor: (MODE_COLORS[policy.mode] ?? MODE_COLORS.plan).bg,
                color: (MODE_COLORS[policy.mode] ?? MODE_COLORS.plan).color,
              }}
            />
            {!policy.enabled && (
              <Chip label="Disabled" size="small" sx={{ height: 18, fontSize: 10, bgcolor: 'action.selected' }} />
            )}
            {policy.description && (
              <Typography variant="body2" color="text.secondary" noWrap sx={{ ml: 1 }}>
                {policy.description}
              </Typography>
            )}
          </Box>

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0, alignItems: 'center' }}>
            <Tooltip title="View details">
              <IconButton size="small" onClick={() => router.push(`/policies/detail/?id=${policy.id}`)} aria-label="View policy">
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={canTrigger ? 'Sleep Now' : 'No permission'}>
              <span>
                <IconButton
                  size="small"
                  onClick={() => sleepMut.mutate()}
                  disabled={!canTrigger || isBusy}
                  aria-label="Trigger sleep"
                  sx={{ color: '#a5b4fc' }}
                >
                  {sleepMut.isPending ? <CircularProgress size={14} /> : <BedtimeIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={canTrigger ? 'Wake Now' : 'No permission'}>
              <span>
                <IconButton
                  size="small"
                  onClick={() => wakeMut.mutate()}
                  disabled={!canTrigger || isBusy}
                  aria-label="Trigger wake"
                  sx={{ color: '#fcd34d' }}
                >
                  {wakeMut.isPending ? <CircularProgress size={14} /> : <WbSunnyIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={canEdit ? 'Edit' : 'No permission'}>
              <span>
                <IconButton size="small" onClick={onEdit} disabled={!canEdit} aria-label="Edit policy">
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={canEdit ? 'Delete' : 'No permission'}>
              <span>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => setDeleteDialog(true)}
                  disabled={!canEdit}
                  aria-label="Delete policy"
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>

        {/* Row 2: Full-width timeline + stats panel */}
        {policy.sleepWindows && policy.sleepWindows.length > 0 && (
          <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
            {/* Timeline — fills available width */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <MiniTimeline windows={policy.sleepWindows} height={36} timezone={policy.timezone} />
            </Box>

            {/* Stats summary panel */}
            <Box sx={{ flexShrink: 0, display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'flex-start', pt: 0.25 }}>
              <Box>
                <Typography variant="caption" color="text.disabled" sx={STAT_CAPTION_SX}>Schedule</Typography>
                <Typography variant="body2" color="text.secondary" sx={STAT_VALUE_SX}>
                  {windowsToText(policy.sleepWindows)}
                </Typography>
              </Box>
              {weeklyStats && (
                <Box>
                  <Typography variant="caption" color="text.disabled" sx={STAT_CAPTION_SX}>Weekly</Typography>
                  <Typography variant="body2" color="text.secondary" sx={STAT_VALUE_SX}>
                    {weeklyStats.sleepHours}h sleep · {weeklyStats.awakeHours}h awake
                  </Typography>
                </Box>
              )}
              {transitionLabel && (
                <Box>
                  <Typography variant="caption" color="text.disabled" sx={STAT_CAPTION_SX}>Next</Typography>
                  <Typography variant="body2" color="text.secondary" sx={STAT_VALUE_SX}>
                    {transitionLabel}
                  </Typography>
                </Box>
              )}
              {policy.timezone && policy.timezone !== 'UTC' && (
                <Box>
                  <Typography variant="caption" color="text.disabled" sx={STAT_CAPTION_SX}>Timezone</Typography>
                  <Typography variant="body2" color="text.secondary" sx={STAT_VALUE_SX}>
                    {policy.timezone}
                  </Typography>
                </Box>
              )}
              {policy.namespaceFilter && (
                <Box>
                  <Typography variant="caption" color="text.disabled" sx={STAT_CAPTION_SX}>Namespaces</Typography>
                  <Tooltip title={policy.namespaceFilter}>
                    <Typography variant="body2" color="text.secondary" sx={STAT_VALUE_SX}>
                      {policy.namespaceFilter.split(',').length} ns
                    </Typography>
                  </Tooltip>
                </Box>
              )}
            </Box>
          </Box>
        )}
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
