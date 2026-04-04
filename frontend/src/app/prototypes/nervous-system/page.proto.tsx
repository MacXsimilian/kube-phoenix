'use client'

// PROTOTYPE: Cluster Nervous System
// DEPS: three @react-three/fiber @react-three/drei
// LIBS: Three.js, React Three Fiber, Drei, GSAP
// DATA: Nodes, workloads, service connections
// DESCRIPTION: Cluster as a biological nervous system — nodes are neurons, traffic is electrical impulses

import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Slider from '@mui/material/Slider'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import { useRouter } from 'next/navigation'
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Html, MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'
import gsap from 'gsap'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NeuronHealth = 'healthy' | 'stressed' | 'critical' | 'sleeping'

interface NeuronData {
  id: string
  name: string
  namespace: string
  replicas: number
  health: NeuronHealth
  importance: number
  position: THREE.Vector3
}

interface SynapseData {
  id: string
  from: string
  to: string
  trafficVolume: number
}

interface NeuronState {
  health: NeuronHealth
  emissive: number
  pulseSpeed: number
  opacity: number
  distortSpeed: number
}

interface SynapseParticle {
  progress: number
  speed: number
  opacity: number
}

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------

const HEALTH_COLORS: Record<NeuronHealth, { core: string; glow: string }> = {
  healthy: { core: '#22D3EE', glow: '#06B6D4' },
  stressed: { core: '#F59E0B', glow: '#D97706' },
  critical: { core: '#EF4444', glow: '#DC2626' },
  sleeping: { core: '#1E293B', glow: '#0F172A' },
}

const NAMESPACE_COLORS: Record<string, string> = {
  production: '#22D3EE',
  payments: '#A78BFA',
  auth: '#34D399',
  'data-pipeline': '#F59E0B',
  'ml-training': '#EC4899',
  'internal-tools': '#FB923C',
  staging: '#818CF8',
  monitoring: '#2DD4BF',
  'dev-sandbox': '#94A3B8',
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const NEURON_DEFS: Omit<NeuronData, 'position'>[] = [
  { id: 'api-gateway', name: 'api-gateway', namespace: 'production', replicas: 8, health: 'healthy', importance: 1.0 },
  { id: 'checkout-service', name: 'checkout-service', namespace: 'payments', replicas: 4, health: 'healthy', importance: 0.8 },
  { id: 'payment-processor', name: 'payment-processor', namespace: 'payments', replicas: 3, health: 'healthy', importance: 0.9 },
  { id: 'user-auth', name: 'user-auth', namespace: 'auth', replicas: 6, health: 'healthy', importance: 0.85 },
  { id: 'kafka-consumer', name: 'kafka-consumer', namespace: 'data-pipeline', replicas: 5, health: 'healthy', importance: 0.7 },
  { id: 'spark-driver', name: 'spark-driver', namespace: 'ml-training', replicas: 2, health: 'healthy', importance: 0.5 },
  { id: 'admin-portal', name: 'admin-portal', namespace: 'internal-tools', replicas: 3, health: 'healthy', importance: 0.4 },
  { id: 'staging-api', name: 'staging-api', namespace: 'staging', replicas: 6, health: 'healthy', importance: 0.6 },
  { id: 'grafana', name: 'grafana', namespace: 'monitoring', replicas: 2, health: 'healthy', importance: 0.45 },
  { id: 'dev-api', name: 'dev-api', namespace: 'dev-sandbox', replicas: 2, health: 'healthy', importance: 0.3 },
]

const SYNAPSE_DEFS: SynapseData[] = [
  { id: 's1', from: 'api-gateway', to: 'user-auth', trafficVolume: 0.9 },
  { id: 's2', from: 'api-gateway', to: 'checkout-service', trafficVolume: 0.7 },
  { id: 's3', from: 'checkout-service', to: 'payment-processor', trafficVolume: 0.8 },
  { id: 's4', from: 'api-gateway', to: 'kafka-consumer', trafficVolume: 0.6 },
  { id: 's5', from: 'kafka-consumer', to: 'spark-driver', trafficVolume: 0.4 },
  { id: 's6', from: 'api-gateway', to: 'admin-portal', trafficVolume: 0.3 },
  { id: 's7', from: 'api-gateway', to: 'staging-api', trafficVolume: 0.5 },
  { id: 's8', from: 'staging-api', to: 'grafana', trafficVolume: 0.3 },
  { id: 's9', from: 'user-auth', to: 'kafka-consumer', trafficVolume: 0.4 },
  { id: 's10', from: 'payment-processor', to: 'kafka-consumer', trafficVolume: 0.5 },
  { id: 's11', from: 'grafana', to: 'api-gateway', trafficVolume: 0.2 },
  { id: 's12', from: 'admin-portal', to: 'dev-api', trafficVolume: 0.2 },
]

function computeNeuronPositions(): NeuronData[] {
  const count = NEURON_DEFS.length
  return NEURON_DEFS.map((def, i) => {
    const angle = (i / count) * Math.PI * 2
    const radius = 4 + (def.importance * 2)
    const yOffset = (Math.sin(angle * 3) * 1.5) + (i % 2 === 0 ? 0.5 : -0.5)
    return {
      ...def,
      position: new THREE.Vector3(
        Math.cos(angle) * radius,
        yOffset,
        Math.sin(angle) * radius,
      ),
    }
  })
}

// ---------------------------------------------------------------------------
// Dendrite curve builder
// ---------------------------------------------------------------------------

function buildDendriteCurve(
  start: THREE.Vector3,
  end: THREE.Vector3,
): THREE.CatmullRomCurve3 {
  const mid = start.clone().add(end).multiplyScalar(0.5)
  const offset = new THREE.Vector3(
    (Math.random() - 0.5) * 2,
    (Math.random() - 0.5) * 2.5,
    (Math.random() - 0.5) * 2,
  )
  mid.add(offset)
  return new THREE.CatmullRomCurve3([start, mid, end])
}

// ---------------------------------------------------------------------------
// Neuron component
// ---------------------------------------------------------------------------

interface NeuronMeshProps {
  neuron: NeuronData
  state: NeuronState
  isPlaying: boolean
  speed: number
}

function NeuronMesh({ neuron, state, isPlaying, speed }: NeuronMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const phaseRef = useRef(Math.random() * Math.PI * 2)

  const baseRadius = 0.3 + neuron.importance * 0.4
  const color = useMemo(() => new THREE.Color(HEALTH_COLORS[state.health].core), [state.health])
  const glowColor = useMemo(() => new THREE.Color(HEALTH_COLORS[state.health].glow), [state.health])

  useFrame((_, delta) => {
    if (!isPlaying) return
    phaseRef.current += delta * state.pulseSpeed * speed

    if (meshRef.current) {
      const pulse = 1 + Math.sin(phaseRef.current) * 0.08 * state.emissive
      meshRef.current.scale.setScalar(pulse)
    }

    if (glowRef.current) {
      const glowPulse = 0.3 + Math.sin(phaseRef.current * 0.7) * 0.15 * state.emissive
      const mat = glowRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = glowPulse * state.opacity
    }
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

  return (
    <group position={neuron.position}>
      {/* Glow sphere */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[baseRadius * 2.2, 16, 12]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.15 * state.opacity}
          depthWrite={false}
        />
      </mesh>

      {/* Neuron body */}
      <mesh
        ref={meshRef}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[baseRadius, 32, 24]} />
        <MeshDistortMaterial
          color={color}
          emissive={color}
          emissiveIntensity={state.emissive * 0.6}
          transparent
          opacity={state.opacity}
          roughness={0.4}
          metalness={0.1}
          distort={state.health === 'sleeping' ? 0.05 : 0.25}
          speed={state.distortSpeed * speed}
        />
      </mesh>

      {/* Hover tooltip */}
      {hovered && (
        <Html distanceFactor={12} style={{ pointerEvents: 'none' }}>
          <Box
            sx={{
              bgcolor: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid',
              borderColor: HEALTH_COLORS[state.health].core,
              borderRadius: 1.5,
              px: 1.5,
              py: 0.8,
              minWidth: 140,
              backdropFilter: 'blur(8px)',
            }}
          >
            <Typography variant="caption" fontWeight={700} sx={{ color: '#F8FAFC', display: 'block' }}>
              {neuron.name}
            </Typography>
            <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', fontSize: 10 }}>
              ns: {neuron.namespace}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B', display: 'block', fontSize: 10 }}>
              replicas: {neuron.replicas}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: HEALTH_COLORS[state.health].core,
                fontWeight: 600,
                display: 'block',
                fontSize: 10,
              }}
            >
              {state.health}
            </Typography>
          </Box>
        </Html>
      )}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Synapse particles
// ---------------------------------------------------------------------------

interface SynapseProps {
  synapse: SynapseData
  fromPos: THREE.Vector3
  toPos: THREE.Vector3
  particleOpacity: number
  isPlaying: boolean
  speed: number
}

function Synapse({ synapse, fromPos, toPos, particleOpacity, isPlaying, speed }: SynapseProps) {
  const curve = useMemo(() => buildDendriteCurve(fromPos, toPos), [fromPos, toPos])
  const tubeRef = useRef<THREE.Mesh>(null)
  const particlesRef = useRef<THREE.InstancedMesh>(null)

  const particleCount = Math.max(3, Math.floor(synapse.trafficVolume * 12))
  const progressRefs = useRef<number[]>(
    Array.from({ length: particleCount }, (_, i) => i / particleCount),
  )

  const tubeGeometry = useMemo(() => {
    return new THREE.TubeGeometry(curve, 32, 0.02, 6, false)
  }, [curve])

  const fromColor = useMemo(() => new THREE.Color('#22D3EE'), [])
  const particleDummy = useMemo(() => new THREE.Object3D(), [])

  useFrame((_, delta) => {
    if (!isPlaying || !particlesRef.current) return
    const adjustedDelta = delta * speed

    for (let i = 0; i < particleCount; i++) {
      progressRefs.current[i] += adjustedDelta * (0.3 + synapse.trafficVolume * 0.5)
      if (progressRefs.current[i] > 1) {
        progressRefs.current[i] -= 1
      }

      const point = curve.getPointAt(progressRefs.current[i])
      particleDummy.position.copy(point)
      const scale = 0.6 + Math.sin(progressRefs.current[i] * Math.PI) * 0.6
      particleDummy.scale.setScalar(scale)
      particleDummy.updateMatrix()
      particlesRef.current.setMatrixAt(i, particleDummy.matrix)
    }
    particlesRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      {/* Dendrite tube */}
      <mesh geometry={tubeGeometry}>
        <meshBasicMaterial
          color={fromColor}
          transparent
          opacity={0.12 * particleOpacity}
          depthWrite={false}
        />
      </mesh>

      {/* Impulse particles */}
      <instancedMesh
        ref={particlesRef}
        args={[undefined, undefined, particleCount]}
      >
        <sphereGeometry args={[0.06, 8, 6]} />
        <meshBasicMaterial
          color="#67E8F9"
          transparent
          opacity={0.8 * particleOpacity}
          depthWrite={false}
        />
      </instancedMesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Anesthesia wave effect (sleep)
// ---------------------------------------------------------------------------

function AnesthesiaWave({ progress, active }: { progress: number; active: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame(() => {
    if (!meshRef.current || !active) {
      if (meshRef.current) meshRef.current.visible = false
      return
    }
    meshRef.current.visible = true
    const radius = progress * 18
    meshRef.current.scale.setScalar(radius)
    const mat = meshRef.current.material as THREE.MeshBasicMaterial
    mat.opacity = Math.max(0, 0.15 * (1 - progress))
  })

  return (
    <mesh ref={meshRef} visible={false}>
      <sphereGeometry args={[1, 32, 24]} />
      <meshBasicMaterial
        color="#0F172A"
        transparent
        opacity={0.15}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// ---------------------------------------------------------------------------
// Resuscitation pulse (wake)
// ---------------------------------------------------------------------------

function ResuscitationPulse({ progress, active }: { progress: number; active: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame(() => {
    if (!meshRef.current || !active) {
      if (meshRef.current) meshRef.current.visible = false
      return
    }
    meshRef.current.visible = true
    const radius = progress * 18
    meshRef.current.scale.setScalar(radius)
    const mat = meshRef.current.material as THREE.MeshBasicMaterial
    mat.opacity = Math.max(0, 0.25 * (1 - progress * 0.7))
  })

  return (
    <mesh ref={meshRef} visible={false}>
      <sphereGeometry args={[1, 32, 24]} />
      <meshBasicMaterial
        color="#22D3EE"
        transparent
        opacity={0.25}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

interface NervousSceneProps {
  neurons: NeuronData[]
  synapses: SynapseData[]
  neuronStates: Map<string, NeuronState>
  isPlaying: boolean
  speed: number
  sleepProgress: number
  wakeProgress: number
  isSleeping: boolean
  isWaking: boolean
  resetTrigger: number
}

function NervousScene({
  neurons,
  synapses,
  neuronStates,
  isPlaying,
  speed,
  sleepProgress,
  wakeProgress,
  isSleeping,
  isWaking,
  resetTrigger,
}: NervousSceneProps) {
  const { camera } = useThree()
  const lastReset = useRef(resetTrigger)

  useFrame(() => {
    if (resetTrigger !== lastReset.current) {
      lastReset.current = resetTrigger
      camera.position.set(10, 7, 10)
      camera.lookAt(0, 0, 0)
    }
  })

  const neuronMap = useMemo(() => {
    const map = new Map<string, THREE.Vector3>()
    for (const n of neurons) {
      map.set(n.id, n.position)
    }
    return map
  }, [neurons])

  return (
    <>
      <ambientLight intensity={0.08} />
      <pointLight position={[8, 10, 8]} intensity={0.5} color="#06B6D4" />
      <pointLight position={[-8, -4, -8]} intensity={0.3} color="#7C3AED" />
      <pointLight position={[0, 6, 0]} intensity={0.2} color="#FFFFFF" />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={4}
        maxDistance={35}
      />

      <AnesthesiaWave progress={sleepProgress} active={isSleeping} />
      <ResuscitationPulse progress={wakeProgress} active={isWaking} />

      {neurons.map((neuron) => {
        const state = neuronStates.get(neuron.id)
        if (!state) return null
        return (
          <NeuronMesh
            key={neuron.id}
            neuron={neuron}
            state={state}
            isPlaying={isPlaying}
            speed={speed}
          />
        )
      })}

      {synapses.map((synapse) => {
        const fromPos = neuronMap.get(synapse.from)
        const toPos = neuronMap.get(synapse.to)
        if (!fromPos || !toPos) return null

        const fromState = neuronStates.get(synapse.from)
        const toState = neuronStates.get(synapse.to)
        const avgOpacity = ((fromState?.opacity ?? 1) + (toState?.opacity ?? 1)) / 2

        return (
          <Synapse
            key={synapse.id}
            synapse={synapse}
            fromPos={fromPos}
            toPos={toPos}
            particleOpacity={avgOpacity}
            isPlaying={isPlaying}
            speed={speed}
          />
        )
      })}
    </>
  )
}

// ---------------------------------------------------------------------------
// Default neuron state factory
// ---------------------------------------------------------------------------

function createDefaultState(health: NeuronHealth): NeuronState {
  return {
    health,
    emissive: health === 'sleeping' ? 0.1 : 1.0,
    pulseSpeed: health === 'sleeping' ? 0.3 : 2.5,
    opacity: health === 'sleeping' ? 0.2 : 1.0,
    distortSpeed: health === 'sleeping' ? 0.3 : 2.0,
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function NervousSystemPrototype() {
  const router = useRouter()
  const neurons = useMemo(() => computeNeuronPositions(), [])

  const [neuronStates, setNeuronStates] = useState<Map<string, NeuronState>>(() => {
    const map = new Map<string, NeuronState>()
    for (const n of neurons) {
      map.set(n.id, createDefaultState(n.health))
    }
    return map
  })

  const [isPlaying, setIsPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [resetTrigger, setResetTrigger] = useState(0)
  const [simulationState, setSimulationState] = useState<'idle' | 'sleeping' | 'waking'>('idle')
  const [sleepProgress, setSleepProgress] = useState(0)
  const [wakeProgress, setWakeProgress] = useState(0)

  const timelineRef = useRef<gsap.core.Timeline | null>(null)

  const cleanup = useCallback(() => {
    if (timelineRef.current) {
      timelineRef.current.kill()
      timelineRef.current = null
    }
  }, [])

  useEffect(() => {
    return cleanup
  }, [cleanup])

  const triggerSleep = useCallback(() => {
    cleanup()
    setSimulationState('sleeping')
    setSleepProgress(0)

    const sortedByDistance = [...neurons].sort((a, b) => a.position.length() - b.position.length())
    const progressObj = { value: 0 }
    const tl = gsap.timeline({
      onComplete: () => setSimulationState('idle'),
    })

    tl.to(progressObj, {
      value: 1,
      duration: 3,
      ease: 'power2.out',
      onUpdate: () => setSleepProgress(progressObj.value),
    })

    sortedByDistance.forEach((neuron, idx) => {
      const delay = (idx / sortedByDistance.length) * 2.5
      const stateProxy = { emissive: 1, pulseSpeed: 2.5, opacity: 1, distortSpeed: 2 }

      tl.to(stateProxy, {
        emissive: 0.1,
        pulseSpeed: 0.3,
        opacity: 0.15,
        distortSpeed: 0.3,
        duration: 1.2,
        ease: 'power3.in',
        onUpdate: () => {
          setNeuronStates(prev => {
            const next = new Map(prev)
            next.set(neuron.id, {
              health: 'sleeping',
              emissive: stateProxy.emissive,
              pulseSpeed: stateProxy.pulseSpeed,
              opacity: stateProxy.opacity,
              distortSpeed: stateProxy.distortSpeed,
            })
            return next
          })
        },
      }, delay)
    })

    timelineRef.current = tl
  }, [neurons, cleanup])

  const triggerWake = useCallback(() => {
    cleanup()
    setSimulationState('waking')
    setWakeProgress(0)

    const sortedByDistance = [...neurons].sort((a, b) => a.position.length() - b.position.length())
    const progressObj = { value: 0 }
    const tl = gsap.timeline({
      onComplete: () => setSimulationState('idle'),
    })

    tl.to(progressObj, {
      value: 1,
      duration: 2.5,
      ease: 'power2.out',
      onUpdate: () => setWakeProgress(progressObj.value),
    })

    sortedByDistance.forEach((neuron, idx) => {
      const delay = 0.3 + (idx / sortedByDistance.length) * 2.5
      const stateProxy = { emissive: 0.1, pulseSpeed: 0.3, opacity: 0.15, distortSpeed: 0.3 }

      tl.to(stateProxy, {
        emissive: 1.4,
        pulseSpeed: 4,
        opacity: 1,
        distortSpeed: 3,
        duration: 0.6,
        ease: 'power2.out',
        onUpdate: () => {
          setNeuronStates(prev => {
            const next = new Map(prev)
            next.set(neuron.id, {
              health: 'healthy',
              emissive: stateProxy.emissive,
              pulseSpeed: stateProxy.pulseSpeed,
              opacity: stateProxy.opacity,
              distortSpeed: stateProxy.distortSpeed,
            })
            return next
          })
        },
      }, delay)

      tl.to(stateProxy, {
        emissive: 1,
        pulseSpeed: 2.5,
        distortSpeed: 2,
        duration: 0.8,
        ease: 'power1.inOut',
        onUpdate: () => {
          setNeuronStates(prev => {
            const next = new Map(prev)
            next.set(neuron.id, {
              health: 'healthy',
              emissive: stateProxy.emissive,
              pulseSpeed: stateProxy.pulseSpeed,
              opacity: stateProxy.opacity,
              distortSpeed: stateProxy.distortSpeed,
            })
            return next
          })
        },
      }, delay + 0.6)
    })

    timelineRef.current = tl
  }, [neurons, cleanup])

  const handleReset = useCallback(() => {
    cleanup()
    setSimulationState('idle')
    setSleepProgress(0)
    setWakeProgress(0)
    setNeuronStates(() => {
      const map = new Map<string, NeuronState>()
      for (const n of neurons) {
        map.set(n.id, createDefaultState(n.health))
      }
      return map
    })
    setResetTrigger(prev => prev + 1)
  }, [neurons, cleanup])

  const legendItems: { label: string; color: string }[] = [
    { label: 'Healthy', color: HEALTH_COLORS.healthy.core },
    { label: 'Stressed', color: HEALTH_COLORS.stressed.core },
    { label: 'Critical', color: HEALTH_COLORS.critical.core },
    { label: 'Sleeping', color: HEALTH_COLORS.sleeping.core },
  ]

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', py: 4, px: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>
            FL16 — Cluster Nervous System
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Biological nervous system visualization — neurons are workloads, synapses are service connections, impulses are traffic
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
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
      </Box>

      {/* 3D Canvas */}
      <Box
        sx={{
          height: 620,
          borderRadius: 3,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'rgba(2, 6, 23, 0.92)',
          position: 'relative',
        }}
      >
        <Canvas
          camera={{ position: [10, 7, 10], fov: 50 }}
          gl={{ alpha: true, antialias: true }}
          style={{ background: 'transparent' }}
        >
          <NervousScene
            neurons={neurons}
            synapses={SYNAPSE_DEFS}
            neuronStates={neuronStates}
            isPlaying={isPlaying}
            speed={speed}
            sleepProgress={sleepProgress}
            wakeProgress={wakeProgress}
            isSleeping={simulationState === 'sleeping'}
            isWaking={simulationState === 'waking'}
            resetTrigger={resetTrigger}
          />
        </Canvas>

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
            Drag to orbit · Scroll to zoom · Hover neurons for details
          </Typography>
        </Box>
      </Box>

      {/* Dev toolbar */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          bgcolor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
          px: 3,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          backdropFilter: 'blur(12px)',
        }}
      >
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mr: 1 }}>
          DEV
        </Typography>

        {/* Play / Pause */}
        <IconButton
          size="small"
          onClick={() => setIsPlaying(prev => !prev)}
          sx={{ color: isPlaying ? 'success.main' : 'warning.main' }}
        >
          {isPlaying ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
        </IconButton>

        {/* Reset */}
        <IconButton size="small" onClick={handleReset} sx={{ color: 'text.secondary' }}>
          <RestartAltIcon fontSize="small" />
        </IconButton>

        {/* Speed */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 160 }}>
          <Typography variant="caption" color="text.secondary">
            Speed
          </Typography>
          <Slider
            value={speed}
            min={0.1}
            max={3}
            step={0.1}
            onChange={(_, val) => setSpeed(val as number)}
            size="small"
            sx={{ width: 100 }}
          />
          <Typography variant="caption" fontWeight={600} color="text.primary" sx={{ minWidth: 32 }}>
            {speed.toFixed(1)}x
          </Typography>
        </Box>

        <Box sx={{ flex: 1 }} />

        {/* Sleep trigger */}
        <Button
          variant="outlined"
          size="small"
          startIcon={<BedtimeIcon />}
          disabled={simulationState !== 'idle'}
          onClick={triggerSleep}
          sx={{ borderColor: '#475569', color: '#94A3B8', textTransform: 'none' }}
        >
          Sleep (Anesthesia)
        </Button>

        {/* Wake trigger */}
        <Button
          variant="outlined"
          size="small"
          startIcon={<WbSunnyIcon />}
          disabled={simulationState !== 'idle'}
          onClick={triggerWake}
          sx={{ borderColor: '#06B6D4', color: '#22D3EE', textTransform: 'none' }}
        >
          Wake (Resuscitation)
        </Button>

        {simulationState !== 'idle' && (
          <Chip
            label={simulationState === 'sleeping' ? 'Anesthetizing...' : 'Resuscitating...'}
            size="small"
            sx={{
              bgcolor: simulationState === 'sleeping' ? 'rgba(71,85,105,0.2)' : 'rgba(6,182,212,0.2)',
              color: simulationState === 'sleeping' ? '#94A3B8' : '#22D3EE',
              fontWeight: 600,
              fontSize: 11,
              animation: 'pulse 1.5s infinite',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.5 },
              },
            }}
          />
        )}
      </Box>
    </Box>
  )
}
