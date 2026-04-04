'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import LinearProgress from '@mui/material/LinearProgress'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import ReplayIcon from '@mui/icons-material/Replay'
import NightsStayIcon from '@mui/icons-material/NightsStay'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import SpeedIcon from '@mui/icons-material/Speed'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LogLevel = 'info' | 'ok' | 'warn' | 'error'
type WorkloadStatus = 'awake' | 'scaling' | 'sleeping'
type ExecutionStatus = 'idle' | 'running' | 'completed'
type Direction = 'sleep' | 'wake'
type ViewMode = 'terminal' | 'panels' | 'cinematic' | 'split'

interface LogLine {
  id: number
  timestamp: string
  level: LogLevel
  message: string
  workload?: string
}

interface Workload {
  name: string
  namespace: string
  originalReplicas: number
  currentReplicas: number
  status: WorkloadStatus
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LEVEL_COLORS: Record<LogLevel, string> = {
  info: '#E0E0E0',
  ok: '#4CAF50',
  warn: '#FF9800',
  error: '#F44336',
}

const STATUS_COLORS: Record<WorkloadStatus, { border: string; bg: string }> = {
  awake: { border: '#4CAF50', bg: 'rgba(76, 175, 80, 0.08)' },
  scaling: { border: '#FF9800', bg: 'rgba(255, 152, 0, 0.06)' },
  sleeping: { border: '#616161', bg: 'rgba(97, 97, 97, 0.04)' },
}

const INITIAL_WORKLOADS: Workload[] = [
  { name: 'api-gateway', namespace: 'production', originalReplicas: 3, currentReplicas: 3, status: 'awake' },
  { name: 'web-frontend', namespace: 'production', originalReplicas: 4, currentReplicas: 4, status: 'awake' },
  { name: 'order-service', namespace: 'production', originalReplicas: 2, currentReplicas: 2, status: 'awake' },
  { name: 'payment-service', namespace: 'production', originalReplicas: 2, currentReplicas: 2, status: 'awake' },
  { name: 'inventory-service', namespace: 'production', originalReplicas: 3, currentReplicas: 3, status: 'awake' },
  { name: 'notification-svc', namespace: 'production', originalReplicas: 1, currentReplicas: 1, status: 'awake' },
  { name: 'auth-service', namespace: 'production', originalReplicas: 2, currentReplicas: 2, status: 'awake' },
  { name: 'search-indexer', namespace: 'production', originalReplicas: 2, currentReplicas: 2, status: 'awake' },
  { name: 'cache-warmer', namespace: 'production', originalReplicas: 1, currentReplicas: 1, status: 'awake' },
  { name: 'metrics-collector', namespace: 'monitoring', originalReplicas: 1, currentReplicas: 1, status: 'awake' },
  { name: 'log-aggregator', namespace: 'monitoring', originalReplicas: 2, currentReplicas: 2, status: 'awake' },
  { name: 'ml-inference', namespace: 'production', originalReplicas: 3, currentReplicas: 3, status: 'awake' },
  { name: 'recommendation-engine', namespace: 'production', originalReplicas: 2, currentReplicas: 2, status: 'awake' },
  { name: 'data-pipeline', namespace: 'production', originalReplicas: 1, currentReplicas: 1, status: 'awake' },
  { name: 'event-bus', namespace: 'production', originalReplicas: 3, currentReplicas: 3, status: 'awake' },
  { name: 'cdn-proxy', namespace: 'production', originalReplicas: 2, currentReplicas: 2, status: 'awake' },
  { name: 'rate-limiter', namespace: 'production', originalReplicas: 1, currentReplicas: 1, status: 'awake' },
  { name: 'session-store', namespace: 'production', originalReplicas: 2, currentReplicas: 2, status: 'awake' },
  { name: 'email-worker', namespace: 'production', originalReplicas: 1, currentReplicas: 1, status: 'awake' },
  { name: 'webhook-relay', namespace: 'production', originalReplicas: 1, currentReplicas: 1, status: 'awake' },
]

const NODES = [
  'ip-10-0-1-100',
  'ip-10-0-1-101',
  'ip-10-0-2-200',
  'ip-10-0-2-201',
]

const POLICY_NAME = 'production-sleep'

// ---------------------------------------------------------------------------
// Log line generator
// ---------------------------------------------------------------------------

function generateSleepLogs(workloads: Workload[]): Omit<LogLine, 'id' | 'timestamp'>[] {
  const lines: Omit<LogLine, 'id' | 'timestamp'>[] = []

  lines.push({ level: 'info', message: `Sleep execution started for policy '${POLICY_NAME}'` })
  lines.push({ level: 'info', message: 'Evaluating guardrails...' })
  lines.push({ level: 'info', message: 'Checking active connections threshold' })
  lines.push({ level: 'ok', message: 'All guardrails passed — proceeding with sleep' })

  for (const w of workloads) {
    lines.push({
      level: 'info',
      message: `Scaling ${w.namespace}/${w.name} from ${w.originalReplicas} to 0 replicas`,
      workload: w.name,
    })
    lines.push({
      level: 'ok',
      message: `${w.namespace}/${w.name} scaled to 0 ✓`,
      workload: w.name,
    })
  }

  for (const node of NODES) {
    lines.push({ level: 'info', message: `Cordoning node ${node}` })
    lines.push({ level: 'info', message: `Draining node ${node}...` })
    lines.push({ level: 'ok', message: `Node ${node} deleted` })
  }

  lines.push({
    level: 'ok',
    message: `Sleep execution completed: ${workloads.length} workloads scaled, ${NODES.length} nodes drained`,
  })

  return lines
}

function generateWakeLogs(workloads: Workload[]): Omit<LogLine, 'id' | 'timestamp'>[] {
  const lines: Omit<LogLine, 'id' | 'timestamp'>[] = []

  lines.push({ level: 'info', message: `Wake execution started for policy '${POLICY_NAME}'` })
  lines.push({ level: 'info', message: 'Provisioning nodes...' })

  for (const node of NODES) {
    lines.push({ level: 'info', message: `Provisioning node ${node}` })
    lines.push({ level: 'ok', message: `Node ${node} ready` })
  }

  lines.push({ level: 'ok', message: 'All nodes provisioned — scaling workloads' })

  for (const w of workloads) {
    lines.push({
      level: 'info',
      message: `Scaling ${w.namespace}/${w.name} from 0 to ${w.originalReplicas} replicas`,
      workload: w.name,
    })
    lines.push({
      level: 'ok',
      message: `${w.namespace}/${w.name} scaled to ${w.originalReplicas} ✓`,
      workload: w.name,
    })
  }

  lines.push({
    level: 'ok',
    message: `Wake execution completed: ${workloads.length} workloads restored, ${NODES.length} nodes provisioned`,
  })

  return lines
}

// ---------------------------------------------------------------------------
// Utility: format elapsed time
// ---------------------------------------------------------------------------

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TerminalView({
  logLines,
  workloads,
}: {
  logLines: LogLine[]
  workloads: Workload[]
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const userScrolledRef = useRef(false)
  const sleepingNames = useMemo(
    () => new Set(workloads.filter(w => w.status === 'sleeping').map(w => w.name)),
    [workloads],
  )

  useEffect(() => {
    if (!userScrolledRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [logLines])

  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    userScrolledRef.current = !atBottom
  }, [])

  function highlightWorkloads(message: string) {
    const parts: (string | React.ReactElement)[] = []
    let remaining = message
    const allNames = INITIAL_WORKLOADS.map(w => w.name).sort((a, b) => b.length - a.length)

    for (const name of allNames) {
      if (remaining.includes(name)) {
        const idx = remaining.indexOf(name)
        if (idx > 0) parts.push(remaining.slice(0, idx))
        const isSleeping = sleepingNames.has(name)
        parts.push(
          <span
            key={`${name}-${parts.length}`}
            style={{
              fontWeight: 700,
              color: isSleeping ? '#9E9E9E' : '#81D4FA',
              textDecoration: isSleeping ? 'line-through' : 'none',
              transition: 'all 0.5s ease',
            }}
          >
            {name}
          </span>,
        )
        remaining = remaining.slice(idx + name.length)
      }
    }
    if (remaining) parts.push(remaining)
    return parts
  }

  return (
    <Box
      ref={containerRef}
      onScroll={handleScroll}
      sx={{
        flex: 1,
        bgcolor: '#0A0A0F',
        borderRadius: 2,
        p: 2,
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontSize: 13,
        overflowY: 'auto',
        position: 'relative',
        boxShadow: 'inset 0 0 60px rgba(0, 255, 100, 0.03), 0 0 30px rgba(0, 255, 100, 0.05)',
        '&::after': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
          pointerEvents: 'none',
          zIndex: 1,
        },
      }}
    >
      <AnimatePresence initial={false}>
        {logLines.map((line) => (
          <motion.div
            key={line.id}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ marginBottom: 2, lineHeight: 1.7 }}
          >
            <span style={{ color: '#616161', marginRight: 8 }}>{line.timestamp}</span>
            <span
              style={{
                color: LEVEL_COLORS[line.level],
                fontWeight: line.level === 'error' ? 700 : 400,
              }}
            >
              {highlightWorkloads(line.message)}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
      {logLines.length === 0 && (
        <Typography sx={{ color: '#4A4A4A', fontFamily: 'monospace', mt: 4, textAlign: 'center' }}>
          Awaiting execution start...
        </Typography>
      )}
    </Box>
  )
}

function WorkloadCard({
  workload,
  index,
}: {
  workload: Workload
  index: number
}) {
  const replicaRef = useRef<HTMLSpanElement>(null)
  const prevReplicasRef = useRef(workload.currentReplicas)

  useEffect(() => {
    if (prevReplicasRef.current !== workload.currentReplicas && replicaRef.current) {
      const obj = { val: prevReplicasRef.current }
      gsap.to(obj, {
        val: workload.currentReplicas,
        duration: 0.6,
        ease: 'power2.out',
        onUpdate: () => {
          if (replicaRef.current) {
            replicaRef.current.textContent = String(Math.round(obj.val))
          }
        },
      })
      prevReplicasRef.current = workload.currentReplicas
    }
  }, [workload.currentReplicas])

  const colors = STATUS_COLORS[workload.status]
  const isPulsing = workload.status === 'scaling'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{
        opacity: 1,
        scale: 1,
        transition: { delay: index * 0.03 },
      }}
    >
      <Box
        sx={{
          p: 2,
          borderRadius: 2,
          border: `2px solid ${colors.border}`,
          bgcolor: colors.bg,
          transition: 'all 0.5s ease',
          position: 'relative',
          overflow: 'hidden',
          animation: isPulsing ? 'pulse-border 1.2s ease-in-out infinite' : 'none',
          '@keyframes pulse-border': {
            '0%, 100%': { borderColor: colors.border, boxShadow: 'none' },
            '50%': { borderColor: '#FFB74D', boxShadow: '0 0 12px rgba(255, 152, 0, 0.3)' },
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 700,
              color: workload.status === 'sleeping' ? '#757575' : '#E0E0E0',
              fontSize: 13,
              transition: 'color 0.4s ease',
            }}
          >
            {workload.name}
          </Typography>
          {workload.status === 'sleeping' && (
            <DarkModeIcon sx={{ fontSize: 14, color: '#757575' }} />
          )}
        </Box>
        <Chip
          label={workload.namespace}
          size="small"
          sx={{
            height: 20,
            fontSize: 10,
            bgcolor: 'rgba(255,255,255,0.06)',
            color: '#9E9E9E',
            mb: 1.5,
          }}
        />
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
          <Typography
            component="span"
            ref={replicaRef}
            sx={{
              fontSize: 28,
              fontWeight: 800,
              color: workload.status === 'sleeping' ? '#616161' : workload.status === 'scaling' ? '#FF9800' : '#4CAF50',
              fontFamily: '"JetBrains Mono", monospace',
              lineHeight: 1,
              transition: 'color 0.4s ease',
            }}
          >
            {workload.currentReplicas}
          </Typography>
          <Typography variant="caption" sx={{ color: '#757575', fontSize: 11 }}>
            / {workload.originalReplicas} replicas
          </Typography>
        </Box>
        <Box
          sx={{
            mt: 1,
            height: 3,
            borderRadius: 1,
            bgcolor: 'rgba(255,255,255,0.05)',
            overflow: 'hidden',
          }}
        >
          <motion.div
            animate={{
              width: `${workload.originalReplicas > 0 ? (workload.currentReplicas / workload.originalReplicas) * 100 : 0}%`,
            }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            style={{
              height: '100%',
              borderRadius: 4,
              backgroundColor: workload.status === 'sleeping' ? '#616161' : '#4CAF50',
            }}
          />
        </Box>
      </Box>
    </motion.div>
  )
}

function PanelsView({ workloads }: { workloads: Workload[] }) {
  return (
    <Box
      sx={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 1.5,
        p: 2,
        overflowY: 'auto',
        alignContent: 'start',
      }}
    >
      {workloads.map((w, i) => (
        <WorkloadCard key={w.name} workload={w} index={i} />
      ))}
    </Box>
  )
}

function CinematicView({
  progress,
  workloads,
  status,
}: {
  progress: number
  workloads: Workload[]
  status: ExecutionStatus
}) {
  const arcRadius = 120
  const circumference = 2 * Math.PI * arcRadius
  const dashOffset = circumference - (progress / 100) * circumference

  const sleepingCount = workloads.filter(w => w.status === 'sleeping').length
  const totalCount = workloads.length

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        bgcolor: '#050508',
        borderRadius: 2,
      }}
    >
      {status === 'completed' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.4, 0] }}
          transition={{ duration: 1.5 }}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle, rgba(255,152,0,0.3) 0%, transparent 70%)',
          }}
        />
      )}

      <Box sx={{ position: 'relative', width: 280, height: 280 }}>
        <svg width={280} height={280} viewBox="0 0 280 280" style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx={140}
            cy={140}
            r={arcRadius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={8}
          />
          <motion.circle
            cx={140}
            cy={140}
            r={arcRadius}
            fill="none"
            stroke="url(#progressGradient)"
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
          <defs>
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FF9800" />
              <stop offset="100%" stopColor="#4CAF50" />
            </linearGradient>
          </defs>
        </svg>

        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
          }}
        >
          <motion.div
            key={Math.round(progress)}
            initial={{ scale: 1.1, opacity: 0.7 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.15 }}
          >
            <Typography
              sx={{
                fontSize: 48,
                fontWeight: 800,
                fontFamily: '"JetBrains Mono", monospace',
                color: '#FFFFFF',
                lineHeight: 1,
              }}
            >
              {Math.round(progress)}%
            </Typography>
          </motion.div>
          <Typography sx={{ fontSize: 11, color: '#9E9E9E', mt: 0.5 }}>
            {sleepingCount} / {totalCount} workloads
          </Typography>
        </Box>
      </Box>

      <Box sx={{ mt: 4, display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'center', maxWidth: 400 }}>
        {workloads.map((w, i) => (
          <motion.div
            key={w.name}
            animate={{
              y: w.status === 'sleeping' ? [0, 80, 160] : 0,
              opacity: w.status === 'sleeping' ? [1, 0.6, 0] : 1,
              scale: w.status === 'sleeping' ? [1, 0.5, 0] : 1,
            }}
            transition={{
              duration: 1.2,
              delay: i * 0.05,
              ease: 'easeIn',
            }}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor:
                w.status === 'sleeping' ? '#616161' : w.status === 'scaling' ? '#FF9800' : '#4CAF50',
            }}
          />
        ))}
      </Box>

      {status === 'completed' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
        >
          <Typography
            sx={{
              mt: 4,
              fontSize: 20,
              fontWeight: 700,
              color: '#FF9800',
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            Execution Complete
          </Typography>
        </motion.div>
      )}
    </Box>
  )
}

function TopologyGrid({ workloads }: { workloads: Workload[] }) {
  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 1.5,
        p: 2,
        alignContent: 'start',
        overflowY: 'auto',
      }}
    >
      {workloads.map((w) => {
        const color =
          w.status === 'sleeping' ? '#616161' : w.status === 'scaling' ? '#FF9800' : '#4CAF50'
        return (
          <Box
            key={w.name}
            sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}
          >
            <motion.div
              animate={{
                backgroundColor: color,
                boxShadow: w.status === 'awake' ? `0 0 12px ${color}` : '0 0 0px transparent',
              }}
              transition={{ duration: 0.6 }}
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography sx={{ fontSize: 9, color: '#fff', fontWeight: 700 }}>
                {w.currentReplicas}
              </Typography>
            </motion.div>
            <Typography
              sx={{
                fontSize: 9,
                color: w.status === 'sleeping' ? '#757575' : '#BDBDBD',
                maxWidth: 60,
                textAlign: 'center',
                lineHeight: 1.2,
                textDecoration: w.status === 'sleeping' ? 'line-through' : 'none',
                transition: 'all 0.4s ease',
              }}
            >
              {w.name}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}

function SplitView({
  logLines,
  workloads,
}: {
  logLines: LogLine[]
  workloads: Workload[]
}) {
  return (
    <Box sx={{ flex: 1, display: 'flex', gap: 1.5, minHeight: 0 }}>
      <Box sx={{ width: '40%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <TerminalView logLines={logLines} workloads={workloads} />
      </Box>
      <Box sx={{ width: '60%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <TopologyGrid workloads={workloads} />
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function FlagshipTheaterPrototype() {
  const router = useRouter()

  const [mode, setMode] = useState<ViewMode>('terminal')
  const [direction, setDirection] = useState<Direction>('sleep')
  const [status, setStatus] = useState<ExecutionStatus>('idle')
  const [logLines, setLogLines] = useState<LogLine[]>([])
  const [workloads, setWorkloads] = useState<Workload[]>(structuredClone(INITIAL_WORKLOADS))
  const [progress, setProgress] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [speed, setSpeed] = useState(1)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const logIndexRef = useRef(0)
  const allLogsRef = useRef<Omit<LogLine, 'id' | 'timestamp'>[]>([])
  const lineIdRef = useRef(0)
  const startTimeRef = useRef(0)

  const clearTimers = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
    intervalRef.current = null
    timerRef.current = null
  }, [])

  useEffect(() => clearTimers, [clearTimers])

  const processLogLine = useCallback(
    (logDef: Omit<LogLine, 'id' | 'timestamp'>, currentIndex: number, totalLines: number) => {
      lineIdRef.current += 1
      const now = new Date()
      const timestamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`

      const newLine: LogLine = {
        id: lineIdRef.current,
        timestamp,
        level: logDef.level,
        message: logDef.message,
        workload: logDef.workload,
      }

      setLogLines(prev => [...prev, newLine])
      setProgress(Math.min(100, Math.round(((currentIndex + 1) / totalLines) * 100)))

      if (logDef.workload) {
        const isSleepDirection = direction === 'sleep'
        const isScaledMessage = logDef.message.includes('scaled to')

        setWorkloads(prev =>
          prev.map(w => {
            if (w.name !== logDef.workload) return w

            if (isScaledMessage) {
              return {
                ...w,
                currentReplicas: isSleepDirection ? 0 : w.originalReplicas,
                status: isSleepDirection ? 'sleeping' : 'awake',
              }
            }

            if (logDef.message.includes('Scaling')) {
              return { ...w, status: 'scaling' }
            }

            return w
          }),
        )
      }
    },
    [direction],
  )

  const startExecution = useCallback(
    (dir: Direction) => {
      clearTimers()

      setDirection(dir)
      setStatus('running')
      setLogLines([])
      setProgress(0)
      setElapsed(0)
      logIndexRef.current = 0
      lineIdRef.current = 0

      const freshWorkloads = structuredClone(INITIAL_WORKLOADS).map(w =>
        dir === 'wake' ? { ...w, currentReplicas: 0, status: 'sleeping' as WorkloadStatus } : w,
      )
      setWorkloads(freshWorkloads)

      const logs =
        dir === 'sleep'
          ? generateSleepLogs(INITIAL_WORKLOADS)
          : generateWakeLogs(INITIAL_WORKLOADS)
      allLogsRef.current = logs

      startTimeRef.current = Date.now()
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - startTimeRef.current)
      }, 200)

      const baseInterval = 300
      intervalRef.current = setInterval(() => {
        const idx = logIndexRef.current
        if (idx >= logs.length) {
          clearTimers()
          setStatus('completed')
          setProgress(100)
          return
        }
        processLogLine(logs[idx], idx, logs.length)
        logIndexRef.current += 1
      }, baseInterval / speed)
    },
    [clearTimers, processLogLine, speed],
  )

  const resetExecution = useCallback(() => {
    clearTimers()
    setStatus('idle')
    setLogLines([])
    setWorkloads(structuredClone(INITIAL_WORKLOADS))
    setProgress(0)
    setElapsed(0)
    logIndexRef.current = 0
  }, [clearTimers])

  const cycleSpeed = useCallback(() => {
    setSpeed(prev => {
      const next = prev === 1 ? 2 : prev === 2 ? 5 : 1
      if (intervalRef.current && status === 'running') {
        clearInterval(intervalRef.current)
        const baseInterval = 300
        intervalRef.current = setInterval(() => {
          const idx = logIndexRef.current
          if (idx >= allLogsRef.current.length) {
            clearTimers()
            setStatus('completed')
            setProgress(100)
            return
          }
          processLogLine(allLogsRef.current[idx], idx, allLogsRef.current.length)
          logIndexRef.current += 1
        }, baseInterval / next)
      }
      return next
    })
  }, [status, clearTimers, processLogLine])

  const statusColor =
    status === 'idle' ? '#9E9E9E' : status === 'running' ? '#2196F3' : '#4CAF50'
  const statusLabel =
    status === 'idle' ? 'STANDBY' : status === 'running' ? 'EXECUTING' : 'COMPLETE'

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0F0F13', color: '#E0E0E0', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 3, py: 2, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <IconButton onClick={() => router.push('/prototypes/')} sx={{ color: '#9E9E9E' }}>
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
            Execution Theater
          </Typography>
          <Typography variant="caption" sx={{ color: '#757575' }}>
            Mission-control execution viewer — 4 visualization modes
          </Typography>
        </Box>
      </Box>

      {/* Control bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 3,
          py: 1.5,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexWrap: 'wrap',
        }}
      >
        <Button
          variant="contained"
          size="small"
          startIcon={<NightsStayIcon />}
          disabled={status === 'running'}
          onClick={() => startExecution('sleep')}
          sx={{
            bgcolor: '#5C6BC0',
            textTransform: 'none',
            fontWeight: 600,
            '&:hover': { bgcolor: '#7986CB' },
            '&.Mui-disabled': { bgcolor: 'rgba(92, 107, 192, 0.3)' },
          }}
        >
          Start Sleep
        </Button>
        <Button
          variant="contained"
          size="small"
          startIcon={<WbSunnyIcon />}
          disabled={status === 'running'}
          onClick={() => startExecution('wake')}
          sx={{
            bgcolor: '#FF9800',
            color: '#1A1A1A',
            textTransform: 'none',
            fontWeight: 600,
            '&:hover': { bgcolor: '#FFB74D' },
            '&.Mui-disabled': { bgcolor: 'rgba(255, 152, 0, 0.3)' },
          }}
        >
          Start Wake
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<SpeedIcon />}
          onClick={cycleSpeed}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            borderColor: 'rgba(255,255,255,0.15)',
            color: '#E0E0E0',
          }}
        >
          {speed}x
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<ReplayIcon />}
          onClick={resetExecution}
          disabled={status === 'idle'}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            borderColor: 'rgba(255,255,255,0.15)',
            color: '#E0E0E0',
            '&.Mui-disabled': { borderColor: 'rgba(255,255,255,0.06)', color: '#616161' },
          }}
        >
          Reset
        </Button>
      </Box>

      {/* HUD bar — visible when not idle */}
      {status !== 'idle' && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              px: 3,
              py: 1,
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              bgcolor: 'rgba(255,255,255,0.02)',
              flexWrap: 'wrap',
            }}
          >
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#BDBDBD', fontFamily: 'monospace' }}>
              {POLICY_NAME}
            </Typography>

            <Chip
              icon={direction === 'sleep' ? <NightsStayIcon sx={{ fontSize: 14 }} /> : <WbSunnyIcon sx={{ fontSize: 14 }} />}
              label={direction === 'sleep' ? 'SLEEP ↓' : 'WAKE ↑'}
              size="small"
              sx={{
                fontWeight: 700,
                fontSize: 11,
                bgcolor: direction === 'sleep' ? 'rgba(92, 107, 192, 0.2)' : 'rgba(255, 152, 0, 0.2)',
                color: direction === 'sleep' ? '#9FA8DA' : '#FFB74D',
                borderColor: direction === 'sleep' ? '#5C6BC0' : '#FF9800',
                border: '1px solid',
              }}
            />

            <Typography sx={{ fontSize: 13, fontFamily: '"JetBrains Mono", monospace', color: '#BDBDBD' }}>
              {formatElapsed(elapsed)}
            </Typography>

            <Box sx={{ flex: 1, maxWidth: 200, minWidth: 100 }}>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: 'rgba(255,255,255,0.06)',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 3,
                    background: 'linear-gradient(90deg, #FF9800, #4CAF50)',
                    transition: 'transform 0.3s ease',
                  },
                }}
              />
            </Box>

            <Typography sx={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: '#BDBDBD' }}>
              {progress}%
            </Typography>

            <Chip
              label={statusLabel}
              size="small"
              sx={{
                fontWeight: 700,
                fontSize: 10,
                bgcolor: `${statusColor}20`,
                color: statusColor,
                border: `1px solid ${statusColor}`,
              }}
            />
          </Box>
        </motion.div>
      )}

      {/* Mode switcher */}
      <Box sx={{ px: 3, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Tabs
          value={mode}
          onChange={(_, v) => setMode(v)}
          sx={{
            minHeight: 40,
            '& .MuiTab-root': {
              minHeight: 40,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: 13,
              color: '#9E9E9E',
              '&.Mui-selected': { color: '#E0E0E0' },
            },
            '& .MuiTabs-indicator': {
              bgcolor: '#FF9800',
              height: 2,
            },
          }}
        >
          <Tab label="Terminal" value="terminal" />
          <Tab label="Panels" value="panels" />
          <Tab label="Cinematic" value="cinematic" />
          <Tab label="Split" value="split" />
        </Tabs>
      </Box>

      {/* Main view area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2, minHeight: 500 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
          >
            {mode === 'terminal' && (
              <TerminalView logLines={logLines} workloads={workloads} />
            )}
            {mode === 'panels' && <PanelsView workloads={workloads} />}
            {mode === 'cinematic' && (
              <CinematicView progress={progress} workloads={workloads} status={status} />
            )}
            {mode === 'split' && (
              <SplitView logLines={logLines} workloads={workloads} />
            )}
          </motion.div>
        </AnimatePresence>
      </Box>
    </Box>
  )
}
