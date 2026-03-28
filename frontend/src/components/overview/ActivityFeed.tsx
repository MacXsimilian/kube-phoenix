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
import { getPolicyExecutions } from '@/lib/api'
import type { PolicyExecution } from '@/lib/types'
import { timeAgo } from '@/lib/formatters'
import { useColors } from '@/lib/colors'
import { ACTIVITY_FEED_STALE_MS, ACTIVITY_FEED_REFETCH_MS } from '@/lib/constants'
import StatusChip from '@/components/shared/StatusChip'
import LogViewer from '@/components/history/LogViewer'
import { useIsDark } from '@/lib/useIsDark'
import { getModeStyle } from '@/lib/statusColors'

const livePulseAnimation = {
  animation: 'livePulse 1.8s ease-in-out infinite',
  '@keyframes livePulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.2 } },
} as const

export default function ActivityFeed() {
  const router = useRouter()
  const colors = useColors()
  const isDark = useIsDark()
  const [selected, setSelected] = useState<PolicyExecution | null>(null)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['policy-executions', 'feed'],
    queryFn: () => getPolicyExecutions({ pageSize: 3 }),
    staleTime: ACTIVITY_FEED_STALE_MS,
    refetchInterval: ACTIVITY_FEED_REFETCH_MS,
  })

  return (
    <>
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">
            RECENT ACTIVITY
          </Typography>
          <ButtonBase
            onClick={() => router.push('/history/')}
            aria-label="View all executions"
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

        {!isLoading && !!data?.items?.length && <List disablePadding>
          {data.items.map((exec) => (
            <ListItemButton
              key={exec.id}
              onClick={() => setSelected(exec)}
              aria-label={`View logs for execution #${exec.id}`}
              sx={{ borderRadius: 2, px: 1.5, py: 1, mb: 0.5 }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 1.5,
                  bgcolor: exec.direction === 'sleep'
                    ? 'rgba(124,58,237,0.12)'
                    : 'rgba(245,158,11,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mr: 1.5,
                  flexShrink: 0,
                }}
              >
                {exec.direction === 'sleep' ? (
                  <BedtimeIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                ) : (
                  <WbSunnyIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                )}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" fontWeight={500}>
                    {exec.direction === 'sleep' ? 'Sleep' : 'Wake'} #{exec.id}
                  </Typography>
                  <StatusChip status={exec.status} />
                  <Chip
                    label={exec.mode.toUpperCase()}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: 10,
                      bgcolor: getModeStyle(isDark, exec.mode).bg,
                      color: getModeStyle(isDark, exec.mode).color,
                    }}
                  />
                </Box>
                {exec.status === 'running' ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Typography variant="caption" color="text.secondary">
                      Started {timeAgo(exec.startedAt)}
                    </Typography>
                    <Box sx={{
                      width: 7, height: 7, borderRadius: '50%', bgcolor: colors.cyan, flexShrink: 0,
                      ...livePulseAnimation,
                    }} />
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="caption" color="text.secondary">
                      {exec.direction === 'wake'
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
        </List>}
      </CardContent>
    </Card>

    <LogViewer execution={selected} onClose={() => setSelected(null)} />
    </>
  )
}
