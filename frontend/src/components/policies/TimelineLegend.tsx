import Box from '@mui/material/Box'
import { TIMELINE_COLORS } from '@/lib/colors'
import type { PolicyOverride, ScheduledException } from '@/lib/types'
import LegendItem from './LegendItem'

interface TimelineLegendProps {
  overrides?: PolicyOverride[]
  exceptions?: ScheduledException[]
  variant?: 'box' | 'led'
}

export default function TimelineLegend({ overrides, exceptions, variant }: TimelineLegendProps) {
  return (
    <Box sx={{ display: 'flex', gap: 2, mt: variant === 'led' ? 1 : 0.75 }}>
      <LegendItem color={TIMELINE_COLORS.sleep} label="Sleep" variant={variant} />
      <LegendItem color={TIMELINE_COLORS.awake} label="Awake" variant={variant} />
      {overrides && overrides.some(o => o.overrideType === 'stay_awake') && (
        <LegendItem color={TIMELINE_COLORS.override} label="Stay awake" variant={variant} />
      )}
      {overrides && overrides.some(o => o.overrideType === 'force_sleep') && (
        <LegendItem color={TIMELINE_COLORS.exception} label="Force sleep" variant={variant} />
      )}
      {exceptions && exceptions.some(e => e.exceptionType === 'stay_awake') && (
        <LegendItem color={TIMELINE_COLORS.awake} label="Exception" variant={variant} />
      )}
    </Box>
  )
}
