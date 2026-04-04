'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useRouter } from 'next/navigation'
import * as echarts from 'echarts'
import { darkTheme } from '@/lib/motion/echartsTheme'
import gsap from 'gsap'

echarts.registerTheme('kube-phoenix-dark', darkTheme)

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const POLICIES = [
  {
    name: 'production-sleep',
    savings: 12847.5,
    executions: 142,
    schedule: '8h sleep/night weekdays',
    sleeping: false,
    nodesDrained: 3,
    workloadsScaled: 14,
  },
  {
    name: 'staging-always-sleep',
    savings: 8234.2,
    executions: 210,
    schedule: '13h/day all week',
    sleeping: true,
    sleepDuration: '4h 23m',
    nodesDrained: 2,
    workloadsScaled: 6,
    liveSavingsRate: 0.38,
  },
  {
    name: 'dev-weekend-sleep',
    savings: 5621.8,
    executions: 98,
    schedule: '11h/night weekdays',
    sleeping: false,
    nodesDrained: 1,
    workloadsScaled: 4,
  },
] as const

const TOTAL_SAVINGS = POLICIES.reduce((sum, p) => sum + p.savings, 0)
const ENGINEER_HOUR_COST = 50
const NODE_HOUR_COST = 24
const ENGINEER_HOURS = Math.round(TOTAL_SAVINGS / ENGINEER_HOUR_COST)
const NODE_HOURS = Math.round(TOTAL_SAVINGS / NODE_HOUR_COST)

function generateDailySavings(days: number) {
  const data: { date: string; production: number; staging: number; dev: number }[] = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dow = d.getDay()
    const isWeekend = dow === 0 || dow === 6
    const jitter = () => 0.8 + Math.random() * 0.4
    data.push({
      date: d.toISOString().slice(0, 10),
      production: isWeekend ? 1.5 * jitter() : (8 + 4 * Math.random()) * jitter(),
      staging: (6 + 2 * Math.random()) * jitter(),
      dev: isWeekend ? 0.5 * jitter() : (3 + 2 * Math.random()) * jitter(),
    })
  }
  return data
}

const DAILY_90 = generateDailySavings(90)
const DAILY_30 = DAILY_90.slice(-30)

const WATERFALL = {
  baseline: 4320,
  nodeDrain: -1840,
  workloadScale: -420,
  net: 4320 - 1840 - 420,
}

// ---------------------------------------------------------------------------
// Hero Savings Counter
// ---------------------------------------------------------------------------

function HeroCounter() {
  const containerRef = useRef<HTMLDivElement>(null)
  const valueRef = useRef({ current: 0 })
  const displayRef = useRef<HTMLSpanElement[]>([])
  const tickingRef = useRef(false)

  const formatDollars = useCallback((val: number) => {
    return val.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }, [])

  const updateDisplay = useCallback((val: number) => {
    const formatted = formatDollars(val)
    const chars = ('$' + formatted).split('')
    displayRef.current.forEach((span, i) => {
      if (span && chars[i] !== undefined) {
        span.textContent = chars[i]
      }
    })
  }, [formatDollars])

  useEffect(() => {
    const target = TOTAL_SAVINGS
    const formatted = '$' + formatDollars(target)
    const charCount = formatted.length

    if (!containerRef.current) return
    containerRef.current.innerHTML = ''
    displayRef.current = []

    for (let i = 0; i < charCount; i++) {
      const span = document.createElement('span')
      span.style.display = 'inline-block'
      span.style.minWidth = formatted[i] === ',' || formatted[i] === '.' ? '0.4em' : '0.65em'
      span.style.textAlign = 'center'
      span.textContent = formatted[i] === '$' ? '$' : formatted[i] === ',' ? ',' : formatted[i] === '.' ? '.' : '0'
      containerRef.current.appendChild(span)
      displayRef.current.push(span)
    }

    const proxy = { value: 0 }
    valueRef.current.current = 0

    gsap.to(proxy, {
      value: target,
      duration: 2.5,
      ease: 'power3.out',
      onUpdate: () => {
        valueRef.current.current = proxy.value
        updateDisplay(proxy.value)
      },
      onComplete: () => {
        tickingRef.current = true
      },
    })

    gsap.fromTo(
      displayRef.current.filter((_, i) => {
        const ch = formatted[i]
        return ch !== '$' && ch !== ',' && ch !== '.'
      }),
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, stagger: 0.04, duration: 0.6, ease: 'power2.out' },
    )

    const interval = setInterval(() => {
      if (!tickingRef.current) return
      valueRef.current.current += 0.007
      updateDisplay(valueRef.current.current)
    }, 1000)

    return () => clearInterval(interval)
  }, [formatDollars, updateDisplay])

  return (
    <Box sx={{ textAlign: 'center', py: 4 }}>
      <Box
        ref={containerRef}
        sx={{
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          fontSize: { xs: '2.5rem', md: '4rem' },
          fontWeight: 700,
          color: '#FBBF24',
          textShadow: '0 0 40px rgba(251,191,36,0.3), 0 0 80px rgba(249,115,22,0.15)',
          letterSpacing: '0.02em',
          mb: 2,
        }}
      />
      <Box sx={{ display: 'flex', gap: 3, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Typography variant="body2" sx={{ color: '#94A3B8' }}>
          Equivalent to <Box component="span" sx={{ color: '#FBBF24', fontWeight: 600 }}>{ENGINEER_HOURS.toLocaleString()}</Box> engineer-hours
        </Typography>
        <Typography variant="body2" sx={{ color: '#94A3B8' }}>
          or <Box component="span" sx={{ color: '#F97316', fontWeight: 600 }}>{NODE_HOURS.toLocaleString()}</Box> t3.large node-hours
        </Typography>
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// eCharts hook
// ---------------------------------------------------------------------------

function useEChart(deps: unknown[] = []) {
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!ref.current) return
    const chart = echarts.init(ref.current, 'kube-phoenix-dark', { renderer: 'canvas' })
    chartRef.current = chart

    const ro = new ResizeObserver(() => chart.resize())
    ro.observe(ref.current)

    return () => {
      ro.disconnect()
      chart.dispose()
      chartRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { ref, chartRef }
}

// ---------------------------------------------------------------------------
// Savings Timeline
// ---------------------------------------------------------------------------

function SavingsTimeline() {
  const [range, setRange] = useState<'30' | '90'>('30')
  const data = range === '30' ? DAILY_30 : DAILY_90
  const { ref, chartRef } = useEChart([range])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    const dates = data.map(d => d.date)
    const projected = generateProjectedDates(14)
    const allDates = [...dates, ...projected.map(d => d.date)]

    const productionData = data.map(d => d.production)
    const stagingData = data.map(d => d.staging)
    const devData = data.map(d => d.dev)

    const avgDaily = data.reduce((s, d) => s + d.production + d.staging + d.dev, 0) / data.length
    const projectedValues = projected.map((_, i) => avgDaily * (0.95 + 0.1 * Math.random()))

    chart.setOption({
      animation: true,
      animationDuration: 2000,
      animationEasing: 'cubicOut',
      tooltip: {
        trigger: 'axis',
        formatter: (params: { seriesName: string; value: number; axisValue: string }[]) => {
          if (!params.length) return ''
          let html = `<b>${params[0].axisValue}</b><br/>`
          let total = 0
          params.forEach(p => {
            if (p.value !== undefined && p.value !== null) {
              html += `${p.seriesName}: $${p.value.toFixed(2)}<br/>`
              total += p.value
            }
          })
          html += `<b>Total: $${total.toFixed(2)}</b>`
          return html
        },
      },
      legend: { top: 0, right: 0 },
      grid: { left: 50, right: 16, top: 40, bottom: 32 },
      xAxis: { type: 'category', data: allDates, boundaryGap: false },
      yAxis: {
        type: 'value',
        axisLabel: { formatter: '${value}' },
      },
      series: [
        makeAreaSeries('production-sleep', productionData, '#F97316', '#F9731610', allDates.length),
        makeAreaSeries('staging-always-sleep', stagingData, '#FBBF24', '#FBBF2410', allDates.length),
        makeAreaSeries('dev-weekend-sleep', devData, '#7C3AED', '#7C3AED10', allDates.length),
        {
          name: 'Projected',
          type: 'line',
          data: [...new Array(dates.length).fill(null), ...projectedValues],
          lineStyle: { type: 'dashed', color: '#64748B', width: 2 },
          symbol: 'none',
          z: 10,
        },
      ],
    })
  }, [data, chartRef])

  return (
    <Card sx={cardStyle}>
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2" sx={{ color: '#94A3B8' }}>
            Savings Timeline
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={range}
            onChange={(_, v) => v && setRange(v)}
            sx={{ '& .MuiToggleButton-root': { px: 1.5, py: 0.25, fontSize: '0.75rem', color: '#94A3B8' } }}
          >
            <ToggleButton value="30">30d</ToggleButton>
            <ToggleButton value="90">90d</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <Box ref={ref} sx={{ width: '100%', height: 320 }} />
      </CardContent>
    </Card>
  )
}

function makeAreaSeries(
  name: string,
  rawData: number[],
  color: string,
  bottomColor: string,
  totalLen: number,
) {
  const padded = [...rawData, ...new Array(totalLen - rawData.length).fill(null)]
  return {
    name,
    type: 'line',
    stack: 'savings',
    data: padded,
    symbol: 'none',
    smooth: true,
    lineStyle: { width: 2, color },
    areaStyle: {
      color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color },
        { offset: 1, color: bottomColor },
      ]),
    },
    animationDuration: 2000,
    animationEasing: 'cubicOut',
  }
}

function generateProjectedDates(days: number) {
  const result: { date: string }[] = []
  const now = new Date()
  for (let i = 1; i <= days; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() + i)
    result.push({ date: d.toISOString().slice(0, 10) })
  }
  return result
}

// ---------------------------------------------------------------------------
// Policy Treemap
// ---------------------------------------------------------------------------

function PolicyTreemap() {
  const { ref, chartRef } = useEChart([])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    chart.setOption({
      animation: true,
      animationDuration: 1200,
      animationEasing: 'cubicOut',
      tooltip: {
        formatter: (params: { name: string; value: number; data: { executions: number; schedule: string } }) => {
          const d = params.data
          return `<b>${params.name}</b><br/>Saved: $${params.value.toLocaleString()}<br/>Executions: ${d.executions}<br/>Schedule: ${d.schedule}`
        },
      },
      series: [{
        type: 'treemap',
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        itemStyle: { borderColor: '#0F0F17', borderWidth: 3, gapWidth: 2 },
        label: {
          show: true,
          formatter: (p: { name: string; value: number }) => `${p.name}\n$${p.value.toLocaleString()}`,
          fontSize: 12,
          color: '#E2E8F0',
          lineHeight: 18,
        },
        levels: [{
          itemStyle: { borderWidth: 0, gapWidth: 4 },
        }],
        data: POLICIES.map((p, i) => ({
          name: p.name,
          value: p.savings,
          executions: p.executions,
          schedule: p.schedule,
          itemStyle: {
            color: ['#F97316', '#FBBF24', '#7C3AED'][i],
          },
        })),
      }],
    })
  }, [chartRef])

  return (
    <Card sx={cardStyle}>
      <CardContent sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ color: '#94A3B8', mb: 1 }}>
          Per-Policy Savings
        </Typography>
        <Box ref={ref} sx={{ width: '100%', height: 220 }} />
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Cost Waterfall
// ---------------------------------------------------------------------------

function CostWaterfall() {
  const { ref, chartRef } = useEChart([])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    const categories = ['Baseline Spend', 'Node Drain', 'Workload Scale', 'Net Spend']
    const helpers = [0, WATERFALL.baseline + WATERFALL.nodeDrain, WATERFALL.baseline + WATERFALL.nodeDrain + WATERFALL.workloadScale, 0]
    const values = [WATERFALL.baseline, Math.abs(WATERFALL.nodeDrain), Math.abs(WATERFALL.workloadScale), WATERFALL.net]
    const colors = ['#64748B', '#22C55E', '#22C55E', '#7C3AED']

    chart.setOption({
      animation: true,
      animationDuration: 1500,
      animationEasing: 'cubicOut',
      animationDelay: (idx: number) => idx * 300,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: { seriesName: string; value: number; name: string }[]) => {
          const visible = params.find(p => p.seriesName === 'Amount')
          if (!visible) return ''
          const isReduction = visible.name === 'Node Drain' || visible.name === 'Workload Scale'
          return `<b>${visible.name}</b><br/>${isReduction ? '-' : ''}$${visible.value.toLocaleString()}/mo`
        },
      },
      grid: { left: 60, right: 16, top: 16, bottom: 32 },
      xAxis: { type: 'category', data: categories },
      yAxis: {
        type: 'value',
        axisLabel: { formatter: '${value}' },
      },
      series: [
        {
          name: 'Helper',
          type: 'bar',
          stack: 'waterfall',
          itemStyle: { color: 'transparent' },
          data: helpers,
          emphasis: { itemStyle: { color: 'transparent' } },
        },
        {
          name: 'Amount',
          type: 'bar',
          stack: 'waterfall',
          data: values.map((v, i) => ({
            value: v,
            itemStyle: {
              color: colors[i],
              borderRadius: [4, 4, 0, 0],
            },
          })),
          barWidth: '40%',
          animationDuration: 1500,
          animationDelay: (idx: number) => idx * 300,
        },
      ],
    })
  }, [chartRef])

  return (
    <Card sx={cardStyle}>
      <CardContent sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ color: '#94A3B8', mb: 1 }}>
          Monthly Cost Waterfall
        </Typography>
        <Box ref={ref} sx={{ width: '100%', height: 300 }} />
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Live Savings Ticker
// ---------------------------------------------------------------------------

function LiveTicker() {
  const activeSleeper = POLICIES.find(p => p.sleeping)
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    if (!activeSleeper) return
    const interval = setInterval(() => {
      setPulse(p => !p)
    }, 1500)
    return () => clearInterval(interval)
  }, [activeSleeper])

  return (
    <Card
      sx={{
        ...cardStyle,
        border: activeSleeper ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.06)',
        boxShadow: activeSleeper && pulse
          ? '0 0 24px rgba(34,197,94,0.15)'
          : '0 0 0 rgba(34,197,94,0)',
        transition: 'box-shadow 1.5s ease-in-out',
      }}
    >
      <CardContent sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ color: '#94A3B8', mb: 1 }}>
          Right Now
        </Typography>
        {activeSleeper ? (
          <Box>
            <Typography
              variant="h5"
              sx={{
                fontFamily: '"JetBrains Mono", monospace',
                color: '#22C55E',
                fontWeight: 700,
              }}
            >
              ${activeSleeper.liveSavingsRate}/min
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B' }}>
              Saving via {activeSleeper.name}
            </Typography>
          </Box>
        ) : (
          <Box>
            <Typography variant="body2" sx={{ color: '#94A3B8' }}>
              Next savings window in
            </Typography>
            <Typography
              variant="h6"
              sx={{ fontFamily: '"JetBrains Mono", monospace', color: '#FBBF24' }}
            >
              4h 23m
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Currently Sleeping Panel
// ---------------------------------------------------------------------------

function SleepingPanel() {
  const sleepers = POLICIES.filter(p => p.sleeping)
  const [liveSaved, setLiveSaved] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveSaved(prev => prev + 0.0063)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  if (sleepers.length === 0) {
    return (
      <Card sx={cardStyle}>
        <CardContent sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="subtitle2" sx={{ color: '#94A3B8', mb: 1 }}>
            Currently Sleeping
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B' }}>
            No policies sleeping
          </Typography>
          <Typography
            variant="h6"
            sx={{ fontFamily: '"JetBrains Mono", monospace', color: '#FBBF24', mt: 1 }}
          >
            Next window in 4h 23m
          </Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="subtitle2" sx={{ color: '#94A3B8' }}>
        Currently Sleeping
      </Typography>
      {sleepers.map(policy => (
        <Card
          key={policy.name}
          sx={{
            ...cardStyle,
            border: '1px solid rgba(34,197,94,0.2)',
            animation: 'breathe 4s ease-in-out infinite',
            '@keyframes breathe': {
              '0%': { transform: 'scale(1.0)' },
              '50%': { transform: 'scale(1.005)' },
              '100%': { transform: 'scale(1.0)' },
            },
          }}
        >
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ color: '#E2E8F0', fontWeight: 600 }}>
                {policy.name}
              </Typography>
              <Chip
                label="SLEEPING"
                size="small"
                sx={{
                  bgcolor: 'rgba(34,197,94,0.15)',
                  color: '#22C55E',
                  fontSize: '0.65rem',
                  height: 20,
                  fontWeight: 700,
                }}
              />
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <StatMini label="Asleep" value={policy.sleepDuration ?? '—'} />
              <StatMini label="Nodes drained" value={String(policy.nodesDrained)} />
              <StatMini label="Workloads at 0" value={String(policy.workloadsScaled)} />
              <StatMini
                label="Saved (live)"
                value={`$${liveSaved.toFixed(3)}`}
                color="#22C55E"
              />
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  )
}

function StatMini({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ color: '#64748B', fontSize: '0.65rem' }}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontFamily: '"JetBrains Mono", monospace',
          fontWeight: 600,
          color: color ?? '#E2E8F0',
          fontSize: '0.85rem',
        }}
      >
        {value}
      </Typography>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const cardStyle = {
  bgcolor: '#12121A',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 2,
  boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FlagshipObservatoryPage() {
  const router = useRouter()

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0A0A12', color: '#E2E8F0', px: { xs: 2, md: 4 }, py: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => router.push('/prototypes/')} sx={{ color: '#94A3B8' }}>
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
            FL4 — Cost Savings Observatory
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B' }}>
            Real-time financial impact of sleep policies across your fleet
          </Typography>
        </Box>
      </Box>

      {/* Two-column layout */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '3fr 1fr' },
          gap: 3,
          alignItems: 'start',
        }}
      >
        {/* Left column */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Hero Counter */}
          <Card sx={cardStyle}>
            <CardContent sx={{ p: 0 }}>
              <HeroCounter />
            </CardContent>
          </Card>

          {/* Savings Timeline */}
          <SavingsTimeline />

          {/* Cost Waterfall */}
          <CostWaterfall />
        </Box>

        {/* Right column */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Live Ticker */}
          <LiveTicker />

          {/* Currently Sleeping */}
          <SleepingPanel />

          {/* Policy Treemap */}
          <PolicyTreemap />
        </Box>
      </Box>
    </Box>
  )
}
