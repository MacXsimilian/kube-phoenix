'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ReplayIcon from '@mui/icons-material/Replay'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import { useRouter } from 'next/navigation'
import gsap from 'gsap'

type NodeState = 'active' | 'cordoned' | 'draining' | 'deleted'

const STATE_COLORS: Record<NodeState, string> = {
  active: '#22C55E',
  cordoned: '#F59E0B',
  draining: '#EF4444',
  deleted: '#475569',
}

const STATE_LABELS: Record<NodeState, string> = {
  active: 'Active',
  cordoned: 'Cordoned',
  draining: 'Draining',
  deleted: 'Drained',
}

interface NodeCell {
  name: string
  state: NodeState
  pods: number
}

const INITIAL_NODES: NodeCell[] = [
  { name: 'node-1', state: 'active', pods: 12 },
  { name: 'node-2', state: 'active', pods: 8 },
  { name: 'node-3', state: 'active', pods: 3 },
  { name: 'node-4', state: 'active', pods: 0 },
  { name: 'node-5', state: 'active', pods: 6 },
  { name: 'node-6', state: 'active', pods: 10 },
]

const DRAIN_SEQUENCE: { node: string; state: NodeState; delay: number }[] = [
  { node: 'node-4', state: 'cordoned', delay: 500 },
  { node: 'node-3', state: 'cordoned', delay: 800 },
  { node: 'node-4', state: 'draining', delay: 1200 },
  { node: 'node-3', state: 'draining', delay: 1800 },
  { node: 'node-4', state: 'deleted', delay: 2500 },
  { node: 'node-5', state: 'cordoned', delay: 3000 },
  { node: 'node-3', state: 'deleted', delay: 3500 },
  { node: 'node-5', state: 'draining', delay: 4000 },
  { node: 'node-5', state: 'deleted', delay: 5000 },
]

function NodeCellBox({ node, cellRef }: { node: NodeCell; cellRef: (el: HTMLDivElement | null) => void }) {
  return (
    <Box
      ref={cellRef}
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: STATE_COLORS[node.state],
        transition: 'background-color 300ms ease',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.5,
        minHeight: 90,
        justifyContent: 'center',
      }}
    >
      <Typography variant="body2" fontWeight={700} sx={{ color: '#0F0F13', fontSize: 13 }}>
        {node.name}
      </Typography>
      <Typography variant="caption" sx={{ color: 'rgba(0,0,0,0.6)', fontSize: 11 }}>
        {node.pods} pods
      </Typography>
      <Typography variant="caption" sx={{ color: 'rgba(0,0,0,0.5)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>
        {STATE_LABELS[node.state]}
      </Typography>
    </Box>
  )
}

export default function NodeDrainGridPrototype() {
  const router = useRouter()
  const [nodes, setNodes] = useState<NodeCell[]>(INITIAL_NODES)
  const [running, setRunning] = useState(false)
  const [logLines, setLogLines] = useState<string[]>([])
  const cellRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const reset = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
    setNodes(INITIAL_NODES)
    setLogLines([])
    setRunning(false)
  }, [])

  const play = useCallback(() => {
    reset()
    setTimeout(() => {
      setRunning(true)
      setLogLines(['Starting drain operation...'])

      for (const step of DRAIN_SEQUENCE) {
        const t = setTimeout(() => {
          setNodes(prev => prev.map(n =>
            n.name === step.node ? { ...n, state: step.state, pods: step.state === 'deleted' ? 0 : n.pods } : n
          ))
          setLogLines(prev => [...prev, `${step.state === 'cordoned' ? 'Cordoning' : step.state === 'draining' ? 'Draining' : 'Drain complete:'} ${step.node}`])

          const el = cellRefs.current[step.node]
          if (!el) return

          if (step.state === 'cordoned') {
            gsap.fromTo(el, { scale: 1 }, { scale: 1.05, duration: 0.15, yoyo: true, repeat: 1 })
          } else if (step.state === 'draining') {
            gsap.fromTo(el, { x: 0 }, { x: -3, duration: 0.05, yoyo: true, repeat: 5 })
          } else if (step.state === 'deleted') {
            gsap.to(el, { opacity: 0.5, duration: 0.5 })
          }
        }, step.delay)
        timeoutsRef.current.push(t)
      }

      const endT = setTimeout(() => {
        setLogLines(prev => [...prev, 'Drain operation complete.'])
        setRunning(false)
      }, 5500)
      timeoutsRef.current.push(endT)
    }, 50)
  }, [reset])

  useEffect(() => () => timeoutsRef.current.forEach(clearTimeout), [])

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>F5 — Node Drain Grid</Typography>
          <Typography variant="body2" color="text.secondary">
            Real-time node state visualization with GSAP cell transitions
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', alignItems: 'center' }}>
        <Button variant="contained" size="small" startIcon={<PlayArrowIcon fontSize="small" />} onClick={play} disabled={running}>
          Play Drain
        </Button>
        <Button variant="outlined" size="small" startIcon={<ReplayIcon fontSize="small" />} onClick={reset}>
          Reset
        </Button>
        <Box sx={{ display: 'flex', gap: 2, ml: 'auto' }}>
          {(['active', 'cordoned', 'draining', 'deleted'] as NodeState[]).map(s => (
            <Box key={s} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: 1, bgcolor: STATE_COLORS[s] }} />
              <Typography variant="caption" color="text.secondary">{STATE_LABELS[s]}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 3 }}>
        {nodes.map(node => (
          <NodeCellBox
            key={node.name}
            node={node}
            cellRef={(el) => { cellRefs.current[node.name] = el }}
          />
        ))}
      </Box>

      {/* Log feed */}
      <Box sx={{
        p: 1.5, borderRadius: 2, bgcolor: '#0A0A0F', border: '1px solid', borderColor: 'divider',
        fontFamily: 'monospace', fontSize: 12, lineHeight: 1.8, maxHeight: 200, overflow: 'auto',
      }}>
        {logLines.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'inherit' }}>
            Press &quot;Play Drain&quot; to start the simulation
          </Typography>
        )}
        {logLines.map((line, i) => (
          <Box
            key={i}
            sx={{
              animation: 'drainLogIn 200ms ease-out',
              '@keyframes drainLogIn': { from: { opacity: 0, transform: 'translateX(8px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
            }}
          >
            {line}
          </Box>
        ))}
      </Box>
    </Box>
  )
}
