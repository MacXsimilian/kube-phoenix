'use client'

import { useState, useRef, useMemo, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong'
import { useRouter } from 'next/navigation'
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Html, Line } from '@react-three/drei'
import * as THREE from 'three'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PodStatus = 'running' | 'pending' | 'failed' | 'sleeping'

interface PodData {
  id: string
  name: string
  status: PodStatus
}

interface WorkloadData {
  id: string
  name: string
  kind: 'Deployment' | 'StatefulSet'
  pods: PodData[]
}

interface NamespaceData {
  id: string
  name: string
  color: string
  workloads: WorkloadData[]
}

interface ClusterData {
  name: string
  namespaces: NamespaceData[]
}

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<PodStatus, string> = {
  running: '#22C55E',
  pending: '#F59E0B',
  failed: '#EF4444',
  sleeping: '#475569',
}

const NS_COLORS = ['#7C3AED', '#3B82F6', '#EC4899', '#14B8A6', '#F97316']

// ---------------------------------------------------------------------------
// Mock data generator
// ---------------------------------------------------------------------------

function generateMockCluster(): ClusterData {
  const workloadDefs: { ns: string; workloads: { name: string; kind: 'Deployment' | 'StatefulSet'; podCount: number }[] }[] = [
    {
      ns: 'production',
      workloads: [
        { name: 'api-server', kind: 'Deployment', podCount: 3 },
        { name: 'web-frontend', kind: 'Deployment', podCount: 2 },
        { name: 'payment-svc', kind: 'Deployment', podCount: 2 },
        { name: 'redis', kind: 'StatefulSet', podCount: 1 },
        { name: 'postgres', kind: 'StatefulSet', podCount: 2 },
        { name: 'worker', kind: 'Deployment', podCount: 3 },
        { name: 'gateway', kind: 'Deployment', podCount: 2 },
        { name: 'notification-svc', kind: 'Deployment', podCount: 1 },
      ],
    },
    {
      ns: 'staging',
      workloads: [
        { name: 'api-server', kind: 'Deployment', podCount: 2 },
        { name: 'web-frontend', kind: 'Deployment', podCount: 1 },
        { name: 'checkout-svc', kind: 'Deployment', podCount: 2 },
        { name: 'product-api', kind: 'Deployment', podCount: 1 },
        { name: 'cart-svc', kind: 'Deployment', podCount: 1 },
        { name: 'search-engine', kind: 'Deployment', podCount: 2 },
      ],
    },
    {
      ns: 'dev',
      workloads: [
        { name: 'api-dev', kind: 'Deployment', podCount: 1 },
        { name: 'web-dev', kind: 'Deployment', podCount: 1 },
        { name: 'db-dev', kind: 'StatefulSet', podCount: 1 },
        { name: 'cache-dev', kind: 'Deployment', podCount: 1 },
      ],
    },
    {
      ns: 'monitoring',
      workloads: [
        { name: 'prometheus', kind: 'StatefulSet', podCount: 1 },
        { name: 'grafana', kind: 'Deployment', podCount: 1 },
        { name: 'alertmanager', kind: 'Deployment', podCount: 1 },
        { name: 'loki', kind: 'StatefulSet', podCount: 1 },
      ],
    },
    {
      ns: 'kube-system',
      workloads: [
        { name: 'coredns', kind: 'Deployment', podCount: 2 },
        { name: 'kube-proxy', kind: 'Deployment', podCount: 3 },
        { name: 'metrics-server', kind: 'Deployment', podCount: 1 },
      ],
    },
  ]

  const namespaces: NamespaceData[] = workloadDefs.map((nsDef, nsIdx) => {
    const workloads: WorkloadData[] = nsDef.workloads.map((wl) => {
      const pods: PodData[] = Array.from({ length: wl.podCount }, (_, i) => ({
        id: `${nsDef.ns}-${wl.name}-pod-${i}`,
        name: `${wl.name}-${randomSuffix()}`,
        status: 'running' as PodStatus,
      }))
      return {
        id: `${nsDef.ns}-${wl.name}`,
        name: wl.name,
        kind: wl.kind,
        pods,
      }
    })
    return {
      id: nsDef.ns,
      name: nsDef.ns,
      color: NS_COLORS[nsIdx % NS_COLORS.length],
      workloads,
    }
  })

  return { name: 'dev-cluster', namespaces }
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 5)
}

// ---------------------------------------------------------------------------
// 3D Layout helpers
// ---------------------------------------------------------------------------

function computeNamespacePosition(index: number, total: number): THREE.Vector3 {
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2
  const radius = 6
  return new THREE.Vector3(
    Math.cos(angle) * radius,
    (Math.random() - 0.5) * 1.5,
    Math.sin(angle) * radius,
  )
}

function computeWorkloadPosition(
  nsPos: THREE.Vector3,
  wIndex: number,
  wTotal: number,
): THREE.Vector3 {
  const angle = (wIndex / wTotal) * Math.PI * 2
  const radius = 2.5
  const outward = nsPos.clone().normalize()
  const offset = new THREE.Vector3(
    Math.cos(angle) * radius,
    Math.sin(angle) * 0.8,
    Math.sin(angle) * radius,
  )
  return nsPos.clone().add(outward.multiplyScalar(1.5)).add(offset)
}

function computePodPosition(
  wPos: THREE.Vector3,
  pIndex: number,
  pTotal: number,
): THREE.Vector3 {
  const angle = (pIndex / pTotal) * Math.PI * 2
  const radius = 0.8
  return wPos.clone().add(
    new THREE.Vector3(
      Math.cos(angle) * radius,
      0.3 + pIndex * 0.15,
      Math.sin(angle) * radius,
    ),
  )
}

// ---------------------------------------------------------------------------
// Scene node components
// ---------------------------------------------------------------------------

interface HoverInfo {
  name: string
  kind: string
  namespace?: string
  status?: PodStatus
}

interface NodeSphereProps {
  position: THREE.Vector3
  radius: number
  color: string
  emissiveIntensity: number
  opacity: number
  scale: number
  hoverInfo: HoverInfo
  onClick?: () => void
}

function NodeSphere({
  position,
  radius,
  color,
  emissiveIntensity,
  opacity,
  scale,
  hoverInfo,
  onClick,
}: NodeSphereProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const targetScale = useRef(scale)
  const currentScale = useRef(scale)

  targetScale.current = scale

  useFrame((_, delta) => {
    if (!meshRef.current) return
    currentScale.current = THREE.MathUtils.lerp(currentScale.current, targetScale.current, delta * 6)
    meshRef.current.scale.setScalar(currentScale.current)
  })

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHovered(true)
    document.body.style.cursor = 'pointer'
  }, [])

  const handlePointerOut = useCallback(() => {
    setHovered(false)
    document.body.style.cursor = 'auto'
  }, [])

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onClick?.()
  }, [onClick])

  const colorObj = useMemo(() => new THREE.Color(color), [color])

  return (
    <mesh
      ref={meshRef}
      position={position}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      <sphereGeometry args={[radius, 16, 12]} />
      <meshStandardMaterial
        color={colorObj}
        emissive={colorObj}
        emissiveIntensity={emissiveIntensity}
        transparent
        opacity={opacity}
        roughness={0.3}
        metalness={0.1}
      />
      {hovered && (
        <Html distanceFactor={12} style={{ pointerEvents: 'none' }}>
          <Box
            sx={{
              bgcolor: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid',
              borderColor: color,
              borderRadius: 1.5,
              px: 1.5,
              py: 0.8,
              minWidth: 120,
              backdropFilter: 'blur(8px)',
            }}
          >
            <Typography variant="caption" fontWeight={700} sx={{ color: '#F8FAFC', display: 'block' }}>
              {hoverInfo.name}
            </Typography>
            <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', fontSize: 10 }}>
              {hoverInfo.kind}
            </Typography>
            {hoverInfo.namespace && (
              <Typography variant="caption" sx={{ color: '#64748B', display: 'block', fontSize: 10 }}>
                ns: {hoverInfo.namespace}
              </Typography>
            )}
            {hoverInfo.status && (
              <Typography
                variant="caption"
                sx={{
                  color: STATUS_COLORS[hoverInfo.status],
                  fontWeight: 600,
                  display: 'block',
                  fontSize: 10,
                }}
              >
                {hoverInfo.status}
              </Typography>
            )}
          </Box>
        </Html>
      )}
    </mesh>
  )
}

// ---------------------------------------------------------------------------
// Edge component
// ---------------------------------------------------------------------------

interface GlowEdgeProps {
  start: THREE.Vector3
  end: THREE.Vector3
  color: string
  opacity: number
}

function GlowEdge({ start, end, color, opacity }: GlowEdgeProps) {
  const points = useMemo(() => [start, end], [start, end])
  return (
    <Line
      points={points}
      color={color}
      lineWidth={1.2}
      transparent
      opacity={opacity * 0.5}
    />
  )
}

// ---------------------------------------------------------------------------
// Camera reset helper
// ---------------------------------------------------------------------------

function CameraReset({ trigger }: { trigger: number }) {
  const { camera } = useThree()
  const lastTrigger = useRef(trigger)

  useFrame(() => {
    if (trigger !== lastTrigger.current) {
      lastTrigger.current = trigger
      const targetPos = new THREE.Vector3(12, 8, 12)
      camera.position.copy(targetPos)
      camera.lookAt(0, 0, 0)
    }
  })

  return null
}

// ---------------------------------------------------------------------------
// Cluster scene
// ---------------------------------------------------------------------------

interface ClusterSceneProps {
  cluster: ClusterData
  podStates: Map<string, { status: PodStatus; opacity: number; scale: number }>
  collapsedNamespaces: Set<string>
  onToggleNamespace: (ns: string) => void
  resetTrigger: number
}

function ClusterScene({
  cluster,
  podStates,
  collapsedNamespaces,
  onToggleNamespace,
  resetTrigger,
}: ClusterSceneProps) {
  const nsPositions = useMemo(() => {
    const total = cluster.namespaces.length
    return cluster.namespaces.map((_, i) => computeNamespacePosition(i, total))
  }, [cluster.namespaces])

  return (
    <>
      <ambientLight intensity={0.15} />
      <pointLight position={[10, 10, 10]} intensity={0.8} color="#7C3AED" />
      <pointLight position={[-10, -5, -10]} intensity={0.4} color="#3B82F6" />
      <pointLight position={[0, 8, 0]} intensity={0.3} color="#FFFFFF" />

      <CameraReset trigger={resetTrigger} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={4}
        maxDistance={40}
      />

      {/* Central cluster node */}
      <NodeSphere
        position={new THREE.Vector3(0, 0, 0)}
        radius={0.8}
        color="#7C3AED"
        emissiveIntensity={0.8}
        opacity={1}
        scale={1}
        hoverInfo={{ name: cluster.name, kind: 'Cluster' }}
      />

      {cluster.namespaces.map((ns, nsIdx) => {
        const nsPos = nsPositions[nsIdx]
        const collapsed = collapsedNamespaces.has(ns.id)

        const wPositions = ns.workloads.map((_, wIdx) =>
          computeWorkloadPosition(nsPos, wIdx, ns.workloads.length),
        )

        return (
          <group key={ns.id}>
            {/* Edge: cluster -> namespace */}
            <GlowEdge
              start={new THREE.Vector3(0, 0, 0)}
              end={nsPos}
              color={ns.color}
              opacity={1}
            />

            {/* Namespace node */}
            <NodeSphere
              position={nsPos}
              radius={0.5}
              color={ns.color}
              emissiveIntensity={0.6}
              opacity={1}
              scale={1}
              hoverInfo={{
                name: ns.name,
                kind: 'Namespace',
              }}
              onClick={() => onToggleNamespace(ns.id)}
            />

            {!collapsed &&
              ns.workloads.map((wl, wIdx) => {
                const wPos = wPositions[wIdx]
                const podPositions = wl.pods.map((_, pIdx) =>
                  computePodPosition(wPos, pIdx, wl.pods.length),
                )

                return (
                  <group key={wl.id}>
                    {/* Edge: namespace -> workload */}
                    <GlowEdge start={nsPos} end={wPos} color={ns.color} opacity={0.7} />

                    {/* Workload node */}
                    <NodeSphere
                      position={wPos}
                      radius={0.3}
                      color={ns.color}
                      emissiveIntensity={0.4}
                      opacity={0.9}
                      scale={1}
                      hoverInfo={{
                        name: wl.name,
                        kind: wl.kind,
                        namespace: ns.name,
                      }}
                    />

                    {wl.pods.map((pod, pIdx) => {
                      const podState = podStates.get(pod.id)
                      const status = podState?.status ?? pod.status
                      const opacity = podState?.opacity ?? 1
                      const podScale = podState?.scale ?? 1

                      return (
                        <group key={pod.id}>
                          {/* Edge: workload -> pod */}
                          <GlowEdge
                            start={wPos}
                            end={podPositions[pIdx]}
                            color={STATUS_COLORS[status]}
                            opacity={opacity}
                          />

                          {/* Pod node */}
                          <NodeSphere
                            position={podPositions[pIdx]}
                            radius={0.15}
                            color={STATUS_COLORS[status]}
                            emissiveIntensity={status === 'running' ? 0.5 : 0.15}
                            opacity={opacity}
                            scale={podScale}
                            hoverInfo={{
                              name: pod.name,
                              kind: 'Pod',
                              namespace: ns.name,
                              status,
                            }}
                          />
                        </group>
                      )
                    })}
                  </group>
                )
              })}
          </group>
        )
      })}
    </>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function FlagshipTopologyPrototype() {
  const router = useRouter()
  const cluster = useMemo(() => generateMockCluster(), [])

  const allPodIds = useMemo(() => {
    const ids: string[] = []
    for (const ns of cluster.namespaces) {
      for (const wl of ns.workloads) {
        for (const pod of wl.pods) {
          ids.push(pod.id)
        }
      }
    }
    return ids
  }, [cluster])

  const [podStates, setPodStates] = useState<Map<string, { status: PodStatus; opacity: number; scale: number }>>(
    () => new Map(allPodIds.map(id => [id, { status: 'running', opacity: 1, scale: 1 }])),
  )
  const [collapsedNamespaces, setCollapsedNamespaces] = useState<Set<string>>(new Set())
  const [resetTrigger, setResetTrigger] = useState(0)
  const [simulating, setSimulating] = useState<'sleep' | 'wake' | null>(null)
  const [progress, setProgress] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = useCallback(() => {
    timerRef.current.forEach(clearTimeout)
    timerRef.current = []
  }, [])

  const toggleNamespace = useCallback((nsId: string) => {
    setCollapsedNamespaces(prev => {
      const next = new Set(prev)
      if (next.has(nsId)) {
        next.delete(nsId)
      } else {
        next.add(nsId)
      }
      return next
    })
  }, [])

  const simulateSleep = useCallback(() => {
    clearTimers()
    setSimulating('sleep')
    setProgress(0)

    const total = allPodIds.length
    const shuffled = [...allPodIds].sort(() => Math.random() - 0.5)

    shuffled.forEach((podId, idx) => {
      const t = setTimeout(() => {
        setPodStates(prev => {
          const next = new Map(prev)
          next.set(podId, { status: 'sleeping', opacity: 0.25, scale: 0.6 })
          return next
        })
        setProgress(((idx + 1) / total) * 100)

        if (idx === total - 1) {
          setSimulating(null)
        }
      }, idx * 120)
      timerRef.current.push(t)
    })
  }, [allPodIds, clearTimers])

  const simulateWake = useCallback(() => {
    clearTimers()
    setSimulating('wake')
    setProgress(0)

    const total = allPodIds.length
    const shuffled = [...allPodIds].sort(() => Math.random() - 0.5)

    shuffled.forEach((podId, idx) => {
      // First go to pending
      const t1 = setTimeout(() => {
        setPodStates(prev => {
          const next = new Map(prev)
          next.set(podId, { status: 'pending', opacity: 0.7, scale: 0.9 })
          return next
        })
      }, idx * 120)
      timerRef.current.push(t1)

      // Then go to running with a scale pulse
      const t2 = setTimeout(() => {
        setPodStates(prev => {
          const next = new Map(prev)
          next.set(podId, { status: 'running', opacity: 1, scale: 1.3 })
          return next
        })
        setProgress(((idx + 1) / total) * 100)
      }, idx * 120 + 200)
      timerRef.current.push(t2)

      // Settle scale back
      const t3 = setTimeout(() => {
        setPodStates(prev => {
          const next = new Map(prev)
          next.set(podId, { status: 'running', opacity: 1, scale: 1 })
          return next
        })
        if (idx === total - 1) {
          setSimulating(null)
        }
      }, idx * 120 + 500)
      timerRef.current.push(t3)
    })
  }, [allPodIds, clearTimers])

  const resetView = useCallback(() => {
    setResetTrigger(prev => prev + 1)
  }, [])

  const legendItems: { label: string; color: string }[] = [
    { label: 'Running', color: STATUS_COLORS.running },
    { label: 'Pending', color: STATUS_COLORS.pending },
    { label: 'Failed', color: STATUS_COLORS.failed },
    { label: 'Sleeping', color: STATUS_COLORS.sleeping },
  ]

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', py: 4, px: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>
            FL1 — 3D Cluster Topology
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Interactive WebGL topology graph — orbit, zoom, click namespaces to collapse, simulate sleep/wake cycles
          </Typography>
        </Box>
      </Box>

      {/* Control bar */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 1.5,
          mb: 2,
          p: 2,
          borderRadius: 2,
          bgcolor: 'rgba(255,255,255,0.04)',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Button
          variant="outlined"
          size="small"
          startIcon={<BedtimeIcon />}
          disabled={simulating !== null}
          onClick={simulateSleep}
          sx={{ borderColor: '#475569', color: '#94A3B8' }}
        >
          Simulate Sleep
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<WbSunnyIcon />}
          disabled={simulating !== null}
          onClick={simulateWake}
          sx={{ borderColor: '#F59E0B', color: '#F59E0B' }}
        >
          Simulate Wake
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<CenterFocusStrongIcon />}
          onClick={resetView}
          sx={{ borderColor: '#7C3AED', color: '#7C3AED' }}
        >
          Reset View
        </Button>

        <Box sx={{ flex: 1 }} />

        {legendItems.map(item => (
          <Chip
            key={item.label}
            label={item.label}
            size="small"
            sx={{
              bgcolor: `${item.color}20`,
              color: item.color,
              fontWeight: 600,
              fontSize: 11,
              border: `1px solid ${item.color}40`,
            }}
          />
        ))}
      </Box>

      {/* Progress bar */}
      {simulating && (
        <Box sx={{ mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              {simulating === 'sleep' ? 'Scaling down...' : 'Waking up...'}
            </Typography>
            <Typography variant="caption" fontWeight={700} sx={{ color: simulating === 'sleep' ? '#475569' : '#22C55E' }}>
              {Math.round(progress)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 3,
              borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.06)',
              '& .MuiLinearProgress-bar': {
                bgcolor: simulating === 'sleep' ? '#475569' : '#22C55E',
                borderRadius: 2,
              },
            }}
          />
        </Box>
      )}

      {/* 3D Canvas */}
      <Box
        sx={{
          height: 600,
          borderRadius: 3,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'rgba(2, 6, 23, 0.8)',
          position: 'relative',
        }}
      >
        <Canvas
          camera={{ position: [12, 8, 12], fov: 50 }}
          gl={{ alpha: true, antialias: true }}
          style={{ background: 'transparent' }}
        >
          <ClusterScene
            cluster={cluster}
            podStates={podStates}
            collapsedNamespaces={collapsedNamespaces}
            onToggleNamespace={toggleNamespace}
            resetTrigger={resetTrigger}
          />
        </Canvas>

        {/* Overlay hint */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            px: 1.5,
            py: 0.5,
            borderRadius: 1,
            bgcolor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <Typography variant="caption" sx={{ color: '#64748B', fontSize: 10 }}>
            Drag to orbit · Scroll to zoom · Click namespace to collapse
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
