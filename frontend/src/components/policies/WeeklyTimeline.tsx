'use client'

import React from 'react'
import Box from '@mui/material/Box'
import type { SleepWindow, PolicyOverride, ScheduledException } from '@/lib/types'
import { useTheme } from '@mui/material/styles'
import { nowInTimezone, DOW_MAP } from '@/lib/windowUtils'
import { TIMELINE_COLORS } from '@/lib/colors'
import LegendItem from './LegendItem'
import { computeWindowSegments, computeOverrideSegments, computeExceptionSegments } from './timelineSegments'

const ROW_H = 24
const LABEL_W = 36
const BAR_W = 480
const TOTAL_W = LABEL_W + BAR_W
const TOTAL_H = 7 * ROW_H + 20 // 7 rows + header

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function hourToX(h: number): number {
  return LABEL_W + (h / 24) * BAR_W
}

function rowY(row: number): number {
  return 18 + row * ROW_H
}

const VARIANT_OPACITY: Record<string, number> = {
  sleep: 0.45,
  override: 0.35,
  exception: 0.35,
  awake: 0.3,
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
  const isDark = useTheme().palette.mode === 'dark'
  if (!windows || windows.length === 0) return null

  const { dayOfWeek, fractionalHour: nowH } = nowInTimezone(timezone)
  const todayRow = DOW_MAP.indexOf(dayOfWeek)
  const nowX = hourToX(nowH)

  const allSegs = [
    ...computeWindowSegments(windows),
    ...computeOverrideSegments(overrides ?? [], timezone),
    ...computeExceptionSegments(exceptions ?? [], timezone),
  ]

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <svg width="100%" viewBox={`0 0 ${TOTAL_W} ${TOTAL_H}`} style={{ display: 'block' }}>
        {/* Hour labels */}
        {[0, 3, 6, 9, 12, 15, 18, 21].map(h => (
          <text
            key={h}
            x={hourToX(h)}
            y={12}
            textAnchor="middle"
            fill={isDark ? 'rgba(148,163,184,0.5)' : 'rgba(71,85,105,0.5)'}
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
                fill={isToday ? (isDark ? '#e2e8f0' : '#1E293B') : (isDark ? 'rgba(148,163,184,0.5)' : 'rgba(71,85,105,0.5)')}
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
        {allSegs.map((seg, i) => (
          <rect
            key={i}
            x={hourToX(seg.startHour)}
            y={rowY(seg.row) + 1}
            width={Math.max(hourToX(seg.endHour) - hourToX(seg.startHour), 1)}
            height={ROW_H - 4}
            rx={2}
            fill={seg.color}
            opacity={VARIANT_OPACITY[seg.variant] ?? 0.35}
          />
        ))}

        {/* Current time marker */}
        {todayRow >= 0 && (
          <line
            x1={nowX}
            y1={16}
            x2={nowX}
            y2={TOTAL_H}
            stroke={TIMELINE_COLORS.exceptionBg}
            strokeWidth={1.5}
            opacity={0.7}
          />
        )}
      </svg>

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 2, mt: 0.75 }}>
        <LegendItem color={TIMELINE_COLORS.sleep} label="Sleep" />
        <LegendItem color={TIMELINE_COLORS.awake} label="Awake" />
        {overrides && overrides.some(o => o.overrideType === 'stay_awake') && (
          <LegendItem color={TIMELINE_COLORS.override} label="Stay awake" />
        )}
        {overrides && overrides.some(o => o.overrideType === 'force_sleep') && (
          <LegendItem color={TIMELINE_COLORS.exception} label="Force sleep" />
        )}
        {exceptions && exceptions.some(e => e.exceptionType === 'stay_awake') && (
          <LegendItem color={TIMELINE_COLORS.awake} label="Exception" />
        )}
      </Box>
    </Box>
  )
}
