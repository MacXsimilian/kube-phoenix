'use client'

// PROTOTYPE: Workload Symphony
// DEPS: gsap framer-motion
// LIBS: GSAP, Framer Motion, Web Audio API, Canvas 2D
// DATA: Namespaces, workloads, replica counts
// DESCRIPTION: Cluster state as a musical score — workloads are notes on namespace staffs

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Slider from '@mui/material/Slider'
import Chip from '@mui/material/Chip'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import VolumeOffIcon from '@mui/icons-material/VolumeOff'
import VolumeUpIcon from '@mui/icons-material/VolumeUp'
import MusicNoteIcon from '@mui/icons-material/MusicNote'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type HealthStatus = 'running' | 'pending' | 'failed' | 'sleeping'

interface WorkloadDef {
  name: string
  replicas: number
  status: HealthStatus
  frequency: number
}

interface NamespaceDef {
  name: string
  workloads: WorkloadDef[]
  isSleepTarget: boolean
}

interface SleepPolicy {
  name: string
  targets: string[]
  sleepStartHour: number
  sleepEndHour: number
}

interface StreamDataPoint {
  hour: number
  values: Record<string, number>
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HOURS_IN_DAY = 24
const STAFF_LINE_COUNT = 5
const STAFF_LINE_SPACING = 10
const STAFF_HEIGHT = STAFF_LINE_COUNT * STAFF_LINE_SPACING
const NOTE_MIN_RADIUS = 6
const NOTE_MAX_RADIUS = 18

const STATUS_COLORS: Record<HealthStatus, string> = {
  running: '#4CAF50',
  pending: '#FF9800',
  failed: '#F44336',
  sleeping: '#616161',
}

const STATUS_GLOW: Record<HealthStatus, string> = {
  running: 'rgba(76, 175, 80, 0.4)',
  pending: 'rgba(255, 152, 0, 0.4)',
  failed: 'rgba(244, 67, 54, 0.5)',
  sleeping: 'rgba(97, 97, 97, 0.2)',
}

const NAMESPACE_PALETTE = [
  '#42A5F5', '#AB47BC', '#26A69A', '#EF5350',
  '#FFA726', '#66BB6A', '#5C6BC0', '#EC407A', '#78909C',
]

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const SLEEP_POLICY: SleepPolicy = {
  name: 'Non-production sleep',
  targets: ['staging', 'dev-sandbox', 'internal-tools'],
  sleepStartHour: 19,
  sleepEndHour: 7,
}

function buildNamespaces(): NamespaceDef[] {
  return [
    {
      name: 'production',
      isSleepTarget: false,
      workloads: [
        { name: 'api-gateway', replicas: 8, status: 'running', frequency: 261.63 },
        { name: 'redis-sentinel', replicas: 3, status: 'running', frequency: 329.63 },
      ],
    },
    {
      name: 'payments',
      isSleepTarget: false,
      workloads: [
        { name: 'checkout-service', replicas: 4, status: 'running', frequency: 349.23 },
        { name: 'payment-processor', replicas: 3, status: 'running', frequency: 392.0 },
      ],
    },
    {
      name: 'auth-service',
      isSleepTarget: false,
      workloads: [
        { name: 'user-auth', replicas: 6, status: 'running', frequency: 440.0 },
        { name: 'session-manager', replicas: 2, status: 'running', frequency: 493.88 },
      ],
    },
    {
      name: 'data-pipeline',
      isSleepTarget: false,
      workloads: [
        { name: 'kafka-consumer', replicas: 5, status: 'running', frequency: 523.25 },
      ],
    },
    {
      name: 'ml-training',
      isSleepTarget: false,
      workloads: [
        { name: 'spark-driver', replicas: 2, status: 'running', frequency: 587.33 },
        { name: 'feature-store', replicas: 4, status: 'running', frequency: 659.25 },
      ],
    },
    {
      name: 'internal-tools',
      isSleepTarget: true,
      workloads: [
        { name: 'admin-portal', replicas: 3, status: 'running', frequency: 698.46 },
      ],
    },
    {
      name: 'staging',
      isSleepTarget: true,
      workloads: [
        { name: 'staging-api', replicas: 6, status: 'running', frequency: 783.99 },
      ],
    },
    {
      name: 'monitoring',
      isSleepTarget: false,
      workloads: [
        { name: 'grafana', replicas: 2, status: 'running', frequency: 880.0 },
        { name: 'prometheus', replicas: 1, status: 'running', frequency: 987.77 },
      ],
    },
    {
      name: 'dev-sandbox',
      isSleepTarget: true,
      workloads: [
        { name: 'dev-api', replicas: 2, status: 'running', frequency: 1046.5 },
      ],
    },
  ]
}

function isInSleepWindow(hour: number): boolean {
  if (SLEEP_POLICY.sleepStartHour > SLEEP_POLICY.sleepEndHour) {
    return hour >= SLEEP_POLICY.sleepStartHour || hour < SLEEP_POLICY.sleepEndHour
  }
  return hour >= SLEEP_POLICY.sleepStartHour && hour < SLEEP_POLICY.sleepEndHour
}

function buildStreamData(namespaces: NamespaceDef[]): StreamDataPoint[] {
  const points: StreamDataPoint[] = []
  for (let h = 0; h < HOURS_IN_DAY; h++) {
    const sleeping = isInSleepWindow(h)
    const values: Record<string, number> = {}
    for (const ns of namespaces) {
      const totalReplicas = ns.workloads.reduce((sum, w) => sum + w.replicas, 0)
      values[ns.name] = (sleeping && ns.isSleepTarget) ? 0 : totalReplicas
    }
    points.push({ hour: h, values })
  }
  return points
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

function noteRadius(replicas: number): number {
  return NOTE_MIN_RADIUS + (replicas / 8) * (NOTE_MAX_RADIUS - NOTE_MIN_RADIUS)
}

function noteYOnStaff(
  staffTop: number,
  workloadIndex: number,
  totalWorkloads: number,
): number {
  const usable = STAFF_HEIGHT
  const step = usable / Math.max(totalWorkloads, 1)
  return staffTop + step * workloadIndex + step * 0.5
}

function drawStaffLines(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  alpha: number,
) {
  ctx.strokeStyle = `rgba(255,255,255,${0.12 * alpha})`
  ctx.lineWidth = 1
  for (let i = 0; i < STAFF_LINE_COUNT; i++) {
    const ly = y + i * STAFF_LINE_SPACING
    ctx.beginPath()
    ctx.moveTo(x, ly)
    ctx.lineTo(x + width, ly)
    ctx.stroke()
  }
}

function drawNote(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  glow: string,
  opacity: number,
) {
  ctx.save()
  ctx.globalAlpha = opacity
  ctx.shadowColor = glow
  ctx.shadowBlur = radius * 1.5
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(x, y, radius, radius * 0.7, 0, 0, Math.PI * 2)
  ctx.fill()

  if (radius > 8) {
    ctx.shadowBlur = 0
    ctx.strokeStyle = `rgba(255,255,255,${0.3 * opacity})`
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + radius, y - radius * 2.2)
    ctx.stroke()
  }
  ctx.restore()
}

function drawPlayhead(
  ctx: CanvasRenderingContext2D,
  x: number,
  topY: number,
  bottomY: number,
  pulse: number,
) {
  const alpha = 0.6 + pulse * 0.4
  ctx.save()
  ctx.strokeStyle = `rgba(255, 215, 0, ${alpha})`
  ctx.lineWidth = 2 + pulse * 2
  ctx.shadowColor = 'rgba(255, 215, 0, 0.6)'
  ctx.shadowBlur = 8 + pulse * 12
  ctx.beginPath()
  ctx.moveTo(x, topY)
  ctx.lineTo(x, bottomY)
  ctx.stroke()

  ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`
  ctx.beginPath()
  ctx.moveTo(x - 6, topY)
  ctx.lineTo(x + 6, topY)
  ctx.lineTo(x, topY + 10)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

// ---------------------------------------------------------------------------
// Stream chart drawing
// ---------------------------------------------------------------------------

function drawStreamChart(
  ctx: CanvasRenderingContext2D,
  data: StreamDataPoint[],
  namespaces: NamespaceDef[],
  palette: string[],
  x: number,
  y: number,
  width: number,
  height: number,
  currentHour: number,
  animProgress: Record<string, number>,
) {
  const nsNames = namespaces.map((ns) => ns.name)
  const stepX = width / (HOURS_IN_DAY - 1)

  const stacked: number[][] = []
  for (let h = 0; h < HOURS_IN_DAY; h++) {
    const row: number[] = []
    let cumulative = 0
    for (const nsName of nsNames) {
      const raw = data[h].values[nsName]
      const animated = raw * (animProgress[nsName] ?? 1)
      cumulative += animated
      row.push(cumulative)
    }
    stacked.push(row)
  }

  const maxTotal = Math.max(...stacked.map((row) => row[row.length - 1] || 1))

  for (let nsIdx = nsNames.length - 1; nsIdx >= 0; nsIdx--) {
    const color = palette[nsIdx % palette.length]
    ctx.fillStyle = color + '40'
    ctx.strokeStyle = color + '99'
    ctx.lineWidth = 1.5
    ctx.beginPath()

    for (let h = 0; h < HOURS_IN_DAY; h++) {
      const px = x + h * stepX
      const val = stacked[h][nsIdx] / maxTotal
      const py = y + height - val * height
      if (h === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }

    for (let h = HOURS_IN_DAY - 1; h >= 0; h--) {
      const px = x + h * stepX
      const val = nsIdx > 0 ? stacked[h][nsIdx - 1] / maxTotal : 0
      const py = y + height - val * height
      ctx.lineTo(px, py)
    }

    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

  const playheadX = x + (currentHour / (HOURS_IN_DAY - 1)) * width
  ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)'
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(playheadX, y)
  ctx.lineTo(playheadX, y + height)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.font = '10px monospace'
  for (let h = 0; h < HOURS_IN_DAY; h += 3) {
    const px = x + h * stepX
    ctx.fillText(`${h}:00`, px - 12, y + height + 14)
  }
}

// ---------------------------------------------------------------------------
// Audio engine
// ---------------------------------------------------------------------------

interface OscillatorEntry {
  osc: OscillatorNode
  gain: GainNode
}

function createAudioEngine(audioCtx: AudioContext, masterGain: GainNode) {
  const oscillators = new Map<string, OscillatorEntry>()

  function startTone(key: string, frequency: number, volume: number) {
    if (oscillators.has(key)) return
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(frequency, audioCtx.currentTime)
    gain.gain.setValueAtTime(volume * 0.08, audioCtx.currentTime)
    osc.connect(gain)
    gain.connect(masterGain)
    osc.start()
    oscillators.set(key, { osc, gain })
  }

  function stopTone(key: string) {
    const entry = oscillators.get(key)
    if (!entry) return
    const now = audioCtx.currentTime
    entry.gain.gain.linearRampToValueAtTime(0, now + 0.5)
    setTimeout(() => {
      try {
        entry.osc.stop()
        entry.osc.disconnect()
        entry.gain.disconnect()
      } catch {
        // already stopped
      }
      oscillators.delete(key)
    }, 600)
  }

  function updateVolume(key: string, volume: number) {
    const entry = oscillators.get(key)
    if (!entry) return
    entry.gain.gain.linearRampToValueAtTime(
      volume * 0.08,
      audioCtx.currentTime + 0.1,
    )
  }

  function destroyAll() {
    for (const [key] of oscillators) {
      stopTone(key)
    }
  }

  return { startTone, stopTone, updateVolume, destroyAll }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WorkloadSymphonyPrototype() {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const audioEngineRef = useRef<ReturnType<typeof createAudioEngine> | null>(null)
  const gsapCtxRef = useRef<gsap.Context | null>(null)

  const [isPlaying, setIsPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [volume, setVolume] = useState(0)
  const [currentHour, setCurrentHour] = useState(8)

  const namespaces = useMemo(() => buildNamespaces(), [])
  const streamData = useMemo(() => buildStreamData(namespaces), [namespaces])

  const speedOptions = [1, 2, 5]

  const noteStatesRef = useRef<
    Record<string, { y: number; opacity: number; status: HealthStatus }>
  >({})
  const playheadPulseRef = useRef(0)
  const prevSleepRef = useRef(false)
  const streamAnimRef = useRef<Record<string, number>>({})

  const initNoteStates = useCallback(() => {
    const states: Record<string, { y: number; opacity: number; status: HealthStatus }> = {}
    for (const ns of namespaces) {
      for (const wl of ns.workloads) {
        states[`${ns.name}/${wl.name}`] = {
          y: 0,
          opacity: 1,
          status: wl.status,
        }
      }
    }
    noteStatesRef.current = states

    const streamAnim: Record<string, number> = {}
    for (const ns of namespaces) {
      streamAnim[ns.name] = 1
    }
    streamAnimRef.current = streamAnim
  }, [namespaces])

  useEffect(() => {
    initNoteStates()
  }, [initNoteStates])

  const initAudio = useCallback(() => {
    if (audioCtxRef.current) return
    const ctx = new AudioContext()
    const master = ctx.createGain()
    master.gain.setValueAtTime(0, ctx.currentTime)
    master.connect(ctx.destination)
    audioCtxRef.current = ctx
    masterGainRef.current = master
    audioEngineRef.current = createAudioEngine(ctx, master)
  }, [])

  useEffect(() => {
    if (!masterGainRef.current || !audioCtxRef.current) return
    masterGainRef.current.gain.linearRampToValueAtTime(
      volume,
      audioCtxRef.current.currentTime + 0.1,
    )
  }, [volume])

  const handleReset = useCallback(() => {
    setCurrentHour(8)
    setIsPlaying(true)
    playheadPulseRef.current = 0
    prevSleepRef.current = false
    initNoteStates()
    if (gsapCtxRef.current) gsapCtxRef.current.revert()
  }, [initNoteStates])

  const animateSleepTransition = useCallback(
    (sleeping: boolean) => {
      if (gsapCtxRef.current) gsapCtxRef.current.revert()
      gsapCtxRef.current = gsap.context(() => {
        for (const ns of namespaces) {
          if (!ns.isSleepTarget) continue
          const targetStreamVal = sleeping ? 0 : 1
          gsap.to(streamAnimRef.current, {
            [ns.name]: targetStreamVal,
            duration: 1.2,
            ease: 'power2.inOut',
          })

          for (const wl of ns.workloads) {
            const key = `${ns.name}/${wl.name}`
            const state = noteStatesRef.current[key]
            if (!state) continue

            if (sleeping) {
              gsap.to(state, {
                y: 20,
                opacity: 0.25,
                duration: 1,
                ease: 'power2.inOut',
              })
              state.status = 'sleeping'
              audioEngineRef.current?.stopTone(key)
            } else {
              gsap.to(state, {
                y: -8,
                opacity: 1,
                duration: 0.6,
                ease: 'back.out(2.5)',
                onComplete: () => {
                  gsap.to(state, { y: 0, duration: 0.3, ease: 'power1.out' })
                },
              })
              state.status = 'running'
              if (volume > 0) {
                audioEngineRef.current?.startTone(key, wl.frequency, volume)
              }
            }
          }
        }

        gsap.to(playheadPulseRef, {
          current: 1,
          duration: 0.3,
          yoyo: true,
          repeat: 3,
          ease: 'power2.inOut',
          onComplete: () => {
            playheadPulseRef.current = 0
          },
        })
      })
    },
    [namespaces, volume],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeCanvas = () => {
      const container = canvas.parentElement
      if (!container) return
      const rect = container.getBoundingClientRect()
      canvas.width = rect.width * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    let lastTime = performance.now()
    let hourAccumulator = currentHour

    const draw = (now: number) => {
      const dt = (now - lastTime) / 1000
      lastTime = now

      if (isPlaying) {
        hourAccumulator += dt * speed * 0.5
        if (hourAccumulator >= HOURS_IN_DAY) hourAccumulator = 0
        setCurrentHour(hourAccumulator)

        const nowSleeping = isInSleepWindow(hourAccumulator)
        if (nowSleeping !== prevSleepRef.current) {
          prevSleepRef.current = nowSleeping
          animateSleepTransition(nowSleeping)
        }
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const w = canvas.width
      const h = canvas.height
      const dpr = window.devicePixelRatio
      ctx.save()
      ctx.scale(dpr, dpr)
      const logicalW = w / dpr
      const logicalH = h / dpr

      ctx.fillStyle = '#0A0E17'
      ctx.fillRect(0, 0, logicalW, logicalH)

      const margin = { left: 140, right: 30, top: 40, bottom: 180 }
      const scoreWidth = logicalW - margin.left - margin.right
      const staffSpacing = 8
      const totalStaffs = namespaces.length
      const availableScoreHeight =
        logicalH - margin.top - margin.bottom - staffSpacing * (totalStaffs - 1)
      const staffAreaHeight = Math.min(
        availableScoreHeight / totalStaffs,
        STAFF_HEIGHT + 10,
      )

      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.font = 'bold 14px monospace'
      ctx.fillText('WORKLOAD SYMPHONY', margin.left, 28)
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.font = '11px monospace'
      const timeStr = `${Math.floor(hourAccumulator)}:${String(
        Math.floor((hourAccumulator % 1) * 60),
      ).padStart(2, '0')}`
      ctx.fillText(timeStr, margin.left + scoreWidth - 40, 28)

      for (let nsIdx = 0; nsIdx < totalStaffs; nsIdx++) {
        const ns = namespaces[nsIdx]
        const staffTop =
          margin.top + nsIdx * (staffAreaHeight + staffSpacing)
        const isSleepingNow =
          ns.isSleepTarget && isInSleepWindow(hourAccumulator)
        const staffAlpha = isSleepingNow ? 0.3 : 1

        ctx.fillStyle = `rgba(255,255,255,${0.5 * staffAlpha})`
        ctx.font = '10px monospace'
        ctx.textAlign = 'right'
        ctx.fillText(ns.name, margin.left - 10, staffTop + STAFF_HEIGHT / 2 + 3)
        ctx.textAlign = 'left'

        if (ns.isSleepTarget) {
          const sleepStartX =
            margin.left +
            (SLEEP_POLICY.sleepStartHour / HOURS_IN_DAY) * scoreWidth
          const sleepEndX =
            margin.left +
            (SLEEP_POLICY.sleepEndHour / HOURS_IN_DAY) * scoreWidth

          ctx.fillStyle = 'rgba(100, 50, 150, 0.08)'
          if (SLEEP_POLICY.sleepStartHour > SLEEP_POLICY.sleepEndHour) {
            ctx.fillRect(
              sleepStartX,
              staffTop - 2,
              margin.left + scoreWidth - sleepStartX,
              STAFF_HEIGHT + 4,
            )
            ctx.fillRect(
              margin.left,
              staffTop - 2,
              sleepEndX - margin.left,
              STAFF_HEIGHT + 4,
            )
          }
        }

        drawStaffLines(ctx, margin.left, staffTop, scoreWidth, staffAlpha)

        for (let wlIdx = 0; wlIdx < ns.workloads.length; wlIdx++) {
          const wl = ns.workloads[wlIdx]
          const key = `${ns.name}/${wl.name}`
          const state = noteStatesRef.current[key]
          if (!state) continue

          const baseY = noteYOnStaff(staffTop, wlIdx, ns.workloads.length)
          const noteY = baseY + state.y
          const radius = noteRadius(wl.replicas)
          const status = state.status
          const color = STATUS_COLORS[status]
          const glow = STATUS_GLOW[status]

          const noteX =
            margin.left + ((wlIdx + 1) / (ns.workloads.length + 1)) * scoreWidth * 0.3 +
            scoreWidth * 0.05

          drawNote(ctx, noteX, noteY, radius, color, glow, state.opacity)

          ctx.fillStyle = `rgba(255,255,255,${0.4 * state.opacity})`
          ctx.font = '8px monospace'
          ctx.fillText(wl.name, noteX + radius + 4, noteY + 3)
          ctx.fillStyle = `rgba(255,255,255,${0.25 * state.opacity})`
          ctx.fillText(`x${wl.replicas}`, noteX + radius + 4, noteY + 13)
        }
      }

      const playheadX =
        margin.left + (hourAccumulator / HOURS_IN_DAY) * scoreWidth
      const scoreTop = margin.top
      const scoreBottom =
        margin.top +
        (totalStaffs - 1) * (staffAreaHeight + staffSpacing) +
        STAFF_HEIGHT
      drawPlayhead(
        ctx,
        playheadX,
        scoreTop - 5,
        scoreBottom + 5,
        playheadPulseRef.current,
      )

      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      ctx.font = '9px monospace'
      for (let h = 0; h < HOURS_IN_DAY; h += 3) {
        const hx = margin.left + (h / HOURS_IN_DAY) * scoreWidth
        ctx.fillText(`${h}:00`, hx - 10, scoreBottom + 18)
        ctx.strokeStyle = 'rgba(255,255,255,0.05)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(hx, scoreTop)
        ctx.lineTo(hx, scoreBottom)
        ctx.stroke()
      }

      const streamTop = scoreBottom + 35
      const streamHeight = Math.min(logicalH - streamTop - 30, 120)
      if (streamHeight > 30) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)'
        ctx.font = '10px monospace'
        ctx.fillText('REPLICA STREAM', margin.left, streamTop - 6)

        drawStreamChart(
          ctx,
          streamData,
          namespaces,
          NAMESPACE_PALETTE,
          margin.left,
          streamTop,
          scoreWidth,
          streamHeight,
          hourAccumulator,
          streamAnimRef.current,
        )
      }

      ctx.restore()
      animFrameRef.current = requestAnimationFrame(draw)
    }

    animFrameRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [
    isPlaying,
    speed,
    namespaces,
    streamData,
    animateSleepTransition,
    currentHour,
  ])

  useEffect(() => {
    if (volume > 0) {
      initAudio()
      for (const ns of namespaces) {
        for (const wl of ns.workloads) {
          const key = `${ns.name}/${wl.name}`
          const state = noteStatesRef.current[key]
          if (state && state.status === 'running') {
            audioEngineRef.current?.startTone(key, wl.frequency, volume)
          }
        }
      }
    } else {
      audioEngineRef.current?.destroyAll()
    }
  }, [volume, namespaces, initAudio])

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current)
      if (gsapCtxRef.current) gsapCtxRef.current.revert()
      audioEngineRef.current?.destroyAll()
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close()
      }
    }
  }, [])

  return (
    <Box
      sx={{
        width: '100vw',
        height: '100vh',
        bgcolor: '#0A0E17',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <IconButton
        onClick={() => router.push('/prototypes')}
        sx={{
          position: 'absolute',
          top: 12,
          left: 12,
          zIndex: 10,
          color: 'rgba(255,255,255,0.6)',
          '&:hover': { color: '#fff' },
        }}
      >
        <ArrowBackIcon />
      </IconButton>

      <Box sx={{ width: '100%', height: 'calc(100vh - 56px)' }}>
        <canvas
          ref={canvasRef}
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
      </Box>

      {/* Legend */}
      <Box
        sx={{
          position: 'absolute',
          top: 12,
          right: 16,
          display: 'flex',
          gap: 1.5,
          alignItems: 'center',
          zIndex: 10,
        }}
      >
        {(['running', 'pending', 'failed', 'sleeping'] as HealthStatus[]).map(
          (status) => (
            <Box
              key={status}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: STATUS_COLORS[status],
                  boxShadow: `0 0 4px ${STATUS_GLOW[status]}`,
                }}
              />
              <Typography
                variant="caption"
                sx={{ color: 'rgba(255,255,255,0.45)', fontSize: 10 }}
              >
                {status}
              </Typography>
            </Box>
          ),
        )}
        <Chip
          icon={<MusicNoteIcon sx={{ fontSize: 12 }} />}
          label="sleep policy active"
          size="small"
          sx={{
            bgcolor: 'rgba(100,50,150,0.2)',
            color: 'rgba(255,255,255,0.5)',
            fontSize: 9,
            height: 20,
            '& .MuiChip-icon': { color: 'rgba(180,120,255,0.6)' },
          }}
        />
      </Box>

      {/* Dev Toolbar */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          height: 52,
          bgcolor: 'rgba(10, 14, 23, 0.95)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          px: 3,
        }}
      >
        <IconButton
          onClick={() => setIsPlaying((p) => !p)}
          size="small"
          sx={{ color: '#FFD700' }}
        >
          {isPlaying ? (
            <PauseIcon fontSize="small" />
          ) : (
            <PlayArrowIcon fontSize="small" />
          )}
        </IconButton>

        <IconButton
          onClick={handleReset}
          size="small"
          sx={{ color: 'rgba(255,255,255,0.5)' }}
        >
          <RestartAltIcon fontSize="small" />
        </IconButton>

        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {speedOptions.map((s) => (
            <Button
              key={s}
              size="small"
              variant={speed === s ? 'contained' : 'text'}
              onClick={() => setSpeed(s)}
              sx={{
                minWidth: 36,
                fontSize: 11,
                px: 1,
                py: 0.25,
                color: speed === s ? '#0A0E17' : 'rgba(255,255,255,0.5)',
                bgcolor: speed === s ? '#FFD700' : 'transparent',
                '&:hover': {
                  bgcolor: speed === s ? '#FFC107' : 'rgba(255,255,255,0.08)',
                },
              }}
            >
              {s}x
            </Button>
          ))}
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            ml: 2,
            minWidth: 140,
          }}
        >
          {volume === 0 ? (
            <VolumeOffIcon
              sx={{ fontSize: 16, color: 'rgba(255,255,255,0.35)', cursor: 'pointer' }}
              onClick={() => setVolume(0.3)}
            />
          ) : (
            <VolumeUpIcon
              sx={{ fontSize: 16, color: '#FFD700', cursor: 'pointer' }}
              onClick={() => setVolume(0)}
            />
          )}
          <Slider
            value={volume}
            min={0}
            max={1}
            step={0.01}
            onChange={(_, v) => setVolume(v as number)}
            size="small"
            sx={{
              width: 90,
              color: '#FFD700',
              '& .MuiSlider-thumb': { width: 12, height: 12 },
              '& .MuiSlider-track': { height: 3 },
              '& .MuiSlider-rail': {
                height: 3,
                bgcolor: 'rgba(255,255,255,0.1)',
              },
            }}
          />
        </Box>

        <Typography
          variant="caption"
          sx={{
            color: 'rgba(255,255,255,0.3)',
            fontSize: 10,
            ml: 2,
            fontFamily: 'monospace',
          }}
        >
          {Math.floor(currentHour)}:
          {String(Math.floor((currentHour % 1) * 60)).padStart(2, '0')}
        </Typography>
      </Box>
    </Box>
  )
}
