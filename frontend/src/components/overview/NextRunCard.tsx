'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import ButtonBase from '@mui/material/ButtonBase'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import Alert from '@mui/material/Alert'
import Skeleton from '@mui/material/Skeleton'
import { getSchedules } from '@/lib/api'
import { cronToText } from '@/lib/cronToText'
import type { Schedule } from '@/lib/types'

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'now'
  const m = Math.floor(diff / 60000)
  if (m < 60) return `in ${m}m`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem > 0 ? `in ${h}h ${rem}m` : `in ${h}h`
}

function ScheduleRow({ schedule }: { schedule: Schedule }) {
  const isSleep = schedule.type === 'scale_down'
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: 2,
          bgcolor: isSleep ? 'rgba(124,58,237,0.15)' : 'rgba(245,158,11,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {isSleep ? (
          <BedtimeIcon sx={{ fontSize: 18, color: 'primary.main' }} />
        ) : (
          <WbSunnyIcon sx={{ fontSize: 18, color: 'warning.main' }} />
        )}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography variant="body2" fontWeight={600}>
            {schedule.name}
          </Typography>
          {!schedule.enabled ? (
            <Chip label="Disabled" size="small" sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(255,255,255,0.08)' }} />
          ) : schedule.mode === 'apply' ? (
            <Chip label="APPLY" size="small" sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(245,158,11,0.2)', color: 'warning.main' }} />
          ) : (
            <Chip label="PLAN" size="small" sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(59,130,246,0.2)', color: 'info.main' }} />
          )}
        </Box>
        <Typography variant="caption" color="text.secondary" display="block">
          {cronToText(schedule.cronExpr)} · {schedule.timezone}
        </Typography>
        {schedule.nextRun ? (
          <Typography
            variant="caption"
            fontWeight={600}
            sx={{ color: isSleep ? 'primary.light' : 'warning.light' }}
          >
            Next run {timeUntil(schedule.nextRun)}
          </Typography>
        ) : (
          <Typography variant="caption" color="text.disabled">
            Not scheduled
          </Typography>
        )}
      </Box>
    </Box>
  )
}

export default function NextRunCard() {
  const router = useRouter()
  const { data: schedules = [], isLoading, isError } = useQuery({ queryKey: ['schedules'], queryFn: getSchedules, refetchInterval: 30_000 })

  const sorted = [...schedules].sort((a, b) => {
    if (!a.nextRun && !b.nextRun) return 0
    if (!a.nextRun) return 1
    if (!b.nextRun) return -1
    return new Date(a.nextRun).getTime() - new Date(b.nextRun).getTime()
  })

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">
            SCHEDULES
          </Typography>
          <ButtonBase
            onClick={() => router.push('/schedules/')}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary', borderRadius: 1, px: 0.5, '&:hover': { color: 'text.primary' } }}
          >
            <Typography variant="caption">View all</Typography>
            <ArrowForwardIcon sx={{ fontSize: 13 }} />
          </ButtonBase>
        </Box>

        {isError && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Could not load schedules — showing last known state.
          </Alert>
        )}

        {isLoading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[...Array(2)].map((_, i) => <Skeleton key={i} variant="rounded" height={60} />)}
          </Box>
        ) : sorted.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            No schedules configured.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {sorted.map((sc, i) => (
              <Box key={sc.id}>
                {i > 0 && <Divider sx={{ mb: 2 }} />}
                <ScheduleRow schedule={sc} />
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
