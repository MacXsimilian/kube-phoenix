'use client'

// PROTOTYPE: Visx Execution Heatmap Calendar
// DEPS: framer-motion gsap
// LIBS: SVG, Framer Motion, GSAP
// DATA: Daily sleep hours over 52 weeks
// DESCRIPTION: GitHub-style contribution heatmap for cluster sleep hours

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Slider from '@mui/material/Slider'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ReplayIcon from '@mui/icons-material/Replay'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DayData {
  date: Date
  dateString: string
  hours: number
  dayOfWeek: number
  weekIndex: number
  isIncident: boolean
  isHoliday: boolean
}

interface HourBlock {
  start: number
  end: number
  label: string
  sleeping: boolean
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CELL_SIZE = 14
const CELL_GAP = 3
const CELL_RADIUS = 2
const WEEKS = 52
const DAYS_PER_WEEK = 7
const TOTAL_DAYS = WEEKS * DAYS_PER_WEEK
const LEFT_LABEL_WIDTH = 36
const TOP_LABEL_HEIGHT = 20
const PHOENIX_ORANGE = '#F97316'
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_LABELS: [number, string][] = [[0, 'Mon'], [2, 'Wed'], [4, 'Fri']]

// ---------------------------------------------------------------------------
// Color Scale
// ---------------------------------------------------------------------------

function lerpColor(a: string, b: string, t: number): string {
  const parseHex = (hex: string) => {
    const h = hex.replace('#', '')
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
  }
  const [ar, ag, ab] = parseHex(a)
  const [br, bg, bb] = parseHex(b)
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const b_ = Math.round(ab + (bb - ab) * t)
  return `rgb(${r},${g},${b_})`
}

function hoursToColor(hours: number, isDark: boolean): string {
  const baseColor = isDark ? '#1E293B' : '#E2E8F0'
  const t = Math.min(Math.max(hours / 24, 0), 1)
  if (t === 0) return baseColor
  const midColor = isDark ? '#7C2D12' : '#FDBA74'
  if (t <= 0.5) return lerpColor(baseColor, midColor, t * 2)
  return lerpColor(midColor, PHOENIX_ORANGE, (t - 0.5) * 2)
}

// ---------------------------------------------------------------------------
// Mock Data Generation
// ---------------------------------------------------------------------------

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function generateMockData(): DayData[] {
  const rand = seededRandom(42)
  const startDate = new Date('2025-04-07')
  const holidays = new Set([14, 45, 92, 183, 184, 185, 245, 335, 336])
  const incidentDays = new Set([23, 67, 112, 198, 267, 301, 349])
  const days: DayData[] = []

  for (let i = 0; i < TOTAL_DAYS; i++) {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + i)
    const dayOfWeek = (date.getDay() + 6) % 7
    const weekIndex = Math.floor(i / 7)
    const isHoliday = holidays.has(i)
    const isIncident = incidentDays.has(i)

    let hours: number
    if (isHoliday) {
      hours = 0
    } else if (isIncident) {
      hours = 4 + Math.floor(rand() * 3)
    } else if (dayOfWeek >= 5) {
      hours = 22 + Math.floor(rand() * 3)
      hours = Math.min(hours, 24)
    } else {
      hours = 10 + Math.floor(rand() * 5)
    }

    const variation = Math.floor(rand() * 5) - 2
    hours = Math.max(0, Math.min(24, hours + variation))

    days.push({
      date,
      dateString: date.toISOString().slice(0, 10),
      hours,
      dayOfWeek,
      weekIndex,
      isIncident,
      isHoliday,
    })
  }

  return days
}

function generateTimelineBlocks(day: DayData): HourBlock[] {
  const blocks: HourBlock[] = []
  if (day.hours === 0) {
    blocks.push({ start: 0, end: 24, label: 'Awake (policy paused)', sleeping: false })
    return blocks
  }
  if (day.hours >= 24) {
    blocks.push({ start: 0, end: 24, label: 'Full sleep', sleeping: true })
    return blocks
  }

  const wakeHour = 7
  const sleepStart = 19 - (day.hours < 12 ? 12 - day.hours : 0)
  const adjustedSleepStart = Math.max(sleepStart, 7)

  blocks.push({ start: 0, end: wakeHour, label: 'Sleeping', sleeping: true })
  blocks.push({ start: wakeHour, end: adjustedSleepStart, label: 'Awake', sleeping: false })
  blocks.push({ start: adjustedSleepStart, end: 24, label: 'Sleeping', sleeping: true })

  return blocks
}

// ---------------------------------------------------------------------------
// Month Label Positions
// ---------------------------------------------------------------------------

function computeMonthLabels(days: DayData[]): { label: string; x: number }[] {
  const labels: { label: string; x: number }[] = []
  let lastMonth = -1

  for (const day of days) {
    const month = day.date.getMonth()
    if (month !== lastMonth && day.dayOfWeek === 0) {
      labels.push({
        label: MONTH_NAMES[month],
        x: LEFT_LABEL_WIDTH + day.weekIndex * (CELL_SIZE + CELL_GAP),
      })
      lastMonth = month
    }
  }

  return labels
}

// ---------------------------------------------------------------------------
// Current Week Detection
// ---------------------------------------------------------------------------

function getCurrentWeekIndex(days: DayData[]): number {
  const now = new Date('2026-04-04')
  for (const day of days) {
    if (day.date.toDateString() === now.toDateString()) return day.weekIndex
  }
  return WEEKS - 1
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

function computeStats(days: DayData[]): { totalHours: number; fullSleepDays: number; saved: number } {
  let totalHours = 0
  let fullSleepDays = 0
  for (const day of days) {
    totalHours += day.hours
    if (day.hours >= 22) fullSleepDays++
  }
  return { totalHours, fullSleepDays, saved: Math.round(totalHours * 16.8) }
}

// ---------------------------------------------------------------------------
// Tooltip Component
// ---------------------------------------------------------------------------

function CellTooltip({ day, position }: { day: DayData; position: { x: number; y: number } }) {
  const statusLabel = day.isHoliday ? 'Holiday (paused)' : day.isIncident ? 'Incident' : day.hours >= 22 ? 'Full sleep' : 'Normal'
  return (
    <Box
      sx={{
        position: 'fixed',
        left: position.x + 16,
        top: position.y - 8,
        zIndex: 9999,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1.5,
        p: 1.5,
        minWidth: 180,
        pointerEvents: 'none',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      }}
    >
      <Typography variant="caption" fontWeight={700} sx={{ display: 'block', mb: 0.5 }}>
        {day.dateString}
      </Typography>
      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
        Sleep: {day.hours}h &middot; Awake: {24 - day.hours}h
      </Typography>
      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
        Status: {statusLabel}
      </Typography>
      <Typography variant="caption" sx={{ display: 'block', color: PHOENIX_ORANGE, fontWeight: 600 }}>
        Saved: ~${(day.hours * 16.8).toFixed(0)}
      </Typography>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Expanded Day Detail
// ---------------------------------------------------------------------------

function DayDetail({ day, onClose }: { day: DayData; onClose: () => void }) {
  const blocks = generateTimelineBlocks(day)
  return (
    <motion.div
      layoutId={`cell-${day.dateString}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <Box
        onClick={onClose}
        sx={{
          p: 2,
          borderRadius: 2,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          cursor: 'pointer',
          mb: 2,
          '&:hover': { borderColor: PHOENIX_ORANGE },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
          <Typography variant="subtitle2" fontWeight={700}>
            {day.dateString}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {day.hours}h sleep &middot; Click to close
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', height: 32, borderRadius: 1, overflow: 'hidden', gap: '1px' }}>
          {blocks.map((block, i) => (
            <Box
              key={i}
              sx={{
                flex: block.end - block.start,
                bgcolor: block.sleeping ? PHOENIX_ORANGE : 'action.hover',
                opacity: block.sleeping ? 0.85 : 0.35,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 0,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: block.sleeping ? '#fff' : 'text.secondary',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  px: 0.5,
                }}
              >
                {block.label}
              </Typography>
            </Box>
          ))}
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
          <Typography variant="caption" color="text.secondary">00:00</Typography>
          <Typography variant="caption" color="text.secondary">06:00</Typography>
          <Typography variant="caption" color="text.secondary">12:00</Typography>
          <Typography variant="caption" color="text.secondary">18:00</Typography>
          <Typography variant="caption" color="text.secondary">24:00</Typography>
        </Box>
      </Box>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Animated Counter
// ---------------------------------------------------------------------------

function AnimatedCounterSpan({ targetValue, prefix, suffix, duration }: {
  targetValue: number
  prefix: string
  suffix: string
  duration: number
}) {
  const spanRef = useRef<HTMLSpanElement>(null)
  const valueRef = useRef({ val: 0 })

  useEffect(() => {
    const obj = valueRef.current
    obj.val = 0
    const tween = gsap.to(obj, {
      val: targetValue,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        if (spanRef.current) {
          spanRef.current.textContent = `${prefix}${Math.round(obj.val).toLocaleString()}${suffix}`
        }
      },
    })
    return () => { tween.kill() }
  }, [targetValue, prefix, suffix, duration])

  return <span ref={spanRef}>{prefix}0{suffix}</span>
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function VisxCalendarPrototype() {
  const router = useRouter()
  const days = useMemo(() => generateMockData(), [])
  const stats = useMemo(() => computeStats(days), [days])
  const monthLabels = useMemo(() => computeMonthLabels(days), [days])
  const currentWeek = useMemo(() => getCurrentWeekIndex(days), [days])

  const [hoveredDay, setHoveredDay] = useState<DayData | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [key, setKey] = useState(0)

  const svgRef = useRef<SVGSVGElement>(null)
  const cellRefs = useRef<(SVGRectElement | null)[]>([])
  const glowTimelineRef = useRef<gsap.core.Timeline | null>(null)
  const entranceTimelineRef = useRef<gsap.core.Timeline | null>(null)
  const isDark = true

  const svgWidth = LEFT_LABEL_WIDTH + WEEKS * (CELL_SIZE + CELL_GAP)
  const svgHeight = TOP_LABEL_HEIGHT + DAYS_PER_WEEK * (CELL_SIZE + CELL_GAP)

  // Entrance animation: stagger wave left-to-right
  useEffect(() => {
    const cells = cellRefs.current.filter(Boolean) as SVGRectElement[]
    if (cells.length === 0) return

    cells.forEach((cell) => {
      gsap.set(cell, { opacity: 0 })
    })

    const tl = gsap.timeline({ paused: !playing })
    tl.to(cells, {
      opacity: 1,
      duration: 0.15,
      stagger: { each: 0.05 / speed, from: 'start' },
      ease: 'power1.out',
    })

    entranceTimelineRef.current = tl
    if (playing) tl.play()

    return () => { tl.kill() }
  }, [key, speed, playing])

  // Glow animation for current week cells
  useEffect(() => {
    const currentWeekCells = cellRefs.current.filter((_, i) => {
      const weekIdx = Math.floor(i / DAYS_PER_WEEK)
      return weekIdx === currentWeek
    }).filter(Boolean) as SVGRectElement[]

    if (currentWeekCells.length === 0) return

    const tl = gsap.timeline({ repeat: -1, yoyo: true, paused: !playing })
    tl.to(currentWeekCells, {
      attr: { 'stroke-width': 2, stroke: PHOENIX_ORANGE },
      duration: 1.5 / speed,
      ease: 'sine.inOut',
    })

    glowTimelineRef.current = tl
    if (playing) tl.play()

    return () => { tl.kill() }
  }, [currentWeek, key, speed, playing])

  // Play/pause control
  useEffect(() => {
    if (playing) {
      entranceTimelineRef.current?.play()
      glowTimelineRef.current?.play()
    } else {
      entranceTimelineRef.current?.pause()
      glowTimelineRef.current?.pause()
    }
  }, [playing])

  const handleCellHover = useCallback((day: DayData, event: React.MouseEvent) => {
    setHoveredDay(day)
    setTooltipPos({ x: event.clientX, y: event.clientY })
  }, [])

  const handleCellLeave = useCallback(() => {
    setHoveredDay(null)
  }, [])

  const handleCellClick = useCallback((day: DayData) => {
    setSelectedDay((prev) => prev?.dateString === day.dateString ? null : day)
  }, [])

  const handleReset = useCallback(() => {
    setSelectedDay(null)
    setHoveredDay(null)
    setKey((k) => k + 1)
  }, [])

  const handleSpeedChange = useCallback((_: Event, value: number | number[]) => {
    setSpeed(value as number)
  }, [])

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', py: 4, px: 2, pb: 12 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>J3 — Visx Execution Heatmap Calendar</Typography>
          <Typography variant="body2" color="text.secondary">
            GitHub-style contribution heatmap for cluster sleep hours — 52 weeks, pure SVG
          </Typography>
        </Box>
      </Box>

      {/* Calendar SVG */}
      <Box
        sx={{
          borderRadius: 2,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          p: 3,
          overflowX: 'auto',
          mb: 3,
        }}
      >
        <svg
          ref={svgRef}
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{ display: 'block' }}
        >
          {/* Month labels */}
          {monthLabels.map(({ label, x }, i) => (
            <text
              key={`month-${i}`}
              x={x}
              y={12}
              fill="currentColor"
              fontSize={10}
              fontFamily="Inter, sans-serif"
              opacity={0.5}
            >
              {label}
            </text>
          ))}

          {/* Day-of-week labels */}
          {DAY_LABELS.map(([rowIndex, label]) => (
            <text
              key={`day-${rowIndex}`}
              x={0}
              y={TOP_LABEL_HEIGHT + rowIndex * (CELL_SIZE + CELL_GAP) + CELL_SIZE * 0.78}
              fill="currentColor"
              fontSize={9}
              fontFamily="Inter, sans-serif"
              opacity={0.4}
            >
              {label}
            </text>
          ))}

          {/* Day cells */}
          {days.map((day, i) => {
            const x = LEFT_LABEL_WIDTH + day.weekIndex * (CELL_SIZE + CELL_GAP)
            const y = TOP_LABEL_HEIGHT + day.dayOfWeek * (CELL_SIZE + CELL_GAP)
            return (
              <rect
                key={day.dateString}
                ref={(el) => { cellRefs.current[i] = el }}
                x={x}
                y={y}
                width={CELL_SIZE}
                height={CELL_SIZE}
                rx={CELL_RADIUS}
                ry={CELL_RADIUS}
                fill={hoursToColor(day.hours, isDark)}
                stroke="transparent"
                strokeWidth={0}
                opacity={0}
                style={{ cursor: 'pointer' }}
                onMouseEnter={(e) => handleCellHover(day, e)}
                onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                onMouseLeave={handleCellLeave}
                onClick={() => handleCellClick(day)}
              />
            )
          })}
        </svg>

        {/* Color scale legend */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, pl: `${LEFT_LABEL_WIDTH}px` }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
            Less
          </Typography>
          {[0, 4, 8, 12, 16, 20, 24].map((h) => (
            <Box
              key={h}
              sx={{
                width: 12,
                height: 12,
                borderRadius: 0.5,
                bgcolor: hoursToColor(h, isDark),
              }}
            />
          ))}
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
            More
          </Typography>
        </Box>
      </Box>

      {/* Expanded day detail */}
      <AnimatePresence mode="wait">
        {selectedDay && (
          <DayDetail
            key={selectedDay.dateString}
            day={selectedDay}
            onClose={() => setSelectedDay(null)}
          />
        )}
      </AnimatePresence>

      {/* Animated stat counters */}
      <Box
        key={key}
        sx={{
          display: 'flex',
          gap: 3,
          justifyContent: 'center',
          flexWrap: 'wrap',
          p: 2.5,
          borderRadius: 2,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h5" fontWeight={800} sx={{ fontFamily: 'monospace', color: PHOENIX_ORANGE }}>
            <AnimatedCounterSpan targetValue={stats.totalHours} prefix="" suffix="" duration={2.6 / speed} />
          </Typography>
          <Typography variant="caption" color="text.secondary">Total sleep hours</Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h5" fontWeight={800} sx={{ fontFamily: 'monospace', color: '#22C55E' }}>
            <AnimatedCounterSpan targetValue={stats.fullSleepDays} prefix="" suffix="" duration={2.6 / speed} />
          </Typography>
          <Typography variant="caption" color="text.secondary">Days fully sleeping</Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h5" fontWeight={800} sx={{ fontFamily: 'monospace', color: '#3B82F6' }}>
            <AnimatedCounterSpan targetValue={stats.saved} prefix="$" suffix="" duration={2.6 / speed} />
          </Typography>
          <Typography variant="caption" color="text.secondary">Estimated savings</Typography>
        </Box>
      </Box>

      {/* Tooltip */}
      {hoveredDay && <CellTooltip day={hoveredDay} position={tooltipPos} />}

      {/* Dev Toolbar — fixed bottom */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          bgcolor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
          px: 3,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
        }}
      >
        <Typography variant="caption" fontWeight={700} sx={{ opacity: 0.5, mr: 1 }}>
          DEV
        </Typography>

        <IconButton
          size="small"
          onClick={() => setPlaying((p) => !p)}
          sx={{ color: playing ? '#22C55E' : 'text.secondary' }}
        >
          {playing ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
        </IconButton>

        <Button
          variant="outlined"
          size="small"
          startIcon={<ReplayIcon fontSize="small" />}
          onClick={handleReset}
        >
          Reset
        </Button>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 180 }}>
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            Speed
          </Typography>
          <Slider
            value={speed}
            onChange={handleSpeedChange}
            min={0.25}
            max={4}
            step={0.25}
            size="small"
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `${v}x`}
            sx={{ flex: 1 }}
          />
          <Typography variant="caption" fontFamily="monospace" sx={{ minWidth: 32, textAlign: 'right' }}>
            {speed}x
          </Typography>
        </Box>

        <Box sx={{ ml: 'auto', display: 'flex', gap: 2 }}>
          <Typography variant="caption" color="text.secondary">
            {TOTAL_DAYS} cells
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {stats.totalHours.toLocaleString()}h total
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
