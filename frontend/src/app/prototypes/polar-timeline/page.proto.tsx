'use client'

// PROTOTYPE: eCharts Polar Timeline
// DEPS: echarts echarts-for-react framer-motion
// LIBS: eCharts, Framer Motion
// DATA: Policy schedules, sleep windows, exceptions
// DESCRIPTION: 24-hour policy schedule as a polar/radial clock chart

import { useState, useEffect, useRef, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Slider from '@mui/material/Slider'
import Chip from '@mui/material/Chip'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import SpeedIcon from '@mui/icons-material/Speed'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import * as echarts from 'echarts'
import { darkTheme } from '@/lib/motion/echartsTheme'

echarts.registerTheme('kube-phoenix-dark', darkTheme)

// ── Interfaces ─────────────────────────────────────────────────────────────

interface TimeWindow {
  startHour: number
  endHour: number
}

interface PolicySchedule {
  name: string
  sleepWindows: TimeWindow[]
  savingsPerMinute: number
  color: string
  sleepColor: string
}

interface ScheduleException {
  name: string
  type: 'stay_awake' | 'force_sleep'
  policyIndex: number
  startHour: number
  endHour: number
  color: string
  reason: string
}

// ── Mock Data ──────────────────────────────────────────────────────────────

const POLICIES: PolicySchedule[] = [
  {
    name: 'Non-production Sleep',
    sleepWindows: [{ startHour: 19, endHour: 7 }],
    savingsPerMinute: 0.43,
    color: 'rgba(34, 197, 94, 0.25)',
    sleepColor: '#1E3A5F',
  },
  {
    name: 'ML Training Shutdown',
    sleepWindows: [{ startHour: 22, endHour: 6 }],
    savingsPerMinute: 0.18,
    color: 'rgba(96, 165, 250, 0.25)',
    sleepColor: '#1B2E4A',
  },
  {
    name: 'Weekend Full Sleep',
    sleepWindows: [{ startHour: 0, endHour: 24 }],
    savingsPerMinute: 0.31,
    color: 'rgba(168, 85, 247, 0.25)',
    sleepColor: '#2D1B4E',
  },
]

const EXCEPTIONS: ScheduleException[] = [
  {
    name: 'Staging Deploy Window',
    type: 'stay_awake',
    policyIndex: 0,
    startHour: 19,
    endHour: 23,
    color: '#FBBF24',
    reason: 'Wed deployment window',
  },
  {
    name: 'Dev Sandbox Early Shutdown',
    type: 'force_sleep',
    policyIndex: 0,
    startHour: 17,
    endHour: 19,
    color: '#DC2626',
    reason: 'Mon early shutdown',
  },
]

const RING_INNER_RADIUS = 35
const RING_WIDTH = 16
const RING_GAP = 4

// ── Helpers ────────────────────────────────────────────────────────────────

function formatHour(hour: number): string {
  const h = Math.floor(hour) % 24
  const m = Math.round((hour % 1) * 60)
  const period = h >= 12 ? 'PM' : 'AM'
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m > 0 ? `${display}:${m.toString().padStart(2, '0')} ${period}` : `${display} ${period}`
}

function getCurrentHourDecimal(): number {
  const now = new Date()
  return now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600
}

function findNextTransition(currentHour: number, policy: PolicySchedule): { hour: number; type: string } | null {
  for (const window of policy.sleepWindows) {
    if (window.startHour === 0 && window.endHour === 24) return null

    const isInSleep = window.endHour > window.startHour
      ? currentHour >= window.startHour && currentHour < window.endHour
      : currentHour >= window.startHour || currentHour < window.endHour

    if (isInSleep) {
      return { hour: window.endHour, type: 'wake' }
    }

    let hoursToStart = window.startHour - currentHour
    if (hoursToStart < 0) hoursToStart += 24
    let hoursToEnd = window.endHour - currentHour
    if (hoursToEnd < 0) hoursToEnd += 24

    if (hoursToStart < hoursToEnd) {
      return { hour: window.startHour, type: 'sleep' }
    }
    return { hour: window.endHour, type: 'wake' }
  }
  return null
}

// ── Chart Builder ──────────────────────────────────────────────────────────

function buildChartOption(currentHour: number): echarts.EChartsOption {
  const series: Record<string, unknown>[] = []

  POLICIES.forEach((policy, ringIndex) => {
    const innerR = RING_INNER_RADIUS + ringIndex * (RING_WIDTH + RING_GAP)
    const outerR = innerR + RING_WIDTH

    series.push({
      type: 'custom',
      coordinateSystem: 'polar',
      renderItem: (_params: unknown, api: { coord: (v: number[]) => number[]; size: (v: number[]) => number[] }) => {
        const cx = api.coord([0, 0])[0]
        const cy = api.coord([0, 0])[1]
        const chartSize = Math.min(api.size([0, 0])[0], api.size([0, 0])[1]) * 2.8

        const innerPx = (innerR / 100) * chartSize
        const outerPx = (outerR / 100) * chartSize

        const children: Record<string, unknown>[] = []

        children.push({
          type: 'sector',
          shape: {
            cx, cy,
            r: outerPx,
            r0: innerPx,
            startAngle: 0,
            endAngle: Math.PI * 2,
          },
          style: {
            fill: policy.color,
            stroke: 'rgba(255,255,255,0.06)',
            lineWidth: 0.5,
          },
        })

        policy.sleepWindows.forEach((window) => {
          const startAngle = ((window.startHour / 24) * Math.PI * 2) - Math.PI / 2
          const endHourNorm = window.endHour <= window.startHour && window.endHour !== 24
            ? window.endHour + 24
            : window.endHour
          const endAngle = ((endHourNorm / 24) * Math.PI * 2) - Math.PI / 2

          children.push({
            type: 'sector',
            shape: {
              cx, cy,
              r: outerPx,
              r0: innerPx,
              startAngle,
              endAngle,
            },
            style: {
              fill: policy.sleepColor,
              stroke: 'rgba(255,255,255,0.08)',
              lineWidth: 0.5,
            },
          })
        })

        EXCEPTIONS.filter(ex => ex.policyIndex === ringIndex).forEach((exception) => {
          const startAngle = ((exception.startHour / 24) * Math.PI * 2) - Math.PI / 2
          const endAngle = ((exception.endHour / 24) * Math.PI * 2) - Math.PI / 2

          children.push({
            type: 'sector',
            shape: {
              cx, cy,
              r: outerPx,
              r0: innerPx,
              startAngle,
              endAngle,
            },
            style: {
              fill: exception.type === 'stay_awake'
                ? 'rgba(251, 191, 36, 0.45)'
                : 'rgba(220, 38, 38, 0.45)',
              stroke: exception.color,
              lineWidth: 1.5,
              lineDash: [4, 3],
            },
          })
        })

        return { type: 'group', children }
      },
      data: [[0, 0]],
      z: 10 + ringIndex,
      silent: true,
      animation: true,
      animationDuration: 1500,
      animationEasing: 'cubicOut',
    })
  })

  const sweepAngle = ((currentHour / 24) * Math.PI * 2) - Math.PI / 2
  const outerMostR = RING_INNER_RADIUS + POLICIES.length * (RING_WIDTH + RING_GAP) + 4

  series.push({
    type: 'custom',
    coordinateSystem: 'polar',
    renderItem: (_params: unknown, api: { coord: (v: number[]) => number[]; size: (v: number[]) => number[] }) => {
      const cx = api.coord([0, 0])[0]
      const cy = api.coord([0, 0])[1]
      const chartSize = Math.min(api.size([0, 0])[0], api.size([0, 0])[1]) * 2.8

      const handLength = (outerMostR / 100) * chartSize
      const innerCircle = ((RING_INNER_RADIUS - 6) / 100) * chartSize

      const tipX = cx + Math.cos(sweepAngle) * handLength
      const tipY = cy + Math.sin(sweepAngle) * handLength
      const startX = cx + Math.cos(sweepAngle) * innerCircle
      const startY = cy + Math.sin(sweepAngle) * innerCircle

      return {
        type: 'group',
        children: [
          {
            type: 'line',
            shape: { x1: startX, y1: startY, x2: tipX, y2: tipY },
            style: {
              stroke: '#F97316',
              lineWidth: 2.5,
              shadowColor: 'rgba(249, 115, 22, 0.6)',
              shadowBlur: 8,
            },
          },
          {
            type: 'circle',
            shape: { cx: tipX, cy: tipY, r: 4 },
            style: {
              fill: '#F97316',
              shadowColor: 'rgba(249, 115, 22, 0.8)',
              shadowBlur: 12,
            },
          },
          {
            type: 'circle',
            shape: { cx, cy, r: 5 },
            style: { fill: '#F97316' },
          },
        ],
      }
    },
    data: [[0, 0]],
    z: 100,
    silent: true,
    animation: false,
  })

  series.push({
    type: 'custom',
    coordinateSystem: 'polar',
    renderItem: (_params: unknown, api: { coord: (v: number[]) => number[] }) => {
      const cx = api.coord([0, 0])[0]
      const cy = api.coord([0, 0])[1]

      const children: Record<string, unknown>[] = []

      for (let h = 0; h < 24; h += 3) {
        const angle = ((h / 24) * Math.PI * 2) - Math.PI / 2
        const labelDist = 195

        children.push({
          type: 'text',
          style: {
            text: `${h.toString().padStart(2, '0')}:00`,
            x: cx + Math.cos(angle) * labelDist,
            y: cy + Math.sin(angle) * labelDist,
            fill: '#94A3B8',
            fontSize: 10,
            fontFamily: '"JetBrains Mono", monospace',
            align: 'center',
            verticalAlign: 'middle',
          },
        })

        for (let tick = 1; tick <= 2; tick++) {
          const tickH = h + tick
          const tickAngle = ((tickH / 24) * Math.PI * 2) - Math.PI / 2
          const tickInner = 185
          const tickOuter = 190

          children.push({
            type: 'line',
            shape: {
              x1: cx + Math.cos(tickAngle) * tickInner,
              y1: cy + Math.sin(tickAngle) * tickInner,
              x2: cx + Math.cos(tickAngle) * tickOuter,
              y2: cy + Math.sin(tickAngle) * tickOuter,
            },
            style: { stroke: 'rgba(148, 163, 184, 0.3)', lineWidth: 1 },
          })
        }
      }

      const timeText = formatHour(currentHour)
      children.push({
        type: 'text',
        style: {
          text: timeText,
          x: cx,
          y: cy,
          fill: '#F97316',
          fontSize: 14,
          fontWeight: 'bold',
          fontFamily: '"JetBrains Mono", monospace',
          align: 'center',
          verticalAlign: 'middle',
        },
      })

      return { type: 'group', children }
    },
    data: [[0, 0]],
    z: 50,
    silent: true,
    animation: false,
  })

  return {
    polar: { radius: ['0%', '85%'] },
    angleAxis: {
      type: 'value',
      min: 0,
      max: 360,
      startAngle: 90,
      clockwise: true,
      show: false,
    },
    radiusAxis: { show: false, min: 0, max: 1 },
    tooltip: { show: false },
    series,
  }
}

// ── Tooltip Panel ──────────────────────────────────────────────────────────

interface TooltipInfo {
  policyName: string
  windowType: 'sleep' | 'awake' | 'exception'
  startHour: number
  endHour: number
  savings: number
  exceptionName?: string
  exceptionReason?: string
}

function findHoveredSegment(
  hour: number,
  ringIndex: number,
): TooltipInfo | null {
  if (ringIndex < 0 || ringIndex >= POLICIES.length) return null
  const policy = POLICIES[ringIndex]

  const matchingException = EXCEPTIONS.find(ex =>
    ex.policyIndex === ringIndex &&
    hour >= ex.startHour &&
    hour < ex.endHour
  )

  if (matchingException) {
    return {
      policyName: policy.name,
      windowType: 'exception',
      startHour: matchingException.startHour,
      endHour: matchingException.endHour,
      savings: policy.savingsPerMinute,
      exceptionName: matchingException.name,
      exceptionReason: matchingException.reason,
    }
  }

  for (const window of policy.sleepWindows) {
    const isInSleep = window.endHour > window.startHour
      ? hour >= window.startHour && hour < window.endHour
      : hour >= window.startHour || hour < window.endHour

    if (window.startHour === 0 && window.endHour === 24) {
      return {
        policyName: policy.name,
        windowType: 'sleep',
        startHour: window.startHour,
        endHour: window.endHour,
        savings: policy.savingsPerMinute,
      }
    }

    if (isInSleep) {
      return {
        policyName: policy.name,
        windowType: 'sleep',
        startHour: window.startHour,
        endHour: window.endHour,
        savings: policy.savingsPerMinute,
      }
    }
  }

  return {
    policyName: policy.name,
    windowType: 'awake',
    startHour: 0,
    endHour: 0,
    savings: 0,
  }
}

// ── Legend Card ─────────────────────────────────────────────────────────────

function LegendCard({
  policy,
  ringIndex,
  currentHour,
}: {
  policy: PolicySchedule
  ringIndex: number
  currentHour: number
}) {
  const transition = findNextTransition(currentHour, policy)
  const isAllDay = policy.sleepWindows.some(w => w.startHour === 0 && w.endHour === 24)

  let hoursUntil = 0
  if (transition) {
    hoursUntil = transition.hour - currentHour
    if (hoursUntil < 0) hoursUntil += 24
  }

  const exceptions = EXCEPTIONS.filter(ex => ex.policyIndex === ringIndex)
  const ringLabel = ringIndex === 0 ? 'Inner' : ringIndex === 1 ? 'Middle' : 'Outer'

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Box
          sx={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            bgcolor: policy.sleepColor,
            border: '2px solid',
            borderColor: 'rgba(255,255,255,0.2)',
          }}
        />
        <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 12, flex: 1 }}>
          {policy.name}
        </Typography>
        <Chip label={ringLabel} size="small" sx={{ height: 20, fontSize: 10 }} />
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Sleep: {policy.sleepWindows.map(w =>
            w.startHour === 0 && w.endHour === 24
              ? 'All day'
              : `${formatHour(w.startHour)} – ${formatHour(w.endHour)}`
          ).join(', ')}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Typography
          variant="caption"
          sx={{
            fontFamily: 'monospace',
            fontSize: 11,
            color: '#22C55E',
          }}
        >
          ${policy.savingsPerMinute.toFixed(2)}/min
        </Typography>

        {transition && !isAllDay && (
          <Typography
            variant="caption"
            sx={{
              fontFamily: 'monospace',
              fontSize: 11,
              color: transition.type === 'sleep' ? '#3B82F6' : '#F59E0B',
            }}
          >
            → {transition.type === 'sleep' ? '🌙' : '☀️'} in {hoursUntil.toFixed(1)}h
          </Typography>
        )}

        {isAllDay && (
          <Typography
            variant="caption"
            sx={{ fontFamily: 'monospace', fontSize: 11, color: '#7C3AED' }}
          >
            All-day sleep
          </Typography>
        )}
      </Box>

      {exceptions.length > 0 && (
        <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
          {exceptions.map(ex => (
            <Box key={ex.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: ex.color,
                }}
              />
              <Typography variant="caption" sx={{ fontSize: 10, color: 'text.secondary' }}>
                {ex.name}: {formatHour(ex.startHour)} – {formatHour(ex.endHour)}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function PolarTimelinePrototype() {
  const router = useRouter()
  const chartRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<echarts.ECharts | null>(null)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [currentHour, setCurrentHour] = useState(getCurrentHourDecimal)
  const [tooltipInfo, setTooltipInfo] = useState<TooltipInfo | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const currentHourRef = useRef(currentHour)

  currentHourRef.current = currentHour

  const updateChart = useCallback(() => {
    const chart = instanceRef.current
    if (!chart) return
    chart.setOption(buildChartOption(currentHourRef.current), { replaceMerge: ['series'] })
  }, [])

  useEffect(() => {
    if (!chartRef.current) return

    instanceRef.current?.dispose()
    const chart = echarts.init(chartRef.current, 'kube-phoenix-dark', { renderer: 'canvas' })
    instanceRef.current = chart
    chart.setOption(buildChartOption(currentHour))

    const ob = new ResizeObserver(() => chart.resize())
    ob.observe(chartRef.current)

    return () => {
      ob.disconnect()
      chart.dispose()
      instanceRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!playing) return

    const intervalMs = 1000 / speed
    const hourIncrement = (1 / 3600) * speed

    const interval = setInterval(() => {
      setCurrentHour(prev => {
        const next = (prev + hourIncrement) % 24
        currentHourRef.current = next
        return next
      })
    }, intervalMs)

    return () => clearInterval(interval)
  }, [playing, speed])

  useEffect(() => {
    updateChart()
  }, [currentHour, updateChart])

  const handleReset = useCallback(() => {
    const now = getCurrentHourDecimal()
    setCurrentHour(now)
    currentHourRef.current = now
  }, [])

  const handleChartMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left - rect.width / 2
    const y = event.clientY - rect.top - rect.height / 2

    const distance = Math.sqrt(x * x + y * y)
    const chartRadius = Math.min(rect.width, rect.height) / 2 * 0.85

    let angle = Math.atan2(y, x) + Math.PI / 2
    if (angle < 0) angle += Math.PI * 2
    const hoveredHour = (angle / (Math.PI * 2)) * 24

    const normalizedDist = distance / chartRadius
    const ringUnit = (RING_WIDTH + RING_GAP) / 100
    const baseOffset = RING_INNER_RADIUS / 100

    let ringIndex = -1
    if (normalizedDist >= baseOffset && normalizedDist < baseOffset + POLICIES.length * ringUnit) {
      ringIndex = Math.floor((normalizedDist - baseOffset) / ringUnit)
    }

    if (ringIndex >= 0 && ringIndex < POLICIES.length) {
      const info = findHoveredSegment(hoveredHour, ringIndex)
      setTooltipInfo(info)
      setTooltipPos({ x: event.clientX, y: event.clientY })
    } else {
      setTooltipInfo(null)
    }
  }, [])

  const handleChartMouseLeave = useCallback(() => {
    setTooltipInfo(null)
  }, [])

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>
            J8 — Polar Timeline
          </Typography>
          <Typography variant="body2" color="text.secondary">
            24-hour policy schedule as a polar/radial clock — sleep windows, exceptions, live sweep hand
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 280px' },
          gap: 3,
          mb: 10,
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <Box
            sx={{
              position: 'relative',
              borderRadius: 3,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              overflow: 'hidden',
            }}
          >
            <Box
              ref={chartRef}
              onMouseMove={handleChartMouseMove}
              onMouseLeave={handleChartMouseLeave}
              sx={{ width: '100%', height: 480 }}
            />
          </Box>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
              Policy Rings
            </Typography>

            {POLICIES.map((policy, i) => (
              <LegendCard
                key={policy.name}
                policy={policy}
                ringIndex={i}
                currentHour={currentHour}
              />
            ))}

            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                Legend
              </Typography>
              <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {[
                  { color: '#1E3A5F', label: 'Sleep window' },
                  { color: 'rgba(34, 197, 94, 0.25)', label: 'Awake window' },
                  { color: 'rgba(251, 191, 36, 0.45)', label: 'Stay-awake exception', border: '#FBBF24' },
                  { color: 'rgba(220, 38, 38, 0.45)', label: 'Force-sleep exception', border: '#DC2626' },
                  { color: '#F97316', label: 'Current time' },
                ].map(item => (
                  <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: 1,
                        bgcolor: item.color,
                        border: item.border ? `1.5px dashed ${item.border}` : undefined,
                      }}
                    />
                    <Typography variant="caption" sx={{ fontSize: 11, color: 'text.secondary' }}>
                      {item.label}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </motion.div>
      </Box>

      <AnimatePresence>
        {tooltipInfo && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              left: tooltipPos.x + 16,
              top: tooltipPos.y - 8,
              zIndex: 10000,
              pointerEvents: 'none',
            }}
          >
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: 'rgba(15, 23, 42, 0.95)',
                border: '1px solid',
                borderColor: 'divider',
                backdropFilter: 'blur(8px)',
                minWidth: 180,
              }}
            >
              <Typography variant="caption" fontWeight={700} sx={{ fontSize: 12 }}>
                {tooltipInfo.policyName}
              </Typography>

              {tooltipInfo.windowType === 'exception' && (
                <>
                  <Typography variant="caption" sx={{ display: 'block', fontSize: 11, color: '#FBBF24', mt: 0.5 }}>
                    {tooltipInfo.exceptionName}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', fontSize: 10, color: 'text.secondary' }}>
                    {tooltipInfo.exceptionReason}
                  </Typography>
                </>
              )}

              {tooltipInfo.windowType !== 'awake' && (
                <Typography variant="caption" sx={{ display: 'block', fontSize: 11, color: 'text.secondary', mt: 0.5 }}>
                  {formatHour(tooltipInfo.startHour)} – {formatHour(tooltipInfo.endHour)}
                </Typography>
              )}

              {tooltipInfo.windowType === 'awake' && (
                <Typography variant="caption" sx={{ display: 'block', fontSize: 11, color: '#22C55E', mt: 0.5 }}>
                  Currently awake
                </Typography>
              )}

              {tooltipInfo.savings > 0 && (
                <Typography variant="caption" sx={{ display: 'block', fontSize: 11, color: '#22C55E', mt: 0.5, fontFamily: 'monospace' }}>
                  Est. saving: ${tooltipInfo.savings.toFixed(2)}/min
                </Typography>
              )}
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          bgcolor: 'rgba(15, 23, 42, 0.92)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid',
          borderColor: 'divider',
          px: 3,
          py: 1.5,
        }}
      >
        <Box sx={{ maxWidth: 960, mx: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="caption" fontWeight={700} sx={{ color: 'text.secondary', minWidth: 80 }}>
            DEV TOOLBAR
          </Typography>

          <Button
            variant="contained"
            size="small"
            startIcon={playing ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
            onClick={() => setPlaying(p => !p)}
            color={playing ? 'warning' : 'primary'}
            sx={{ minWidth: 100 }}
          >
            {playing ? 'Pause' : 'Play'}
          </Button>

          <IconButton size="small" onClick={handleReset} title="Reset to current time">
            <RestartAltIcon fontSize="small" />
          </IconButton>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, maxWidth: 200 }}>
            <SpeedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            <Slider
              value={speed}
              onChange={(_, v) => setSpeed(v as number)}
              min={0.5}
              max={60}
              step={0.5}
              size="small"
              sx={{ flex: 1 }}
            />
            <Typography variant="caption" sx={{ fontFamily: 'monospace', minWidth: 40, textAlign: 'right' }}>
              {speed}x
            </Typography>
          </Box>

          <Typography
            variant="caption"
            sx={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 13,
              color: '#F97316',
              fontWeight: 700,
            }}
          >
            {formatHour(currentHour)}
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
