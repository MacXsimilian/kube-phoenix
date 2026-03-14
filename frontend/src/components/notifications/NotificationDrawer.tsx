'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import CloseIcon from '@mui/icons-material/Close'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { useRouter } from 'next/navigation'
import { notificationsApi } from '@/lib/api'
import type { Notification } from '@/lib/types'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function SeverityIcon({ severity }: { severity: Notification['severity'] }) {
  if (severity === 'error') {
    return <ErrorOutlineIcon sx={{ fontSize: 18, color: 'error.main', flexShrink: 0 }} />
  }
  if (severity === 'warning') {
    return <WarningAmberOutlinedIcon sx={{ fontSize: 18, color: 'warning.main', flexShrink: 0 }} />
  }
  return <InfoOutlinedIcon sx={{ fontSize: 18, color: 'info.main', flexShrink: 0 }} />
}

function NotificationItem({
  notification,
  onDismiss,
  onMarkRead,
}: {
  notification: Notification
  onDismiss: (id: number) => void
  onMarkRead: (id: number) => void
}) {
  const router = useRouter()

  function handleClick() {
    if (!notification.read) {
      onMarkRead(notification.id)
    }
  }

  function handleActionLink(e: React.MouseEvent) {
    e.stopPropagation()
    if (!notification.read) onMarkRead(notification.id)
    if (notification.policyId) {
      router.push(`/policies`)
    } else if (notification.executionId) {
      router.push(`/history?exec=${notification.executionId}`)
    }
  }

  const bgColor = notification.read ? 'transparent' : 'rgba(255,255,255,0.03)'

  return (
    <ListItem
      disablePadding
      onClick={handleClick}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
        px: 2,
        py: 1.5,
        bgcolor: bgColor,
        cursor: notification.read ? 'default' : 'pointer',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <SeverityIcon severity={notification.severity} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ lineHeight: 1.5, mb: 0.5 }}>
          {notification.message}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="caption" color="text.disabled">
            {timeAgo(notification.createdAt)}
          </Typography>
          {(notification.policyId || notification.executionId) && (
            <Button
              size="small"
              endIcon={<ArrowForwardIcon sx={{ fontSize: '12px !important' }} />}
              onClick={handleActionLink}
              sx={{
                minWidth: 0,
                p: 0,
                height: 'auto',
                fontSize: 11,
                color: 'text.secondary',
                '&:hover': { color: 'text.primary', bgcolor: 'transparent' },
              }}
            >
              {notification.policyId ? 'View policy' : 'View execution'}
            </Button>
          )}
        </Box>
      </Box>
      <Tooltip title="Dismiss">
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); onDismiss(notification.id) }}
          aria-label="Dismiss notification"
          sx={{ color: 'text.disabled', flexShrink: 0, '&:hover': { color: 'text.secondary' } }}
        >
          <CloseIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>
    </ListItem>
  )
}

export default function NotificationDrawer({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [mutError, setMutError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    refetchInterval: 30_000,
  })

  const onMutError = (err: unknown) =>
    setMutError(err instanceof Error ? err.message : 'Action failed')

  const markRead = useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
    onError: onMutError,
  })

  const dismiss = useMutation({
    mutationFn: (id: number) => notificationsApi.dismiss(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
    onError: onMutError,
  })

  const dismissAll = useMutation({
    mutationFn: notificationsApi.dismissAll,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
    onError: onMutError,
  })

  const notifications = data?.notifications ?? []

  // Sort: errors first, then warnings, then info; unread before read
  const sorted = [...notifications].sort((a, b) => {
    if (a.read !== b.read) return a.read ? 1 : -1
    const sevOrder = { error: 0, warning: 1, info: 2 }
    return sevOrder[a.severity] - sevOrder[b.severity]
  })

  return (
    <>
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100vw', sm: 400 },
          bgcolor: 'background.paper',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2.5,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <Typography variant="subtitle1" fontWeight={700}>
          Notifications
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {notifications.length > 0 && (
            <Button
              size="small"
              onClick={() => dismissAll.mutate()}
              disabled={dismissAll.isPending}
              sx={{ color: 'text.secondary', fontSize: 12 }}
            >
              Dismiss all
            </Button>
          )}
          <IconButton size="small" onClick={onClose} aria-label="Close notifications">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
      <Divider />

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={24} />
          </Box>
        ) : sorted.length === 0 ? (
          <Box sx={{ py: 8, px: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No notifications
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {sorted.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onDismiss={(id) => dismiss.mutate(id)}
                onMarkRead={(id) => markRead.mutate(id)}
              />
            ))}
          </List>
        )}
      </Box>
    </Drawer>
    <Snackbar
      open={mutError !== null}
      autoHideDuration={5000}
      onClose={() => setMutError(null)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert severity="error" onClose={() => setMutError(null)} sx={{ width: '100%' }}>
        {mutError}
      </Alert>
    </Snackbar>
    </>
  )
}
