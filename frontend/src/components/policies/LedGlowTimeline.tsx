'use client'

import React from 'react'
import Box from '@mui/material/Box'
import type { SleepWindow, PolicyOverride, ScheduledException } from '@/lib/types'
import { timeToHours, isOvernight, nowInTimezone, DOW_MAP, computeTimeRangeBlocks } from '@/lib/windowUtils'
import { TIMELINE_COLORS } from '@/lib/colors'
import LegendItem from './LegendItem'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const STRIP_H = 6
const GAP = 4
const LABEL_W = 28
const BAR_W = 600
const TOTAL_W = LABEL_W + BAR_W
const TOTAL_H = DAYS.length * (STRIP_H + GAP) - GAP + 16 // +16 for hour labels

function hourToX(h: number): number {
  return LABEL_W + (h / 24) * BAR_W
}

function stripY(row: number): number {
  return 14 + row * (STRIP_H + GAP)
}

interface Segment {
  row: number
  x1: number
  x2: number
  color: string
  glow: string
}

function windowSegments(windows: SleepWindow[]): Segment[] {
  const segs: Segment[] = []
  for (const sleepWindow of windows) {
    for (const dow of sleepWindow.daysOfWeek) {
      const row = DOW_MAP.indexOf(dow)
      if (row === -1) continue

      if (sleepWindow.allDay) {
        segs.push({ row, x1: hourToX(0), x2: hourToX(24), color: TIMELINE_COLORS.sleepGlow, glow: TIMELINE_COLORS.sleep })
      } else {
        const startH = timeToHours(sleepWindow.startTime)
        const endH = timeToHours(sleepWindow.endTime)
        if (isOvernight(sleepWindow)) {
          segs.push({ row, x1: hourToX(startH), x2: hourToX(24), color: TIMELINE_COLORS.sleepGlow, glow: TIMELINE_COLORS.sleep })
          const nextRow = (row + 1) % 7
          segs.push({ row: nextRow, x1: hourToX(0), x2: hourToX(endH), color: TIMELINE_COLORS.sleepGlow, glow: TIMELINE_COLORS.sleep })
        } else {
          segs.push({ row, x1: hourToX(startH), x2: hourToX(endH), color: TIMELINE_COLORS.sleepGlow, glow: TIMELINE_COLORS.sleep })
        }
      }
    }
  }
  return segs
}

function timeRangeToSegments(startISO: string, endISO: string, color: string, glow: string, tz?: string): Segment[] {
  return computeTimeRangeBlocks(startISO, endISO, tz).map(tb => ({
    row: tb.row,
    x1: hourToX(tb.startHour),
    x2: hourToX(tb.endHour),
    color,
    glow,
  }))
}

function overrideSegments(overrides: PolicyOverride[], tz?: string): Segment[] {
  if (!overrides) return []
  const segs: Segment[] = []
  for (const ov of overrides) {
    if (!ov.startsAt || !ov.endsAt) continue
    const color = ov.overrideType === 'force_sleep' ? 'rgba(239,68,68,0.55)' : 'rgba(245,158,11,0.55)'
    const glow = ov.overrideType === 'force_sleep' ? '#EF4444' : '#F59E0B'
    segs.push(...timeRangeToSegments(ov.startsAt, ov.endsAt, color, glow, tz))
  }
  return segs
}

function exceptionSegments(exceptions: ScheduledException[], tz?: string): Segment[] {
  if (!exceptions) return []
  const segs: Segment[] = []
  for (const ex of exceptions) {
    if (ex.status === 'cancelled' || ex.status === 'completed') continue
    const color = ex.exceptionType === 'force_sleep' ? 'rgba(239,68,68,0.55)' : 'rgba(34,197,94,0.55)'
    const glow = ex.exceptionType === 'force_sleep' ? '#EF4444' : '#22C55E'
    segs.push(...timeRangeToSegments(ex.startsAt, ex.endsAt, color, glow, tz))
  }
  return segs
}

export default function LedGlowTimeline({
  windows,
  overrides,
  exceptions,
  timezone,
}: {
  windows: SleepWindow[]
  overrides?: PolicyOverride[]
  exceptions?: ScheduledException[]
  timezone?: string
}) {
  if (!windows || windows.length === 0) return null

  const { dayOfWeek, fractionalHour: nowH } = nowInTimezone(timezone)
  const todayRow = DOW_MAP.indexOf(dayOfWeek)
  const nowX = hourToX(nowH)

  const allSegs = [
    ...windowSegments(windows),
    ...overrideSegments(overrides ?? [], timezone),
    ...exceptionSegments(exceptions ?? [], timezone),
  ]

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <svg width={TOTAL_W} height={TOTAL_H} style={{ display: 'block' }}>
        <defs>
          <filter id="led-glow-purple" x="-20%" y="-100%" width="140%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="led-glow-orange" x="-20%" y="-100%" width="140%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="led-glow-red" x="-20%" y="-100%" width="140%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="led-glow-green" x="-20%" y="-100%" width="140%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Hour labels */}
        {[0, 3, 6, 9, 12, 15, 18, 21].map(h => (
          <text
            key={h}
            x={hourToX(h)}
            y={10}
            textAnchor="middle"
            fill="rgba(148,163,184,0.45)"
            fontSize={8}
            fontFamily="monospace"
          >
            {h}
          </text>
        ))}

        {/* Day rows */}
        {DAYS.map((day, row) => {
          const y = stripY(row)
          const isToday = row === todayRow
          return (
            <g key={day}>
              {/* Day label */}
              <text
                x={LABEL_W - 4}
                y={y + STRIP_H / 2 + 1}
                textAnchor="end"
                fill={isToday ? '#e2e8f0' : 'rgba(148,163,184,0.5)'}
                fontSize={9}
                fontWeight={isToday ? 700 : 400}
                fontFamily="monospace"
              >
                {day.charAt(0)}
              </text>
              {/* Awake background strip */}
              <rect
                x={LABEL_W}
                y={y}
                width={BAR_W}
                height={STRIP_H}
                rx={STRIP_H / 2}
                fill={isToday ? 'rgba(34,197,94,0.16)' : 'rgba(34,197,94,0.08)'}
              />
            </g>
          )
        })}

        {/* Glow segments */}
        {allSegs.map((seg, i) => {
          const y = stripY(seg.row)
          const w = Math.max(seg.x2 - seg.x1, 2)
          const filterId = seg.glow === TIMELINE_COLORS.sleep ? 'led-glow-purple'
            : seg.glow === '#F59E0B' ? 'led-glow-orange'
            : seg.glow === '#EF4444' ? 'led-glow-red'
            : 'led-glow-green'
          return (
            <rect
              key={i}
              x={seg.x1}
              y={y}
              width={w}
              height={STRIP_H}
              rx={STRIP_H / 2}
              fill={seg.color}
              filter={`url(#${filterId})`}
            />
          )
        })}

        {/* Current time marker */}
        {todayRow >= 0 && (
          <>
            <line
              x1={nowX}
              y1={12}
              x2={nowX}
              y2={TOTAL_H}
              stroke={TIMELINE_COLORS.exceptionBg}
              strokeWidth={1}
              opacity={0.5}
            />
            <circle
              cx={nowX}
              cy={stripY(todayRow) + STRIP_H / 2}
              r={4}
              fill={TIMELINE_COLORS.exceptionBg}
              opacity={0.9}
            />
          </>
        )}
      </svg>

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
        <LegendItem color={TIMELINE_COLORS.sleep} label="Sleep" variant="led" />
        <LegendItem color={TIMELINE_COLORS.awake} label="Awake" variant="led" />
        {overrides && overrides.some(o => o.overrideType === 'stay_awake') && (
          <LegendItem color={TIMELINE_COLORS.override} label="Stay awake" variant="led" />
        )}
        {overrides && overrides.some(o => o.overrideType === 'force_sleep') && (
          <LegendItem color={TIMELINE_COLORS.exception} label="Force sleep" variant="led" />
        )}
        {exceptions && exceptions.some(e => e.exceptionType === 'stay_awake') && (
          <LegendItem color={TIMELINE_COLORS.awake} label="Exception" variant="led" />
        )}
      </Box>
    </Box>
  )
}
