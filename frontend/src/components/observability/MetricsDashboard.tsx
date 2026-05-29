'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import CloseIcon from '@mui/icons-material/Close'
import { useTheme, alpha, type Theme } from '@mui/material/styles'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  useObservabilityMetrics,
  useObservabilityEvents,
  useObservabilityCalls,
} from '@/lib/ObservabilityStreamContext'
import type { MetricSnapshot, TimeRange, ObservabilityThreshold, ApiCall } from '@/lib/observability-types'
import StatusHeader from '@/components/observability/StatusHeader'
import SystemOverview from '@/components/observability/SystemOverview'
import CallFeed from '@/components/observability/CallFeed'
import ErrorTimeline from '@/components/observability/ErrorTimeline'

// ── Lazy eCharts import ─────────────────────────────────────────────────────

let echartsPromise: Promise<typeof import('echarts/core')> | null = null

async function loadECharts() {
  if (!echartsPromise) {
    echartsPromise = (async () => {
      const [core, { LineChart, BarChart, ScatterChart }, { GridComponent, TooltipComponent, LegendComponent, MarkLineComponent }, { CanvasRenderer }] =
        await Promise.all([
          import('echarts/core'),
          import('echarts/charts'),
          import('echarts/components'),
          import('echarts/renderers'),
        ])
      core.use([LineChart, BarChart, ScatterChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, CanvasRenderer])
      return core
    })()
  }
  return echartsPromise
}

// ── Types ───────────────────────────────────────────────────────────────────

interface Props {
  timeRange: TimeRange
  onTimeRangeChange: (range: TimeRange) => void
}

interface PanelConfig {
  key: string
  title: string
  unit: string
  panelKey: string
  getValue: (s: MetricSnapshot) => number
  chartType: 'line' | 'multiline' | 'bar' | 'gauge' | 'scatter' | 'errorline'
  upIsBad?: boolean
}

// ── Panel definitions ───────────────────────────────────────────────────────

const PANELS: PanelConfig[] = [
  { key: 'http-rate', title: 'HTTP Request Rate', unit: 'req/s', panelKey: 'http_rate', getValue: (s) => s.httpRequestRate, chartType: 'line' },
  { key: 'latency', title: 'HTTP Latency', unit: 'ms', panelKey: 'latency_p99', getValue: (s) => s.httpLatencyP99Ms, chartType: 'multiline', upIsBad: true },
  { key: 'k8s-api', title: 'K8s API Calls', unit: '/min', panelKey: 'k8s_api', getValue: (s) => s.k8sGetRate + s.k8sPatchRate + s.k8sDeleteRate, chartType: 'multiline' },
  { key: 'k8s-latency', title: 'K8s API Latency', unit: 'ms', panelKey: 'k8s_api', getValue: (s) => s.k8sLatencyP99Ms, chartType: 'multiline', upIsBad: true },
  { key: 'ws-conns', title: 'WebSocket Connections', unit: '', panelKey: 'ws_connections', getValue: (s) => s.wsActiveConnections, chartType: 'line' },
  { key: 'error-rate', title: 'Error Rate', unit: '/s', panelKey: 'error_rate', getValue: (s) => s.totalErrorRate, chartType: 'errorline', upIsBad: true },
  { key: 'scale-ops', title: 'Pod Scale Operations', unit: '', panelKey: 'scheduler_health', getValue: (s) => s.workloadsScaledCount, chartType: 'scatter' },
]

// ── Dashboard ───────────────────────────────────────────────────────────────

export default function MetricsDashboard({ timeRange, onTimeRangeChange }: Props) {
  const theme = useTheme()
  const router = useRouter()
  const [expandedPanel, setExpandedPanel] = useState<string | null>(null)
  const { latest, history } = useObservabilityMetrics()
  const events = useObservabilityEvents()
  const recentCalls = useObservabilityCalls()
  const snap = latest?.snapshot
  const thresholds = latest?.thresholds ?? []
  const components = latest?.components ?? []

  const systemStatus = useMemo(() => {
    if (!snap) return 'healthy' as const
    const statuses = components.map((c) => c.status)
    if (statuses.includes('crit')) return 'critical' as const
    if (statuses.includes('warn')) return 'warning' as const
    return 'healthy' as const
  }, [snap, components])

  const thresholdMap = useMemo(() => {
    const map: Record<string, ObservabilityThreshold> = {}
    for (const t of thresholds) map[t.panelKey] = t
    return map
  }, [thresholds])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Status Header */}
      <StatusHeader
        snapshot={snap}
        history={history}
        systemStatus={systemStatus}
        events={events}
        timeRange={timeRange}
        onTimeRangeChange={onTimeRangeChange}
      />

      {/* Scrollable content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* System Overview */}
        <SystemOverview
          snapshot={snap}
          history={history}
          components={components}
          thresholds={thresholds}
        />

        {/* Panel Grid */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' },
            gap: 2,
          }}
        >
          {!snap
            ? Array.from({ length: PANELS.length }, (_, i) => <PanelSkeleton key={i} />)
            : PANELS.map((panel) => (
                <MetricPanel
                  key={panel.key}
                  config={panel}
                  snapshot={snap}
                  history={history}
                  threshold={thresholdMap[panel.panelKey]}
                  onClick={() => setExpandedPanel(panel.key)}
                />
              ))}
        </Box>

        {/* Fullscreen expand dialog */}
        <PanelExpandDialog
          panels={PANELS}
          expandedPanel={expandedPanel}
          snapshot={snap}
          history={history}
          thresholdMap={thresholdMap}
          recentCalls={recentCalls}
          onClose={() => setExpandedPanel(null)}
          onNavigate={(panelKey) => router.push(`/observability/${panelKey}`)}
        />

        {/* Live Call Feed */}
        <CallFeed calls={recentCalls} />

        {/* Error Timeline */}
        {(events.length > 0 || history.length > 0) && (
          <ErrorTimeline events={events} history={history} />
        )}
      </Box>

      {/* Incident Feed */}
      <AnimatePresence>
        {events.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                px: 2,
                py: 1,
                borderTop: 1,
                borderColor: 'divider',
                overflowX: 'auto',
                bgcolor: alpha(theme.palette.error.main, 0.03),
                '&::-webkit-scrollbar': { height: 4 },
                '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 2 },
              }}
            >
              {events.map((evt) => (
                <Chip
                  key={evt.id}
                  icon={evt.severity === 'critical' ? <ErrorOutlineIcon sx={{ fontSize: 14 }} /> : <WarningAmberIcon sx={{ fontSize: 14 }} />}
                  label={`${evt.message} — ${new Date(evt.timestamp).toLocaleTimeString()}`}
                  size="small"
                  sx={{
                    flexShrink: 0,
                    fontSize: 11,
                    bgcolor: evt.severity === 'critical' ? alpha(theme.palette.error.main, 0.1) : alpha(theme.palette.warning.main, 0.1),
                    color: evt.severity === 'critical' ? theme.palette.error.main : theme.palette.warning.main,
                    fontWeight: 600,
                    border: '1px solid',
                    borderColor: evt.severity === 'critical' ? alpha(theme.palette.error.main, 0.2) : alpha(theme.palette.warning.main, 0.2),
                  }}
                />
              ))}
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  )
}

// ── MetricPanel ─────────────────────────────────────────────────────────────

interface MetricPanelProps {
  config: PanelConfig
  snapshot: MetricSnapshot | undefined
  history: MetricSnapshot[]
  threshold: ObservabilityThreshold | undefined
  onClick: () => void
}

function MetricPanel({ config, snapshot, history, threshold, onClick }: MetricPanelProps) {
  const theme = useTheme()
  const chartRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartInstance = useRef<any>(null)
  const roRef = useRef<ResizeObserver | null>(null)

  const value = snapshot ? config.getValue(snapshot) : 0
  const prevValue = history.length >= 2 ? config.getValue(history[history.length - 2]) : value

  const delta = prevValue !== 0 ? ((value - prevValue) / prevValue) * 100 : 0
  const deltaPositive = config.upIsBad ? delta < 0 : delta > 0
  const deltaColor = Math.abs(delta) < 1 ? theme.palette.text.secondary : deltaPositive ? theme.palette.success.main : theme.palette.warning.main

  const thresholdStatus = getThresholdStatus(value, config.panelKey, threshold)
  const statusColor =
    thresholdStatus === 'crit' ? theme.palette.error.main : thresholdStatus === 'warn' ? theme.palette.warning.main : theme.palette.primary.main

  const minMax = useMinMax(config, history)
  const legendEntries = useLegendEntries(config, theme)

  useEffect(() => {
    if (!chartRef.current) return
    let disposed = false
    loadECharts().then((ec) => {
      if (disposed || !chartRef.current) return
      if (!chartInstance.current) {
        chartInstance.current = ec.init(chartRef.current, undefined, { renderer: 'canvas' })
        const ro = new ResizeObserver(() => chartInstance.current?.resize())
        ro.observe(chartRef.current)
        roRef.current = ro
      }
    })
    return () => {
      disposed = true
      chartInstance.current?.dispose()
      chartInstance.current = null
      roRef.current?.disconnect()
      roRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!chartInstance.current || history.length < 2) return
    const option = buildChartOption(config, history, threshold, theme)
    chartInstance.current.setOption(option, { notMerge: false })
  }, [config, history, threshold, theme])

  return (
    <Card
      onClick={onClick}
      sx={{
        cursor: 'pointer',
        p: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'box-shadow 200ms ease, transform 100ms ease',
        '&:hover': { boxShadow: 6, transform: 'translateY(-1px)' },
      }}
    >
      {/* Status accent bar */}
      <Box sx={{ height: 3, bgcolor: thresholdStatus !== 'ok' ? statusColor : alpha(statusColor, 0.3) }} />
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 0.5, flex: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
              fontWeight: 600,
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
            {config.title}
          </Typography>
          {thresholdStatus !== 'ok' && (
            <Chip
              label={thresholdStatus === 'crit' ? 'CRITICAL' : 'WARNING'}
              size="small"
              sx={{
                height: 18,
                fontSize: 9,
                fontWeight: 700,
                bgcolor: alpha(statusColor, 0.12),
                color: statusColor,
                border: `1px solid ${alpha(statusColor, 0.25)}`,
              }}
            />
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
          <Typography aria-live="polite" sx={{ fontSize: 24, fontWeight: 700, fontFamily: 'monospace', lineHeight: 1 }}>
            <span style={{ transition: 'all 300ms ease' }}>
              {config.chartType === 'gauge' ? value.toFixed(1) : value.toFixed(config.unit === 'ms' ? 0 : 1)}
            </span>
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
              fontSize: 11
            }}>{config.unit}</Typography>
          {Math.abs(delta) >= 0.1 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, ml: 'auto' }}>
              <Typography variant="caption" sx={{ fontSize: 10, color: deltaColor, fontWeight: 700, fontFamily: 'monospace' }}>
                <span style={{ transition: 'all 300ms ease' }}>
                  {delta > 0 ? '\u25B2' : '\u25BC'} {Math.abs(delta).toFixed(1)}%
                </span>
              </Typography>
            </Box>
          )}
        </Box>

        {minMax && <MinMaxRange min={minMax.min} max={minMax.max} unit={config.unit} />}

        <Box ref={chartRef} sx={{ flex: 1, minHeight: config.chartType === 'gauge' ? 160 : 130 }} />

        {legendEntries.length > 0 && <InlineLegend entries={legendEntries} />}
      </Box>
    </Card>
  );
}

// ── Inline sub-components ──────────────────────────────────────────────────

interface LegendEntry {
  name: string
  color: string
}

function InlineLegend({ entries }: { entries: LegendEntry[] }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, pt: 0.5 }}>
      {entries.map((entry) => (
        <Box key={entry.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: entry.color, flexShrink: 0 }} />
          <Typography sx={{ fontSize: 10, color: 'text.secondary', lineHeight: 1 }}>{entry.name}</Typography>
        </Box>
      ))}
    </Box>
  )
}

function MinMaxRange({ min, max, unit }: { min: number; max: number; unit: string }) {
  const fmt = unit === 'ms' ? 0 : 1
  return (
    <Typography sx={{ fontSize: 10, color: 'text.disabled', fontFamily: 'monospace', lineHeight: 1 }}>
      {min.toFixed(fmt)} — {max.toFixed(fmt)} {unit}
    </Typography>
  )
}

function useLegendEntries(config: PanelConfig, theme: Theme): LegendEntry[] {
  return useMemo(() => {
    if (config.key === 'latency') {
      return [
        { name: 'P50', color: theme.palette.success.main },
        { name: 'P95', color: theme.palette.warning.main },
        { name: 'P99', color: theme.palette.error.main },
      ]
    }
    if (config.key === 'k8s-latency') {
      return [
        { name: 'P50', color: theme.palette.success.main },
        { name: 'P99', color: theme.palette.error.main },
      ]
    }
    if (config.key === 'k8s-api') {
      return [
        { name: 'GET', color: theme.palette.info.main },
        { name: 'PATCH', color: theme.palette.warning.main },
        { name: 'DELETE', color: theme.palette.error.main },
      ]
    }
    return []
  }, [config.key, theme])
}

function useMinMax(config: PanelConfig, history: MetricSnapshot[]) {
  return useMemo(() => {
    if (config.chartType !== 'line' && config.chartType !== 'errorline') return null
    if (history.length < 2) return null
    const values = history.map((s) => config.getValue(s))
    return { min: Math.min(...values), max: Math.max(...values) }
  }, [config, history])
}

// ── PanelSkeleton ──────────────────────────────────────────────────────────

function PanelSkeleton() {
  return (
    <Card sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Skeleton variant="rectangular" animation="wave" width="60%" height={14} sx={{ borderRadius: 0.5 }} />
      <Skeleton variant="rectangular" animation="wave" width="40%" height={28} sx={{ borderRadius: 0.5 }} />
      <Skeleton variant="rectangular" animation="wave" width="100%" height={130} sx={{ borderRadius: 0.5 }} />
    </Card>
  )
}

// ── PanelExpandDialog ──────────────────────────────────────────────────────

interface PanelExpandDialogProps {
  panels: PanelConfig[]
  expandedPanel: string | null
  snapshot: MetricSnapshot | undefined
  history: MetricSnapshot[]
  thresholdMap: Record<string, ObservabilityThreshold>
  recentCalls: ApiCall[]
  onClose: () => void
  onNavigate: (panelKey: string) => void
}

const LATENCY_PANEL_KEYS = new Set(['latency', 'k8s-latency', 'http-rate', 'error-rate'])
const SLOWEST_CALLS_COUNT = 15

function PanelExpandDialog({ panels, expandedPanel, snapshot, history, thresholdMap, recentCalls, onClose, onNavigate }: PanelExpandDialogProps) {
  const theme = useTheme()
  const config = panels.find((p) => p.key === expandedPanel)
  if (!config) return null

  const value = snapshot ? config.getValue(snapshot) : 0
  const threshold = thresholdMap[config.panelKey]
  const stats = computePanelStats(config, history)
  const showSlowestCalls = LATENCY_PANEL_KEYS.has(config.key)

  return (
    <Dialog open={!!expandedPanel} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 6 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" component="span">{config.title}</Typography>
          <Typography variant="h6" component="span" sx={{ ml: 1, fontFamily: 'monospace', fontWeight: 700 }}>
            {value.toFixed(config.unit === 'ms' ? 0 : 1)} {config.unit}
          </Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="Close" sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <ExpandedChart config={config} history={history} threshold={threshold} />
        <ExpandedDetails stats={stats} threshold={threshold} unit={config.unit} theme={theme} />
        {showSlowestCalls && <SlowestCallsTable calls={recentCalls} theme={theme} />}
      </DialogContent>
      <DialogActions>
        <Button
          variant="text"
          size="small"
          onClick={() => { onClose(); onNavigate(config.panelKey) }}
          sx={{ fontSize: 13, fontWeight: 600 }}
        >
          View Details
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function SlowestCallsTable({ calls, theme }: { calls: ApiCall[]; theme: Theme }) {
  const sorted = useMemo(
    () => [...calls].sort((a, b) => b.durationMs - a.durationMs).slice(0, SLOWEST_CALLS_COUNT),
    [calls],
  )

  if (sorted.length === 0) return null

  return (
    <Box sx={{ mt: 3 }}>
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          color: "text.secondary",
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          mb: 1,
          display: 'block'
        }}>
        Slowest Requests
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600, fontSize: 11 }}>Method</TableCell>
            <TableCell sx={{ fontWeight: 600, fontSize: 11 }}>Path</TableCell>
            <TableCell sx={{ fontWeight: 600, fontSize: 11 }}>Function</TableCell>
            <TableCell sx={{ fontWeight: 600, fontSize: 11 }} align="right">Status</TableCell>
            <TableCell sx={{ fontWeight: 600, fontSize: 11 }} align="right">Duration</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sorted.map((call) => {
            const isError = call.statusCode >= 400
            return (
              <TableRow key={call.id}>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{call.method}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: 12, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{call.path}</TableCell>
                <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{call.goFunc}</TableCell>
                <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: 12, color: isError ? theme.palette.error.main : 'text.primary' }}>{call.statusCode}</TableCell>
                <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: call.durationMs > 500 ? theme.palette.warning.main : call.durationMs > 1000 ? theme.palette.error.main : 'text.primary' }}>
                  {call.durationMs.toFixed(1)} ms
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Box>
  );
}

function ExpandedChart({ config, history, threshold }: { config: PanelConfig; history: MetricSnapshot[]; threshold: ObservabilityThreshold | undefined }) {
  const theme = useTheme()
  const chartRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartInstance = useRef<any>(null)
  const roRef = useRef<ResizeObserver | null>(null)

  useEffect(() => {
    if (!chartRef.current) return
    let disposed = false
    loadECharts().then((ec) => {
      if (disposed || !chartRef.current) return
      if (!chartInstance.current) {
        chartInstance.current = ec.init(chartRef.current, undefined, { renderer: 'canvas' })
        const ro = new ResizeObserver(() => chartInstance.current?.resize())
        ro.observe(chartRef.current)
        roRef.current = ro
      }
    })
    return () => {
      disposed = true
      chartInstance.current?.dispose()
      chartInstance.current = null
      roRef.current?.disconnect()
      roRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!chartInstance.current || history.length < 2) return
    const option = buildChartOption(config, history, threshold, theme)
    chartInstance.current.setOption(option, { notMerge: false })
  }, [config, history, threshold, theme])

  return <Box ref={chartRef} sx={{ width: '100%', height: 400 }} />
}

interface PanelStats { min: number; max: number; avg: number }

function computePanelStats(config: PanelConfig, history: MetricSnapshot[]): PanelStats {
  if (history.length === 0) return { min: 0, max: 0, avg: 0 }
  const values = history.map((s) => config.getValue(s))
  const sum = values.reduce((a, b) => a + b, 0)
  return { min: Math.min(...values), max: Math.max(...values), avg: sum / values.length }
}

function ExpandedDetails({ stats, threshold, unit, theme }: { stats: PanelStats; threshold: ObservabilityThreshold | undefined; unit: string; theme: Theme }) {
  const fmt = unit === 'ms' ? 0 : 1
  return (
    <Box sx={{ display: 'flex', gap: 3, mt: 2, flexWrap: 'wrap' }}>
      <StatChip label="Min" value={`${stats.min.toFixed(fmt)} ${unit}`} theme={theme} />
      <StatChip label="Avg" value={`${stats.avg.toFixed(fmt)} ${unit}`} theme={theme} />
      <StatChip label="Max" value={`${stats.max.toFixed(fmt)} ${unit}`} theme={theme} />
      {threshold && (
        <>
          <StatChip label="Warn" value={`${threshold.warnVal} ${unit}`} theme={theme} color={theme.palette.warning.main} />
          <StatChip label="Crit" value={`${threshold.critVal} ${unit}`} theme={theme} color={theme.palette.error.main} />
        </>
      )}
    </Box>
  )
}

function StatChip({ label, value, theme, color }: { label: string; value: string; theme: Theme; color?: string }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
      <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase' }}>{label}</Typography>
      <Typography sx={{ fontSize: 14, fontFamily: 'monospace', fontWeight: 700, color: color ?? theme.palette.text.primary }}>{value}</Typography>
    </Box>
  )
}

// ── Chart builders ──────────────────────────────────────────────────────────

function buildChartOption(
  config: PanelConfig,
  history: MetricSnapshot[],
  threshold: ObservabilityThreshold | undefined,
  theme: Theme,
) {
  const spanMs = history.length >= 2
    ? new Date(history[history.length - 1].timestamp).getTime() - new Date(history[0].timestamp).getTime()
    : 0
  const labels = history.map((s) => formatAxisLabel(new Date(s.timestamp), spanMs))
  const textColor = theme.palette.text.secondary
  const gridColor = theme.palette.divider

  const baseGrid = { top: 8, right: 8, bottom: 28, left: 40 }
  const baseXAxis = { type: 'category' as const, data: labels, axisLabel: { fontSize: 9, color: textColor, interval: Math.max(0, Math.floor(labels.length / 5) - 1), rotate: 0 }, axisLine: { show: false }, axisTick: { show: false } }
  const baseYAxis = { type: 'value' as const, splitLine: { lineStyle: { color: gridColor, opacity: 0.3 } }, axisLabel: { fontSize: 10, color: textColor } }
  const baseTooltip = buildBaseTooltip(theme)

  const thresholdMarkLines = threshold
    ? [
        { yAxis: threshold.warnVal, lineStyle: { color: theme.palette.warning.main, type: 'dashed' as const, opacity: 0.5 }, label: { show: false } },
        { yAxis: threshold.critVal, lineStyle: { color: theme.palette.error.main, type: 'dashed' as const, opacity: 0.5 }, label: { show: false } },
      ]
    : []

  switch (config.chartType) {
    case 'line':
    case 'errorline': {
      const color = config.chartType === 'errorline' ? theme.palette.error.main : theme.palette.primary.main
      const currentData = history.map((s) => config.getValue(s))
      const comparisonSeries = buildComparisonSeries(currentData, color, history.length)
      return {
        animation: false,
        tooltip: baseTooltip,
        grid: baseGrid,
        xAxis: baseXAxis,
        yAxis: baseYAxis,
        series: [
          {
            type: 'line',
            data: currentData,
            smooth: true,
            showSymbol: false,
            lineStyle: { width: 2, color },
            areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: color + '30' }, { offset: 1, color: color + '05' }] } },
            markLine: thresholdMarkLines.length > 0 ? { silent: true, symbol: 'none', data: thresholdMarkLines } : undefined,
          },
          ...comparisonSeries,
        ],
      }
    }

    case 'multiline': {
      if (config.key === 'latency') {
        return {
          animation: false,
          tooltip: { ...baseTooltip, trigger: 'axis' as const },
          grid: baseGrid,
          xAxis: baseXAxis,
          yAxis: baseYAxis,
          series: [
            { type: 'line', name: 'P50', data: history.map((s) => s.httpLatencyP50Ms), smooth: true, showSymbol: false, lineStyle: { width: 1.5, color: theme.palette.success.main } },
            { type: 'line', name: 'P95', data: history.map((s) => s.httpLatencyP95Ms), smooth: true, showSymbol: false, lineStyle: { width: 1.5, color: theme.palette.warning.main } },
            { type: 'line', name: 'P99', data: history.map((s) => s.httpLatencyP99Ms), smooth: true, showSymbol: false, lineStyle: { width: 2, color: theme.palette.error.main }, markLine: thresholdMarkLines.length > 0 ? { silent: true, symbol: 'none', data: thresholdMarkLines } : undefined },
          ],
        }
      }
      if (config.key === 'k8s-latency') {
        return {
          animation: false,
          tooltip: { ...baseTooltip, trigger: 'axis' as const },
          grid: baseGrid,
          xAxis: baseXAxis,
          yAxis: baseYAxis,
          series: [
            { type: 'line', name: 'P50', data: history.map((s) => s.k8sLatencyP50Ms), smooth: true, showSymbol: false, lineStyle: { width: 1.5, color: theme.palette.success.main } },
            { type: 'line', name: 'P99', data: history.map((s) => s.k8sLatencyP99Ms), smooth: true, showSymbol: false, lineStyle: { width: 2, color: theme.palette.error.main }, markLine: thresholdMarkLines.length > 0 ? { silent: true, symbol: 'none', data: thresholdMarkLines } : undefined },
          ],
        }
      }
      return {
        animation: false,
        tooltip: { ...baseTooltip, trigger: 'axis' as const },
        grid: baseGrid,
        xAxis: baseXAxis,
        yAxis: baseYAxis,
        series: [
          { type: 'line', name: 'GET', data: history.map((s) => s.k8sGetRate), smooth: true, showSymbol: false, lineStyle: { width: 1.5, color: theme.palette.info.main } },
          { type: 'line', name: 'PATCH', data: history.map((s) => s.k8sPatchRate), smooth: true, showSymbol: false, lineStyle: { width: 1.5, color: theme.palette.warning.main } },
          { type: 'line', name: 'DELETE', data: history.map((s) => s.k8sDeleteRate), smooth: true, showSymbol: false, lineStyle: { width: 1.5, color: theme.palette.error.main }, markLine: thresholdMarkLines.length > 0 ? { silent: true, symbol: 'none', data: thresholdMarkLines } : undefined },
        ],
      }
    }

    case 'bar': {
      return {
        animation: false,
        tooltip: { ...baseTooltip, trigger: 'axis' as const },
        grid: baseGrid,
        xAxis: baseXAxis,
        yAxis: baseYAxis,
        series: [
          { type: 'bar', name: 'Success', stack: 'policy', data: history.map((s) => s.policySuccessCount), itemStyle: { color: theme.palette.success.main } },
          { type: 'bar', name: 'Failed', stack: 'policy', data: history.map((s) => s.policyFailedCount), itemStyle: { color: theme.palette.error.main } },
          { type: 'bar', name: 'Interrupted', stack: 'policy', data: history.map((s) => s.policyInterruptedCount), itemStyle: { color: theme.palette.grey[500] } },
        ],
      }
    }

    case 'scatter': {
      const successData: [number, number][] = []
      const failData: [number, number][] = []
      history.forEach((s, i) => {
        if (s.workloadsScaledCount > 0) successData.push([i, s.scaleOperationDurationMs])
        if (s.policyFailedCount > 0) failData.push([i, s.scaleOperationDurationMs])
      })
      return {
        animation: false,
        tooltip: { ...baseTooltip, formatter: formatScatterTooltip },
        grid: baseGrid,
        xAxis: { ...baseXAxis, show: false },
        yAxis: { ...baseYAxis, name: 'ms', nameTextStyle: { fontSize: 10, color: textColor } },
        series: [
          { type: 'scatter', name: 'Success', data: successData, symbolSize: 8, itemStyle: { color: theme.palette.success.main, opacity: 0.7 } },
          { type: 'scatter', name: 'Failed', data: failData, symbolSize: 8, itemStyle: { color: theme.palette.error.main, opacity: 0.7 } },
        ],
      }
    }

    default:
      return {}
  }
}

// ── Comparison overlay ─────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildComparisonSeries(data: number[], color: string, historyLength: number): any[] {
  if (historyLength <= 30) return []
  const midpoint = Math.floor(data.length / 2)
  const previousHalf = data.slice(0, midpoint)
  const padded = new Array(data.length - previousHalf.length).fill(null)
  return [{
    type: 'line',
    name: 'Previous period',
    data: [...padded, ...previousHalf],
    smooth: true,
    showSymbol: false,
    lineStyle: { width: 1.5, color, type: 'dashed' as const, opacity: 0.2 },
    itemStyle: { opacity: 0 },
    tooltip: { show: false },
    silent: true,
  }]
}

// ── Tooltip & gauge helpers ─────────────────────────────────────────────────

function buildBaseTooltip(theme: Theme) {
  return {
    trigger: 'item' as const,
    backgroundColor: theme.palette.grey[900],
    borderColor: theme.palette.grey[800],
    borderWidth: 1,
    textStyle: { fontSize: 11, color: theme.palette.common.white },
    padding: [4, 8],
    extraCssText: 'box-shadow: none; border-radius: 4px;',
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatScatterTooltip(params: any) {
  const p = Array.isArray(params) ? params[0] : params
  return `<b>${p.seriesName}</b><br/>${p.value[1].toFixed(0)} ms`
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const INVERTED_PANELS = new Set(['cache_hit'])

function getThresholdStatus(value: number, panelKey: string, threshold: ObservabilityThreshold | undefined): 'ok' | 'warn' | 'crit' {
  if (!threshold) return 'ok'
  if (INVERTED_PANELS.has(panelKey)) {
    if (value <= threshold.critVal) return 'crit'
    if (value <= threshold.warnVal) return 'warn'
    return 'ok'
  }
  if (value >= threshold.critVal) return 'crit'
  if (value >= threshold.warnVal) return 'warn'
  return 'ok'
}

function formatAxisLabel(d: Date, spanMs: number): string {
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  if (spanMs <= 5 * 60_000) return `${hh}:${mm}:${ss}`
  if (spanMs <= 60 * 60_000) return `${hh}:${mm}`
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`
}
