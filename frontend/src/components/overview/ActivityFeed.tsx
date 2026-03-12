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
import CircularProgress from '@mui/material/CircularProgress'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
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
  const { data, isLoading } = useQuery({
    queryKey: ['executions', 'feed'],
    queryFn: () => getExecutions({ pageSize: 10 }),
    refetchInterval: 15_000,
  })

  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" mb={2}>
          RECENT ACTIVITY
        </Typography>

        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
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
              onClick={() => router.push('/history')}
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
                <Typography variant="caption" color="text.secondary">
                  {`Scaled ${exec.countScaled} · Drained ${exec.countDrained} · Errors ${exec.countErrors}`}
                  {' · '}
                  {timeAgo(exec.startedAt)}
                </Typography>
              </Box>
            </ListItemButton>
          ))}
        </List>
      </CardContent>
    </Card>
  )
}
