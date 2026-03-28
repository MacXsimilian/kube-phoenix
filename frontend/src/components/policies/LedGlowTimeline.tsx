'use client'

import React from 'react'
import Box from '@mui/material/Box'
import type { SleepWindow, PolicyOverride, ScheduledException } from '@/lib/types'
import { nowInTimezone, DOW_MAP } from '@/lib/windowUtils'
import { TIMELINE_COLORS } from '@/lib/colors'
import LegendItem from './LegendItem'
import { computeWindowSegments, computeOverrideSegments, computeExceptionSegments, type TimelineSegment } from './timelineSegments'

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

// ── Glow filter definitions generated from a single array ────────────────────

const GLOW_COLORS = [
  { id: 'led-glow-purple', stdDeviation: 3 },
  { id: 'led-glow-orange', stdDeviation: 2.5 },
  { id: 'led-glow-red',    stdDeviation: 2.5 },
  { id: 'led-glow-green',  stdDeviation: 2.5 },
] as const

const VARIANT_TO_GLOW: Record<string, string> = {
  sleep: 'led-glow-purple',
  override: 'led-glow-orange',
  exception: 'led-glow-red',
  awake: 'led-glow-green',
}

/** Map shared segment variant to LED-specific glow color */
function ledColor(seg: TimelineSegment): string {
  if (seg.variant === 'sleep') return TIMELINE_COLORS.sleepGlow
  if (seg.variant === 'override') return 'rgba(245,158,11,0.55)'
  if (seg.variant === 'exception') return 'rgba(239,68,68,0.55)'
  return 'rgba(34,197,94,0.55)'
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
    ...computeWindowSegments(windows),
    ...computeOverrideSegments(overrides ?? [], timezone),
    ...computeExceptionSegments(exceptions ?? [], timezone),
  ]

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <svg width="100%" viewBox={`0 0 ${TOTAL_W} ${TOTAL_H}`} style={{ display: 'block' }}>
        <defs>
          {GLOW_COLORS.map(({ id, stdDeviation }) => (
            <filter key={id} id={id} x="-20%" y="-100%" width="140%" height="300%">
              <feGaussianBlur in="SourceGraphic" stdDeviation={stdDeviation} result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          ))}
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
          const x1 = hourToX(seg.startHour)
          const x2 = hourToX(seg.endHour)
          const w = Math.max(x2 - x1, 2)
          const filterId = VARIANT_TO_GLOW[seg.variant] ?? 'led-glow-green'
          return (
            <rect
              key={i}
              x={x1}
              y={y}
              width={w}
              height={STRIP_H}
              rx={STRIP_H / 2}
              fill={ledColor(seg)}
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
