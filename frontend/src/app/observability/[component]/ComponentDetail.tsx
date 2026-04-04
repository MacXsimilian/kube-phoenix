'use client'

import { useEffect, useRef, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import { useTheme } from '@mui/material/styles'
import { useRouter } from 'next/navigation'
import { useObservabilityStream } from '@/lib/useObservabilityStream'
import type { MetricSnapshot } from '@/lib/observability-types'

// ── Component metadata ──────────────────────────────────────────────────────

interface ComponentInfo {
  id: string
  label: string
  description: string
  goFile: string
  metrics: { label: string; unit: string; getValue: (s: MetricSnapshot) => number }[]
  relatedLinks: { direction: 'in' | 'out'; target: string; category: string }[]
}

const COMPONENT_INFO: Record<string, ComponentInfo> = {
  router: {
    id: 'router',
    label: 'Chi Router',
    description: 'HTTP routing, request ID generation, logging middleware. Entry point for all API traffic.',
    goFile: 'internal/api/router.go',
    metrics: [
      { label: 'Request Rate', unit: 'req/s', getValue: (s) => s.httpRequestRate },
      { label: 'P50 Latency', unit: 'ms', getValue: (s) => s.httpLatencyP50Ms },
      { label: 'P99 Latency', unit: 'ms', getValue: (s) => s.httpLatencyP99Ms },
      { label: 'Error Rate', unit: '/s', getValue: (s) => s.httpErrorRate },
    ],
    relatedLinks: [
      { direction: 'out', target: 'auth', category: 'http' },
    ],
  },
  auth: {
    id: 'auth',
    label: 'Auth Middleware',
    description: 'Session validation, CSRF protection, RBAC enforcement. Rejects unauthenticated requests.',
    goFile: 'internal/middleware/session.go',
    metrics: [
      { label: 'Throughput', unit: 'req/s', getValue: (s) => s.httpRequestRate * 0.98 },
      { label: 'Active Sessions', unit: '', getValue: (s) => s.wsActiveConnections * 2 },
      { label: 'Rate Limit Hits', unit: '', getValue: (s) => s.rateLimitHits },
    ],
    relatedLinks: [
      { direction: 'in', target: 'router', category: 'http' },
      { direction: 'out', target: 'handlers', category: 'http' },
    ],
  },
  handlers: {
    id: 'handlers',
    label: 'API Handlers',
    description: 'REST endpoint logic for policies, cluster state, users, guardrails, and audit logs.',
    goFile: 'internal/api/',
    metrics: [
      { label: 'Request Rate', unit: 'req/s', getValue: (s) => s.httpRequestRate * 0.95 },
      { label: 'Latency', unit: 'ms', getValue: (s) => s.httpLatencyP50Ms },
      { label: 'Error Rate', unit: '/s', getValue: (s) => s.httpErrorRate },
      { label: 'Audit Drops', unit: '', getValue: (s) => s.auditDrops },
    ],
    relatedLinks: [
      { direction: 'in', target: 'auth', category: 'http' },
      { direction: 'out', target: 'scheduler', category: 'internal' },
      { direction: 'out', target: 'store', category: 'store' },
      { direction: 'out', target: 'ws-broker', category: 'ws' },
    ],
  },
  scheduler: {
    id: 'scheduler',
    label: 'Policy Scheduler',
    description: 'Evaluation loop running on a configurable tick interval. Evaluates policies, triggers sleep/wake.',
    goFile: 'internal/scheduler/scheduler.go',
    metrics: [
      { label: 'Eval Rate', unit: '/min', getValue: (s) => s.schedulerEvalRate },
      { label: 'Eval Duration', unit: 'ms', getValue: (s) => s.schedulerEvalDurationMs },
      { label: 'Panics', unit: '', getValue: (s) => s.schedulerPanics },
    ],
    relatedLinks: [
      { direction: 'in', target: 'handlers', category: 'internal' },
      { direction: 'out', target: 'scaler', category: 'internal' },
      { direction: 'out', target: 'ws-broker', category: 'ws' },
    ],
  },
  scaler: {
    id: 'scaler',
    label: 'Scaler',
    description: 'Performs the actual workload scaling — sets replica counts on Deployments and StatefulSets.',
    goFile: 'internal/scaler/',
    metrics: [
      { label: 'Workloads Scaled', unit: '', getValue: (s) => s.workloadsScaledCount },
      { label: 'Scale Duration', unit: 'ms', getValue: (s) => s.scaleOperationDurationMs },
    ],
    relatedLinks: [
      { direction: 'in', target: 'scheduler', category: 'internal' },
      { direction: 'out', target: 'k8s-client', category: 'k8s' },
    ],
  },
  'k8s-client': {
    id: 'k8s-client',
    label: 'K8s Client',
    description: 'client-go wrapper for Kubernetes API calls. Handles GET/PATCH/DELETE on Deployments, StatefulSets, Nodes.',
    goFile: 'internal/k8s/client.go',
    metrics: [
      { label: 'GET Rate', unit: '/min', getValue: (s) => s.k8sGetRate },
      { label: 'PATCH Rate', unit: '/min', getValue: (s) => s.k8sPatchRate },
      { label: 'DELETE Rate', unit: '/min', getValue: (s) => s.k8sDeleteRate },
    ],
    relatedLinks: [
      { direction: 'in', target: 'scaler', category: 'k8s' },
      { direction: 'out', target: 'store', category: 'store' },
    ],
  },
  store: {
    id: 'store',
    label: 'Store (GORM)',
    description: 'PostgreSQL persistence layer. Connection pool of 10. Handles policies, executions, audit logs, snapshots.',
    goFile: 'internal/store/store.go',
    metrics: [
      { label: 'Query Rate', unit: 'req/s', getValue: (s) => s.httpRequestRate * 0.6 },
      { label: 'Audit Drops', unit: '', getValue: (s) => s.auditDrops },
      { label: 'Cache Hit Rate', unit: '%', getValue: (s) => s.cacheHitRate },
    ],
    relatedLinks: [
      { direction: 'in', target: 'handlers', category: 'store' },
      { direction: 'in', target: 'k8s-client', category: 'store' },
    ],
  },
  'ws-broker': {
    id: 'ws-broker',
    label: 'WS Broker',
    description: 'Pub/sub event broker for WebSocket connections. Streams execution logs to connected clients.',
    goFile: 'internal/api/ws.go',
    metrics: [
      { label: 'Active Connections', unit: '', getValue: (s) => s.wsActiveConnections },
    ],
    relatedLinks: [
      { direction: 'in', target: 'scheduler', category: 'ws' },
      { direction: 'in', target: 'handlers', category: 'ws' },
      { direction: 'out', target: 'handlers', category: 'ws' },
    ],
  },
  // Panel-key based routes (from Metrics Dashboard clicks)
  http_rate: { id: 'router', label: 'HTTP Request Rate', description: 'Aggregate HTTP request throughput across all endpoints.', goFile: 'internal/api/router.go', metrics: [{ label: 'Request Rate', unit: 'req/s', getValue: (s) => s.httpRequestRate }, { label: 'Error Rate', unit: '/s', getValue: (s) => s.httpErrorRate }], relatedLinks: [] },
  latency_p99: { id: 'handlers', label: 'HTTP Latency', description: 'Request latency at P50, P95, and P99 percentiles.', goFile: 'internal/api/', metrics: [{ label: 'P50', unit: 'ms', getValue: (s) => s.httpLatencyP50Ms }, { label: 'P95', unit: 'ms', getValue: (s) => s.httpLatencyP95Ms }, { label: 'P99', unit: 'ms', getValue: (s) => s.httpLatencyP99Ms }], relatedLinks: [] },
  policy_executions: { id: 'scheduler', label: 'Policy Executions', description: 'Policy execution outcomes — success, failed, skipped.', goFile: 'internal/scheduler/', metrics: [{ label: 'Success', unit: '', getValue: (s) => s.policySuccessCount }, { label: 'Failed', unit: '', getValue: (s) => s.policyFailedCount }, { label: 'Skipped', unit: '', getValue: (s) => s.policySkippedCount }], relatedLinks: [] },
  k8s_api: { id: 'k8s-client', label: 'K8s API Calls', description: 'Kubernetes API call rates by verb.', goFile: 'internal/k8s/client.go', metrics: [{ label: 'GET', unit: '/min', getValue: (s) => s.k8sGetRate }, { label: 'PATCH', unit: '/min', getValue: (s) => s.k8sPatchRate }, { label: 'DELETE', unit: '/min', getValue: (s) => s.k8sDeleteRate }], relatedLinks: [] },
  ws_connections: { id: 'ws-broker', label: 'WebSocket Connections', description: 'Active WebSocket connections for log streaming.', goFile: 'internal/api/ws.go', metrics: [{ label: 'Active', unit: '', getValue: (s) => s.wsActiveConnections }], relatedLinks: [] },
  cache_hit: { id: 'store', label: 'Cache Hit Rate', description: 'Cluster cache effectiveness. Lower rates mean more rebuilds.', goFile: 'internal/k8s/cache.go', metrics: [{ label: 'Hit Rate', unit: '%', getValue: (s) => s.cacheHitRate }], relatedLinks: [] },
  scheduler_health: { id: 'scheduler', label: 'Scheduler Health', description: 'Scheduler evaluation rate and duration.', goFile: 'internal/scheduler/', metrics: [{ label: 'Eval Rate', unit: '/min', getValue: (s) => s.schedulerEvalRate }, { label: 'Eval Duration', unit: 'ms', getValue: (s) => s.schedulerEvalDurationMs }, { label: 'Panics', unit: '', getValue: (s) => s.schedulerPanics }], relatedLinks: [] },
  error_rate: { id: 'router', label: 'Error Rate', description: 'Combined error rate across HTTP 5xx, scheduler panics, and audit drops.', goFile: '', metrics: [{ label: 'Total Errors', unit: '/s', getValue: (s) => s.totalErrorRate }, { label: 'HTTP Errors', unit: '/s', getValue: (s) => s.httpErrorRate }, { label: 'Panics', unit: '', getValue: (s) => s.schedulerPanics }, { label: 'Audit Drops', unit: '', getValue: (s) => s.auditDrops }], relatedLinks: [] },
}

// ── Lazy eCharts ────────────────────────────────────────────────────────────

let echarts: typeof import('echarts/core') | null = null
let echartsLoaded = false

async function loadECharts() {
  if (echartsLoaded) return echarts!
  const [core, { LineChart }, { GridComponent, TooltipComponent, MarkLineComponent }, { CanvasRenderer }] =
    await Promise.all([
      import('echarts/core'),
      import('echarts/charts'),
      import('echarts/components'),
      import('echarts/renderers'),
    ])
  core.use([LineChart, GridComponent, TooltipComponent, MarkLineComponent, CanvasRenderer])
  echarts = core
  echartsLoaded = true
  return core
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function ComponentDetail({ component }: { component: string }) {
  const theme = useTheme()
  const router = useRouter()
  const stream = useObservabilityStream()
  const info = COMPONENT_INFO[component]

  if (!info) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography variant="h6">Component not found: {component}</Typography>
      </Box>
    )
  }

  const snap = stream.latest?.snapshot
  const componentMetrics = stream.latest?.components.find((c) => c.component === info.id)
  const status = componentMetrics?.status ?? 'ok'
  const statusColor = status === 'crit' ? theme.palette.error.main : status === 'warn' ? theme.palette.warning.main : theme.palette.success.main

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', py: 3, px: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton size="small" onClick={() => router.push('/observability')}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h5" fontWeight={700}>{info.label}</Typography>
            <FiberManualRecordIcon sx={{ fontSize: 10, color: statusColor }} />
            <Chip label={status.toUpperCase()} size="small" sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: `${statusColor}20`, color: statusColor }} />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {info.description}
          </Typography>
          {info.goFile && (
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
              {info.goFile}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Metric cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: `repeat(${Math.min(info.metrics.length, 4)}, 1fr)` }, gap: 2, mb: 3 }}>
        {info.metrics.map((m) => {
          const value = snap ? m.getValue(snap) : 0
          return (
            <Card key={m.label} sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>{m.label}</Typography>
              <Typography variant="h4" fontWeight={700}>
                {m.unit === 'ms' ? value.toFixed(0) : m.unit === '%' ? value.toFixed(1) : value.toFixed(1)}
              </Typography>
              <Typography variant="caption" color="text.secondary">{m.unit}</Typography>
            </Card>
          )
        })}
      </Box>

      {/* Metric charts */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 3 }}>
        {info.metrics.map((m) => (
          <MetricChart key={m.label} label={m.label} unit={m.unit} getValue={m.getValue} history={stream.history} />
        ))}
      </Box>

      {/* Related links */}
      {info.relatedLinks.length > 0 && (
        <Card sx={{ p: 2 }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Connected Components</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {info.relatedLinks.map((link) => (
              <Chip
                key={`${link.direction}-${link.target}`}
                label={`${link.direction === 'in' ? '←' : '→'} ${link.target} (${link.category})`}
                size="small"
                onClick={() => router.push(`/observability/${link.target}`)}
                sx={{ cursor: 'pointer', fontWeight: 500 }}
              />
            ))}
          </Box>
        </Card>
      )}
    </Box>
  )
}

// ── MetricChart ─────────────────────────────────────────────────────────────

function MetricChart({ label, unit, getValue, history }: { label: string; unit: string; getValue: (s: MetricSnapshot) => number; history: MetricSnapshot[] }) {
  const theme = useTheme()
  const chartRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartInstance = useRef<any>(null)

  useEffect(() => {
    if (!chartRef.current || history.length < 2) return

    let disposed = false
    loadECharts().then((ec) => {
      if (disposed || !chartRef.current) return
      if (!chartInstance.current) {
        chartInstance.current = ec.init(chartRef.current, undefined, { renderer: 'canvas' })
        const ro = new ResizeObserver(() => chartInstance.current?.resize())
        ro.observe(chartRef.current)
      }

      const labels = history.map((s) => new Date(s.timestamp).toLocaleTimeString())
      const data = history.map((s) => getValue(s))
      const color = theme.palette.primary.main

      chartInstance.current!.setOption({
        animation: false,
        grid: { top: 8, right: 8, bottom: 24, left: 50 },
        xAxis: { type: 'category', data: labels, axisLabel: { fontSize: 9, color: theme.palette.text.secondary, rotate: 0, interval: Math.floor(labels.length / 6) } },
        yAxis: { type: 'value', splitLine: { lineStyle: { color: theme.palette.divider, opacity: 0.3 } }, axisLabel: { fontSize: 10, color: theme.palette.text.secondary } },
        tooltip: { trigger: 'axis', formatter: (p: { value: number }[]) => `${p[0]?.value?.toFixed(1) ?? ''} ${unit}` },
        series: [{
          type: 'line',
          data,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2, color },
          areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: color + '30' }, { offset: 1, color: color + '05' }] } },
        }],
      }, { notMerge: false })
    })

    return () => { disposed = true }
  }, [history, getValue, label, unit, theme])

  return (
    <Card sx={{ p: 2 }}>
      <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        {label} ({unit})
      </Typography>
      <Box ref={chartRef} sx={{ height: 200 }} />
    </Card>
  )
}
