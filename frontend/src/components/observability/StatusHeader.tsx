'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { alpha, useTheme } from '@mui/material/styles'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import type { Theme } from '@mui/material/styles'
import type { MetricSnapshot, IncidentEvent, TimeRange } from '@/lib/observability-types'
import { TIME_RANGE_OPTIONS } from '@/lib/observability-types'

// -- Types -------------------------------------------------------------------

interface StatusHeaderProps {
  snapshot: MetricSnapshot | undefined
  history: MetricSnapshot[]
  systemStatus: 'healthy' | 'warning' | 'critical'
  events: IncidentEvent[]
  timeRange: TimeRange
  onTimeRangeChange: (range: TimeRange) => void
}

type FlashDirection = 'up' | 'down' | null

interface TrendInfo {
  arrow: string
  color: string
}

const STATUS_LABELS: Record<string, string> = {
  healthy: 'Healthy',
  warning: 'Warning',
  critical: 'Critical',
}

const LATENCY_AMBER_THRESHOLD = 200
const LATENCY_RED_THRESHOLD = 500
const DB_POOL_FALLBACK_MAX = 10
const SPARKLINE_SAMPLE_COUNT = 20
const CLOCK_INTERVAL_MS = 1000
const FLASH_DURATION_MS = 500
const TREND_LOOKBACK_TICKS = 5
const TREND_THRESHOLD_PERCENT = 5
const STALE_AMBER_SECONDS = 10
const STALE_RED_SECONDS = 30

const getHttpRate = (s: MetricSnapshot) => s.httpRequestRate
const getLatencyP99 = (s: MetricSnapshot) => s.httpLatencyP99Ms
const getErrorRate = (s: MetricSnapshot) => s.totalErrorRate

// -- Main Component ----------------------------------------------------------

export default function StatusHeader({
  snapshot,
  history,
  systemStatus,
  events,
  timeRange,
  onTimeRangeChange,
}: StatusHeaderProps) {
  const theme = useTheme()

  const statusColor = resolveStatusColor(systemStatus, theme)
  const isCritical = systemStatus === 'critical'

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 3,
        height: 52,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <HealthSection
        statusColor={statusColor}
        statusLabel={STATUS_LABELS[systemStatus]}
        isCritical={isCritical}
        snapshot={snapshot}
      />

      <Box sx={{ mx: 1, width: '1px', height: 28, bgcolor: 'divider' }} />

      <KpiSection snapshot={snapshot} history={history} />

      <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <AlertBadge events={events} />
        <TimeRangePicker value={timeRange} onChange={onTimeRangeChange} />
      </Box>
    </Box>
  )
}

// -- Shared Clock Hook -------------------------------------------------------

function useSharedClock(): number {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), CLOCK_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  return tick
}

// -- Health Section ----------------------------------------------------------

function HealthSection({
  statusColor,
  statusLabel,
  isCritical,
  snapshot,
}: {
  statusColor: string
  statusLabel: string
  isCritical: boolean
  snapshot: MetricSnapshot | undefined
}) {
  const tick = useSharedClock()

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <StatusDot color={statusColor} pulse={isCritical} />
      <Typography variant="body2" fontWeight={600} sx={{ minWidth: 52 }} aria-live="polite">
        {statusLabel}
      </Typography>
      <LiveClock tick={tick} />
      <LastUpdatedIndicator snapshot={snapshot} tick={tick} />
      <UptimeCounter snapshot={snapshot} tick={tick} />
    </Box>
  )
}

// -- Status Dot --------------------------------------------------------------

function StatusDot({ color, pulse }: { color: string; pulse: boolean }) {
  return (
    <FiberManualRecordIcon
      sx={{
        fontSize: 12,
        color,
        animation: pulse ? 'statusPulse 1.5s infinite' : undefined,
        '@keyframes statusPulse': {
          '0%,100%': { opacity: 1 },
          '50%': { opacity: 0.3 },
        },
      }}
    />
  )
}

// -- Live Clock --------------------------------------------------------------

function LiveClock({ tick }: { tick: number }) {
  void tick
  return (
    <Typography
      variant="caption"
      sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 11, color: 'text.secondary' }}
    >
      {formatTime(new Date())}
    </Typography>
  )
}

// -- Last Updated Indicator --------------------------------------------------

function LastUpdatedIndicator({ snapshot, tick }: { snapshot: MetricSnapshot | undefined; tick: number }) {
  const theme = useTheme()
  const lastTimestampRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    lastTimestampRef.current = snapshot?.timestamp
  }, [snapshot?.timestamp])

  if (!snapshot) return null

  void tick
  const secondsAgo = lastTimestampRef.current
    ? Math.max(0, Math.floor((Date.now() - new Date(lastTimestampRef.current).getTime()) / 1000))
    : 0
  const freshnessColor = resolveFreshnessColor(secondsAgo, theme)

  return (
    <Typography
      variant="caption"
      sx={{ fontFamily: 'monospace', fontSize: 10, color: freshnessColor }}
    >
      Updated {secondsAgo}s ago
    </Typography>
  )
}

function resolveFreshnessColor(seconds: number, theme: Theme): string {
  if (seconds > STALE_RED_SECONDS) return theme.palette.error.main
  if (seconds > STALE_AMBER_SECONDS) return theme.palette.warning.main
  return theme.palette.text.disabled
}

// -- Uptime Counter ----------------------------------------------------------

function UptimeCounter({ snapshot, tick }: { snapshot: MetricSnapshot | undefined; tick: number }) {
  void tick
  const label = snapshot ? formatUptime(snapshot.timestamp) : '--'

  return (
    <Typography
      variant="caption"
      sx={{ fontFamily: 'monospace', fontSize: 11, color: 'text.secondary' }}
    >
      up {label}
    </Typography>
  )
}

// -- KPI Section -------------------------------------------------------------

function KpiSection({
  snapshot,
  history,
}: {
  snapshot: MetricSnapshot | undefined
  history: MetricSnapshot[]
}) {
  const theme = useTheme()
  const throughputValues = useLast20Values(history, getHttpRate)
  const latencyP99 = snapshot?.httpLatencyP99Ms ?? 0
  const dbActive = snapshot?.dbPoolInUse ?? 0
  const dbPoolMax = snapshot?.dbPoolOpen || DB_POOL_FALLBACK_MAX
  const errorRate = snapshot?.totalErrorRate ?? 0

  const latencyColor = resolveLatencyColor(latencyP99, theme)
  const errorHighlight = errorRate > 0

  const throughputTrend = useTrend(history, getHttpRate, false)
  const latencyTrend = useTrend(history, getLatencyP99, true)
  const errorTrend = useTrend(history, getErrorRate, true)

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <MiniStatCard
        label="THROUGHPUT"
        value={formatKpiValue(snapshot?.httpRequestRate, 1, ' req/s')}
        sparkline={throughputValues}
        currentRaw={snapshot?.httpRequestRate}
        trend={throughputTrend}
      />
      <MiniStatCard
        label="LATENCY P99"
        value={formatKpiValue(latencyP99, 0, ' ms')}
        valueColor={latencyColor}
        currentRaw={latencyP99}
        trend={latencyTrend}
      />
      <MiniStatCard
        label="DB POOL"
        value={snapshot ? `${dbActive}/${dbPoolMax}` : '--'}
        currentRaw={dbActive}
      />
      <MiniStatCard
        label="ERROR RATE"
        value={formatKpiValue(snapshot?.totalErrorRate, 2, ' /s')}
        valueColor={errorHighlight ? theme.palette.error.main : undefined}
        currentRaw={snapshot?.totalErrorRate}
        trend={errorTrend}
      />
    </Box>
  )
}

// -- Mini Stat Card ----------------------------------------------------------

function MiniStatCard({
  label,
  value,
  valueColor,
  sparkline,
  currentRaw,
  trend,
  title,
}: {
  label: string
  value: string
  valueColor?: string
  sparkline?: number[]
  currentRaw?: number
  trend?: TrendInfo | null
  title?: string
}) {
  const theme = useTheme()
  const flashColor = useValueFlash(currentRaw)

  const baseBg = alpha(theme.palette.text.primary, 0.03)
  const bgColor = flashColor ?? baseBg

  return (
    <Box
      title={title}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 0.25,
        px: 1.5,
        py: 0.5,
        borderRadius: 1,
        bgcolor: bgColor,
        transition: `background-color ${FLASH_DURATION_MS}ms ease`,
        minWidth: 90,
        height: 40,
      }}
    >
      <Typography
        sx={{
          fontSize: 9,
          fontWeight: 700,
          textTransform: 'uppercase',
          color: 'text.secondary',
          letterSpacing: 0.5,
          lineHeight: 1,
        }}
      >
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Typography
          aria-live="polite"
          sx={{
            fontFamily: 'monospace',
            fontWeight: 700,
            fontSize: 14,
            lineHeight: 1,
            color: valueColor ?? 'text.primary',
            whiteSpace: 'nowrap',
          }}
        >
          {value}
        </Typography>
        {trend && <TrendArrow arrow={trend.arrow} color={trend.color} />}
        {sparkline && sparkline.length >= 2 && (
          <InlineSparkline values={sparkline} color={theme.palette.primary.main} />
        )}
      </Box>
    </Box>
  )
}

// -- Trend Arrow -------------------------------------------------------------

function TrendArrow({ arrow, color }: { arrow: string; color: string }) {
  return (
    <Typography
      component="span"
      sx={{ fontSize: 10, fontWeight: 700, lineHeight: 1, color }}
    >
      {arrow}
    </Typography>
  )
}

// -- Inline Sparkline --------------------------------------------------------

function InlineSparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null

  const points = buildSparklinePoints(values)

  return (
    <svg width={60} height={20} viewBox="0 0 60 20" style={{ display: 'block' }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function buildSparklinePoints(values: number[]): string {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const stepX = 60 / (values.length - 1)

  return values
    .map((v, i) => {
      const x = i * stepX
      const y = 18 - ((v - min) / range) * 16 + 2
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

// -- Alert Badge -------------------------------------------------------------

function AlertBadge({ events }: { events: IncidentEvent[] }) {
  const theme = useTheme()

  if (events.length === 0) return null

  const label = `${events.length} alert${events.length > 1 ? 's' : ''}`

  return (
    <Chip
      aria-live="polite"
      icon={<ErrorOutlineIcon sx={{ fontSize: 14 }} />}
      label={label}
      size="small"
      onClick={scrollToIncidentFeed}
      sx={{
        bgcolor: alpha(theme.palette.error.main, 0.12),
        color: theme.palette.error.main,
        fontWeight: 600,
        fontSize: 11,
        cursor: 'pointer',
        '&:hover': {
          bgcolor: alpha(theme.palette.error.main, 0.2),
        },
      }}
    />
  )
}

function scrollToIncidentFeed() {
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
}

// -- Time Range Picker -------------------------------------------------------

function TimeRangePicker({
  value,
  onChange,
}: {
  value: TimeRange
  onChange: (range: TimeRange) => void
}) {
  return (
    <ToggleButtonGroup
      size="small"
      value={value}
      exclusive
      onChange={(_, v) => v && onChange(v)}
      sx={{
        '& .MuiToggleButton-root': {
          px: 1.5,
          py: 0.25,
          fontSize: 12,
          textTransform: 'none',
        },
      }}
    >
      {TIME_RANGE_OPTIONS.map((opt) => (
        <ToggleButton key={opt.value} value={opt.value}>
          {opt.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
}

// -- Hooks -------------------------------------------------------------------

function useValueFlash(currentRaw: number | undefined): string | null {
  const prevRef = useRef<number | undefined>(undefined)
  const [flash, setFlash] = useState<FlashDirection>(null)
  const theme = useTheme()

  useEffect(() => {
    if (currentRaw === undefined || prevRef.current === undefined) {
      prevRef.current = currentRaw
      return
    }
    if (currentRaw === prevRef.current) return

    const direction: FlashDirection = currentRaw > prevRef.current ? 'up' : 'down'
    prevRef.current = currentRaw
    setFlash(direction)

    const timer = setTimeout(() => setFlash(null), FLASH_DURATION_MS)
    return () => clearTimeout(timer)
  }, [currentRaw])

  if (flash === 'up') return alpha(theme.palette.success.main, 0.15)
  if (flash === 'down') return alpha(theme.palette.error.main, 0.15)
  return null
}

function useTrend(
  history: MetricSnapshot[],
  accessor: (s: MetricSnapshot) => number,
  invertColors: boolean,
): TrendInfo | null {
  const theme = useTheme()

  return useMemo(() => {
    if (history.length < TREND_LOOKBACK_TICKS + 1) return null
    return computeTrend(history, accessor, invertColors, theme)
  }, [history, accessor, invertColors, theme])
}

// -- Helpers -----------------------------------------------------------------

function computeTrend(
  history: MetricSnapshot[],
  accessor: (s: MetricSnapshot) => number,
  invertColors: boolean,
  theme: Theme,
): TrendInfo {
  const current = accessor(history[history.length - 1])
  const past = accessor(history[history.length - 1 - TREND_LOOKBACK_TICKS])
  const changePct = past === 0 ? (current > 0 ? 100 : 0) : ((current - past) / Math.abs(past)) * 100

  if (Math.abs(changePct) <= TREND_THRESHOLD_PERCENT) {
    return { arrow: '\u2014', color: theme.palette.text.disabled }
  }

  const isIncrease = changePct > 0
  return buildTrendResult(isIncrease, invertColors, theme)
}

function buildTrendResult(isIncrease: boolean, invertColors: boolean, theme: Theme): TrendInfo {
  const upColor = invertColors ? theme.palette.error.main : theme.palette.warning.main
  const downColor = theme.palette.success.main

  if (isIncrease) return { arrow: '\u25B2', color: upColor }
  return { arrow: '\u25BC', color: downColor }
}

function resolveStatusColor(
  status: 'healthy' | 'warning' | 'critical',
  theme: { palette: { error: { main: string }; warning: { main: string }; success: { main: string } } },
): string {
  if (status === 'critical') return theme.palette.error.main
  if (status === 'warning') return theme.palette.warning.main
  return theme.palette.success.main
}

function resolveLatencyColor(
  valueMs: number,
  theme: { palette: { error: { main: string }; warning: { main: string }; success: { main: string } } },
): string {
  if (valueMs > LATENCY_RED_THRESHOLD) return theme.palette.error.main
  if (valueMs > LATENCY_AMBER_THRESHOLD) return theme.palette.warning.main
  return theme.palette.success.main
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', { hour12: false })
}

function formatUptime(timestamp: string): string {
  const diffS = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000))
  if (diffS < 60) return `${diffS}s`
  const m = Math.floor(diffS / 60)
  if (m < 60) return `${m}m ${diffS % 60}s`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${m % 60}m`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}

function formatKpiValue(
  raw: number | undefined,
  decimals: number,
  suffix: string,
): string {
  if (raw === undefined) return '--'
  return `${raw.toFixed(decimals)}${suffix}`
}

function useLast20Values(
  history: MetricSnapshot[],
  accessor: (s: MetricSnapshot) => number,
): number[] {
  return useMemo(() => {
    const slice = history.slice(-SPARKLINE_SAMPLE_COUNT)
    return slice.map(accessor)
  }, [history, accessor])
}
