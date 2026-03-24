'use client'

import React from 'react'
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import type { SleepWindow } from '@/lib/types'
import { timeToHours, isOvernight, windowsToText, nowInTimezone } from '@/lib/windowUtils'
import { TIMELINE_COLORS } from '@/lib/colors'

const DEFAULT_W = 280
const DEFAULT_H = 28
const TOP_PAD = 6
const BOT_PAD = 4
const STEP = 0.25 // 15-minute resolution

/**
 * Sparkline-style 24h timeline showing sleep/awake as a waveform.
 * Awake = line at top, Sleep = line at bottom, with gradient fills.
 */
export default function MiniTimeline({
  windows,
  width = 200,
  height = DEFAULT_H,
  timezone,
}: {
  windows: SleepWindow[]
  width?: number
  height?: number
  timezone?: string
}) {
  if (!windows || windows.length === 0) return null

  const W = DEFAULT_W
  const H = height
  const { dayOfWeek: todayDow, fractionalHour: currentHour } = nowInTimezone(timezone)

  // Build a set of sleeping ranges for today
  const sleepRanges: { start: number; end: number }[] = []
  for (const win of windows) {
    if (win.daysOfWeek.includes(todayDow)) {
      if (win.allDay) {
        sleepRanges.push({ start: 0, end: 24 })
      } else if (isOvernight(win)) {
        sleepRanges.push({ start: timeToHours(win.startTime), end: 24 })
      } else {
        sleepRanges.push({ start: timeToHours(win.startTime), end: timeToHours(win.endTime) })
      }
    }
    // Yesterday's overnight window bleeding into today
    const yesterdayDow = (todayDow + 6) % 7
    if (win.daysOfWeek.includes(yesterdayDow) && isOvernight(win)) {
      sleepRanges.push({ start: 0, end: timeToHours(win.endTime) })
    }
  }

  function isSleeping(hr: number): boolean {
    return sleepRanges.some(r => hr >= r.start && hr < r.end)
  }

  // Build points at 15-minute intervals
  const points: { x: number; y: number }[] = []
  for (let hr = 0; hr <= 24; hr += STEP) {
    const x = (hr / 24) * W
    const y = isSleeping(hr) ? H - BOT_PAD : TOP_PAD
    points.push({ x, y })
  }

  // Smooth transitions: insert intermediate points at transitions
  const smoothed: { x: number; y: number }[] = []
  for (let i = 0; i < points.length; i++) {
    smoothed.push(points[i])
    if (i < points.length - 1 && points[i].y !== points[i + 1].y) {
      const midX = (points[i].x + points[i + 1].x) / 2
      smoothed.push({ x: midX, y: points[i].y })
      smoothed.push({ x: midX, y: points[i + 1].y })
    }
  }

  const lineD = smoothed.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaAboveD = `${lineD} L${W},0 L0,0 Z`
  const areaBelowD = `${lineD} L${W},${H} L0,${H} Z`

  const nowX = (currentHour / 24) * W
  const nowY = isSleeping(currentHour) ? H - BOT_PAD : TOP_PAD

  const gradIdAwake = 'spark-awake-mini'
  const gradIdSleep = 'spark-sleep-mini'

  return (
    <Tooltip title={windowsToText(windows)} placement="top">
      <Box sx={{ display: 'inline-flex', verticalAlign: 'middle' }}>
        <svg width={width} height={H} viewBox={`0 0 ${W} ${H}`} style={{ borderRadius: 4 }}>
          <defs>
            <linearGradient id={gradIdAwake} x1={0} x2={0} y1={0} y2={1}>
              <stop offset="0%" stopColor={TIMELINE_COLORS.awake} stopOpacity={0.2} />
              <stop offset="100%" stopColor={TIMELINE_COLORS.awake} stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id={gradIdSleep} x1={0} x2={0} y1={0} y2={1}>
              <stop offset="0%" stopColor={TIMELINE_COLORS.sleep} stopOpacity={0.1} />
              <stop offset="100%" stopColor={TIMELINE_COLORS.sleep} stopOpacity={0.45} />
            </linearGradient>
          </defs>

          {/* Gradient fills */}
          <path d={areaAboveD} fill={`url(#${gradIdAwake})`} />
          <path d={areaBelowD} fill={`url(#${gradIdSleep})`} />

          {/* Waveform line */}
          <path d={lineD} fill="none" stroke="rgba(148,163,184,0.35)" strokeWidth={1.5} />

          {/* Now marker */}
          <line x1={nowX} y1={0} x2={nowX} y2={H} stroke={TIMELINE_COLORS.exceptionBg} strokeWidth={1} opacity={0.5} />
          <circle cx={nowX} cy={nowY} r={3} fill={TIMELINE_COLORS.exceptionBg} stroke="rgba(15,15,19,0.8)" strokeWidth={1.5} />
        </svg>
      </Box>
    </Tooltip>
  )
}
