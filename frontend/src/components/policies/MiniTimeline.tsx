'use client'

import React from 'react'
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import type { SleepWindow } from '@/lib/types'
import { timeToHours, isOvernight, windowsToText, nowInTimezone } from '@/lib/windowUtils'
import { TIMELINE_COLORS } from '@/lib/colors'

const W = 280
const H = 16

function hourToX(hour: number): number {
  return (hour / 24) * W
}

/**
 * Small 24h bar showing sleep windows as indigo blocks and a current-time marker.
 */
export default function MiniTimeline({
  windows,
  width = W,
  height = H,
  timezone,
}: {
  windows: SleepWindow[]
  width?: number
  height?: number
  timezone?: string
}) {
  if (!windows || windows.length === 0) return null

  const { dayOfWeek: todayDow, fractionalHour: currentHour } = nowInTimezone(timezone)

  // Build sleep blocks for today
  const blocks: { x: number; w: number }[] = []
  for (const win of windows) {
    if (!win.daysOfWeek.includes(todayDow)) continue
    if (win.allDay) {
      blocks.push({ x: 0, w: W })
    } else if (isOvernight(win)) {
      const startH = timeToHours(win.startTime)
      blocks.push({ x: hourToX(startH), w: hourToX(24) - hourToX(startH) })
    } else {
      const startH = timeToHours(win.startTime)
      const endH = timeToHours(win.endTime)
      blocks.push({ x: hourToX(startH), w: hourToX(endH) - hourToX(startH) })
    }
  }

  // Also check if yesterday's overnight window bleeds into today
  const yesterdayDow = (todayDow + 6) % 7
  for (const win of windows) {
    if (!win.daysOfWeek.includes(yesterdayDow)) continue
    if (!isOvernight(win)) continue
    // Yesterday's window ends today at endTime
    const endH = timeToHours(win.endTime)
    blocks.push({ x: 0, w: hourToX(endH) })
  }

  const nowX = hourToX(currentHour)

  return (
    <Tooltip title={windowsToText(windows)} placement="top">
      <Box sx={{ display: 'inline-flex', verticalAlign: 'middle' }}>
        <svg width={width} height={height} viewBox={`0 0 ${W} ${H}`} style={{ borderRadius: 4 }}>
          {/* Background — awake */}
          <rect x={0} y={0} width={W} height={H} rx={3} fill={TIMELINE_COLORS.awakeBg} />

          {/* Sleep blocks */}
          {blocks.map((b, i) => (
            <rect
              key={i}
              x={b.x}
              y={0}
              width={Math.max(b.w, 1)}
              height={H}
              fill={TIMELINE_COLORS.sleepBg}
              rx={b.x === 0 ? 3 : 0}
            />
          ))}

          {/* Hour markers */}
          {[6, 12, 18].map(h => (
            <line
              key={h}
              x1={hourToX(h)}
              y1={0}
              x2={hourToX(h)}
              y2={H}
              stroke="rgba(148,163,184,0.15)"
              strokeWidth={0.5}
            />
          ))}

          {/* Current time */}
          <line x1={nowX} y1={0} x2={nowX} y2={H} stroke={TIMELINE_COLORS.exceptionBg} strokeWidth={1.5} />
        </svg>
      </Box>
    </Tooltip>
  )
}
