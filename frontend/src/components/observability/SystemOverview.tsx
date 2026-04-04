'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import { alpha, useTheme, type Theme } from '@mui/material/styles'
import type {
  MetricSnapshot,
  RiverComponentMetrics,
  ObservabilityThreshold,
} from '@/lib/observability-types'

// ── Props ──────────────────────────────────────────────────────────────────

interface SystemOverviewProps {
  snapshot: MetricSnapshot | undefined
  history: MetricSnapshot[]
  components: RiverComponentMetrics[]
  thresholds: ObservabilityThreshold[]
}

// ── Constants ──────────────────────────────────────────────────────────────

const MONO = 'monospace'
const LABEL_SIZE = 10
const VALUE_SIZE = 18
const SCHEDULER_BUDGET_MS = 500
const LATENCY_MAX_MS = 1000
const BAR_HEIGHT = 24

const TRAFFIC_COLORS = {
  http: '#3B82F6',
  k8s: '#A855F7',
  cache: '#22C55E',
  ws: '#FBBF24',
} as const

const STATUS_COLORS = {
  ok: '#22C55E',
  warn: '#F59E0B',
  crit: '#EF4444',
} as const

const LATENCY_COLORS = {
  p50: '#22C55E',
  p95: '#F59E0B',
  p99: '#EF4444',
} as const

const SECTION_ROUTES = {
  requestFlow: '/observability/http_rate',
  latency: '/observability/latency_p99',
  health: '/observability/router',
  errors: '/observability/error_rate',
  scheduler: '/observability/scheduler_health',
} as const

// ── Shared styles ──────────────────────────────────────────────────────────

const sectionSx = {
  display: 'flex',
  flexDirection: 'column' as const,
  justifyContent: 'center',
  py: 1,
  px: 1.5,
  minWidth: 0,
}

const labelSx = {
  fontSize: LABEL_SIZE,
  fontWeight: 600,
  lineHeight: 1.2,
  letterSpacing: 0.3,
}

const valueSx = {
  fontSize: VALUE_SIZE,
  fontWeight: 700,
  fontFamily: MONO,
  lineHeight: 1.2,
}

const tinyLabelSx = {
  fontSize: 9,
  fontFamily: MONO,
  lineHeight: 1.3,
}

const clickableSx = {
  cursor: 'pointer',
  transition: 'background-color 150ms ease',
  '&:hover': { bgcolor: 'action.hover' },
} as const

// ── Component ──────────────────────────────────────────────────────────────

export default function SystemOverview({
  snapshot,
  components,
}: SystemOverviewProps) {
  const theme = useTheme()
  const router = useRouter()
  const dividerColor = theme.palette.divider

  const trafficSegments = useMemo(
    () => computeTrafficSegments(snapshot),
    [snapshot],
  )

  const errorStats = useMemo(
    () => computeErrorStats(snapshot),
    [snapshot],
  )

  const schedulerStats = useMemo(
    () => computeSchedulerStats(snapshot),
    [snapshot],
  )

  const visibleComponents = components.slice(0, 8)
  const navigate = (path: string) => router.push(path)

  return (
    <Card
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        minHeight: 110,
        overflowX: 'auto',
        overflowY: 'hidden',
        '&::-webkit-scrollbar': { height: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 2 },
      }}
    >
      <RequestFlowSection segments={trafficSegments} onNavigate={() => navigate(SECTION_ROUTES.requestFlow)} />
      <VerticalDivider color={dividerColor} />
      <LatencySection snapshot={snapshot} onNavigate={() => navigate(SECTION_ROUTES.latency)} />
      <VerticalDivider color={dividerColor} />
      <ComponentHealthSection components={visibleComponents} onNavigate={() => navigate(SECTION_ROUTES.health)} />
      <VerticalDivider color={dividerColor} />
      <ErrorSection stats={errorStats} onNavigate={() => navigate(SECTION_ROUTES.errors)} />
      <VerticalDivider color={dividerColor} />
      <SchedulerSection stats={schedulerStats} onNavigate={() => navigate(SECTION_ROUTES.scheduler)} />
    </Card>
  )
}

// ── Vertical divider ───────────────────────────────────────────────────────

function VerticalDivider({ color }: { color: string }) {
  return (
    <Box
      sx={{
        width: '1px',
        alignSelf: 'stretch',
        my: 1,
        bgcolor: color,
        opacity: 0.5,
      }}
    />
  )
}

// ── Section 1: Request Flow ────────────────────────────────────────────────

interface TrafficSegment {
  label: string
  value: number
  color: string
}

function computeTrafficSegments(
  snapshot: MetricSnapshot | undefined,
): TrafficSegment[] {
  if (!snapshot) return []
  const http = snapshot.httpRequestRate
  const k8s = snapshot.k8sGetRate + snapshot.k8sPatchRate + snapshot.k8sDeleteRate
  // Store traffic is estimated as 60% of HTTP rate (no direct metric available)
  const store = snapshot.httpRequestRate * 0.6
  const ws = snapshot.wsActiveConnections
  return [
    { label: 'HTTP', value: http, color: TRAFFIC_COLORS.http },
    { label: 'K8s', value: k8s, color: TRAFFIC_COLORS.k8s },
    { label: 'Store', value: store, color: TRAFFIC_COLORS.cache },
    { label: 'WS', value: ws, color: TRAFFIC_COLORS.ws },
  ]
}

function RequestFlowSection({
  segments,
  onNavigate,
}: {
  segments: TrafficSegment[]
  onNavigate: () => void
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)

  return (
    <Box onClick={onNavigate} sx={{ ...sectionSx, ...clickableSx, flex: '1 1 auto', minWidth: 250, gap: 0.5 }}>
      <Typography color="text.secondary" sx={labelSx}>
        REQUEST FLOW
      </Typography>
      <StackedBar segments={segments} total={total} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography color="text.primary" sx={{ ...tinyLabelSx, fontWeight: 600 }}>
          {total > 0 ? total.toFixed(1) : '0.0'} req/s total
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {segments.filter((s) => s.value > 0).map((seg) => (
            <Box key={seg.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: seg.color }} />
              <Typography sx={{ ...tinyLabelSx, fontSize: 8, color: 'text.secondary' }}>
                {seg.label} {seg.value.toFixed(0)}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}

function StackedBar({
  segments,
  total,
}: {
  segments: TrafficSegment[]
  total: number
}) {
  if (total === 0) {
    return (
      <svg width="100%" height={BAR_HEIGHT} aria-label="No traffic">
        <rect
          x={0}
          y={4}
          width="100%"
          height={16}
          rx={3}
          fill="currentColor"
          opacity={0.08}
        />
      </svg>
    )
  }

  return (
    <svg width="100%" height={BAR_HEIGHT} aria-label="Traffic distribution">
      <defs>
        <linearGradient id="shimmer-gradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="40%" stopColor="white" stopOpacity="0" />
          <stop offset="50%" stopColor="white" stopOpacity="0.25" />
          <stop offset="60%" stopColor="white" stopOpacity="0" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
          <animate
            attributeName="x1"
            values="-1;1"
            dur="3.5s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="x2"
            values="0;2"
            dur="3.5s"
            repeatCount="indefinite"
          />
        </linearGradient>
      </defs>
      {segments.map((seg, idx) => {
        const pct = (seg.value / total) * 100
        const offset = segments
          .slice(0, idx)
          .reduce((sum, s) => sum + (s.value / total) * 100, 0)
        return (
          <rect
            key={seg.label}
            x={`${offset}%`}
            y={4}
            width={`${pct}%`}
            height={16}
            rx={idx === 0 ? 3 : 0}
            fill={seg.color}
            opacity={0.85}
          />
        )
      })}
      <rect
        x="0"
        y={4}
        width="100%"
        height={16}
        rx={3}
        fill="url(#shimmer-gradient)"
      />
    </svg>
  )
}

// ── Section 2: Latency Breakdown ───────────────────────────────────────────

function LatencySection({
  snapshot,
  onNavigate,
}: {
  snapshot: MetricSnapshot | undefined
  onNavigate: () => void
}) {
  const p50 = snapshot?.httpLatencyP50Ms ?? 0
  const p95 = snapshot?.httpLatencyP95Ms ?? 0
  const p99 = snapshot?.httpLatencyP99Ms ?? 0

  return (
    <Box onClick={onNavigate} sx={{ ...sectionSx, ...clickableSx, flex: '0 0 130px', gap: 0.5 }}>
      <Typography color="text.secondary" sx={labelSx}>
        LATENCY
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, flex: 1 }}>
        <LatencyBar label="P50" value={p50} color={LATENCY_COLORS.p50} />
        <LatencyBar label="P95" value={p95} color={LATENCY_COLORS.p95} />
        <LatencyBar label="P99" value={p99} color={LATENCY_COLORS.p99} />
      </Box>
    </Box>
  )
}

function LatencyBar({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  const maxBarHeight = 32
  const barHeight = Math.max(2, (Math.min(value, LATENCY_MAX_MS) / LATENCY_MAX_MS) * maxBarHeight)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
      <svg width={20} height={maxBarHeight} aria-label={`${label}: ${value}ms`}>
        <rect
          x={2}
          y={maxBarHeight - barHeight}
          width={16}
          height={barHeight}
          rx={2}
          fill={color}
          opacity={0.85}
        />
      </svg>
      <Typography sx={{ ...tinyLabelSx, color: 'text.secondary' }}>
        {Math.round(value)}
      </Typography>
      <Typography sx={{ ...tinyLabelSx, color: 'text.secondary', fontSize: 8 }}>
        {label}
      </Typography>
    </Box>
  )
}

// ── Section 3: Component Health List ──────────────────────────────────────

function ComponentHealthSection({
  components,
  onNavigate,
}: {
  components: RiverComponentMetrics[]
  onNavigate: () => void
}) {
  const okCount = components.filter((c) => c.status === 'ok').length

  return (
    <Box onClick={onNavigate} sx={{ ...sectionSx, ...clickableSx, flex: '0 0 160px', gap: 0.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mb: 0.25 }}>
        <Typography color="text.secondary" sx={labelSx}>
          HEALTH
        </Typography>
        <Typography color="text.secondary" sx={{ fontSize: 9, fontFamily: MONO, fontWeight: 600 }}>
          {okCount}/{components.length}
        </Typography>
      </Box>
      {components.map((comp) => (
        <ComponentRow key={comp.component} component={comp} />
      ))}
    </Box>
  )
}

function ComponentRow({ component }: { component: RiverComponentMetrics }) {
  const theme = useTheme()
  const color = STATUS_COLORS[component.status]
  const rowBg = componentRowBackground(component.status, color, theme)

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', height: 14, gap: 0.5, px: 0.5, borderRadius: 0.5, bgcolor: rowBg }}>
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, flexShrink: 0, opacity: 0.9 }} />
      <Typography sx={{ fontSize: 9, lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {component.component}
      </Typography>
      <Typography sx={{ fontSize: 9, fontFamily: MONO, lineHeight: 1, color: 'text.secondary', flexShrink: 0 }}>
        {component.rpsIn.toFixed(0)}
      </Typography>
    </Box>
  )
}

function componentRowBackground(status: string, color: string, theme: Theme): string {
  if (status === 'warn') return alpha(color, 0.08)
  if (status === 'crit') return alpha(theme.palette.error.main, 0.1)
  return 'transparent'
}

// ── Section 4: Error Summary ───────────────────────────────────────────────

interface ErrorStats {
  totalRate: number
  httpErrors: number
  panics: number
  drops: number
  hasErrors: boolean
}

function computeErrorStats(snapshot: MetricSnapshot | undefined): ErrorStats {
  if (!snapshot) {
    return { totalRate: 0, httpErrors: 0, panics: 0, drops: 0, hasErrors: false }
  }
  const totalRate = snapshot.totalErrorRate
  const httpErrors = snapshot.httpErrorRate
  const panics = snapshot.schedulerPanics
  const drops = snapshot.auditDrops
  const hasErrors = totalRate > 0 || panics > 0 || drops > 0
  return { totalRate, httpErrors, panics, drops, hasErrors }
}

function ErrorSection({ stats, onNavigate }: { stats: ErrorStats; onNavigate: () => void }) {
  const theme = useTheme()
  const tintBg = stats.hasErrors ? alpha(theme.palette.error.main, 0.06) : 'transparent'
  const valueColor = stats.hasErrors ? theme.palette.error.main : 'text.primary'

  return (
    <Box onClick={onNavigate} sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', py: 1, px: 2, flex: '0 0 130px', bgcolor: tintBg, ...clickableSx }}>
      <Typography color="text.secondary" sx={{ ...labelSx, mb: 0.75 }}>
        ERRORS
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mb: 0.5 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 700, fontFamily: MONO, lineHeight: 1, color: valueColor }}>
          {stats.totalRate.toFixed(2)}
        </Typography>
        <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>/s</Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <ErrorMiniStat label="5xx" value={stats.httpErrors} />
        <ErrorMiniStat label="Panic" value={stats.panics} />
        <ErrorMiniStat label="Drop" value={stats.drops} />
      </Box>
    </Box>
  )
}

function ErrorMiniStat({ label, value }: { label: string; value: number }) {
  const theme = useTheme()
  const color = value > 0 ? theme.palette.error.main : 'text.secondary'

  const display = Number.isInteger(value) ? String(value) : value.toFixed(1)

  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.25 }}>
      <Typography sx={{ fontSize: 8, color: 'text.secondary' }}>{label}</Typography>
      <Typography sx={{ fontSize: 11, fontWeight: 600, fontFamily: MONO, color }}>{display}</Typography>
    </Box>
  )
}

// ── Section 5: Scheduler ───────────────────────────────────────────────────

interface SchedulerStats {
  evalRate: number
  evalDuration: number
  progress: number
}

function computeSchedulerStats(
  snapshot: MetricSnapshot | undefined,
): SchedulerStats {
  if (!snapshot) {
    return { evalRate: 0, evalDuration: 0, progress: 0 }
  }
  const evalRate = snapshot.schedulerEvalRate
  const evalDuration = snapshot.schedulerEvalDurationMs
  const progress = Math.min(evalDuration / SCHEDULER_BUDGET_MS, 1)
  return { evalRate, evalDuration, progress }
}

function SchedulerSection({ stats, onNavigate }: { stats: SchedulerStats; onNavigate: () => void }) {
  const theme = useTheme()

  return (
    <Box onClick={onNavigate} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 1, px: 2, ml: 1, flex: '0 0 160px', ...clickableSx }}>
      <Typography color="text.secondary" sx={{ ...labelSx, mb: 0.75, alignSelf: 'flex-start' }}>
        SCHEDULER
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <ProgressRing progress={stats.progress} theme={theme} />
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 700, fontFamily: MONO, lineHeight: 1 }}>
              {stats.evalRate.toFixed(1)}
            </Typography>
            <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>
              eval/m
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mt: 0.25 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 600, fontFamily: MONO, lineHeight: 1, color: 'text.secondary' }}>
              {stats.evalDuration.toFixed(0)}ms
            </Typography>
            <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>
              avg
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

function ProgressRing({
  progress,
  theme,
}: {
  progress: number
  theme: Theme
}) {
  const size = 28
  const strokeWidth = 3
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - progress)
  const ringColor = progress > 0.9
    ? theme.palette.error.main
    : progress > 0.7
      ? theme.palette.warning.main
      : theme.palette.success.main

  return (
    <svg width={size} height={size} aria-label={`${Math.round(progress * 100)}% budget`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={theme.palette.divider}
        strokeWidth={strokeWidth}
        opacity={0.3}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={ringColor}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  )
}
