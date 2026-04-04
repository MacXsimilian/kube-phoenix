'use client'

// PROTOTYPE: Timeline Scrub Preview
// DEPS: framer-motion gsap
// LIBS: Framer Motion, GSAP, SVG
// DATA: Execution history with state snapshots
// DESCRIPTION: Video-player style timeline scrubber with hover preview thumbnails

import { useCallback, useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'

// ── Types ──────────────────────────────────────────────────────────────────

type NamespaceStatus = 'running' | 'sleeping' | 'waking'

interface ClusterSnapshot {
  totalPods: number
  runningPods: number
  namespaces: { name: string; status: NamespaceStatus; pods: number }[]
}

interface ExecutionEvent {
  id: string
  label: string
  startHour: number
  endHour: number
  type: 'sleep' | 'wake'
  snapshot: ClusterSnapshot
}

// ── Mock Data ──────────────────────────────────────────────────────────────

const EXECUTIONS: ExecutionEvent[] = [
  {
    id: 'exec-1',
    label: 'Scheduled Sleep',
    startHour: 1,
    endHour: 1.5,
    type: 'sleep',
    snapshot: {
      totalPods: 42, runningPods: 12,
      namespaces: [
        { name: 'production', status: 'running', pods: 8 },
        { name: 'staging', status: 'sleeping', pods: 0 },
        { name: 'dev', status: 'sleeping', pods: 4 },
      ],
    },
  },
  {
    id: 'exec-2',
    label: 'Morning Wake',
    startHour: 6,
    endHour: 6.75,
    type: 'wake',
    snapshot: {
      totalPods: 42, runningPods: 38,
      namespaces: [
        { name: 'production', status: 'running', pods: 14 },
        { name: 'staging', status: 'waking', pods: 12 },
        { name: 'dev', status: 'waking', pods: 12 },
      ],
    },
  },
  {
    id: 'exec-3',
    label: 'Auto-scale Event',
    startHour: 10,
    endHour: 10.25,
    type: 'wake',
    snapshot: {
      totalPods: 56, runningPods: 56,
      namespaces: [
        { name: 'production', status: 'running', pods: 22 },
        { name: 'staging', status: 'running', pods: 18 },
        { name: 'dev', status: 'running', pods: 16 },
      ],
    },
  },
  {
    id: 'exec-4',
    label: 'Lunch Scale-Down',
    startHour: 13,
    endHour: 13.5,
    type: 'sleep',
    snapshot: {
      totalPods: 56, runningPods: 30,
      namespaces: [
        { name: 'production', status: 'running', pods: 14 },
        { name: 'staging', status: 'sleeping', pods: 8 },
        { name: 'dev', status: 'sleeping', pods: 8 },
      ],
    },
  },
  {
    id: 'exec-5',
    label: 'Evening Sleep',
    startHour: 20,
    endHour: 20.75,
    type: 'sleep',
    snapshot: {
      totalPods: 42, runningPods: 8,
      namespaces: [
        { name: 'production', status: 'running', pods: 8 },
        { name: 'staging', status: 'sleeping', pods: 0 },
        { name: 'dev', status: 'sleeping', pods: 0 },
      ],
    },
  },
]

const TIMELINE_WIDTH = 700
const TIMELINE_HEIGHT = 48
const MARKER_Y = TIMELINE_HEIGHT / 2
const HOURS = 24

function hourToX(hour: number): number {
  return (hour / HOURS) * TIMELINE_WIDTH
}

function xToHour(x: number): number {
  return Math.max(0, Math.min(HOURS, (x / TIMELINE_WIDTH) * HOURS))
}

function formatHour(hour: number): string {
  const h = Math.floor(hour)
  const m = Math.round((hour - h) * 60)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

const STATUS_COLORS: Record<NamespaceStatus, string> = {
  running: '#22C55E',
  sleeping: '#3B82F6',
  waking: '#F59E0B',
}

// ── Thumbnail Card ─────────────────────────────────────────────────────────

function ThumbnailCard({ event }: { event: ExecutionEvent }) {
  return (
    <Box
      sx={{
        width: 200,
        p: 1.5,
        borderRadius: 1.5,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}
    >
      <Typography variant="caption" fontWeight={700} sx={{ display: 'block', mb: 0.5 }}>
        {event.label}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        {formatHour(event.startHour)} - {formatHour(event.endHour)}
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Pods: {event.snapshot.runningPods}/{event.snapshot.totalPods}
        </Typography>
        <Chip
          label={event.type}
          size="small"
          sx={{
            height: 18,
            fontSize: 10,
            bgcolor: event.type === 'wake' ? '#F59E0B20' : '#3B82F620',
            color: event.type === 'wake' ? '#F59E0B' : '#3B82F6',
          }}
        />
      </Box>
      {event.snapshot.namespaces.map((ns) => (
        <Box key={ns.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
          <Box
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              bgcolor: STATUS_COLORS[ns.status],
            }}
          />
          <Typography variant="caption" sx={{ fontSize: 10 }}>
            {ns.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, ml: 'auto' }}>
            {ns.pods} pods
          </Typography>
        </Box>
      ))}
    </Box>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function TimelineScrubPrototype() {
  const router = useRouter()
  const playheadRef = useRef<SVGLineElement>(null)
  const tweenRef = useRef<gsap.core.Tween | null>(null)
  const [hoveredEvent, setHoveredEvent] = useState<ExecutionEvent | null>(null)
  const [hoverX, setHoverX] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playheadHour, setPlayheadHour] = useState(0)

  const startPlayback = useCallback(() => {
    if (!playheadRef.current) return
    setIsPlaying(true)
    const proxy = { hour: playheadHour }
    tweenRef.current = gsap.to(proxy, {
      hour: HOURS,
      duration: 8,
      ease: 'none',
      onUpdate: () => {
        setPlayheadHour(proxy.hour)
        if (playheadRef.current) {
          const x = hourToX(proxy.hour)
          playheadRef.current.setAttribute('x1', String(x))
          playheadRef.current.setAttribute('x2', String(x))
        }
      },
      onComplete: () => {
        setIsPlaying(false)
        setPlayheadHour(0)
        if (playheadRef.current) {
          playheadRef.current.setAttribute('x1', '0')
          playheadRef.current.setAttribute('x2', '0')
        }
      },
    })
  }, [playheadHour])

  const pausePlayback = useCallback(() => {
    tweenRef.current?.pause()
    setIsPlaying(false)
  }, [])

  useEffect(() => {
    return () => {
      tweenRef.current?.kill()
    }
  }, [])

  const findEventNear = useCallback((clientX: number, svgRect: DOMRect) => {
    const relX = clientX - svgRect.left
    const hour = xToHour(relX)
    const threshold = 1
    return EXECUTIONS.find(
      (e) => hour >= e.startHour - threshold && hour <= e.endHour + threshold
    )
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const relX = e.clientX - rect.left
      setHoverX(relX)
      const event = findEventNear(e.clientX, rect)
      setHoveredEvent(event ?? null)
    },
    [findEventNear]
  )

  const handleMouseLeave = useCallback(() => {
    setHoveredEvent(null)
  }, [])

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const relX = e.clientX - rect.left
      const hour = xToHour(relX)
      setPlayheadHour(hour)
      tweenRef.current?.kill()
      setIsPlaying(false)
      if (playheadRef.current) {
        const x = hourToX(hour)
        playheadRef.current.setAttribute('x1', String(x))
        playheadRef.current.setAttribute('x2', String(x))
      }
    },
    []
  )

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', py: 4, px: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>K8 — Timeline Scrub Preview</Typography>
          <Typography variant="body2" color="text.secondary">
            Video-player style timeline scrubber with hover preview thumbnails
          </Typography>
        </Box>
      </Box>

      {/* Timeline area */}
      <Box
        sx={{
          p: 3,
          borderRadius: 2,
          bgcolor: 'background.default',
          border: '1px solid',
          borderColor: 'divider',
          minHeight: 300,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          24-Hour Execution Timeline — {formatHour(playheadHour)}
        </Typography>

        {/* Thumbnail popup */}
        <Box sx={{ position: 'relative', width: TIMELINE_WIDTH, height: 140 }}>
          <AnimatePresence>
            {hoveredEvent && (
              <motion.div
                key={hoveredEvent.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: 'absolute',
                  left: Math.min(Math.max(hoverX - 100, 0), TIMELINE_WIDTH - 200),
                  bottom: 0,
                }}
              >
                <ThumbnailCard event={hoveredEvent} />
              </motion.div>
            )}
          </AnimatePresence>
        </Box>

        {/* SVG Timeline */}
        <Box sx={{ position: 'relative' }}>
          <svg
            width={TIMELINE_WIDTH}
            height={TIMELINE_HEIGHT}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
            style={{ cursor: 'pointer', overflow: 'visible' }}
          >
            {/* Track background */}
            <rect
              x={0}
              y={MARKER_Y - 3}
              width={TIMELINE_WIDTH}
              height={6}
              rx={3}
              fill="rgba(255,255,255,0.08)"
            />

            {/* Hour ticks */}
            {Array.from({ length: 25 }).map((_, h) => (
              <g key={h}>
                <line
                  x1={hourToX(h)}
                  y1={MARKER_Y - 8}
                  x2={hourToX(h)}
                  y2={MARKER_Y + 8}
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth={h % 6 === 0 ? 1.5 : 0.5}
                />
                {h % 6 === 0 && (
                  <text
                    x={hourToX(h)}
                    y={MARKER_Y + 22}
                    fill="rgba(255,255,255,0.4)"
                    fontSize={10}
                    textAnchor="middle"
                  >
                    {`${h.toString().padStart(2, '0')}:00`}
                  </text>
                )}
              </g>
            ))}

            {/* Execution event markers */}
            {EXECUTIONS.map((evt) => (
              <g key={evt.id}>
                <rect
                  x={hourToX(evt.startHour)}
                  y={MARKER_Y - 6}
                  width={Math.max(hourToX(evt.endHour) - hourToX(evt.startHour), 4)}
                  height={12}
                  rx={2}
                  fill={evt.type === 'wake' ? '#F59E0B' : '#3B82F6'}
                  opacity={0.7}
                />
                <circle
                  cx={hourToX(evt.startHour)}
                  cy={MARKER_Y}
                  r={4}
                  fill={evt.type === 'wake' ? '#F59E0B' : '#3B82F6'}
                />
              </g>
            ))}

            {/* Playhead */}
            <line
              ref={playheadRef}
              x1={hourToX(playheadHour)}
              y1={MARKER_Y - 14}
              x2={hourToX(playheadHour)}
              y2={MARKER_Y + 14}
              stroke="#F97316"
              strokeWidth={2}
              strokeLinecap="round"
            />

            {/* Hover line */}
            {hoveredEvent && (
              <line
                x1={hoverX}
                y1={MARKER_Y - 14}
                x2={hoverX}
                y2={MARKER_Y + 14}
                stroke="rgba(255,255,255,0.3)"
                strokeWidth={1}
                strokeDasharray="2 2"
              />
            )}
          </svg>
        </Box>

        {/* Execution list */}
        <Box sx={{ width: TIMELINE_WIDTH, display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
          {EXECUTIONS.map((evt) => (
            <Chip
              key={evt.id}
              label={`${evt.label} (${formatHour(evt.startHour)})`}
              size="small"
              sx={{
                fontSize: 11,
                bgcolor: evt.type === 'wake' ? '#F59E0B15' : '#3B82F615',
                color: evt.type === 'wake' ? '#F59E0B' : '#3B82F6',
                border: '1px solid',
                borderColor: evt.type === 'wake' ? '#F59E0B30' : '#3B82F630',
              }}
            />
          ))}
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
          bgcolor: 'rgba(0,0,0,0.9)',
          backdropFilter: 'blur(8px)',
          borderTop: '1px solid',
          borderColor: 'divider',
          px: 3,
          py: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Typography variant="caption" fontWeight={700} sx={{ color: '#F97316' }}>
          DEV
        </Typography>
        <IconButton
          size="small"
          onClick={() => (isPlaying ? pausePlayback() : startPlayback())}
          sx={{ color: 'white' }}
        >
          {isPlaying ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
        </IconButton>
        <Typography variant="caption" color="text.secondary">
          Playhead: {formatHour(playheadHour)}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          Hover over timeline markers to see preview thumbnails
        </Typography>
      </Box>
    </Box>
  )
}
