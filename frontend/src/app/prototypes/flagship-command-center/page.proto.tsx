'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import LinearProgress from '@mui/material/LinearProgress'
import Tooltip from '@mui/material/Tooltip'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import * as echarts from 'echarts'
import { darkTheme } from '@/lib/motion/echartsTheme'
import gsap from 'gsap'

echarts.registerTheme('kube-phoenix-dark', darkTheme)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PolicyStatus = 'awake' | 'sleeping' | 'transitioning'
type ExecutionDirection = 'sleep' | 'wake'
type ExecutionStatus = 'success' | 'failed' | 'running'

interface Policy {
  name: string
  status: PolicyStatus
  namespaces: string[]
  scheduleDesc: string
  sleepHours: [number, number]
  sleepDays: number[]
  executions: number
  savings: number
  avgDuration: string
  countdownSeconds: number
  countdownLabel: string
  sparklineData: number[]
}

interface Execution {
  id: string
  timestamp: Date
  policyName: string
  direction: ExecutionDirection
  status: ExecutionStatus
  duration: string
  workloadsScaled: number
  nodesDrained: number
  progress?: number
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<PolicyStatus, string> = {
  awake: '#22C55E',
  sleeping: '#7C3AED',
  transitioning: '#F59E0B',
}

const STATUS_LABELS: Record<PolicyStatus, string> = {
  awake: 'AWAKE',
  sleeping: 'SLEEPING',
  transitioning: 'TRANSITIONING',
}

// ---------------------------------------------------------------------------
// Mock data generators
// ---------------------------------------------------------------------------

function generateSparkline(): number[] {
  return Array.from({ length: 50 }, () => {
    const rand = Math.random()
    if (rand < 0.82) return 1
    if (rand < 0.92) return 0
    return -1
  })
}

function createPolicies(): Policy[] {
  return [
    {
      name: 'production-sleep',
      status: 'awake',
      namespaces: ['production'],
      scheduleDesc: 'Sleep 22:00-06:00 weekdays',
      sleepHours: [22, 6],
      sleepDays: [1, 2, 3, 4, 5],
      executions: 142,
      savings: 12847,
      avgDuration: '2m 34s',
      countdownSeconds: 4 * 3600 + 23 * 60,
      countdownLabel: 'Sleeping in',
      sparklineData: generateSparkline(),
    },
    {
      name: 'staging-always-sleep',
      status: 'sleeping',
      namespaces: ['staging'],
      scheduleDesc: 'Sleep 19:00-08:00 every day',
      sleepHours: [19, 8],
      sleepDays: [0, 1, 2, 3, 4, 5, 6],
      executions: 210,
      savings: 8234,
      avgDuration: '1m 48s',
      countdownSeconds: 2 * 3600 + 15 * 60,
      countdownLabel: 'Waking in',
      sparklineData: generateSparkline(),
    },
    {
      name: 'dev-weekend-sleep',
      status: 'awake',
      namespaces: ['dev'],
      scheduleDesc: 'Sleep 20:00-07:00 weekdays',
      sleepHours: [20, 7],
      sleepDays: [1, 2, 3, 4, 5],
      executions: 98,
      savings: 5621,
      avgDuration: '3m 12s',
      countdownSeconds: 6 * 3600 + 41 * 60,
      countdownLabel: 'Sleeping in',
      sparklineData: generateSparkline(),
    },
  ]
}

function createExecutions(): Execution[] {
  const now = new Date()
  return [
    { id: 'ex-1', timestamp: new Date(now.getTime() - 3 * 60000), policyName: 'staging-always-sleep', direction: 'sleep', status: 'running', duration: '1m 12s', workloadsScaled: 6, nodesDrained: 2, progress: 65 },
    { id: 'ex-2', timestamp: new Date(now.getTime() - 28 * 60000), policyName: 'production-sleep', direction: 'wake', status: 'success', duration: '2m 34s', workloadsScaled: 14, nodesDrained: 3 },
    { id: 'ex-3', timestamp: new Date(now.getTime() - 2 * 3600000), policyName: 'dev-weekend-sleep', direction: 'wake', status: 'success', duration: '3m 01s', workloadsScaled: 4, nodesDrained: 1 },
    { id: 'ex-4', timestamp: new Date(now.getTime() - 5 * 3600000), policyName: 'staging-always-sleep', direction: 'wake', status: 'success', duration: '1m 55s', workloadsScaled: 6, nodesDrained: 2 },
    { id: 'ex-5', timestamp: new Date(now.getTime() - 8 * 3600000), policyName: 'production-sleep', direction: 'sleep', status: 'success', duration: '2m 12s', workloadsScaled: 14, nodesDrained: 3 },
    { id: 'ex-6', timestamp: new Date(now.getTime() - 11 * 3600000), policyName: 'dev-weekend-sleep', direction: 'sleep', status: 'failed', duration: '4m 38s', workloadsScaled: 2, nodesDrained: 0 },
    { id: 'ex-7', timestamp: new Date(now.getTime() - 14 * 3600000), policyName: 'staging-always-sleep', direction: 'sleep', status: 'success', duration: '1m 44s', workloadsScaled: 6, nodesDrained: 2 },
    { id: 'ex-8', timestamp: new Date(now.getTime() - 20 * 3600000), policyName: 'production-sleep', direction: 'wake', status: 'success', duration: '2m 48s', workloadsScaled: 14, nodesDrained: 3 },
  ]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCountdown(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  return `${hours}h ${String(minutes).padStart(2, '0')}m`
}

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function isHourSleeping(policy: Policy, day: number, hour: number): boolean {
  if (!policy.sleepDays.includes(day)) return false
  const [start, end] = policy.sleepHours
  if (start > end) return hour >= start || hour < end
  return hour >= start && hour < end
}

let nextExecId = 100

// ---------------------------------------------------------------------------
// Sparkline Canvas Component
// ---------------------------------------------------------------------------

function SparklineCanvas({ data }: { data: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = 200
    const h = 24
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, h)

    const spacing = w / data.length
    const mid = h / 2

    ctx.strokeStyle = 'rgba(255,255,255,0.1)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, mid)
    ctx.lineTo(w, mid)
    ctx.stroke()

    data.forEach((val, i) => {
      const x = i * spacing + spacing / 2
      const radius = 2
      ctx.beginPath()
      ctx.arc(x, mid, radius, 0, Math.PI * 2)
      if (val === 1) ctx.fillStyle = '#22C55E'
      else if (val === 0) ctx.fillStyle = '#EF4444'
      else ctx.fillStyle = '#64748B'
      ctx.fill()
    })
  }, [data])

  return <canvas ref={canvasRef} style={{ display: 'block', width: 200, height: 24 }} />
}

// ---------------------------------------------------------------------------
// Countdown Ring Component
// ---------------------------------------------------------------------------

function CountdownRing({ progress, color }: { progress: number; color: string }) {
  const svgRef = useRef<SVGCircleElement>(null)
  const initializedRef = useRef(false)
  const size = 56
  const strokeWidth = 4
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  useEffect(() => {
    if (!svgRef.current || initializedRef.current) return
    initializedRef.current = true
    gsap.fromTo(
      svgRef.current,
      { strokeDashoffset: circumference },
      { strokeDashoffset: circumference * (1 - progress), duration: 1.2, ease: 'power2.out' }
    )
  }, [circumference, progress])

  useEffect(() => {
    if (!svgRef.current || !initializedRef.current) return
    svgRef.current.style.strokeDashoffset = String(circumference * (1 - progress))
  }, [progress, circumference])

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} />
      <circle
        ref={svgRef}
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={circumference}
        strokeLinecap="round"
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Policy Card Component
// ---------------------------------------------------------------------------

function PolicyCard({
  policy,
  countdown,
  onToggle,
}: {
  policy: Policy
  countdown: number
  onToggle: () => void
}) {
  const statusColor = STATUS_COLORS[policy.status]
  const isSleeping = policy.status === 'sleeping'
  const totalDuration = policy.countdownSeconds
  const elapsed = totalDuration - countdown
  const progress = totalDuration > 0 ? Math.min(elapsed / totalDuration, 1) : 0

  return (
    <Card
      component={motion.div}
      layout
      sx={{
        flex: '1 1 0',
        minWidth: 280,
        bgcolor: 'rgba(15,15,25,0.8)',
        border: '1px solid',
        borderColor: `${statusColor}33`,
        borderRadius: 2,
        transition: 'border-color 0.4s ease',
      }}
    >
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#E2E8F0', lineHeight: 1.3 }}>
              {policy.name}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
              {policy.namespaces.map((ns) => (
                <Chip key={ns} label={ns} size="small" sx={{ height: 20, fontSize: 11, bgcolor: 'rgba(124,58,237,0.15)', color: '#A78BFA' }} />
              ))}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              component={motion.div}
              animate={isSleeping ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
              transition={isSleeping ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : {}}
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: statusColor,
                boxShadow: `0 0 8px ${statusColor}, 0 0 16px ${statusColor}55`,
              }}
            />
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: statusColor, letterSpacing: 1 }}>
              {STATUS_LABELS[policy.status]}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <CountdownRing progress={progress} color={statusColor} />
          <Box>
            <Typography sx={{ fontSize: 11, color: '#64748B' }}>{policy.countdownLabel}</Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#E2E8F0', fontFamily: 'monospace' }}>
              {formatCountdown(countdown)}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <StatMini label="Executions" value={String(policy.executions)} />
          <StatMini label="Savings" value={`$${policy.savings.toLocaleString()}`} />
          <StatMini label="Avg Duration" value={policy.avgDuration} />
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: 10, color: '#64748B', mb: 0.5 }}>Last 30 days</Typography>
          <SparklineCanvas data={policy.sparklineData} />
        </Box>

        <Button
          size="small"
          variant="outlined"
          onClick={onToggle}
          sx={{
            fontSize: 12,
            textTransform: 'none',
            borderColor: statusColor,
            color: statusColor,
            '&:hover': { borderColor: statusColor, bgcolor: `${statusColor}15` },
          }}
        >
          {isSleeping ? 'Wake Now' : 'Sleep Now'}
        </Button>
      </CardContent>
    </Card>
  )
}

function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 10, color: '#64748B', lineHeight: 1 }}>{label}</Typography>
      <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#CBD5E1', lineHeight: 1.4 }}>{value}</Typography>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Heatmap Component
// ---------------------------------------------------------------------------

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

function ScheduleHeatmap({ policies }: { policies: Policy[] }) {
  const [hoveredCell, setHoveredCell] = useState<{ day: number; hour: number } | null>(null)
  const [currentHour] = useState(() => new Date().getHours())
  const currentDay = new Date().getDay()
  const mondayBasedDay = currentDay === 0 ? 6 : currentDay - 1

  function getSleepCount(dayIndex: number, hour: number): number {
    const jsDay = dayIndex === 6 ? 0 : dayIndex + 1
    return policies.filter((p) => isHourSleeping(p, jsDay, hour)).length
  }

  function getSleepingPolicies(dayIndex: number, hour: number): string[] {
    const jsDay = dayIndex === 6 ? 0 : dayIndex + 1
    return policies.filter((p) => isHourSleeping(p, jsDay, hour)).map((p) => p.name)
  }

  function getCellColor(count: number): string {
    if (count === 0) return 'rgba(255,255,255,0.02)'
    if (count === 1) return 'rgba(124,58,237,0.25)'
    if (count === 2) return 'rgba(124,58,237,0.5)'
    return 'rgba(249,115,22,0.6)'
  }

  return (
    <Card sx={{ bgcolor: 'rgba(15,15,25,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2 }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Typography variant="subtitle2" sx={{ color: '#E2E8F0', fontWeight: 600, mb: 2 }}>
          Weekly Sleep Schedule
        </Typography>
        <Box sx={{ position: 'relative' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '40px repeat(24, 1fr)', gap: '2px' }}>
            <Box />
            {HOURS.map((h) => (
              <Typography key={h} sx={{ fontSize: 9, color: '#475569', textAlign: 'center' }}>
                {String(h).padStart(2, '0')}
              </Typography>
            ))}
            {DAYS.map((day, dayIdx) => (
              <Box key={day} sx={{ display: 'contents' }}>
                <Typography sx={{ fontSize: 11, color: '#64748B', lineHeight: '20px', pr: 1 }}>{day}</Typography>
                {HOURS.map((hour) => {
                  const count = getSleepCount(dayIdx, hour)
                  const isNow = dayIdx === mondayBasedDay && hour === currentHour
                  const sleeping = getSleepingPolicies(dayIdx, hour)
                  return (
                    <Tooltip
                      key={hour}
                      title={
                        sleeping.length > 0
                          ? `${day} ${String(hour).padStart(2, '0')}:00 - ${sleeping.join(', ')}`
                          : `${day} ${String(hour).padStart(2, '0')}:00 - No policies sleeping`
                      }
                      arrow
                      placement="top"
                    >
                      <Box
                        onMouseEnter={() => setHoveredCell({ day: dayIdx, hour })}
                        onMouseLeave={() => setHoveredCell(null)}
                        sx={{
                          height: 20,
                          borderRadius: '2px',
                          bgcolor: getCellColor(count),
                          border: isNow ? '1.5px solid #22D3EE' : '1px solid rgba(255,255,255,0.03)',
                          boxShadow: isNow ? '0 0 8px rgba(34,211,238,0.4)' : 'none',
                          transition: 'background-color 0.15s ease',
                          cursor: 'pointer',
                          '&:hover': { bgcolor: getCellColor(count).replace(/[\d.]+\)$/, '0.8)') },
                        }}
                      />
                    </Tooltip>
                  )
                })}
              </Box>
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 2, mt: 1.5, justifyContent: 'flex-end' }}>
            {[
              { label: '0 sleeping', color: 'rgba(255,255,255,0.02)' },
              { label: '1 sleeping', color: 'rgba(124,58,237,0.25)' },
              { label: '2 sleeping', color: 'rgba(124,58,237,0.5)' },
              { label: '3 sleeping', color: 'rgba(249,115,22,0.6)' },
            ].map((item) => (
              <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: item.color, border: '1px solid rgba(255,255,255,0.06)' }} />
                <Typography sx={{ fontSize: 10, color: '#64748B' }}>{item.label}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Execution Feed Component
// ---------------------------------------------------------------------------

function ExecutionFeed({
  executions,
  onSimulate,
}: {
  executions: Execution[]
  onSimulate: () => void
}) {
  return (
    <Card sx={{ flex: '3 1 0', minWidth: 400, bgcolor: 'rgba(15,15,25,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2 }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle2" sx={{ color: '#E2E8F0', fontWeight: 600 }}>
            Live Execution Feed
          </Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={onSimulate}
            sx={{ fontSize: 11, textTransform: 'none', borderColor: '#3B82F6', color: '#3B82F6' }}
          >
            Simulate Execution
          </Button>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <AnimatePresence initial={false}>
            {executions.map((exec) => (
              <ExecutionRow key={exec.id} exec={exec} />
            ))}
          </AnimatePresence>
        </Box>
      </CardContent>
    </Card>
  )
}

function ExecutionRow({ exec }: { exec: Execution }) {
  const directionColor = exec.direction === 'sleep' ? '#7C3AED' : '#22C55E'
  const directionIcon = exec.direction === 'sleep' ? '\u2193' : '\u2191'
  const statusColor =
    exec.status === 'success' ? '#22C55E' : exec.status === 'failed' ? '#EF4444' : '#F59E0B'

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: -20, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        py: 1,
        px: 1.5,
        borderRadius: 1,
        bgcolor: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <Typography sx={{ fontSize: 11, color: '#64748B', fontFamily: 'monospace', minWidth: 40 }}>
        {formatTimestamp(exec.timestamp)}
      </Typography>
      <Typography sx={{ fontSize: 12, color: '#CBD5E1', minWidth: 140, fontWeight: 500 }}>
        {exec.policyName}
      </Typography>
      <Typography sx={{ fontSize: 14, color: directionColor, fontWeight: 700, minWidth: 20 }}>
        {directionIcon}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 70 }}>
        <Box
          component={exec.status === 'running' ? motion.div : 'div'}
          {...(exec.status === 'running' ? { animate: { opacity: [1, 0.4, 1] }, transition: { duration: 1.5, repeat: Infinity } } : {})}
          sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: statusColor }}
        />
        <Typography sx={{ fontSize: 11, color: statusColor, fontWeight: 500 }}>
          {exec.status}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: 11, color: '#64748B', minWidth: 50 }}>{exec.duration}</Typography>
      <Typography sx={{ fontSize: 10, color: '#475569' }}>
        {exec.workloadsScaled}w / {exec.nodesDrained}n
      </Typography>
      {exec.status === 'running' && exec.progress != null && (
        <Box sx={{ flex: 1, ml: 1 }}>
          <LinearProgress
            variant="determinate"
            value={exec.progress}
            sx={{
              height: 3,
              borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.06)',
              '& .MuiLinearProgress-bar': { bgcolor: '#F59E0B', borderRadius: 2 },
            }}
          />
        </Box>
      )}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Gauge Charts Component
// ---------------------------------------------------------------------------

function ClusterGauges() {
  const gaugeRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)]
  const chartsRef = useRef<echarts.ECharts[]>([])

  const gauges = [
    { title: 'Sleep Coverage', value: 42, color: '#7C3AED' },
    { title: 'Policy Health', value: 96, color: '#22C55E' },
    { title: 'Savings Efficiency', value: 78, color: '#3B82F6' },
  ]

  useEffect(() => {
    const charts: echarts.ECharts[] = []
    const observers: ResizeObserver[] = []

    gaugeRefs.forEach((ref, idx) => {
      if (!ref.current) return
      const chart = echarts.init(ref.current, 'kube-phoenix-dark')
      charts.push(chart)

      const gauge = gauges[idx]
      chart.setOption({
        series: [
          {
            type: 'gauge',
            startAngle: 220,
            endAngle: -40,
            radius: '90%',
            center: ['50%', '55%'],
            min: 0,
            max: 100,
            splitNumber: 10,
            axisLine: {
              lineStyle: {
                width: 8,
                color: [
                  [gauge.value / 100, gauge.color],
                  [1, 'rgba(255,255,255,0.08)'],
                ],
              },
            },
            axisTick: { show: false },
            splitLine: { show: false },
            axisLabel: { show: false },
            pointer: {
              length: '55%',
              width: 3,
              itemStyle: { color: gauge.color },
            },
            anchor: {
              show: true,
              size: 6,
              itemStyle: { borderWidth: 2, borderColor: gauge.color, color: '#0F0F19' },
            },
            detail: {
              valueAnimation: true,
              formatter: '{value}%',
              fontSize: 22,
              fontWeight: 700,
              color: '#E2E8F0',
              offsetCenter: [0, '70%'],
            },
            title: {
              offsetCenter: [0, '92%'],
              fontSize: 11,
              color: '#64748B',
            },
            data: [{ value: gauge.value, name: gauge.title }],
            animationDuration: 1500,
            animationEasing: 'cubicOut',
          },
        ],
      })

      const observer = new ResizeObserver(() => chart.resize())
      observer.observe(ref.current)
      observers.push(observer)
    })

    chartsRef.current = charts

    return () => {
      charts.forEach((c) => c.dispose())
      observers.forEach((o) => o.disconnect())
    }
  }, [])

  return (
    <Card sx={{ flex: '2 1 0', minWidth: 280, bgcolor: 'rgba(15,15,25,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2 }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Typography variant="subtitle2" sx={{ color: '#E2E8F0', fontWeight: 600, mb: 1 }}>
          Cluster Overview
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {gauges.map((g, i) => (
            <Box key={g.title} ref={gaugeRefs[i]} sx={{ width: '100%', height: 150 }} />
          ))}
        </Box>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function FlagshipCommandCenter() {
  const router = useRouter()
  const [policies, setPolicies] = useState<Policy[]>(createPolicies)
  const [countdowns, setCountdowns] = useState<number[]>(() => createPolicies().map((p) => p.countdownSeconds))
  const [executions, setExecutions] = useState<Execution[]>(createExecutions)

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdowns((prev) => prev.map((s) => (s > 0 ? s - 1 : 0)))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const handleToggle = useCallback((index: number) => {
    setPolicies((prev) => {
      const updated = [...prev]
      const policy = { ...updated[index] }
      const wasAwake = policy.status === 'awake'
      policy.status = 'transitioning'
      updated[index] = policy

      setTimeout(() => {
        setPolicies((current) => {
          const next = [...current]
          next[index] = {
            ...next[index],
            status: wasAwake ? 'sleeping' : 'awake',
            countdownLabel: wasAwake ? 'Waking in' : 'Sleeping in',
          }
          return next
        })
        setCountdowns((current) => {
          const next = [...current]
          next[index] = wasAwake ? 2 * 3600 : 4 * 3600
          return next
        })
      }, 1500)

      return updated
    })
  }, [])

  const handleSimulate = useCallback(() => {
    const policyNames = ['production-sleep', 'staging-always-sleep', 'dev-weekend-sleep']
    const directions: ExecutionDirection[] = ['sleep', 'wake']
    const chosenPolicy = policyNames[Math.floor(Math.random() * policyNames.length)]
    const chosenDirection = directions[Math.floor(Math.random() * 2)]
    const newId = `ex-sim-${nextExecId++}`

    const newExec: Execution = {
      id: newId,
      timestamp: new Date(),
      policyName: chosenPolicy,
      direction: chosenDirection,
      status: 'running',
      duration: '0s',
      workloadsScaled: Math.floor(Math.random() * 12) + 2,
      nodesDrained: Math.floor(Math.random() * 3) + 1,
      progress: 0,
    }

    setExecutions((prev) => [newExec, ...prev.slice(0, 9)])

    const progressInterval = setInterval(() => {
      setExecutions((prev) => {
        const idx = prev.findIndex((e) => e.id === newId)
        if (idx === -1) { clearInterval(progressInterval); return prev }
        const updated = [...prev]
        const current = updated[idx]
        if (current.status !== 'running') { clearInterval(progressInterval); return prev }
        const newProgress = Math.min((current.progress ?? 0) + 15, 100)
        updated[idx] = { ...current, progress: newProgress }
        return updated
      })
    }, 400)

    setTimeout(() => {
      clearInterval(progressInterval)
      setExecutions((prev) => {
        const idx = prev.findIndex((e) => e.id === newId)
        if (idx === -1) return prev
        const updated = [...prev]
        updated[idx] = { ...updated[idx], status: 'success', duration: '3m 02s', progress: undefined }
        return updated
      })
    }, 3000)
  }, [])

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small" sx={{ color: '#94A3B8' }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#E2E8F0', lineHeight: 1.2 }}>
            FL5 — Policy Command Center
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B' }}>
            Air traffic control for sleep policies — real-time state, countdowns, and execution history
          </Typography>
        </Box>
      </Box>

      {/* Section 1 — Policy Status Cards */}
      <Box sx={{ display: 'flex', gap: 3, mb: 3, flexWrap: 'wrap' }}>
        {policies.map((policy, idx) => (
          <PolicyCard
            key={policy.name}
            policy={policy}
            countdown={countdowns[idx]}
            onToggle={() => handleToggle(idx)}
          />
        ))}
      </Box>

      {/* Section 2 — Weekly Schedule Heatmap */}
      <Box sx={{ mb: 3 }}>
        <ScheduleHeatmap policies={policies} />
      </Box>

      {/* Section 3 + 4 — Feed + Gauges */}
      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        <ExecutionFeed executions={executions} onSimulate={handleSimulate} />
        <ClusterGauges />
      </Box>
    </Box>
  )
}
