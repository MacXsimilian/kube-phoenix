'use client'

// PROTOTYPE: Real-Time Incident Cinema
// DEPS: framer-motion gsap
// LIBS: Framer Motion, GSAP, CSS 3D transforms
// DATA: Execution events, error states, guardrail violations
// DESCRIPTION: Cinematic replay of failed policy executions with dramatic scene transitions

import { useState, useRef, useCallback, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Slider from '@mui/material/Slider'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import SkipNextIcon from '@mui/icons-material/SkipNext'
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import ShieldIcon from '@mui/icons-material/Shield'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import StorageIcon from '@mui/icons-material/Storage'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IncidentEvent {
  id: string
  timestamp: string
  type: 'execution_start' | 'drain_failed' | 'guardrail_block' | 'interrupted' | 'recovered'
  title: string
  description: string
  affectedWorkloads: string[]
  severity: 'info' | 'warning' | 'critical'
}

interface WorkloadPanel {
  name: string
  namespace: string
  replicas: number
  status: 'running' | 'warning' | 'error' | 'recovering' | 'protected'
}

interface LogEntry {
  time: string
  message: string
  level: 'info' | 'warn' | 'error'
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const INCIDENT_EVENTS: IncidentEvent[] = [
  {
    id: 'evt-001',
    timestamp: '2026-04-03T19:00:00Z',
    type: 'execution_start',
    title: 'Execution Began',
    description: 'Non-production sleep policy triggered for staging namespace. Scaling down workloads and draining idle nodes.',
    affectedWorkloads: ['staging-api', 'staging-worker', 'staging-redis', 'staging-postgres'],
    severity: 'info',
  },
  {
    id: 'evt-002',
    timestamp: '2026-04-03T19:00:47Z',
    type: 'drain_failed',
    title: 'Node Drain Failed',
    description: 'Node ip-10-0-2-61 drain timed out. Pod staging-worker-7f8b9c stuck in Terminating state — finalizer blocking deletion.',
    affectedWorkloads: ['staging-worker'],
    severity: 'critical',
  },
  {
    id: 'evt-003',
    timestamp: '2026-04-03T19:01:12Z',
    type: 'guardrail_block',
    title: 'Guardrail Blocked',
    description: 'Scale-down of staging-api blocked by min-replicas guardrail. Current replicas: 2, minimum required: 2. Guardrail policy: protect-staging-api.',
    affectedWorkloads: ['staging-api'],
    severity: 'warning',
  },
  {
    id: 'evt-004',
    timestamp: '2026-04-03T19:01:58Z',
    type: 'interrupted',
    title: 'Execution Interrupted',
    description: 'Execution halted due to cascading failures. Node drain failure and guardrail violation triggered automatic interruption. Partial state — manual review required.',
    affectedWorkloads: ['staging-api', 'staging-worker', 'staging-redis', 'staging-postgres'],
    severity: 'critical',
  },
  {
    id: 'evt-005',
    timestamp: '2026-04-03T19:03:22Z',
    type: 'recovered',
    title: 'State Recovered',
    description: 'Scheduler reconciled cluster state. All workloads restored to pre-execution replica counts. Node ip-10-0-2-61 uncordoned. Cluster healthy.',
    affectedWorkloads: ['staging-api', 'staging-worker', 'staging-redis', 'staging-postgres'],
    severity: 'info',
  },
]

const INITIAL_WORKLOADS: WorkloadPanel[] = [
  { name: 'staging-api', namespace: 'staging', replicas: 2, status: 'running' },
  { name: 'staging-worker', namespace: 'staging', replicas: 3, status: 'running' },
  { name: 'staging-redis', namespace: 'staging', replicas: 1, status: 'running' },
  { name: 'staging-postgres', namespace: 'staging', replicas: 1, status: 'running' },
]

const ERROR_LOG_LINES: LogEntry[] = [
  { time: '19:00:42', message: 'kubectl drain ip-10-0-2-61 --timeout=30s', level: 'info' },
  { time: '19:00:44', message: 'evicting pod staging/staging-worker-7f8b9c', level: 'info' },
  { time: '19:00:47', message: 'error: pod staging-worker-7f8b9c has finalizer blocking deletion', level: 'error' },
  { time: '19:00:47', message: 'error: unable to drain node ip-10-0-2-61, aborting', level: 'error' },
]

// ---------------------------------------------------------------------------
// Scene Camera Transforms
// ---------------------------------------------------------------------------

const SCENE_CAMERAS: Record<string, React.CSSProperties> = {
  execution_start: { transform: 'perspective(1200px) rotateY(0deg) translateZ(0px)' },
  drain_failed: { transform: 'perspective(1200px) rotateY(-3deg) translateZ(30px)' },
  guardrail_block: { transform: 'perspective(1200px) rotateY(3deg) translateZ(20px)' },
  interrupted: { transform: 'perspective(1200px) rotateY(0deg) translateZ(-20px)' },
  recovered: { transform: 'perspective(1200px) rotateY(0deg) translateZ(10px)' },
}

const SEVERITY_COLORS: Record<string, string> = {
  info: '#42A5F5',
  warning: '#FF9800',
  critical: '#F44336',
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TitleCard({ visible, containerRef }: { visible: boolean; containerRef: React.RefObject<HTMLDivElement | null> }) {
  const lettersRef = useRef<HTMLSpanElement[]>([])
  const text = 'INCIDENT DETECTED'

  useEffect(() => {
    if (!visible || lettersRef.current.length === 0) return
    const timeline = gsap.timeline()
    lettersRef.current.forEach((el) => {
      if (el) gsap.set(el, { opacity: 0, color: '#FF6B35' })
    })
    timeline.to(lettersRef.current.filter(Boolean), {
      opacity: 1,
      color: '#FF1744',
      textShadow: '0 0 20px rgba(255,23,68,0.8), 0 0 40px rgba(255,23,68,0.4)',
      duration: 0.08,
      stagger: 0.04,
      ease: 'power2.out',
    })
    timeline.to(lettersRef.current.filter(Boolean), {
      color: '#FFFFFF',
      textShadow: '0 0 10px rgba(255,23,68,0.6), 0 0 30px rgba(255,23,68,0.3)',
      duration: 0.6,
      delay: 0.3,
      ease: 'power1.out',
    })
    return () => { timeline.kill() }
  }, [visible])

  if (!visible) return null

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
        bgcolor: 'rgba(0,0,0,0.85)',
      }}
    >
      <Typography
        sx={{
          fontSize: { xs: 32, md: 56 },
          fontWeight: 900,
          letterSpacing: 8,
          fontFamily: 'monospace',
        }}
      >
        {text.split('').map((char, index) => (
          <span
            key={index}
            ref={(el) => { if (el) lettersRef.current[index] = el }}
            style={{ opacity: 0, display: 'inline-block' }}
          >
            {char === ' ' ? '\u00A0' : char}
          </span>
        ))}
      </Typography>
    </Box>
  )
}

function WorkloadGrid({ workloads, shakeNodeRef }: {
  workloads: WorkloadPanel[]
  shakeNodeRef: React.RefObject<HTMLDivElement | null>
}) {
  const statusColors: Record<string, string> = {
    running: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',
    recovering: '#42A5F5',
    protected: '#AB47BC',
  }

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
      {workloads.map((wl) => (
        <Box
          key={wl.name}
          sx={{
            p: 2,
            borderRadius: 2,
            border: '1px solid',
            borderColor: statusColors[wl.status] + '60',
            bgcolor: statusColors[wl.status] + '10',
            transition: 'all 0.3s',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Box sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: statusColors[wl.status],
              boxShadow: `0 0 8px ${statusColors[wl.status]}80`,
            }} />
            <Typography variant="body2" fontWeight={700} sx={{ fontFamily: 'monospace' }}>
              {wl.name}
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {wl.namespace} · {wl.replicas} replica{wl.replicas !== 1 ? 's' : ''}
          </Typography>
          <Chip
            label={wl.status.toUpperCase()}
            size="small"
            sx={{
              mt: 1,
              height: 20,
              fontSize: 10,
              fontWeight: 700,
              bgcolor: statusColors[wl.status] + '20',
              color: statusColors[wl.status],
              letterSpacing: 1,
            }}
          />
        </Box>
      ))}
    </Box>
  )
}

function NodePanel({ status, nodeRef }: {
  status: 'healthy' | 'failing' | 'cordoned' | 'recovered'
  nodeRef: React.RefObject<HTMLDivElement | null>
}) {
  const nodeColors = {
    healthy: '#4CAF50',
    failing: '#F44336',
    cordoned: '#FF9800',
    recovered: '#4CAF50',
  }
  const color = nodeColors[status]

  return (
    <Box
      ref={nodeRef}
      sx={{
        p: 2,
        borderRadius: 2,
        border: `2px solid ${color}`,
        bgcolor: color + '10',
        transition: 'border-color 0.3s, background-color 0.3s',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <StorageIcon sx={{ fontSize: 18, color }} />
        <Typography variant="body2" fontWeight={700} sx={{ fontFamily: 'monospace' }}>
          ip-10-0-2-61
        </Typography>
      </Box>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        m5.xlarge · us-east-1b
      </Typography>
      <Box sx={{ mt: 1 }}>
        <Chip
          label={status.toUpperCase()}
          size="small"
          sx={{
            height: 20,
            fontSize: 10,
            fontWeight: 700,
            bgcolor: color + '20',
            color,
            letterSpacing: 1,
          }}
        />
      </Box>
    </Box>
  )
}

function ErrorLogStream({ lines, visible }: { lines: LogEntry[]; visible: boolean }) {
  if (!visible) return null

  return (
    <Box sx={{
      mt: 2,
      p: 1.5,
      borderRadius: 1,
      bgcolor: 'rgba(0,0,0,0.6)',
      border: '1px solid rgba(244,67,54,0.3)',
      fontFamily: 'monospace',
      fontSize: 11,
      maxHeight: 120,
      overflow: 'auto',
    }}>
      {lines.map((line, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.15, duration: 0.3 }}
        >
          <Box sx={{ display: 'flex', gap: 1, py: 0.25 }}>
            <Typography component="span" sx={{
              fontSize: 11,
              fontFamily: 'monospace',
              color: 'text.secondary',
              flexShrink: 0,
            }}>
              {line.time}
            </Typography>
            <Typography component="span" sx={{
              fontSize: 11,
              fontFamily: 'monospace',
              color: line.level === 'error' ? '#F44336' : line.level === 'warn' ? '#FF9800' : '#B0BEC5',
            }}>
              {line.message}
            </Typography>
          </Box>
        </motion.div>
      ))}
    </Box>
  )
}

function ShieldSlam({ visible, shieldRef }: {
  visible: boolean
  shieldRef: React.RefObject<HTMLDivElement | null>
}) {
  useEffect(() => {
    if (!visible || !shieldRef.current) return
    const timeline = gsap.timeline()
    timeline.fromTo(shieldRef.current,
      { scale: 3, opacity: 0, rotation: -15 },
      { scale: 1, opacity: 1, rotation: 0, duration: 0.4, ease: 'back.out(2)' },
    )
    timeline.to(shieldRef.current, {
      y: -5,
      duration: 0.8,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    })
    return () => { timeline.kill() }
  }, [visible, shieldRef])

  if (!visible) return null

  return (
    <Box
      ref={shieldRef}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        mb: 2,
      }}
    >
      <ShieldIcon sx={{
        fontSize: 64,
        color: '#FF9800',
        filter: 'drop-shadow(0 0 16px rgba(255,152,0,0.6))',
      }} />
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Scene Content Components
// ---------------------------------------------------------------------------

function SceneExecutionStart({ workloads }: { workloads: WorkloadPanel[] }) {
  return (
    <Box>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Non-production sleep policy triggered for <strong>staging</strong> namespace at 19:00 UTC.
      </Typography>
      <WorkloadGrid workloads={workloads} shakeNodeRef={{ current: null }} />
    </Box>
  )
}

function SceneDrainFailed({ nodeRef }: { nodeRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <Box>
      <NodePanel status="failing" nodeRef={nodeRef} />
      <ErrorLogStream lines={ERROR_LOG_LINES} visible />
    </Box>
  )
}

function SceneGuardrailBlock({ shieldRef }: { shieldRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <Box>
      <ShieldSlam visible shieldRef={shieldRef} />
      <Box sx={{
        p: 2,
        borderRadius: 2,
        border: '1px solid rgba(255,152,0,0.4)',
        bgcolor: 'rgba(255,152,0,0.06)',
      }}>
        <Typography variant="body2" fontWeight={600} sx={{ color: '#FF9800', mb: 1 }}>
          Guardrail: protect-staging-api
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          staging-api requires minimum 2 replicas. Scale-down rejected.
        </Typography>
      </Box>
    </Box>
  )
}

function SceneInterrupted({ workloads }: { workloads: WorkloadPanel[] }) {
  return (
    <Box>
      <Box sx={{
        p: 2,
        borderRadius: 2,
        border: '1px solid rgba(255,152,0,0.4)',
        bgcolor: 'rgba(255,152,0,0.06)',
        mb: 2,
        textAlign: 'center',
      }}>
        <WarningAmberIcon sx={{ fontSize: 40, color: '#FF9800', mb: 1 }} />
        <Typography variant="body2" fontWeight={600} sx={{ color: '#FF9800' }}>
          EXECUTION HALTED
        </Typography>
      </Box>
      <WorkloadGrid workloads={workloads} shakeNodeRef={{ current: null }} />
    </Box>
  )
}

function SceneRecovered({ workloads, nodeRef }: {
  workloads: WorkloadPanel[]
  nodeRef: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <Box>
      <Box sx={{
        p: 2,
        borderRadius: 2,
        border: '1px solid rgba(76,175,80,0.4)',
        bgcolor: 'rgba(76,175,80,0.06)',
        mb: 2,
        textAlign: 'center',
      }}>
        <CheckCircleIcon sx={{ fontSize: 40, color: '#4CAF50', mb: 1 }} />
        <Typography variant="body2" fontWeight={600} sx={{ color: '#4CAF50' }}>
          STATE RECOVERED
        </Typography>
      </Box>
      <NodePanel status="recovered" nodeRef={nodeRef} />
      <Box sx={{ mt: 2 }}>
        <WorkloadGrid workloads={workloads} shakeNodeRef={{ current: null }} />
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function IncidentCinemaPrototype() {
  const router = useRouter()

  const [phase, setPhase] = useState<'idle' | 'title' | 'scenes' | 'ended'>('idle')
  const [sceneIndex, setSceneIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [redAlert, setRedAlert] = useState(false)

  const vignetteRef = useRef<HTMLDivElement>(null)
  const titleCardRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const nodeRef = useRef<HTMLDivElement>(null)
  const shieldRef = useRef<HTMLDivElement>(null)
  const timelinesRef = useRef<gsap.core.Timeline[]>([])
  const sceneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number | null>(null)

  const currentEvent = INCIDENT_EVENTS[sceneIndex]

  const workloadsForScene = useCallback((index: number): WorkloadPanel[] => {
    const base = INITIAL_WORKLOADS.map((w) => ({ ...w }))
    if (index >= 1) {
      const worker = base.find((w) => w.name === 'staging-worker')
      if (worker) { worker.status = 'error'; worker.replicas = 2 }
    }
    if (index >= 2) {
      const api = base.find((w) => w.name === 'staging-api')
      if (api) api.status = 'protected'
    }
    if (index >= 3) {
      base.forEach((w) => { if (w.status !== 'protected') w.status = 'warning' })
    }
    if (index >= 4) {
      base.forEach((w) => { w.status = 'running'; w.replicas = INITIAL_WORKLOADS.find((o) => o.name === w.name)?.replicas ?? w.replicas })
    }
    return base
  }, [])

  const killTimelines = useCallback(() => {
    timelinesRef.current.forEach((tl) => tl.kill())
    timelinesRef.current = []
    if (sceneTimerRef.current) clearTimeout(sceneTimerRef.current)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }, [])

  const animateVignette = useCallback((show: boolean) => {
    if (!vignetteRef.current) return
    const tl = gsap.timeline()
    timelinesRef.current.push(tl)
    tl.to(vignetteRef.current, {
      opacity: show ? 1 : 0,
      duration: 0.8 / speed,
      ease: 'power2.inOut',
    })
  }, [speed])

  const animateCameraMove = useCallback((sceneType: string) => {
    if (!stageRef.current) return
    const target = SCENE_CAMERAS[sceneType] ?? SCENE_CAMERAS.execution_start
    const tl = gsap.timeline()
    timelinesRef.current.push(tl)
    tl.to(stageRef.current, {
      ...target,
      duration: 0.6 / speed,
      ease: 'power2.out',
    })
  }, [speed])

  const shakeNode = useCallback(() => {
    if (!nodeRef.current) return
    const tl = gsap.timeline()
    timelinesRef.current.push(tl)
    tl.to(nodeRef.current, { x: -6, duration: 0.05, yoyo: true, repeat: 7, ease: 'power2.inOut' })
  }, [])

  const advanceScene = useCallback(() => {
    setSceneIndex((prev) => {
      const next = prev + 1
      if (next >= INCIDENT_EVENTS.length) {
        setPhase('ended')
        setIsPlaying(false)
        setRedAlert(false)
        return prev
      }
      const nextEvent = INCIDENT_EVENTS[next]
      animateCameraMove(nextEvent.type)
      setRedAlert(nextEvent.severity === 'critical')
      if (nextEvent.type === 'drain_failed') {
        rafRef.current = requestAnimationFrame(() => shakeNode())
      }
      return next
    })
  }, [animateCameraMove, shakeNode])

  const scheduleNextScene = useCallback(() => {
    if (!isPlaying) return
    const delay = 3500 / speed
    sceneTimerRef.current = setTimeout(() => {
      advanceScene()
    }, delay)
  }, [isPlaying, speed, advanceScene])

  useEffect(() => {
    if (phase === 'scenes' && isPlaying) {
      scheduleNextScene()
    }
    return () => {
      if (sceneTimerRef.current) clearTimeout(sceneTimerRef.current)
    }
  }, [phase, isPlaying, sceneIndex, scheduleNextScene])

  const startCinema = useCallback(() => {
    killTimelines()
    setPhase('title')
    setSceneIndex(0)
    setIsPlaying(true)
    setRedAlert(false)
    animateVignette(true)

    const titleDuration = 2200 / speed
    sceneTimerRef.current = setTimeout(() => {
      setPhase('scenes')
      animateCameraMove('execution_start')
    }, titleDuration)
  }, [killTimelines, animateVignette, animateCameraMove, speed])

  const handleReset = useCallback(() => {
    killTimelines()
    setPhase('idle')
    setSceneIndex(0)
    setIsPlaying(false)
    setRedAlert(false)
    animateVignette(false)
    if (stageRef.current) {
      gsap.set(stageRef.current, { transform: 'perspective(1200px) rotateY(0deg) translateZ(0px)' })
    }
  }, [killTimelines, animateVignette])

  const handlePlayPause = useCallback(() => {
    if (phase === 'idle' || phase === 'ended') {
      startCinema()
      return
    }
    setIsPlaying((prev) => !prev)
  }, [phase, startCinema])

  const handleSkipNext = useCallback(() => {
    if (sceneTimerRef.current) clearTimeout(sceneTimerRef.current)
    if (phase === 'title') {
      setPhase('scenes')
      animateCameraMove('execution_start')
      return
    }
    advanceScene()
  }, [phase, advanceScene, animateCameraMove])

  const handleSkipPrev = useCallback(() => {
    if (sceneTimerRef.current) clearTimeout(sceneTimerRef.current)
    setSceneIndex((prev) => {
      const next = Math.max(0, prev - 1)
      const event = INCIDENT_EVENTS[next]
      animateCameraMove(event.type)
      setRedAlert(event.severity === 'critical')
      return next
    })
  }, [animateCameraMove])

  useEffect(() => {
    return () => { killTimelines() }
  }, [killTimelines])

  const renderSceneContent = useCallback(() => {
    if (!currentEvent) return null
    switch (currentEvent.type) {
      case 'execution_start':
        return <SceneExecutionStart workloads={workloadsForScene(0)} />
      case 'drain_failed':
        return <SceneDrainFailed nodeRef={nodeRef} />
      case 'guardrail_block':
        return <SceneGuardrailBlock shieldRef={shieldRef} />
      case 'interrupted':
        return <SceneInterrupted workloads={workloadsForScene(3)} />
      case 'recovered':
        return <SceneRecovered workloads={workloadsForScene(4)} nodeRef={nodeRef} />
      default:
        return null
    }
  }, [currentEvent, workloadsForScene])

  const severityIcon = currentEvent?.severity === 'critical'
    ? <ErrorOutlineIcon sx={{ fontSize: 18, color: SEVERITY_COLORS[currentEvent.severity] }} />
    : currentEvent?.severity === 'warning'
      ? <WarningAmberIcon sx={{ fontSize: 18, color: SEVERITY_COLORS[currentEvent.severity] }} />
      : <CheckCircleIcon sx={{ fontSize: 18, color: SEVERITY_COLORS[currentEvent?.severity ?? 'info'] }} />

  return (
    <Box sx={{
      position: 'relative',
      minHeight: '100vh',
      bgcolor: 'background.default',
      overflow: 'hidden',
    }}>
      {/* Vignette overlay */}
      <Box
        ref={vignetteRef}
        sx={{
          position: 'fixed',
          inset: 0,
          opacity: 0,
          pointerEvents: 'none',
          zIndex: 5,
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)',
        }}
      />

      {/* Red Alert Overlays */}
      {redAlert && (
        <>
          {/* Chromatic aberration */}
          <Box sx={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 6,
            background: 'linear-gradient(90deg, rgba(255,0,0,0.03) 0%, transparent 30%, transparent 70%, rgba(0,0,255,0.03) 100%)',
            mixBlendMode: 'screen',
          }} />
          {/* Scanlines */}
          <Box sx={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 6,
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)',
          }} />
          {/* Pulsing red border */}
          <Box sx={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 6,
            border: '2px solid',
            borderColor: 'rgba(244,67,54,0.6)',
            animation: 'redPulse 1.5s ease-in-out infinite',
            '@keyframes redPulse': {
              '0%, 100%': { borderColor: 'rgba(244,67,54,0.2)', boxShadow: 'inset 0 0 30px rgba(244,67,54,0.05)' },
              '50%': { borderColor: 'rgba(244,67,54,0.7)', boxShadow: 'inset 0 0 60px rgba(244,67,54,0.15)' },
            },
          }} />
        </>
      )}

      {/* Title Card */}
      <TitleCard visible={phase === 'title'} containerRef={titleCardRef} />

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2, position: 'relative', zIndex: 8 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>FL17 — Incident Cinema</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Cinematic replay of failed policy executions
          </Typography>
        </Box>
        {phase !== 'idle' && (
          <Chip
            label={`SCENE ${sceneIndex + 1} / ${INCIDENT_EVENTS.length}`}
            size="small"
            sx={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: 1 }}
          />
        )}
      </Box>

      {/* Main Stage */}
      <Box sx={{
        maxWidth: 900,
        mx: 'auto',
        px: 3,
        pt: 4,
        pb: 16,
        position: 'relative',
        zIndex: 7,
      }}>
        {phase === 'idle' && (
          <Box sx={{
            textAlign: 'center',
            py: 12,
          }}>
            <ErrorOutlineIcon sx={{ fontSize: 80, color: 'text.disabled', mb: 3 }} />
            <Typography variant="h4" fontWeight={800} sx={{ mb: 2 }}>
              Incident Replay
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4, maxWidth: 500, mx: 'auto' }}>
              Cinematic walkthrough of a failed non-production sleep execution on the staging namespace.
            </Typography>
            <Button
              variant="contained"
              size="large"
              startIcon={<PlayArrowIcon />}
              onClick={startCinema}
              sx={{
                px: 4,
                py: 1.5,
                fontWeight: 700,
                bgcolor: '#F44336',
                '&:hover': { bgcolor: '#D32F2F' },
              }}
            >
              START REPLAY
            </Button>
          </Box>
        )}

        {(phase === 'scenes' || phase === 'ended') && (
          <Box ref={stageRef} sx={{ transformStyle: 'preserve-3d' }}>
            {/* Scene header */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                {severityIcon}
                <Typography variant="caption" sx={{
                  fontFamily: 'monospace',
                  color: SEVERITY_COLORS[currentEvent?.severity ?? 'info'],
                  fontWeight: 700,
                  letterSpacing: 1,
                }}>
                  {currentEvent?.severity.toUpperCase()}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                  {currentEvent?.timestamp ? new Date(currentEvent.timestamp).toLocaleTimeString() : ''}
                </Typography>
              </Box>
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentEvent?.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                >
                  <Typography variant="h4" fontWeight={900} sx={{ mb: 1 }}>
                    {currentEvent?.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                    {currentEvent?.description}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 3 }}>
                    {currentEvent?.affectedWorkloads.map((w) => (
                      <Chip
                        key={w}
                        label={w}
                        size="small"
                        variant="outlined"
                        sx={{ fontFamily: 'monospace', fontSize: 11 }}
                      />
                    ))}
                  </Box>
                </motion.div>
              </AnimatePresence>
            </Box>

            {/* Scene content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentEvent?.id + '-content'}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.5 }}
              >
                {renderSceneContent()}
              </motion.div>
            </AnimatePresence>

            {/* Timeline bar */}
            <Box sx={{ mt: 4, display: 'flex', gap: 1, alignItems: 'center' }}>
              {INCIDENT_EVENTS.map((evt, idx) => (
                <Box
                  key={evt.id}
                  onClick={() => {
                    if (sceneTimerRef.current) clearTimeout(sceneTimerRef.current)
                    setSceneIndex(idx)
                    animateCameraMove(evt.type)
                    setRedAlert(evt.severity === 'critical')
                  }}
                  sx={{
                    flex: 1,
                    height: 6,
                    borderRadius: 3,
                    bgcolor: idx <= sceneIndex ? SEVERITY_COLORS[evt.severity] : 'action.disabledBackground',
                    cursor: 'pointer',
                    transition: 'background-color 0.3s',
                    '&:hover': { opacity: 0.8 },
                  }}
                />
              ))}
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: 10 }}>
                19:00:00
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: 10 }}>
                19:03:22
              </Typography>
            </Box>
          </Box>
        )}

        {phase === 'ended' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <Box sx={{
              mt: 4,
              p: 3,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              textAlign: 'center',
            }}>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
                Replay Complete
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                Total duration: 3 min 22 sec · 5 events · Resolution: automatic recovery
              </Typography>
              <Button
                variant="outlined"
                startIcon={<RestartAltIcon />}
                onClick={handleReset}
              >
                Replay Again
              </Button>
            </Box>
          </motion.div>
        )}
      </Box>

      {/* Dev Toolbar */}
      <Box sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        bgcolor: 'background.paper',
        borderTop: '1px solid',
        borderColor: 'divider',
        px: 2,
        py: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        boxShadow: '0 -2px 12px rgba(0,0,0,0.15)',
      }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', flexShrink: 0 }}>
          DEV
        </Typography>

        <IconButton size="small" onClick={handlePlayPause}>
          {isPlaying ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
        </IconButton>

        <IconButton size="small" onClick={handleReset}>
          <RestartAltIcon fontSize="small" />
        </IconButton>

        <IconButton size="small" onClick={handleSkipPrev} disabled={sceneIndex <= 0 || phase === 'idle'}>
          <SkipPreviousIcon fontSize="small" />
        </IconButton>

        <IconButton size="small" onClick={handleSkipNext} disabled={phase === 'ended' || phase === 'idle'}>
          <SkipNextIcon fontSize="small" />
        </IconButton>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 140 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', flexShrink: 0 }}>
            Speed
          </Typography>
          <Slider
            size="small"
            min={0.25}
            max={3}
            step={0.25}
            value={speed}
            onChange={(_, val) => setSpeed(val as number)}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `${v}x`}
            sx={{ width: 80 }}
          />
          <Typography variant="caption" sx={{ fontFamily: 'monospace', minWidth: 30 }}>
            {speed}x
          </Typography>
        </Box>

        <Box sx={{ flex: 1 }} />

        <Chip
          label={phase.toUpperCase()}
          size="small"
          sx={{
            fontFamily: 'monospace',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1,
          }}
        />

        {phase === 'scenes' && (
          <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
            Scene {sceneIndex + 1}/{INCIDENT_EVENTS.length}: {currentEvent?.title}
          </Typography>
        )}
      </Box>
    </Box>
  )
}
