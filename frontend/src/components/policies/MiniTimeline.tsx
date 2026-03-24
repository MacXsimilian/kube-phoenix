'use client'

import { useId } from 'react'
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import type { SleepWindow } from '@/lib/types'
import { timeToHours, isOvernight, windowsToText, nowInTimezone } from '@/lib/windowUtils'
import { TIMELINE_COLORS } from '@/lib/colors'

const TOP_PAD = 6
const BOT_PAD = 4
const STEP = 0.25 // 15-minute resolution
const VB_W = 400
const WAVEFORM_STROKE = 1.5
const NOW_DOT_R = 3.5
const HOUR_TICKS = [0, 3, 6, 9, 12, 15, 18, 21, 24]

/**
 * Sparkline-style 24h timeline showing sleep/awake as a waveform.
 * The waveform SVG stretches to fill the container width.
 * Hour labels are rendered as a CSS flex row to avoid SVG distortion.
 */
export default function MiniTimeline({
  windows,
  height = 36,
  timezone,
}: {
  windows: SleepWindow[]
  height?: number
  timezone?: string
}) {
  if (!windows || windows.length === 0) return null

  const H = height
  const { dayOfWeek: todayDow, fractionalHour: currentHour } = nowInTimezone(timezone)

  // Build sleeping ranges for today
  const yesterdayDow = (todayDow + 6) % 7
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
    const x = (hr / 24) * VB_W
    const y = isSleeping(hr) ? H - BOT_PAD : TOP_PAD
    points.push({ x, y })
  }

  // Smooth transitions: insert intermediate points at state changes
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
  const areaAboveD = `${lineD} L${VB_W},0 L0,0 Z`
  const areaBelowD = `${lineD} L${VB_W},${H} L0,${H} Z`

  const nowPct = (currentHour / 24) * 100
  const nowX = (currentHour / 24) * VB_W
  const nowY = isSleeping(currentHour) ? H - BOT_PAD : TOP_PAD

  const uid = useId()
  const gradIdAwake = `spark-awake-${uid}`
  const gradIdSleep = `spark-sleep-${uid}`

  return (
    <Tooltip title={windowsToText(windows)} placement="top">
      <Box sx={{ width: '100%' }}>
        {/* Waveform SVG — stretches horizontally, fixed height */}
        <Box sx={{ position: 'relative' }}>
          <svg
            width="100%"
            height={H}
            viewBox={`0 0 ${VB_W} ${H}`}
            preserveAspectRatio="none"
            style={{ display: 'block', borderRadius: 4 }}
          >
            <defs>
              <linearGradient id={gradIdAwake} x1={0} x2={0} y1={0} y2={1}>
                <stop offset="0%" stopColor={TIMELINE_COLORS.awake} stopOpacity={0.25} />
                <stop offset="100%" stopColor={TIMELINE_COLORS.awake} stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id={gradIdSleep} x1={0} x2={0} y1={0} y2={1}>
                <stop offset="0%" stopColor={TIMELINE_COLORS.sleep} stopOpacity={0.1} />
                <stop offset="100%" stopColor={TIMELINE_COLORS.sleep} stopOpacity={0.5} />
              </linearGradient>
            </defs>

            <path d={areaAboveD} fill={`url(#${gradIdAwake})`} />
            <path d={areaBelowD} fill={`url(#${gradIdSleep})`} />
            <path
              d={lineD}
              fill="none"
              stroke="rgba(148,163,184,0.4)"
              strokeWidth={WAVEFORM_STROKE}
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* Now marker — positioned with CSS % to avoid SVG distortion */}
          <Box
            sx={{
              position: 'absolute',
              left: `${nowPct}%`,
              top: 0,
              bottom: 0,
              width: 0,
              pointerEvents: 'none',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: '1px',
                bgcolor: TIMELINE_COLORS.exceptionBg,
                opacity: 0.5,
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                left: `-${NOW_DOT_R}px`,
                top: `${nowY - NOW_DOT_R}px`,
                width: NOW_DOT_R * 2,
                height: NOW_DOT_R * 2,
                borderRadius: '50%',
                bgcolor: TIMELINE_COLORS.exceptionBg,
                border: '1.5px solid rgba(15,15,19,0.8)',
              }}
            />
          </Box>
        </Box>

        {/* Hour labels — CSS flex, not SVG, so they don't distort */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.25, px: 0 }}>
          {HOUR_TICKS.filter(h => h < 24).map(hr => (
            <Box
              key={hr}
              sx={{
                fontSize: 9,
                color: 'rgba(148,163,184,0.5)',
                fontFamily: 'Inter, sans-serif',
                width: 0,
                textAlign: 'center',
                overflow: 'visible',
                whiteSpace: 'nowrap',
              }}
            >
              {hr}h
            </Box>
          ))}
        </Box>
      </Box>
    </Tooltip>
  )
}
