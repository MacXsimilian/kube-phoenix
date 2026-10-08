'use client'

import { useRef, useState } from 'react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import ClickAwayListener from '@mui/material/ClickAwayListener'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { alpha, type Theme } from '@mui/material/styles'
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
  muted = false,
  surfaceColor = 'background.paper',
}: {
  windows: SleepWindow[]
  size?: number
  muted?: boolean
  surfaceColor?: string
}) {
  const { percent } = weeklySavingsPercent(windows)
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const dismissed = useRef(false)
  const explanation = `${percent}% of a recurring week scheduled asleep`

  return (
    <ClickAwayListener onClickAway={() => setTooltipOpen(false)}>
      <Tooltip
        arrow
        describeChild
        disableTouchListener
        open={tooltipOpen}
        slotProps={{
          tooltip: {
            sx: {
              bgcolor: 'background.paper',
              color: 'text.primary',
              border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.4)}`,
              borderRadius: '8px',
              p: '12px 14px',
              width: 256,
              maxWidth: 'calc(100vw - 32px)',
              boxShadow: (theme) => theme.palette.mode === 'dark'
                ? '0 12px 32px rgba(0, 0, 0, 0.4)'
                : '0 12px 32px rgba(15, 23, 42, 0.12)',
            },
          },
          arrow: { sx: { color: 'background.paper' } },
        }}
        onOpen={() => {
          if (!dismissed.current) setTooltipOpen(true)
        }}
        onClose={(event) => {
          if (event.type === 'keydown' && 'key' in event && event.key === 'Escape') {
            dismissed.current = true
          }
          setTooltipOpen(false)
        }}
        title={
          <Box>
            <Typography component="div" sx={{ fontSize: 12, fontWeight: 600, mb: 0.5 }}>
              {explanation}
            </Typography>
            <Typography component="div" sx={{ fontSize: 12, color: 'text.secondary' }}>
              Based on configured sleep windows. Actual executions and exceptions are not included.
            </Typography>
          </Box>
        }
      >
        <ButtonBase
          aria-label={`${explanation}. Show savings explanation`}
          disableRipple
          onClick={() => {
            dismissed.current = false
            setTooltipOpen(true)
          }}
          onMouseEnter={() => { dismissed.current = false }}
          onMouseLeave={() => { dismissed.current = false }}
          onBlur={() => { dismissed.current = false }}
          sx={{
            width: size,
            height: size,
            borderRadius: '50%',
            '&.Mui-focusVisible': {
              outline: '2px solid',
              outlineColor: 'primary.main',
              outlineOffset: 3,
            },
          }}
        >
          <Box
            sx={{
              position: 'relative',
              width: size,
              height: size,
              borderRadius: '50%',
              opacity: muted ? 0.45 : 1,
              background: (t) =>
                `conic-gradient(${ringColor(percent, t)} ${percent}%, ${t.palette.action.hover} 0)`,
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                inset: Math.round(size * 0.13),
                borderRadius: '50%',
                bgcolor: surfaceColor,
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
        </ButtonBase>
      </Tooltip>
    </ClickAwayListener>
  )
}
