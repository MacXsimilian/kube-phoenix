'use client'

// PROTOTYPE: Physics Pod Collider
// DEPS: three @react-three/fiber @react-three/drei
// LIBS: Three.js, React Three Fiber, Drei, Custom Physics
// DATA: Pods, deployments, namespaces
// DESCRIPTION: Pods as physics rigid bodies orbiting deployment gravity wells with real collision

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Line, Text, OrthographicCamera } from '@react-three/drei'
import * as THREE from 'three'
import gsap from 'gsap'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Slider from '@mui/material/Slider'
import Switch from '@mui/material/Switch'
import Chip from '@mui/material/Chip'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import SpeedIcon from '@mui/icons-material/Speed'
import { useRouter } from 'next/navigation'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PodStatus = 'running' | 'pending' | 'failed' | 'sleeping'

interface PodDef {
  id: string
  name: string
  deployment: string
  namespace: string
  status: PodStatus
  containerCount: number
}

interface DeploymentDef {
  name: string
  namespace: string
  podCount: number
  statusOverrides?: Partial<Record<number, PodStatus>>
  containerCounts?: Partial<Record<number, number>>
}

interface NamespaceConfig {
  cx: number
  cy: number
  width: number
  height: number
  color: string
  sleepTarget: boolean
}

interface PhysicsBody {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  mass: number
  color: string
  deployment: string
  namespace: string
  status: PodStatus
  spawning: boolean
  spawnY: number
  settled: boolean
  opacity: number
  sleeping: boolean
  driftingOff: boolean
}

interface GravityWell {
  name: string
  namespace: string
  x: number
  y: number
  strength: number
  active: boolean
  pulsePhase: number
  shockwaveRadius: number
  shockwaveOpacity: number
  sparkleTime: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<PodStatus, string> = {
  running: '#22C55E',
  pending: '#F59E0B',
  failed: '#EF4444',
  sleeping: '#64748B',
}

const WORLD_WIDTH = 40
const WORLD_HEIGHT = 24
const GRAVITY_CONSTANT = 0.8
const TANGENTIAL_FACTOR = 0.6
const DAMPING = 0.992
const SPAWN_DAMPING = 0.96
const COLLISION_RESTITUTION = 0.7
const BOUNDARY_RESTITUTION = 0.5
const MIN_ORBIT_DISTANCE = 1.2
const MAX_ORBIT_DISTANCE = 4.5

const SLEEP_TARGETS = ['staging', 'dev-sandbox', 'internal-tools']

// ---------------------------------------------------------------------------
// Namespace Layout
// ---------------------------------------------------------------------------

const NS_CONFIG: Record<string, NamespaceConfig> = {
  production:       { cx: -8,  cy: 3,   width: 14, height: 10, color: '#3B82F6', sleepTarget: false },
  payments:         { cx: 8,   cy: 5,   width: 10, height: 8,  color: '#8B5CF6', sleepTarget: false },
  staging:          { cx: -10, cy: -7,  width: 8,  height: 6,  color: '#F59E0B', sleepTarget: true },
  'dev-sandbox':    { cx: 0,   cy: -8,  width: 7,  height: 5,  color: '#EC4899', sleepTarget: true },
  'internal-tools': { cx: 9,   cy: -6,  width: 8,  height: 6,  color: '#14B8A6', sleepTarget: true },
  monitoring:       { cx: 16,  cy: -2,  width: 7,  height: 8,  color: '#F97316', sleepTarget: false },
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const DEPLOYMENT_DEFS: DeploymentDef[] = [
  { name: 'api-gateway',       namespace: 'production',       podCount: 8, statusOverrides: { 6: 'pending' } },
  { name: 'redis-sentinel',    namespace: 'production',       podCount: 3 },
  { name: 'checkout-service',  namespace: 'payments',         podCount: 4 },
  { name: 'payment-processor', namespace: 'payments',         podCount: 3, statusOverrides: { 2: 'failed' } },
  { name: 'staging-api',       namespace: 'staging',          podCount: 6 },
  { name: 'dev-api',           namespace: 'dev-sandbox',      podCount: 2 },
  { name: 'admin-portal',      namespace: 'internal-tools',   podCount: 3 },
  { name: 'grafana',           namespace: 'monitoring',       podCount: 2 },
  { name: 'prometheus',        namespace: 'monitoring',       podCount: 1 },
]

function buildPods(): PodDef[] {
  const pods: PodDef[] = []
  for (const dep of DEPLOYMENT_DEFS) {
    for (let i = 0; i < dep.podCount; i++) {
      const status = dep.statusOverrides?.[i] ?? 'running'
      const containers = dep.containerCounts?.[i] ?? (1 + Math.floor(Math.random() * 3))
      pods.push({
        id: `${dep.namespace}/${dep.name}-${i}`,
        name: `${dep.name}-${String(i).padStart(2, '0')}`,
        deployment: dep.name,
        namespace: dep.namespace,
        status,
        containerCount: containers,
      })
    }
  }
  return pods
}

function buildGravityWells(): GravityWell[] {
  const wells: GravityWell[] = []
  const deploymentsByNs = new Map<string, DeploymentDef[]>()

  for (const dep of DEPLOYMENT_DEFS) {
    const existing = deploymentsByNs.get(dep.namespace) ?? []
    existing.push(dep)
    deploymentsByNs.set(dep.namespace, existing)
  }

  for (const [ns, deps] of deploymentsByNs) {
    const nsConfig = NS_CONFIG[ns]
    if (!nsConfig) continue

    const spacing = nsConfig.width / (deps.length + 1)
    deps.forEach((dep, idx) => {
      wells.push({
        name: dep.name,
        namespace: ns,
        x: nsConfig.cx - nsConfig.width / 2 + spacing * (idx + 1),
        y: nsConfig.cy,
        strength: 1 + dep.podCount * 0.15,
        active: true,
        pulsePhase: Math.random() * Math.PI * 2,
        shockwaveRadius: 0,
        shockwaveOpacity: 0,
        sparkleTime: 0,
      })
    })
  }
  return wells
}

function buildBodies(pods: PodDef[], wells: GravityWell[]): PhysicsBody[] {
  return pods.map((pod) => {
    const well = wells.find((w) => w.name === pod.deployment && w.namespace === pod.namespace)
    const angle = Math.random() * Math.PI * 2
    const dist = MIN_ORBIT_DISTANCE + Math.random() * (MAX_ORBIT_DISTANCE - MIN_ORBIT_DISTANCE)
    const baseX = well ? well.x : 0
    const baseY = well ? well.y : 0
    const radius = 0.2 + pod.containerCount * 0.08

    return {
      id: pod.id,
      x: baseX + Math.cos(angle) * dist,
      y: 15 + Math.random() * 5,
      vx: 0,
      vy: -0.5 - Math.random() * 0.5,
      radius,
      mass: 0.5 + pod.containerCount * 0.3,
      color: STATUS_COLORS[pod.status],
      deployment: pod.deployment,
      namespace: pod.namespace,
      status: pod.status,
      spawning: true,
      spawnY: baseY + Math.sin(angle) * dist,
      settled: false,
      opacity: 1,
      sleeping: false,
      driftingOff: false,
    }
  })
}

// ---------------------------------------------------------------------------
// Physics Engine
// ---------------------------------------------------------------------------

interface PhysicsState {
  bodies: PhysicsBody[]
  wells: GravityWell[]
  phase: 'orbit' | 'sleeping' | 'waking'
  slowMotionFactor: number
}

function tickPhysics(
  state: PhysicsState,
  dt: number,
  gravityStrength: number,
  chaosMode: boolean,
): void {
  const { bodies, wells, phase } = state
  const effectiveDt = dt * state.slowMotionFactor

  for (const well of wells) {
    well.pulsePhase += effectiveDt * 2
    if (well.shockwaveRadius > 0) {
      well.shockwaveRadius += effectiveDt * 12
      well.shockwaveOpacity = Math.max(0, 1 - well.shockwaveRadius / 8)
      if (well.shockwaveOpacity <= 0) {
        well.shockwaveRadius = 0
      }
    }
    if (well.sparkleTime > 0) {
      well.sparkleTime -= effectiveDt
    }
  }

  for (const body of bodies) {
    if (body.driftingOff) {
      body.vy -= effectiveDt * 0.3
      body.x += body.vx * effectiveDt
      body.y += body.vy * effectiveDt
      body.opacity = Math.max(0, body.opacity - effectiveDt * 0.3)
      continue
    }

    if (body.spawning) {
      applySpawnPhysics(body, effectiveDt)
      continue
    }

    applyGravity(body, wells, effectiveDt, gravityStrength, chaosMode)

    body.vx *= DAMPING
    body.vy *= DAMPING

    body.x += body.vx * effectiveDt
    body.y += body.vy * effectiveDt

    applyBoundaryCollision(body)
  }

  resolveBodyCollisions(bodies, effectiveDt)
  detectSlowMotionTrigger(state, phase)
}

function applySpawnPhysics(body: PhysicsBody, dt: number): void {
  const targetY = body.spawnY
  const dy = targetY - body.y

  if (Math.abs(dy) < 0.1 && Math.abs(body.vy) < 0.1) {
    body.spawning = false
    body.y = targetY
    body.vy = 0
    return
  }

  body.vy += dy * 0.05
  body.vy *= SPAWN_DAMPING
  body.y += body.vy * dt
}

function applyGravity(
  body: PhysicsBody,
  wells: GravityWell[],
  dt: number,
  gravityStrength: number,
  chaosMode: boolean,
): void {
  for (const well of wells) {
    if (!well.active) continue

    const isHome = well.name === body.deployment && well.namespace === body.namespace
    const dx = well.x - body.x
    const dy = well.y - body.y
    const distSq = dx * dx + dy * dy
    const dist = Math.sqrt(distSq)

    if (dist < 0.01) continue

    const homeMultiplier = isHome ? 1.0 : 0.05
    const strength = GRAVITY_CONSTANT * gravityStrength * well.strength * homeMultiplier

    const forceMag = strength / Math.max(distSq, 0.5)
    const nx = dx / dist
    const ny = dy / dist

    body.vx += nx * forceMag * dt
    body.vy += ny * forceMag * dt

    if (isHome) {
      const tangentX = -ny * TANGENTIAL_FACTOR
      const tangentY = nx * TANGENTIAL_FACTOR
      const tangentStrength = chaosMode ? 0.15 : 0.04
      body.vx += tangentX * tangentStrength * dt
      body.vy += tangentY * tangentStrength * dt
    }
  }

  if (chaosMode) {
    body.vx += (Math.random() - 0.5) * 0.3 * dt
    body.vy += (Math.random() - 0.5) * 0.3 * dt
  }
}

function applyBoundaryCollision(body: PhysicsBody): void {
  const halfW = WORLD_WIDTH / 2
  const halfH = WORLD_HEIGHT / 2

  if (body.x - body.radius < -halfW) {
    body.x = -halfW + body.radius
    body.vx = Math.abs(body.vx) * BOUNDARY_RESTITUTION
  }
  if (body.x + body.radius > halfW) {
    body.x = halfW - body.radius
    body.vx = -Math.abs(body.vx) * BOUNDARY_RESTITUTION
  }
  if (body.y - body.radius < -halfH) {
    body.y = -halfH + body.radius
    body.vy = Math.abs(body.vy) * BOUNDARY_RESTITUTION
  }
  if (body.y + body.radius > halfH) {
    body.y = halfH - body.radius
    body.vy = -Math.abs(body.vy) * BOUNDARY_RESTITUTION
  }
}

function resolveBodyCollisions(bodies: PhysicsBody[], _dt: number): void {
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i]
      const b = bodies[j]

      if (a.driftingOff || b.driftingOff) continue

      const dx = b.x - a.x
      const dy = b.y - a.y
      const distSq = dx * dx + dy * dy
      const minDist = a.radius + b.radius

      if (distSq >= minDist * minDist) continue
      if (distSq < 0.0001) continue

      const dist = Math.sqrt(distSq)
      const overlap = minDist - dist
      const nx = dx / dist
      const ny = dy / dist

      const totalMass = a.mass + b.mass
      const pushA = overlap * (b.mass / totalMass)
      const pushB = overlap * (a.mass / totalMass)

      a.x -= nx * pushA
      a.y -= ny * pushA
      b.x += nx * pushB
      b.y += ny * pushB

      const relVx = b.vx - a.vx
      const relVy = b.vy - a.vy
      const relDotN = relVx * nx + relVy * ny

      if (relDotN > 0) continue

      const impulse = -(1 + COLLISION_RESTITUTION) * relDotN / totalMass

      a.vx -= impulse * b.mass * nx
      a.vy -= impulse * b.mass * ny
      b.vx += impulse * a.mass * nx
      b.vy += impulse * a.mass * ny
    }
  }
}

function detectSlowMotionTrigger(state: PhysicsState, phase: string): void {
  if (phase !== 'sleeping') {
    state.slowMotionFactor = 1
    return
  }

  const activeBodies = state.bodies.filter(
    (b) => SLEEP_TARGETS.includes(b.namespace) && !b.driftingOff && b.opacity > 0.1
  )

  if (activeBodies.length === 1) {
    state.slowMotionFactor = 0.3
  } else if (activeBodies.length === 0) {
    state.slowMotionFactor = 1
  }
}

// ---------------------------------------------------------------------------
// R3F Components
// ---------------------------------------------------------------------------

interface PodSphereProps {
  body: PhysicsBody
}

function PodSphere({ body }: PodSphereProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)

  useFrame(() => {
    if (!meshRef.current) return
    meshRef.current.position.set(body.x, body.y, 0)
    meshRef.current.scale.setScalar(body.radius)
    const mat = meshRef.current.material as THREE.MeshStandardMaterial
    mat.opacity = body.opacity

    if (glowRef.current) {
      glowRef.current.position.set(body.x, body.y, -0.1)
      glowRef.current.scale.setScalar(body.radius * 2.5)
      const glowMat = glowRef.current.material as THREE.MeshBasicMaterial
      glowMat.opacity = body.opacity * 0.15
    }
  })

  return (
    <>
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial
          color={body.color}
          emissive={body.color}
          emissiveIntensity={0.4}
          transparent
          opacity={body.opacity}
        />
      </mesh>
      <mesh ref={glowRef}>
        <circleGeometry args={[1, 24]} />
        <meshBasicMaterial
          color={body.color}
          transparent
          opacity={0.15}
          depthWrite={false}
        />
      </mesh>
    </>
  )
}

interface GravityWellVisualProps {
  well: GravityWell
}

function GravityWellVisual({ well }: GravityWellVisualProps) {
  const ringRef = useRef<THREE.Mesh>(null)
  const shockwaveRef = useRef<THREE.Mesh>(null)
  const labelRef = useRef<THREE.Group>(null)

  useFrame(() => {
    if (!ringRef.current) return

    const pulse = 0.8 + Math.sin(well.pulsePhase) * 0.2
    const baseScale = well.active ? 1.2 * well.strength : 0.3
    ringRef.current.scale.setScalar(baseScale * pulse)

    const mat = ringRef.current.material as THREE.MeshBasicMaterial
    mat.opacity = well.active ? 0.25 + Math.sin(well.pulsePhase) * 0.1 : 0.05

    if (shockwaveRef.current) {
      shockwaveRef.current.scale.setScalar(well.shockwaveRadius || 0.001)
      const swMat = shockwaveRef.current.material as THREE.MeshBasicMaterial
      swMat.opacity = well.shockwaveOpacity
      shockwaveRef.current.visible = well.shockwaveRadius > 0
    }
  })

  const ringPoints = useMemo(() => {
    const pts: THREE.Vector3[] = []
    const segments = 48
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      pts.push(new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0))
    }
    return pts
  }, [])

  return (
    <group position={[well.x, well.y, -0.2]}>
      <Line
        points={ringPoints}
        color={well.active ? '#60A5FA' : '#334155'}
        lineWidth={1.5}
        transparent
        opacity={well.active ? 0.3 : 0.1}
      />
      <mesh ref={ringRef}>
        <ringGeometry args={[0.8, 1.0, 48]} />
        <meshBasicMaterial
          color="#60A5FA"
          transparent
          opacity={0.2}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={shockwaveRef} visible={false}>
        <ringGeometry args={[0.9, 1.0, 48]} />
        <meshBasicMaterial
          color="#38BDF8"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <Text
        position={[0, -1.5, 0]}
        fontSize={0.35}
        color="#94A3B8"
        anchorX="center"
        anchorY="top"
      >
        {well.name}
      </Text>
    </group>
  )
}

interface NamespaceRegionProps {
  name: string
  config: NamespaceConfig
}

function NamespaceRegion({ name, config }: NamespaceRegionProps) {
  return (
    <group position={[config.cx, config.cy, -0.5]}>
      <mesh>
        <planeGeometry args={[config.width, config.height]} />
        <meshBasicMaterial
          color={config.color}
          transparent
          opacity={0.04}
          depthWrite={false}
        />
      </mesh>
      <Line
        points={[
          new THREE.Vector3(-config.width / 2, -config.height / 2, 0),
          new THREE.Vector3(config.width / 2, -config.height / 2, 0),
          new THREE.Vector3(config.width / 2, config.height / 2, 0),
          new THREE.Vector3(-config.width / 2, config.height / 2, 0),
          new THREE.Vector3(-config.width / 2, -config.height / 2, 0),
        ]}
        color={config.color}
        lineWidth={1}
        transparent
        opacity={0.15}
      />
      <Text
        position={[-config.width / 2 + 0.3, config.height / 2 - 0.3, 0]}
        fontSize={0.4}
        color={config.color}
        anchorX="left"
        anchorY="top"
        fillOpacity={0.5}
      >
        {name}
      </Text>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Main Scene
// ---------------------------------------------------------------------------

interface SceneProps {
  physicsRef: React.RefObject<PhysicsState | null>
}

function Scene({ physicsRef }: SceneProps) {
  const { size } = useThree()

  const aspect = size.width / size.height
  const frustumHeight = WORLD_HEIGHT + 4
  const frustumWidth = frustumHeight * aspect

  return (
    <>
      <color attach="background" args={['#0F172A']} />
      <ambientLight intensity={0.6} />
      <pointLight position={[0, 0, 10]} intensity={0.8} />

      <OrthographicCamera
        makeDefault
        position={[0, 0, 20]}
        left={-frustumWidth / 2}
        right={frustumWidth / 2}
        top={frustumHeight / 2}
        bottom={-frustumHeight / 2}
        near={0.1}
        far={100}
      />

      {Object.entries(NS_CONFIG).map(([name, cfg]) => (
        <NamespaceRegion key={name} name={name} config={cfg} />
      ))}

      {physicsRef.current?.wells.map((well) => (
        <GravityWellVisual key={`${well.namespace}/${well.name}`} well={well} />
      ))}

      {physicsRef.current?.bodies.map((body) => (
        <PodSphere key={body.id} body={body} />
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// Sparkle Particles (post-wake burst)
// ---------------------------------------------------------------------------

interface SparkleData {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
}

function SparkleParticles({ sparkles }: { sparkles: SparkleData[] }) {
  return (
    <>
      {sparkles.map((s, i) => {
        const alpha = Math.max(0, s.life / s.maxLife)
        return (
          <mesh key={i} position={[s.x, s.y, 0.1]}>
            <circleGeometry args={[0.06, 8]} />
            <meshBasicMaterial
              color={s.color}
              transparent
              opacity={alpha}
              depthWrite={false}
            />
          </mesh>
        )
      })}
    </>
  )
}

// ---------------------------------------------------------------------------
// Full Scene Wrapper (includes physics loop)
// ---------------------------------------------------------------------------

interface PhysicsSceneProps {
  physicsRef: React.RefObject<PhysicsState | null>
  playing: boolean
  speed: number
  gravityStrength: number
  chaosMode: boolean
  sparklesRef: React.RefObject<SparkleData[]>
}

function PhysicsScene({
  physicsRef,
  playing,
  speed,
  gravityStrength,
  chaosMode,
  sparklesRef,
}: PhysicsSceneProps) {
  useFrame((_, delta) => {
    if (!playing || !physicsRef.current) return

    const clampedDt = Math.min(delta, 0.05) * speed
    tickPhysics(physicsRef.current, clampedDt, gravityStrength, chaosMode)

    if (sparklesRef.current) {
      for (const s of sparklesRef.current) {
        s.x += s.vx * clampedDt
        s.y += s.vy * clampedDt
        s.life -= clampedDt
      }
      sparklesRef.current = sparklesRef.current.filter((s) => s.life > 0)
    }
  })

  return (
    <>
      <Scene physicsRef={physicsRef} />
      {sparklesRef.current && <SparkleParticles sparkles={sparklesRef.current} />}
    </>
  )
}

// ---------------------------------------------------------------------------
// Dev Toolbar
// ---------------------------------------------------------------------------

interface ToolbarProps {
  playing: boolean
  onTogglePlay: () => void
  onReset: () => void
  speed: number
  onSpeedChange: (v: number) => void
  gravityStrength: number
  onGravityChange: (v: number) => void
  chaosMode: boolean
  onChaosToggle: () => void
  phase: string
  onSleep: () => void
  onWake: () => void
  podCount: number
  activePodCount: number
}

function DevToolbar({
  playing,
  onTogglePlay,
  onReset,
  speed,
  onSpeedChange,
  gravityStrength,
  onGravityChange,
  chaosMode,
  onChaosToggle,
  phase,
  onSleep,
  onWake,
  podCount,
  activePodCount,
}: ToolbarProps) {
  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        bgcolor: 'background.paper',
        borderTop: 1,
        borderColor: 'divider',
        px: 3,
        py: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flexWrap: 'wrap',
      }}
    >
      <IconButton onClick={onTogglePlay} size="small" color="primary">
        {playing ? <PauseIcon /> : <PlayArrowIcon />}
      </IconButton>

      <IconButton onClick={onReset} size="small">
        <RestartAltIcon />
      </IconButton>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 140 }}>
        <SpeedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
        <Slider
          value={speed}
          onChange={(_, v) => onSpeedChange(v as number)}
          min={0.1}
          max={3}
          step={0.1}
          size="small"
          sx={{ width: 100 }}
        />
        <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 30 }}>
          {speed.toFixed(1)}x
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 160 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Gravity
        </Typography>
        <Slider
          value={gravityStrength}
          onChange={(_, v) => onGravityChange(v as number)}
          min={0}
          max={3}
          step={0.1}
          size="small"
          sx={{ width: 100 }}
        />
        <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 30 }}>
          {gravityStrength.toFixed(1)}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Chaos
        </Typography>
        <Switch checked={chaosMode} onChange={onChaosToggle} size="small" />
      </Box>

      <Box sx={{ borderLeft: 1, borderColor: 'divider', pl: 2, display: 'flex', gap: 1 }}>
        <Button
          size="small"
          variant={phase === 'sleeping' ? 'contained' : 'outlined'}
          startIcon={<BedtimeIcon />}
          onClick={onSleep}
          disabled={phase === 'sleeping'}
        >
          Sleep
        </Button>
        <Button
          size="small"
          variant={phase === 'waking' ? 'contained' : 'outlined'}
          startIcon={<WbSunnyIcon />}
          onClick={onWake}
          disabled={phase === 'orbit'}
        >
          Wake
        </Button>
      </Box>

      <Chip
        label={`${activePodCount}/${podCount} pods`}
        size="small"
        color={phase === 'sleeping' ? 'warning' : 'success'}
        variant="outlined"
      />

      <Chip label={phase} size="small" variant="outlined" />
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function PodColliderPrototype() {
  const router = useRouter()
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [gravityStrength, setGravityStrength] = useState(1)
  const [chaosMode, setChaosMode] = useState(false)
  const [phase, setPhase] = useState<'orbit' | 'sleeping' | 'waking'>('orbit')
  const [resetKey, setResetKey] = useState(0)

  const physicsRef = useRef<PhysicsState | null>(null)
  const sparklesRef = useRef<SparkleData[]>([])

  const initPhysics = useCallback(() => {
    const pods = buildPods()
    const wells = buildGravityWells()
    const bodies = buildBodies(pods, wells)
    sparklesRef.current = []

    physicsRef.current = {
      bodies,
      wells,
      phase: 'orbit',
      slowMotionFactor: 1,
    }
  }, [])

  useEffect(() => {
    initPhysics()
  }, [initPhysics, resetKey])

  const handleReset = useCallback(() => {
    setPhase('orbit')
    setResetKey((k) => k + 1)
  }, [])

  const handleSleep = useCallback(() => {
    if (!physicsRef.current) return
    setPhase('sleeping')
    physicsRef.current.phase = 'sleeping'

    const { wells, bodies } = physicsRef.current

    for (const well of wells) {
      if (SLEEP_TARGETS.includes(well.namespace)) {
        gsap.to(well, {
          strength: 0,
          duration: 1.5,
          ease: 'power2.inOut',
          onComplete: () => { well.active = false },
        })
      }
    }

    for (const body of bodies) {
      if (SLEEP_TARGETS.includes(body.namespace)) {
        body.status = 'sleeping'
        body.color = STATUS_COLORS.sleeping

        gsap.to(body, {
          delay: 1.5 + Math.random() * 2,
          duration: 0,
          onComplete: () => {
            body.driftingOff = true
            body.sleeping = true
            body.vx = (Math.random() - 0.5) * 2
            body.vy = -1 - Math.random() * 2
          },
        })
      }
    }
  }, [])

  const handleWake = useCallback(() => {
    if (!physicsRef.current) return
    setPhase('waking')
    physicsRef.current.phase = 'orbit'
    physicsRef.current.slowMotionFactor = 1

    const { wells, bodies } = physicsRef.current

    for (const well of wells) {
      if (SLEEP_TARGETS.includes(well.namespace)) {
        well.active = true
        well.shockwaveRadius = 0.5
        well.shockwaveOpacity = 1
        well.sparkleTime = 2

        gsap.to(well, {
          strength: 1 + DEPLOYMENT_DEFS.find(
            (d) => d.name === well.name && d.namespace === well.namespace
          )!.podCount * 0.15,
          duration: 1,
          ease: 'power2.out',
        })

        emitSparkles(sparklesRef, well.x, well.y, '#38BDF8')
      }
    }

    const sleepingBodies = bodies.filter((b) => b.sleeping)
    for (const body of sleepingBodies) {
      body.driftingOff = false
      body.sleeping = false
      body.opacity = 1
      body.status = 'running'
      body.color = STATUS_COLORS.running
      body.spawning = true

      const well = wells.find(
        (w) => w.name === body.deployment && w.namespace === body.namespace
      )
      if (well) {
        const angle = Math.random() * Math.PI * 2
        const dist = MIN_ORBIT_DISTANCE + Math.random() * (MAX_ORBIT_DISTANCE - MIN_ORBIT_DISTANCE)
        body.x = well.x + Math.cos(angle) * dist
        body.y = 15 + Math.random() * 3
        body.spawnY = well.y + Math.sin(angle) * dist
        body.vx = 0
        body.vy = -0.5
      }
    }

    gsap.delayedCall(2, () => {
      setPhase('orbit')
    })
  }, [])

  const totalPods = physicsRef.current?.bodies.length ?? 0
  const activePods = physicsRef.current?.bodies.filter(
    (b) => !b.sleeping && !b.driftingOff && b.opacity > 0.1
  ).length ?? 0

  return (
    <Box sx={{ width: '100vw', height: '100vh', position: 'relative', bgcolor: '#0F172A' }}>
      <Box sx={{ position: 'absolute', top: 16, left: 16, zIndex: 10 }}>
        <IconButton onClick={() => router.push('/prototypes')} sx={{ color: '#94A3B8' }}>
          <ArrowBackIcon />
        </IconButton>
      </Box>

      <Box sx={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
        <Typography variant="h6" sx={{ color: '#E2E8F0', fontWeight: 600, letterSpacing: 1 }}>
          FL19 Physics Pod Collider
        </Typography>
        <Typography variant="caption" sx={{ color: '#64748B', display: 'block', textAlign: 'center' }}>
          Pods orbit deployment gravity wells with real-time collision
        </Typography>
      </Box>

      <Canvas
        key={resetKey}
        style={{ width: '100%', height: '100%' }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor('#0F172A')
        }}
      >
        <PhysicsScene
          physicsRef={physicsRef}
          playing={playing}
          speed={speed}
          gravityStrength={gravityStrength}
          chaosMode={chaosMode}
          sparklesRef={sparklesRef}
        />
      </Canvas>

      <DevToolbar
        playing={playing}
        onTogglePlay={() => setPlaying((p) => !p)}
        onReset={handleReset}
        speed={speed}
        onSpeedChange={setSpeed}
        gravityStrength={gravityStrength}
        onGravityChange={setGravityStrength}
        chaosMode={chaosMode}
        onChaosToggle={() => setChaosMode((c) => !c)}
        phase={phase}
        onSleep={handleSleep}
        onWake={handleWake}
        podCount={totalPods}
        activePodCount={activePods}
      />
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Sparkle Emitter Helper
// ---------------------------------------------------------------------------

function emitSparkles(
  ref: React.RefObject<SparkleData[]>,
  x: number,
  y: number,
  color: string,
): void {
  if (!ref.current) return
  const count = 12
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3
    const speed = 2 + Math.random() * 3
    ref.current.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1 + Math.random() * 0.5,
      maxLife: 1.5,
      color,
    })
  }
}
