'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import ButtonGroup from '@mui/material/ButtonGroup'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Chip from '@mui/material/Chip'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import ReplayIcon from '@mui/icons-material/Replay'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PodStatus = 'running' | 'sleeping' | 'pending' | 'failed' | 'terminating'

interface Pod {
  id: string
  name: string
  workload: string
  namespace: string
  node: string
  status: PodStatus
  cpu: number
  memory: number
  restarts: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<PodStatus, string> = {
  running: '#22C55E',
  sleeping: '#7C3AED',
  pending: '#F59E0B',
  failed: '#EF4444',
  terminating: '#64748B',
}

const NODE_BORDERS: Record<string, string> = {
  'node-1': '#06B6D4',
  'node-2': '#3B82F6',
  'node-3': '#F59E0B',
  'node-4': '#EC4899',
  'node-5': '#8B5CF6',
  'node-6': '#10B981',
}

const NAMESPACE_BG: Record<string, string> = {
  production: 'rgba(34,197,94,0.06)',
  staging: 'rgba(59,130,246,0.06)',
  dev: 'rgba(245,158,11,0.06)',
  monitoring: 'rgba(139,92,246,0.06)',
  'kube-system': 'rgba(100,116,139,0.06)',
}

const DOT_SIZE = 16
const DOT_GAP = 2
const WORKLOAD_GAP = 12
const NAMESPACE_GAP = 24

const NODES = ['node-1', 'node-2', 'node-3', 'node-4', 'node-5', 'node-6']

// ---------------------------------------------------------------------------
// Mock Data Builder
// ---------------------------------------------------------------------------

interface WorkloadDef {
  name: string
  replicas: number
}

const NAMESPACE_WORKLOADS: Record<string, WorkloadDef[]> = {
  production: [
    { name: 'api-gateway', replicas: 3 },
    { name: 'web-frontend', replicas: 2 },
    { name: 'order-service', replicas: 2 },
    { name: 'payment-service', replicas: 2 },
    { name: 'user-service', replicas: 2 },
    { name: 'notification-svc', replicas: 1 },
    { name: 'postgres', replicas: 3 },
    { name: 'redis', replicas: 3 },
  ],
  staging: [
    { name: 'api-gateway', replicas: 1 },
    { name: 'web-frontend', replicas: 1 },
    { name: 'order-service', replicas: 1 },
    { name: 'payment-service', replicas: 1 },
    { name: 'postgres', replicas: 1 },
    { name: 'redis', replicas: 1 },
  ],
  dev: [
    { name: 'api-gateway', replicas: 1 },
    { name: 'web-frontend', replicas: 1 },
    { name: 'feature-branch-svc', replicas: 1 },
    { name: 'postgres', replicas: 1 },
  ],
  monitoring: [
    { name: 'prometheus', replicas: 1 },
    { name: 'grafana', replicas: 1 },
    { name: 'alertmanager', replicas: 1 },
    { name: 'loki', replicas: 1 },
  ],
  'kube-system': [
    { name: 'coredns', replicas: 2 },
    { name: 'kube-proxy', replicas: 3 },
    { name: 'metrics-server', replicas: 1 },
  ],
}

const NAMESPACE_ORDER = ['production', 'staging', 'dev', 'monitoring', 'kube-system']

function buildPods(): Pod[] {
  const pods: Pod[] = []
  let nodeIdx = 0
  for (const ns of NAMESPACE_ORDER) {
    for (const wl of NAMESPACE_WORKLOADS[ns]) {
      for (let i = 0; i < wl.replicas; i++) {
        pods.push({
          id: `${ns}/${wl.name}-${i}`,
          name: `${wl.name}-${randomSuffix()}`,
          workload: wl.name,
          namespace: ns,
          node: NODES[nodeIdx % NODES.length],
          status: 'running',
          cpu: 10 + Math.random() * 60,
          memory: 20 + Math.random() * 50,
          restarts: Math.floor(Math.random() * 3),
        })
        nodeIdx++
      }
    }
  }
  return pods
}

function randomSuffix(): string {
  return Math.random().toString(36).substring(2, 7)
}

// ---------------------------------------------------------------------------
// Stat Counter (animated)
// ---------------------------------------------------------------------------

function AnimatedCounter({ value, color }: { value: number; color: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const prevValue = useRef(value)

  useEffect(() => {
    if (!ref.current) return
    const obj = { val: prevValue.current }
    gsap.to(obj, {
      val: value,
      duration: 0.5,
      ease: 'power2.out',
      onUpdate: () => {
        if (ref.current) ref.current.textContent = String(Math.round(obj.val))
      },
    })
    prevValue.current = value
  }, [value])

  return (
    <span ref={ref} style={{ color, fontWeight: 700, fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>
      {value}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Single Dot Component
// ---------------------------------------------------------------------------

interface DotProps {
  pod: Pod
  dotRef: (el: HTMLDivElement | null) => void
  onHoverWorkload: (wl: string | null) => void
  onHoverNamespace: (ns: string | null) => void
  highlightWorkload: string | null
  highlightNamespace: string | null
}

function DotView({ pod, dotRef, onHoverWorkload, onHoverNamespace, highlightWorkload, highlightNamespace }: DotProps) {
  const isHighlighted =
    highlightWorkload === `${pod.namespace}/${pod.workload}` ||
    highlightNamespace === pod.namespace
  const isDimmed =
    (highlightWorkload !== null && highlightWorkload !== `${pod.namespace}/${pod.workload}`) ||
    (highlightNamespace !== null && highlightNamespace !== pod.namespace)

  const opacity = pod.status === 'sleeping' ? 0.3 : isDimmed ? 0.25 : 1
  const scale = isHighlighted ? 1.25 : 1
  const glow = isHighlighted ? `0 0 6px 2px ${STATUS_COLORS[pod.status]}` : 'none'

  return (
    <Tooltip
      title={
        <Box sx={{ fontSize: 11, lineHeight: 1.5 }}>
          <div><b>{pod.name}</b></div>
          <div>Workload: {pod.workload}</div>
          <div>Namespace: {pod.namespace}</div>
          <div>Node: {pod.node}</div>
          <div>Status: {pod.status}</div>
          <div>CPU: {pod.cpu.toFixed(1)}%</div>
          <div>Memory: {pod.memory.toFixed(1)}%</div>
          <div>Restarts: {pod.restarts}</div>
        </Box>
      }
      arrow
      placement="top"
    >
      <div
        ref={dotRef}
        data-pod-id={pod.id}
        style={{
          width: DOT_SIZE,
          height: DOT_SIZE,
          borderRadius: '50%',
          backgroundColor: STATUS_COLORS[pod.status],
          borderBottom: `3px solid ${NODE_BORDERS[pod.node] ?? '#555'}`,
          opacity,
          transform: `scale(${scale})`,
          transition: 'opacity 0.2s, transform 0.2s',
          boxShadow: glow,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      />
    </Tooltip>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function TopologyDotMatrixPage() {
  const router = useRouter()
  const [pods, setPods] = useState<Pod[]>(() => buildPods())
  const [simulating, setSimulating] = useState(false)
  const [groupBy, setGroupBy] = useState<'namespace' | 'node'>('namespace')
  const [highlightWorkload, setHighlightWorkload] = useState<string | null>(null)
  const [highlightNamespace, setHighlightNamespace] = useState<string | null>(null)
  const [sleepingNamespaces, setSleepingNamespaces] = useState<Set<string>>(new Set())
  const [animatingNamespaces, setAnimatingNamespaces] = useState<Set<string>>(new Set())

  const dotRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const setDotRef = useCallback((podId: string) => {
    return (el: HTMLDivElement | null) => {
      if (el) dotRefs.current.set(podId, el)
      else dotRefs.current.delete(podId)
    }
  }, [])

  // -----------------------------------------------------------------------
  // Stats
  // -----------------------------------------------------------------------

  const stats = useMemo(() => {
    const s = { total: 0, running: 0, sleeping: 0, pending: 0, failed: 0, workloads: new Set<string>() }
    for (const p of pods) {
      s.total++
      if (p.status === 'running') s.running++
      else if (p.status === 'sleeping') s.sleeping++
      else if (p.status === 'pending') s.pending++
      else if (p.status === 'failed') s.failed++
      s.workloads.add(`${p.namespace}/${p.workload}`)
    }
    return { ...s, workloadCount: s.workloads.size }
  }, [pods])

  // -----------------------------------------------------------------------
  // Grouping
  // -----------------------------------------------------------------------

  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, Pod[]>>()
    if (groupBy === 'namespace') {
      for (const ns of NAMESPACE_ORDER) {
        const wlMap = new Map<string, Pod[]>()
        for (const p of pods) {
          if (p.namespace !== ns) continue
          const list = wlMap.get(p.workload) ?? []
          list.push(p)
          wlMap.set(p.workload, list)
        }
        if (wlMap.size > 0) map.set(ns, wlMap)
      }
    } else {
      for (const node of NODES) {
        const wlMap = new Map<string, Pod[]>()
        for (const p of pods) {
          if (p.node !== node) continue
          const key = `${p.namespace}/${p.workload}`
          const list = wlMap.get(key) ?? []
          list.push(p)
          wlMap.set(key, list)
        }
        if (wlMap.size > 0) map.set(node, wlMap)
      }
    }
    return map
  }, [pods, groupBy])

  // -----------------------------------------------------------------------
  // Sleep / Wake
  // -----------------------------------------------------------------------

  const sleepNamespace = useCallback((ns: string) => {
    if (animatingNamespaces.has(ns)) return
    setAnimatingNamespaces(prev => new Set(prev).add(ns))

    const nsPods = pods.filter(p => p.namespace === ns && p.status === 'running')
    const sortedPods = [...nsPods]

    sortedPods.forEach((pod, i) => {
      const el = dotRefs.current.get(pod.id)
      if (!el) return
      gsap.to(el, {
        scale: 0.6,
        backgroundColor: '#475569',
        opacity: 0.3,
        duration: 0.3,
        delay: i * 0.06,
        ease: 'power2.inOut',
      })
    })

    const totalDuration = sortedPods.length * 60 + 300
    setTimeout(() => {
      setPods(prev =>
        prev.map(p => (p.namespace === ns && p.status === 'running' ? { ...p, status: 'sleeping' as PodStatus } : p)),
      )
      setSleepingNamespaces(prev => new Set(prev).add(ns))
      setAnimatingNamespaces(prev => {
        const next = new Set(prev)
        next.delete(ns)
        return next
      })
    }, totalDuration)
  }, [pods, animatingNamespaces])

  const wakeNamespace = useCallback((ns: string) => {
    if (animatingNamespaces.has(ns)) return
    setAnimatingNamespaces(prev => new Set(prev).add(ns))

    const nsPods = pods.filter(p => p.namespace === ns && p.status === 'sleeping')

    setPods(prev =>
      prev.map(p => (p.namespace === ns && p.status === 'sleeping' ? { ...p, status: 'running' as PodStatus } : p)),
    )
    setSleepingNamespaces(prev => {
      const next = new Set(prev)
      next.delete(ns)
      return next
    })

    setTimeout(() => {
      nsPods.forEach((pod, i) => {
        const el = dotRefs.current.get(pod.id)
        if (!el) return
        const tl = gsap.timeline({ delay: i * 0.04 })
        tl.to(el, {
          scale: 1.2,
          backgroundColor: '#F59E0B',
          opacity: 1,
          duration: 0.15,
          ease: 'power2.out',
        })
        tl.to(el, {
          scale: 1.0,
          backgroundColor: '#22C55E',
          boxShadow: '0 0 8px 3px rgba(34,197,94,0.6)',
          duration: 0.2,
          ease: 'back.out(2)',
        })
        tl.to(el, {
          boxShadow: 'none',
          duration: 0.4,
          ease: 'power2.out',
        })
      })

      const totalDuration = nsPods.length * 40 + 800
      setTimeout(() => {
        setAnimatingNamespaces(prev => {
          const next = new Set(prev)
          next.delete(ns)
          return next
        })
      }, totalDuration)
    }, 20)
  }, [pods, animatingNamespaces])

  // -----------------------------------------------------------------------
  // Simulation
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!simulating) {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current)
      simIntervalRef.current = null
      return
    }

    simIntervalRef.current = setInterval(() => {
      setPods(prev => {
        const next = [...prev]
        const changes = 1 + Math.floor(Math.random() * 2)
        for (let c = 0; c < changes; c++) {
          const activePods = next.filter(p => p.status === 'running')
          if (activePods.length === 0) continue
          const target = activePods[Math.floor(Math.random() * activePods.length)]
          const idx = next.findIndex(p => p.id === target.id)

          const roll = Math.random()
          if (roll < 0.7) {
            next[idx] = { ...target, cpu: Math.max(5, Math.min(95, target.cpu + (Math.random() - 0.5) * 20)) }
            const el = dotRefs.current.get(target.id)
            if (el) {
              const brightness = 0.7 + (next[idx].cpu / 100) * 0.5
              gsap.to(el, { filter: `brightness(${brightness})`, duration: 0.4 })
            }
          } else if (roll < 0.9) {
            next[idx] = { ...target, status: 'pending' }
            const el = dotRefs.current.get(target.id)
            if (el) gsap.to(el, { backgroundColor: STATUS_COLORS.pending, duration: 0.3 })
            setTimeout(() => {
              setPods(p =>
                p.map(pod =>
                  pod.id === target.id && pod.status === 'pending'
                    ? { ...pod, status: 'running' }
                    : pod,
                ),
              )
              const el2 = dotRefs.current.get(target.id)
              if (el2) gsap.to(el2, { backgroundColor: STATUS_COLORS.running, filter: 'brightness(1)', duration: 0.3 })
            }, 2000 + Math.random() * 2000)
          } else {
            next[idx] = { ...target, status: 'failed', restarts: target.restarts + 1 }
            const el = dotRefs.current.get(target.id)
            if (el) {
              gsap.to(el, { backgroundColor: STATUS_COLORS.failed, duration: 0.2 })
              gsap.to(el, {
                scale: 1.15,
                repeat: 5,
                yoyo: true,
                duration: 0.25,
                ease: 'power1.inOut',
              })
            }
            setTimeout(() => {
              setPods(p =>
                p.map(pod =>
                  pod.id === target.id && pod.status === 'failed'
                    ? { ...pod, status: 'running' }
                    : pod,
                ),
              )
              const el2 = dotRefs.current.get(target.id)
              if (el2) {
                gsap.to(el2, { backgroundColor: STATUS_COLORS.running, scale: 1, filter: 'brightness(1)', duration: 0.3 })
              }
            }, 3000 + Math.random() * 3000)
          }
        }
        return next
      })
    }, 1000)

    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current)
    }
  }, [simulating])

  // -----------------------------------------------------------------------
  // Reset
  // -----------------------------------------------------------------------

  const handleReset = useCallback(() => {
    setSimulating(false)
    setSleepingNamespaces(new Set())
    setAnimatingNamespaces(new Set())
    setPods(buildPods())
    dotRefs.current.forEach(el => {
      gsap.set(el, { scale: 1, opacity: 1, filter: 'brightness(1)', boxShadow: 'none', clearProps: 'backgroundColor' })
    })
  }, [])

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current)
    }
  }, [])

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const sleepableNamespaces = ['production', 'staging', 'dev']

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0A0A0F', color: '#E2E8F0', p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small" sx={{ color: '#94A3B8' }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography variant="h5" fontWeight={700} sx={{ fontSize: 20 }}>
          G3-v6 — Dot Matrix
        </Typography>
      </Box>

      {/* Controls */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={simulating ? <PauseIcon /> : <PlayArrowIcon />}
          onClick={() => setSimulating(s => !s)}
          sx={{ borderColor: '#334155', color: '#E2E8F0', textTransform: 'none', fontSize: 12 }}
        >
          {simulating ? 'Pause' : 'Simulate'}
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<ReplayIcon />}
          onClick={handleReset}
          sx={{ borderColor: '#334155', color: '#E2E8F0', textTransform: 'none', fontSize: 12 }}
        >
          Reset
        </Button>

        <Box sx={{ borderLeft: '1px solid #1E293B', height: 24, mx: 0.5 }} />

        {sleepableNamespaces.map(ns => {
          const isSleeping = sleepingNamespaces.has(ns)
          const isAnimating = animatingNamespaces.has(ns)
          return (
            <Button
              key={ns}
              size="small"
              variant="outlined"
              disabled={isAnimating}
              startIcon={isSleeping ? <WbSunnyIcon /> : <DarkModeIcon />}
              onClick={() => (isSleeping ? wakeNamespace(ns) : sleepNamespace(ns))}
              sx={{
                borderColor: isSleeping ? '#7C3AED' : '#334155',
                color: isSleeping ? '#A78BFA' : '#E2E8F0',
                textTransform: 'none',
                fontSize: 12,
              }}
            >
              {isSleeping ? `Wake ${ns}` : `Sleep ${ns}`}
            </Button>
          )
        })}

        <Box sx={{ borderLeft: '1px solid #1E293B', height: 24, mx: 0.5 }} />

        <Typography variant="caption" sx={{ color: '#64748B', fontSize: 11, mr: 0.5 }}>
          Group by:
        </Typography>
        <ButtonGroup size="small" sx={{ '& .MuiButton-root': { textTransform: 'none', fontSize: 11, px: 1.5 } }}>
          <Button
            variant={groupBy === 'namespace' ? 'contained' : 'outlined'}
            onClick={() => setGroupBy('namespace')}
            sx={{
              bgcolor: groupBy === 'namespace' ? '#1E293B' : 'transparent',
              borderColor: '#334155',
              color: '#E2E8F0',
              '&:hover': { bgcolor: '#1E293B' },
            }}
          >
            Namespace
          </Button>
          <Button
            variant={groupBy === 'node' ? 'contained' : 'outlined'}
            onClick={() => setGroupBy('node')}
            sx={{
              bgcolor: groupBy === 'node' ? '#1E293B' : 'transparent',
              borderColor: '#334155',
              color: '#E2E8F0',
              '&:hover': { bgcolor: '#1E293B' },
            }}
          >
            Node
          </Button>
        </ButtonGroup>
      </Box>

      {/* Stats Bar */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 3,
          mb: 3,
          p: 2,
          borderRadius: 2,
          bgcolor: '#111118',
          border: '1px solid #1E293B',
        }}
      >
        <StatItem label="Total Replicas" value={stats.total} color="#E2E8F0" />
        <StatItem label="Running" value={stats.running} color={STATUS_COLORS.running} />
        <StatItem label="Sleeping" value={stats.sleeping} color={STATUS_COLORS.sleeping} />
        <StatItem label="Pending" value={stats.pending} color={STATUS_COLORS.pending} />
        <StatItem label="Failed" value={stats.failed} color={STATUS_COLORS.failed} />
        <StatItem label="Workloads" value={stats.workloadCount} color="#94A3B8" />
      </Box>

      {/* Legend */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <LegendSection title="Status">
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <LegendDot key={status} color={color} label={status} />
          ))}
        </LegendSection>
        <LegendSection title="Node (border)">
          {Object.entries(NODE_BORDERS).map(([node, color]) => (
            <LegendDot key={node} color={color} label={node} border />
          ))}
        </LegendSection>
      </Box>

      {/* Dot Matrix */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={groupBy}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          style={{ display: 'flex', flexDirection: 'column', gap: NAMESPACE_GAP }}
        >
          {Array.from(grouped.entries()).map(([groupKey, workloads]) => (
            <NamespaceSection
              key={groupKey}
              groupKey={groupKey}
              groupBy={groupBy}
              workloads={workloads}
              isSleeping={sleepingNamespaces.has(groupKey)}
              setDotRef={setDotRef}
              highlightWorkload={highlightWorkload}
              highlightNamespace={highlightNamespace}
              onHoverWorkload={setHighlightWorkload}
              onHoverNamespace={setHighlightNamespace}
            />
          ))}
        </motion.div>
      </AnimatePresence>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Namespace / Group Section
// ---------------------------------------------------------------------------

interface NamespaceSectionProps {
  groupKey: string
  groupBy: 'namespace' | 'node'
  workloads: Map<string, Pod[]>
  isSleeping: boolean
  setDotRef: (podId: string) => (el: HTMLDivElement | null) => void
  highlightWorkload: string | null
  highlightNamespace: string | null
  onHoverWorkload: (wl: string | null) => void
  onHoverNamespace: (ns: string | null) => void
}

function NamespaceSection({
  groupKey,
  groupBy,
  workloads,
  isSleeping,
  setDotRef,
  highlightWorkload,
  highlightNamespace,
  onHoverWorkload,
  onHoverNamespace,
}: NamespaceSectionProps) {
  const bg = groupBy === 'namespace' ? (NAMESPACE_BG[groupKey] ?? 'rgba(255,255,255,0.02)') : 'rgba(255,255,255,0.02)'

  return (
    <Box
      sx={{
        borderRadius: 2,
        border: '1px solid #1E293B',
        bgcolor: bg,
        p: 2,
        opacity: isSleeping ? 0.6 : 1,
        transition: 'opacity 0.5s',
      }}
      onMouseEnter={() => groupBy === 'namespace' && onHoverNamespace(groupKey)}
      onMouseLeave={() => onHoverNamespace(null)}
    >
      {/* Section Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Typography
          variant="subtitle2"
          sx={{
            fontFamily: 'monospace',
            fontSize: 13,
            fontWeight: 700,
            color: isSleeping ? '#64748B' : '#CBD5E1',
            letterSpacing: 0.5,
          }}
        >
          {groupKey}
        </Typography>
        {isSleeping && (
          <Chip
            label="SLEEPING"
            size="small"
            icon={<DarkModeIcon sx={{ fontSize: 12 }} />}
            sx={{
              height: 20,
              fontSize: 10,
              fontWeight: 700,
              bgcolor: 'rgba(124,58,237,0.15)',
              color: '#A78BFA',
              '& .MuiChip-icon': { color: '#A78BFA' },
            }}
          />
        )}
        {groupBy === 'node' && (
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: NODE_BORDERS[groupKey] ?? '#555',
              ml: 0.5,
            }}
          />
        )}
      </Box>

      {/* Workload Rows */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${WORKLOAD_GAP}px` }}>
        {Array.from(workloads.entries()).map(([wlKey, wlPods]) => {
          const fullKey = groupBy === 'namespace' ? `${groupKey}/${wlKey}` : wlKey
          return (
            <Box key={wlKey} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography
                variant="caption"
                sx={{
                  fontFamily: 'monospace',
                  fontSize: 11,
                  color: '#64748B',
                  width: 140,
                  textAlign: 'right',
                  flexShrink: 0,
                  cursor: 'pointer',
                  transition: 'color 0.15s',
                  '&:hover': { color: '#E2E8F0' },
                }}
                onMouseEnter={() => onHoverWorkload(fullKey)}
                onMouseLeave={() => onHoverWorkload(null)}
              >
                {groupBy === 'namespace' ? wlKey : wlKey.split('/').pop()}
              </Typography>
              <Box sx={{ display: 'flex', gap: `${DOT_GAP}px`, flexWrap: 'wrap' }}>
                {wlPods.map(pod => (
                  <DotView
                    key={pod.id}
                    pod={pod}
                    dotRef={setDotRef(pod.id)}
                    onHoverWorkload={onHoverWorkload}
                    onHoverNamespace={onHoverNamespace}
                    highlightWorkload={highlightWorkload}
                    highlightNamespace={highlightNamespace}
                  />
                ))}
              </Box>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Stat Item
// ---------------------------------------------------------------------------

function StatItem({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 70 }}>
      <AnimatedCounter value={value} color={color} />
      <Typography variant="caption" sx={{ color: '#64748B', fontSize: 10, mt: 0.25 }}>
        {label}
      </Typography>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

function LegendSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Typography variant="caption" sx={{ color: '#475569', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>
        {title}:
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>{children}</Box>
    </Box>
  )
}

function LegendDot({ color, label, border }: { color: string; label: string; border?: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Box
        sx={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          bgcolor: border ? '#475569' : color,
          borderBottom: border ? `3px solid ${color}` : 'none',
        }}
      />
      <Typography variant="caption" sx={{ color: '#64748B', fontSize: 10, textTransform: 'capitalize' }}>
        {label}
      </Typography>
    </Box>
  )
}
