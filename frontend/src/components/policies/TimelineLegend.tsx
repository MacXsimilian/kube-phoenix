import Box from '@mui/material/Box'
import { TIMELINE_COLORS } from '@/lib/colors'
import type { ScheduledException } from '@/lib/types'
import LegendItem from './LegendItem'

interface TimelineLegendProps {
  exceptions?: ScheduledException[]
  variant?: 'box' | 'led'
}

export default function TimelineLegend({ exceptions, variant }: TimelineLegendProps) {
  return (
    <Box sx={{ display: 'flex', gap: 2, mt: variant === 'led' ? 1 : 0.75 }}>
      <LegendItem color={TIMELINE_COLORS.sleep} label="Sleep" variant={variant} />
      <LegendItem color={TIMELINE_COLORS.awake} label="Awake" variant={variant} />
      {exceptions && exceptions.some(e => e.exceptionType === 'stay_awake' && (e.status === 'pending' || e.status === 'active')) && (
        <LegendItem color={TIMELINE_COLORS.awake} label="Exception (awake)" variant={variant} />
      )}
      {exceptions && exceptions.some(e => e.exceptionType === 'force_sleep' && (e.status === 'pending' || e.status === 'active')) && (
        <LegendItem color={TIMELINE_COLORS.exception} label="Exception (sleep)" variant={variant} />
      )}
    </Box>
  )
}
