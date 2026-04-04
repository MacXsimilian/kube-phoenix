'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import ReplayIcon from '@mui/icons-material/Replay'
import { useRouter } from 'next/navigation'
import gsap from 'gsap'

interface Workload {
  namespace: string
  name: string
  kind: string
  replicas: number
  current: number
  status: 'pending' | 'scaling' | 'done'
  priority: boolean
}

const INITIAL: Workload[] = [
  { namespace: 'dev', name: 'api-server', kind: 'Deployment', replicas: 3, current: 3, status: 'pending', priority: false },
  { namespace: 'dev', name: 'web-frontend', kind: 'Deployment', replicas: 2, current: 2, status: 'pending', priority: false },
  { namespace: 'dev', name: 'worker', kind: 'Deployment', replicas: 2, current: 2, status: 'pending', priority: false },
  { namespace: 'dev', name: 'redis', kind: 'StatefulSet', replicas: 1, current: 1, status: 'pending', priority: false },
  { namespace: 'staging', name: 'checkout-svc', kind: 'Deployment', replicas: 2, current: 2, status: 'pending', priority: false },
  { namespace: 'staging', name: 'product-api', kind: 'Deployment', replicas: 3, current: 3, status: 'pending', priority: false },
  { namespace: 'monitoring', name: 'prometheus', kind: 'StatefulSet', replicas: 1, current: 1, status: 'pending', priority: true },
  { namespace: 'monitoring', name: 'grafana', kind: 'Deployment', replicas: 1, current: 1, status: 'pending', priority: true },
]

const SCALE_ORDER = [0, 1, 2, 3, 4, 5, 6, 7]

export default function WorkloadWaterfallPrototype() {
  const router = useRouter()
  const [workloads, setWorkloads] = useState<Workload[]>(INITIAL)
  const [running, setRunning] = useState(false)
  const [scaledCount, setScaledCount] = useState(0)
  const [logs, setLogs] = useState<string[]>([])
  const barRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const logRef = useRef<HTMLDivElement>(null)

  const reset = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
    setWorkloads(INITIAL)
    setScaledCount(0)
    setLogs([])
    setRunning(false)
    Object.values(barRefs.current).forEach(el => {
      if (el) { el.style.width = '100%'; el.style.backgroundColor = '#22C55E' }
    })
  }, [])

  const play = useCallback(() => {
    reset()
    setTimeout(() => {
      setRunning(true)
      setLogs(['Starting scheduled sleep for policy "EU Dev Sleep"', `Found ${INITIAL.length} matching workloads`])

      let cumDelay = 600
      for (const idx of SCALE_ORDER) {
        const w = INITIAL[idx]
        const delay = cumDelay + (w.priority ? 1500 : 0)

        const t1 = setTimeout(() => {
          setWorkloads(prev => prev.map((wl, i) => i === idx ? { ...wl, status: 'scaling' } : wl))
          setLogs(prev => [...prev, `Scaling ${w.kind.toLowerCase()} ${w.namespace}/${w.name} from ${w.replicas} to 0...`])

          const bar = barRefs.current[`${w.namespace}/${w.name}`]
          if (bar) {
            gsap.to(bar, {
              width: '0%',
              backgroundColor: '#EF4444',
              duration: 0.5,
              ease: 'power2.inOut',
            })
          }
        }, delay)
        timeoutsRef.current.push(t1)

        const t2 = setTimeout(() => {
          setWorkloads(prev => prev.map((wl, i) => i === idx ? { ...wl, status: 'done', current: 0 } : wl))
          setScaledCount(prev => prev + 1)
          setLogs(prev => [...prev, `Scaled ${w.namespace}/${w.name} to 0`])
        }, delay + 600)
        timeoutsRef.current.push(t2)

        cumDelay = delay + 800
      }

      const tEnd = setTimeout(() => {
        setLogs(prev => [...prev, `Execution completed — ${INITIAL.length} scaled, 0 errors`])
        setRunning(false)
      }, cumDelay + 200)
      timeoutsRef.current.push(tEnd)
    }, 50)
  }, [reset])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  useEffect(() => () => timeoutsRef.current.forEach(clearTimeout), [])

  const statusColor = (s: Workload['status']) =>
    s === 'done' ? '#22C55E' : s === 'scaling' ? '#F59E0B' : '#94A3B8'

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>F6 — Workload Waterfall</Typography>
          <Typography variant="body2" color="text.secondary">
            Live replica bars shrink to 0 as sleep log lines arrive via WebSocket
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', alignItems: 'center' }}>
        <Button variant="contained" size="small" startIcon={<PlayArrowIcon fontSize="small" />} onClick={play} disabled={running}>
          Play Sleep
        </Button>
        <Button variant="outlined" size="small" startIcon={<ReplayIcon fontSize="small" />} onClick={reset}>
          Reset
        </Button>
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ color: '#22C55E', fontWeight: 600 }}>{scaledCount}/{INITIAL.length}</Typography>
          <Typography variant="caption" color="text.secondary">scaled</Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        {/* Workload list */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {workloads.map((w) => (
            <Box
              key={`${w.namespace}/${w.name}`}
              sx={{
                p: 1.5, borderRadius: 1.5, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
                opacity: w.status === 'done' ? 0.5 : 1,
                transition: 'opacity 400ms ease',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: statusColor(w.status), flexShrink: 0, transition: 'background-color 300ms ease' }} />
                <Typography variant="body2" fontWeight={500} sx={{ fontFamily: 'monospace', fontSize: 12, flex: 1 }}>
                  {w.namespace}/{w.name}
                </Typography>
                <Chip label={w.kind} size="small" sx={{ height: 16, fontSize: 9, bgcolor: 'rgba(124,58,237,0.1)', color: '#7C3AED' }} />
                {w.priority && <Chip label="Priority" size="small" sx={{ height: 16, fontSize: 9, bgcolor: 'rgba(245,158,11,0.1)', color: '#F59E0B' }} />}
                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', minWidth: 30, textAlign: 'right' }}>
                  {w.current}/{w.replicas}
                </Typography>
              </Box>
              <Box sx={{ height: 6, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <Box
                  ref={(el: HTMLDivElement | null) => { barRefs.current[`${w.namespace}/${w.name}`] = el }}
                  sx={{ height: '100%', width: '100%', bgcolor: '#22C55E', borderRadius: 1, transition: 'background-color 200ms ease' }}
                />
              </Box>
            </Box>
          ))}
        </Box>

        {/* Log feed */}
        <Box
          ref={logRef}
          sx={{
            p: 1.5, borderRadius: 2, bgcolor: '#0A0A0F', border: '1px solid', borderColor: 'divider',
            fontFamily: 'monospace', fontSize: 12, lineHeight: 1.8, maxHeight: 400, overflow: 'auto',
            '&::-webkit-scrollbar': { width: 4 },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 2 },
          }}
        >
          {logs.length === 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'inherit' }}>
              Press &quot;Play Sleep&quot; to start
            </Typography>
          )}
          {logs.map((line, i) => (
            <Box
              key={i}
              sx={{
                borderLeft: line.includes('Scaled') ? '3px solid #22C55E' : line.includes('Scaling') ? '3px solid #F59E0B' : '3px solid transparent',
                pl: 1,
                animation: 'wfLogIn 200ms ease-out',
                '@keyframes wfLogIn': { from: { opacity: 0, transform: 'translateX(8px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
                color: line.includes('error') ? '#F87171' : line.includes('completed') ? '#86efac' : 'inherit',
              }}
            >
              {line}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}
