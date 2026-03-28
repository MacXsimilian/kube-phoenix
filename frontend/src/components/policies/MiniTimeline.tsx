'use client'

import { useId, useRef, useState, useEffect, useMemo } from 'react'
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import type { SleepWindow } from '@/lib/types'
import { useIsDark } from '@/lib/useIsDark'
import { timeToHours, isOvernight, windowsToText, nowInTimezone } from '@/lib/windowUtils'
import { TIMELINE_COLORS } from '@/lib/colors'

const TOP_PAD = 6
const BOT_PAD = 4
const STEP = 0.25 // 15-minute resolution
const VB_W = 400
const WAVEFORM_STROKE = 1.5
const NOW_DOT_R = 3.5
const HOUR_TICKS = [0, 3, 6, 9, 12, 15, 18, 21, 24]
const TICK_H = 3
const UPDATE_INTERVAL_MS = 30_000

/**
 * Sparkline-style 24h timeline showing sleep/awake as a waveform.
 * The waveform SVG stretches to fill the container width.
 * Hour tick marks are rendered inside the SVG; labels via CSS for crisp text.
 * Now marker updates every 30 seconds.
 */
export default function MiniTimeline({
  windows,
  height = 48,
  timezone,
}: {
  windows: SleepWindow[]
  height?: number
  timezone?: string
}) {
  const isDark = useIsDark()
  const uid = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(true)
  const gradIdAwake = `spark-awake-${uid}`
  const gradIdSleep = `spark-sleep-${uid}`

  // Pause interval when off-screen
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Real-time current hour — ticks every 30s, paused when not visible
  const [timeState, setTimeState] = useState(() => {
    const now = nowInTimezone(timezone)
    return { currentHour: now.fractionalHour, todayDow: now.dayOfWeek }
  })

  useEffect(() => {
    if (!isVisible) return
    const now = nowInTimezone(timezone)
    setTimeState({ currentHour: now.fractionalHour, todayDow: now.dayOfWeek })
    const id = setInterval(() => {
      const now = nowInTimezone(timezone)
      setTimeState({ currentHour: now.fractionalHour, todayDow: now.dayOfWeek })
    }, UPDATE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [timezone, isVisible])

  const { currentHour, todayDow } = timeState

  // Build sleeping ranges for today (memoized to avoid recalc on unrelated re-renders)
  const sleepRanges = useMemo(() => {
    if (!windows || windows.length === 0) return []
    const yesterdayDow = (todayDow + 6) % 7
    const ranges: { start: number; end: number }[] = []
    for (const win of windows) {
      if (win.daysOfWeek.includes(todayDow)) {
        if (win.allDay) {
          ranges.push({ start: 0, end: 24 })
        } else if (isOvernight(win)) {
          ranges.push({ start: timeToHours(win.startTime), end: 24 })
        } else {
          ranges.push({ start: timeToHours(win.startTime), end: timeToHours(win.endTime) })
        }
      }
      if (win.daysOfWeek.includes(yesterdayDow) && isOvernight(win)) {
        ranges.push({ start: 0, end: timeToHours(win.endTime) })
      }
    }
    return ranges
  }, [windows, todayDow])

  if (!windows || windows.length === 0) return null

  function isSleeping(hr: number): boolean {
    return sleepRanges.some(r => hr >= r.start && hr < r.end)
  }

  // Build points at 15-minute intervals
  const points: { x: number; y: number }[] = []
  for (let hr = 0; hr <= 24; hr += STEP) {
    const x = (hr / 24) * VB_W
    const y = isSleeping(hr) ? height - BOT_PAD : TOP_PAD
    points.push({ x, y })
  }

  // Insert intermediate points at state changes for sharp transitions
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
  const areaBelowD = `${lineD} L${VB_W},${height} L0,${height} Z`

  const nowPct = (currentHour / 24) * 100
  const nowY = isSleeping(currentHour) ? height - BOT_PAD : TOP_PAD
  const totalSvgH = height + TICK_H

  return (
    <Tooltip title={windowsToText(windows)} placement="top">
      <Box ref={containerRef} sx={{ width: '100%' }}>
        {/* Waveform SVG with tick marks */}
        <Box sx={{ position: 'relative' }}>
          <svg
            width="100%"
            height={totalSvgH}
            viewBox={`0 0 ${VB_W} ${totalSvgH}`}
            preserveAspectRatio="none"
            style={{ display: 'block', borderRadius: 4 }}
          >
            <defs>
              <linearGradient id={gradIdAwake} x1={0} x2={0} y1={0} y2={1}>
                <stop offset="0%" stopColor={TIMELINE_COLORS.awake} stopOpacity={0.25} />
                <stop offset="100%" stopColor={TIMELINE_COLORS.awake} stopOpacity={0.03} />
              </linearGradient>
              <linearGradient id={gradIdSleep} x1={0} x2={0} y1={0} y2={1}>
                <stop offset="0%" stopColor={TIMELINE_COLORS.sleep} stopOpacity={0.08} />
                <stop offset="100%" stopColor={TIMELINE_COLORS.sleep} stopOpacity={0.45} />
              </linearGradient>
            </defs>

            <path d={areaAboveD} fill={`url(#${gradIdSleep})`} />
            <path d={areaBelowD} fill={`url(#${gradIdAwake})`} />
            <path
              d={lineD}
              fill="none"
              stroke="rgba(148,163,184,0.35)"
              strokeWidth={WAVEFORM_STROKE}
              vectorEffect="non-scaling-stroke"
            />

            {/* Tick marks at hour positions */}
            {HOUR_TICKS.map(h => {
              const x = (h / 24) * VB_W
              return (
                <line
                  key={h}
                  x1={x}
                  y1={height}
                  x2={x}
                  y2={height + TICK_H}
                  stroke={isDark ? '#94A3B8' : '#475569'}
                  strokeWidth={1}
                />
              )
            })}
          </svg>

          {/* Now marker — positioned with CSS % for crisp rendering */}
          <Box
            sx={{
              position: 'absolute',
              left: `${nowPct}%`,
              top: 0,
              height,
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
                opacity: 0.45,
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
                border: `1.5px solid ${isDark ? 'rgba(15,15,19,0.9)' : 'rgba(255,255,255,0.9)'}`,
              }}
            />
          </Box>
        </Box>

        {/* Hour labels — absolute positioned to match waveform coordinates */}
        <Box sx={{ position: 'relative', height: 12, mt: 0.25 }}>
          {HOUR_TICKS.map(hr => (
            <Box
              key={hr}
              sx={{
                position: 'absolute',
                left: `${(hr / 24) * 100}%`,
                transform: 'translateX(-50%)',
                fontSize: 7,
                color: isDark ? '#94A3B8' : '#64748b',
                fontFamily: "'SF Mono', SFMono-Regular, Menlo, Consolas, monospace",
                whiteSpace: 'nowrap',
              }}
            >
              {hr}
            </Box>
          ))}
        </Box>
      </Box>
    </Tooltip>
  )
}
