'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Switch from '@mui/material/Switch'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import { useRouter } from 'next/navigation'

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogLine {
  id: number
  timestamp: string
  level: LogLevel
  message: string
}

const LEVEL_COLORS: Record<LogLevel, string> = {
  info: '#3B82F6',
  warn: '#F59E0B',
  error: '#EF4444',
  debug: '#94A3B8',
}

const SAMPLE_MESSAGES: { level: LogLevel; msg: string }[] = [
  { level: 'info', msg: 'Reconciling deployment/api-server replicas=3' },
  { level: 'info', msg: 'Pod api-server-7d4f8b6c9-x2k4j scheduled on node-01' },
  { level: 'debug', msg: 'Health check passed for pod api-server-7d4f8b6c9-x2k4j' },
  { level: 'info', msg: 'Service api-server endpoints updated: 3 ready' },
  { level: 'warn', msg: 'Pod redis-cache-5f6d7e8a9-m3n2l memory usage at 82%' },
  { level: 'info', msg: 'ConfigMap api-config reloaded successfully' },
  { level: 'error', msg: 'CrashLoopBackOff: pod worker-6c8d9e0f1-p4q3r (exit code 137)' },
  { level: 'info', msg: 'HPA scaled deployment/event-processor to 4 replicas' },
  { level: 'debug', msg: 'Lease renewed for controller-manager leader election' },
  { level: 'warn', msg: 'Node node-03 disk pressure detected: 91% used' },
  { level: 'info', msg: 'Ingress rule updated for host api.example.com' },
  { level: 'error', msg: 'Failed to pull image: registry.io/app:v2.3.1 — timeout' },
  { level: 'info', msg: 'Secret tls-cert rotated successfully' },
  { level: 'debug', msg: 'Garbage collection: removed 12 terminated pods' },
  { level: 'info', msg: 'PersistentVolumeClaim data-postgres-0 bound to pv-0a3f' },
  { level: 'warn', msg: 'Certificate expires in 7 days: tls-cert' },
  { level: 'info', msg: 'NetworkPolicy default-deny applied to namespace staging' },
]

let lineCounter = 0

function generateLine(): LogLine {
  const sample = SAMPLE_MESSAGES[Math.floor(Math.random() * SAMPLE_MESSAGES.length)]
  const now = new Date()
  const ts = now.toISOString().replace('T', ' ').slice(0, 23)
  return {
    id: ++lineCounter,
    timestamp: ts,
    level: sample.level,
    message: sample.msg,
  }
}

export default function LogWaterfallPrototype() {
  const router = useRouter()
  const [lines, setLines] = useState<LogLine[]>([])
  const [streaming, setStreaming] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  const addLine = useCallback(() => {
    setLines((prev) => {
      const next = [...prev, generateLine()]
      return next.length > 200 ? next.slice(-200) : next
    })
  }, [])

  useEffect(() => {
    if (!streaming) return
    const randomInterval = () => 200 + Math.random() * 800
    let timeout: ReturnType<typeof setTimeout>
    let cancelled = false
    function scheduleNext() {
      if (cancelled) return
      timeout = setTimeout(() => {
        addLine()
        scheduleNext()
      }, randomInterval())
    }
    scheduleNext()
    return () => { cancelled = true; clearTimeout(timeout) }
  }, [streaming, addLine])

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [lines, autoScroll])

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>B4 — Log Waterfall</Typography>
          <Typography variant="body2" color="text.secondary">
            Rolling log stream with slide-in entries and error highlighting
          </Typography>
        </Box>
      </Box>

      {/* Controls */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', alignItems: 'center', flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          size="small"
          startIcon={streaming ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
          onClick={() => setStreaming((s) => !s)}
          color={streaming ? 'warning' : 'primary'}
        >
          {streaming ? 'Pause' : 'Start Stream'}
        </Button>
        <Button variant="outlined" size="small" onClick={addLine}>
          Add Line
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={() => setLines([])}
          disabled={lines.length === 0}
        >
          Clear
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
          <Typography variant="caption" color="text.secondary">Auto-scroll</Typography>
          <Switch size="small" checked={autoScroll} onChange={(_, v) => setAutoScroll(v)} />
        </Box>
        <Typography variant="caption" color="text.secondary">
          {lines.length} lines
        </Typography>
      </Box>

      {/* Log viewer */}
      <Box
        ref={containerRef}
        sx={{
          height: 500,
          overflow: 'auto',
          borderRadius: 2,
          bgcolor: '#0A0A0F',
          border: '1px solid',
          borderColor: 'divider',
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          fontSize: 12,
          lineHeight: 1.6,
          p: 1,
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 3 },
        }}
      >
        {lines.length === 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'inherit' }}>
              Press &quot;Start Stream&quot; to begin log simulation
            </Typography>
          </Box>
        )}
        {lines.map((line) => (
          <Box
            key={line.id}
            sx={{
              display: 'flex',
              gap: 1,
              px: 1,
              py: 0.25,
              borderRadius: 0.5,
              borderLeft: `3px solid ${LEVEL_COLORS[line.level]}`,
              ml: 0.5,
              animation: 'logSlideIn 200ms ease-out, logHighlight 1.5s ease-out',
              '@keyframes logSlideIn': {
                '0%': { opacity: 0, transform: 'translateX(12px)' },
                '100%': { opacity: 1, transform: 'translateX(0)' },
              },
              '@keyframes logHighlight': {
                '0%': { bgcolor: `${LEVEL_COLORS[line.level]}15` },
                '100%': { bgcolor: 'transparent' },
              },
              bgcolor: line.level === 'error' ? 'rgba(239,68,68,0.06)' : 'transparent',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
            }}
          >
            <Typography
              component="span"
              sx={{ color: 'text.secondary', fontFamily: 'inherit', fontSize: 'inherit', flexShrink: 0, userSelect: 'none' }}
            >
              {line.timestamp}
            </Typography>
            <Typography
              component="span"
              sx={{
                color: LEVEL_COLORS[line.level],
                fontFamily: 'inherit',
                fontSize: 'inherit',
                fontWeight: 600,
                width: 40,
                flexShrink: 0,
                textTransform: 'uppercase',
              }}
            >
              {line.level}
            </Typography>
            <Typography
              component="span"
              sx={{
                color: line.level === 'error' ? '#F87171' : line.level === 'warn' ? '#FCD34D' : 'text.primary',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                fontWeight: line.level === 'error' ? 500 : 400,
              }}
            >
              {line.message}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
