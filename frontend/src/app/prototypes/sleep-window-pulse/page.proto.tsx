'use client'

import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useRouter } from 'next/navigation'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const SLEEP_START = 20
const SLEEP_END = 7
const EXCEPTION_DAY = 3
const EXCEPTION_START = 0
const EXCEPTION_END = 24

type TimeState = 'during-awake' | 'during-sleep' | 'near-transition'

function isInSleep(hour: number, isWeekend: boolean): boolean {
  if (isWeekend) return true
  return hour >= SLEEP_START || hour < SLEEP_END
}

export default function SleepWindowPulsePrototype() {
  const router = useRouter()
  const [timeState, setTimeState] = useState<TimeState>('during-sleep')

  const nowHour = timeState === 'during-awake' ? 14 : timeState === 'during-sleep' ? 23 : 19.5
  const currentDay = 2

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>F8 — Sleep Window Pulse</Typography>
          <Typography variant="body2" color="text.secondary">
            Active sleep segment pulses, approaching transition glows brighter
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary">Simulate time:</Typography>
        <ToggleButtonGroup value={timeState} exclusive onChange={(_, v) => v && setTimeState(v)} size="small">
          <ToggleButton value="during-awake" sx={{ fontSize: 12, px: 2 }}>Awake (14:00)</ToggleButton>
          <ToggleButton value="during-sleep" sx={{ fontSize: 12, px: 2 }}>Sleeping (23:00)</ToggleButton>
          <ToggleButton value="near-transition" sx={{ fontSize: 12, px: 2 }}>Near Sleep (19:30)</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Weekly timeline */}
      <Box sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
        {/* Hour labels */}
        <Box sx={{ display: 'flex', ml: '44px', mb: 0.5 }}>
          {[0, 3, 6, 9, 12, 15, 18, 21, 24].map(h => (
            <Typography
              key={h}
              variant="caption"
              sx={{ flex: h === 24 ? 0 : 3, color: 'text.disabled', fontSize: 10, fontFamily: 'monospace' }}
            >
              {h}:00
            </Typography>
          ))}
        </Box>

        {DAYS.map((day, di) => {
          const isWeekend = di >= 5
          const isToday = di === currentDay

          return (
            <Box key={day} sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
              <Typography
                variant="caption"
                sx={{
                  width: 36,
                  fontSize: 11,
                  fontWeight: isToday ? 700 : 400,
                  color: isToday ? 'primary.main' : 'text.secondary',
                  mr: 1,
                }}
              >
                {day}
              </Typography>

              {/* 24-hour bar */}
              <Box sx={{ flex: 1, height: 20, borderRadius: 1, position: 'relative', overflow: 'hidden', bgcolor: 'rgba(255,255,255,0.03)' }}>
                {/* Sleep segments */}
                {isWeekend ? (
                  <SleepBlock start={0} end={24} day={di} currentDay={currentDay} nowHour={nowHour} timeState={timeState} isException={false} />
                ) : (
                  <>
                    <SleepBlock start={0} end={SLEEP_END} day={di} currentDay={currentDay} nowHour={nowHour} timeState={timeState} isException={false} />
                    <SleepBlock start={SLEEP_START} end={24} day={di} currentDay={currentDay} nowHour={nowHour} timeState={timeState} isException={false} />
                    {/* Awake segment (visual only) */}
                    <Box sx={{
                      position: 'absolute',
                      left: `${(SLEEP_END / 24) * 100}%`,
                      width: `${((SLEEP_START - SLEEP_END) / 24) * 100}%`,
                      top: 0, bottom: 0,
                      bgcolor: 'rgba(34,197,94,0.08)',
                    }} />
                  </>
                )}

                {/* Exception on Thursday */}
                {di === EXCEPTION_DAY && (
                  <Box sx={{
                    position: 'absolute',
                    left: `${(EXCEPTION_START / 24) * 100}%`,
                    width: `${((EXCEPTION_END - EXCEPTION_START) / 24) * 100}%`,
                    top: 0, bottom: 0,
                    bgcolor: 'rgba(239,68,68,0.15)',
                    borderLeft: '2px solid rgba(239,68,68,0.5)',
                    borderRight: '2px solid rgba(239,68,68,0.5)',
                    zIndex: 2,
                  }} />
                )}

                {/* Now marker */}
                {isToday && (
                  <Box sx={{
                    position: 'absolute',
                    left: `${(nowHour / 24) * 100}%`,
                    top: -2, bottom: -2,
                    width: 2,
                    bgcolor: '#f87171',
                    zIndex: 5,
                    borderRadius: 1,
                  }}>
                    <Box sx={{
                      position: 'absolute', top: -3, left: -2.5,
                      width: 7, height: 7, borderRadius: '50%', bgcolor: '#f87171',
                      animation: 'nowDot 2s ease-in-out infinite',
                      '@keyframes nowDot': { '0%,100%': { opacity: 1, transform: 'scale(1)' }, '50%': { opacity: 0.5, transform: 'scale(1.3)' } },
                    }} />
                  </Box>
                )}
              </Box>
            </Box>
          )
        })}

        {/* Legend */}
        <Box sx={{ display: 'flex', gap: 3, mt: 2, ml: '44px' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: 'rgba(124,58,237,0.35)' }} />
            <Typography variant="caption" color="text.secondary">Sleep</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: 'rgba(34,197,94,0.15)' }} />
            <Typography variant="caption" color="text.secondary">Awake</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.5)' }} />
            <Typography variant="caption" color="text.secondary">Exception</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#f87171' }} />
            <Typography variant="caption" color="text.secondary">Now</Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

function SleepBlock({ start, end, day, currentDay, nowHour, timeState, isException }: {
  start: number; end: number; day: number; currentDay: number; nowHour: number; timeState: TimeState; isException: boolean
}) {
  const isToday = day === currentDay
  const isActive = isToday && nowHour >= start && nowHour < end && (timeState === 'during-sleep')
  const isNearTransition = isToday && timeState === 'near-transition' && nowHour >= start - 1 && nowHour < start

  const baseOpacity = isException ? 0.2 : 0.35
  const color = isException ? 'rgba(239,68,68' : 'rgba(124,58,237'

  return (
    <Box sx={{
      position: 'absolute',
      left: `${(start / 24) * 100}%`,
      width: `${((end - start) / 24) * 100}%`,
      top: 0,
      bottom: 0,
      bgcolor: `${color},${baseOpacity})`,
      zIndex: 1,
      ...(isActive && {
        animation: 'sleepPulse 3s ease-in-out infinite',
        '@keyframes sleepPulse': {
          '0%, 100%': { backgroundColor: `${color},${baseOpacity})` },
          '50%': { backgroundColor: `${color},${baseOpacity + 0.15})` },
        },
      }),
      ...(isNearTransition && {
        animation: 'transitionGlow 1.5s ease-in-out infinite',
        '@keyframes transitionGlow': {
          '0%, 100%': { boxShadow: `inset 0 0 0 0 ${color},0)` },
          '50%': { boxShadow: `inset 0 0 8px 0 ${color},0.3)` },
        },
      }),
    }} />
  )
}
