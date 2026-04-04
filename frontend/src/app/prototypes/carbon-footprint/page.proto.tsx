'use client'

// PROTOTYPE: Cluster Carbon Footprint
// DEPS: echarts echarts-for-react gsap framer-motion
// LIBS: eCharts, GSAP, Framer Motion, Canvas 2D, SVG
// DATA: CO2 savings, energy mix, daily carbon metrics
// DESCRIPTION: Environmental impact visualization of cluster sleep policies

import { useState, useEffect, useRef, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Slider from '@mui/material/Slider'
import Chip from '@mui/material/Chip'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import NightsStayIcon from '@mui/icons-material/NightsStay'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'
import * as echarts from 'echarts'
import { darkTheme } from '@/lib/motion/echartsTheme'

echarts.registerTheme('kube-phoenix-dark', darkTheme)

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface DailyCarbonMetric {
  day: number
  date: string
  saved: number
  baseline: number
}

interface EnergySource {
  name: string
  percentage: number
  color: string
}

interface TimeSlot {
  name: string
  value: number
  color: string
}

interface TreeBranch {
  x1: number
  y1: number
  x2: number
  y2: number
  depth: number
  angle: number
  length: number
  progress: number
  hasLeaf: boolean
  leafScale: number
}

interface LeafParticle {
  x: number
  y: number
  vx: number
  vy: number
  rotation: number
  rotationSpeed: number
  size: number
  opacity: number
  color: string
  life: number
  maxLife: number
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const TOTAL_CO2_TONNES = 23.4
const MONTHLY_CO2_TONNES = 7.8
const CO2_RATE_PER_SEC = 0.8
const EQUIV_FLIGHTS = 94
const EQUIV_TREES = 4200

const ENERGY_MIX: EnergySource[] = [
  { name: 'Wind', percentage: 40, color: '#22C55E' },
  { name: 'Solar', percentage: 20, color: '#FBBF24' },
  { name: 'Hydro', percentage: 15, color: '#3B82F6' },
  { name: 'Gas', percentage: 15, color: '#EF4444' },
  { name: 'Other', percentage: 10, color: '#8B5CF6' },
]

const TIME_SLOTS: TimeSlot[] = [
  { name: '00–06', value: 35, color: '#1E3A5F' },
  { name: '06–12', value: 20, color: '#4A90D9' },
  { name: '12–18', value: 15, color: '#7CB9E8' },
  { name: '18–24', value: 30, color: '#2C5F8A' },
]

const LEAF_COLORS = ['#22C55E', '#16A34A', '#4ADE80', '#86EFAC', '#BBF7D0']

function generateDailyMetrics(): DailyCarbonMetric[] {
  const metrics: DailyCarbonMetric[] = []
  const baseDate = new Date(2026, 0, 5)

  for (let i = 0; i < 90; i++) {
    const date = new Date(baseDate)
    date.setDate(date.getDate() + i)
    const trend = 200 + (i / 90) * 120
    const noise = (Math.sin(i * 0.7) * 40) + (Math.cos(i * 1.3) * 20)
    const saved = Math.max(100, trend + noise)
    const baseline = saved * (2.2 + Math.random() * 0.6)

    metrics.push({
      day: i + 1,
      date: date.toISOString().slice(0, 10),
      saved: Math.round(saved),
      baseline: Math.round(baseline),
    })
  }

  return metrics
}

const DAILY_METRICS = generateDailyMetrics()

// ---------------------------------------------------------------------------
// Tree generation
// ---------------------------------------------------------------------------

function generateTreeBranches(
  x: number,
  y: number,
  angle: number,
  length: number,
  depth: number,
  maxDepth: number,
  branches: TreeBranch[],
): void {
  if (depth > maxDepth) return

  const x2 = x + Math.cos(angle) * length
  const y2 = y + Math.sin(angle) * length
  const isLeafLevel = depth >= maxDepth - 2

  branches.push({
    x1: x, y1: y, x2, y2,
    depth, angle, length,
    progress: 0,
    hasLeaf: isLeafLevel,
    leafScale: 0,
  })

  const branchAngleSpread = 0.45 + (depth * 0.05)
  const nextLength = length * (0.68 + Math.random() * 0.08)

  generateTreeBranches(x2, y2, angle - branchAngleSpread, nextLength, depth + 1, maxDepth, branches)
  generateTreeBranches(x2, y2, angle + branchAngleSpread, nextLength, depth + 1, maxDepth, branches)

  if (depth < 3 && Math.random() > 0.5) {
    generateTreeBranches(x2, y2, angle + (Math.random() - 0.5) * 0.3, nextLength * 0.8, depth + 1, maxDepth, branches)
  }
}

function buildTree(maxDepth: number): TreeBranch[] {
  const branches: TreeBranch[] = []
  generateTreeBranches(200, 320, -Math.PI / 2, 70, 0, maxDepth, branches)
  return branches
}

// ---------------------------------------------------------------------------
// Hero Counter (GSAP animated)
// ---------------------------------------------------------------------------

function HeroCounter({
  targetValue,
  suffix,
  decimals,
  resetKey,
}: {
  targetValue: number
  suffix: string
  decimals: number
  resetKey: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const valueRef = useRef({ val: 0 })

  useEffect(() => {
    valueRef.current.val = 0
    if (!ref.current) return

    const tween = gsap.to(valueRef.current, {
      val: targetValue,
      duration: 2.5,
      ease: 'power2.out',
      onUpdate: () => {
        if (ref.current) {
          ref.current.textContent = `${valueRef.current.val.toFixed(decimals)} ${suffix}`
        }
      },
    })

    return () => { tween.kill() }
  }, [targetValue, suffix, decimals, resetKey])

  return (
    <Typography
      component="span"
      ref={ref}
      sx={{
        fontSize: { xs: 40, md: 56 },
        fontWeight: 900,
        fontFamily: '"Inter", monospace',
        background: 'linear-gradient(135deg, #22C55E, #16A34A, #4ADE80)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        display: 'block',
        lineHeight: 1.2,
      }}
    >
      0 {suffix}
    </Typography>
  )
}

// ---------------------------------------------------------------------------
// SVG Fractal Tree
// ---------------------------------------------------------------------------

function FractalTree({
  treeDepth,
  resetKey,
}: {
  treeDepth: number
  resetKey: number
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const branchesRef = useRef<TreeBranch[]>([])
  const tweensRef = useRef<gsap.core.Tween[]>([])

  useEffect(() => {
    tweensRef.current.forEach(t => t.kill())
    tweensRef.current = []

    const branches = buildTree(treeDepth)
    branchesRef.current = branches

    branches.forEach((branch, i) => {
      branch.progress = 0
      branch.leafScale = 0

      const branchTween = gsap.to(branch, {
        progress: 1,
        duration: 0.4 + branch.depth * 0.15,
        delay: branch.depth * 0.3 + (i % 5) * 0.05,
        ease: 'power2.out',
        onUpdate: () => renderTree(),
      })
      tweensRef.current.push(branchTween)

      if (branch.hasLeaf) {
        const leafTween = gsap.to(branch, {
          leafScale: 1,
          duration: 0.6,
          delay: branch.depth * 0.3 + 0.3 + (i % 5) * 0.05,
          ease: 'elastic.out(1, 0.4)',
          onUpdate: () => renderTree(),
        })
        tweensRef.current.push(leafTween)
      }
    })

    renderTree()

    return () => {
      tweensRef.current.forEach(t => t.kill())
      tweensRef.current = []
    }
  }, [treeDepth, resetKey])

  function renderTree() {
    const svg = svgRef.current
    if (!svg) return

    while (svg.firstChild) svg.removeChild(svg.firstChild)

    const branches = branchesRef.current

    for (const branch of branches) {
      if (branch.progress <= 0) continue

      const endX = branch.x1 + (branch.x2 - branch.x1) * branch.progress
      const endY = branch.y1 + (branch.y2 - branch.y1) * branch.progress
      const thickness = Math.max(1, (7 - branch.depth) * 1.2)
      const brownVal = Math.min(255, 80 + branch.depth * 25)

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      line.setAttribute('x1', String(branch.x1))
      line.setAttribute('y1', String(branch.y1))
      line.setAttribute('x2', String(endX))
      line.setAttribute('y2', String(endY))
      line.setAttribute('stroke', `rgb(${brownVal}, ${Math.floor(brownVal * 0.6)}, ${Math.floor(brownVal * 0.3)})`)
      line.setAttribute('stroke-width', String(thickness))
      line.setAttribute('stroke-linecap', 'round')
      svg.appendChild(line)

      if (branch.hasLeaf && branch.leafScale > 0) {
        const leaf = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        leaf.setAttribute('cx', String(branch.x2))
        leaf.setAttribute('cy', String(branch.y2))
        leaf.setAttribute('r', String(4 * branch.leafScale))
        leaf.setAttribute('fill', LEAF_COLORS[branch.depth % LEAF_COLORS.length])
        leaf.setAttribute('opacity', String(0.85))
        svg.appendChild(leaf)
      }
    }
  }

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 400 340"
      style={{ width: '100%', maxWidth: 400, height: 'auto' }}
    />
  )
}

// ---------------------------------------------------------------------------
// Carbon Timeline (eCharts area)
// ---------------------------------------------------------------------------

function CarbonTimeline({
  visibleDays,
  resetKey,
}: {
  visibleDays: number
  resetKey: number
}) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return
    const chart = echarts.init(chartRef.current, 'kube-phoenix-dark', { renderer: 'canvas' })
    chartInstance.current = chart

    const ob = new ResizeObserver(() => chart.resize())
    ob.observe(chartRef.current)

    return () => {
      ob.disconnect()
      chart.dispose()
      chartInstance.current = null
    }
  }, [resetKey])

  useEffect(() => {
    const chart = chartInstance.current
    if (!chart) return

    const slice = DAILY_METRICS.slice(0, visibleDays)
    const dates = slice.map(d => d.date)
    const saved = slice.map(d => d.saved)
    const baseline = slice.map(d => d.baseline)

    chart.setOption({
      animation: true,
      animationDuration: 600,
      tooltip: {
        trigger: 'axis',
        formatter: (params: { name: string; value: number; seriesName: string }[]) => {
          const date = params[0].name
          const lines = params.map(p => `${p.seriesName}: ${p.value}g`)
          return `<b>${date}</b><br/>${lines.join('<br/>')}`
        },
      },
      legend: {
        data: ['CO₂ Saved', 'Baseline (no kube-phoenix)'],
        top: 0,
        textStyle: { fontSize: 11 },
      },
      grid: { left: 50, right: 20, top: 40, bottom: 30 },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: {
          formatter: (v: string) => v.slice(5),
          interval: Math.max(0, Math.floor(visibleDays / 8) - 1),
        },
      },
      yAxis: {
        type: 'value',
        name: 'g CO₂',
        axisLabel: { formatter: '{value}' },
      },
      series: [
        {
          name: 'CO₂ Saved',
          type: 'line',
          data: saved,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2, color: '#22C55E' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(34,197,94,0.5)' },
              { offset: 1, color: 'rgba(101,67,33,0.15)' },
            ]),
          },
        },
        {
          name: 'Baseline (no kube-phoenix)',
          type: 'line',
          data: baseline,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2, color: '#EF4444', type: 'dashed' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(239,68,68,0.15)' },
              { offset: 1, color: 'rgba(239,68,68,0.02)' },
            ]),
          },
        },
      ],
    })
  }, [visibleDays, resetKey])

  return <Box ref={chartRef} sx={{ width: '100%', height: 320 }} />
}

// ---------------------------------------------------------------------------
// Energy Mix Sunburst (eCharts)
// ---------------------------------------------------------------------------

function EnergyMixChart({ resetKey }: { resetKey: number }) {
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!chartRef.current) return
    const chart = echarts.init(chartRef.current, 'kube-phoenix-dark', { renderer: 'canvas' })

    chart.setOption({
      animation: true,
      animationDuration: 1200,
      animationEasing: 'cubicOut',
      tooltip: { trigger: 'item', formatter: '{b}: {d}%' },
      series: [
        {
          name: 'Time of Day',
          type: 'pie',
          radius: ['0%', '35%'],
          label: { show: true, position: 'inner', fontSize: 9, color: '#E2E8F0' },
          itemStyle: { borderWidth: 1, borderColor: 'rgba(0,0,0,0.3)' },
          data: TIME_SLOTS.map(t => ({
            name: t.name,
            value: t.value,
            itemStyle: { color: t.color },
          })),
        },
        {
          name: 'Energy Source',
          type: 'pie',
          radius: ['45%', '72%'],
          label: {
            formatter: '{b}\n{d}%',
            fontSize: 11,
          },
          itemStyle: { borderWidth: 2, borderColor: 'rgba(0,0,0,0.3)', borderRadius: 4 },
          data: ENERGY_MIX.map(e => ({
            name: e.name,
            value: e.percentage,
            itemStyle: { color: e.color },
          })),
        },
      ],
    })

    const ob = new ResizeObserver(() => chart.resize())
    ob.observe(chartRef.current)
    return () => { ob.disconnect(); chart.dispose() }
  }, [resetKey])

  return <Box ref={chartRef} sx={{ width: '100%', height: 300 }} />
}

// ---------------------------------------------------------------------------
// Leaf Particle Canvas
// ---------------------------------------------------------------------------

function LeafParticleCanvas({ isSleeping }: { isSleeping: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<LeafParticle[]>([])
  const animFrameRef = useRef<number>(0)

  const spawnLeaf = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const particle: LeafParticle = {
      x: Math.random() * canvas.width,
      y: canvas.height + 10,
      vx: (Math.random() - 0.5) * 1.5,
      vy: -(1.5 + Math.random() * 2),
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.1,
      size: 4 + Math.random() * 6,
      opacity: 0.7 + Math.random() * 0.3,
      color: LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)],
      life: 0,
      maxLife: 120 + Math.random() * 80,
    }

    particlesRef.current.push(particle)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let frameCount = 0

    function animate() {
      if (!canvas || !ctx) return

      canvas.width = canvas.offsetWidth * 2
      canvas.height = canvas.offsetHeight * 2
      ctx.scale(2, 2)
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight)

      if (isSleeping && frameCount % 4 === 0) {
        spawnLeaf()
      }

      const particles = particlesRef.current

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy
        p.vx += (Math.random() - 0.5) * 0.15
        p.rotation += p.rotationSpeed
        p.life++

        const lifeRatio = p.life / p.maxLife
        p.opacity = lifeRatio > 0.7 ? (1 - lifeRatio) / 0.3 : Math.min(1, p.life / 10)

        if (p.life >= p.maxLife || p.y < -20) {
          particles.splice(i, 1)
          continue
        }

        ctx.save()
        ctx.translate(p.x / 2, p.y / 2)
        ctx.rotate(p.rotation)
        ctx.globalAlpha = p.opacity * 0.8

        ctx.beginPath()
        ctx.ellipse(0, 0, p.size * 0.6, p.size, 0, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.fill()

        ctx.beginPath()
        ctx.moveTo(0, -p.size)
        ctx.lineTo(0, p.size)
        ctx.strokeStyle = 'rgba(0,0,0,0.2)'
        ctx.lineWidth = 0.5
        ctx.stroke()

        ctx.restore()
      }

      frameCount++
      animFrameRef.current = requestAnimationFrame(animate)
    }

    animFrameRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      particlesRef.current = []
    }
  }, [isSleeping, spawnLeaf])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// CO2 Ticker
// ---------------------------------------------------------------------------

function CO2Ticker({
  isSleeping,
  rate,
}: {
  isSleeping: boolean
  rate: number
}) {
  const [accumulated, setAccumulated] = useState(0)

  useEffect(() => {
    if (!isSleeping) return
    const interval = setInterval(() => {
      setAccumulated(prev => prev + rate)
    }, 1000)
    return () => clearInterval(interval)
  }, [isSleeping, rate])

  useEffect(() => {
    if (!isSleeping) setAccumulated(0)
  }, [isSleeping])

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: isSleeping ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)',
        border: '1px solid',
        borderColor: isSleeping ? 'rgba(34,197,94,0.3)' : 'divider',
        position: 'relative',
        overflow: 'hidden',
        minHeight: 120,
      }}
    >
      <LeafParticleCanvas isSleeping={isSleeping} />
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Typography variant="overline" color="text.secondary">
          REAL-TIME CO₂ TICKER
        </Typography>
        <AnimatePresence mode="wait">
          {isSleeping ? (
            <motion.div
              key="saving"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 800,
                  fontFamily: '"Inter", monospace',
                  color: '#22C55E',
                }}
              >
                Saving {rate}g CO₂/sec right now
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Session total: {accumulated.toFixed(1)}g saved
              </Typography>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 600 }}>
                Cluster awake — no active savings
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Trigger a sleep event to start saving
              </Typography>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function CarbonFootprintPrototype() {
  const router = useRouter()

  const [resetKey, setResetKey] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [visibleDays, setVisibleDays] = useState(1)
  const [isSleeping, setIsSleeping] = useState(false)
  const [treeDepth, setTreeDepth] = useState(3)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const handleReset = useCallback(() => {
    setVisibleDays(1)
    setIsSleeping(false)
    setTreeDepth(3)
    setIsPlaying(true)
    setResetKey(k => k + 1)
  }, [])

  const handleSleepEvent = useCallback(() => {
    setIsSleeping(prev => !prev)
    if (!isSleeping) {
      setTreeDepth(d => Math.min(8, d + 1))
    }
  }, [isSleeping])

  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }

    const ms = Math.max(50, 500 / speed)

    intervalRef.current = setInterval(() => {
      setVisibleDays(prev => {
        if (prev >= 90) {
          setIsPlaying(false)
          return 90
        }
        return prev + 1
      })
    }, ms)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isPlaying, speed])

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', py: 4, px: 2, pb: 12 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>
            FL18 — Cluster Carbon Footprint
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Environmental impact visualization of cluster sleep policies
          </Typography>
        </Box>
        <Chip
          label={`Day ${visibleDays} / 90`}
          size="small"
          variant="outlined"
          sx={{ fontFamily: 'monospace' }}
        />
      </Box>

      {/* Hero Metric */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 3,
          mb: 4,
        }}
      >
        <Box
          sx={{
            p: 3,
            borderRadius: 3,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <Typography variant="overline" color="text.secondary" sx={{ mb: 1 }}>
            TOTAL CO₂ SAVED
          </Typography>
          <HeroCounter
            targetValue={TOTAL_CO2_TONNES}
            suffix="tonnes CO₂"
            decimals={1}
            resetKey={resetKey}
          />
          <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap' }}>
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 2.0 }}
            >
              <Chip
                label={`≡ ${EQUIV_FLIGHTS} transatlantic flights`}
                size="small"
                sx={{
                  bgcolor: 'rgba(34,197,94,0.1)',
                  color: '#22C55E',
                  fontWeight: 600,
                }}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 2.4 }}
            >
              <Chip
                label={`≡ ${EQUIV_TREES.toLocaleString()} trees planted`}
                size="small"
                sx={{
                  bgcolor: 'rgba(34,197,94,0.1)',
                  color: '#4ADE80',
                  fontWeight: 600,
                }}
              />
            </motion.div>
          </Box>
          <Box sx={{ display: 'flex', gap: 3, mt: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Monthly</Typography>
              <Typography variant="h6" fontWeight={700} sx={{ color: '#22C55E' }}>
                {MONTHLY_CO2_TONNES}t
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Daily avg</Typography>
              <Typography variant="h6" fontWeight={700} sx={{ color: '#4ADE80' }}>
                ~260g
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Rate</Typography>
              <Typography variant="h6" fontWeight={700} sx={{ color: '#86EFAC' }}>
                {CO2_RATE_PER_SEC}g/s
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Fractal Tree */}
        <Box
          sx={{
            p: 3,
            borderRadius: 3,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Typography variant="overline" color="text.secondary" sx={{ mb: 1 }}>
            GROWTH TREE — DEPTH {treeDepth}
          </Typography>
          <FractalTree treeDepth={treeDepth} resetKey={resetKey} />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
            Each sleep event sprouts new branches
          </Typography>
        </Box>
      </Box>

      {/* Carbon Timeline */}
      <Box
        sx={{
          p: 3,
          borderRadius: 3,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          mb: 4,
        }}
      >
        <Typography variant="overline" color="text.secondary">
          CARBON TIMELINE — 90 DAYS
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
          The gap between lines = your impact
        </Typography>
        <CarbonTimeline visibleDays={visibleDays} resetKey={resetKey} />
      </Box>

      {/* Energy Mix + Ticker */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 3,
          mb: 4,
        }}
      >
        <Box
          sx={{
            p: 3,
            borderRadius: 3,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="overline" color="text.secondary">
            ENERGY MIX — EU-WEST-1 (AWS IRELAND)
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Inner ring: sleep window coverage by time of day
          </Typography>
          <EnergyMixChart resetKey={resetKey} />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <CO2Ticker isSleeping={isSleeping} rate={CO2_RATE_PER_SEC} />
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              flex: 1,
            }}
          >
            <Typography variant="overline" color="text.secondary">
              ENERGY SOURCE BREAKDOWN
            </Typography>
            {ENERGY_MIX.map(source => (
              <Box key={source.name} sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: source.color,
                    flexShrink: 0,
                  }}
                />
                <Typography variant="body2" sx={{ flex: 1 }}>
                  {source.name}
                </Typography>
                <Typography variant="body2" fontWeight={700} sx={{ fontFamily: 'monospace' }}>
                  {source.percentage}%
                </Typography>
                <Box
                  sx={{
                    width: 80,
                    height: 6,
                    borderRadius: 3,
                    bgcolor: 'rgba(255,255,255,0.06)',
                    overflow: 'hidden',
                  }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${source.percentage}%` }}
                    transition={{ duration: 1, delay: 0.5 }}
                    style={{
                      height: '100%',
                      backgroundColor: source.color,
                      borderRadius: 3,
                    }}
                  />
                </Box>
              </Box>
            ))}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
              Sleeping shifts consumption to off-peak hours with higher renewable share
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Dev Toolbar */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          bgcolor: 'rgba(15,15,20,0.95)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid',
          borderColor: 'rgba(255,255,255,0.08)',
          px: 3,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Typography
          variant="caption"
          sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1 }}
        >
          Dev Toolbar
        </Typography>

        <IconButton
          size="small"
          onClick={() => setIsPlaying(p => !p)}
          sx={{ color: isPlaying ? '#22C55E' : 'text.secondary' }}
        >
          {isPlaying ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
        </IconButton>

        <IconButton size="small" onClick={handleReset} sx={{ color: 'text.secondary' }}>
          <RestartAltIcon fontSize="small" />
        </IconButton>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 140 }}>
          <Typography variant="caption" color="text.secondary">Speed</Typography>
          <Slider
            value={speed}
            onChange={(_, v) => setSpeed(v as number)}
            min={0.5}
            max={5}
            step={0.5}
            size="small"
            sx={{ width: 80, color: '#22C55E' }}
          />
          <Typography variant="caption" sx={{ fontFamily: 'monospace', minWidth: 30 }}>
            {speed}x
          </Typography>
        </Box>

        <Button
          variant={isSleeping ? 'contained' : 'outlined'}
          size="small"
          startIcon={<NightsStayIcon fontSize="small" />}
          onClick={handleSleepEvent}
          sx={{
            bgcolor: isSleeping ? '#7C3AED' : 'transparent',
            borderColor: '#7C3AED',
            color: isSleeping ? '#fff' : '#7C3AED',
            '&:hover': {
              bgcolor: isSleeping ? '#6D28D9' : 'rgba(124,58,237,0.1)',
            },
          }}
        >
          {isSleeping ? 'Wake Up' : 'Simulate Sleep'}
        </Button>

        <Chip
          label={isSleeping ? 'SLEEPING' : 'AWAKE'}
          size="small"
          sx={{
            bgcolor: isSleeping ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)',
            color: isSleeping ? '#A78BFA' : 'text.secondary',
            fontFamily: 'monospace',
            fontWeight: 700,
          }}
        />

        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto', fontFamily: 'monospace' }}>
          Tree depth: {treeDepth} | Days: {visibleDays}/90
        </Typography>
      </Box>
    </Box>
  )
}
