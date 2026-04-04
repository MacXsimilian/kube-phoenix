'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Slider from '@mui/material/Slider'
import Card from '@mui/material/Card'
import Button from '@mui/material/Button'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import SkipNextIcon from '@mui/icons-material/SkipNext'
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious'
import NightsStayIcon from '@mui/icons-material/NightsStay'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import WarningIcon from '@mui/icons-material/Warning'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LogLevel = 'info' | 'ok' | 'warn' | 'error'
type EventType = 'start' | 'guardrail' | 'scale' | 'node' | 'verify' | 'complete' | 'error' | 'retry' | 'info'
type NodeStatus = 'Ready' | 'Cordoned' | 'Draining' | 'Deleted'
type WorkloadPhase = 'running' | 'scaling' | 'sleeping'
type Direction = 'sleep' | 'wake'
type ExecutionStatus = 'success' | 'warning' | 'failed'

interface TimelineEvent {
  id: number
  timeSeconds: number
  type: EventType
  level: LogLevel
  message: string
  workload?: string
  node?: string
  detail?: string
}

interface ExecutionRecord {
  id: string
  policyName: string
  direction: Direction
  timestamp: string
  status: ExecutionStatus
  durationSeconds: number
  events: TimelineEvent[]
}

interface WorkloadDef {
  name: string
  namespace: string
  replicas: number
  scaleStartTime: number
  scaleEndTime: number
}

interface NodeDef {
  name: string
  cordonTime: number
  drainTime: number
  deleteTime: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LEVEL_COLORS: Record<LogLevel, string> = {
  info: '#B0BEC5',
  ok: '#4CAF50',
  warn: '#FF9800',
  error: '#F44336',
}

const NODE_STATUS_COLORS: Record<NodeStatus, string> = {
  Ready: '#4CAF50',
  Cordoned: '#FF9800',
  Draining: '#FFC107',
  Deleted: '#616161',
}

const WORKLOAD_PHASE_COLORS: Record<WorkloadPhase, { border: string; bg: string; dot: string }> = {
  running: { border: '#4CAF50', bg: 'rgba(76, 175, 80, 0.08)', dot: '#4CAF50' },
  scaling: { border: '#FF9800', bg: 'rgba(255, 152, 0, 0.06)', dot: '#FF9800' },
  sleeping: { border: '#616161', bg: 'rgba(97, 97, 97, 0.04)', dot: '#616161' },
}

// ---------------------------------------------------------------------------
// Mock Data: Workloads and Nodes
// ---------------------------------------------------------------------------

const WORKLOADS: WorkloadDef[] = [
  { name: 'api-gateway', namespace: 'production', replicas: 3, scaleStartTime: 8, scaleEndTime: 11 },
  { name: 'web-frontend', namespace: 'production', replicas: 4, scaleStartTime: 11, scaleEndTime: 14 },
  { name: 'order-service', namespace: 'production', replicas: 2, scaleStartTime: 14, scaleEndTime: 17 },
  { name: 'payment-service', namespace: 'production', replicas: 2, scaleStartTime: 17, scaleEndTime: 20 },
  { name: 'inventory-service', namespace: 'production', replicas: 3, scaleStartTime: 20, scaleEndTime: 23 },
  { name: 'notification-svc', namespace: 'production', replicas: 1, scaleStartTime: 23, scaleEndTime: 26 },
  { name: 'auth-service', namespace: 'auth', replicas: 2, scaleStartTime: 26, scaleEndTime: 29 },
  { name: 'search-indexer', namespace: 'production', replicas: 2, scaleStartTime: 29, scaleEndTime: 32 },
  { name: 'cache-warmer', namespace: 'production', replicas: 1, scaleStartTime: 32, scaleEndTime: 35 },
  { name: 'metrics-collector', namespace: 'monitoring', replicas: 1, scaleStartTime: 35, scaleEndTime: 38 },
  { name: 'log-aggregator', namespace: 'monitoring', replicas: 2, scaleStartTime: 38, scaleEndTime: 41 },
  { name: 'ml-inference', namespace: 'production', replicas: 3, scaleStartTime: 41, scaleEndTime: 44 },
  { name: 'recommendation-engine', namespace: 'production', replicas: 2, scaleStartTime: 47, scaleEndTime: 50 },
  { name: 'data-pipeline', namespace: 'production', replicas: 1, scaleStartTime: 50, scaleEndTime: 53 },
  { name: 'report-generator', namespace: 'production', replicas: 1, scaleStartTime: 53, scaleEndTime: 56 },
  { name: 'email-worker', namespace: 'production', replicas: 2, scaleStartTime: 56, scaleEndTime: 59 },
]

const NODES: NodeDef[] = [
  { name: 'node-pool-a-x7k2m', cordonTime: 65, drainTime: 72, deleteTime: 79 },
  { name: 'node-pool-a-m3p9q', cordonTime: 80, drainTime: 87, deleteTime: 94 },
  { name: 'node-pool-b-k8r4n', cordonTime: 95, drainTime: 102, deleteTime: 109 },
  { name: 'node-pool-b-j2w6v', cordonTime: 110, drainTime: 117, deleteTime: 120 },
]

// ---------------------------------------------------------------------------
// Generate Events for Production Sleep
// ---------------------------------------------------------------------------

function generateSleepEvents(): TimelineEvent[] {
  const events: TimelineEvent[] = []
  let id = 0

  events.push({ id: id++, timeSeconds: 0, type: 'start', level: 'info', message: 'Execution started — production-sleep policy triggered' })
  events.push({ id: id++, timeSeconds: 2, type: 'guardrail', level: 'info', message: 'Guardrails evaluation started (5 rules)' })
  events.push({ id: id++, timeSeconds: 5, type: 'guardrail', level: 'ok', message: 'All guardrails passed — proceeding with sleep' })

  for (const wl of WORKLOADS) {
    events.push({
      id: id++,
      timeSeconds: wl.scaleStartTime,
      type: 'scale',
      level: 'info',
      message: `Scaling ${wl.name} from ${wl.replicas} to 0`,
      workload: wl.name,
    })

    if (wl.name === 'payment-service') {
      events.push({
        id: id++,
        timeSeconds: wl.scaleStartTime + 1,
        type: 'error',
        level: 'error',
        message: `Timeout scaling ${wl.name} — retrying (1/3)`,
        workload: wl.name,
        detail: 'Scale operation timed out after 30s. Pod termination grace period exceeded.',
      })
      events.push({
        id: id++,
        timeSeconds: wl.scaleStartTime + 2,
        type: 'retry',
        level: 'warn',
        message: `Retry succeeded for ${wl.name}`,
        workload: wl.name,
        detail: 'Retry with force termination succeeded.',
      })
    }

    events.push({
      id: id++,
      timeSeconds: wl.scaleEndTime,
      type: 'scale',
      level: 'ok',
      message: `${wl.name} scaled to 0 replicas`,
      workload: wl.name,
    })
  }

  events.push({ id: id++, timeSeconds: 62, type: 'info', level: 'info', message: 'All workloads scaled to zero — starting node drain' })

  for (const node of NODES) {
    events.push({ id: id++, timeSeconds: node.cordonTime, type: 'node', level: 'info', message: `Cordoning ${node.name}`, node: node.name })
    events.push({ id: id++, timeSeconds: node.drainTime, type: 'node', level: 'warn', message: `Draining ${node.name} (evicting pods)`, node: node.name })
    events.push({ id: id++, timeSeconds: node.deleteTime, type: 'node', level: 'ok', message: `${node.name} deleted from cluster`, node: node.name })
  }

  events.push({ id: id++, timeSeconds: 125, type: 'verify', level: 'info', message: 'Running post-sleep verification checks' })
  events.push({ id: id++, timeSeconds: 128, type: 'verify', level: 'ok', message: 'Verification passed — all resources at target state' })
  events.push({ id: id++, timeSeconds: 130, type: 'complete', level: 'ok', message: 'Execution completed successfully (2m 10s)' })

  return events.sort((a, b) => a.timeSeconds - b.timeSeconds)
}

// ---------------------------------------------------------------------------
// Other mock executions (simplified events)
// ---------------------------------------------------------------------------

function generateSimpleEvents(direction: Direction, duration: number, count: number): TimelineEvent[] {
  const events: TimelineEvent[] = []
  const step = duration / (count + 1)
  const label = direction === 'sleep' ? 'sleep' : 'wake'
  events.push({ id: 0, timeSeconds: 0, type: 'start', level: 'info', message: `Execution started — ${label}` })
  for (let i = 1; i <= count; i++) {
    const t = Math.round(step * i)
    events.push({ id: i, timeSeconds: t, type: 'scale', level: 'ok', message: `Workload batch ${i} ${label === 'sleep' ? 'scaled down' : 'restored'}` })
  }
  events.push({ id: count + 1, timeSeconds: duration, type: 'complete', level: 'ok', message: 'Execution completed' })
  return events
}

const EXECUTIONS: ExecutionRecord[] = [
  {
    id: 'exec-1',
    policyName: 'production-sleep',
    direction: 'sleep',
    timestamp: '2026-04-03 22:00:05',
    status: 'warning',
    durationSeconds: 130,
    events: generateSleepEvents(),
  },
  {
    id: 'exec-2',
    policyName: 'production-wake',
    direction: 'wake',
    timestamp: '2026-04-04 06:00:02',
    status: 'success',
    durationSeconds: 95,
    events: generateSimpleEvents('wake', 95, 8),
  },
  {
    id: 'exec-3',
    policyName: 'staging-sleep',
    direction: 'sleep',
    timestamp: '2026-04-03 20:00:01',
    status: 'success',
    durationSeconds: 72,
    events: generateSimpleEvents('sleep', 72, 6),
  },
  {
    id: 'exec-4',
    policyName: 'dev-sleep',
    direction: 'sleep',
    timestamp: '2026-04-03 19:30:00',
    status: 'success',
    durationSeconds: 45,
    events: generateSimpleEvents('sleep', 45, 4),
  },
  {
    id: 'exec-5',
    policyName: 'staging-wake',
    direction: 'wake',
    timestamp: '2026-04-04 07:00:00',
    status: 'failed',
    durationSeconds: 110,
    events: generateSimpleEvents('wake', 110, 5),
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function statusBadgeColor(status: ExecutionStatus): string {
  if (status === 'success') return '#4CAF50'
  if (status === 'warning') return '#FF9800'
  return '#F44336'
}

// ---------------------------------------------------------------------------
// Compute workload phase at a given time
// ---------------------------------------------------------------------------

function computeWorkloadPhase(wl: WorkloadDef, timeSeconds: number, direction: Direction): { phase: WorkloadPhase; replicas: number } {
  if (direction === 'wake') {
    if (timeSeconds < wl.scaleStartTime) return { phase: 'sleeping', replicas: 0 }
    if (timeSeconds >= wl.scaleEndTime) return { phase: 'running', replicas: wl.replicas }
    const progress = (timeSeconds - wl.scaleStartTime) / (wl.scaleEndTime - wl.scaleStartTime)
    return { phase: 'scaling', replicas: Math.round(progress * wl.replicas) }
  }
  if (timeSeconds < wl.scaleStartTime) return { phase: 'running', replicas: wl.replicas }
  if (timeSeconds >= wl.scaleEndTime) return { phase: 'sleeping', replicas: 0 }
  const progress = (timeSeconds - wl.scaleStartTime) / (wl.scaleEndTime - wl.scaleStartTime)
  return { phase: 'scaling', replicas: Math.max(0, Math.round(wl.replicas * (1 - progress))) }
}

function computeNodeStatus(node: NodeDef, timeSeconds: number): { status: NodeStatus; podCount: number } {
  if (timeSeconds < node.cordonTime) return { status: 'Ready', podCount: 12 }
  if (timeSeconds < node.drainTime) return { status: 'Cordoned', podCount: 12 }
  if (timeSeconds < node.deleteTime) {
    const progress = (timeSeconds - node.drainTime) / (node.deleteTime - node.drainTime)
    return { status: 'Draining', podCount: Math.max(0, Math.round(12 * (1 - progress))) }
  }
  return { status: 'Deleted', podCount: 0 }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ExecutionCard({
  exec,
  selected,
  onClick,
}: {
  exec: ExecutionRecord
  selected: boolean
  onClick: () => void
}) {
  return (
    <motion.div layoutId={`exec-card-${exec.id}`} style={{ position: 'relative' }}>
      <Card
        onClick={onClick}
        sx={{
          p: 1.5,
          minWidth: 200,
          cursor: 'pointer',
          border: '1px solid',
          borderColor: selected ? '#90CAF9' : 'rgba(255,255,255,0.08)',
          bgcolor: selected ? 'rgba(144,202,249,0.06)' : 'rgba(255,255,255,0.02)',
          transition: 'border-color 0.2s, background-color 0.2s',
          '&:hover': { borderColor: selected ? '#90CAF9' : 'rgba(255,255,255,0.2)' },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          {exec.direction === 'sleep' ? (
            <NightsStayIcon sx={{ fontSize: 16, color: '#7986CB' }} />
          ) : (
            <WbSunnyIcon sx={{ fontSize: 16, color: '#FFB74D' }} />
          )}
          <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff' }}>
            {exec.policyName}
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ color: '#9E9E9E', display: 'block', mb: 0.5 }}>
          {exec.timestamp}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={exec.status}
            size="small"
            sx={{
              height: 20,
              fontSize: 11,
              bgcolor: `${statusBadgeColor(exec.status)}22`,
              color: statusBadgeColor(exec.status),
              border: `1px solid ${statusBadgeColor(exec.status)}44`,
            }}
          />
          <Typography variant="caption" sx={{ color: '#9E9E9E' }}>
            {formatTime(exec.durationSeconds)}
          </Typography>
        </Box>
      </Card>
      {selected && (
        <motion.div
          layoutId="exec-selection-indicator"
          style={{
            position: 'absolute',
            bottom: -4,
            left: '20%',
            right: '20%',
            height: 3,
            borderRadius: 2,
            background: '#90CAF9',
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
    </motion.div>
  )
}

function EventMarker({
  event,
  totalDuration,
  onClick,
}: {
  event: TimelineEvent
  totalDuration: number
  onClick: () => void
}) {
  const position = (event.timeSeconds / totalDuration) * 100
  const color = event.level === 'error' ? '#F44336' : event.level === 'warn' ? '#FF9800' : '#4CAF50'

  return (
    <Box
      onClick={onClick}
      sx={{
        position: 'absolute',
        left: `${position}%`,
        top: -4,
        transform: 'translateX(-50%)',
        width: 8,
        height: 8,
        borderRadius: '50%',
        bgcolor: color,
        cursor: 'pointer',
        zIndex: 2,
        transition: 'transform 0.15s',
        '&:hover': { transform: 'translateX(-50%) scale(1.8)' },
      }}
    />
  )
}

function LogPanel({
  events,
  currentTime,
}: {
  events: TimelineEvent[]
  currentTime: number
}) {
  const visibleLogs = useMemo(
    () => events.filter((e) => e.timeSeconds <= currentTime),
    [events, currentTime],
  )

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [visibleLogs.length])

  return (
    <Box
      ref={containerRef}
      sx={{
        height: '100%',
        bgcolor: '#0D1117',
        borderRadius: 1,
        border: '1px solid rgba(255,255,255,0.06)',
        overflow: 'auto',
        p: 1.5,
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontSize: 12,
        lineHeight: 1.7,
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 2 },
      }}
    >
      <AnimatePresence mode="popLayout">
        {visibleLogs.map((log) => {
          const isCurrentEvent = Math.abs(log.timeSeconds - currentTime) < 0.5
          return (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.15 }}
            >
              <Box
                sx={{
                  display: 'flex',
                  gap: 1,
                  py: 0.25,
                  px: 0.5,
                  borderRadius: 0.5,
                  bgcolor: isCurrentEvent ? 'rgba(144,202,249,0.08)' : 'transparent',
                  transition: 'background-color 0.3s',
                }}
              >
                <Typography
                  component="span"
                  sx={{ color: '#546E7A', fontFamily: 'inherit', fontSize: 'inherit', whiteSpace: 'nowrap' }}
                >
                  {formatTime(log.timeSeconds)}
                </Typography>
                <Typography
                  component="span"
                  sx={{
                    color: LEVEL_COLORS[log.level],
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    fontWeight: log.level === 'error' ? 600 : 400,
                  }}
                >
                  {log.message}
                </Typography>
              </Box>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </Box>
  )
}

function WorkloadGrid({
  currentTime,
  direction,
}: {
  currentTime: number
  direction: Direction
}) {
  const workloadStates = useMemo(
    () =>
      WORKLOADS.map((wl) => {
        const state = computeWorkloadPhase(wl, currentTime, direction)
        return { ...wl, currentReplicas: state.replicas, phase: state.phase }
      }),
    [currentTime, direction],
  )

  return (
    <Box
      sx={{
        height: '100%',
        overflow: 'auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: 1,
        alignContent: 'start',
        p: 1,
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 2 },
      }}
    >
      {workloadStates.map((wl) => {
        const colors = WORKLOAD_PHASE_COLORS[wl.phase]
        const isChanging = wl.phase === 'scaling'
        return (
          <Box
            key={wl.name}
            sx={{
              p: 1,
              borderRadius: 1,
              border: '1px solid',
              borderColor: colors.border,
              bgcolor: colors.bg,
              transition: 'border-color 0.3s, background-color 0.3s, box-shadow 0.3s',
              boxShadow: isChanging ? `0 0 8px ${colors.border}44` : 'none',
              animation: isChanging ? 'pulse-border 1.5s ease-in-out infinite' : 'none',
              '@keyframes pulse-border': {
                '0%, 100%': { boxShadow: `0 0 4px ${colors.border}22` },
                '50%': { boxShadow: `0 0 12px ${colors.border}66` },
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: colors.dot,
                  transition: 'background-color 0.3s',
                  flexShrink: 0,
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  color: '#E0E0E0',
                  fontSize: 11,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {wl.name}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="caption" sx={{ color: '#78909C', fontSize: 10 }}>
                {wl.namespace}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: colors.dot,
                  fontWeight: 700,
                  fontSize: 11,
                  fontFamily: '"JetBrains Mono", monospace',
                  transition: 'color 0.3s',
                }}
              >
                {wl.currentReplicas}/{wl.replicas}
              </Typography>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

function NodeTimeline({
  currentTime,
}: {
  currentTime: number
}) {
  const nodeStates = useMemo(
    () => NODES.map((n) => ({ ...n, ...computeNodeStatus(n, currentTime) })),
    [currentTime],
  )

  return (
    <Box sx={{ height: '100%', overflow: 'auto', p: 1, position: 'relative' }}>
      <Box
        sx={{
          position: 'absolute',
          left: 16,
          top: 8,
          bottom: 8,
          width: 2,
          bgcolor: 'rgba(255,255,255,0.08)',
          borderRadius: 1,
        }}
      />
      {nodeStates.map((node, idx) => {
        const statusColor = NODE_STATUS_COLORS[node.status]
        const isDeleted = node.status === 'Deleted'
        return (
          <Box
            key={node.name}
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1.5,
              mb: 2,
              opacity: isDeleted ? 0.4 : 1,
              transition: 'opacity 0.5s',
            }}
          >
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: statusColor,
                mt: 0.8,
                flexShrink: 0,
                zIndex: 1,
                transition: 'background-color 0.3s',
                boxShadow: node.status === 'Draining' ? `0 0 6px ${statusColor}88` : 'none',
              }}
            />
            <Box
              sx={{
                flex: 1,
                p: 1.5,
                borderRadius: 1,
                border: '1px solid',
                borderColor: `${statusColor}44`,
                bgcolor: `${statusColor}08`,
                transition: 'border-color 0.3s, background-color 0.3s',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  color: '#E0E0E0',
                  fontSize: 11,
                  display: 'block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  mb: 0.5,
                }}
              >
                {node.name}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Chip
                  label={node.status}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: 10,
                    bgcolor: `${statusColor}22`,
                    color: statusColor,
                    border: `1px solid ${statusColor}44`,
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{ color: '#78909C', fontSize: 10, fontFamily: '"JetBrains Mono", monospace' }}
                >
                  {node.podCount} pods
                </Typography>
              </Box>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function FlagshipReplayPage() {
  const router = useRouter()
  const [selectedExecId, setSelectedExecId] = useState(EXECUTIONS[0].id)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [hoveredEvent, setHoveredEvent] = useState<TimelineEvent | null>(null)

  const animRef = useRef<number | null>(null)
  const lastFrameRef = useRef<number>(0)

  const selectedExec = useMemo(
    () => EXECUTIONS.find((e) => e.id === selectedExecId)!,
    [selectedExecId],
  )

  const significantEvents = useMemo(
    () => selectedExec.events.filter((e) => e.type !== 'start' || e.timeSeconds > 0),
    [selectedExec],
  )

  const eventTimes = useMemo(
    () => [...new Set(significantEvents.map((e) => e.timeSeconds))].sort((a, b) => a - b),
    [significantEvents],
  )

  const handleSelectExec = useCallback((id: string) => {
    setSelectedExecId(id)
    setCurrentTime(0)
    setIsPlaying(false)
    setHoveredEvent(null)
  }, [])

  const togglePlay = useCallback(() => {
    if (currentTime >= selectedExec.durationSeconds) {
      setCurrentTime(0)
    }
    setIsPlaying((prev) => !prev)
  }, [currentTime, selectedExec.durationSeconds])

  const stepForward = useCallback(() => {
    setIsPlaying(false)
    const next = eventTimes.find((t) => t > currentTime + 0.1)
    if (next !== undefined) setCurrentTime(next)
    else setCurrentTime(selectedExec.durationSeconds)
  }, [currentTime, eventTimes, selectedExec.durationSeconds])

  const stepBackward = useCallback(() => {
    setIsPlaying(false)
    const prev = [...eventTimes].reverse().find((t) => t < currentTime - 0.1)
    if (prev !== undefined) setCurrentTime(prev)
    else setCurrentTime(0)
  }, [currentTime, eventTimes])

  const cycleSpeed = useCallback(() => {
    setSpeed((prev) => {
      if (prev === 0.5) return 1
      if (prev === 1) return 2
      if (prev === 2) return 4
      return 0.5
    })
  }, [])

  // Play animation loop
  useEffect(() => {
    if (!isPlaying) {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      return
    }

    lastFrameRef.current = performance.now()

    const animate = (now: number) => {
      const delta = (now - lastFrameRef.current) / 1000
      lastFrameRef.current = now

      setCurrentTime((prev) => {
        const next = prev + delta * speed * 3
        if (next >= selectedExec.durationSeconds) {
          setIsPlaying(false)
          return selectedExec.durationSeconds
        }
        return next
      })

      animRef.current = requestAnimationFrame(animate)
    }

    animRef.current = requestAnimationFrame(animate)

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [isPlaying, speed, selectedExec.durationSeconds])

  const sliderValue = selectedExec.durationSeconds > 0 ? (currentTime / selectedExec.durationSeconds) * 100 : 0

  const handleSliderChange = useCallback(
    (_: Event, value: number | number[]) => {
      const pct = value as number
      setCurrentTime((pct / 100) * selectedExec.durationSeconds)
    },
    [selectedExec.durationSeconds],
  )

  const handleEventMarkerClick = useCallback(
    (event: TimelineEvent) => {
      setIsPlaying(false)
      setCurrentTime(event.timeSeconds)
      setHoveredEvent(event)
    },
    [],
  )

  // Auto-show event detail when playing passes an event
  const lastEventRef = useRef<number>(-1)
  useEffect(() => {
    if (!isPlaying) return
    const currentEvents = significantEvents.filter(
      (e) => e.timeSeconds <= currentTime && e.timeSeconds > currentTime - 0.8,
    )
    if (currentEvents.length > 0) {
      const latest = currentEvents[currentEvents.length - 1]
      if (latest.id !== lastEventRef.current) {
        lastEventRef.current = latest.id
        if (latest.type === 'error' || latest.type === 'complete' || latest.type === 'guardrail') {
          setHoveredEvent(latest)
          setTimeout(() => setHoveredEvent((prev) => (prev?.id === latest.id ? null : prev)), 2500)
        }
      }
    }
  }, [currentTime, isPlaying, significantEvents])

  const timeMarkers = useMemo(() => {
    const d = selectedExec.durationSeconds
    return [
      { pct: 0, label: formatTime(0) },
      { pct: 25, label: formatTime(d * 0.25) },
      { pct: 50, label: formatTime(d * 0.5) },
      { pct: 75, label: formatTime(d * 0.75) },
      { pct: 100, label: formatTime(d) },
    ]
  }, [selectedExec.durationSeconds])

  // Only show marker events for the detailed execution
  const markerEvents = useMemo(() => {
    const seen = new Set<number>()
    return significantEvents.filter((e) => {
      if (seen.has(e.timeSeconds)) return false
      seen.add(e.timeSeconds)
      return true
    })
  }, [significantEvents])

  const isDetailedExec = selectedExecId === 'exec-1'

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0A0E14', color: '#E0E0E0', p: 3, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small" sx={{ color: '#9E9E9E' }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
            FL6 — Execution Replay
          </Typography>
          <Typography variant="body2" sx={{ color: '#78909C' }}>
            Time-travel debugger for past executions. Scrub through the timeline to replay workload and node state changes.
          </Typography>
        </Box>
      </Box>

      {/* Execution Selector */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 3, overflowX: 'auto', pb: 1 }}>
        {EXECUTIONS.map((exec) => (
          <ExecutionCard
            key={exec.id}
            exec={exec}
            selected={exec.id === selectedExecId}
            onClick={() => handleSelectExec(exec.id)}
          />
        ))}
      </Box>

      {/* Timeline Scrubber */}
      <Box
        sx={{
          bgcolor: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 2,
          p: 2,
          mb: 2,
          position: 'relative',
        }}
      >
        {/* Event Detail Popup */}
        <AnimatePresence>
          {hoveredEvent && (
            <motion.div
              key={hoveredEvent.id}
              initial={{ opacity: 0, scale: 0.85, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 10 }}
              transition={{ duration: 0.2 }}
              style={{
                position: 'absolute',
                top: -80,
                left: `${(hoveredEvent.timeSeconds / selectedExec.durationSeconds) * 100}%`,
                transform: 'translateX(-50%)',
                zIndex: 10,
              }}
            >
              <Card
                sx={{
                  p: 1.5,
                  minWidth: 220,
                  bgcolor: '#1A1F2E',
                  border: `1px solid ${LEVEL_COLORS[hoveredEvent.level]}44`,
                  boxShadow: `0 4px 20px rgba(0,0,0,0.5)`,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                  {hoveredEvent.level === 'error' && <ErrorIcon sx={{ fontSize: 14, color: '#F44336' }} />}
                  {hoveredEvent.level === 'warn' && <WarningIcon sx={{ fontSize: 14, color: '#FF9800' }} />}
                  {hoveredEvent.level === 'ok' && <CheckCircleIcon sx={{ fontSize: 14, color: '#4CAF50' }} />}
                  <Typography variant="caption" sx={{ fontWeight: 600, color: LEVEL_COLORS[hoveredEvent.level], fontSize: 11 }}>
                    {hoveredEvent.type.toUpperCase()}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#78909C', fontSize: 10, ml: 'auto' }}>
                    {formatTime(hoveredEvent.timeSeconds)}
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: '#B0BEC5', fontSize: 11, display: 'block' }}>
                  {hoveredEvent.message}
                </Typography>
                {hoveredEvent.detail && (
                  <Typography variant="caption" sx={{ color: '#78909C', fontSize: 10, display: 'block', mt: 0.5 }}>
                    {hoveredEvent.detail}
                  </Typography>
                )}
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Event Markers */}
        <Box sx={{ position: 'relative', height: 16, mx: 1 }}>
          {markerEvents.map((event) => (
            <EventMarker
              key={event.id}
              event={event}
              totalDuration={selectedExec.durationSeconds}
              onClick={() => handleEventMarkerClick(event)}
            />
          ))}
        </Box>

        {/* Slider */}
        <Box sx={{ px: 1 }}>
          <Slider
            value={sliderValue}
            onChange={handleSliderChange}
            min={0}
            max={100}
            step={0.1}
            sx={{
              color: '#90CAF9',
              height: 6,
              '& .MuiSlider-thumb': {
                width: 16,
                height: 16,
                bgcolor: '#fff',
                boxShadow: '0 0 8px rgba(144,202,249,0.6)',
                '&:hover, &.Mui-focusVisible': { boxShadow: '0 0 12px rgba(144,202,249,0.8)' },
              },
              '& .MuiSlider-track': { bgcolor: '#90CAF9' },
              '& .MuiSlider-rail': { bgcolor: 'rgba(255,255,255,0.1)' },
            }}
          />
        </Box>

        {/* Time Markers */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1, mb: 1.5 }}>
          {timeMarkers.map((m) => (
            <Typography key={m.pct} variant="caption" sx={{ color: '#546E7A', fontSize: 10 }}>
              {m.label}
            </Typography>
          ))}
        </Box>

        {/* Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
          <IconButton onClick={stepBackward} size="small" sx={{ color: '#B0BEC5' }}>
            <SkipPreviousIcon fontSize="small" />
          </IconButton>
          <IconButton
            onClick={togglePlay}
            size="small"
            sx={{
              color: '#fff',
              bgcolor: 'rgba(144,202,249,0.15)',
              '&:hover': { bgcolor: 'rgba(144,202,249,0.25)' },
              width: 36,
              height: 36,
            }}
          >
            {isPlaying ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
          </IconButton>
          <IconButton onClick={stepForward} size="small" sx={{ color: '#B0BEC5' }}>
            <SkipNextIcon fontSize="small" />
          </IconButton>

          <Box sx={{ width: 1, height: 20, bgcolor: 'rgba(255,255,255,0.1)', mx: 1 }} />

          <Button
            onClick={cycleSpeed}
            size="small"
            sx={{
              color: '#90CAF9',
              fontSize: 12,
              minWidth: 48,
              textTransform: 'none',
              border: '1px solid rgba(144,202,249,0.2)',
            }}
          >
            {speed}x
          </Button>

          <Box sx={{ width: 1, height: 20, bgcolor: 'rgba(255,255,255,0.1)', mx: 1 }} />

          <Typography
            variant="body2"
            sx={{
              color: '#E0E0E0',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {formatTime(currentTime)} / {formatTime(selectedExec.durationSeconds)}
          </Typography>
        </Box>
      </Box>

      {/* Replay Panels */}
      <Box sx={{ display: 'flex', gap: 2, flex: 1, minHeight: 400 }}>
        {/* Panel A: Log Replay */}
        <Box sx={{ width: '35%', display: 'flex', flexDirection: 'column' }}>
          <Typography variant="caption" sx={{ color: '#78909C', mb: 0.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, fontSize: 10 }}>
            Log Replay
          </Typography>
          <Box sx={{ flex: 1 }}>
            <LogPanel events={selectedExec.events} currentTime={currentTime} />
          </Box>
        </Box>

        {/* Panel B: Workload State Grid */}
        <Box sx={{ width: '40%', display: 'flex', flexDirection: 'column' }}>
          <Typography variant="caption" sx={{ color: '#78909C', mb: 0.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, fontSize: 10 }}>
            Workload State
          </Typography>
          <Box
            sx={{
              flex: 1,
              bgcolor: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 1,
              overflow: 'hidden',
            }}
          >
            {isDetailedExec ? (
              <WorkloadGrid currentTime={currentTime} direction={selectedExec.direction} />
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography variant="body2" sx={{ color: '#546E7A' }}>
                  Detailed workload view available for production-sleep execution
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* Panel C: Node Timeline */}
        <Box sx={{ width: '25%', display: 'flex', flexDirection: 'column' }}>
          <Typography variant="caption" sx={{ color: '#78909C', mb: 0.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, fontSize: 10 }}>
            Node Timeline
          </Typography>
          <Box
            sx={{
              flex: 1,
              bgcolor: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 1,
              overflow: 'hidden',
            }}
          >
            {isDetailedExec ? (
              <NodeTimeline currentTime={currentTime} />
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography variant="body2" sx={{ color: '#546E7A', textAlign: 'center', px: 2 }}>
                  Detailed node view available for production-sleep execution
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
