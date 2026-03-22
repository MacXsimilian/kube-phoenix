'use client'

import React from 'react'
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import type { SleepWindow } from '@/lib/types'
import { timeToHours, isOvernight, windowsToText } from '@/lib/windowUtils'

const W = 280
const H = 16
const SLOTS = 288 // 24h * 12 = 5-min resolution

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
}: {
  windows: SleepWindow[]
  width?: number
  height?: number
}) {
  if (!windows || windows.length === 0) return null

  const now = new Date()
  const todayDow = now.getDay() // 0=Sun
  const currentHour = now.getHours() + now.getMinutes() / 60

  // Build sleep blocks for today
  const blocks: { x: number; w: number }[] = []
  for (const win of windows) {
    if (!win.daysOfWeek.includes(todayDow)) continue
    const startH = timeToHours(win.startTime)
    const endH = timeToHours(win.endTime)

    if (isOvernight(win)) {
      // Sleep starts today and ends tomorrow — draw from startH to 24
      blocks.push({ x: hourToX(startH), w: hourToX(24) - hourToX(startH) })
    } else {
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
  const scaleX = width / W

  return (
    <Tooltip title={windowsToText(windows)} placement="top">
      <Box sx={{ display: 'inline-flex', verticalAlign: 'middle' }}>
        <svg width={width} height={height} viewBox={`0 0 ${W} ${H}`} style={{ borderRadius: 4 }}>
          {/* Background — awake */}
          <rect x={0} y={0} width={W} height={H} rx={3} fill="rgba(148,163,184,0.08)" />

          {/* Sleep blocks */}
          {blocks.map((b, i) => (
            <rect
              key={i}
              x={b.x}
              y={0}
              width={Math.max(b.w, 1)}
              height={H}
              fill="rgba(99,102,241,0.25)"
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
          <line x1={nowX} y1={0} x2={nowX} y2={H} stroke="#f87171" strokeWidth={1.5} />
        </svg>
      </Box>
    </Tooltip>
  )
}
