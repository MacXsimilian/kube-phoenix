'use client'

import { useEffect, useRef } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Skeleton from '@mui/material/Skeleton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import { useTheme } from '@mui/material/styles'
import { useRouter } from 'next/navigation'
import { useObservabilityMetrics } from '@/lib/ObservabilityStreamContext'
import { COMPONENT_INFO } from '@/lib/observability-components'
import type { MetricSnapshot } from '@/lib/observability-types'

// ── Lazy eCharts ────────────────────────────────────────────────────────────

let echartsPromise: Promise<typeof import('echarts/core')> | null = null

async function loadECharts() {
  if (!echartsPromise) {
    echartsPromise = (async () => {
      const [core, { LineChart }, { GridComponent, TooltipComponent, MarkLineComponent }, { CanvasRenderer }] =
        await Promise.all([
          import('echarts/core'),
          import('echarts/charts'),
          import('echarts/components'),
          import('echarts/renderers'),
        ])
      core.use([LineChart, GridComponent, TooltipComponent, MarkLineComponent, CanvasRenderer])
      return core
    })()
  }
  return echartsPromise
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function ComponentDetail({ component }: { component: string }) {
  const theme = useTheme()
  const router = useRouter()
  const { latest, history } = useObservabilityMetrics()
  const info = COMPONENT_INFO[component]

  if (!info) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography variant="h6">Component not found: {component}</Typography>
      </Box>
    )
  }

  const loading = !latest
  const snap = latest?.snapshot
  const componentMetrics = latest?.components.find((c) => c.component === info.id)
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
            <Typography variant="h5" sx={{
              fontWeight: 700
            }}>{info.label}</Typography>
            {loading ? (
              <Skeleton variant="circular" width={10} height={10} />
            ) : (
              <>
                <FiberManualRecordIcon sx={{ fontSize: 10, color: statusColor }} />
                <Chip label={status.toUpperCase()} size="small" sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: `${statusColor}20`, color: statusColor }} />
              </>
            )}
          </Box>
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              mt: 0.5
            }}>
            {info.description}
          </Typography>
          {info.goFile && (
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                fontFamily: 'monospace'
              }}>
              {info.goFile}
            </Typography>
          )}
        </Box>
      </Box>
      {/* Metric cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: `repeat(${Math.min(info.metrics.length, 4)}, 1fr)` }, gap: 2, mb: 3 }}>
        {info.metrics.map((m) => (
          <Card key={m.label} sx={{ p: 2 }}>
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                fontWeight: 600
              }}>{m.label}</Typography>
            {loading ? (
              <Skeleton variant="text" width={80} sx={{ fontSize: '2.125rem' }} />
            ) : (
              <Typography variant="h4" sx={{
                fontWeight: 700
              }}>
                {m.unit === 'ms' ? (snap ? m.getValue(snap) : 0).toFixed(0) : (snap ? m.getValue(snap) : 0).toFixed(1)}
              </Typography>
            )}
            <Typography variant="caption" sx={{
              color: "text.secondary"
            }}>{m.unit}</Typography>
          </Card>
        ))}
      </Box>
      {/* Metric charts */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 3 }}>
        {info.metrics.map((m) => (
          <MetricChart key={m.label} label={m.label} unit={m.unit} getValue={m.getValue} history={history} />
        ))}
      </Box>
      {/* Related links */}
      {info.relatedLinks.length > 0 && (
        <Card sx={{ p: 2 }}>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 700,
              mb: 1
            }}>Connected Components</Typography>
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
  );
}

// ── MetricChart ─────────────────────────────────────────────────────────────

function MetricChart({ label, unit, getValue, history }: { label: string; unit: string; getValue: (s: MetricSnapshot) => number; history: MetricSnapshot[] }) {
  const theme = useTheme()
  const chartRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartInstance = useRef<any>(null)
  const roRef = useRef<ResizeObserver | null>(null)

  useEffect(() => {
    if (!chartRef.current || history.length < 2) return

    let disposed = false
    loadECharts().then((ec) => {
      if (disposed || !chartRef.current) return
      if (!chartInstance.current) {
        chartInstance.current = ec.init(chartRef.current, undefined, { renderer: 'canvas' })
        const ro = new ResizeObserver(() => chartInstance.current?.resize())
        ro.observe(chartRef.current)
        roRef.current = ro
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

    return () => {
      disposed = true
      chartInstance.current?.dispose()
      chartInstance.current = null
      roRef.current?.disconnect()
      roRef.current = null
    }
  }, [history, getValue, label, unit, theme])

  return (
    <Card sx={{ p: 2 }}>
      <Typography
        variant="caption"
        sx={{
          fontWeight: 600,
          color: "text.secondary",
          mb: 1,
          display: 'block'
        }}>
        {label} ({unit})
      </Typography>
      <Box ref={chartRef} sx={{ height: 200 }} />
    </Card>
  );
}
