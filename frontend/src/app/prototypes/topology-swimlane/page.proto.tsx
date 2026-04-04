'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import ReplayIcon from '@mui/icons-material/Replay'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

/* ─── Types ─── */

type PodState = 'running' | 'sleeping' | 'pending' | 'failed'

interface Pod {
  id: string
  name: string
  workloadId: string
  namespace: string
  node: string
  state: PodState
  cpu: number
  memory: number
  restarts: number
}

interface Workload {
  id: string
  name: string
  kind: 'Deployment' | 'StatefulSet' | 'DaemonSet'
  namespace: string
  cpuUsage: number
}

interface NodeInfo {
  name: string
  cpuPercent: number
  podCount: number
  color: string
}

/* ─── Constants ─── */

const STATE_COLOR: Record<PodState, string> = {
  running: '#22C55E',
  sleeping: '#7C3AED',
  pending: '#F59E0B',
  failed: '#EF4444',
}

const NODE_COLORS = ['#3B82F6', '#F97316', '#EC4899']

const NAMESPACES = ['dev', 'staging', 'monitoring', 'kube-system'] as const

const NODES: NodeInfo[] = [
  { name: 'node-1', cpuPercent: 65, podCount: 0, color: NODE_COLORS[0] },
  { name: 'node-2', cpuPercent: 45, podCount: 0, color: NODE_COLORS[1] },
  { name: 'node-3', cpuPercent: 28, podCount: 0, color: NODE_COLORS[2] },
]

/* ─── Mock data generators ─── */

function generateWorkloads(): Workload[] {
  return [
    { id: 'w-api', name: 'api-server', kind: 'Deployment', namespace: 'dev', cpuUsage: 340 },
    { id: 'w-web', name: 'web-frontend', kind: 'Deployment', namespace: 'dev', cpuUsage: 220 },
    { id: 'w-redis', name: 'redis', kind: 'StatefulSet', namespace: 'dev', cpuUsage: 120 },
    { id: 'w-worker', name: 'worker', kind: 'Deployment', namespace: 'dev', cpuUsage: 180 },
    { id: 'w-checkout', name: 'checkout-svc', kind: 'Deployment', namespace: 'staging', cpuUsage: 260 },
    { id: 'w-product', name: 'product-api', kind: 'Deployment', namespace: 'staging', cpuUsage: 310 },
    { id: 'w-postgres', name: 'postgres', kind: 'StatefulSet', namespace: 'staging', cpuUsage: 400 },
    { id: 'w-prom', name: 'prometheus', kind: 'StatefulSet', namespace: 'monitoring', cpuUsage: 500 },
    { id: 'w-grafana', name: 'grafana', kind: 'Deployment', namespace: 'monitoring', cpuUsage: 180 },
    { id: 'w-alert', name: 'alertmanager', kind: 'Deployment', namespace: 'monitoring', cpuUsage: 90 },
    { id: 'w-dns', name: 'coredns', kind: 'Deployment', namespace: 'kube-system', cpuUsage: 60 },
    { id: 'w-proxy', name: 'kube-proxy', kind: 'DaemonSet', namespace: 'kube-system', cpuUsage: 40 },
  ]
}

function generatePods(): Pod[] {
  const specs: Array<{ wId: string; ns: string; name: string; count: number; nodes: string[] }> = [
    { wId: 'w-api', ns: 'dev', name: 'api-server', count: 3, nodes: ['node-1', 'node-2', 'node-1'] },
    { wId: 'w-web', ns: 'dev', name: 'web-frontend', count: 2, nodes: ['node-1', 'node-2'] },
    { wId: 'w-redis', ns: 'dev', name: 'redis', count: 1, nodes: ['node-1'] },
    { wId: 'w-worker', ns: 'dev', name: 'worker', count: 2, nodes: ['node-2', 'node-3'] },
    { wId: 'w-checkout', ns: 'staging', name: 'checkout-svc', count: 2, nodes: ['node-2', 'node-3'] },
    { wId: 'w-product', ns: 'staging', name: 'product-api', count: 3, nodes: ['node-2', 'node-3', 'node-1'] },
    { wId: 'w-postgres', ns: 'staging', name: 'postgres', count: 1, nodes: ['node-3'] },
    { wId: 'w-prom', ns: 'monitoring', name: 'prometheus', count: 1, nodes: ['node-2'] },
    { wId: 'w-grafana', ns: 'monitoring', name: 'grafana', count: 1, nodes: ['node-2'] },
    { wId: 'w-alert', ns: 'monitoring', name: 'alertmanager', count: 1, nodes: ['node-3'] },
    { wId: 'w-dns', ns: 'kube-system', name: 'coredns', count: 2, nodes: ['node-1', 'node-3'] },
    { wId: 'w-proxy', ns: 'kube-system', name: 'kube-proxy', count: 3, nodes: ['node-1', 'node-2', 'node-3'] },
  ]
  const pods: Pod[] = []
  let id = 0
  for (const spec of specs) {
    for (let i = 0; i < spec.count; i++) {
      pods.push({
        id: `pod-${id++}`,
        name: `${spec.name}-${randomSuffix()}`,
        workloadId: spec.wId,
        namespace: spec.ns,
        node: spec.nodes[i],
        state: 'running',
        cpu: 50 + Math.random() * 300,
        memory: 64 + Math.random() * 256,
        restarts: Math.floor(Math.random() * 3),
      })
    }
  }
  return pods
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 7)
}

/* ─── Sub-components ─── */

function NodeSidebar({
  nodes,
  hoveredNode,
  onHoverNode,
}: {
  nodes: NodeInfo[]
  hoveredNode: string | null
  onHoverNode: (n: string | null) => void
}) {
  return (
    <Box sx={{ width: 110, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1, pt: 1 }}>
      <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 600, px: 1, mb: 0.5 }}>
        NODES
      </Typography>
      {nodes.map((node) => (
        <Box
          key={node.name}
          onMouseEnter={() => onHoverNode(node.name)}
          onMouseLeave={() => onHoverNode(null)}
          sx={{
            px: 1,
            py: 0.75,
            borderRadius: 1,
            border: `1px solid ${hoveredNode === node.name ? node.color : 'rgba(255,255,255,0.08)'}`,
            background: hoveredNode === node.name ? `${node.color}15` : 'rgba(255,255,255,0.03)',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <Typography variant="caption" sx={{ color: node.color, fontWeight: 600, fontSize: '0.65rem' }}>
            {node.name}
          </Typography>
          <Box sx={{ mt: 0.5, height: 3, borderRadius: 1, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <Box sx={{ height: '100%', width: `${node.cpuPercent}%`, background: node.color, borderRadius: 1, transition: 'width 0.3s' }} />
          </Box>
          <Typography variant="caption" sx={{ color: '#64748B', fontSize: '0.6rem', mt: 0.25, display: 'block' }}>
            CPU {node.cpuPercent}% · {node.podCount} pods
          </Typography>
        </Box>
      ))}
    </Box>
  )
}

function PodCircle({
  pod,
  hoveredNode,
  nodeColor,
}: {
  pod: Pod
  hoveredNode: string | null
  nodeColor: string
}) {
  const isHighlighted = hoveredNode === pod.node
  const color = STATE_COLOR[pod.state]

  return (
    <Tooltip
      title={
        <Box sx={{ fontSize: '0.7rem', lineHeight: 1.6 }}>
          <strong>{pod.name}</strong>
          <br />
          Node: {pod.node}
          <br />
          CPU: {pod.cpu.toFixed(0)}m · Mem: {pod.memory.toFixed(0)}Mi
          <br />
          Status: {pod.state} · Restarts: {pod.restarts}
        </Box>
      }
      arrow
      placement="top"
    >
      <motion.div
        layout
        animate={{
          backgroundColor: color,
          scale: isHighlighted ? 1.3 : 1,
          boxShadow:
            pod.state === 'failed'
              ? `0 0 8px 2px ${STATE_COLOR.failed}80`
              : isHighlighted
                ? `0 0 6px 2px ${nodeColor}60`
                : '0 0 0px 0px transparent',
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          cursor: 'pointer',
          border: isHighlighted ? `2px solid ${nodeColor}` : '2px solid transparent',
          flexShrink: 0,
        }}
      />
    </Tooltip>
  )
}

function WorkloadCard({
  workload,
  pods,
  isSleeping,
  hoveredNode,
}: {
  workload: Workload
  pods: Pod[]
  isSleeping: boolean
  hoveredNode: string | null
}) {
  const replicaCount = pods.length
  const runningCount = pods.filter((p) => p.state === 'running').length
  const borderColor = isSleeping
    ? '#475569'
    : runningCount === replicaCount
      ? '#22C55E40'
      : runningCount > 0
        ? '#F59E0B40'
        : '#EF444440'

  const kindColors: Record<string, string> = {
    Deployment: '#3B82F6',
    StatefulSet: '#8B5CF6',
    DaemonSet: '#F97316',
  }

  return (
    <Tooltip
      title={
        <Box sx={{ fontSize: '0.7rem', lineHeight: 1.6 }}>
          <strong>{workload.name}</strong>
          <br />
          Kind: {workload.kind} · Namespace: {workload.namespace}
          <br />
          Replicas: {runningCount}/{replicaCount} running
          <br />
          CPU: {workload.cpuUsage}m
        </Box>
      }
      arrow
      placement="top"
    >
      <motion.div
        layout
        animate={{ borderColor, opacity: isSleeping ? 0.5 : 1 }}
        transition={{ duration: 0.4 }}
        style={{
          border: '1px solid',
          borderRadius: 6,
          padding: '6px 8px',
          background: 'rgba(255,255,255,0.03)',
          minWidth: 90,
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
          <Typography sx={{ fontSize: '0.65rem', color: '#CBD5E1', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {workload.name}
          </Typography>
          <Box
            sx={{
              fontSize: '0.5rem',
              px: 0.5,
              py: '1px',
              borderRadius: 0.5,
              background: `${kindColors[workload.kind] ?? '#64748B'}25`,
              color: kindColors[workload.kind] ?? '#64748B',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            {workload.kind}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
          {pods.map((pod, i) => {
            const nodeInfo = NODES.find((n) => n.name === pod.node)
            return (
              <motion.div
                key={pod.id}
                initial={false}
                animate={{ opacity: 1 }}
                transition={{ delay: isSleeping ? i * 0.08 : i * 0.06 }}
              >
                <PodCircle pod={pod} hoveredNode={hoveredNode} nodeColor={nodeInfo?.color ?? '#64748B'} />
              </motion.div>
            )
          })}
        </Box>
      </motion.div>
    </Tooltip>
  )
}

function NamespaceLane({
  namespace,
  workloads,
  pods,
  isSleeping,
  isEven,
  hoveredNode,
}: {
  namespace: string
  workloads: Workload[]
  pods: Pod[]
  isSleeping: boolean
  isEven: boolean
  hoveredNode: string | null
}) {
  const laneWorkloads = workloads.filter((w) => w.namespace === namespace)
  const lanePods = pods.filter((p) => p.namespace === namespace)

  return (
    <motion.div
      layout
      animate={{ height: isSleeping ? 60 : 120 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: isEven ? 'rgba(255,255,255,0.02)' : 'transparent',
      }}
    >
      <motion.div
        animate={{ opacity: isSleeping ? 0.15 : 0 }}
        transition={{ duration: 0.6 }}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, #1E293B 0%, #0F172A 100%)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      <AnimatePresence>
        {isSleeping && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.6, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.4 }}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 2,
              pointerEvents: 'none',
            }}
          >
            <Box
              sx={{
                px: 2,
                py: 0.5,
                borderRadius: 1,
                background: 'rgba(124, 58, 237, 0.2)',
                border: '1px solid rgba(124, 58, 237, 0.3)',
              }}
            >
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#A78BFA', letterSpacing: 2 }}>
                SLEEPING
              </Typography>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      <Box sx={{ display: 'flex', height: '100%', position: 'relative', zIndex: 0 }}>
        <Box
          sx={{
            width: 90,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            px: 0.5,
          }}
        >
          <Typography
            sx={{
              fontSize: '0.7rem',
              fontWeight: 700,
              color: isSleeping ? '#475569' : '#94A3B8',
              textTransform: 'uppercase',
              letterSpacing: 1,
              writingMode: 'vertical-lr',
              transform: 'rotate(180deg)',
              transition: 'color 0.3s',
            }}
          >
            {namespace}
          </Typography>
        </Box>

        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 2,
            overflowX: 'auto',
            '&::-webkit-scrollbar': { height: 3 },
            '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.1)', borderRadius: 2 },
          }}
        >
          {laneWorkloads.map((wl) => {
            const wlPods = lanePods.filter((p) => p.workloadId === wl.id)
            return <WorkloadCard key={wl.id} workload={wl} pods={wlPods} isSleeping={isSleeping} hoveredNode={hoveredNode} />
          })}
        </Box>
      </Box>
    </motion.div>
  )
}

/* ─── Main Page ─── */

export default function TopologySwimlanePage() {
  const router = useRouter()
  const [pods, setPods] = useState<Pod[]>(() => generatePods())
  const [workloads] = useState<Workload[]>(() => generateWorkloads())
  const [sleepingNamespaces, setSleepingNamespaces] = useState<Set<string>>(new Set())
  const [isSimulating, setIsSimulating] = useState(false)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [eventCount, setEventCount] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const nodeStats = useMemo(() => {
    return NODES.map((n) => ({
      ...n,
      podCount: pods.filter((p) => p.node === n.name).length,
    }))
  }, [pods])

  const stats = useMemo(() => {
    const running = pods.filter((p) => p.state === 'running').length
    const sleeping = pods.filter((p) => p.state === 'sleeping').length
    const pending = pods.filter((p) => p.state === 'pending').length
    const failed = pods.filter((p) => p.state === 'failed').length
    return { total: pods.length, running, sleeping, pending, failed }
  }, [pods])

  const simulateTick = useCallback(() => {
    setPods((prev) => {
      const next = [...prev]
      const activePods = next.filter((p) => !sleepingNamespaces.has(p.namespace))
      if (activePods.length === 0) return next

      const target = activePods[Math.floor(Math.random() * activePods.length)]
      const idx = next.findIndex((p) => p.id === target.id)
      if (idx === -1) return next

      const pod = { ...next[idx] }
      const roll = Math.random()
      if (pod.state === 'running' && roll < 0.3) {
        pod.state = 'pending'
      } else if (pod.state === 'pending') {
        pod.state = roll < 0.85 ? 'running' : 'failed'
      } else if (pod.state === 'failed') {
        pod.state = 'pending'
        pod.restarts += 1
      } else if (pod.state === 'running') {
        pod.cpu = Math.max(10, Math.min(500, pod.cpu + (Math.random() - 0.5) * 80))
      }
      next[idx] = pod
      return next
    })
    setEventCount((c) => c + 1)
  }, [sleepingNamespaces])

  useEffect(() => {
    if (isSimulating) {
      intervalRef.current = setInterval(simulateTick, 2000)
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isSimulating, simulateTick])

  function sleepNamespace(ns: string) {
    setSleepingNamespaces((prev) => new Set(prev).add(ns))
    setPods((prev) =>
      prev.map((p) => (p.namespace === ns ? { ...p, state: 'sleeping' as PodState } : p)),
    )
  }

  function wakeNamespace(ns: string) {
    setSleepingNamespaces((prev) => {
      const next = new Set(prev)
      next.delete(ns)
      return next
    })
    setPods((prev) =>
      prev.map((p) => (p.namespace === ns && p.state === 'sleeping' ? { ...p, state: 'running' as PodState } : p)),
    )
  }

  function resetAll() {
    setIsSimulating(false)
    setSleepingNamespaces(new Set())
    setPods(generatePods())
    setEventCount(0)
  }

  return (
    <Box sx={{ minHeight: '100vh', background: '#0B1120', color: '#E2E8F0', p: 3 }}>
      <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <IconButton onClick={() => router.push('/prototypes/')} size="small" sx={{ color: '#94A3B8' }}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
            G3-v5 — Swim Lane Topology
          </Typography>
        </Box>

        {/* Controls */}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1,
            mb: 2,
            p: 1.5,
            borderRadius: 2,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <Button
            size="small"
            variant="outlined"
            startIcon={isSimulating ? <PauseIcon /> : <PlayArrowIcon />}
            onClick={() => setIsSimulating((v) => !v)}
            sx={{
              borderColor: isSimulating ? '#F59E0B' : '#22C55E',
              color: isSimulating ? '#F59E0B' : '#22C55E',
              fontSize: '0.7rem',
              textTransform: 'none',
              '&:hover': { borderColor: isSimulating ? '#F59E0B' : '#22C55E', background: 'rgba(255,255,255,0.05)' },
            }}
          >
            {isSimulating ? 'Pause' : 'Simulate'}
          </Button>

          <Button
            size="small"
            variant="outlined"
            startIcon={<ReplayIcon />}
            onClick={resetAll}
            sx={{ borderColor: '#64748B', color: '#94A3B8', fontSize: '0.7rem', textTransform: 'none', '&:hover': { borderColor: '#94A3B8' } }}
          >
            Reset
          </Button>

          <Box sx={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)', mx: 0.5 }} />

          <SleepWakeButton namespace="staging" isSleeping={sleepingNamespaces.has('staging')} onSleep={sleepNamespace} onWake={wakeNamespace} />
          <SleepWakeButton namespace="dev" isSleeping={sleepingNamespaces.has('dev')} onSleep={sleepNamespace} onWake={wakeNamespace} />

          <Box sx={{ flex: 1 }} />

          <Chip label={`${stats.total} pods`} size="small" sx={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.06)', color: '#94A3B8' }} />
          <Chip label={`${stats.running} running`} size="small" sx={{ fontSize: '0.65rem', background: '#22C55E15', color: '#22C55E' }} />
          <Chip label={`${stats.sleeping} sleeping`} size="small" sx={{ fontSize: '0.65rem', background: '#7C3AED15', color: '#A78BFA' }} />
          {stats.pending > 0 && (
            <Chip label={`${stats.pending} pending`} size="small" sx={{ fontSize: '0.65rem', background: '#F59E0B15', color: '#F59E0B' }} />
          )}
          {stats.failed > 0 && (
            <Chip label={`${stats.failed} failed`} size="small" sx={{ fontSize: '0.65rem', background: '#EF444415', color: '#EF4444' }} />
          )}
          <Chip label={`${eventCount} events`} size="small" sx={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.06)', color: '#64748B' }} />
        </Box>

        {/* Main area: node sidebar + swim lanes */}
        <Box sx={{ display: 'flex', gap: 1.5, borderRadius: 2, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden', background: 'rgba(255,255,255,0.01)' }}>
          <NodeSidebar nodes={nodeStats} hoveredNode={hoveredNode} onHoverNode={setHoveredNode} />

          <Box sx={{ flex: 1, minWidth: 0 }}>
            {NAMESPACES.map((ns, i) => (
              <NamespaceLane
                key={ns}
                namespace={ns}
                workloads={workloads}
                pods={pods}
                isSleeping={sleepingNamespaces.has(ns)}
                isEven={i % 2 === 0}
                hoveredNode={hoveredNode}
              />
            ))}
          </Box>
        </Box>

        {/* Legend */}
        <Box sx={{ display: 'flex', gap: 2, mt: 2, justifyContent: 'center' }}>
          {Object.entries(STATE_COLOR).map(([state, color]) => (
            <Box key={state} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
              <Typography sx={{ fontSize: '0.6rem', color: '#64748B', textTransform: 'capitalize' }}>
                {state}
              </Typography>
            </Box>
          ))}
          {NODES.map((n) => (
            <Box key={n.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: 0.5, background: n.color }} />
              <Typography sx={{ fontSize: '0.6rem', color: '#64748B' }}>{n.name}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}

/* ─── Small helper components ─── */

function SleepWakeButton({
  namespace,
  isSleeping,
  onSleep,
  onWake,
}: {
  namespace: string
  isSleeping: boolean
  onSleep: (ns: string) => void
  onWake: (ns: string) => void
}) {
  return (
    <Button
      size="small"
      variant="outlined"
      startIcon={isSleeping ? <WbSunnyIcon /> : <BedtimeIcon />}
      onClick={() => (isSleeping ? onWake(namespace) : onSleep(namespace))}
      sx={{
        borderColor: isSleeping ? '#F59E0B' : '#7C3AED',
        color: isSleeping ? '#F59E0B' : '#A78BFA',
        fontSize: '0.7rem',
        textTransform: 'none',
        '&:hover': { borderColor: isSleeping ? '#F59E0B' : '#A78BFA', background: 'rgba(255,255,255,0.05)' },
      }}
    >
      {isSleeping ? `Wake ${namespace}` : `Sleep ${namespace}`}
    </Button>
  )
}
