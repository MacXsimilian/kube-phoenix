'use client'

import { useQuery } from '@tanstack/react-query'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import { getSchedules } from '@/lib/api'
import { cronToText } from '@/lib/cronToText'
import type { Schedule } from '@/lib/types'

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
          {cronToText(schedule.cronExpr)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {schedule.timezone} · <code style={{ fontSize: 11 }}>{schedule.cronExpr}</code>
        </Typography>
      </Box>
    </Box>
  )
}

export default function NextRunCard() {
  const { data: schedules = [] } = useQuery({ queryKey: ['schedules'], queryFn: getSchedules })

  const sleep = schedules.find((s) => s.type === 'scale_down')
  const wake = schedules.find((s) => s.type === 'scale_up')

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" mb={2}>
          SCHEDULES
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {sleep && <ScheduleRow schedule={sleep} />}
          <Divider />
          {wake && <ScheduleRow schedule={wake} />}
        </Box>
      </CardContent>
    </Card>
  )
}
