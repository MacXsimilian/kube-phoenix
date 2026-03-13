'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import Skeleton from '@mui/material/Skeleton'
import ButtonBase from '@mui/material/ButtonBase'
import Tooltip from '@mui/material/Tooltip'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import TouchAppOutlinedIcon from '@mui/icons-material/TouchAppOutlined'
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined'
import SkipNextOutlinedIcon from '@mui/icons-material/SkipNextOutlined'
import { getExecutions } from '@/lib/api'
import type { Execution } from '@/lib/types'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function StatusChip({ status }: { status: Execution['status'] }) {
  const map: Record<string, { label: string; color: 'info' | 'success' | 'error' | 'default' }> = {
    running: { label: 'Running', color: 'info' },
    success: { label: 'Success', color: 'success' },
    failed: { label: 'Failed', color: 'error' },
    skipped: { label: 'Skipped', color: 'default' },
  }
  const { label, color } = map[status] ?? { label: status, color: 'default' }
  return <Chip label={label} color={color} size="small" sx={{ height: 20, fontSize: 11 }} />
}

function ExecTypeIndicator({ type }: { type: Execution['executionType'] }) {
  if (!type || type === 'scheduled') {
    return (
      <Tooltip title="Scheduled">
        <AccessTimeIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
      </Tooltip>
    )
  }
  if (type === 'manual') {
    return (
      <Tooltip title="Manual trigger">
        <TouchAppOutlinedIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
      </Tooltip>
    )
  }
  if (type === 'drift_correction') {
    return (
      <Tooltip title="Drift correction">
        <SyncOutlinedIcon sx={{ fontSize: 12, color: 'info.main' }} />
      </Tooltip>
    )
  }
  if (type === 'skipped') {
    return (
      <Tooltip title="Skipped">
        <SkipNextOutlinedIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
      </Tooltip>
    )
  }
  return null
}

export default function ActivityFeed() {
  const router = useRouter()
  const { data, isLoading } = useQuery({
    queryKey: ['executions', 'feed'],
    queryFn: () => getExecutions({ pageSize: 10 }),
    refetchInterval: 15_000,
  })

  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">
            RECENT ACTIVITY
          </Typography>
          <ButtonBase
            onClick={() => router.push('/history/')}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary', borderRadius: 1, px: 0.5, '&:hover': { color: 'text.primary' } }}
          >
            <Typography variant="caption">View all</Typography>
            <ArrowForwardIcon sx={{ fontSize: 13 }} />
          </ButtonBase>
        </Box>

        {isLoading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} variant="rounded" height={56} />
            ))}
          </Box>
        )}

        {!isLoading && (!data?.items?.length) && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            No executions yet. Run a sleep or wake to get started.
          </Typography>
        )}

        <List disablePadding>
          {data?.items?.map((exec) => (
            <ListItemButton
              key={exec.id}
              onClick={() => router.push(`/history?exec=${exec.id}`)}
              sx={{ borderRadius: 2, px: 1.5, py: 1, mb: 0.5 }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 1.5,
                  bgcolor: exec.action === 'scale_down'
                    ? 'rgba(124,58,237,0.12)'
                    : 'rgba(245,158,11,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mr: 1.5,
                  flexShrink: 0,
                }}
              >
                {exec.action === 'scale_down' ? (
                  <BedtimeIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                ) : (
                  <WbSunnyIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                )}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" fontWeight={500}>
                    {exec.policy?.name ?? 'Unknown'}
                  </Typography>
                  <StatusChip status={exec.status} />
                  <Chip
                    label={exec.mode.toUpperCase()}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: 10,
                      bgcolor: exec.mode === 'apply' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)',
                      color: exec.mode === 'apply' ? 'warning.main' : 'info.main',
                    }}
                  />
                  {exec.executionType && <ExecTypeIndicator type={exec.executionType} />}
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {exec.status === 'running'
                    ? `In progress\u2026 \u00B7 ${timeAgo(exec.startedAt)}`
                    : `Scaled ${exec.countScaled} \u00B7 Drained ${exec.countDrained} \u00B7 Errors ${exec.countErrors} \u00B7 ${timeAgo(exec.startedAt)}`}
                </Typography>
              </Box>
            </ListItemButton>
          ))}
        </List>
      </CardContent>
    </Card>
  )
}
