'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Alert from '@mui/material/Alert'
import AddIcon from '@mui/icons-material/Add'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import { getSchedules } from '@/lib/api'
import type { Schedule } from '@/lib/types'
import ScheduleCard from '@/components/schedules/ScheduleCard'
import ScheduleDialog from '@/components/schedules/ScheduleDialog'

export default function SchedulesPage() {
  const qc = useQueryClient()
  const { data: schedules = [], isLoading, isError, error } = useQuery({
    queryKey: ['schedules'],
    queryFn: getSchedules,
  })

  const [dialog, setDialog] = useState<{
    open: boolean
    schedule?: Schedule
    defaultType?: 'scale_down' | 'scale_up'
  }>({ open: false })

  const sleepSchedules = schedules.filter((s) => s.type === 'scale_down')
  const wakeSchedules = schedules.filter((s) => s.type === 'scale_up')

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (isError) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Failed to load schedules: {error instanceof Error ? error.message : 'Unknown error'}
      </Alert>
    )
  }

  const EmptySlot = ({ label }: { label: string }) => (
    <Box
      sx={{
        border: '1px dashed rgba(255,255,255,0.12)',
        borderRadius: 2,
        p: 3,
        textAlign: 'center',
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Box>
  )

  return (
    <>
      <Typography variant="h5" fontWeight={700} mb={3}>
        Schedules
      </Typography>

      {/* ── Sleep ─────────────────────────────────────────────────────── */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <BedtimeIcon sx={{ color: 'primary.main', fontSize: 20 }} />
          <Typography variant="subtitle1" fontWeight={700}>Sleep Schedules</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
            Scale down workloads and drain nodes
          </Typography>
          <Button
            size="small"
            startIcon={<AddIcon fontSize="small" />}
            variant="outlined"
            sx={{ borderColor: 'rgba(255,255,255,0.15)' }}
            onClick={() => setDialog({ open: true, defaultType: 'scale_down' })}
          >
            Add
          </Button>
        </Box>

        {sleepSchedules.length === 0 ? (
          <EmptySlot label="No sleep schedules yet. Add one to start scaling down at night." />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {sleepSchedules.map((sc) => (
              <ScheduleCard
                key={sc.id}
                schedule={sc}
                onEdit={() => setDialog({ open: true, schedule: sc })}
                onDelete={() => qc.invalidateQueries({ queryKey: ['schedules'] })}
              />
            ))}
          </Box>
        )}
      </Box>

      <Divider sx={{ mb: 4 }} />

      {/* ── Wake ──────────────────────────────────────────────────────── */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <WbSunnyIcon sx={{ color: 'warning.main', fontSize: 20 }} />
          <Typography variant="subtitle1" fontWeight={700}>Wake Schedules</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
            Restore workloads from saved replica counts
          </Typography>
          <Button
            size="small"
            startIcon={<AddIcon fontSize="small" />}
            variant="outlined"
            sx={{ borderColor: 'rgba(255,255,255,0.15)' }}
            onClick={() => setDialog({ open: true, defaultType: 'scale_up' })}
          >
            Add
          </Button>
        </Box>

        {wakeSchedules.length === 0 ? (
          <EmptySlot label="No wake schedules yet. Add one to restore workloads in the morning." />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {wakeSchedules.map((sc) => (
              <ScheduleCard
                key={sc.id}
                schedule={sc}
                onEdit={() => setDialog({ open: true, schedule: sc })}
                onDelete={() => qc.invalidateQueries({ queryKey: ['schedules'] })}
              />
            ))}
          </Box>
        )}
      </Box>

      <ScheduleDialog
        open={dialog.open}
        schedule={dialog.schedule}
        defaultType={dialog.defaultType}
        onClose={() => setDialog({ open: false })}
      />
    </>
  )
}
