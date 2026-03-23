'use client'

import React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { SleepWindow, PolicyOverride, ScheduledException } from '@/lib/types'
import { timeToHours, isOvernight, nowInTimezone } from '@/lib/windowUtils'

const ROW_H = 24
const LABEL_W = 36
const BAR_W = 480
const TOTAL_W = LABEL_W + BAR_W
const TOTAL_H = 7 * ROW_H + 20 // 7 rows + header

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DOW_MAP = [1, 2, 3, 4, 5, 6, 0] // index to JS day-of-week

function hourToX(h: number): number {
  return LABEL_W + (h / 24) * BAR_W
}

function rowY(row: number): number {
  return 18 + row * ROW_H
}

interface Block {
  row: number
  x1: number
  x2: number
  color: string
  opacity: number
}

function windowBlocks(windows: SleepWindow[]): Block[] {
  const blocks: Block[] = []
  for (const w of windows) {
    for (const dow of w.daysOfWeek) {
      const row = DOW_MAP.indexOf(dow)
      if (row === -1) continue

      if (w.allDay) {
        blocks.push({ row, x1: hourToX(0), x2: hourToX(24), color: '#7C3AED', opacity: 0.45 })
      } else {
        const startH = timeToHours(w.startTime)
        const endH = timeToHours(w.endTime)
        const overnight = isOvernight(w)
        if (overnight) {
          blocks.push({ row, x1: hourToX(startH), x2: hourToX(24), color: '#7C3AED', opacity: 0.45 })
          const nextRow = (row + 1) % 7
          blocks.push({ row: nextRow, x1: hourToX(0), x2: hourToX(endH), color: '#7C3AED', opacity: 0.45 })
        } else {
          blocks.push({ row, x1: hourToX(startH), x2: hourToX(endH), color: '#7C3AED', opacity: 0.45 })
        }
      }
    }
  }
  return blocks
}

/** Convert an ISO timestamp to a Date in the given timezone. */
function toTZ(iso: string, tz?: string): Date {
  const d = new Date(iso)
  if (!tz) return d
  const str = d.toLocaleString('en-US', { timeZone: tz })
  return new Date(str)
}

function timeRangeBlocks(
  startISO: string, endISO: string, color: string, opacity: number, tz?: string,
): Block[] {
  const blocks: Block[] = []
  const start = toTZ(startISO, tz)
  const end = toTZ(endISO, tz)

  const cursor = new Date(start)
  cursor.setHours(0, 0, 0, 0)
  const endDay = new Date(end)
  endDay.setHours(0, 0, 0, 0)

  while (cursor <= endDay) {
    const row = DOW_MAP.indexOf(cursor.getDay())
    if (row !== -1) {
      const isSameAsStart = cursor.getTime() === new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()
      const isSameAsEnd = cursor.getTime() === endDay.getTime()
      const sh = isSameAsStart ? start.getHours() + start.getMinutes() / 60 : 0
      const eh = isSameAsEnd ? end.getHours() + end.getMinutes() / 60 : 24
      if (eh > sh) {
        blocks.push({ row, x1: hourToX(sh), x2: hourToX(eh), color, opacity })
      }
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return blocks
}

function overrideBlocks(overrides: PolicyOverride[], tz?: string): Block[] {
  if (!overrides) return []
  const blocks: Block[] = []
  for (const ov of overrides) {
    if (!ov.startsAt || !ov.endsAt) continue
    const color = ov.overrideType === 'force_sleep' ? '#ef4444' : '#f59e0b'
    blocks.push(...timeRangeBlocks(ov.startsAt, ov.endsAt, color, 0.35, tz))
  }
  return blocks
}

function exceptionBlocks(exceptions: ScheduledException[], tz?: string): Block[] {
  if (!exceptions) return []
  const blocks: Block[] = []
  for (const ex of exceptions) {
    if (ex.status === 'cancelled' || ex.status === 'completed') continue
    const color = ex.exceptionType === 'force_sleep' ? '#ef4444' : '#22c55e'
    blocks.push(...timeRangeBlocks(ex.startsAt, ex.endsAt, color, 0.3, tz))
  }
  return blocks
}

export default function WeeklyTimeline({
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

  const allBlocks = [
    ...windowBlocks(windows),
    ...overrideBlocks(overrides ?? [], timezone),
    ...exceptionBlocks(exceptions ?? [], timezone),
  ]

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <svg width={TOTAL_W} height={TOTAL_H} style={{ display: 'block' }}>
        {/* Hour labels */}
        {[0, 3, 6, 9, 12, 15, 18, 21].map(h => (
          <text
            key={h}
            x={hourToX(h)}
            y={12}
            textAnchor="middle"
            fill="rgba(148,163,184,0.5)"
            fontSize={9}
            fontFamily="monospace"
          >
            {h}
          </text>
        ))}

        {/* Rows */}
        {DAYS.map((day, row) => {
          const y = rowY(row)
          const isToday = row === todayRow
          return (
            <g key={day}>
              {/* Row background */}
              <rect
                x={LABEL_W}
                y={y}
                width={BAR_W}
                height={ROW_H - 2}
                rx={3}
                fill={isToday ? 'rgba(34,197,94,0.18)' : 'rgba(34,197,94,0.10)'}
              />
              {/* Day label */}
              <text
                x={LABEL_W - 4}
                y={y + ROW_H / 2 + 1}
                textAnchor="end"
                fill={isToday ? '#e2e8f0' : 'rgba(148,163,184,0.5)'}
                fontSize={10}
                fontWeight={isToday ? 600 : 400}
                fontFamily="monospace"
              >
                {day}
              </text>
              {/* Row separator */}
              {row < 6 && (
                <line
                  x1={LABEL_W}
                  y1={y + ROW_H - 1}
                  x2={TOTAL_W}
                  y2={y + ROW_H - 1}
                  stroke="rgba(148,163,184,0.06)"
                />
              )}
            </g>
          )
        })}

        {/* Hour gridlines */}
        {[6, 12, 18].map(h => (
          <line
            key={h}
            x1={hourToX(h)}
            y1={16}
            x2={hourToX(h)}
            y2={TOTAL_H}
            stroke="rgba(148,163,184,0.08)"
            strokeDasharray="2,3"
          />
        ))}

        {/* Blocks */}
        {allBlocks.map((b, i) => (
          <rect
            key={i}
            x={b.x1}
            y={rowY(b.row) + 1}
            width={Math.max(b.x2 - b.x1, 1)}
            height={ROW_H - 4}
            rx={2}
            fill={b.color}
            opacity={b.opacity}
          />
        ))}

        {/* Current time marker */}
        {todayRow >= 0 && (
          <line
            x1={nowX}
            y1={16}
            x2={nowX}
            y2={TOTAL_H}
            stroke="#f87171"
            strokeWidth={1.5}
            opacity={0.7}
          />
        )}
      </svg>

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 2, mt: 0.75 }}>
        <LegendItem color="#7C3AED" label="Sleep" />
        <LegendItem color="#22C55E" label="Awake" />
        {overrides && overrides.some(o => o.overrideType === 'stay_awake') && (
          <LegendItem color="#f59e0b" label="Stay awake" />
        )}
        {overrides && overrides.some(o => o.overrideType === 'force_sleep') && (
          <LegendItem color="#ef4444" label="Force sleep" />
        )}
        {exceptions && exceptions.some(e => e.exceptionType === 'stay_awake') && (
          <LegendItem color="#22c55e" label="Exception" />
        )}
      </Box>
    </Box>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: color, opacity: 0.4 }} />
      <Typography variant="caption" color="text.disabled">
        {label}
      </Typography>
    </Box>
  )
}
