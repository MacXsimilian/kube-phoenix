'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Slider from '@mui/material/Slider'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ReplayIcon from '@mui/icons-material/Replay'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NodeStatus = 'Ready' | 'Cordoned' | 'Draining' | 'Deleted'
type PodStatus = 'Running' | 'Pending' | 'Failed' | 'Succeeded'
type Layer = 'nodes' | 'pods'

interface MockPod {
  name: string
  namespace: string
  status: PodStatus
  restarts: number
  cpuPct: number
  memPct: number
}

interface MockNode {
  name: string
  instanceType: string
  zone: string
  cpuPct: number
  memPct: number
  cpuCores: number
  memGb: number
  age: string
  taints: string[]
  allocatableMemGb: number
  status: NodeStatus
  pods: MockPod[]
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

function makePods(nodeIndex: number): MockPod[] {
  const podDefs: [string, string, PodStatus, number][] = [
    [`api-server-${nodeIndex}a`, 'production', 'Running', 0],
    [`api-server-${nodeIndex}b`, 'production', 'Running', 0],
    [`web-frontend-${nodeIndex}`, 'production', 'Running', 1],
    [`worker-${nodeIndex}a`, 'staging', 'Running', 0],
    [`worker-${nodeIndex}b`, 'staging', 'Pending', 0],
    [`data-pipeline-${nodeIndex}`, 'dev', 'Running', 0],
    [`test-runner-${nodeIndex}`, 'dev', 'Failed', 3],
    [`prometheus-${nodeIndex}`, 'monitoring', 'Running', 0],
    [`grafana-${nodeIndex}`, 'monitoring', 'Running', 0],
    [`coredns-${nodeIndex}`, 'kube-system', 'Running', 0],
    [`kube-proxy-${nodeIndex}`, 'kube-system', 'Running', 0],
    [`logger-${nodeIndex}`, 'monitoring', 'Running', 2],
    [`batch-job-${nodeIndex}`, 'dev', 'Succeeded', 0],
    [`cache-${nodeIndex}`, 'production', 'Running', 0],
  ]

  return podDefs.slice(0, INITIAL_NODES_DATA[nodeIndex]?.podCount ?? 8).map(([name, ns, status, restarts]) => ({
    name,
    namespace: ns,
    status,
    restarts,
    cpuPct: Math.floor(Math.random() * 60 + 10),
    memPct: Math.floor(Math.random() * 50 + 20),
  }))
}

const INITIAL_NODES_DATA: { name: string; instanceType: string; zone: string; cpuPct: number; memPct: number; cpuCores: number; memGb: number; allocatableMemGb: number; age: string; taints: string[]; podCount: number }[] = [
  { name: 'ip-10-0-1-100', instanceType: 'm5.xlarge', zone: 'us-east-1a', cpuPct: 72, memPct: 68, cpuCores: 4, memGb: 16, allocatableMemGb: 14, age: '45d', taints: [], podCount: 14 },
  { name: 'ip-10-0-1-101', instanceType: 'm5.2xlarge', zone: 'us-east-1b', cpuPct: 45, memPct: 52, cpuCores: 8, memGb: 32, allocatableMemGb: 30, age: '30d', taints: [], podCount: 8 },
  { name: 'ip-10-0-1-102', instanceType: 'c5.xlarge', zone: 'us-east-1a', cpuPct: 88, memPct: 41, cpuCores: 4, memGb: 8, allocatableMemGb: 7, age: '60d', taints: [], podCount: 12 },
  { name: 'ip-10-0-1-103', instanceType: 'r5.large', zone: 'us-east-1c', cpuPct: 23, memPct: 78, cpuCores: 2, memGb: 16, allocatableMemGb: 15, age: '90d', taints: ['dedicated=monitoring'], podCount: 6 },
  { name: 'ip-10-0-1-104', instanceType: 'm5.xlarge', zone: 'us-east-1b', cpuPct: 65, memPct: 55, cpuCores: 4, memGb: 16, allocatableMemGb: 14, age: '15d', taints: [], podCount: 10 },
  { name: 'ip-10-0-1-105', instanceType: 'm5.2xlarge', zone: 'us-east-1c', cpuPct: 51, memPct: 63, cpuCores: 8, memGb: 32, allocatableMemGb: 30, age: '22d', taints: [], podCount: 9 },
]

function buildInitialNodes(): MockNode[] {
  return INITIAL_NODES_DATA.map((def, i) => ({
    ...def,
    status: 'Ready' as NodeStatus,
    pods: makePods(i),
  }))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NAMESPACES = ['production', 'staging', 'dev', 'monitoring', 'kube-system']

const NAMESPACE_COLORS: Record<string, string> = {
  production: '#3B82F6',
  staging: '#A855F7',
  dev: '#F59E0B',
  monitoring: '#22C55E',
  'kube-system': '#6B7280',
}

function cpuToColor(pct: number): string {
  if (pct < 30) return '#3B82F6'
  if (pct < 60) return '#22C55E'
  if (pct < 80) return '#F59E0B'
  return '#EF4444'
}

const STATUS_BORDER_COLORS: Record<NodeStatus, string> = {
  Ready: '#22C55E',
  Cordoned: '#F59E0B',
  Draining: '#EF4444',
  Deleted: '#6B7280',
}

const POD_STATUS_COLORS: Record<PodStatus, string> = {
  Running: '#22C55E',
  Pending: '#F59E0B',
  Failed: '#EF4444',
  Succeeded: '#475569',
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '...' : s
}

function memToGridSize(allocMemGb: number): number {
  if (allocMemGb >= 28) return 2
  return 1
}

// ---------------------------------------------------------------------------
// Node Tooltip
// ---------------------------------------------------------------------------

function NodeTooltip({ node, position }: { node: MockNode; position: { x: number; y: number } }) {
  return (
    <Box
      sx={{
        position: 'fixed',
        left: position.x + 12,
        top: position.y - 10,
        zIndex: 9999,
        bgcolor: '#1a1a2e',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 2,
        p: 2,
        minWidth: 260,
        pointerEvents: 'none',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
    >
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: '#fff' }}>
        {node.name}
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
        {[
          ['Instance', node.instanceType],
          ['Zone', node.zone],
          ['CPU', `${Math.round(node.cpuPct * node.cpuCores / 100 * 10) / 10} / ${node.cpuCores} cores`],
          ['Memory', `${Math.round(node.memPct * node.memGb / 100 * 10) / 10} / ${node.memGb} GB`],
          ['Pods', `${node.pods.length}`],
          ['Age', node.age],
          ['Status', node.status],
          ['Taints', node.taints.length > 0 ? node.taints.join(', ') : 'none'],
        ].map(([label, value]) => (
          <Box key={label}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>
              {label}
            </Typography>
            <Typography variant="caption" sx={{ color: '#fff', fontSize: 11, display: 'block', fontWeight: 500 }}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Node Card
// ---------------------------------------------------------------------------

function NodeCard({
  node,
  onSelect,
  cellRef,
}: {
  node: MockNode
  onSelect: () => void
  cellRef: (el: HTMLDivElement | null) => void
}) {
  const [hovered, setHovered] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const isDimmed = node.status === 'Deleted'

  return (
    <>
      <motion.div
        layoutId={`node-${node.name}`}
        ref={cellRef}
        onClick={onSelect}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onMouseMove={e => setMousePos({ x: e.clientX, y: e.clientY })}
        style={{
          cursor: 'pointer',
          gridColumn: memToGridSize(node.allocatableMemGb) === 2 ? 'span 2' : 'span 1',
          opacity: isDimmed ? 0.4 : 1,
        }}
      >
        <Box
          sx={{
            p: 2.5,
            borderRadius: 2,
            bgcolor: cpuToColor(node.cpuPct),
            border: '3px solid',
            borderColor: STATUS_BORDER_COLORS[node.status],
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
            minHeight: 120,
            justifyContent: 'center',
            alignItems: 'center',
            transition: 'box-shadow 200ms ease',
            boxShadow: hovered ? `0 0 20px ${STATUS_BORDER_COLORS[node.status]}55` : 'none',
            '&:hover': { transform: 'translateY(-2px)' },
          }}
        >
          <Typography variant="body2" fontWeight={800} sx={{ color: '#0F0F13', fontSize: 13 }}>
            {truncate(node.name, 18)}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, mt: 0.5 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" sx={{ color: 'rgba(0,0,0,0.5)', fontSize: 9, textTransform: 'uppercase', fontWeight: 600 }}>
                CPU
              </Typography>
              <Typography variant="body2" fontWeight={700} sx={{ color: '#0F0F13', fontSize: 16 }}>
                {node.cpuPct}%
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" sx={{ color: 'rgba(0,0,0,0.5)', fontSize: 9, textTransform: 'uppercase', fontWeight: 600 }}>
                MEM
              </Typography>
              <Typography variant="body2" fontWeight={700} sx={{ color: '#0F0F13', fontSize: 16 }}>
                {node.memPct}%
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" sx={{ color: 'rgba(0,0,0,0.5)', fontSize: 9, textTransform: 'uppercase', fontWeight: 600 }}>
                PODS
              </Typography>
              <Typography variant="body2" fontWeight={700} sx={{ color: '#0F0F13', fontSize: 16 }}>
                {node.pods.length}
              </Typography>
            </Box>
          </Box>
          <Chip
            label={node.status}
            size="small"
            sx={{
              mt: 0.5,
              height: 20,
              fontSize: 10,
              fontWeight: 700,
              bgcolor: `${STATUS_BORDER_COLORS[node.status]}33`,
              color: '#0F0F13',
              border: `1px solid ${STATUS_BORDER_COLORS[node.status]}`,
            }}
          />
        </Box>
      </motion.div>
      {hovered && <NodeTooltip node={node} position={mousePos} />}
    </>
  )
}

// ---------------------------------------------------------------------------
// Pod Cell
// ---------------------------------------------------------------------------

function PodCell({ pod }: { pod: MockPod }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.6 }}
      transition={{ duration: 0.25 }}
    >
      <Box
        sx={{
          p: 1.5,
          borderRadius: 1.5,
          bgcolor: POD_STATUS_COLORS[pod.status],
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 60,
          position: 'relative',
        }}
      >
        <Typography variant="caption" fontWeight={700} sx={{ color: '#0F0F13', fontSize: 10, textAlign: 'center', lineHeight: 1.2 }}>
          {truncate(pod.name, 16)}
        </Typography>
        <Chip
          label={pod.namespace}
          size="small"
          sx={{
            mt: 0.5,
            height: 16,
            fontSize: 8,
            fontWeight: 600,
            bgcolor: `${NAMESPACE_COLORS[pod.namespace] ?? '#6B7280'}33`,
            color: '#0F0F13',
          }}
        />
        {pod.restarts > 0 && (
          <Box
            sx={{
              position: 'absolute',
              top: 4,
              right: 4,
              width: 18,
              height: 18,
              borderRadius: '50%',
              bgcolor: '#EF4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="caption" sx={{ color: '#fff', fontSize: 9, fontWeight: 800 }}>
              {pod.restarts}
            </Typography>
          </Box>
        )}
      </Box>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Time Scrubber
// ---------------------------------------------------------------------------

function TimeScrubber({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const formatHour = (h: number) => `${String(h).padStart(2, '0')}:00`
  const isSleepHour = (h: number) => h >= 22 || h < 6

  return (
    <Box sx={{ px: 3, py: 2, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11 }}>
          Time Scrubber
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {isSleepHour(value) && <BedtimeIcon sx={{ fontSize: 14, color: '#6B7280' }} />}
          <Typography variant="body2" fontWeight={700} sx={{ color: isSleepHour(value) ? '#6B7280' : '#fff', fontSize: 16 }}>
            {formatHour(value)}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ position: 'relative', mx: 1 }}>
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            left: `${(22 / 24) * 100}%`,
            right: 0,
            height: 8,
            bgcolor: 'rgba(107,114,128,0.3)',
            borderRadius: 1,
            zIndex: 0,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            left: 0,
            width: `${(6 / 24) * 100}%`,
            height: 8,
            bgcolor: 'rgba(107,114,128,0.3)',
            borderRadius: 1,
            zIndex: 0,
          }}
        />
        <Slider
          value={value}
          min={0}
          max={23}
          step={1}
          onChange={(_, v) => onChange(v as number)}
          valueLabelDisplay="off"
          marks={[0, 6, 12, 18, 22].map(h => ({ value: h, label: formatHour(h) }))}
          sx={{
            color: isSleepHour(value) ? '#6B7280' : '#3B82F6',
            '& .MuiSlider-rail': { bgcolor: 'rgba(255,255,255,0.1)', height: 6 },
            '& .MuiSlider-track': { height: 6 },
            '& .MuiSlider-thumb': { width: 18, height: 18 },
            '& .MuiSlider-markLabel': { fontSize: 10, color: 'rgba(255,255,255,0.4)' },
          }}
        />
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function FlagshipHeatmapPrototype() {
  const router = useRouter()
  const [nodes, setNodes] = useState<MockNode[]>(buildInitialNodes)
  const [layer, setLayer] = useState<Layer>('nodes')
  const [selectedNodeName, setSelectedNodeName] = useState<string | null>(null)
  const [activeNamespaces, setActiveNamespaces] = useState<Set<string>>(new Set(NAMESPACES))
  const [timeHour, setTimeHour] = useState(12)
  const [sleeping, setSleeping] = useState(false)
  const cellRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const selectedNode = useMemo(
    () => nodes.find(n => n.name === selectedNodeName) ?? null,
    [nodes, selectedNodeName],
  )

  const filteredPods = useMemo(() => {
    if (!selectedNode) return []
    return selectedNode.pods.filter(p => activeNamespaces.has(p.namespace))
  }, [selectedNode, activeNamespaces])

  // ---- Time scrubber effect ----
  useEffect(() => {
    if (sleeping) return
    const isSleep = timeHour >= 22 || timeHour < 6
    setNodes(prev =>
      prev.map(n => ({
        ...n,
        status: isSleep ? 'Deleted' as NodeStatus : 'Ready' as NodeStatus,
        cpuPct: isSleep ? Math.floor(n.cpuPct * 0.1) : INITIAL_NODES_DATA.find(d => d.name === n.name)?.cpuPct ?? n.cpuPct,
        memPct: isSleep ? Math.floor(n.memPct * 0.15) : INITIAL_NODES_DATA.find(d => d.name === n.name)?.memPct ?? n.memPct,
      })),
    )
  }, [timeHour, sleeping])

  // ---- Sleep simulation ----
  const clearTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
  }, [])

  const simulateSleep = useCallback(() => {
    clearTimeouts()
    setSleeping(true)
    setLayer('nodes')
    setSelectedNodeName(null)

    const nodeNames = INITIAL_NODES_DATA.map(n => n.name)
    const steps: { name: string; status: NodeStatus; delay: number }[] = []

    nodeNames.forEach((name, i) => {
      const base = i * 1500
      steps.push({ name, status: 'Cordoned', delay: base })
      steps.push({ name, status: 'Draining', delay: base + 600 })
      steps.push({ name, status: 'Deleted', delay: base + 1200 })
    })

    for (const step of steps) {
      const t = setTimeout(() => {
        setNodes(prev =>
          prev.map(n => n.name === step.name ? { ...n, status: step.status } : n),
        )

        const el = cellRefs.current[step.name]
        if (!el) return

        if (step.status === 'Cordoned') {
          gsap.fromTo(el, { scale: 1 }, { scale: 1.06, duration: 0.15, yoyo: true, repeat: 1 })
        } else if (step.status === 'Draining') {
          gsap.fromTo(el, { x: 0 }, { x: -4, duration: 0.05, yoyo: true, repeat: 7 })
        } else if (step.status === 'Deleted') {
          gsap.to(el, { opacity: 0.4, duration: 0.6 })
        }
      }, step.delay)
      timeoutsRef.current.push(t)
    }

    const finishT = setTimeout(() => {
      setSleeping(false)
    }, nodeNames.length * 1500 + 500)
    timeoutsRef.current.push(finishT)
  }, [clearTimeouts])

  const resetAll = useCallback(() => {
    clearTimeouts()
    setSleeping(false)
    setNodes(buildInitialNodes())
    setLayer('nodes')
    setSelectedNodeName(null)
    setTimeHour(12)

    Object.values(cellRefs.current).forEach(el => {
      if (el) {
        gsap.set(el, { opacity: 1, scale: 1, x: 0 })
      }
    })
  }, [clearTimeouts])

  const toggleNamespace = useCallback((ns: string) => {
    setActiveNamespaces(prev => {
      const next = new Set(prev)
      if (next.has(ns)) {
        next.delete(ns)
      } else {
        next.add(ns)
      }
      return next
    })
  }, [])

  const drillIntoNode = useCallback((name: string) => {
    setSelectedNodeName(name)
    setLayer('pods')
  }, [])

  const drillOut = useCallback(() => {
    setLayer('nodes')
    setSelectedNodeName(null)
  }, [])

  useEffect(() => () => clearTimeouts(), [clearTimeouts])

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', py: 4, px: 2, minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>
            FL3 — Node & Pod Health Heatmap
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Cluster health visualization with drill-down, sleep simulation, and time scrubber
          </Typography>
        </Box>
      </Box>

      {/* Control Bar */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.5,
          mb: 3,
          p: 2,
          borderRadius: 2,
          bgcolor: 'rgba(255,255,255,0.04)',
          border: '1px solid',
          borderColor: 'divider',
          alignItems: 'center',
        }}
      >
        <Button
          variant="contained"
          size="small"
          startIcon={<PlayArrowIcon fontSize="small" />}
          onClick={simulateSleep}
          disabled={sleeping}
          sx={{ bgcolor: '#6B7280', '&:hover': { bgcolor: '#4B5563' } }}
        >
          Simulate Sleep
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<ReplayIcon fontSize="small" />}
          onClick={resetAll}
        >
          Reset
        </Button>

        <Box sx={{ width: 1, height: 24, borderLeft: '1px solid', borderColor: 'divider', mx: 0.5 }} />

        {NAMESPACES.map(ns => (
          <Chip
            key={ns}
            label={ns}
            size="small"
            onClick={() => toggleNamespace(ns)}
            sx={{
              fontWeight: 600,
              fontSize: 11,
              bgcolor: activeNamespaces.has(ns)
                ? `${NAMESPACE_COLORS[ns]}22`
                : 'transparent',
              color: activeNamespaces.has(ns)
                ? NAMESPACE_COLORS[ns]
                : 'rgba(255,255,255,0.3)',
              border: '1px solid',
              borderColor: activeNamespaces.has(ns)
                ? `${NAMESPACE_COLORS[ns]}66`
                : 'rgba(255,255,255,0.1)',
              cursor: 'pointer',
              transition: 'all 200ms ease',
            }}
          />
        ))}
      </Box>

      {/* Breadcrumb for Layer 2 */}
      <AnimatePresence>
        {layer === 'pods' && selectedNode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 2 }}>
              <Typography
                variant="body2"
                sx={{ color: '#3B82F6', cursor: 'pointer', fontWeight: 600, '&:hover': { textDecoration: 'underline' } }}
                onClick={drillOut}
              >
                Nodes
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mx: 0.5 }}>
                &gt;
              </Typography>
              <Typography variant="body2" fontWeight={700} sx={{ color: '#fff' }}>
                {selectedNode.name}
              </Typography>
              <Chip
                label={selectedNode.status}
                size="small"
                sx={{
                  ml: 1,
                  height: 20,
                  fontSize: 10,
                  fontWeight: 700,
                  bgcolor: `${STATUS_BORDER_COLORS[selectedNode.status]}22`,
                  color: STATUS_BORDER_COLORS[selectedNode.status],
                  border: `1px solid ${STATUS_BORDER_COLORS[selectedNode.status]}`,
                }}
              />
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Grid Area */}
      <Box
        sx={{
          minHeight: 400,
          mb: 3,
          p: 3,
          borderRadius: 3,
          bgcolor: 'rgba(255,255,255,0.02)',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <AnimatePresence mode="wait">
          {layer === 'nodes' && (
            <motion.div
              key="node-layer"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.35 }}
            >
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: 2,
                }}
              >
                {nodes.map(node => (
                  <NodeCard
                    key={node.name}
                    node={node}
                    onSelect={() => drillIntoNode(node.name)}
                    cellRef={el => { cellRefs.current[node.name] = el }}
                  />
                ))}
              </Box>
            </motion.div>
          )}

          {layer === 'pods' && selectedNode && (
            <motion.div
              key="pod-layer"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.35 }}
            >
              {/* Node summary bar */}
              <Box
                sx={{
                  display: 'flex',
                  gap: 3,
                  mb: 3,
                  p: 2,
                  borderRadius: 2,
                  bgcolor: `${cpuToColor(selectedNode.cpuPct)}15`,
                  border: `1px solid ${cpuToColor(selectedNode.cpuPct)}44`,
                }}
              >
                {[
                  ['Instance', selectedNode.instanceType],
                  ['CPU', `${selectedNode.cpuPct}%`],
                  ['Memory', `${selectedNode.memPct}%`],
                  ['Pods', `${filteredPods.length} / ${selectedNode.pods.length}`],
                  ['Zone', selectedNode.zone],
                ].map(([label, value]) => (
                  <Box key={label}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 10, textTransform: 'uppercase', fontWeight: 600 }}>
                      {label}
                    </Typography>
                    <Typography variant="body2" fontWeight={700} sx={{ color: '#fff' }}>
                      {value}
                    </Typography>
                  </Box>
                ))}
              </Box>

              {/* Pod grid */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: 1.5,
                }}
              >
                <AnimatePresence>
                  {filteredPods.map(pod => (
                    <PodCell key={pod.name} pod={pod} />
                  ))}
                </AnimatePresence>
              </Box>

              {filteredPods.length === 0 && (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    No pods match the selected namespace filters.
                  </Typography>
                </Box>
              )}

              <Box sx={{ mt: 3 }}>
                <Button variant="outlined" size="small" onClick={drillOut} startIcon={<ArrowBackIcon fontSize="small" />}>
                  Back to Nodes
                </Button>
              </Box>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>

      {/* Legend */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          mb: 2,
          px: 1,
          justifyContent: 'center',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 10, mr: 0.5, fontWeight: 600 }}>
            CPU:
          </Typography>
          {[
            ['< 30%', '#3B82F6'],
            ['30-60%', '#22C55E'],
            ['60-80%', '#F59E0B'],
            ['> 80%', '#EF4444'],
          ].map(([label, color]) => (
            <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: color }} />
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 9 }}>
                {label}
              </Typography>
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 10, mr: 0.5, fontWeight: 600 }}>
            Border:
          </Typography>
          {Object.entries(STATUS_BORDER_COLORS).map(([status, color]) => (
            <Box key={status} sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: 0.5, border: `2px solid ${color}`, bgcolor: 'transparent' }} />
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 9 }}>
                {status}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Time Scrubber */}
      <TimeScrubber value={timeHour} onChange={setTimeHour} />
    </Box>
  )
}
