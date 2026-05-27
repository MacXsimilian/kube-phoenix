'use client'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { Theme } from '@mui/material/styles'
import type { SleepWindow } from '@/lib/types'
import { weeklySavingsPercent } from '@/lib/windowUtils'

/** Above this share of the week, savings reads as healthy (green); below, neutral. */
const HEALTHY_THRESHOLD = 40

function ringColor(percent: number, theme: Theme): string {
  return percent >= HEALTHY_THRESHOLD ? theme.palette.success.main : theme.palette.primary.main
}

/**
 * Donut showing the percentage of the week a policy's sleep windows keep it
 * asleep. Self-contained: pass the windows and it computes and clamps the
 * percentage itself.
 */
export default function WeeklySavingsRing({
  windows,
  size = 64,
}: {
  windows: SleepWindow[]
  size?: number
}) {
  const { percent } = weeklySavingsPercent(windows)
  return (
    <Box
      sx={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: '50%',
        background: (t) =>
          `conic-gradient(${ringColor(percent, t)} ${percent}%, ${t.palette.action.hover} 0)`,
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: Math.round(size * 0.13),
          borderRadius: '50%',
          bgcolor: 'background.paper',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: Math.round(size * 0.28),
            letterSpacing: -0.5,
            lineHeight: 1,
          }}
        >
          {percent}%
        </Typography>
      </Box>
    </Box>
  )
}
