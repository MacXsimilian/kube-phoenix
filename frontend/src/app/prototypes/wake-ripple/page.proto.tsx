'use client'

import { useState, useRef, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import { useRouter } from 'next/navigation'
import gsap from 'gsap'

interface WaveNode { name: string; x: number; y: number; state: 'sleeping' | 'waking' | 'awake' }

const GRID_COLS = 6
const GRID_ROWS = 4

function generateNodes(): WaveNode[] {
  const names = [
    'api-server', 'web-fe', 'worker-1', 'worker-2', 'redis', 'postgres',
    'checkout', 'product', 'cart', 'payments', 'auth', 'gateway',
    'scheduler', 'notifier', 'indexer', 'search', 'cdn', 'logger',
    'metrics', 'tracer', 'config', 'secrets', 'proxy', 'dns',
  ]
  return names.map((name, i) => ({
    name,
    x: (i % GRID_COLS),
    y: Math.floor(i / GRID_COLS),
    state: 'sleeping' as const,
  }))
}

const STATE_COLORS = { sleeping: '#7C3AED40', waking: '#F59E0B', awake: '#22C55E' }

export default function WakeRipplePrototype() {
  const router = useRouter()
  const [nodes, setNodes] = useState<WaveNode[]>(generateNodes)
  const [animating, setAnimating] = useState(false)
  const cellRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const wakeRipple = useCallback(() => {
    if (animating) return
    setAnimating(true)
    const sorted = [...nodes].sort((a, b) => {
      const distA = Math.sqrt(a.x * a.x + a.y * a.y)
      const distB = Math.sqrt(b.x * b.x + b.y * b.y)
      return distA - distB
    })

    sorted.forEach((node, i) => {
      const delay = i * 120
      setTimeout(() => {
        setNodes(prev => prev.map(n => n.name === node.name ? { ...n, state: 'waking' } : n))
        const el = cellRefs.current[node.name]
        if (el) {
          gsap.fromTo(el, { scale: 0.85, boxShadow: '0 0 0 0 rgba(245,158,11,0)' },
            { scale: 1.05, boxShadow: '0 0 16px rgba(245,158,11,0.4)', duration: 0.3, ease: 'power2.out' })
        }
      }, delay)

      setTimeout(() => {
        setNodes(prev => prev.map(n => n.name === node.name ? { ...n, state: 'awake' } : n))
        const el = cellRefs.current[node.name]
        if (el) {
          gsap.to(el, { scale: 1, boxShadow: '0 0 8px rgba(34,197,94,0.3)', duration: 0.3, ease: 'power2.inOut' })
        }
        if (i === sorted.length - 1) setAnimating(false)
      }, delay + 300)
    })
  }, [animating, nodes])

  const sleepAll = useCallback(() => {
    if (animating) return
    setAnimating(true)
    const sorted = [...nodes].sort((a, b) => {
      const distA = Math.sqrt((a.x - GRID_COLS) ** 2 + (a.y - GRID_ROWS) ** 2)
      const distB = Math.sqrt((b.x - GRID_COLS) ** 2 + (b.y - GRID_ROWS) ** 2)
      return distA - distB
    })

    sorted.forEach((node, i) => {
      setTimeout(() => {
        setNodes(prev => prev.map(n => n.name === node.name ? { ...n, state: 'sleeping' } : n))
        const el = cellRefs.current[node.name]
        if (el) {
          gsap.to(el, { scale: 0.9, boxShadow: '0 0 0 rgba(0,0,0,0)', duration: 0.3, ease: 'power2.in',
            onComplete: () => { gsap.to(el, { scale: 1, duration: 0.2 }) } })
        }
        if (i === sorted.length - 1) setAnimating(false)
      }, i * 80)
    })
  }, [animating, nodes])

  const allSleeping = nodes.every(n => n.state === 'sleeping')
  const allAwake = nodes.every(n => n.state === 'awake')

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small"><ArrowBackIcon fontSize="small" /></IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>I7 — Wake Ripple</Typography>
          <Typography variant="body2" color="text.secondary">Workloads wake in a radial ripple pattern from top-left — each cell lights up as the wave passes through</Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', alignItems: 'center' }}>
        <Button variant="contained" size="small" startIcon={<WbSunnyIcon fontSize="small" />} onClick={wakeRipple} disabled={animating || allAwake} color="success">Wake Ripple</Button>
        <Button variant="contained" size="small" startIcon={<BedtimeIcon fontSize="small" />} onClick={sleepAll} disabled={animating || allSleeping} sx={{ bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' } }}>Sleep All</Button>
      </Box>

      <Box sx={{
        display: 'grid', gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`, gap: 1,
        p: 2, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
      }}>
        {nodes.map(node => (
          <Box
            key={node.name}
            ref={(el: HTMLDivElement | null) => { cellRefs.current[node.name] = el }}
            sx={{
              p: 1.5, borderRadius: 2, textAlign: 'center',
              bgcolor: STATE_COLORS[node.state],
              transition: 'background-color 300ms ease',
              border: '1px solid',
              borderColor: node.state === 'awake' ? 'rgba(34,197,94,0.3)' : node.state === 'waking' ? 'rgba(245,158,11,0.4)' : 'rgba(124,58,237,0.15)',
            }}
          >
            <Typography variant="caption" sx={{
              fontFamily: 'monospace', fontSize: 10, fontWeight: 600,
              color: node.state === 'sleeping' ? '#a5b4fc' : node.state === 'waking' ? '#FCD34D' : '#86efac',
              transition: 'color 300ms ease',
            }}>
              {node.name}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
