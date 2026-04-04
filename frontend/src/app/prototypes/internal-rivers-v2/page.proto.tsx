'use client'

// PROTOTYPE: Internal API Rivers v3
// DEPS: framer-motion gsap echarts echarts-for-react
// LIBS: SVG, Canvas 2D, GSAP, Framer Motion, eCharts
// DATA: kube-phoenix Go backend architecture with real package paths and function signatures
// DESCRIPTION: Clean columnar architecture diagram with particle trails, step-through playback,
//              error injection, request tracing, live sparklines, and Go source references

import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Slider from '@mui/material/Slider'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SkipNextIcon from '@mui/icons-material/SkipNext'
import ReplayIcon from '@mui/icons-material/Replay'
import BugReportIcon from '@mui/icons-material/BugReport'
import RouteIcon from '@mui/icons-material/Route'
import ViewStreamIcon from '@mui/icons-material/ViewStream'
import ViewWeekIcon from '@mui/icons-material/ViewWeek'
import SpeedIcon from '@mui/icons-material/Speed'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme, alpha } from '@mui/material/styles'
import gsap from 'gsap'
import { useRouter } from 'next/navigation'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer])

// ── Types ─────────────────────────────────────────────────────────────────────

type ComponentKind = 'entry' | 'middleware' | 'handler' | 'core' | 'infra' | 'external'
type LinkCategory = 'http' | 'k8s' | 'store' | 'internal' | 'ws'
type PortSide = 'left' | 'right' | 'top' | 'bottom'
type LayoutMode = 'vertical' | 'horizontal'

interface SystemComponent {
  id: string
  label: string
  sublabel: string
  kind: ComponentKind
  goFile: string
  col: number
  row: number
  hCol: number
  hRow: number
  metricsLabel?: string
}

interface InternalLink {
  id: string
  source: string
  sourcePort: PortSide
  targetPort: PortSide
  hSourcePort: PortSide
  hTargetPort: PortSide
  target: string
  label: string
  goSignature: string
  rps: number
  latencyMs: number
  category: LinkCategory
}

interface RiverParticle {
  linkIndex: number
  progress: number
  speed: number
  color: string
  radius: number
  opacity: number
  isError: boolean
  trail: { x: number; y: number }[]
}

type FlowScenario = 'idle' | 'page-load' | 'sleep-execution' | 'wake-execution' | 'ws-stream' | 'all'

interface ErrorEvent {
  linkId: string
  type: string
  label: string
  active: boolean
}

// ── Layout constants ──────────────────────────────────────────────────────────

const BOX_W = 132
const BOX_H = 55
const LANE_GAP = 8

// Vertical (top-down) layout
const V_CANVAS_W = 1260
const V_CANVAS_H = 820
const TIER_Y = [30, 145, 270, 400, 540, 670]
const H_GAP = 36
const CORE_H_GAP = 80
const TIER_SIZES = [1, 2, 3, 4, 3, 2]

function tierX(tierSize: number, pos: number, tier?: number): number {
  const gap = tier === 3 ? CORE_H_GAP : H_GAP
  const totalW = tierSize * BOX_W + (tierSize - 1) * gap
  const startX = (V_CANVAS_W - totalW) / 2
  return startX + pos * (BOX_W + gap)
}

// Horizontal (left-to-right) layout
const H_CANVAS_W = 1360
const H_CANVAS_H = 620
const H_COL_X = [50, 240, 440, 660, 920, 1170]
const H_ROW_HEIGHT = 115
const H_ROW_TOP = 50

function hColX(col: number): number { return H_COL_X[col] }
function hRowY(row: number): number { return H_ROW_TOP + row * H_ROW_HEIGHT }

// ── Lane definitions ─────────────────────────────────────────────────────────

interface Lane {
  label: string
  idx: number
  color: string
}

const LANES: Lane[] = [
  { label: 'Entry', idx: 0, color: '#3B82F6' },
  { label: 'Middleware', idx: 1, color: '#6366F1' },
  { label: 'Handlers', idx: 2, color: '#10B981' },
  { label: 'Core Logic', idx: 3, color: '#F59E0B' },
  { label: 'Data & Cluster', idx: 4, color: '#6B7280' },
  { label: 'External', idx: 5, color: '#A855F7' },
]

// Vertical mode: horizontal bands
function vLaneBounds(tier: number): { y: number; h: number } {
  const tierTop = TIER_Y[tier]
  const tierBot = tierTop + BOX_H
  const prevBot = tier > 0 ? TIER_Y[tier - 1] + BOX_H : 0
  const nextTop = tier < TIER_Y.length - 1 ? TIER_Y[tier + 1] : V_CANVAS_H
  const ly = tier === 0 ? 8 : (prevBot + tierTop) / 2 + LANE_GAP / 2
  const by = tier === TIER_Y.length - 1 ? V_CANVAS_H - 8 : (tierBot + nextTop) / 2 - LANE_GAP / 2
  return { y: ly, h: by - ly }
}

// Horizontal mode: vertical bands
function hLaneBounds(col: number): { x: number; w: number } {
  const colLeft = H_COL_X[col]
  const colRight = colLeft + BOX_W
  const prevRight = col > 0 ? H_COL_X[col - 1] + BOX_W : 0
  const nextLeft = col < H_COL_X.length - 1 ? H_COL_X[col + 1] : H_CANVAS_W
  const lx = col === 0 ? 8 : (prevRight + colLeft) / 2 + LANE_GAP / 2
  const rx = col === H_COL_X.length - 1 ? H_CANVAS_W - 8 : (colRight + nextLeft) / 2 - LANE_GAP / 2
  return { x: lx, w: rx - lx }
}

// ── Components (tier-based layout) ───────────────────────────────────────────

// col/row = vertical layout tier position, hCol/hRow = horizontal layout column position
const COMPONENTS: SystemComponent[] = [
  { id: 'browser',      label: 'Browser',       sublabel: 'Next.js 16 SPA',              kind: 'entry',      goFile: '',                                    col: 0, row: 0, hCol: 0, hRow: 1.8 },
  { id: 'chi',          label: 'Chi Router',    sublabel: 'RequestID · Logger · Recover', kind: 'middleware', goFile: 'internal/api/router.go',               col: 0, row: 1, hCol: 1, hRow: 1.0, metricsLabel: 'http_requests_total' },
  { id: 'auth',         label: 'Auth MW',       sublabel: 'Session · CSRF · RBAC',        kind: 'middleware', goFile: 'internal/middleware/auth.go',           col: 1, row: 1, hCol: 1, hRow: 2.6 },
  { id: 'api-handlers', label: 'API Handlers',  sublabel: 'Policy · Cluster · User',      kind: 'handler',    goFile: 'internal/api/',                        col: 0, row: 2, hCol: 2, hRow: 0.5 },
  { id: 'ws-handler',   label: 'WS Handler',    sublabel: 'Live log streaming',            kind: 'handler',    goFile: 'internal/api/ws.go',                   col: 1, row: 2, hCol: 2, hRow: 2.0 },
  { id: 'sse-handler',  label: 'SSE Stream',    sublabel: 'Cluster state push',            kind: 'handler',    goFile: 'internal/api/cluster.go',              col: 2, row: 2, hCol: 2, hRow: 3.4 },
  { id: 'scheduler',    label: 'Scheduler',     sublabel: 'Eval loop · 30s tick',          kind: 'core',       goFile: 'internal/scheduler/policy_scheduler.go', col: 0, row: 3, hCol: 3, hRow: 0.0, metricsLabel: 'scheduler_evals_total' },
  { id: 'scaler',       label: 'Scaler',        sublabel: 'Sleep · Wake · Reconcile',      kind: 'core',       goFile: 'internal/scaler/',                     col: 1, row: 3, hCol: 3, hRow: 1.5 },
  { id: 'broker',       label: 'WS Broker',     sublabel: 'Pub/Sub · 256 buf',             kind: 'core',       goFile: 'internal/scheduler/broker.go',         col: 2, row: 3, hCol: 3, hRow: 2.8 },
  { id: 'audit',        label: 'Audit Writer',  sublabel: 'Async · 4096 buf',              kind: 'core',       goFile: 'internal/api/audit.go',                col: 3, row: 3, hCol: 3, hRow: 3.8 },
  { id: 'k8s-client',   label: 'K8s Client',    sublabel: 'client-go · 100 QPS',           kind: 'infra',      goFile: 'internal/k8s/client.go',               col: 0, row: 4, hCol: 4, hRow: 0.5, metricsLabel: 'k8s_requests_total' },
  { id: 'store',        label: 'Store',          sublabel: 'GORM · 10 conns',              kind: 'infra',      goFile: 'internal/store/',                      col: 1, row: 4, hCol: 4, hRow: 2.2 },
  { id: 'cache',        label: 'Cluster Cache', sublabel: 'Informers · 5m resync',         kind: 'infra',      goFile: 'internal/k8s/cache.go',                col: 2, row: 4, hCol: 4, hRow: 3.6 },
  { id: 'k8s-api',      label: 'K8s API',       sublabel: 'Deployments · Pods · Nodes',    kind: 'external',   goFile: '',                                    col: 0, row: 5, hCol: 5, hRow: 0.5 },
  { id: 'postgres',     label: 'PostgreSQL',    sublabel: '11 tables',                     kind: 'external',   goFile: '',                                    col: 1, row: 5, hCol: 5, hRow: 2.2 },
]

const COMP_MAP = new Map(COMPONENTS.map((c) => [c.id, c]))

type DragOffsets = Record<string, { dx: number; dy: number }>

function compRectBase(c: SystemComponent, mode: LayoutMode) {
  if (mode === 'vertical') {
    const tierSize = TIER_SIZES[c.row]
    return { x: tierX(tierSize, c.col, c.row), y: TIER_Y[c.row], w: BOX_W, h: BOX_H }
  }
  return { x: hColX(c.hCol), y: hRowY(c.hRow), w: BOX_W, h: BOX_H }
}

function compRectWithOffset(c: SystemComponent, offsets: DragOffsets, mode: LayoutMode) {
  const base = compRectBase(c, mode)
  const off = offsets[c.id]
  if (off) return { ...base, x: base.x + off.dx, y: base.y + off.dy }
  return base
}

function linkPorts(link: InternalLink, mode: LayoutMode): { sp: PortSide; tp: PortSide } {
  if (mode === 'vertical') return { sp: link.sourcePort, tp: link.targetPort }
  return { sp: link.hSourcePort, tp: link.hTargetPort }
}

function portPointWithOffset(comp: SystemComponent, side: PortSide, offsets: DragOffsets, mode: LayoutMode): { x: number; y: number } {
  const r = compRectWithOffset(comp, offsets, mode)
  switch (side) {
    case 'right': return { x: r.x + r.w, y: r.y + r.h / 2 }
    case 'left': return { x: r.x, y: r.y + r.h / 2 }
    case 'top': return { x: r.x + r.w / 2, y: r.y }
    case 'bottom': return { x: r.x + r.w / 2, y: r.y + r.h }
  }
}

function buildPathWithOffsets(link: InternalLink, offsets: DragOffsets, mode: LayoutMode): string {
  const src = COMP_MAP.get(link.source)
  const tgt = COMP_MAP.get(link.target)
  if (!src || !tgt) return ''

  const ports = linkPorts(link, mode)
  const sp = portPointWithOffset(src, ports.sp, offsets, mode)
  const tp = portPointWithOffset(tgt, ports.tp, offsets, mode)
  const dx = tp.x - sp.x
  const dy = tp.y - sp.y

  // Vertical: bottom→top
  if (ports.sp === 'bottom' && ports.tp === 'top') {
    const midY = sp.y + dy * 0.5
    return `M ${sp.x} ${sp.y} C ${sp.x} ${midY}, ${tp.x} ${midY}, ${tp.x} ${tp.y}`
  }

  // Horizontal: right→left
  if (ports.sp === 'right' && ports.tp === 'left') {
    if (Math.abs(dy) < 15) {
      const cpx = sp.x + dx * 0.5
      return `M ${sp.x} ${sp.y} C ${cpx} ${sp.y}, ${cpx} ${tp.y}, ${tp.x} ${tp.y}`
    }
    const bend = Math.min(Math.abs(dx) * 0.35, 100)
    return `M ${sp.x} ${sp.y} C ${sp.x + bend} ${sp.y}, ${tp.x - bend} ${tp.y}, ${tp.x} ${tp.y}`
  }

  // Bottom→left (L-shape)
  if (ports.sp === 'bottom' && ports.tp === 'left') {
    const midY = sp.y + Math.abs(dy) * 0.6
    return `M ${sp.x} ${sp.y} C ${sp.x} ${midY}, ${sp.x} ${tp.y}, ${tp.x} ${tp.y}`
  }

  // Fallback
  const midY = sp.y + dy * 0.5
  return `M ${sp.x} ${sp.y} C ${sp.x} ${midY}, ${tp.x} ${midY}, ${tp.x} ${tp.y}`
}

// ── Links (top-down flow, mostly bottom→top) ──────────────────────────────────

// sourcePort/targetPort = vertical layout, hSourcePort/hTargetPort = horizontal layout
const ALL_LINKS: InternalLink[] = [
  { id: 'browser-chi',      source: 'browser',      sourcePort: 'bottom', targetPort: 'top',    hSourcePort: 'right',  hTargetPort: 'left',   target: 'chi',          label: 'HTTP / WS',        goSignature: 'srv.ListenAndServe() // &http.Server{Handler: router}', rps: 120, latencyMs: 2,  category: 'http' },
  { id: 'chi-auth',         source: 'chi',           sourcePort: 'right',  targetPort: 'left',   hSourcePort: 'bottom', hTargetPort: 'top',    target: 'auth',         label: 'Middleware chain',  goSignature: 'r.Use(SessionAuth, CSRFProtect)',        rps: 120, latencyMs: 1,  category: 'internal' },
  { id: 'auth-api',         source: 'auth',          sourcePort: 'bottom', targetPort: 'top',    hSourcePort: 'right',  hTargetPort: 'left',   target: 'api-handlers', label: 'REST handlers',    goSignature: 'r.Get("/policies", h.listPolicies)',                rps: 80,  latencyMs: 1,  category: 'http' },
  { id: 'auth-ws',          source: 'auth',          sourcePort: 'bottom', targetPort: 'top',    hSourcePort: 'right',  hTargetPort: 'left',   target: 'ws-handler',   label: 'WS upgrade',       goSignature: 'upgrader.Upgrade(w, r, nil)',                       rps: 5,   latencyMs: 1,  category: 'ws' },
  { id: 'auth-sse',         source: 'auth',          sourcePort: 'bottom', targetPort: 'top',    hSourcePort: 'right',  hTargetPort: 'left',   target: 'sse-handler',  label: 'SSE subscribe',    goSignature: 'w.Header().Set("Content-Type", "text/event-stream")', rps: 8, latencyMs: 1,  category: 'http' },
  { id: 'api-scheduler',    source: 'api-handlers',  sourcePort: 'bottom', targetPort: 'top',    hSourcePort: 'right',  hTargetPort: 'left',   target: 'scheduler',    label: 'Trigger exec',     goSignature: 'scheduler.RunSleepNow(id, "manual_sleep", "")',     rps: 2,   latencyMs: 1,  category: 'internal' },
  { id: 'api-audit',        source: 'api-handlers',  sourcePort: 'bottom', targetPort: 'top',    hSourcePort: 'bottom', hTargetPort: 'left',   target: 'audit',        label: 'Audit log',        goSignature: 'auditWriter.ch <- &AuditLog{Action: "policy.create"}', rps: 15, latencyMs: 0, category: 'internal' },
  { id: 'api-k8s',          source: 'api-handlers',  sourcePort: 'bottom', targetPort: 'top',    hSourcePort: 'right',  hTargetPort: 'left',   target: 'k8s-client',   label: 'Cluster reads',    goSignature: 'k8s.ListPods(ns) · GetDeployment(ns, name)',        rps: 25,  latencyMs: 12, category: 'k8s' },
  { id: 'api-store',        source: 'api-handlers',  sourcePort: 'bottom', targetPort: 'top',    hSourcePort: 'bottom', hTargetPort: 'left',   target: 'store',        label: 'CRUD',             goSignature: 'store.ListPolicies() · GetPolicy(id)',              rps: 60,  latencyMs: 4,  category: 'store' },
  { id: 'scheduler-scaler', source: 'scheduler',     sourcePort: 'right',  targetPort: 'left',   hSourcePort: 'bottom', hTargetPort: 'top',    target: 'scaler',       label: 'Execute',          goSignature: 'runner.RunPolicySleep(ctx, policy, execID, logCh)', rps: 1,   latencyMs: 2,  category: 'internal' },
  { id: 'scheduler-broker', source: 'scheduler',     sourcePort: 'bottom', targetPort: 'top',    hSourcePort: 'bottom', hTargetPort: 'top',    target: 'broker',       label: 'Publish logs',     goSignature: 'broker.Publish(execID, store.PolicyLogLine{...})',  rps: 30, latencyMs: 0, category: 'internal' },
  { id: 'scheduler-store',  source: 'scheduler',     sourcePort: 'bottom', targetPort: 'top',    hSourcePort: 'right',  hTargetPort: 'left',   target: 'store',        label: 'Policies + Exec',  goSignature: 'store.ListEnabledPolicies() · CreatePolicyExecution()', rps: 10, latencyMs: 3, category: 'store' },
  { id: 'scaler-k8s',       source: 'scaler',        sourcePort: 'bottom', targetPort: 'top',    hSourcePort: 'right',  hTargetPort: 'left',   target: 'k8s-client',   label: 'Scale ops',        goSignature: 'k8s.ScaleDeployment(ns, name, 0) · Annotate()',     rps: 40,  latencyMs: 18, category: 'k8s' },
  { id: 'scaler-store',     source: 'scaler',        sourcePort: 'bottom', targetPort: 'top',    hSourcePort: 'right',  hTargetPort: 'left',   target: 'store',        label: 'Snapshots',        goSignature: 'store.CreateWorkloadSnapshot() · AppendPolicyLogLines()', rps: 20, latencyMs: 3, category: 'store' },
  { id: 'ws-broker',        source: 'ws-handler',    sourcePort: 'bottom', targetPort: 'top',    hSourcePort: 'right',  hTargetPort: 'left',   target: 'broker',       label: 'Sub/Unsub',        goSignature: 'broker.Subscribe(execID) → chan PolicyLogLine',     rps: 5,   latencyMs: 0,  category: 'ws' },
  { id: 'sse-cache',        source: 'sse-handler',   sourcePort: 'bottom', targetPort: 'top',    hSourcePort: 'right',  hTargetPort: 'left',   target: 'cache',        label: 'Snapshot sub',     goSignature: 'cache.Subscribe() → chan struct{}',                 rps: 8,   latencyMs: 0,  category: 'internal' },
  { id: 'audit-store',      source: 'audit',         sourcePort: 'bottom', targetPort: 'top',    hSourcePort: 'right',  hTargetPort: 'bottom', target: 'store',        label: 'Batch insert',     goSignature: 'store.CreateAuditLog(entry) // drain from ch',           rps: 15,  latencyMs: 2,  category: 'store' },
  { id: 'k8s-api-call',     source: 'k8s-client',    sourcePort: 'bottom', targetPort: 'top',    hSourcePort: 'right',  hTargetPort: 'left',   target: 'k8s-api',      label: 'REST calls',       goSignature: 'clientset.AppsV1().Deployments(ns).UpdateScale()',   rps: 65,  latencyMs: 35, category: 'k8s' },
  { id: 'cache-k8s',        source: 'cache',         sourcePort: 'bottom', targetPort: 'top',    hSourcePort: 'right',  hTargetPort: 'left',   target: 'k8s-api',      label: 'Informer WATCH',   goSignature: 'informerFactory.Apps().V1().Deployments().Informer()', rps: 12, latencyMs: 50, category: 'k8s' },
  { id: 'store-pg',         source: 'store',         sourcePort: 'bottom', targetPort: 'top',    hSourcePort: 'right',  hTargetPort: 'left',   target: 'postgres',     label: 'SQL',              goSignature: 'db.Where("id = ?", id).First(&policy)',             rps: 90,  latencyMs: 2,  category: 'store' },
]

const LINK_MAP = new Map(ALL_LINKS.map((l) => [l.id, l]))

// Path building uses buildPathWithOffsets above

function strokeW(rps: number): number {
  return Math.max(1.5, Math.min(6, rps / 22))
}

// ── Scenarios ─────────────────────────────────────────────────────────────────

const SCENARIO_STEPS: Record<FlowScenario, string[][]> = {
  idle: [],
  'page-load': [
    ['browser-chi'],
    ['chi-auth'],
    ['auth-api', 'auth-sse'],
    ['api-store', 'api-k8s', 'sse-cache'],
    ['store-pg', 'k8s-api-call', 'cache-k8s'],
  ],
  'sleep-execution': [
    ['browser-chi'],
    ['chi-auth'],
    ['auth-api'],
    ['api-scheduler', 'api-audit'],
    ['scheduler-scaler', 'scheduler-store', 'scheduler-broker'],
    ['scaler-k8s', 'scaler-store'],
    ['k8s-api-call', 'store-pg', 'audit-store'],
  ],
  'wake-execution': [
    ['browser-chi'],
    ['chi-auth'],
    ['auth-api'],
    ['api-scheduler', 'api-audit'],
    ['scheduler-scaler', 'scheduler-store', 'scheduler-broker'],
    ['scaler-k8s', 'scaler-store'],
    ['k8s-api-call', 'store-pg', 'audit-store'],
  ],
  'ws-stream': [
    ['browser-chi'],
    ['chi-auth'],
    ['auth-ws'],
    ['ws-broker'],
    ['scheduler-broker', 'scheduler-scaler'],
    ['scaler-k8s', 'scaler-store'],
    ['k8s-api-call', 'store-pg'],
  ],
  all: [ALL_LINKS.map((l) => l.id)],
}

const SCENARIO_FLAT: Record<FlowScenario, string[]> = Object.fromEntries(
  Object.entries(SCENARIO_STEPS).map(([k, steps]) => [k, steps.flat()]),
) as Record<FlowScenario, string[]>

const SCENARIO_LABELS: Record<FlowScenario, string> = {
  idle: 'Idle', 'page-load': 'Page Load', 'sleep-execution': 'Sleep Execution',
  'wake-execution': 'Wake Execution', 'ws-stream': 'WS Log Stream', all: 'All Flows',
}

const CATEGORY_COLORS: Record<LinkCategory, string> = {
  http: '#60A5FA', k8s: '#A78BFA', store: '#34D399', internal: '#94A3B8', ws: '#FBBF24',
}

const ERROR_PRESETS: ErrorEvent[] = [
  { linkId: 'k8s-api-call', type: 'k8s-409', label: 'K8s 409', active: false },
  { linkId: 'store-pg', type: 'db-timeout', label: 'DB Timeout', active: false },
  { linkId: 'ws-broker', type: 'ws-disconnect', label: 'WS Drop', active: false },
]

function kindBg(kind: ComponentKind, dark: boolean): string {
  const m: Record<ComponentKind, string> = {
    entry: dark ? '#1E3A5F' : '#DBEAFE', middleware: dark ? '#312E81' : '#E0E7FF',
    handler: dark ? '#064E3B' : '#D1FAE5', core: dark ? '#78350F' : '#FEF3C7',
    infra: dark ? '#1F2937' : '#F3F4F6', external: dark ? '#3B0764' : '#F3E8FF',
  }
  return m[kind]
}

function kindBorder(kind: ComponentKind): string {
  const m: Record<ComponentKind, string> = {
    entry: '#3B82F6', middleware: '#6366F1', handler: '#10B981',
    core: '#F59E0B', infra: '#6B7280', external: '#A855F7',
  }
  return m[kind]
}

const MAX_PARTICLES = 800
const TRAIL_LEN = 7

// ── Control section wrappers ─────────────────────────────────────────────────

function ControlSection({ label, children, flex }: { label: string; children: React.ReactNode; flex?: string }) {
  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', gap: 0.5, flex: flex ?? '0 0 auto',
    }}>
      <Typography variant="caption" sx={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'text.disabled', lineHeight: 1 }}>
        {label}
      </Typography>
      {children}
    </Box>
  )
}

function ToolbarSection({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      {icon}
      <Typography variant="caption" sx={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.disabled' }}>
        {label}
      </Typography>
      {children}
    </Box>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function InternalRiversV3Prototype() {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const router = useRouter()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pathRefs = useRef<(SVGPathElement | null)[]>([])
  const particlesRef = useRef<RiverParticle[]>([])
  const animFrameRef = useRef(0)
  const gsapCtxRef = useRef<gsap.Context | null>(null)

  const [layoutMode, setLayoutMode] = useState<LayoutMode>('vertical')
  const [scenario, setScenario] = useState<FlowScenario>('all')
  const [speed, setSpeed] = useState(1)
  const [hoveredComp, setHoveredComp] = useState<string | null>(null)
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null)
  const [particleCount, setParticleCount] = useState(0)
  const [stepMode, setStepMode] = useState(false)
  const [currentStep, setCurrentStep] = useState(-1)
  const [errors, setErrors] = useState<ErrorEvent[]>(ERROR_PRESETS)
  const [traceMode, setTraceMode] = useState(false)
  const [traceCompId, setTraceCompId] = useState<string | null>(null)
  const [showSparklines, setShowSparklines] = useState(true)

  // Drag state
  const [dragOffsets, setDragOffsets] = useState<DragOffsets>({})
  const dragRef = useRef<{ id: string; startX: number; startY: number; origDx: number; origDy: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleDragStart = useCallback((compId: string, e: React.PointerEvent) => {
    if (traceMode) return
    e.preventDefault()
    e.stopPropagation()
    const off = dragOffsets[compId] ?? { dx: 0, dy: 0 }
    dragRef.current = { id: compId, startX: e.clientX, startY: e.clientY, origDx: off.dx, origDy: off.dy }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [dragOffsets, traceMode])

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return
    const { id, startX, startY, origDx, origDy } = dragRef.current
    const dx = origDx + (e.clientX - startX)
    const dy = origDy + (e.clientY - startY)
    setDragOffsets((prev) => ({ ...prev, [id]: { dx, dy } }))
  }, [])

  const handleDragEnd = useCallback(() => {
    dragRef.current = null
  }, [])

  const throughputRef = useRef<Record<LinkCategory, number[]>>(
    { http: [], k8s: [], store: [], internal: [], ws: [] },
  )
  const [sparkData, setSparkData] = useState<Record<LinkCategory, number[]>>(
    { http: [], k8s: [], store: [], internal: [], ws: [] },
  )

  const activeErrorLinks = useMemo(
    () => new Set(errors.filter((e) => e.active).map((e) => e.linkId)), [errors],
  )

  const litLinks = useMemo(() => {
    if (stepMode && scenario !== 'all' && scenario !== 'idle') {
      const steps = SCENARIO_STEPS[scenario]
      if (currentStep < 0 || currentStep >= steps.length) return new Set<string>()
      const cum = new Set<string>()
      for (let i = 0; i <= currentStep; i++) steps[i].forEach((id) => cum.add(id))
      return cum
    }
    return new Set(SCENARIO_FLAT[scenario])
  }, [scenario, stepMode, currentStep])

  const tracedLinks = useMemo(() => {
    if (!traceMode || !traceCompId) return new Set<string>()
    const visited = new Set<string>()
    const queue = [traceCompId]
    const result = new Set<string>()
    while (queue.length > 0) {
      const cid = queue.shift()!
      if (visited.has(cid)) continue
      visited.add(cid)
      ALL_LINKS.forEach((l) => { if (l.source === cid) { result.add(l.id); queue.push(l.target) } })
    }
    return result
  }, [traceMode, traceCompId])

  const effectiveLinks = useMemo(
    () => (traceMode && traceCompId) ? tracedLinks : litLinks,
    [traceMode, traceCompId, tracedLinks, litLinks],
  )

  const resolvedPaths = useMemo(() => ALL_LINKS.map((l) => buildPathWithOffsets(l, dragOffsets, layoutMode)), [dragOffsets, layoutMode])

  const canvasW = layoutMode === 'vertical' ? V_CANVAS_W : H_CANVAS_W
  const canvasH = layoutMode === 'vertical' ? V_CANVAS_H : H_CANVAS_H

  const setPathRef = useCallback(
    (i: number) => (el: SVGPathElement | null) => { pathRefs.current[i] = el }, [],
  )

  // Animate strokes
  useEffect(() => {
    gsapCtxRef.current?.revert()
    gsapCtxRef.current = gsap.context(() => {
      pathRefs.current.forEach((el, i) => {
        if (!el) return
        const link = ALL_LINKS[i]
        const isLit = effectiveLinks.has(link.id)
        const isErr = activeErrorLinks.has(link.id)
        gsap.to(el, {
          attr: { 'stroke-width': isLit ? strokeW(link.rps) : 0.4, 'stroke-opacity': isLit ? (isErr ? 0.45 : 0.28) : 0.04 },
          stroke: isErr ? '#EF4444' : CATEGORY_COLORS[link.category],
          duration: 0.5, ease: 'power2.out',
        })
      })
    })
    return () => { gsapCtxRef.current?.revert() }
  }, [effectiveLinks, activeErrorLinks])

  // Particle loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = canvasW
    canvas.height = canvasH
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let frameCount = 0
    const catCounts: Record<LinkCategory, number> = { http: 0, k8s: 0, store: 0, internal: 0, ws: 0 }

    const spawn = (li: number): RiverParticle => {
      const link = ALL_LINKS[li]
      const isErr = activeErrorLinks.has(link.id)
      const base = Math.max(0.003, (link.rps / 120) * 0.007) * speed
      return {
        linkIndex: li, progress: 0,
        speed: base + Math.random() * 0.002,
        color: isErr ? '#EF4444' : CATEGORY_COLORS[link.category],
        radius: isErr ? 2.5 : 1.8 + Math.random() * 1.2,
        opacity: 0.8 + Math.random() * 0.2,
        isError: isErr, trail: [],
      }
    }

    let spawnAcc = 0

    const animate = () => {
      ctx.clearRect(0, 0, canvasW, canvasH)
      frameCount++

      spawnAcc++
      if (spawnAcc >= 2) {
        spawnAcc = 0
        ALL_LINKS.forEach((link, i) => {
          if (!effectiveLinks.has(link.id)) return
          const density = link.rps / 120
          if (Math.random() < density * 0.2 && particlesRef.current.length < MAX_PARTICLES) {
            particlesRef.current.push(spawn(i))
            catCounts[link.category]++
          }
        })
      }

      particlesRef.current = particlesRef.current.filter((p) => p.progress < 1)

      for (const p of particlesRef.current) {
        p.progress += p.speed
        const pathEl = pathRefs.current[p.linkIndex]
        if (!pathEl) continue

        const len = pathEl.getTotalLength()
        const pt = pathEl.getPointAtLength(p.progress * len)

        p.trail.push({ x: pt.x, y: pt.y })
        if (p.trail.length > TRAIL_LEN) p.trail.shift()

        // Trail
        for (let t = 0; t < p.trail.length - 1; t++) {
          const tp = p.trail[t]
          const frac = t / p.trail.length
          ctx.beginPath()
          ctx.arc(tp.x, tp.y, p.radius * frac * 0.6, 0, Math.PI * 2)
          ctx.fillStyle = p.color
          ctx.globalAlpha = frac * p.opacity * 0.35
          ctx.fill()
        }

        // Head
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = p.opacity * (1 - p.progress * 0.2)
        ctx.fill()

        if (p.isError) {
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, p.radius * 2.8, 0, Math.PI * 2)
          ctx.fillStyle = '#EF4444'
          ctx.globalAlpha = 0.12
          ctx.fill()
        }
      }

      ctx.globalAlpha = 1

      if (frameCount % 30 === 0) {
        const cats = Object.keys(catCounts) as LinkCategory[]
        cats.forEach((cat) => {
          const arr = throughputRef.current[cat]
          arr.push(catCounts[cat])
          if (arr.length > 60) arr.shift()
          catCounts[cat] = 0
        })
        setSparkData({ ...throughputRef.current })
      }

      setParticleCount(particlesRef.current.length)
      animFrameRef.current = requestAnimationFrame(animate)
    }

    animFrameRef.current = requestAnimationFrame(animate)
    return () => { cancelAnimationFrame(animFrameRef.current) }
  }, [effectiveLinks, speed, activeErrorLinks, canvasW, canvasH])

  const stepForward = useCallback(() => {
    if (scenario === 'all' || scenario === 'idle') return
    setCurrentStep((prev) => Math.min(prev + 1, SCENARIO_STEPS[scenario].length - 1))
  }, [scenario])

  const handleScenarioChange = useCallback((s: FlowScenario) => {
    particlesRef.current = []
    setScenario(s)
    setCurrentStep(-1)
    setTraceCompId(null)
  }, [])

  const toggleError = useCallback((idx: number) => {
    setErrors((prev) => prev.map((e, i) => i === idx ? { ...e, active: !e.active } : e))
  }, [])

  const handleCompClick = useCallback((compId: string) => {
    if (traceMode) setTraceCompId((prev) => prev === compId ? null : compId)
  }, [traceMode])

  const connectedLinks = useMemo(() => {
    if (!hoveredComp) return new Set<string>()
    return new Set(
      ALL_LINKS.filter((l) => l.source === hoveredComp || l.target === hoveredComp).map((l) => l.id),
    )
  }, [hoveredComp])

  const stepSteps = scenario !== 'all' && scenario !== 'idle' ? SCENARIO_STEPS[scenario] : []
  const currentStepLinkIds = stepMode && currentStep >= 0 && currentStep < stepSteps.length ? stepSteps[currentStep] : []

  return (
    <Box sx={{ width: '100vw', minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column', alignItems: 'center', pb: 12 }}>
      {/* Header */}
      <Box sx={{ width: '100%', maxWidth: canvasW + 220, px: 2, pt: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <IconButton size="small" onClick={() => router.push('/prototypes/')}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Typography variant="h5" fontWeight={800} color="text.primary">Internal API Rivers</Typography>
          <Chip label="K15-v3" size="small" sx={{ height: 22, fontSize: 11, fontWeight: 700, bgcolor: alpha('#A855F7', 0.15), color: '#A855F7' }} />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Go backend request flows — hover a box or path for details, use scenarios to isolate flows.
        </Typography>
      </Box>

      {/* Controls */}
      <Box sx={{
        width: '100%', maxWidth: canvasW + 220, px: 2, mb: 1.5,
        display: 'flex', alignItems: 'stretch', gap: 1.5, flexWrap: 'wrap',
      }}>
        {/* Scenario selector — primary control */}
        <ControlSection label="Scenario" flex="1 1 auto">
          <ToggleButtonGroup
            value={scenario} exclusive size="small"
            onChange={(_, v) => { if (v) handleScenarioChange(v) }}
            sx={{
              '& .MuiToggleButton-root': {
                textTransform: 'none', fontSize: '0.7rem', fontWeight: 600, px: 1.5, py: 0.5,
                borderColor: alpha(isDark ? '#fff' : '#000', 0.1),
                color: 'text.secondary',
                '&.Mui-selected': {
                  bgcolor: alpha('#A855F7', isDark ? 0.2 : 0.1),
                  color: '#A855F7',
                  borderColor: alpha('#A855F7', 0.3),
                  '&:hover': { bgcolor: alpha('#A855F7', isDark ? 0.28 : 0.16) },
                },
              },
            }}
          >
            {(Object.keys(SCENARIO_LABELS) as FlowScenario[]).map((s) => (
              <ToggleButton key={s} value={s}>{SCENARIO_LABELS[s]}</ToggleButton>
            ))}
          </ToggleButtonGroup>
        </ControlSection>

        {/* Layout toggle */}
        <ControlSection label="Layout">
          <ToggleButtonGroup
            value={layoutMode} exclusive size="small"
            onChange={(_, v) => { if (v) { setLayoutMode(v); setDragOffsets({}); particlesRef.current = [] } }}
            sx={{
              '& .MuiToggleButton-root': {
                px: 1.2, py: 0.5, borderColor: alpha(isDark ? '#fff' : '#000', 0.1),
                '&.Mui-selected': { bgcolor: alpha('#60A5FA', isDark ? 0.18 : 0.1), color: '#60A5FA', borderColor: alpha('#60A5FA', 0.3) },
              },
            }}
          >
            <ToggleButton value="vertical"><ViewStreamIcon sx={{ fontSize: 15, mr: 0.5 }} />Vertical</ToggleButton>
            <ToggleButton value="horizontal"><ViewWeekIcon sx={{ fontSize: 15, mr: 0.5 }} />Horizontal</ToggleButton>
          </ToggleButtonGroup>
        </ControlSection>

        {/* Step mode */}
        <ControlSection label="Playback">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Chip
              label="Step"
              size="small"
              onClick={() => { setStepMode((v) => !v); setCurrentStep(-1) }}
              sx={{
                height: 26, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
                bgcolor: stepMode ? alpha('#F59E0B', isDark ? 0.2 : 0.12) : 'transparent',
                color: stepMode ? '#F59E0B' : 'text.secondary',
                border: '1px solid', borderColor: stepMode ? alpha('#F59E0B', 0.35) : 'divider',
              }}
            />
            {stepMode && (
              <>
                <IconButton size="small" onClick={() => { setCurrentStep(-1); particlesRef.current = [] }}
                  sx={{ width: 26, height: 26, bgcolor: alpha(isDark ? '#fff' : '#000', 0.05) }}>
                  <ReplayIcon sx={{ fontSize: 14 }} />
                </IconButton>
                <IconButton size="small" onClick={stepForward} disabled={scenario === 'all' || scenario === 'idle'}
                  sx={{ width: 26, height: 26, bgcolor: alpha(isDark ? '#fff' : '#000', 0.05) }}>
                  <SkipNextIcon sx={{ fontSize: 14 }} />
                </IconButton>
                <Chip
                  label={`${currentStep + 1} / ${stepSteps.length}`}
                  size="small"
                  sx={{ height: 22, fontSize: '0.65rem', fontWeight: 600, fontFamily: 'monospace', bgcolor: alpha(isDark ? '#fff' : '#000', 0.05) }}
                />
              </>
            )}
          </Box>
        </ControlSection>

        {/* Trace mode */}
        <ControlSection label="Trace">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Chip
              icon={<RouteIcon sx={{ fontSize: 14 }} />}
              label="Trace"
              size="small"
              onClick={() => { setTraceMode((v) => !v); setTraceCompId(null) }}
              sx={{
                height: 26, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
                bgcolor: traceMode ? alpha('#A855F7', isDark ? 0.2 : 0.12) : 'transparent',
                color: traceMode ? '#A855F7' : 'text.secondary',
                border: '1px solid', borderColor: traceMode ? alpha('#A855F7', 0.35) : 'divider',
                '& .MuiChip-icon': { color: traceMode ? '#A855F7' : 'text.disabled' },
              }}
            />
            {traceMode && traceCompId && (
              <Chip
                label={COMP_MAP.get(traceCompId)?.label ?? ''}
                size="small"
                onDelete={() => setTraceCompId(null)}
                sx={{ height: 22, fontSize: '0.65rem', fontWeight: 600, bgcolor: alpha('#A855F7', 0.15), color: '#A855F7' }}
              />
            )}
          </Box>
        </ControlSection>

        {/* Category legend */}
        <ControlSection label="Categories">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {(Object.entries(CATEGORY_COLORS) as [LinkCategory, string][]).map(([cat, c]) => (
              <Box key={cat} sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c, boxShadow: `0 0 4px ${alpha(c, 0.4)}` }} />
                <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 500, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {cat}
                </Typography>
              </Box>
            ))}
          </Box>
        </ControlSection>
      </Box>

      {/* Diagram + sparklines */}
      <Box sx={{ display: 'flex', gap: 2, px: 2 }}>
        <Box sx={{ position: 'relative', width: canvasW, height: canvasH, flexShrink: 0 }}>
          {/* Lane backgrounds */}
          <svg viewBox={`0 0 ${canvasW} ${canvasH}`} width={canvasW} height={canvasH} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
            {LANES.map((lane) => {
              if (layoutMode === 'vertical') {
                const { y: ly, h: lh } = vLaneBounds(lane.idx)
                return (
                  <g key={lane.label}>
                    <rect x={16} y={ly} width={canvasW - 32} height={lh} rx={10}
                      fill={isDark ? alpha(lane.color, 0.03) : alpha(lane.color, 0.02)}
                      stroke={isDark ? alpha(lane.color, 0.06) : alpha(lane.color, 0.04)} strokeWidth={1} strokeDasharray="5 5" />
                    <text x={28} y={ly + 14} fontSize={9} fontWeight={600}
                      fill={isDark ? alpha(lane.color, 0.28) : alpha(lane.color, 0.32)} fontFamily="sans-serif">
                      {lane.label}
                    </text>
                  </g>
                )
              }
              const { x: lx, w: lw } = hLaneBounds(lane.idx)
              return (
                <g key={lane.label}>
                  <rect x={lx} y={12} width={lw} height={canvasH - 24} rx={10}
                    fill={isDark ? alpha(lane.color, 0.03) : alpha(lane.color, 0.02)}
                    stroke={isDark ? alpha(lane.color, 0.06) : alpha(lane.color, 0.04)} strokeWidth={1} strokeDasharray="5 5" />
                  <text x={lx + lw / 2} y={26} textAnchor="middle" fontSize={9} fontWeight={600}
                    fill={isDark ? alpha(lane.color, 0.28) : alpha(lane.color, 0.32)} fontFamily="sans-serif">
                    {lane.label}
                  </text>
                </g>
              )
            })}
          </svg>

          {/* SVG paths */}
          <svg viewBox={`0 0 ${canvasW} ${canvasH}`} width={canvasW} height={canvasH} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
            <defs>
              {ALL_LINKS.map((link) => (
                <marker key={`a-${link.id}`} id={`a-${link.id}`} markerWidth="5" markerHeight="4" refX="4" refY="2" orient="auto">
                  <path d="M0,0.5 L5,2 L0,3.5" fill={activeErrorLinks.has(link.id) ? '#EF4444' : CATEGORY_COLORS[link.category]} fillOpacity={0.45} />
                </marker>
              ))}
            </defs>
            {ALL_LINKS.map((link, i) => {
              const isLit = effectiveLinks.has(link.id)
              const isHigh = hoveredLinkId === link.id || connectedLinks.has(link.id)
              const isCurStep = stepMode && currentStepLinkIds.includes(link.id)
              return (
                <g key={link.id}>
                  <path ref={setPathRef(i)} d={resolvedPaths[i]} fill="none"
                    stroke={activeErrorLinks.has(link.id) ? '#EF4444' : CATEGORY_COLORS[link.category]}
                    strokeWidth={isLit ? strokeW(link.rps) : 0.4}
                    strokeOpacity={isCurStep ? 0.65 : isHigh ? 0.5 : isLit ? 0.28 : 0.04}
                    strokeLinecap="round" markerEnd={isLit ? `url(#a-${link.id})` : undefined}
                    style={{ transition: 'stroke-opacity 200ms' }} />
                  <path d={resolvedPaths[i]} fill="none" stroke="transparent" strokeWidth={14}
                    style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredLinkId(link.id)} onMouseLeave={() => setHoveredLinkId(null)} />
                </g>
              )
            })}
          </svg>

          {/* Canvas particles */}
          <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: canvasW, height: canvasH, pointerEvents: 'none' }} />

          {/* Component boxes (draggable) */}
          {COMPONENTS.map((comp, ci) => {
            const r = compRectWithOffset(comp, dragOffsets, layoutMode)
            const isDragging = dragRef.current?.id === comp.id
            const isConn = !hoveredComp || hoveredComp === comp.id ||
              ALL_LINKS.some((l) => (l.source === hoveredComp && l.target === comp.id) || (l.target === hoveredComp && l.source === comp.id))
            const isTrace = traceMode && traceCompId === comp.id
            const hasErr = errors.some((e) => e.active && ALL_LINKS.some((l) => l.id === e.linkId && (l.source === comp.id || l.target === comp.id)))

            return (
              <motion.div key={comp.id}
                initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: ci * 0.02, duration: 0.25 }}
                style={{ position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, zIndex: isDragging ? 10 : 2, touchAction: 'none' }}
                onMouseEnter={() => { if (!dragRef.current) setHoveredComp(comp.id) }}
                onMouseLeave={() => { if (!dragRef.current) setHoveredComp(null) }}
                onPointerDown={(e) => handleDragStart(comp.id, e)}
                onPointerMove={handleDragMove}
                onPointerUp={handleDragEnd}
                onClick={() => handleCompClick(comp.id)}>
                <Box sx={{
                  width: '100%', height: '100%', bgcolor: kindBg(comp.kind, isDark),
                  border: '1.5px solid', borderColor: hasErr ? '#EF4444' : isTrace ? '#A855F7' : kindBorder(comp.kind),
                  borderRadius: 1.5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: 0.8,
                  cursor: traceMode ? 'crosshair' : isDragging ? 'grabbing' : 'grab',
                  opacity: isConn ? 1 : 0.25, transition: isDragging ? 'box-shadow 100ms' : 'opacity 200ms, box-shadow 200ms, border-color 200ms',
                  boxShadow: isDragging ? `0 4px 20px rgba(0,0,0,0.3)` : hoveredComp === comp.id ? `0 0 14px ${kindBorder(comp.kind)}50` : hasErr ? '0 0 8px rgba(239,68,68,0.3)' : isTrace ? '0 0 8px rgba(168,85,247,0.4)' : 'none',
                  userSelect: 'none',
                }}>
                  <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 700, fontSize: '0.68rem', lineHeight: 1.2, textAlign: 'center', pointerEvents: 'none' }}>
                    {comp.label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.5rem', lineHeight: 1.2, textAlign: 'center', pointerEvents: 'none' }}>
                    {comp.sublabel}
                  </Typography>
                </Box>
              </motion.div>
            )
          })}

          {/* Tooltips */}
          <AnimatePresence>
            {hoveredLinkId && !dragRef.current && <LinkTooltip linkId={hoveredLinkId} isError={activeErrorLinks.has(hoveredLinkId)} isDark={isDark} offsets={dragOffsets} mode={layoutMode} />}
          </AnimatePresence>
          <AnimatePresence>
            {hoveredComp && !hoveredLinkId && !dragRef.current && <CompTooltip compId={hoveredComp} effectiveLinks={effectiveLinks} offsets={dragOffsets} mode={layoutMode} />}
          </AnimatePresence>
        </Box>

        {/* Sparklines */}
        {showSparklines && (
          <Box sx={{ width: 170, display: 'flex', flexDirection: 'column', gap: 0.8, flexShrink: 0 }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: '0.6rem' }}>
              Throughput
            </Typography>
            {(Object.keys(CATEGORY_COLORS) as LinkCategory[]).map((cat) => (
              <SparklineCard key={cat} category={cat} data={sparkData[cat] ?? []} color={CATEGORY_COLORS[cat]} isDark={isDark} />
            ))}
          </Box>
        )}
      </Box>

      {/* Toolbar */}
      <Box sx={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
        bgcolor: isDark ? alpha('#0A0A0A', 0.94) : alpha('#FAFAFA', 0.96),
        borderTop: '1px solid', borderColor: alpha(isDark ? '#fff' : '#000', 0.08),
        px: 2.5, py: 1,
        display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap', backdropFilter: 'blur(12px)',
      }}>
        <Chip
          label={SCENARIO_LABELS[scenario]}
          size="small"
          sx={{ height: 24, fontSize: '0.7rem', fontWeight: 700, bgcolor: alpha('#A855F7', isDark ? 0.2 : 0.1), color: '#A855F7', border: '1px solid', borderColor: alpha('#A855F7', 0.25) }}
        />

        <ToolbarSection label="Speed" icon={<SpeedIcon sx={{ fontSize: 13 }} />}>
          <Slider
            value={speed} onChange={(_, v) => setSpeed(v as number)}
            min={0.25} max={5} step={0.25} size="small"
            sx={{
              width: 80,
              color: '#60A5FA',
              '& .MuiSlider-thumb': { width: 12, height: 12 },
              '& .MuiSlider-rail': { opacity: 0.2 },
            }}
          />
          <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600, fontFamily: 'monospace', color: 'text.secondary', minWidth: 28, textAlign: 'right' }}>
            {speed}x
          </Typography>
        </ToolbarSection>

        <Typography variant="caption" sx={{ fontSize: '0.65rem', fontFamily: 'monospace', color: 'text.disabled' }}>
          {particleCount}p · {effectiveLinks.size}/{ALL_LINKS.length}
        </Typography>

        <Box sx={{ width: 1, height: 20, bgcolor: alpha(isDark ? '#fff' : '#000', 0.06) }} />

        <ToolbarSection label="Faults" icon={<BugReportIcon sx={{ fontSize: 13, color: errors.some((e) => e.active) ? '#EF4444' : 'text.disabled' }} />}>
          {errors.map((err, idx) => (
            <Chip
              key={err.type} label={err.label} size="small"
              onClick={() => toggleError(idx)}
              sx={{
                height: 24, fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer',
                bgcolor: err.active ? alpha('#EF4444', isDark ? 0.2 : 0.12) : 'transparent',
                color: err.active ? '#EF4444' : 'text.secondary',
                border: '1px solid', borderColor: err.active ? alpha('#EF4444', 0.35) : 'divider',
              }}
            />
          ))}
        </ToolbarSection>

        <Box sx={{ width: 1, height: 20, bgcolor: alpha(isDark ? '#fff' : '#000', 0.06) }} />

        <Chip
          label="Charts"
          size="small"
          onClick={() => setShowSparklines((v) => !v)}
          sx={{
            height: 24, fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer',
            bgcolor: showSparklines ? alpha('#34D399', isDark ? 0.18 : 0.1) : 'transparent',
            color: showSparklines ? '#34D399' : 'text.secondary',
            border: '1px solid', borderColor: showSparklines ? alpha('#34D399', 0.3) : 'divider',
          }}
        />

        <Box sx={{ ml: 'auto', display: 'flex', gap: 0.75 }}>
          <Button size="small" variant="outlined" startIcon={<RestartAltIcon sx={{ fontSize: 14 }} />}
            onClick={() => setDragOffsets({})}
            sx={{ textTransform: 'none', fontSize: '0.65rem', fontWeight: 600, borderColor: 'divider', color: 'text.secondary', py: 0.3 }}>
            Layout
          </Button>
          <Button size="small" variant="outlined" startIcon={<RestartAltIcon sx={{ fontSize: 14 }} />}
            onClick={() => {
              particlesRef.current = []; handleScenarioChange('all'); setSpeed(1)
              setErrors(ERROR_PRESETS); setTraceMode(false); setStepMode(false); setDragOffsets({})
            }}
            sx={{ textTransform: 'none', fontSize: '0.65rem', fontWeight: 600, borderColor: 'divider', color: 'text.secondary', py: 0.3 }}>
            All
          </Button>
        </Box>
      </Box>
    </Box>
  )
}

// ── Link tooltip ──────────────────────────────────────────────────────────────

function LinkTooltip({ linkId, isError, isDark, offsets, mode }: { linkId: string; isError: boolean; isDark: boolean; offsets: DragOffsets; mode: LayoutMode }) {
  const link = LINK_MAP.get(linkId)
  if (!link) return null
  const src = COMP_MAP.get(link.source)
  const tgt = COMP_MAP.get(link.target)
  if (!src || !tgt) return null

  const ports = linkPorts(link, mode)
  const sp = portPointWithOffset(src, ports.sp, offsets, mode)
  const tp = portPointWithOffset(tgt, ports.tp, offsets, mode)
  const mx = (sp.x + tp.x) / 2
  const my = Math.min(sp.y, tp.y) - 14

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.1 }}
      style={{ position: 'absolute', left: mx, top: my, transform: 'translate(-50%, -100%)', zIndex: 20, pointerEvents: 'none' }}>
      <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: isError ? 'error.main' : 'divider', borderRadius: 1.5, px: 1.5, py: 1, minWidth: 220, maxWidth: 380, boxShadow: 6 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.3 }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: isError ? '#EF4444' : CATEGORY_COLORS[link.category] }} />
          <Typography variant="caption" fontWeight={700} color="text.primary" sx={{ fontSize: '0.68rem' }}>
            {src.label} → {tgt.label}
          </Typography>
          <Chip label={link.category} size="small" sx={{ height: 15, fontSize: 8, ml: 'auto', bgcolor: alpha(CATEGORY_COLORS[link.category], 0.15), color: CATEGORY_COLORS[link.category] }} />
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.58rem', mb: 0.3 }}>
          {link.label}
        </Typography>
        <Box sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderRadius: 0.5, px: 0.7, py: 0.3, mb: 0.4 }}>
          <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.52rem', color: 'text.secondary', wordBreak: 'break-all' }}>
            {link.goSignature}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.52rem' }}>{link.rps} RPS</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.52rem' }}>{link.latencyMs}ms</Typography>
          {isError && <Typography variant="caption" sx={{ fontSize: '0.52rem', color: '#EF4444', fontWeight: 600 }}>ERROR</Typography>}
        </Box>
      </Box>
    </motion.div>
  )
}

// ── Component tooltip ─────────────────────────────────────────────────────────

const COMPONENT_LIMITS: Record<string, { label: string; value: string }[]> = {
  chi:          [{ label: 'Max body', value: '1 MB' }],
  auth:         [{ label: 'Rate limit (IP)', value: '10 req / 15 min' }, { label: 'Rate limit (user)', value: '5 req / 15 min' }],
  'k8s-client': [{ label: 'QPS', value: '100' }, { label: 'Burst', value: '200' }],
  store:        [{ label: 'Pool size', value: '10 conns' }, { label: 'Idle conns', value: '5' }, { label: 'Conn lifetime', value: '5 min' }],
  cache:        [{ label: 'Resync', value: '5 min' }, { label: 'Max subscribers', value: '100' }],
  broker:       [{ label: 'Channel buffer', value: '256' }],
  audit:        [{ label: 'Write buffer', value: '4096' }],
  scheduler:    [{ label: 'Tick interval', value: '30s' }],
  postgres:     [{ label: 'Tables', value: '11' }],
}

function CompTooltip({ compId, effectiveLinks, offsets, mode }: { compId: string; effectiveLinks: Set<string>; offsets: DragOffsets; mode: LayoutMode }) {
  const comp = COMP_MAP.get(compId)
  if (!comp) return null

  const incoming = ALL_LINKS.filter((l) => l.target === compId && effectiveLinks.has(l.id))
  const outgoing = ALL_LINKS.filter((l) => l.source === compId && effectiveLinks.has(l.id))
  const totalIn = incoming.reduce((s, l) => s + l.rps, 0)
  const totalOut = outgoing.reduce((s, l) => s + l.rps, 0)
  const limits = COMPONENT_LIMITS[compId]

  const r = compRectWithOffset(comp, offsets, mode)
  const above = r.y > 180
  const tx = r.x + r.w / 2
  const ty = above ? r.y - 8 : r.y + r.h + 8

  return (
    <motion.div initial={{ opacity: 0, y: above ? 5 : -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.1 }}
      style={{ position: 'absolute', left: tx, top: ty, transform: above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)', zIndex: 15, pointerEvents: 'none' }}>
      <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, px: 1.5, py: 1, minWidth: 210, maxWidth: 340, boxShadow: 5 }}>
        <Typography variant="caption" fontWeight={700} color="text.primary" sx={{ display: 'block', fontSize: '0.68rem' }}>
          {comp.label}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.52rem', mb: 0.2 }}>
          {comp.sublabel}
        </Typography>
        {comp.goFile && (
          <Box sx={{ bgcolor: 'action.hover', borderRadius: 0.5, px: 0.5, py: 0.15, mb: 0.4, display: 'inline-block' }}>
            <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.48rem', color: 'text.secondary' }}>
              {comp.goFile}
            </Typography>
          </Box>
        )}

        {/* Live throughput */}
        {(totalIn > 0 || totalOut > 0) && (
          <Box sx={{ display: 'flex', gap: 1.5, mb: 0.4, mt: 0.2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
              <Typography variant="caption" sx={{ fontSize: '0.5rem', color: 'text.secondary' }}>↓</Typography>
              <Typography variant="caption" sx={{ fontSize: '0.56rem', fontWeight: 700, fontFamily: 'monospace', color: 'text.primary' }}>{totalIn}</Typography>
              <Typography variant="caption" sx={{ fontSize: '0.44rem', color: 'text.secondary' }}>req/s in</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
              <Typography variant="caption" sx={{ fontSize: '0.5rem', color: 'text.secondary' }}>↑</Typography>
              <Typography variant="caption" sx={{ fontSize: '0.56rem', fontWeight: 700, fontFamily: 'monospace', color: 'text.primary' }}>{totalOut}</Typography>
              <Typography variant="caption" sx={{ fontSize: '0.44rem', color: 'text.secondary' }}>req/s out</Typography>
            </Box>
          </Box>
        )}

        {/* Limits */}
        {limits && limits.length > 0 && (
          <Box sx={{ bgcolor: 'action.hover', borderRadius: 0.5, px: 0.7, py: 0.4, mb: 0.4 }}>
            {limits.map((lim) => (
              <Box key={lim.label} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                <Typography variant="caption" sx={{ fontSize: '0.48rem', color: 'text.secondary' }}>{lim.label}</Typography>
                <Typography variant="caption" sx={{ fontSize: '0.48rem', fontWeight: 600, fontFamily: 'monospace', color: 'text.primary' }}>{lim.value}</Typography>
              </Box>
            ))}
          </Box>
        )}

        {incoming.length > 0 && (
          <Box sx={{ mb: 0.2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.48rem', fontWeight: 600 }}>← Incoming</Typography>
            {incoming.map((l) => (
              <Box key={l.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.3, ml: 0.4 }}>
                <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: CATEGORY_COLORS[l.category], flexShrink: 0 }} />
                <Typography variant="caption" sx={{ fontSize: '0.48rem', color: 'text.secondary' }}>
                  {COMP_MAP.get(l.source)?.label} ({l.rps} req/s)
                </Typography>
              </Box>
            ))}
          </Box>
        )}
        {outgoing.length > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.48rem', fontWeight: 600 }}>→ Outgoing</Typography>
            {outgoing.map((l) => (
              <Box key={l.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.3, ml: 0.4 }}>
                <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: CATEGORY_COLORS[l.category], flexShrink: 0 }} />
                <Typography variant="caption" sx={{ fontSize: '0.48rem', color: 'text.secondary' }}>
                  → {COMP_MAP.get(l.target)?.label} ({l.rps} req/s)
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </motion.div>
  )
}

// ── Sparkline card ────────────────────────────────────────────────────────────

function SparklineCard({ category, data, color, isDark }: { category: LinkCategory; data: number[]; color: string; isDark: boolean }) {
  const option = useMemo(() => ({
    animation: false,
    grid: { top: 2, right: 2, bottom: 2, left: 2 },
    xAxis: { type: 'category' as const, show: false, data: data.map((_, i) => i) },
    yAxis: { type: 'value' as const, show: false, min: 0 },
    series: [{
      type: 'line' as const, data, smooth: true, symbol: 'none',
      lineStyle: { width: 1.2, color },
      areaStyle: { color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: alpha(color, 0.25) }, { offset: 1, color: alpha(color, 0.02) }] } },
    }],
  }), [data, color])

  const latest = data.length > 0 ? data[data.length - 1] : 0

  return (
    <Box sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderRadius: 1, px: 0.8, py: 0.4, border: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
          <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: color }} />
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.55rem', fontWeight: 600 }}>{category}</Typography>
        </Box>
        <Typography variant="caption" sx={{ fontSize: '0.55rem', fontWeight: 700, color }}>{latest}</Typography>
      </Box>
      <Box sx={{ height: 28 }}>
        <ReactEChartsCore echarts={echarts} option={option} style={{ height: 28, width: '100%' }} notMerge lazyUpdate />
      </Box>
    </Box>
  )
}
