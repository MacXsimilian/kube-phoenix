'use client'

import { useState } from 'react'
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
import Alert from '@mui/material/Alert'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { getExecutions } from '@/lib/api'
import type { Execution } from '@/lib/types'
import LogViewer from '@/components/history/LogViewer'

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
  const map = {
    running: { label: 'Running', color: 'info' as const },
    success: { label: 'Success', color: 'success' as const },
    failed: { label: 'Failed', color: 'error' as const },
  }
  const { label, color } = map[status]
  return <Chip label={label} color={color} size="small" sx={{ height: 20, fontSize: 11 }} />
}

export default function ActivityFeed() {
  const router = useRouter()
  const [selected, setSelected] = useState<Execution | null>(null)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['executions', 'feed'],
    queryFn: () => getExecutions({ pageSize: 3 }),
    refetchInterval: 15_000,
  })

  return (
    <>
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

        {isError && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Could not load recent activity — retrying in the background.
          </Alert>
        )}

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
              onClick={() => setSelected(exec)}
              sx={{ borderRadius: 2, px: 1.5, py: 1, mb: 0.5 }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 1.5,
                  bgcolor: exec.schedule?.type === 'scale_down'
                    ? 'rgba(124,58,237,0.12)'
                    : 'rgba(245,158,11,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mr: 1.5,
                  flexShrink: 0,
                }}
              >
                {exec.schedule?.type === 'scale_down' ? (
                  <BedtimeIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                ) : (
                  <WbSunnyIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                )}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" fontWeight={500}>
                    {exec.schedule?.name ?? 'Unknown'}
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
                </Box>
                {exec.status === 'running' ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Typography variant="caption" color="text.secondary">
                      Started {timeAgo(exec.startedAt)}
                    </Typography>
                    <Box sx={{
                      width: 7, height: 7, borderRadius: '50%', bgcolor: '#22D3EE', flexShrink: 0,
                      animation: 'livePulse 1.8s ease-in-out infinite',
                      '@keyframes livePulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.2 } },
                    }} />
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="caption" color="text.secondary">
                      {exec.schedule?.type === 'scale_up'
                        ? `Restored ${exec.countScaled}${exec.countErrors > 0 ? ` · Errors ${exec.countErrors}` : ''}`
                        : `Scaled ${exec.countScaled} · Drained ${exec.countDrained}${exec.countErrors > 0 ? ` · Errors ${exec.countErrors}` : ''}`}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, ml: 1 }}>
                      {timeAgo(exec.startedAt)}
                    </Typography>
                  </Box>
                )}
              </Box>
            </ListItemButton>
          ))}
        </List>
      </CardContent>
    </Card>

    <LogViewer execution={selected} onClose={() => setSelected(null)} />
    </>
  )
}
