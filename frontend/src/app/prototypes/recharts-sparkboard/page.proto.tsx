'use client'

// PROTOTYPE: Recharts Savings Sparkboard
// DEPS: framer-motion
// LIBS: SVG, Canvas 2D, Framer Motion
// DATA: Per-namespace replica history, CPU trends, cost savings
// DESCRIPTION: 3x3 grid of namespace cards with micro sparkline charts

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Slider from '@mui/material/Slider'
import Chip from '@mui/material/Chip'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import ReplayIcon from '@mui/icons-material/Replay'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import HotelIcon from '@mui/icons-material/Hotel'
import { useRouter } from 'next/navigation'
import { useTheme, alpha } from '@mui/material/styles'
import { motion, AnimatePresence } from 'framer-motion'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NamespaceConfig {
  name: string
  replicas: number
  cpuPercent: number
  savingsPerDay: number
  sleeps: boolean
  status: 'healthy' | 'warning' | 'sleeping'
}

interface ReplicaPoint {
  hour: number
  replicas: number
}

interface CpuPoint {
  minute: number
  cpu: number
}

interface SavingsDay {
  day: number
  savings: number
}

interface NamespaceState extends NamespaceConfig {
  replicaHistory: ReplicaPoint[]
  cpuTrend: CpuPoint[]
  savingsHistory: SavingsDay[]
  isSleeping: boolean
  previousReplicas: number
}

// ---------------------------------------------------------------------------
// Namespace configs
// ---------------------------------------------------------------------------

const NAMESPACE_CONFIGS: NamespaceConfig[] = [
  { name: 'production', replicas: 11, cpuPercent: 72, savingsPerDay: 0, sleeps: false, status: 'healthy' },
  { name: 'payments', replicas: 7, cpuPercent: 58, savingsPerDay: 0, sleeps: false, status: 'healthy' },
  { name: 'auth-service', replicas: 8, cpuPercent: 45, savingsPerDay: 0, sleeps: false, status: 'healthy' },
  { name: 'data-pipeline', replicas: 5, cpuPercent: 81, savingsPerDay: 0, sleeps: false, status: 'warning' },
  { name: 'ml-training', replicas: 6, cpuPercent: 89, savingsPerDay: 2.4, sleeps: true, status: 'healthy' },
  { name: 'internal-tools', replicas: 3, cpuPercent: 22, savingsPerDay: 4.8, sleeps: true, status: 'healthy' },
  { name: 'staging', replicas: 6, cpuPercent: 35, savingsPerDay: 8.2, sleeps: true, status: 'healthy' },
  { name: 'monitoring', replicas: 3, cpuPercent: 41, savingsPerDay: 0, sleeps: false, status: 'healthy' },
  { name: 'dev-sandbox', replicas: 2, cpuPercent: 15, savingsPerDay: 3.1, sleeps: true, status: 'sleeping' },
]

// ---------------------------------------------------------------------------
// Data generators
// ---------------------------------------------------------------------------

function generateReplicaHistory(config: NamespaceConfig): ReplicaPoint[] {
  const points: ReplicaPoint[] = []
  for (let h = 0; h < 24; h++) {
    const isSleepHour = config.sleeps && (h >= 19 || h < 7)
    const replicas = isSleepHour ? 0 : config.replicas
    points.push({ hour: h, replicas })
    points.push({ hour: h + 0.99, replicas })
  }
  return points
}

function generateCpuTrend(config: NamespaceConfig): CpuPoint[] {
  const points: CpuPoint[] = []
  let cpu = config.cpuPercent
  for (let m = 0; m <= 60; m += 2) {
    cpu += (Math.random() - 0.5) * 8
    cpu = Math.max(5, Math.min(100, cpu))
    points.push({ minute: m, cpu: Math.round(cpu * 10) / 10 })
  }
  return points
}

function generateSavingsHistory(config: NamespaceConfig): SavingsDay[] {
  return Array.from({ length: 7 }, (_, i) => ({
    day: i,
    savings: config.savingsPerDay > 0
      ? Math.round((config.savingsPerDay + (Math.random() - 0.5) * 1.5) * 100) / 100
      : 0,
  }))
}

function buildInitialStates(): NamespaceState[] {
  return NAMESPACE_CONFIGS.map((config) => ({
    ...config,
    replicaHistory: generateReplicaHistory(config),
    cpuTrend: generateCpuTrend(config),
    savingsHistory: generateSavingsHistory(config),
    isSleeping: config.status === 'sleeping',
    previousReplicas: config.replicas,
  }))
}

// ---------------------------------------------------------------------------
// SVG micro-chart components
// ---------------------------------------------------------------------------

interface SparkAreaProps {
  data: ReplicaPoint[]
  width: number
  height: number
  color: string
  collapsed: boolean
}

function SparkArea({ data, width, height, color, collapsed }: SparkAreaProps) {
  const maxReplicas = Math.max(...data.map((d) => d.replicas), 1)
  const maxHour = Math.max(...data.map((d) => d.hour), 1)
  const padding = 2

  const toX = (hour: number) => padding + ((hour / maxHour) * (width - padding * 2))
  const toY = (replicas: number) => {
    const effective = collapsed ? 0 : replicas
    return height - padding - ((effective / maxReplicas) * (height - padding * 2))
  }

  const linePoints = data.map((d) => `${toX(d.hour)},${toY(d.replicas)}`).join(' ')
  const areaPoints = `${toX(data[0].hour)},${height - padding} ${linePoints} ${toX(data[data.length - 1].hour)},${height - padding}`

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <motion.polygon
        points={areaPoints}
        fill={color}
        fillOpacity={0.15}
        animate={{ opacity: collapsed ? 0.05 : 0.15 }}
        transition={{ duration: 0.6 }}
      />
      <motion.polyline
        points={linePoints}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        animate={{ opacity: collapsed ? 0.3 : 1 }}
        transition={{ duration: 0.6 }}
      />
    </svg>
  )
}

interface SparkLineProps {
  data: CpuPoint[]
  width: number
  height: number
  color: string
  collapsed: boolean
}

function SparkLine({ data, width, height, color, collapsed }: SparkLineProps) {
  const maxCpu = 100
  const maxMinute = Math.max(...data.map((d) => d.minute), 1)
  const padding = 2

  const toX = (minute: number) => padding + ((minute / maxMinute) * (width - padding * 2))
  const toY = (cpu: number) => {
    const effective = collapsed ? 0 : cpu
    return height - padding - ((effective / maxCpu) * (height - padding * 2))
  }

  const pathData = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${toX(d.minute)} ${toY(d.cpu)}`)
    .join(' ')

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <motion.path
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        animate={{ opacity: collapsed ? 0.3 : 1 }}
        transition={{ duration: 0.6 }}
      />
    </svg>
  )
}

interface SparkBarsProps {
  data: SavingsDay[]
  width: number
  height: number
  color: string
  collapsed: boolean
}

function SparkBars({ data, width, height, color, collapsed }: SparkBarsProps) {
  const maxSavings = Math.max(...data.map((d) => d.savings), 0.01)
  const padding = 2
  const barGap = 2
  const barWidth = (width - padding * 2 - barGap * (data.length - 1)) / data.length

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {data.map((d, i) => {
        const barHeight = collapsed ? 0 : (d.savings / maxSavings) * (height - padding * 2)
        const x = padding + i * (barWidth + barGap)
        const y = height - padding - barHeight
        return (
          <motion.rect
            key={d.day}
            x={x}
            y={y}
            width={barWidth}
            rx={1}
            fill={color}
            fillOpacity={0.7}
            animate={{ height: barHeight, y }}
            transition={{ duration: 0.5, delay: i * 0.03 }}
          />
        )
      })}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Value flash hook
// ---------------------------------------------------------------------------

function useValueFlash(value: number): boolean {
  const prevRef = useRef(value)
  const [flashing, setFlashing] = useState(false)

  useEffect(() => {
    if (prevRef.current !== value) {
      setFlashing(true)
      const timer = setTimeout(() => setFlashing(false), 400)
      prevRef.current = value
      return () => clearTimeout(timer)
    }
  }, [value])

  return flashing
}

// ---------------------------------------------------------------------------
// Status dot color
// ---------------------------------------------------------------------------

function useStatusColor(status: NamespaceConfig['status']) {
  const theme = useTheme()
  switch (status) {
    case 'healthy': return theme.palette.success.main
    case 'warning': return theme.palette.warning.main
    case 'sleeping': return theme.palette.info.main
  }
}

// ---------------------------------------------------------------------------
// Namespace card
// ---------------------------------------------------------------------------

interface NamespaceCardProps {
  ns: NamespaceState
  index: number
}

function NamespaceCard({ ns, index }: NamespaceCardProps) {
  const theme = useTheme()
  const replicaFlash = useValueFlash(ns.replicas)
  const statusColor = useStatusColor(ns.isSleeping ? 'sleeping' : ns.status)

  const chartWidth = 160
  const chartHeight = 32

  const replicaColor = theme.palette.primary.main
  const cpuColor = theme.palette.warning.main
  const savingsColor = theme.palette.success.main

  const totalWeeklySavings = ns.savingsHistory.reduce((sum, d) => sum + d.savings, 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      whileHover={{ scale: 1.02 }}
      style={{ position: 'relative' }}
    >
      <Card
        sx={{
          p: 2,
          position: 'relative',
          overflow: 'hidden',
          bgcolor: 'background.paper',
          border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
          transition: 'box-shadow 0.2s ease',
          '&:hover': {
            boxShadow: `0 4px 20px ${alpha(theme.palette.common.black, 0.15)}`,
          },
        }}
      >
        {/* Moon overlay for sleeping namespaces */}
        <AnimatePresence>
          {ns.isSleeping && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2,
                pointerEvents: 'none',
              }}
            >
              <DarkModeIcon
                sx={{
                  fontSize: 48,
                  color: alpha(theme.palette.info.main, 0.15),
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header: name + status */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: statusColor,
              flexShrink: 0,
            }}
          />
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: 'text.primary',
            }}
          >
            {ns.name}
          </Typography>
          {ns.isSleeping && (
            <Chip
              icon={<HotelIcon sx={{ fontSize: 12 }} />}
              label="sleeping"
              size="small"
              sx={{
                height: 18,
                fontSize: '0.6rem',
                ml: 'auto',
                bgcolor: alpha(theme.palette.info.main, 0.12),
                color: theme.palette.info.main,
              }}
            />
          )}
        </Box>

        {/* Replica count */}
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mb: 1.5 }}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              lineHeight: 1,
              color: 'text.primary',
              transition: 'background-color 0.3s ease',
              bgcolor: replicaFlash ? alpha(theme.palette.primary.main, 0.2) : 'transparent',
              borderRadius: 0.5,
              px: 0.5,
            }}
          >
            {ns.isSleeping ? 0 : ns.replicas}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            replicas
          </Typography>
        </Box>

        {/* Charts section */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, position: 'relative', zIndex: 1 }}>
          {/* Replica sparkline */}
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem', mb: 0.25, display: 'block' }}>
              Replicas (24h)
            </Typography>
            <SparkArea
              data={ns.replicaHistory}
              width={chartWidth}
              height={chartHeight}
              color={replicaColor}
              collapsed={ns.isSleeping}
            />
          </Box>

          {/* CPU trend */}
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem', mb: 0.25, display: 'block' }}>
              CPU (1h) — {ns.isSleeping ? '0' : ns.cpuPercent}%
            </Typography>
            <SparkLine
              data={ns.cpuTrend}
              width={chartWidth}
              height={chartHeight}
              color={cpuColor}
              collapsed={ns.isSleeping}
            />
          </Box>

          {/* Cost savings bars */}
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem', mb: 0.25, display: 'block' }}>
              Savings (7d) — ${totalWeeklySavings.toFixed(2)}
            </Typography>
            <SparkBars
              data={ns.savingsHistory}
              width={chartWidth}
              height={chartHeight}
              color={savingsColor}
              collapsed={ns.savingsPerDay === 0}
            />
          </Box>
        </Box>

        {/* Hover detail overlay */}
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            opacity: 0,
            transition: 'opacity 0.2s',
            '.MuiCard-root:hover &': { opacity: 1 },
            bgcolor: alpha(theme.palette.background.paper, 0.9),
            borderRadius: 1,
            px: 1,
            py: 0.5,
          }}
        >
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem', display: 'block' }}>
            CPU: {ns.cpuPercent}% · ${ns.savingsPerDay}/day
          </Typography>
        </Box>
      </Card>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Main prototype
// ---------------------------------------------------------------------------

export default function RechartsSparkboardPrototype() {
  const theme = useTheme()
  const router = useRouter()

  const [namespaces, setNamespaces] = useState<NamespaceState[]>(buildInitialStates)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const resetState = useCallback(() => {
    setNamespaces(buildInitialStates())
  }, [])

  const triggerSleep = useCallback(() => {
    setNamespaces((prev) =>
      prev.map((ns) => {
        if (!ns.sleeps) return ns
        return {
          ...ns,
          isSleeping: !ns.isSleeping,
          previousReplicas: ns.replicas,
          status: !ns.isSleeping ? 'sleeping' : 'healthy' as NamespaceConfig['status'],
        }
      }),
    )
  }, [])

  // Tick: update CPU data with random walk
  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = null
      return
    }

    intervalRef.current = setInterval(() => {
      setNamespaces((prev) =>
        prev.map((ns) => {
          const newCpuTrend = ns.cpuTrend.slice(1).map((p, i) => ({ ...p, minute: i * 2 }))
          const lastCpu = newCpuTrend[newCpuTrend.length - 1]?.cpu ?? ns.cpuPercent
          const nextCpu = Math.max(5, Math.min(100, lastCpu + (Math.random() - 0.5) * 6))
          newCpuTrend.push({ minute: 60, cpu: Math.round(nextCpu * 10) / 10 })

          return { ...ns, cpuTrend: newCpuTrend }
        }),
      )
    }, 2000 / speed)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [playing, speed])

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        p: 3,
        pb: 12,
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={() => router.push('/prototypes')} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
            Savings Sparkboard
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            9 namespace cards · replica history · CPU trends · cost savings
          </Typography>
        </Box>
      </Box>

      {/* 3x3 Grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
          },
          gap: 2,
          maxWidth: 900,
          mx: 'auto',
        }}
      >
        {namespaces.map((ns, i) => (
          <NamespaceCard key={ns.name} ns={ns} index={i} />
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
          bgcolor: alpha(theme.palette.background.paper, 0.95),
          borderTop: `1px solid ${theme.palette.divider}`,
          backdropFilter: 'blur(8px)',
          px: 3,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
          DEV
        </Typography>

        {/* Play / Pause */}
        <IconButton
          size="small"
          onClick={() => setPlaying((p) => !p)}
          sx={{ color: 'text.primary' }}
        >
          {playing ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
        </IconButton>

        {/* Reset */}
        <IconButton size="small" onClick={resetState} sx={{ color: 'text.primary' }}>
          <ReplayIcon fontSize="small" />
        </IconButton>

        {/* Speed slider */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 140 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Speed
          </Typography>
          <Slider
            size="small"
            min={0.5}
            max={4}
            step={0.5}
            value={speed}
            onChange={(_, v) => setSpeed(v as number)}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `${v}x`}
            sx={{ width: 80 }}
          />
        </Box>

        {/* Sleep trigger */}
        <Button
          size="small"
          variant="outlined"
          startIcon={<HotelIcon />}
          onClick={triggerSleep}
          sx={{ textTransform: 'none', fontSize: '0.75rem' }}
        >
          Toggle Sleep
        </Button>
      </Box>
    </Box>
  )
}
