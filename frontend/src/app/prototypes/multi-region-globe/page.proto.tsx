'use client'

// PROTOTYPE: Multi-Region Cluster Globe
// DEPS: three @react-three/fiber @react-three/drei @react-three/postprocessing
// LIBS: Three.js, React Three Fiber, Drei, PostProcessing, GSAP
// DATA: Cloud regions, cluster status, policy schedules
// DESCRIPTION: 3D Earth globe showing cloud regions with sleep/wake state visualization

import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Stars, OrbitControls, Html } from '@react-three/drei'
import gsap from 'gsap'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import SpeedIcon from '@mui/icons-material/Speed'
import PublicIcon from '@mui/icons-material/Public'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import LightModeIcon from '@mui/icons-material/LightMode'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useTheme, type Theme } from '@mui/material/styles'
import { useRouter } from 'next/navigation'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RegionStatus = 'healthy' | 'transitioning' | 'sleeping' | 'error'

interface CloudRegion {
  id: string
  name: string
  lat: number
  lng: number
  nodeCount: number
  podCount: number
  activePolicies: number
  status: RegionStatus
  monthlySavings: number
}

interface NamespaceInfo {
  name: string
  podCount: number
  sleeping: boolean
}

interface ArcConfig {
  from: string
  to: string
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const INITIAL_REGIONS: CloudRegion[] = [
  {
    id: 'eu-west-1',
    name: 'EU West (Ireland)',
    lat: 53.3498,
    lng: -6.2603,
    nodeCount: 6,
    podCount: 139,
    activePolicies: 4,
    status: 'healthy',
    monthlySavings: 2340,
  },
  {
    id: 'us-east-1',
    name: 'US East (Virginia)',
    lat: 37.4316,
    lng: -78.6569,
    nodeCount: 8,
    podCount: 212,
    activePolicies: 6,
    status: 'healthy',
    monthlySavings: 4120,
  },
  {
    id: 'ap-southeast-1',
    name: 'AP Southeast (Singapore)',
    lat: 1.3521,
    lng: 103.8198,
    nodeCount: 4,
    podCount: 87,
    activePolicies: 3,
    status: 'healthy',
    monthlySavings: 1580,
  },
]

const NAMESPACE_DATA: Record<string, NamespaceInfo[]> = {
  'eu-west-1': [
    { name: 'production', podCount: 42, sleeping: false },
    { name: 'payments', podCount: 18, sleeping: false },
    { name: 'auth-service', podCount: 12, sleeping: false },
    { name: 'staging', podCount: 24, sleeping: true },
    { name: 'monitoring', podCount: 15, sleeping: false },
    { name: 'dev-sandbox', podCount: 28, sleeping: true },
  ],
  'us-east-1': [
    { name: 'production', podCount: 65, sleeping: false },
    { name: 'data-pipeline', podCount: 38, sleeping: false },
    { name: 'ml-training', podCount: 32, sleeping: true },
    { name: 'auth-service', podCount: 22, sleeping: false },
    { name: 'internal-tools', podCount: 18, sleeping: true },
    { name: 'monitoring', podCount: 20, sleeping: false },
    { name: 'staging', podCount: 17, sleeping: true },
  ],
  'ap-southeast-1': [
    { name: 'production', podCount: 30, sleeping: false },
    { name: 'payments', podCount: 15, sleeping: false },
    { name: 'auth-service', podCount: 10, sleeping: false },
    { name: 'dev-sandbox', podCount: 18, sleeping: true },
    { name: 'monitoring', podCount: 14, sleeping: false },
  ],
}

const ARCS: ArcConfig[] = [
  { from: 'eu-west-1', to: 'us-east-1' },
  { from: 'us-east-1', to: 'ap-southeast-1' },
  { from: 'ap-southeast-1', to: 'eu-west-1' },
]

const STATUS_COLORS: Record<RegionStatus, string> = {
  healthy: '#22C55E',
  transitioning: '#F59E0B',
  sleeping: '#64748B',
  error: '#EF4444',
}

const GLOBE_RADIUS = 2

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  )
}

function createArcPoints(
  start: THREE.Vector3,
  end: THREE.Vector3,
  segments: number,
  altitude: number,
): THREE.Vector3[] {
  const points: THREE.Vector3[] = []
  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5)
  mid.normalize().multiplyScalar(GLOBE_RADIUS + altitude)

  const curve = new THREE.CatmullRomCurve3([start, mid, end])
  for (let i = 0; i <= segments; i++) {
    points.push(curve.getPoint(i / segments))
  }
  return points
}

// ---------------------------------------------------------------------------
// Custom Earth shader
// ---------------------------------------------------------------------------

const earthVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const earthFragmentShader = `
  uniform float uTime;
  uniform vec3 uSunDirection;
  uniform vec3 uLandColor;
  uniform vec3 uOceanColor;
  uniform vec3 uCityLightColor;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;

  // Simplex-style noise
  vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }

  float continent(vec3 pos) {
    float n = snoise(pos * 1.8) * 0.5
            + snoise(pos * 3.5) * 0.25
            + snoise(pos * 7.0) * 0.125;
    return smoothstep(-0.05, 0.15, n);
  }

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(-vPosition);

    // Sun lighting
    float sunDot = dot(normal, uSunDirection);
    float daylight = smoothstep(-0.15, 0.3, sunDot);

    // Continent mask from noise
    vec3 spherePos = normalize(vPosition);
    float land = continent(spherePos);

    // Day side colors
    vec3 dayColor = mix(uOceanColor, uLandColor, land);
    dayColor *= (0.3 + 0.7 * daylight);

    // Night side city lights
    float nightMask = 1.0 - daylight;
    float cities = 0.0;
    if (land > 0.3) {
      float cityNoise = snoise(spherePos * 25.0) * 0.5 + 0.5;
      cityNoise *= snoise(spherePos * 50.0) * 0.5 + 0.5;
      cities = smoothstep(0.35, 0.55, cityNoise) * land;
    }
    vec3 nightColor = uCityLightColor * cities * nightMask * 1.5;

    // Combine
    vec3 color = dayColor + nightColor;

    // Subtle ambient
    color += vec3(0.02, 0.03, 0.06);

    gl_FragColor = vec4(color, 1.0);
  }
`

// ---------------------------------------------------------------------------
// Atmosphere shader
// ---------------------------------------------------------------------------

const atmosphereVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const atmosphereFragmentShader = `
  uniform vec3 uAtmColor;
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vec3 viewDir = normalize(-vPosition);
    float fresnel = 1.0 - dot(viewDir, vNormal);
    fresnel = pow(fresnel, 3.0) * 1.2;
    gl_FragColor = vec4(uAtmColor, fresnel * 0.6);
  }
`

// ---------------------------------------------------------------------------
// Earth component
// ---------------------------------------------------------------------------

function Earth({ onSelectRegion, regions }: {
  onSelectRegion: (id: string | null) => void
  regions: CloudRegion[]
}) {
  const earthRef = useRef<THREE.Mesh>(null)
  const cloudRef = useRef<THREE.Mesh>(null)
  const sunDir = useMemo(() => new THREE.Vector3(1, 0.3, 0.5).normalize(), [])

  const earthUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uSunDirection: { value: sunDir },
    uLandColor: { value: new THREE.Color('#2D5F2D') },
    uOceanColor: { value: new THREE.Color('#0A1628') },
    uCityLightColor: { value: new THREE.Color('#FBBF24') },
  }), [sunDir])

  const atmosphereUniforms = useMemo(() => ({
    uAtmColor: { value: new THREE.Color('#4DA6FF') },
  }), [])

  useFrame((_, delta) => {
    earthUniforms.uTime.value += delta
    if (cloudRef.current) {
      cloudRef.current.rotation.y += delta * 0.02
    }
  })

  return (
    <group>
      {/* Earth sphere */}
      <mesh ref={earthRef}>
        <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
        <shaderMaterial
          vertexShader={earthVertexShader}
          fragmentShader={earthFragmentShader}
          uniforms={earthUniforms}
        />
      </mesh>

      {/* Cloud layer */}
      <mesh ref={cloudRef}>
        <sphereGeometry args={[GLOBE_RADIUS + 0.03, 48, 48]} />
        <meshStandardMaterial
          color="#ffffff"
          transparent
          opacity={0.08}
          depthWrite={false}
        />
      </mesh>

      {/* Atmosphere glow */}
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS + 0.15, 48, 48]} />
        <shaderMaterial
          vertexShader={atmosphereVertexShader}
          fragmentShader={atmosphereFragmentShader}
          uniforms={atmosphereUniforms}
          transparent
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* Region markers */}
      {regions.map((region) => (
        <RegionMarker
          key={region.id}
          region={region}
          onSelect={onSelectRegion}
        />
      ))}

      {/* Arcs */}
      {ARCS.map((arc) => {
        const fromRegion = regions.find((r) => r.id === arc.from)
        const toRegion = regions.find((r) => r.id === arc.to)
        if (!fromRegion || !toRegion) return null
        const bothActive = fromRegion.status !== 'sleeping' && toRegion.status !== 'sleeping'
        return (
          <DataArc
            key={`${arc.from}-${arc.to}`}
            from={fromRegion}
            to={toRegion}
            active={bothActive}
          />
        )
      })}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Region marker (glowing orb on globe surface)
// ---------------------------------------------------------------------------

function RegionMarker({ region, onSelect }: {
  region: CloudRegion
  onSelect: (id: string | null) => void
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const position = useMemo(
    () => latLngToVector3(region.lat, region.lng, GLOBE_RADIUS + 0.06),
    [region.lat, region.lng],
  )
  const color = STATUS_COLORS[region.status]
  const phaseRef = useRef(Math.random() * Math.PI * 2)

  useFrame((_, delta) => {
    phaseRef.current += delta * 2
    if (meshRef.current) {
      const pulse = region.status === 'sleeping' ? 1 : 1 + Math.sin(phaseRef.current) * 0.15
      meshRef.current.scale.setScalar(pulse)
    }
    if (glowRef.current) {
      const glowPulse = region.status === 'sleeping' ? 0.3 : 0.5 + Math.sin(phaseRef.current) * 0.2
      const mat = glowRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = glowPulse
    }
  })

  return (
    <group position={position}>
      {/* Core orb */}
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation()
          onSelect(region.id)
        }}
      >
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Glow orb (additive) */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Label */}
      <Html
        position={[0, 0.18, 0]}
        center
        distanceFactor={6}
        style={{ pointerEvents: 'none' }}
      >
        <div style={{
          color: '#fff',
          fontSize: 11,
          fontFamily: 'monospace',
          background: 'rgba(0,0,0,0.6)',
          padding: '2px 6px',
          borderRadius: 4,
          whiteSpace: 'nowrap',
          borderLeft: `2px solid ${color}`,
        }}>
          {region.id}
        </div>
      </Html>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Data arc between regions
// ---------------------------------------------------------------------------

function DataArc({ from, to, active }: {
  from: CloudRegion
  to: CloudRegion
  active: boolean
}) {
  const particlesRef = useRef<THREE.Points>(null)
  const progressRef = useRef<Float32Array>(new Float32Array(8).map(() => Math.random()))

  const arcData = useMemo(() => {
    const startPos = latLngToVector3(from.lat, from.lng, GLOBE_RADIUS + 0.06)
    const endPos = latLngToVector3(to.lat, to.lng, GLOBE_RADIUS + 0.06)
    const points = createArcPoints(startPos, endPos, 64, 0.8)
    const curve = new THREE.CatmullRomCurve3(points)
    return { points, curve }
  }, [from.lat, from.lng, to.lat, to.lng])

  const arcColor = active ? '#3B82F6' : '#334155'
  const arcOpacity = active ? 0.5 : 0.15

  const lineObj = useMemo(() => {
    const geom = new THREE.BufferGeometry().setFromPoints(arcData.points)
    const mat = new THREE.LineBasicMaterial({
      color: arcColor,
      transparent: true,
      opacity: arcOpacity,
      blending: THREE.AdditiveBlending,
    })
    return new THREE.Line(geom, mat)
  }, [arcData.points, arcColor, arcOpacity])

  const particleGeometry = useMemo(() => {
    const positions = new Float32Array(8 * 3)
    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geom
  }, [])

  useFrame((_, delta) => {
    if (!active || !particlesRef.current) return
    const positions = particleGeometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < 8; i++) {
      progressRef.current[i] = (progressRef.current[i] + delta * 0.3) % 1
      const point = arcData.curve.getPoint(progressRef.current[i])
      positions.setXYZ(i, point.x, point.y, point.z)
    }
    positions.needsUpdate = true
  })

  return (
    <group>
      <primitive object={lineObj} />
      {active && (
        <points ref={particlesRef} geometry={particleGeometry}>
          <pointsMaterial
            color="#60A5FA"
            size={0.03}
            transparent
            opacity={0.9}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            sizeAttenuation
          />
        </points>
      )}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Camera controller for zoom-to-region
// ---------------------------------------------------------------------------

function CameraController({ targetRegion, regions }: {
  targetRegion: string | null
  regions: CloudRegion[]
}) {
  const { camera } = useThree()
  const tlRef = useRef<gsap.core.Tween | null>(null)

  useEffect(() => {
    if (tlRef.current) tlRef.current.kill()

    if (targetRegion) {
      const region = regions.find((r) => r.id === targetRegion)
      if (!region) return
      const pos = latLngToVector3(region.lat, region.lng, GLOBE_RADIUS + 3)
      tlRef.current = gsap.to(camera.position, {
        x: pos.x,
        y: pos.y,
        z: pos.z,
        duration: 1.5,
        ease: 'power2.inOut',
      })
    } else {
      tlRef.current = gsap.to(camera.position, {
        x: 0,
        y: 1.5,
        z: 5.5,
        duration: 1.5,
        ease: 'power2.inOut',
      })
    }

    return () => {
      if (tlRef.current) tlRef.current.kill()
    }
  }, [targetRegion, regions, camera])

  return null
}

// ---------------------------------------------------------------------------
// Region info panel (HTML overlay)
// ---------------------------------------------------------------------------

function RegionInfoPanel({ region, namespaces, onClose }: {
  region: CloudRegion
  namespaces: NamespaceInfo[]
  onClose: () => void
}) {
  const theme = useTheme()
  const statusColor = STATUS_COLORS[region.status]

  return (
    <Box sx={{
      position: 'absolute',
      top: 80,
      right: 24,
      width: 320,
      bgcolor: theme.palette.mode === 'dark'
        ? 'rgba(15, 23, 42, 0.92)'
        : 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(12px)',
      borderRadius: 2,
      border: `1px solid ${theme.palette.divider}`,
      p: 2.5,
      zIndex: 100,
      color: theme.palette.text.primary,
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 16 }}>
          {region.id}
        </Typography>
        <Chip
          label={region.status}
          size="small"
          sx={{
            bgcolor: statusColor,
            color: '#fff',
            fontWeight: 600,
            fontSize: 11,
          }}
        />
      </Box>

      <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 2 }}>
        {region.name}
      </Typography>

      <Box sx={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 1.5,
        mb: 2,
      }}>
        <StatBox label="Nodes" value={region.nodeCount} theme={theme} />
        <StatBox label="Pods" value={region.podCount} theme={theme} />
        <StatBox label="Policies" value={region.activePolicies} theme={theme} />
        <StatBox
          label="Savings/mo"
          value={`$${region.monthlySavings.toLocaleString()}`}
          theme={theme}
        />
      </Box>

      <Typography variant="caption" sx={{
        color: theme.palette.text.secondary,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: 1,
        display: 'block',
        mb: 1,
      }}>
        Namespaces
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {namespaces.map((ns) => (
          <Box key={ns.name} sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            py: 0.5,
            px: 1,
            borderRadius: 1,
            bgcolor: theme.palette.mode === 'dark'
              ? 'rgba(255,255,255,0.04)'
              : 'rgba(0,0,0,0.03)',
          }}>
            <Typography variant="body2" sx={{ fontSize: 12, fontFamily: 'monospace' }}>
              {ns.name}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                {ns.podCount} pods
              </Typography>
              {ns.sleeping && (
                <BedtimeIcon sx={{ fontSize: 12, color: '#64748B' }} />
              )}
            </Box>
          </Box>
        ))}
      </Box>

      <Button
        size="small"
        startIcon={<ArrowBackIcon />}
        onClick={onClose}
        sx={{ mt: 2, textTransform: 'none' }}
      >
        Back to overview
      </Button>
    </Box>
  )
}

function StatBox({ label, value, theme }: {
  label: string
  value: string | number
  theme: Theme
}) {
  return (
    <Box sx={{
      p: 1,
      borderRadius: 1,
      bgcolor: theme.palette.mode === 'dark'
        ? 'rgba(255,255,255,0.05)'
        : 'rgba(0,0,0,0.04)',
    }}>
      <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontSize: 10 }}>
        {label}
      </Typography>
      <Typography variant="body1" sx={{ fontWeight: 700, fontSize: 18 }}>
        {value}
      </Typography>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Dev Toolbar
// ---------------------------------------------------------------------------

function DevToolbar({ regions, onToggleSleep, playing, onTogglePlay, onReset, speed, onCycleSpeed }: {
  regions: CloudRegion[]
  onToggleSleep: (id: string) => void
  playing: boolean
  onTogglePlay: () => void
  onReset: () => void
  speed: number
  onCycleSpeed: () => void
}) {
  const theme = useTheme()

  return (
    <Box sx={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      bgcolor: theme.palette.mode === 'dark'
        ? 'rgba(15, 23, 42, 0.95)'
        : 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(12px)',
      borderTop: `1px solid ${theme.palette.divider}`,
      px: 2,
      py: 1,
      display: 'flex',
      alignItems: 'center',
      gap: 2,
    }}>
      <Chip
        icon={<PublicIcon />}
        label="FL13 Globe"
        size="small"
        sx={{ fontWeight: 700, fontFamily: 'monospace' }}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Tooltip title={playing ? 'Pause' : 'Play'}>
          <IconButton size="small" onClick={onTogglePlay}>
            {playing ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        <Tooltip title="Reset">
          <IconButton size="small" onClick={onReset}>
            <RestartAltIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title={`Speed: ${speed}x`}>
          <IconButton size="small" onClick={onCycleSpeed}>
            <SpeedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: theme.palette.text.secondary }}>
          {speed}x
        </Typography>
      </Box>

      <Box sx={{ height: 20, width: 1, bgcolor: theme.palette.divider }} />

      {regions.map((region) => {
        const isSleeping = region.status === 'sleeping'
        return (
          <Tooltip key={region.id} title={`${isSleeping ? 'Wake' : 'Sleep'} ${region.id}`}>
            <Button
              size="small"
              variant={isSleeping ? 'outlined' : 'contained'}
              startIcon={isSleeping ? <BedtimeIcon /> : <LightModeIcon />}
              onClick={() => onToggleSleep(region.id)}
              sx={{
                textTransform: 'none',
                fontFamily: 'monospace',
                fontSize: 11,
                minWidth: 0,
                bgcolor: isSleeping ? 'transparent' : STATUS_COLORS.healthy,
                borderColor: isSleeping ? STATUS_COLORS.sleeping : undefined,
                color: isSleeping ? theme.palette.text.secondary : '#fff',
                '&:hover': {
                  bgcolor: isSleeping ? 'rgba(100,116,139,0.15)' : '#16A34A',
                },
              }}
            >
              {region.id}
            </Button>
          </Tooltip>
        )
      })}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Scene wrapper (inside Canvas)
// ---------------------------------------------------------------------------

function GlobeScene({ regions, selectedRegion, onSelectRegion, playing }: {
  regions: CloudRegion[]
  selectedRegion: string | null
  onSelectRegion: (id: string | null) => void
  playing: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (groupRef.current && playing && !selectedRegion) {
      groupRef.current.rotation.y += delta * 0.08
    }
  })

  return (
    <>
      <Stars radius={100} depth={80} count={5000} factor={4} saturation={0} fade speed={0.5} />
      <ambientLight intensity={0.15} />
      <directionalLight position={[5, 3, 5]} intensity={0.8} />

      <group ref={groupRef}>
        <Earth regions={regions} onSelectRegion={onSelectRegion} />
      </group>

      <CameraController targetRegion={selectedRegion} regions={regions} />
      <OrbitControls
        enablePan={false}
        minDistance={3.5}
        maxDistance={12}
        enableDamping
        dampingFactor={0.05}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Main prototype component
// ---------------------------------------------------------------------------

export default function MultiRegionGlobePrototype() {
  const theme = useTheme()
  const router = useRouter()
  const [regions, setRegions] = useState<CloudRegion[]>(INITIAL_REGIONS)
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const sleepTimelinesRef = useRef<Map<string, gsap.core.Tween>>(new Map())

  const handleToggleSleep = useCallback((regionId: string) => {
    setRegions((prev) =>
      prev.map((r) => {
        if (r.id !== regionId) return r
        const wasSleeping = r.status === 'sleeping'
        return {
          ...r,
          status: wasSleeping ? 'healthy' as const : 'sleeping' as const,
        }
      }),
    )
  }, [])

  const handleReset = useCallback(() => {
    sleepTimelinesRef.current.forEach((tween) => tween.kill())
    sleepTimelinesRef.current.clear()
    setRegions(INITIAL_REGIONS)
    setSelectedRegion(null)
    setPlaying(true)
    setSpeed(1)
  }, [])

  const handleCycleSpeed = useCallback(() => {
    setSpeed((prev) => {
      const speeds = [0.5, 1, 2, 4]
      const idx = speeds.indexOf(prev)
      return speeds[(idx + 1) % speeds.length]
    })
  }, [])

  const handleSelectRegion = useCallback((id: string | null) => {
    setSelectedRegion((prev) => (prev === id ? null : id))
  }, [])

  const selectedData = useMemo(() => {
    if (!selectedRegion) return null
    const region = regions.find((r) => r.id === selectedRegion)
    if (!region) return null
    return {
      region,
      namespaces: NAMESPACE_DATA[region.id] ?? [],
    }
  }, [selectedRegion, regions])

  useEffect(() => {
    return () => {
      sleepTimelinesRef.current.forEach((tween) => tween.kill())
    }
  }, [])

  return (
    <Box sx={{
      width: '100vw',
      height: '100vh',
      bgcolor: theme.palette.mode === 'dark' ? '#030712' : '#0F172A',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Title bar */}
      <Box sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        px: 3,
        py: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        background: 'linear-gradient(to bottom, rgba(3,7,18,0.8), transparent)',
      }}>
        <IconButton size="small" onClick={() => router.push('/prototypes')} sx={{ color: '#94A3B8' }}>
          <ArrowBackIcon />
        </IconButton>
        <PublicIcon sx={{ color: '#3B82F6', fontSize: 28 }} />
        <Box>
          <Typography variant="h6" sx={{ color: '#F8FAFC', fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>
            Multi-Region Cluster Globe
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748B', fontFamily: 'monospace' }}>
            FL13 — kube-phoenix region overview
          </Typography>
        </Box>

        {/* Summary chips */}
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          <Chip
            label={`${regions.length} Regions`}
            size="small"
            sx={{
              bgcolor: 'rgba(59,130,246,0.15)',
              color: '#60A5FA',
              fontFamily: 'monospace',
              fontSize: 11,
            }}
          />
          <Chip
            label={`${regions.reduce((s, r) => s + r.nodeCount, 0)} Nodes`}
            size="small"
            sx={{
              bgcolor: 'rgba(34,197,94,0.15)',
              color: '#4ADE80',
              fontFamily: 'monospace',
              fontSize: 11,
            }}
          />
          <Chip
            label={`$${regions.reduce((s, r) => s + r.monthlySavings, 0).toLocaleString()}/mo saved`}
            size="small"
            sx={{
              bgcolor: 'rgba(251,191,36,0.15)',
              color: '#FBBF24',
              fontFamily: 'monospace',
              fontSize: 11,
            }}
          />
        </Box>
      </Box>

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 1.5, 5.5], fov: 45 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: '#030712' }}
      >
        <GlobeScene
          regions={regions}
          selectedRegion={selectedRegion}
          onSelectRegion={handleSelectRegion}
          playing={playing}
        />
      </Canvas>

      {/* Region info panel */}
      {selectedData && (
        <RegionInfoPanel
          region={selectedData.region}
          namespaces={selectedData.namespaces}
          onClose={() => setSelectedRegion(null)}
        />
      )}

      {/* Dev toolbar */}
      <DevToolbar
        regions={regions}
        onToggleSleep={handleToggleSleep}
        playing={playing}
        onTogglePlay={() => setPlaying((p) => !p)}
        onReset={handleReset}
        speed={speed}
        onCycleSpeed={handleCycleSpeed}
      />
    </Box>
  )
}
