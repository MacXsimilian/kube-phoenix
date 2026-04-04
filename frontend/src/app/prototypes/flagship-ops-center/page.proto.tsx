'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import { useRouter } from 'next/navigation'
import * as echarts from 'echarts'
import { darkTheme } from '@/lib/motion/echartsTheme'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'

echarts.registerTheme('kube-phoenix-dark', darkTheme)

// ---------------------------------------------------------------------------
// Random walk utility
// ---------------------------------------------------------------------------

function rw(prev: number, min: number, max: number, vol: number): number {
  return Math.max(min, Math.min(max, prev + (Math.random() - 0.48) * vol))
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour12: false })
}

function timeLabel(secondsAgo: number): string {
  const d = new Date(Date.now() - secondsAgo * 1000)
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IncidentEvent {
  id: string
  severity: 'warn' | 'crit'
  message: string
  timestamp: Date
}

interface ThresholdState {
  httpRate: 'ok' | 'warn' | 'crit'
  latencyP99: 'ok' | 'warn' | 'crit'
  k8sApi: 'ok' | 'warn' | 'crit'
  cacheHit: 'ok' | 'warn' | 'crit'
  errorRate: 'ok' | 'warn' | 'crit'
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WINDOW = 60
const TICK_MS = 1000
const EVENT_TTL_MS = 10000

const COLORS = {
  purple: '#7C3AED',
  blue: '#3B82F6',
  cyan: '#22D3EE',
  green: '#22C55E',
  amber: '#F59E0B',
  red: '#EF4444',
  teal: '#14B8A6',
  indigo: '#6366F1',
  grey: '#64748B',
}

// ---------------------------------------------------------------------------
// Initial data generators
// ---------------------------------------------------------------------------

function generateTimeSeries(base: number, vol: number, min: number, max: number): number[] {
  const data: number[] = []
  let val = base
  for (let i = 0; i < WINDOW; i++) {
    val = rw(val, min, max, vol)
    data.push(Math.round(val * 10) / 10)
  }
  return data
}

function generateTimeLabels(): string[] {
  const labels: string[] = []
  for (let i = WINDOW - 1; i >= 0; i--) {
    labels.push(timeLabel(i))
  }
  return labels
}

function generatePolicyData(): { success: number[]; failed: number[]; skipped: number[]; hours: string[] } {
  const success: number[] = []
  const failed: number[] = []
  const skipped: number[] = []
  const hours: string[] = []
  for (let i = 23; i >= 0; i--) {
    const h = new Date(Date.now() - i * 3600000)
    hours.push(`${h.getHours().toString().padStart(2, '0')}:00`)
    const total = Math.floor(Math.random() * 4) + 2
    const fail = Math.random() < 0.1 ? Math.floor(Math.random() * 2) + 1 : 0
    const skip = Math.random() < 0.15 ? 1 : 0
    success.push(Math.max(0, total - fail - skip))
    failed.push(fail)
    skipped.push(skip)
  }
  return { success, failed, skipped, hours }
}

function generateScatterData(): { time: number[]; duration: number[]; success: boolean[]; replicas: number[] } {
  const time: number[] = []
  const duration: number[] = []
  const success: boolean[] = []
  const replicas: number[] = []
  const now = Date.now()
  for (let i = 0; i < 30; i++) {
    time.push(now - (30 - i) * 120000)
    duration.push(Math.max(50, 450 + (Math.random() - 0.5) * 400))
    success.push(Math.random() > 0.1)
    replicas.push(Math.floor(Math.random() * 8) + 1)
  }
  return { time, duration, success, replicas }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FlagshipOpsCenter() {
  const router = useRouter()

  const chartRefs = useRef<(HTMLDivElement | null)[]>(Array(8).fill(null))
  const chartInstances = useRef<(echarts.ECharts | null)[]>(Array(8).fill(null))

  const uptimeRef = useRef<HTMLSpanElement>(null)
  const timeRef = useRef<HTMLSpanElement>(null)
  const alertCountRef = useRef<HTMLSpanElement>(null)

  const [events, setEvents] = useState<IncidentEvent[]>([])
  const [thresholds, setThresholds] = useState<ThresholdState>({
    httpRate: 'ok',
    latencyP99: 'ok',
    k8sApi: 'ok',
    cacheHit: 'ok',
    errorRate: 'ok',
  })
  const [systemStatus, setSystemStatus] = useState<'healthy' | 'warning' | 'critical'>('healthy')

  const dataRef = useRef({
    httpRate: generateTimeSeries(120, 30, 50, 220),
    latP50: generateTimeSeries(80, 30, 20, 200),
    latP95: generateTimeSeries(180, 50, 50, 400),
    latP99: generateTimeSeries(250, 100, 80, 700),
    k8sGet: generateTimeSeries(40, 12, 10, 80),
    k8sPatch: generateTimeSeries(15, 8, 0, 40),
    k8sDelete: generateTimeSeries(5, 4, 0, 20),
    wsConns: generateTimeSeries(12, 3, 2, 25),
    cacheHit: 94,
    errorRate: generateTimeSeries(0.5, 1, 0, 20),
    policy: generatePolicyData(),
    scatter: generateScatterData(),
    labels: generateTimeLabels(),
    uptime: 14 * 86400 + 7 * 3600 + 23 * 60,
    activePolicies: 12,
    wsConnCount: 8,
  })

  const eventsRef = useRef<IncidentEvent[]>([])

  const addEvent = useCallback((severity: 'warn' | 'crit', message: string) => {
    const event: IncidentEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      severity,
      message,
      timestamp: new Date(),
    }
    eventsRef.current = [event, ...eventsRef.current].slice(0, 5)
    setEvents([...eventsRef.current])
  }, [])

  // -------------------------------------------------------------------------
  // eCharts initialization
  // -------------------------------------------------------------------------

  useEffect(() => {
    const instances: echarts.ECharts[] = []

    chartRefs.current.forEach((el, i) => {
      if (!el) return
      const chart = echarts.init(el, 'kube-phoenix-dark', { renderer: 'canvas' })
      chartInstances.current[i] = chart
      instances.push(chart)
    })

    const d = dataRef.current

    // Panel 1: HTTP Request Rate
    chartInstances.current[0]?.setOption(buildLineOption(d.labels, d.httpRate, COLORS.blue, 150, 200, 'req/s'))

    // Panel 2: HTTP Latency P99
    chartInstances.current[1]?.setOption(buildLatencyOption(d.labels, d.latP50, d.latP95, d.latP99))

    // Panel 3: Policy Executions
    chartInstances.current[2]?.setOption(buildPolicyOption(d.policy))

    // Panel 4: K8s API Calls
    chartInstances.current[3]?.setOption(buildK8sOption(d.labels, d.k8sGet, d.k8sPatch, d.k8sDelete))

    // Panel 5: WebSocket Connections
    chartInstances.current[4]?.setOption(buildAreaOption(d.labels, d.wsConns, COLORS.teal))

    // Panel 6: Cache Hit Rate (Gauge)
    chartInstances.current[5]?.setOption(buildGaugeOption(d.cacheHit))

    // Panel 7: Pod Scale Operations (Scatter)
    chartInstances.current[6]?.setOption(buildScatterOption(d.scatter))

    // Panel 8: Error Rate
    chartInstances.current[7]?.setOption(buildErrorOption(d.labels, d.errorRate))

    // ResizeObserver
    const ro = new ResizeObserver(() => {
      instances.forEach((c) => c.resize())
    })
    chartRefs.current.forEach((el) => {
      if (el) ro.observe(el)
    })

    return () => {
      ro.disconnect()
      instances.forEach((c) => c.dispose())
      chartInstances.current = Array(8).fill(null)
    }
  }, [])

  // -------------------------------------------------------------------------
  // Streaming loop
  // -------------------------------------------------------------------------

  useEffect(() => {
    const interval = setInterval(() => {
      const d = dataRef.current

      // Update time label
      d.labels.push(timeLabel(0))
      d.labels.shift()

      // Random walks
      const newHttpRate = rw(d.httpRate[d.httpRate.length - 1], 50, 220, 30)
      d.httpRate.push(Math.round(newHttpRate * 10) / 10)
      d.httpRate.shift()

      const newP50 = rw(d.latP50[d.latP50.length - 1], 20, 200, 30)
      d.latP50.push(Math.round(newP50 * 10) / 10)
      d.latP50.shift()

      const newP95 = rw(d.latP95[d.latP95.length - 1], 50, 400, 50)
      d.latP95.push(Math.round(newP95 * 10) / 10)
      d.latP95.shift()

      // Occasional P99 spike
      const spikeChance = Math.random()
      let newP99Base = rw(d.latP99[d.latP99.length - 1], 80, 700, 100)
      if (spikeChance < 0.03) newP99Base = 550 + Math.random() * 200
      d.latP99.push(Math.round(newP99Base * 10) / 10)
      d.latP99.shift()

      const newK8sGet = rw(d.k8sGet[d.k8sGet.length - 1], 10, 80, 12)
      d.k8sGet.push(Math.round(newK8sGet))
      d.k8sGet.shift()

      const newK8sPatch = rw(d.k8sPatch[d.k8sPatch.length - 1], 0, 40, 8)
      d.k8sPatch.push(Math.round(newK8sPatch))
      d.k8sPatch.shift()

      const newK8sDelete = rw(d.k8sDelete[d.k8sDelete.length - 1], 0, 20, 4)
      d.k8sDelete.push(Math.round(newK8sDelete))
      d.k8sDelete.shift()

      const newWs = rw(d.wsConns[d.wsConns.length - 1], 2, 25, 3)
      d.wsConns.push(Math.round(newWs))
      d.wsConns.shift()

      d.cacheHit = rw(d.cacheHit, 70, 100, 3)
      d.cacheHit = Math.round(d.cacheHit * 10) / 10

      // Error rate with occasional spikes
      let newErr = rw(d.errorRate[d.errorRate.length - 1], 0, 20, 1)
      if (Math.random() < 0.04) newErr = 6 + Math.random() * 6
      d.errorRate.push(Math.round(newErr * 10) / 10)
      d.errorRate.shift()

      d.uptime += 1
      d.wsConnCount = Math.round(newWs)

      // Threshold checks
      const currentHttpRate = d.httpRate[d.httpRate.length - 1]
      const currentP99 = d.latP99[d.latP99.length - 1]
      const totalK8s = d.k8sGet[d.k8sGet.length - 1] + d.k8sPatch[d.k8sPatch.length - 1] + d.k8sDelete[d.k8sDelete.length - 1]
      const currentErr = d.errorRate[d.errorRate.length - 1]

      const newThresholds: ThresholdState = {
        httpRate: currentHttpRate >= 200 ? 'crit' : currentHttpRate >= 150 ? 'warn' : 'ok',
        latencyP99: currentP99 >= 1000 ? 'crit' : currentP99 >= 500 ? 'warn' : 'ok',
        k8sApi: totalK8s >= 120 ? 'crit' : totalK8s >= 100 ? 'warn' : 'ok',
        cacheHit: d.cacheHit < 70 ? 'crit' : d.cacheHit < 90 ? 'warn' : 'ok',
        errorRate: currentErr >= 15 ? 'crit' : currentErr >= 5 ? 'warn' : 'ok',
      }

      // Generate events for threshold crossings
      const prevThresholds = thresholdsRef.current
      if (newThresholds.httpRate !== 'ok' && prevThresholds.httpRate === 'ok') {
        addEvent(newThresholds.httpRate, `HTTP request rate ${newThresholds.httpRate === 'crit' ? 'exceeded 200' : 'exceeded 150'} req/s`)
      }
      if (newThresholds.latencyP99 !== 'ok' && prevThresholds.latencyP99 === 'ok') {
        addEvent(newThresholds.latencyP99, `P99 latency ${newThresholds.latencyP99 === 'crit' ? 'exceeded 1000ms' : 'exceeded 500ms'}`)
      }
      if (newThresholds.cacheHit !== 'ok' && prevThresholds.cacheHit === 'ok') {
        addEvent(newThresholds.cacheHit, `Cache hit rate dropped below ${newThresholds.cacheHit === 'crit' ? '70%' : '90%'}`)
      }
      if (newThresholds.errorRate !== 'ok' && prevThresholds.errorRate === 'ok') {
        addEvent(newThresholds.errorRate, `Error rate ${newThresholds.errorRate === 'crit' ? 'exceeded 15' : 'exceeded 5'}/min`)
      }
      if (newThresholds.k8sApi !== 'ok' && prevThresholds.k8sApi === 'ok') {
        addEvent(newThresholds.k8sApi, `K8s API calls ${newThresholds.k8sApi === 'crit' ? 'exceeded 120' : 'exceeded 100'}/min`)
      }

      thresholdsRef.current = newThresholds
      setThresholds({ ...newThresholds })

      const hasCrit = Object.values(newThresholds).some((v) => v === 'crit')
      const hasWarn = Object.values(newThresholds).some((v) => v === 'warn')
      setSystemStatus(hasCrit ? 'critical' : hasWarn ? 'warning' : 'healthy')

      // Update charts
      chartInstances.current[0]?.setOption(buildLineOption(d.labels, d.httpRate, COLORS.blue, 150, 200, 'req/s'), { notMerge: false })
      chartInstances.current[1]?.setOption(buildLatencyOption(d.labels, d.latP50, d.latP95, d.latP99), { notMerge: false })
      chartInstances.current[3]?.setOption(buildK8sOption(d.labels, d.k8sGet, d.k8sPatch, d.k8sDelete), { notMerge: false })
      chartInstances.current[4]?.setOption(buildAreaOption(d.labels, d.wsConns, COLORS.teal), { notMerge: false })
      chartInstances.current[5]?.setOption(buildGaugeOption(d.cacheHit), { notMerge: false })
      chartInstances.current[7]?.setOption(buildErrorOption(d.labels, d.errorRate), { notMerge: false })

      // Scatter: occasionally add a new point
      if (Math.random() < 0.3) {
        d.scatter.time.push(Date.now())
        d.scatter.duration.push(Math.max(50, 450 + (Math.random() - 0.5) * 400))
        d.scatter.success.push(Math.random() > 0.1)
        d.scatter.replicas.push(Math.floor(Math.random() * 8) + 1)
        if (d.scatter.time.length > 40) {
          d.scatter.time.shift()
          d.scatter.duration.shift()
          d.scatter.success.shift()
          d.scatter.replicas.shift()
        }
        chartInstances.current[6]?.setOption(buildScatterOption(d.scatter), { notMerge: false })
      }

      // GSAP counters
      if (uptimeRef.current) {
        gsap.to(uptimeRef.current, {
          duration: 0.4,
          textContent: formatUptime(d.uptime),
          snap: { textContent: 1 },
          ease: 'none',
          onUpdate() {
            if (uptimeRef.current) uptimeRef.current.textContent = formatUptime(d.uptime)
          },
        })
      }
      if (timeRef.current) {
        timeRef.current.textContent = formatTime(new Date())
      }
    }, TICK_MS)

    return () => clearInterval(interval)
  }, [addEvent])

  // Event auto-dismiss
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const filtered = eventsRef.current.filter((e) => now - e.timestamp.getTime() < EVENT_TTL_MS)
      if (filtered.length !== eventsRef.current.length) {
        eventsRef.current = filtered
        setEvents([...filtered])
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const thresholdsRef = useRef<ThresholdState>({
    httpRate: 'ok',
    latencyP99: 'ok',
    k8sApi: 'ok',
    cacheHit: 'ok',
    errorRate: 'ok',
  })

  const d = dataRef.current
  const alertCount = Object.values(thresholds).filter((v) => v !== 'ok').length

  const statusColor = systemStatus === 'healthy' ? COLORS.green : systemStatus === 'warning' ? COLORS.amber : COLORS.red
  const statusLabel = systemStatus === 'healthy' ? 'System Healthy' : systemStatus === 'warning' ? 'Warning' : 'Critical'

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0B0E14', color: '#E2E8F0', pb: 2 }}>
      {/* Header */}
      <Box sx={{ maxWidth: 1600, mx: 'auto', px: 3, pt: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
          <IconButton onClick={() => router.push('/prototypes/')} size="small" sx={{ color: '#94A3B8' }}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
              FL7 — Prometheus Ops Center
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748B' }}>
              Real-time operator metrics with streaming charts and threshold alerts
            </Typography>
          </Box>
        </Box>

        {/* Status Bar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            px: 2,
            py: 1,
            borderRadius: 1.5,
            bgcolor: systemStatus === 'healthy' ? 'rgba(34,197,94,0.08)' : systemStatus === 'warning' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
            border: '1px solid',
            borderColor: systemStatus === 'healthy' ? 'rgba(34,197,94,0.2)' : systemStatus === 'warning' ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)',
            mb: 2,
            flexWrap: 'wrap',
            transition: 'all 0.3s ease',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <FiberManualRecordIcon sx={{ fontSize: 10, color: statusColor, animation: systemStatus !== 'healthy' ? 'pulse 1.5s infinite' : 'none' }} />
            <Typography variant="body2" sx={{ fontWeight: 600, color: statusColor }}>
              {statusLabel}
            </Typography>
          </Box>
          <Divider />
          <StatusItem label="Time" valueRef={timeRef} initial={formatTime(new Date())} />
          <Divider />
          <StatusItem label="Uptime" valueRef={uptimeRef} initial={formatUptime(d.uptime)} />
          <Divider />
          <StatusItem label="Active Policies" value={String(d.activePolicies)} />
          <Divider />
          <StatusItem label="WS Connections" value={String(d.wsConnCount)} />
          <Divider />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="caption" sx={{ color: '#64748B' }}>Alerts</Typography>
            <Chip
              label={alertCount}
              size="small"
              sx={{
                height: 20,
                fontSize: 11,
                fontWeight: 700,
                bgcolor: alertCount === 0 ? 'rgba(34,197,94,0.15)' : alertCount <= 2 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)',
                color: alertCount === 0 ? COLORS.green : alertCount <= 2 ? COLORS.amber : COLORS.red,
              }}
            />
          </Box>
        </Box>

        {/* Main Grid */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
            gap: 2,
            mb: 2,
          }}
        >
          <MetricPanel
            title="HTTP Request Rate"
            value={d.httpRate[d.httpRate.length - 1]}
            unit="req/s"
            prevValue={d.httpRate[d.httpRate.length - 2]}
            threshold={thresholds.httpRate}
            chartRef={(el) => { chartRefs.current[0] = el }}
          />
          <MetricPanel
            title="HTTP Latency P99"
            value={d.latP99[d.latP99.length - 1]}
            unit="ms"
            prevValue={d.latP99[d.latP99.length - 2]}
            threshold={thresholds.latencyP99}
            chartRef={(el) => { chartRefs.current[1] = el }}
          />
          <MetricPanel
            title="Policy Executions"
            value={d.policy.success.reduce((a, b) => a + b, 0) + d.policy.failed.reduce((a, b) => a + b, 0)}
            unit="today"
            threshold="ok"
            chartRef={(el) => { chartRefs.current[2] = el }}
          />
          <MetricPanel
            title="K8s API Calls"
            value={Math.round(d.k8sGet[d.k8sGet.length - 1] + d.k8sPatch[d.k8sPatch.length - 1] + d.k8sDelete[d.k8sDelete.length - 1])}
            unit="/min"
            threshold={thresholds.k8sApi}
            chartRef={(el) => { chartRefs.current[3] = el }}
          />
          <MetricPanel
            title="WebSocket Connections"
            value={Math.round(d.wsConns[d.wsConns.length - 1])}
            unit="active"
            threshold="ok"
            chartRef={(el) => { chartRefs.current[4] = el }}
          />
          <MetricPanel
            title="Cache Hit Rate"
            value={d.cacheHit}
            unit="%"
            threshold={thresholds.cacheHit}
            chartRef={(el) => { chartRefs.current[5] = el }}
            chartHeight={220}
          />
          <MetricPanel
            title="Pod Scale Operations"
            value={Math.round(d.scatter.duration.reduce((a, b) => a + b, 0) / d.scatter.duration.length)}
            unit="ms avg"
            threshold="ok"
            chartRef={(el) => { chartRefs.current[6] = el }}
          />
          <MetricPanel
            title="Error Rate"
            value={d.errorRate[d.errorRate.length - 1]}
            unit="/min"
            threshold={thresholds.errorRate}
            chartRef={(el) => { chartRefs.current[7] = el }}
            errorBadge={countRecentErrors(d.errorRate)}
          />
        </Box>

        {/* Incident Event Feed */}
        <Box
          sx={{
            borderRadius: 1.5,
            bgcolor: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            px: 2,
            py: 1,
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            overflow: 'hidden',
          }}
        >
          <Typography variant="caption" sx={{ color: '#64748B', flexShrink: 0, fontWeight: 600 }}>
            EVENTS
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, overflow: 'hidden', flex: 1 }}>
            <AnimatePresence mode="popLayout">
              {events.map((ev) => (
                <motion.div
                  key={ev.id}
                  initial={{ opacity: 0, x: 80 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                >
                  <Chip
                    size="small"
                    icon={ev.severity === 'crit' ? <ErrorOutlineIcon sx={{ fontSize: 14 }} /> : <WarningAmberIcon sx={{ fontSize: 14 }} />}
                    label={`${ev.message} — ${formatTime(ev.timestamp)}`}
                    sx={{
                      height: 26,
                      fontSize: 11,
                      bgcolor: ev.severity === 'crit' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.12)',
                      color: ev.severity === 'crit' ? COLORS.red : COLORS.amber,
                      border: '1px solid',
                      borderColor: ev.severity === 'crit' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.2)',
                      whiteSpace: 'nowrap',
                      '& .MuiChip-icon': { color: 'inherit' },
                    }}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
            {events.length === 0 && (
              <Typography variant="caption" sx={{ color: '#475569' }}>
                No active incidents
              </Typography>
            )}
          </Box>
        </Box>
      </Box>

      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes borderPulse {
          0%, 100% { border-color: rgba(239,68,68,0.5); }
          50% { border-color: rgba(239,68,68,0.15); }
        }
      `}</style>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Divider() {
  return <Box sx={{ width: 1, height: 16, bgcolor: 'rgba(255,255,255,0.08)' }} />
}

function StatusItem({ label, value, valueRef, initial }: { label: string; value?: string; valueRef?: React.RefObject<HTMLSpanElement | null>; initial?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Typography variant="caption" sx={{ color: '#64748B' }}>{label}</Typography>
      <Typography variant="caption" sx={{ fontWeight: 600, color: '#CBD5E1', fontFamily: 'monospace' }}>
        {valueRef ? <span ref={valueRef}>{initial}</span> : value}
      </Typography>
    </Box>
  )
}

interface MetricPanelProps {
  title: string
  value: number
  unit: string
  prevValue?: number
  threshold: 'ok' | 'warn' | 'crit'
  chartRef: (el: HTMLDivElement | null) => void
  chartHeight?: number
  errorBadge?: number
}

function MetricPanel({ title, value, unit, prevValue, threshold, chartRef, chartHeight = 180, errorBadge }: MetricPanelProps) {
  const delta = prevValue ? ((value - prevValue) / prevValue) * 100 : undefined
  const deltaStr = delta !== undefined ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%` : undefined
  const deltaColor = delta !== undefined ? (delta > 0 ? COLORS.amber : COLORS.green) : undefined

  const borderColor =
    threshold === 'crit' ? 'rgba(239,68,68,0.5)' :
    threshold === 'warn' ? 'rgba(245,158,11,0.4)' :
    'rgba(255,255,255,0.06)'

  return (
    <Card
      sx={{
        bgcolor: 'rgba(255,255,255,0.03)',
        border: '1px solid',
        borderColor,
        borderRadius: 2,
        p: 2,
        minHeight: 280,
        display: 'flex',
        flexDirection: 'column',
        animation: threshold === 'crit' ? 'borderPulse 1.5s infinite' : 'none',
        transition: 'border-color 0.3s ease',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
        <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 11 }}>
          {title}
        </Typography>
        {threshold !== 'ok' && (
          <Chip
            size="small"
            label={threshold.toUpperCase()}
            sx={{
              height: 18,
              fontSize: 10,
              fontWeight: 700,
              bgcolor: threshold === 'crit' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.15)',
              color: threshold === 'crit' ? COLORS.red : COLORS.amber,
            }}
          />
        )}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, fontFamily: 'monospace', lineHeight: 1 }}>
          {typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(1)) : value}
        </Typography>
        <Typography variant="caption" sx={{ color: '#64748B' }}>{unit}</Typography>
        {deltaStr && (
          <Typography variant="caption" sx={{ fontWeight: 600, color: deltaColor, fontFamily: 'monospace' }}>
            {deltaStr}
          </Typography>
        )}
        {errorBadge !== undefined && (
          <Chip
            size="small"
            label={errorBadge === 0 ? '0 errors in 5m' : `${errorBadge} errors in 5m`}
            sx={{
              height: 18,
              fontSize: 10,
              fontWeight: 600,
              bgcolor: errorBadge > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.12)',
              color: errorBadge > 0 ? COLORS.red : COLORS.green,
              ml: 'auto',
            }}
          />
        )}
      </Box>
      <Box ref={chartRef} sx={{ flex: 1, minHeight: chartHeight }} />
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${d}d ${h}h ${m}m`
}

function countRecentErrors(errorRate: number[]): number {
  const last5min = errorRate.slice(-5)
  return Math.round(last5min.reduce((a, b) => a + b, 0))
}

// ---------------------------------------------------------------------------
// eCharts option builders
// ---------------------------------------------------------------------------

function buildLineOption(labels: string[], data: number[], color: string, warn: number, crit: number, yUnit: string): echarts.EChartsOption {
  return {
    grid: { left: 40, right: 12, top: 16, bottom: 24 },
    xAxis: { type: 'category', data: labels, axisLabel: { show: false } },
    yAxis: { type: 'value', axisLabel: { fontSize: 10 }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } } },
    tooltip: { trigger: 'axis', formatter: (params: unknown) => { const p = (params as { value: number }[])[0]; return `${p.value} ${yUnit}` } },
    series: [
      {
        type: 'line',
        data: [...data],
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: color + '30' }, { offset: 1, color: 'transparent' }] } },
      },
      {
        type: 'line',
        data: Array(data.length).fill(warn),
        symbol: 'none',
        lineStyle: { width: 1, color: COLORS.amber, type: 'dashed' },
        silent: true,
      },
      {
        type: 'line',
        data: Array(data.length).fill(crit),
        symbol: 'none',
        lineStyle: { width: 1, color: COLORS.red, type: 'dashed' },
        silent: true,
      },
    ],
    animation: false,
  }
}

function buildLatencyOption(labels: string[], p50: number[], p95: number[], p99: number[]): echarts.EChartsOption {
  return {
    grid: { left: 40, right: 12, top: 16, bottom: 24 },
    xAxis: { type: 'category', data: labels, axisLabel: { show: false } },
    yAxis: { type: 'value', axisLabel: { fontSize: 10, formatter: '{value}ms' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } } },
    legend: { show: true, right: 0, top: 0, textStyle: { fontSize: 10, color: '#64748B' }, itemWidth: 12, itemHeight: 2 },
    tooltip: { trigger: 'axis' },
    series: [
      {
        name: 'P50',
        type: 'line',
        data: [...p50],
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 1, color: COLORS.green, opacity: 0.4 },
      },
      {
        name: 'P95',
        type: 'line',
        data: [...p95],
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 1, color: COLORS.amber, opacity: 0.5 },
      },
      {
        name: 'P99',
        type: 'line',
        data: [...p99],
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 3, color: COLORS.red },
      },
      {
        type: 'line',
        data: Array(p99.length).fill(500),
        symbol: 'none',
        lineStyle: { width: 1, color: COLORS.amber, type: 'dashed' },
        silent: true,
      },
      {
        type: 'line',
        data: Array(p99.length).fill(1000),
        symbol: 'none',
        lineStyle: { width: 1, color: COLORS.red, type: 'dashed' },
        silent: true,
      },
    ],
    animation: false,
  }
}

function buildPolicyOption(policy: { success: number[]; failed: number[]; skipped: number[]; hours: string[] }): echarts.EChartsOption {
  return {
    grid: { left: 32, right: 12, top: 16, bottom: 24 },
    xAxis: { type: 'category', data: policy.hours, axisLabel: { fontSize: 9, interval: 3 } },
    yAxis: { type: 'value', axisLabel: { fontSize: 10 }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } } },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { show: true, right: 0, top: 0, textStyle: { fontSize: 10, color: '#64748B' }, itemWidth: 10, itemHeight: 10 },
    series: [
      {
        name: 'Success',
        type: 'bar',
        stack: 'total',
        data: [...policy.success],
        itemStyle: { color: COLORS.green, borderRadius: [0, 0, 0, 0] },
        barWidth: '60%',
      },
      {
        name: 'Failed',
        type: 'bar',
        stack: 'total',
        data: [...policy.failed],
        itemStyle: { color: COLORS.red },
      },
      {
        name: 'Skipped',
        type: 'bar',
        stack: 'total',
        data: [...policy.skipped],
        itemStyle: { color: COLORS.grey },
      },
    ],
    animation: false,
  }
}

function buildK8sOption(labels: string[], get: number[], patch: number[], del: number[]): echarts.EChartsOption {
  return {
    grid: { left: 40, right: 12, top: 16, bottom: 24 },
    xAxis: { type: 'category', data: labels, axisLabel: { show: false } },
    yAxis: { type: 'value', axisLabel: { fontSize: 10 }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } } },
    legend: { show: true, right: 0, top: 0, textStyle: { fontSize: 10, color: '#64748B' }, itemWidth: 12, itemHeight: 2 },
    tooltip: { trigger: 'axis' },
    series: [
      {
        name: 'GET',
        type: 'line',
        data: [...get],
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: COLORS.blue },
      },
      {
        name: 'PATCH',
        type: 'line',
        data: [...patch],
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: COLORS.amber },
      },
      {
        name: 'DELETE',
        type: 'line',
        data: [...del],
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: COLORS.red },
      },
      {
        type: 'line',
        data: Array(get.length).fill(100),
        symbol: 'none',
        lineStyle: { width: 1, color: COLORS.amber, type: 'dashed' },
        silent: true,
      },
    ],
    animation: false,
  }
}

function buildAreaOption(labels: string[], data: number[], color: string): echarts.EChartsOption {
  return {
    grid: { left: 32, right: 12, top: 16, bottom: 24 },
    xAxis: { type: 'category', data: labels, axisLabel: { show: false } },
    yAxis: { type: 'value', axisLabel: { fontSize: 10 }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } } },
    tooltip: { trigger: 'axis' },
    series: [
      {
        type: 'line',
        data: [...data],
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: color + '40' },
              { offset: 0.5, color: color + '15' },
              { offset: 1, color: 'transparent' },
            ],
          },
        },
      },
    ],
    animation: false,
  }
}

function buildGaugeOption(value: number): echarts.EChartsOption {
  return {
    series: [
      {
        type: 'gauge',
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        radius: '90%',
        center: ['50%', '55%'],
        pointer: {
          length: '60%',
          width: 4,
          itemStyle: { color: '#CBD5E1' },
        },
        axisLine: {
          lineStyle: {
            width: 14,
            color: [
              [0.7, COLORS.red],
              [0.9, COLORS.amber],
              [1, COLORS.green],
            ],
          },
        },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        detail: {
          valueAnimation: true,
          formatter: '{value}%',
          fontSize: 20,
          fontWeight: 700,
          fontFamily: 'monospace',
          color: '#E2E8F0',
          offsetCenter: [0, '30%'],
        },
        data: [{ value: Math.round(value * 10) / 10 }],
        animationDuration: 400,
      },
    ],
  }
}

function buildScatterOption(scatter: { time: number[]; duration: number[]; success: boolean[]; replicas: number[] }): echarts.EChartsOption {
  const successData: [number, number, number][] = []
  const failedData: [number, number, number][] = []

  for (let i = 0; i < scatter.time.length; i++) {
    const point: [number, number, number] = [scatter.time[i], scatter.duration[i], scatter.replicas[i]]
    if (scatter.success[i]) {
      successData.push(point)
    } else {
      failedData.push(point)
    }
  }

  return {
    grid: { left: 40, right: 12, top: 16, bottom: 24 },
    xAxis: {
      type: 'time',
      axisLabel: { show: false },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      name: 'ms',
      nameTextStyle: { fontSize: 10, color: '#64748B' },
      axisLabel: { fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
    },
    tooltip: {
      trigger: 'item',
      formatter: (params: unknown) => {
        const p = params as { value: [number, number, number] }
        return `Duration: ${Math.round(p.value[1])}ms<br/>Replicas: ${p.value[2]}`
      },
    },
    series: [
      {
        type: 'scatter',
        data: successData,
        symbolSize: (val: [number, number, number]) => Math.max(6, val[2] * 3),
        itemStyle: { color: COLORS.green, opacity: 0.7 },
      },
      {
        type: 'scatter',
        data: failedData,
        symbolSize: (val: [number, number, number]) => Math.max(6, val[2] * 3),
        itemStyle: { color: COLORS.red, opacity: 0.8 },
      },
    ],
    animation: false,
  }
}

function buildErrorOption(labels: string[], data: number[]): echarts.EChartsOption {
  return {
    grid: { left: 32, right: 12, top: 16, bottom: 24 },
    xAxis: { type: 'category', data: labels, axisLabel: { show: false } },
    yAxis: { type: 'value', axisLabel: { fontSize: 10 }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } } },
    tooltip: { trigger: 'axis' },
    series: [
      {
        type: 'line',
        data: [...data],
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: COLORS.red },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(239,68,68,0.4)' },
              { offset: 0.5, color: 'rgba(239,68,68,0.1)' },
              { offset: 1, color: 'transparent' },
            ],
          },
        },
      },
      {
        type: 'line',
        data: Array(data.length).fill(5),
        symbol: 'none',
        lineStyle: { width: 1, color: COLORS.amber, type: 'dashed' },
        silent: true,
      },
      {
        type: 'line',
        data: Array(data.length).fill(15),
        symbol: 'none',
        lineStyle: { width: 1, color: COLORS.red, type: 'dashed' },
        silent: true,
      },
    ],
    animation: false,
  }
}
