'use client'

import { useState, useMemo, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import { useTheme, alpha } from '@mui/material/styles'
import type { IncidentEvent, MetricSnapshot } from '@/lib/observability-types'

interface ErrorTimelineProps {
  events: IncidentEvent[]
  history: MetricSnapshot[]
}

export default function ErrorTimeline({ events, history }: ErrorTimelineProps) {
  const theme = useTheme()

  if (history.length === 0) return null

  const { startMs, endMs } = useTimeRange(history)
  const maxErrorRate = useMaxErrorRate(history)

  return (
    <Box
      sx={{
        height: 32,
        width: '100%',
        borderRadius: 1,
        border: 1,
        borderColor: 'divider',
        bgcolor: alpha(theme.palette.divider, 0.06),
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <TimeLabels startMs={startMs} endMs={endMs} />
      <svg
        width="100%"
        height="100%"
        style={{ position: 'absolute', top: 0, left: 0 }}
        preserveAspectRatio="none"
      >
        {maxErrorRate > 0 && (
          <ErrorRateArea
            history={history}
            startMs={startMs}
            endMs={endMs}
            maxErrorRate={maxErrorRate}
            color={theme.palette.error.main}
          />
        )}
      </svg>
      <EventDots
        events={events}
        startMs={startMs}
        endMs={endMs}
      />
    </Box>
  )
}

function useTimeRange(history: MetricSnapshot[]) {
  return useMemo(() => {
    const startMs = new Date(history[0].timestamp).getTime()
    const endMs = Date.now()
    return { startMs, endMs }
  }, [history])
}

function useMaxErrorRate(history: MetricSnapshot[]) {
  return useMemo(() => {
    let max = 0
    for (const snap of history) {
      if (snap.totalErrorRate > max) max = snap.totalErrorRate
    }
    return max
  }, [history])
}

function TimeLabels({ startMs, endMs }: { startMs: number; endMs: number }) {
  const startLabel = formatTimeLabel(new Date(startMs))
  const endLabel = formatTimeLabel(new Date(endMs))

  return (
    <>
      <Typography
        sx={{
          position: 'absolute',
          left: 4,
          bottom: 1,
          fontSize: 8,
          fontFamily: 'monospace',
          color: 'text.disabled',
          lineHeight: 1,
          zIndex: 2,
          pointerEvents: 'none',
        }}
      >
        {startLabel}
      </Typography>
      <Typography
        sx={{
          position: 'absolute',
          right: 4,
          bottom: 1,
          fontSize: 8,
          fontFamily: 'monospace',
          color: 'text.disabled',
          lineHeight: 1,
          zIndex: 2,
          pointerEvents: 'none',
        }}
      >
        {endLabel}
      </Typography>
    </>
  )
}

interface ErrorRateAreaProps {
  history: MetricSnapshot[]
  startMs: number
  endMs: number
  maxErrorRate: number
  color: string
}

function ErrorRateArea({ history, startMs, endMs, maxErrorRate, color }: ErrorRateAreaProps) {
  const pathD = useMemo(() => {
    const rangeMs = endMs - startMs
    if (rangeMs <= 0) return ''

    const maxHeight = 20
    const points = history.map((snap) => {
      const x = ((new Date(snap.timestamp).getTime() - startMs) / rangeMs) * 100
      const y = 32 - (snap.totalErrorRate / maxErrorRate) * maxHeight
      return { x, y }
    })

    const segments = points.map((p) => `L${p.x},${p.y}`).join(' ')
    const firstX = points[0]?.x ?? 0
    const lastX = points[points.length - 1]?.x ?? 100

    return `M${firstX},32 ${segments} L${lastX},32 Z`
  }, [history, startMs, endMs, maxErrorRate])

  if (!pathD) return null

  return (
    <path
      d={pathD}
      fill={color}
      fillOpacity={0.1}
      vectorEffect="non-scaling-stroke"
    />
  )
}

interface EventDotsProps {
  events: IncidentEvent[]
  startMs: number
  endMs: number
}

function EventDots({ events, startMs, endMs }: EventDotsProps) {
  const rangeMs = endMs - startMs
  if (rangeMs <= 0 || events.length === 0) return null

  return (
    <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
      {events.map((evt) => (
        <EventDot
          key={evt.id}
          event={evt}
          startMs={startMs}
          rangeMs={rangeMs}
        />
      ))}
    </Box>
  )
}

interface EventDotProps {
  event: IncidentEvent
  startMs: number
  rangeMs: number
}

function EventDot({ event, startMs, rangeMs }: EventDotProps) {
  const theme = useTheme()
  const isCritical = event.severity === 'critical'
  const color = isCritical ? theme.palette.error.main : theme.palette.warning.main

  const leftPercent = useMemo(() => {
    const ts = new Date(event.timestamp).getTime()
    return ((ts - startMs) / rangeMs) * 100
  }, [event.timestamp, startMs, rangeMs])

  const tooltipContent = useMemo(() => {
    const time = new Date(event.timestamp).toLocaleTimeString()
    return `${event.message} -- ${time}`
  }, [event.message, event.timestamp])

  return (
    <Tooltip title={tooltipContent} arrow placement="top">
      <Box
        sx={{
          position: 'absolute',
          left: `${leftPercent}%`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 6,
          height: 6,
          borderRadius: '50%',
          bgcolor: color,
          boxShadow: isCritical ? `0 0 4px 1px ${alpha(color, 0.5)}` : 'none',
          cursor: 'pointer',
          zIndex: 1,
        }}
      />
    </Tooltip>
  )
}

function formatTimeLabel(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}
