'use client'

// PROTOTYPE: Observable Plot Stream
// DEPS: framer-motion
// LIBS: SVG, Canvas 2D, Framer Motion
// DATA: Streaming metrics (replica counts, HTTP rate, K8s API, WebSocket, exec duration, cache hit)
// DESCRIPTION: Live streaming multi-metric dashboard with 6 small multiples

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import ButtonGroup from '@mui/material/ButtonGroup'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useTheme } from '@mui/material/styles'

// ── Interfaces ──────────────────────────────────────────────────────────────

interface DataPoint {
  time: number
  value: number
}

interface MetricSeries {
  label: string
  color: string
  data: DataPoint[]
}

interface ChartConfig {
  title: string
  unit: string
  series: MetricSeries[]
  yMin: number
  yMax: number
  thresholdHigh: number
}

interface TooltipState {
  visible: boolean
  x: number
  y: number
  time: number
  values: { label: string; color: string; value: number }[]
}

interface SleepWindow {
  start: number
  end: number
}

// ── Constants ───────────────────────────────────────────────────────────────

const ROLLING_WINDOW_MS = 5 * 60 * 1000
const TICK_INTERVAL_MS = 2000
const CHART_WIDTH = 460
const CHART_HEIGHT = 180
const PADDING = { top: 20, right: 16, bottom: 32, left: 56 }
const PLOT_WIDTH = CHART_WIDTH - PADDING.left - PADDING.right
const PLOT_HEIGHT = CHART_HEIGHT - PADDING.top - PADDING.bottom

const METRIC_COLORS = {
  blue: '#3B82F6',
  amber: '#F59E0B',
  green: '#22C55E',
  purple: '#7C3AED',
  red: '#EF4444',
  cyan: '#06B6D4',
  orange: '#F97316',
  pink: '#EC4899',
} as const

// ── Data generation ─────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function generateVariation(baseline: number, variance: number): number {
  const noise = (Math.random() - 0.5) * 2 * variance
  return baseline + noise
}

function isInSleepWindow(time: number, sleepWindows: SleepWindow[]): boolean {
  return sleepWindows.some((w) => time >= w.start && time <= w.end)
}

function createSleepWindows(now: number): SleepWindow[] {
  return [
    { start: now - 4 * 60 * 1000, end: now - 3 * 60 * 1000 },
    { start: now - 1.5 * 60 * 1000, end: now - 0.5 * 60 * 1000 },
  ]
}

function generateInitialData(now: number, sleepWindows: SleepWindow[]): ChartConfig[] {
  const points = Math.floor(ROLLING_WINDOW_MS / TICK_INTERVAL_MS)
  const startTime = now - ROLLING_WINDOW_MS

  function buildSeries(
    label: string,
    color: string,
    baseline: number,
    variance: number,
    sleepFactor: number,
  ): MetricSeries {
    const data: DataPoint[] = []
    for (let i = 0; i < points; i++) {
      const time = startTime + i * TICK_INTERVAL_MS
      const sleeping = isInSleepWindow(time, sleepWindows)
      const value = sleeping
        ? generateVariation(baseline * sleepFactor, variance * 0.3)
        : generateVariation(baseline, variance)
      data.push({ time, value: Math.max(0, value) })
    }
    return { label, color, data }
  }

  return [
    {
      title: 'Replica Counts',
      unit: 'replicas',
      yMin: 0,
      yMax: 25,
      thresholdHigh: 18,
      series: [
        buildSeries('production', METRIC_COLORS.blue, 8, 2, 0.1),
        buildSeries('staging', METRIC_COLORS.amber, 4, 1.5, 0.1),
        buildSeries('dev', METRIC_COLORS.green, 3, 1, 0.1),
      ],
    },
    {
      title: 'HTTP Request Rate',
      unit: 'req/min',
      yMin: 0,
      yMax: 3200,
      thresholdHigh: 2800,
      series: [buildSeries('http-rate', METRIC_COLORS.cyan, 2400, 200, 0.05)],
    },
    {
      title: 'K8s API Calls',
      unit: 'calls/min',
      yMin: 0,
      yMax: 500,
      thresholdHigh: 420,
      series: [buildSeries('api-calls', METRIC_COLORS.purple, 340, 40, 0.15)],
    },
    {
      title: 'WebSocket Connections',
      unit: 'active',
      yMin: 0,
      yMax: 24,
      thresholdHigh: 20,
      series: [buildSeries('websocket', METRIC_COLORS.orange, 14, 3, 0.2)],
    },
    {
      title: 'Execution Duration',
      unit: 'ms',
      yMin: 0,
      yMax: 60,
      thresholdHigh: 45,
      series: [buildSeries('exec-duration', METRIC_COLORS.pink, 23, 8, 0.5)],
    },
    {
      title: 'Cache Hit Ratio',
      unit: 'ratio',
      yMin: 0,
      yMax: 1,
      thresholdHigh: 0.98,
      series: [buildSeries('cache-hit', METRIC_COLORS.green, 0.94, 0.03, 0.6)],
    },
  ]
}

function generateNextPoint(
  series: MetricSeries,
  now: number,
  chartIndex: number,
  sleepWindows: SleepWindow[],
): DataPoint {
  const baselines = [8, 2400, 340, 14, 23, 0.94]
  const variances = [2, 200, 40, 3, 8, 0.03]
  const sleepFactors = [0.1, 0.05, 0.15, 0.2, 0.5, 0.6]
  const sleeping = isInSleepWindow(now, sleepWindows)

  const lastValue = series.data.length > 0 ? series.data[series.data.length - 1].value : baselines[chartIndex]
  const target = sleeping
    ? baselines[chartIndex] * sleepFactors[chartIndex]
    : baselines[chartIndex]

  const drift = (target - lastValue) * 0.3
  const noise = (Math.random() - 0.5) * 2 * variances[chartIndex] * (sleeping ? 0.3 : 1)
  const value = Math.max(0, lastValue + drift + noise)

  return { time: now, value }
}

// ── SVG path interpolation (Catmull-Rom to cubic bezier) ────────────────────

function catmullRomToBezier(points: { x: number; y: number }[], tension: number = 0.5): string {
  if (points.length < 2) return ''
  if (points.length === 2) return `M${points[0].x},${points[0].y}L${points[1].x},${points[1].y}`

  let path = `M${points[0].x},${points[0].y}`

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]

    const cp1x = p1.x + (p2.x - p0.x) / (6 * tension)
    const cp1y = p1.y + (p2.y - p0.y) / (6 * tension)
    const cp2x = p2.x - (p3.x - p1.x) / (6 * tension)
    const cp2y = p2.y - (p3.y - p1.y) / (6 * tension)

    path += `C${cp1x},${cp1y},${cp2x},${cp2y},${p2.x},${p2.y}`
  }

  return path
}

// ── SVG Chart Component ─────────────────────────────────────────────────────

function StreamChart({
  config,
  sleepWindows,
  timeRange,
  isGlowing,
}: {
  config: ChartConfig
  sleepWindows: SleepWindow[]
  timeRange: { min: number; max: number }
  isGlowing: boolean
}) {
  const theme = useTheme()
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    time: 0,
    values: [],
  })
  const svgRef = useRef<SVGSVGElement>(null)

  const gridColor = theme.palette.mode === 'dark'
    ? 'rgba(255,255,255,0.08)'
    : 'rgba(0,0,0,0.08)'
  const textColor = theme.palette.text.secondary
  const bgColor = theme.palette.mode === 'dark'
    ? 'rgba(255,255,255,0.02)'
    : 'rgba(0,0,0,0.02)'
  const sleepBandColor = theme.palette.mode === 'dark'
    ? 'rgba(124,58,237,0.15)'
    : 'rgba(124,58,237,0.1)'

  function scaleX(time: number): number {
    return PADDING.left + ((time - timeRange.min) / (timeRange.max - timeRange.min)) * PLOT_WIDTH
  }

  function scaleY(value: number): number {
    const normalized = (value - config.yMin) / (config.yMax - config.yMin)
    return PADDING.top + PLOT_HEIGHT - normalized * PLOT_HEIGHT
  }

  const yTicks = useMemo(() => {
    const count = 4
    const ticks: number[] = []
    for (let i = 0; i <= count; i++) {
      ticks.push(config.yMin + (config.yMax - config.yMin) * (i / count))
    }
    return ticks
  }, [config.yMin, config.yMax])

  const xTicks = useMemo(() => {
    const count = 5
    const ticks: number[] = []
    for (let i = 0; i <= count; i++) {
      ticks.push(timeRange.min + (timeRange.max - timeRange.min) * (i / count))
    }
    return ticks
  }, [timeRange.min, timeRange.max])

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp)
    return `${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`
  }

  function formatValue(value: number): string {
    if (config.unit === 'ratio') return value.toFixed(2)
    if (config.yMax > 1000) return Math.round(value).toLocaleString()
    return Number.isInteger(value) ? String(value) : value.toFixed(1)
  }

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      if (
        mouseX < PADDING.left ||
        mouseX > CHART_WIDTH - PADDING.right ||
        mouseY < PADDING.top ||
        mouseY > CHART_HEIGHT - PADDING.bottom
      ) {
        setTooltip((prev) => ({ ...prev, visible: false }))
        return
      }

      const timeAtMouse =
        timeRange.min + ((mouseX - PADDING.left) / PLOT_WIDTH) * (timeRange.max - timeRange.min)

      const values = config.series.map((s) => {
        const closest = s.data.reduce((best, pt) =>
          Math.abs(pt.time - timeAtMouse) < Math.abs(best.time - timeAtMouse) ? pt : best,
        )
        return { label: s.label, color: s.color, value: closest.value }
      })

      setTooltip({ visible: true, x: mouseX, y: mouseY, time: timeAtMouse, values })
    },
    [config.series, timeRange],
  )

  const handleMouseLeave = useCallback(() => {
    setTooltip((prev) => ({ ...prev, visible: false }))
  }, [])

  const visibleSleepWindows = sleepWindows.filter(
    (w) => w.end >= timeRange.min && w.start <= timeRange.max,
  )

  return (
    <motion.div
      animate={isGlowing ? { boxShadow: `0 0 20px 4px ${config.series[0].color}40` } : { boxShadow: 'none' }}
      transition={{ duration: 0.6, repeat: isGlowing ? Infinity : 0, repeatType: 'reverse' }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          borderRadius: 2,
          border: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          position: 'relative',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, px: 0.5 }}>
          <Typography variant="caption" fontWeight={600} color="text.primary">
            {config.title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {config.unit}
          </Typography>
        </Box>

        <svg
          ref={svgRef}
          width={CHART_WIDTH}
          height={CHART_HEIGHT}
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          style={{ width: '100%', height: 'auto', cursor: 'crosshair' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <rect
            x={PADDING.left}
            y={PADDING.top}
            width={PLOT_WIDTH}
            height={PLOT_HEIGHT}
            fill={bgColor}
            rx={4}
          />

          {visibleSleepWindows.map((w, i) => {
            const x1 = Math.max(scaleX(w.start), PADDING.left)
            const x2 = Math.min(scaleX(w.end), PADDING.left + PLOT_WIDTH)
            return (
              <rect
                key={i}
                x={x1}
                y={PADDING.top}
                width={Math.max(0, x2 - x1)}
                height={PLOT_HEIGHT}
                fill={sleepBandColor}
              />
            )
          })}

          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={PADDING.left}
                y1={scaleY(tick)}
                x2={PADDING.left + PLOT_WIDTH}
                y2={scaleY(tick)}
                stroke={gridColor}
                strokeDasharray="3,3"
              />
              <text
                x={PADDING.left - 8}
                y={scaleY(tick) + 4}
                textAnchor="end"
                fill={textColor}
                fontSize={10}
              >
                {formatValue(tick)}
              </text>
            </g>
          ))}

          {xTicks.map((tick) => (
            <text
              key={tick}
              x={scaleX(tick)}
              y={CHART_HEIGHT - 6}
              textAnchor="middle"
              fill={textColor}
              fontSize={10}
            >
              {formatTime(tick)}
            </text>
          ))}

          <line
            x1={PADDING.left}
            y1={scaleY(config.thresholdHigh)}
            x2={PADDING.left + PLOT_WIDTH}
            y2={scaleY(config.thresholdHigh)}
            stroke={METRIC_COLORS.red}
            strokeDasharray="6,3"
            strokeOpacity={0.5}
          />

          {config.series.map((s) => {
            const screenPoints = s.data
              .filter((pt) => pt.time >= timeRange.min && pt.time <= timeRange.max)
              .map((pt) => ({
                x: scaleX(pt.time),
                y: scaleY(clamp(pt.value, config.yMin, config.yMax)),
              }))

            if (screenPoints.length < 2) return null

            return (
              <g key={s.label}>
                <path
                  d={catmullRomToBezier(screenPoints)}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx={screenPoints[screenPoints.length - 1].x}
                  cy={screenPoints[screenPoints.length - 1].y}
                  r={3}
                  fill={s.color}
                />
              </g>
            )
          })}

          {tooltip.visible && (
            <line
              x1={tooltip.x}
              y1={PADDING.top}
              x2={tooltip.x}
              y2={PADDING.top + PLOT_HEIGHT}
              stroke={textColor}
              strokeWidth={1}
              strokeDasharray="4,2"
              strokeOpacity={0.5}
            />
          )}
        </svg>

        <AnimatePresence>
          {tooltip.visible && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.1 }}
              style={{
                position: 'absolute',
                left: tooltip.x > CHART_WIDTH / 2 ? tooltip.x - 140 : tooltip.x + 16,
                top: Math.max(8, tooltip.y - 20),
                pointerEvents: 'none',
                zIndex: 10,
              }}
            >
              <Paper
                elevation={8}
                sx={{
                  p: 1,
                  borderRadius: 1,
                  minWidth: 120,
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                }}
              >
                <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                  {formatTime(tooltip.time)}
                </Typography>
                {tooltip.values.map((v) => (
                  <Box key={v.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: v.color, flexShrink: 0 }} />
                    <Typography variant="caption" color="text.secondary">
                      {v.label}:
                    </Typography>
                    <Typography variant="caption" fontWeight={600} color="text.primary">
                      {formatValue(v.value)}
                    </Typography>
                  </Box>
                ))}
              </Paper>
            </motion.div>
          )}
        </AnimatePresence>
      </Paper>
    </motion.div>
  )
}

// ── Main prototype ──────────────────────────────────────────────────────────

export default function ObservableStreamPrototype() {
  const router = useRouter()
  const theme = useTheme()

  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [charts, setCharts] = useState<ChartConfig[]>([])
  const [sleepWindows, setSleepWindows] = useState<SleepWindow[]>([])
  const [glowingCharts, setGlowingCharts] = useState<Set<number>>(new Set())

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const nowRef = useRef(Date.now())

  const initialize = useCallback(() => {
    const now = Date.now()
    nowRef.current = now
    const windows = createSleepWindows(now)
    setSleepWindows(windows)
    setCharts(generateInitialData(now, windows))
    setGlowingCharts(new Set())
  }, [])

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    if (!playing || charts.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    const tick = () => {
      nowRef.current += TICK_INTERVAL_MS
      const now = nowRef.current

      setCharts((prev) =>
        prev.map((chart, chartIdx) => {
          const updatedSeries = chart.series.map((s) => {
            const newPoint = generateNextPoint(s, now, chartIdx, sleepWindows)
            const cutoff = now - ROLLING_WINDOW_MS
            const trimmed = s.data.filter((pt) => pt.time >= cutoff)
            return { ...s, data: [...trimmed, newPoint] }
          })

          const latestValues = updatedSeries.map(
            (s) => s.data[s.data.length - 1]?.value ?? 0,
          )
          const anyAboveThreshold = latestValues.some((v) => v > chart.thresholdHigh)

          setGlowingCharts((prev) => {
            const next = new Set(prev)
            if (anyAboveThreshold) {
              next.add(chartIdx)
            } else {
              next.delete(chartIdx)
            }
            return next
          })

          return { ...chart, series: updatedSeries }
        }),
      )
    }

    intervalRef.current = setInterval(tick, TICK_INTERVAL_MS / speed)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [playing, speed, charts.length, sleepWindows])

  const timeRange = useMemo(() => {
    if (charts.length === 0 || charts[0].series[0].data.length === 0) {
      const now = Date.now()
      return { min: now - ROLLING_WINDOW_MS, max: now }
    }
    const allTimes = charts[0].series[0].data.map((pt) => pt.time)
    return { min: Math.min(...allTimes), max: Math.max(...allTimes) }
  }, [charts])

  const handleReset = useCallback(() => {
    setPlaying(false)
    initialize()
    setPlaying(true)
  }, [initialize])

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: 10 }}>
      <Box sx={{ px: 3, pt: 3, display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={() => router.push('/prototypes')} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h5" fontWeight={700} color="text.primary">
            Observable Stream
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Live streaming multi-metric dashboard with 6 small multiples
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 3, mb: 2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 0.5,
            borderRadius: 1,
            bgcolor: 'action.hover',
          }}
        >
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: METRIC_COLORS.purple,
              opacity: 0.8,
            }}
          />
          <Typography variant="caption" color="text.secondary">
            Sleep window
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 0.5,
            borderRadius: 1,
            bgcolor: 'action.hover',
          }}
        >
          <Box
            sx={{
              width: 16,
              height: 2,
              bgcolor: METRIC_COLORS.red,
              opacity: 0.5,
            }}
          />
          <Typography variant="caption" color="text.secondary">
            Threshold
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
          gap: 2,
          px: 3,
        }}
      >
        {charts.map((chart, idx) => (
          <StreamChart
            key={chart.title}
            config={chart}
            sleepWindows={sleepWindows}
            timeRange={timeRange}
            isGlowing={glowingCharts.has(idx)}
          />
        ))}
      </Box>

      {/* Dev Toolbar */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)',
          borderTop: 1,
          borderColor: 'divider',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          py: 1,
          px: 3,
        }}
      >
        <IconButton
          onClick={() => setPlaying(!playing)}
          size="small"
          sx={{ color: 'text.primary' }}
        >
          {playing ? <PauseIcon /> : <PlayArrowIcon />}
        </IconButton>

        <IconButton
          onClick={handleReset}
          size="small"
          sx={{ color: 'text.primary' }}
        >
          <RestartAltIcon />
        </IconButton>

        <ButtonGroup size="small" variant="outlined">
          {[1, 2, 5].map((s) => (
            <Button
              key={s}
              onClick={() => setSpeed(s)}
              variant={speed === s ? 'contained' : 'outlined'}
              sx={{ minWidth: 40 }}
            >
              {s}x
            </Button>
          ))}
        </ButtonGroup>

        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
          {playing ? 'Playing' : 'Paused'} at {speed}x
        </Typography>
      </Box>
    </Box>
  )
}
