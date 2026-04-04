'use client'

// PROTOTYPE: Internal API Rivers
// DEPS: framer-motion gsap
// LIBS: SVG, Canvas 2D, GSAP, Framer Motion
// DATA: kube-phoenix internal architecture — Chi router, Store, K8s client, Scheduler, Scaler, Broker
// DESCRIPTION: Animated river diagram of kube-phoenix internal request flows between Go packages

import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Slider from '@mui/material/Slider'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '@mui/material/styles'
import gsap from 'gsap'
import { useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

type ComponentKind = 'entry' | 'middleware' | 'handler' | 'core' | 'infra' | 'external'

interface SystemComponent {
  id: string
  label: string
  sublabel: string
  kind: ComponentKind
  x: number
  y: number
  width: number
  height: number
}

interface InternalLink {
  id: string
  source: string
  target: string
  label: string
  rps: number
  latencyMs: number
  category: 'http' | 'k8s' | 'store' | 'internal' | 'ws' | 'metrics'
  bidirectional?: boolean
}

interface RiverParticle {
  linkIndex: number
  progress: number
  speed: number
  color: string
  radius: number
  opacity: number
}

type FlowScenario = 'idle' | 'page-load' | 'sleep-execution' | 'wake-execution' | 'ws-stream' | 'all'

// ── Mock Data: kube-phoenix architecture ──────────────────────────────────────

const CANVAS_W = 1200
const CANVAS_H = 720
const BOX_PAD = 8

const COMPONENTS: SystemComponent[] = [
  // Entry
  { id: 'browser', label: 'Browser', sublabel: 'React SPA', kind: 'entry', x: 30, y: 310, width: 110, height: 52 },
  // Middleware
  { id: 'chi', label: 'Chi Router', sublabel: 'Middleware Stack', kind: 'middleware', x: 200, y: 230, width: 130, height: 52 },
  { id: 'auth', label: 'Auth MW', sublabel: 'Session + CSRF + RBAC', kind: 'middleware', x: 200, y: 390, width: 130, height: 52 },
  // Handlers
  { id: 'api-handlers', label: 'API Handlers', sublabel: 'Policy · Cluster · User', kind: 'handler', x: 400, y: 180, width: 140, height: 52 },
  { id: 'ws-handler', label: 'WS Handler', sublabel: '/ws/executions/{id}/logs', kind: 'handler', x: 400, y: 310, width: 140, height: 52 },
  { id: 'sse-handler', label: 'SSE Handler', sublabel: '/api/cluster/stream', kind: 'handler', x: 400, y: 440, width: 140, height: 52 },
  // Core
  { id: 'scheduler', label: 'Policy Scheduler', sublabel: 'Eval loop · 30s tick', kind: 'core', x: 640, y: 120, width: 150, height: 52 },
  { id: 'scaler', label: 'Scaler / Runner', sublabel: 'Sleep · Wake · Reconcile', kind: 'core', x: 640, y: 250, width: 150, height: 52 },
  { id: 'broker', label: 'WS Broker', sublabel: 'Pub/Sub log lines', kind: 'core', x: 640, y: 380, width: 150, height: 52 },
  { id: 'audit', label: 'Audit Writer', sublabel: 'Async 4096 buffer', kind: 'core', x: 640, y: 510, width: 150, height: 52 },
  // Infrastructure
  { id: 'store', label: 'Store (GORM)', sublabel: 'PostgreSQL', kind: 'infra', x: 910, y: 310, width: 130, height: 52 },
  { id: 'k8s-client', label: 'K8s Client', sublabel: 'client-go · 100 QPS', kind: 'infra', x: 910, y: 120, width: 130, height: 52 },
  { id: 'cache', label: 'Cluster Cache', sublabel: 'Informers · 5min resync', kind: 'infra', x: 910, y: 500, width: 130, height: 52 },
  // External
  { id: 'k8s-api', label: 'K8s API Server', sublabel: 'Deployments · Pods · Nodes', kind: 'external', x: 1090, y: 120, width: 90, height: 52 },
  { id: 'postgres', label: 'PostgreSQL', sublabel: 'Policies · Executions · Audit', kind: 'external', x: 1090, y: 310, width: 90, height: 52 },
  { id: 'prometheus', label: 'Prometheus', sublabel: '/metrics', kind: 'external', x: 1090, y: 500, width: 90, height: 52 },
]

const COMP_MAP = new Map(COMPONENTS.map((c) => [c.id, c]))

const ALL_LINKS: InternalLink[] = [
  // Browser → Chi
  { id: 'browser-chi', source: 'browser', target: 'chi', label: 'HTTP Requests', rps: 120, latencyMs: 2, category: 'http' },
  // Chi → Auth
  { id: 'chi-auth', source: 'chi', target: 'auth', label: 'Session · CSRF · Permission', rps: 120, latencyMs: 1, category: 'internal' },
  // Auth → Handlers
  { id: 'auth-api', source: 'auth', target: 'api-handlers', label: 'Authenticated RPCs', rps: 80, latencyMs: 1, category: 'http' },
  { id: 'auth-ws', source: 'auth', target: 'ws-handler', label: 'WS Upgrade', rps: 5, latencyMs: 1, category: 'ws' },
  { id: 'auth-sse', source: 'auth', target: 'sse-handler', label: 'SSE Subscribe', rps: 8, latencyMs: 1, category: 'http' },
  // API Handlers → Store
  { id: 'api-store', source: 'api-handlers', target: 'store', label: 'CRUD: Policies · Executions · Users', rps: 60, latencyMs: 4, category: 'store' },
  // API Handlers → Scheduler
  { id: 'api-scheduler', source: 'api-handlers', target: 'scheduler', label: 'RunSleepNow · RunWakeNow · Cancel', rps: 2, latencyMs: 1, category: 'internal' },
  // API Handlers → K8s Client
  { id: 'api-k8s', source: 'api-handlers', target: 'k8s-client', label: 'ListPods · GetDeployment · PodLogs', rps: 25, latencyMs: 12, category: 'k8s' },
  // API Handlers → Audit
  { id: 'api-audit', source: 'api-handlers', target: 'audit', label: 'AuditLog (async ch)', rps: 15, latencyMs: 0, category: 'internal' },
  // Scheduler → Scaler
  { id: 'scheduler-scaler', source: 'scheduler', target: 'scaler', label: 'RunPolicySleep · RunPolicyWake', rps: 1, latencyMs: 2, category: 'internal' },
  // Scheduler → Store
  { id: 'scheduler-store', source: 'scheduler', target: 'store', label: 'ListPolicies · Exceptions · CreateExec', rps: 10, latencyMs: 3, category: 'store' },
  // Scheduler → Broker
  { id: 'scheduler-broker', source: 'scheduler', target: 'broker', label: 'Publish(execID, logLine)', rps: 30, latencyMs: 0, category: 'internal' },
  // Scaler → K8s Client
  { id: 'scaler-k8s', source: 'scaler', target: 'k8s-client', label: 'ScaleDeployment · Annotate · CountReady', rps: 40, latencyMs: 18, category: 'k8s' },
  // Scaler → Store
  { id: 'scaler-store', source: 'scaler', target: 'store', label: 'CreateSnapshot · AppendLogLines', rps: 20, latencyMs: 3, category: 'store' },
  // WS Handler → Broker
  { id: 'ws-broker', source: 'ws-handler', target: 'broker', label: 'Subscribe · Unsubscribe', rps: 5, latencyMs: 0, category: 'ws' },
  // SSE Handler → Cache
  { id: 'sse-cache', source: 'sse-handler', target: 'cache', label: 'Subscribe(snapshot chan)', rps: 8, latencyMs: 0, category: 'internal' },
  // K8s Client → K8s API
  { id: 'k8s-api-call', source: 'k8s-client', target: 'k8s-api', label: 'REST: GET · UPDATE · LIST · WATCH', rps: 65, latencyMs: 35, category: 'k8s' },
  // Cache → K8s API (informers)
  { id: 'cache-k8s', source: 'cache', target: 'k8s-api', label: 'Informer WATCH streams', rps: 12, latencyMs: 50, category: 'k8s' },
  // Store → Postgres
  { id: 'store-pg', source: 'store', target: 'postgres', label: 'GORM: SELECT · INSERT · UPDATE', rps: 90, latencyMs: 2, category: 'store' },
  // Audit → Store
  { id: 'audit-store', source: 'audit', target: 'store', label: 'Batch INSERT audit_logs', rps: 15, latencyMs: 2, category: 'store' },
  // Chi → Prometheus (metrics middleware)
  { id: 'chi-prom', source: 'chi', target: 'prometheus', label: 'http_requests_total · duration', rps: 120, latencyMs: 0, category: 'metrics' },
  // K8s Client → Prometheus
  { id: 'k8s-prom', source: 'k8s-client', target: 'prometheus', label: 'k8s_requests_total · duration', rps: 65, latencyMs: 0, category: 'metrics' },
]

const SCENARIO_LINKS: Record<FlowScenario, string[]> = {
  idle: [],
  'page-load': [
    'browser-chi', 'chi-auth', 'auth-api', 'api-store', 'api-k8s',
    'k8s-api-call', 'store-pg', 'chi-prom', 'auth-sse', 'sse-cache',
    'cache-k8s',
  ],
  'sleep-execution': [
    'browser-chi', 'chi-auth', 'auth-api', 'api-scheduler', 'api-audit',
    'scheduler-scaler', 'scheduler-store', 'scheduler-broker',
    'scaler-k8s', 'scaler-store', 'k8s-api-call', 'store-pg',
    'audit-store', 'chi-prom', 'k8s-prom',
  ],
  'wake-execution': [
    'browser-chi', 'chi-auth', 'auth-api', 'api-scheduler', 'api-audit',
    'scheduler-scaler', 'scheduler-store', 'scheduler-broker',
    'scaler-k8s', 'scaler-store', 'k8s-api-call', 'store-pg',
    'audit-store', 'chi-prom', 'k8s-prom',
  ],
  'ws-stream': [
    'browser-chi', 'chi-auth', 'auth-ws', 'ws-broker',
    'scheduler-broker', 'scheduler-scaler', 'scaler-k8s',
    'scaler-store', 'k8s-api-call', 'store-pg', 'chi-prom',
  ],
  all: ALL_LINKS.map((l) => l.id),
}

const SCENARIO_LABELS: Record<FlowScenario, string> = {
  idle: 'Idle',
  'page-load': 'Page Load',
  'sleep-execution': 'Sleep Execution',
  'wake-execution': 'Wake Execution',
  'ws-stream': 'WS Log Stream',
  all: 'All Flows',
}

const CATEGORY_COLORS: Record<InternalLink['category'], string> = {
  http: '#60A5FA',
  k8s: '#A78BFA',
  store: '#34D399',
  internal: '#94A3B8',
  ws: '#FBBF24',
  metrics: '#F87171',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function kindColor(kind: ComponentKind, isDark: boolean): string {
  const map: Record<ComponentKind, string> = {
    entry: isDark ? '#1E3A5F' : '#DBEAFE',
    middleware: isDark ? '#312E81' : '#E0E7FF',
    handler: isDark ? '#064E3B' : '#D1FAE5',
    core: isDark ? '#78350F' : '#FEF3C7',
    infra: isDark ? '#1F2937' : '#F3F4F6',
    external: isDark ? '#3B0764' : '#F3E8FF',
  }
  return map[kind]
}

function kindBorderColor(kind: ComponentKind): string {
  const map: Record<ComponentKind, string> = {
    entry: '#3B82F6',
    middleware: '#6366F1',
    handler: '#10B981',
    core: '#F59E0B',
    infra: '#6B7280',
    external: '#A855F7',
  }
  return map[kind]
}

function buildCurvePath(srcId: string, tgtId: string): string {
  const src = COMP_MAP.get(srcId)
  const tgt = COMP_MAP.get(tgtId)
  if (!src || !tgt) return ''

  const sx = src.x + src.width + BOX_PAD
  const sy = src.y + src.height / 2
  const tx = tgt.x - BOX_PAD
  const ty = tgt.y + tgt.height / 2

  const dx = tx - sx
  const dy = ty - sy

  if (Math.abs(dy) < 10) {
    const cpx = sx + dx * 0.5
    return `M ${sx} ${sy} C ${cpx} ${sy}, ${cpx} ${ty}, ${tx} ${ty}`
  }

  const bend = Math.min(Math.abs(dx) * 0.4, 120)
  const cp1x = sx + bend
  const cp2x = tx - bend

  return `M ${sx} ${sy} C ${cp1x} ${sy}, ${cp2x} ${ty}, ${tx} ${ty}`
}

function strokeFromRps(rps: number): number {
  return Math.max(1.5, Math.min(8, rps / 18))
}

function latencyColor(ms: number): string {
  if (ms <= 3) return '#4ADE80'
  if (ms <= 15) return '#60A5FA'
  if (ms <= 40) return '#FBBF24'
  return '#F87171'
}

const MAX_PARTICLES = 800

// ── Component ─────────────────────────────────────────────────────────────────

export default function InternalRiversPrototype() {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const router = useRouter()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pathRefs = useRef<(SVGPathElement | null)[]>([])
  const particlesRef = useRef<RiverParticle[]>([])
  const animFrameRef = useRef(0)
  const gsapTweensRef = useRef<gsap.core.Tween[]>([])

  const [scenario, setScenario] = useState<FlowScenario>('all')
  const [speed, setSpeed] = useState(1)
  const [hoveredLink, setHoveredLink] = useState<string | null>(null)
  const [hoveredComp, setHoveredComp] = useState<string | null>(null)
  const [particleCount, setParticleCount] = useState(0)

  const activeIds = useMemo(() => new Set(SCENARIO_LINKS[scenario]), [scenario])
  const activeLinks = useMemo(
    () => ALL_LINKS.filter((l) => scenario === 'all' || activeIds.has(l.id)),
    [scenario, activeIds],
  )

  const resolvedPaths = useMemo(
    () => ALL_LINKS.map((link) => buildCurvePath(link.source, link.target)),
    [],
  )

  const setPathRef = useCallback(
    (index: number) => (el: SVGPathElement | null) => {
      pathRefs.current[index] = el
    },
    [],
  )

  // Animate stroke widths when scenario changes
  useEffect(() => {
    gsapTweensRef.current.forEach((t) => t.kill())
    gsapTweensRef.current = []

    pathRefs.current.forEach((pathEl, i) => {
      if (!pathEl) return
      const link = ALL_LINKS[i]
      const isActive = scenario === 'all' || activeIds.has(link.id)
      const targetWidth = isActive ? strokeFromRps(link.rps) : 0
      const targetOpacity = isActive ? 0.3 : 0.04

      const t = gsap.to(pathEl, {
        attr: { 'stroke-width': targetWidth, 'stroke-opacity': targetOpacity },
        duration: 0.6,
        ease: 'power2.out',
      })
      gsapTweensRef.current.push(t)
    })

    return () => {
      gsapTweensRef.current.forEach((t) => t.kill())
    }
  }, [scenario, activeIds])

  // Particle animation loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = CANVAS_W
    canvas.height = CANVAS_H
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const spawnParticle = (linkIndex: number): RiverParticle => {
      const link = ALL_LINKS[linkIndex]
      const baseSpeed = Math.max(0.003, (link.rps / 120) * 0.006) * speed
      return {
        linkIndex,
        progress: 0,
        speed: baseSpeed + Math.random() * 0.002,
        color: CATEGORY_COLORS[link.category],
        radius: 1.5 + Math.random() * 1.5,
        opacity: 0.7 + Math.random() * 0.3,
      }
    }

    let spawnAccum = 0

    const animate = () => {
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

      spawnAccum += 1
      if (spawnAccum >= 2) {
        spawnAccum = 0
        ALL_LINKS.forEach((link, i) => {
          const isActive = scenario === 'all' || activeIds.has(link.id)
          if (!isActive) return
          const density = link.rps / 120
          if (Math.random() < density * 0.25) {
            if (particlesRef.current.length < MAX_PARTICLES) {
              particlesRef.current.push(spawnParticle(i))
            }
          }
        })
      }

      particlesRef.current = particlesRef.current.filter((p) => p.progress < 1)

      for (const particle of particlesRef.current) {
        particle.progress += particle.speed

        const pathEl = pathRefs.current[particle.linkIndex]
        if (!pathEl) continue

        const totalLen = pathEl.getTotalLength()
        const point = pathEl.getPointAtLength(particle.progress * totalLen)

        ctx.beginPath()
        ctx.arc(point.x, point.y, particle.radius, 0, Math.PI * 2)
        ctx.fillStyle = particle.color
        ctx.globalAlpha = particle.opacity * (1 - particle.progress * 0.3)
        ctx.fill()
      }

      ctx.globalAlpha = 1
      setParticleCount(particlesRef.current.length)
      animFrameRef.current = requestAnimationFrame(animate)
    }

    animFrameRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [scenario, speed, activeIds])

  const handleSpeedChange = useCallback((_: Event, value: number | number[]) => {
    setSpeed(value as number)
  }, [])

  const connectedLinks = useMemo(() => {
    if (!hoveredComp) return new Set<string>()
    return new Set(
      ALL_LINKS
        .filter((l) => l.source === hoveredComp || l.target === hoveredComp)
        .map((l) => l.id),
    )
  }, [hoveredComp])

  return (
    <Box
      sx={{
        width: '100vw',
        minHeight: '100vh',
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pb: 12,
      }}
    >
      {/* Header */}
      <Box sx={{ width: '100%', maxWidth: 1240, px: 2, pt: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <IconButton size="small" onClick={() => router.push('/prototypes/')}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Typography variant="h5" fontWeight={800} color="text.primary">
            Internal API Rivers
          </Typography>
          <Chip
            label="K15-v2"
            size="small"
            sx={{
              height: 22,
              fontSize: 11,
              fontWeight: 700,
              bgcolor: 'rgba(59,130,246,0.15)',
              color: '#3B82F6',
            }}
          />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 720 }}>
          Real request flows inside kube-phoenix — Chi middleware, Store queries, K8s API calls,
          Scheduler ticks, Scaler operations, WebSocket broker, and Prometheus metrics.
        </Typography>
      </Box>

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
        {(Object.entries(CATEGORY_COLORS) as [InternalLink['category'], string][]).map(
          ([cat, color]) => (
            <Box key={cat} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                {cat}
              </Typography>
            </Box>
          ),
        )}
      </Box>

      {/* Scenario selector */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
        {(Object.keys(SCENARIO_LABELS) as FlowScenario[]).map((s) => (
          <Button
            key={s}
            size="small"
            variant={scenario === s ? 'contained' : 'outlined'}
            onClick={() => {
              particlesRef.current = []
              setScenario(s)
            }}
            sx={{
              textTransform: 'none',
              fontSize: '0.7rem',
              minWidth: 0,
              px: 1.5,
              py: 0.4,
              borderColor: 'divider',
              color: scenario === s ? undefined : 'text.secondary',
            }}
          >
            {SCENARIO_LABELS[s]}
          </Button>
        ))}
      </Box>

      {/* Main canvas */}
      <Box
        sx={{
          position: 'relative',
          width: CANVAS_W,
          height: CANVAS_H,
          mx: 'auto',
          overflow: 'visible',
        }}
      >
        {/* SVG layer: paths */}
        <svg
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
        >
          {ALL_LINKS.map((link, i) => {
            const isActive = scenario === 'all' || activeIds.has(link.id)
            const isHighlighted = hoveredLink === link.id || connectedLinks.has(link.id)
            return (
              <path
                key={link.id}
                ref={setPathRef(i)}
                d={resolvedPaths[i]}
                fill="none"
                stroke={CATEGORY_COLORS[link.category]}
                strokeWidth={isActive ? strokeFromRps(link.rps) : 0}
                strokeOpacity={isHighlighted ? 0.6 : 0.3}
                strokeLinecap="round"
                style={{ transition: 'stroke-opacity 200ms' }}
              />
            )
          })}
        </svg>

        {/* Canvas layer: particles */}
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: CANVAS_W,
            height: CANVAS_H,
            pointerEvents: 'none',
          }}
        />

        {/* Component boxes */}
        {COMPONENTS.map((comp) => {
          const isConnected = !hoveredComp || hoveredComp === comp.id ||
            ALL_LINKS.some(
              (l) =>
                (l.source === hoveredComp && l.target === comp.id) ||
                (l.target === hoveredComp && l.source === comp.id),
            )
          return (
            <motion.div
              key={comp.id}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05, duration: 0.3 }}
              style={{
                position: 'absolute',
                left: comp.x,
                top: comp.y,
                width: comp.width,
                height: comp.height,
                zIndex: 2,
              }}
              onMouseEnter={() => setHoveredComp(comp.id)}
              onMouseLeave={() => setHoveredComp(null)}
            >
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  bgcolor: kindColor(comp.kind, isDark),
                  border: '1.5px solid',
                  borderColor: kindBorderColor(comp.kind),
                  borderRadius: 1.5,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  px: 1,
                  cursor: 'default',
                  opacity: isConnected ? 1 : 0.3,
                  transition: 'opacity 200ms, box-shadow 200ms',
                  boxShadow: hoveredComp === comp.id
                    ? `0 0 12px ${kindBorderColor(comp.kind)}60`
                    : 'none',
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.primary',
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    lineHeight: 1.2,
                    textAlign: 'center',
                  }}
                >
                  {comp.label}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    fontSize: '0.55rem',
                    lineHeight: 1.2,
                    textAlign: 'center',
                  }}
                >
                  {comp.sublabel}
                </Typography>
              </Box>
            </motion.div>
          )
        })}

        {/* Hover tooltip for links */}
        <AnimatePresence>
          {hoveredComp && (
            <CompTooltip
              compId={hoveredComp}
              links={ALL_LINKS}
              activeIds={activeIds}
              scenario={scenario}
            />
          )}
        </AnimatePresence>
      </Box>

      {/* Dev Toolbar */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          bgcolor: isDark ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)',
          borderTop: '1px solid',
          borderColor: 'divider',
          px: 3,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          backdropFilter: 'blur(8px)',
        }}
      >
        <Typography variant="caption" color="text.secondary" fontWeight={700}>
          K15-v2 — Internal Rivers
        </Typography>

        <Chip
          label={SCENARIO_LABELS[scenario]}
          size="small"
          sx={{ height: 22, fontSize: 10, fontWeight: 600 }}
          color="primary"
        />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 180 }}>
          <Typography variant="caption" color="text.secondary">
            Speed:
          </Typography>
          <Slider
            value={speed}
            onChange={handleSpeedChange}
            min={0.25}
            max={4}
            step={0.25}
            size="small"
            sx={{ width: 100, '& .MuiSlider-thumb': { width: 12, height: 12 } }}
          />
          <Typography variant="caption" color="text.secondary">
            {speed}x
          </Typography>
        </Box>

        <Typography variant="caption" color="text.secondary">
          Particles: {particleCount}
        </Typography>

        <Typography variant="caption" color="text.secondary">
          Links: {activeLinks.length}/{ALL_LINKS.length}
        </Typography>

        <Button
          size="small"
          variant="outlined"
          onClick={() => {
            particlesRef.current = []
            setScenario('all')
            setSpeed(1)
          }}
          sx={{ textTransform: 'none', fontSize: '0.65rem', ml: 'auto' }}
        >
          Reset
        </Button>
      </Box>
    </Box>
  )
}

// ── Tooltip subcomponent ──────────────────────────────────────────────────────

interface CompTooltipProps {
  compId: string
  links: InternalLink[]
  activeIds: Set<string>
  scenario: FlowScenario
}

function CompTooltip({ compId, links, activeIds, scenario }: CompTooltipProps) {
  const comp = COMP_MAP.get(compId)
  if (!comp) return null

  const outgoing = links.filter(
    (l) => l.source === compId && (scenario === 'all' || activeIds.has(l.id)),
  )
  const incoming = links.filter(
    (l) => l.target === compId && (scenario === 'all' || activeIds.has(l.id)),
  )

  const tooltipX = comp.x + comp.width / 2
  const tooltipY = comp.y - 8
  const showAbove = comp.y > 200

  return (
    <motion.div
      initial={{ opacity: 0, y: showAbove ? 6 : -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: showAbove ? 6 : -6 }}
      transition={{ duration: 0.15 }}
      style={{
        position: 'absolute',
        left: tooltipX,
        top: showAbove ? tooltipY : comp.y + comp.height + 8,
        transform: showAbove ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
        zIndex: 10,
        pointerEvents: 'none',
      }}
    >
      <Box
        sx={{
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1.5,
          px: 1.5,
          py: 1,
          minWidth: 200,
          maxWidth: 320,
          boxShadow: 4,
        }}
      >
        <Typography variant="caption" fontWeight={700} color="text.primary" sx={{ mb: 0.5, display: 'block' }}>
          {comp.label}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontSize: '0.6rem' }}>
          {comp.sublabel}
        </Typography>

        {incoming.length > 0 && (
          <Box sx={{ mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.55rem', fontWeight: 600 }}>
              ← Incoming
            </Typography>
            {incoming.map((l) => (
              <Box key={l.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 0.5 }}>
                <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: CATEGORY_COLORS[l.category] }} />
                <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.secondary' }}>
                  {COMP_MAP.get(l.source)?.label} → {l.label} ({l.rps} RPS, {l.latencyMs}ms)
                </Typography>
              </Box>
            ))}
          </Box>
        )}

        {outgoing.length > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.55rem', fontWeight: 600 }}>
              → Outgoing
            </Typography>
            {outgoing.map((l) => (
              <Box key={l.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 0.5 }}>
                <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: CATEGORY_COLORS[l.category] }} />
                <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.secondary' }}>
                  → {COMP_MAP.get(l.target)?.label}: {l.label} ({l.rps} RPS, {l.latencyMs}ms)
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </motion.div>
  )
}
