'use client'

import React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { SleepWindow, PolicyOverride, ScheduledException } from '@/lib/types'
import { timeToHours, isOvernight, nowInTimezone } from '@/lib/windowUtils'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DOW_MAP = [1, 2, 3, 4, 5, 6, 0] // index → JS day-of-week

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
  for (const w of windows) {
    for (const dow of w.daysOfWeek) {
      const row = DOW_MAP.indexOf(dow)
      if (row === -1) continue

      if (w.allDay) {
        segs.push({ row, x1: hourToX(0), x2: hourToX(24), color: 'rgba(124,58,237,0.55)', glow: '#7C3AED' })
      } else {
        const startH = timeToHours(w.startTime)
        const endH = timeToHours(w.endTime)
        if (isOvernight(w)) {
          segs.push({ row, x1: hourToX(startH), x2: hourToX(24), color: 'rgba(124,58,237,0.55)', glow: '#7C3AED' })
          const nextRow = (row + 1) % 7
          segs.push({ row: nextRow, x1: hourToX(0), x2: hourToX(endH), color: 'rgba(124,58,237,0.55)', glow: '#7C3AED' })
        } else {
          segs.push({ row, x1: hourToX(startH), x2: hourToX(endH), color: 'rgba(124,58,237,0.55)', glow: '#7C3AED' })
        }
      }
    }
  }
  return segs
}

function overrideSegments(overrides: PolicyOverride[], tz?: string): Segment[] {
  if (!overrides) return []
  const segs: Segment[] = []
  for (const ov of overrides) {
    if (!ov.startsAt || !ov.endsAt) continue
    const color = ov.overrideType === 'force_sleep' ? 'rgba(239,68,68,0.55)' : 'rgba(245,158,11,0.55)'
    const glow = ov.overrideType === 'force_sleep' ? '#EF4444' : '#F59E0B'
    const start = toTZ(ov.startsAt, tz)
    const end = toTZ(ov.endsAt, tz)
    addTimeRangeSegments(segs, start, end, color, glow)
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
    const start = toTZ(ex.startsAt, tz)
    const end = toTZ(ex.endsAt, tz)
    addTimeRangeSegments(segs, start, end, color, glow)
  }
  return segs
}

function toTZ(iso: string, tz?: string): Date {
  const d = new Date(iso)
  if (!tz) return d
  return new Date(d.toLocaleString('en-US', { timeZone: tz }))
}

function addTimeRangeSegments(segs: Segment[], start: Date, end: Date, color: string, glow: string) {
  const cursor = new Date(start)
  cursor.setHours(0, 0, 0, 0)
  const endDay = new Date(end)
  endDay.setHours(0, 0, 0, 0)

  while (cursor <= endDay) {
    const row = DOW_MAP.indexOf(cursor.getDay())
    if (row !== -1) {
      const isStart = cursor.getTime() === new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()
      const isEnd = cursor.getTime() === endDay.getTime()
      const sh = isStart ? start.getHours() + start.getMinutes() / 60 : 0
      const eh = isEnd ? end.getHours() + end.getMinutes() / 60 : 24
      if (eh > sh) {
        segs.push({ row, x1: hourToX(sh), x2: hourToX(eh), color, glow })
      }
    }
    cursor.setDate(cursor.getDate() + 1)
  }
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
          const filterId = seg.glow === '#7C3AED' ? 'led-glow-purple'
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
              stroke="#f87171"
              strokeWidth={1}
              opacity={0.5}
            />
            <circle
              cx={nowX}
              cy={stripY(todayRow) + STRIP_H / 2}
              r={4}
              fill="#f87171"
              opacity={0.9}
            />
          </>
        )}
      </svg>

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
        <LegendItem color="#7C3AED" label="Sleep" />
        <LegendItem color="#22C55E" label="Awake" />
        {overrides && overrides.some(o => o.overrideType === 'stay_awake') && (
          <LegendItem color="#F59E0B" label="Stay awake" />
        )}
        {overrides && overrides.some(o => o.overrideType === 'force_sleep') && (
          <LegendItem color="#EF4444" label="Force sleep" />
        )}
        {exceptions && exceptions.some(e => e.exceptionType === 'stay_awake') && (
          <LegendItem color="#22C55E" label="Exception" />
        )}
      </Box>
    </Box>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Box sx={{
        width: 12,
        height: 4,
        borderRadius: 2,
        bgcolor: color,
        boxShadow: `0 0 6px ${color}`,
      }} />
      <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11 }}>
        {label}
      </Typography>
    </Box>
  )
}
