'use client'

import React, { useState } from 'react'
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
        {/* Header row */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
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
            </Box>
            {policy.description && (
              <Typography variant="body2" color="text.secondary" noWrap sx={{ mb: 0.5 }}>
                {policy.description}
              </Typography>
            )}
            {/* Schedule display */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 0.5, alignItems: 'center' }}>
              {policy.sleepWindows && policy.sleepWindows.length > 0 ? (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <BedtimeIcon sx={{ fontSize: 13, color: '#a5b4fc' }} />
                    <Typography variant="caption" color="text.secondary">
                      {windowsToText(policy.sleepWindows)}
                    </Typography>
                  </Box>
                  <MiniTimeline windows={policy.sleepWindows} width={200} height={28} timezone={policy.timezone} />
                </>
              ) : null}
              {/* Next transition — state-aware */}
              {policy.currentState === 'sleeping' && policy.nextTransitionAt && (
                <Typography variant="caption" color="text.disabled">
                  wake {fmtNext(policy.nextTransitionAt)}
                </Typography>
              )}
              {policy.currentState === 'awake' && policy.nextTransitionAt && (
                <Typography variant="caption" color="text.disabled">
                  sleep {fmtNext(policy.nextTransitionAt)}
                </Typography>
              )}
              {policy.timezone && policy.timezone !== 'UTC' && (
                <Typography variant="caption" color="text.disabled">{policy.timezone}</Typography>
              )}
              {policy.namespaceFilter && (
                <Tooltip title={`Namespaces: ${policy.namespaceFilter}`}>
                  <Chip
                    label={`${policy.namespaceFilter.split(',').length} ns`}
                    size="small"
                    sx={{ height: 16, fontSize: 10, bgcolor: 'rgba(124,58,237,0.12)', color: 'primary.light' }}
                  />
                </Tooltip>
              )}
            </Box>
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
