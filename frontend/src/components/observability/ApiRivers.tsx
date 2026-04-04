'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Slider from '@mui/material/Slider'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import RouteIcon from '@mui/icons-material/Route'
import ViewStreamIcon from '@mui/icons-material/ViewStream'
import ViewWeekIcon from '@mui/icons-material/ViewWeek'
import SpeedIcon from '@mui/icons-material/Speed'
import FullscreenIcon from '@mui/icons-material/Fullscreen'
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit'
import BubbleChartIcon from '@mui/icons-material/BubbleChart'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme, alpha } from '@mui/material/styles'
import { useRouter } from 'next/navigation'
// gsap is imported eagerly because it powers the animation loop that starts on mount
import gsap from 'gsap'
import type { ObservabilityStreamState } from '@/lib/useObservabilityStream'
import RiversMinimap from '@/components/observability/RiversMinimap'
import RiversLinkPopover from '@/components/observability/RiversLinkPopover'
import RiversComponentPreview from '@/components/observability/RiversComponentPreview'
import { ZoomControls } from '@/components/observability/RiversControls'

// ── Types ────────────────────────────────────────────────────────────────────

type ComponentKind = 'entry' | 'middleware' | 'handler' | 'core' | 'infra' | 'external'
type LinkCategory = 'http' | 'k8s' | 'store' | 'internal' | 'ws'
type PortSide = 'left' | 'right' | 'top' | 'bottom'
type LayoutMode = 'vertical' | 'horizontal'
type FlowScenario = 'idle' | 'page-load' | 'sleep-execution' | 'wake-execution' | 'ws-stream' | 'all'

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
  trail: { x: number; y: number }[]
  isBurst?: boolean
  burstAngle?: number
  burstX?: number
  burstY?: number
}

interface Shockwave {
  x: number
  y: number
  radius: number
  opacity: number
  color: string
}

// ── Layout constants ─────────────────────────────────────────────────────────

const BOX_W = 132
const BOX_H = 55
const LANE_GAP = 8

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

const H_CANVAS_W = 1360
const H_CANVAS_H = 620
const H_COL_X = [50, 240, 440, 660, 920, 1170]
const H_ROW_HEIGHT = 115
const H_ROW_TOP = 50

function hColX(col: number): number { return H_COL_X[col] }
function hRowY(row: number): number { return H_ROW_TOP + row * H_ROW_HEIGHT }

// ── Lane definitions ─────────────────────────────────────────────────────────

interface Lane { label: string; idx: number; color: string }

const LANES: Lane[] = [
  { label: 'Entry', idx: 0, color: '#3B82F6' },
  { label: 'Middleware', idx: 1, color: '#6366F1' },
  { label: 'Handlers', idx: 2, color: '#10B981' },
  { label: 'Core Logic', idx: 3, color: '#F59E0B' },
  { label: 'Data & Cluster', idx: 4, color: '#6B7280' },
  { label: 'External', idx: 5, color: '#A855F7' },
]

function vLaneBounds(tier: number): { y: number; h: number } {
  const tierTop = TIER_Y[tier]
  const tierBot = tierTop + BOX_H
  const prevBot = tier > 0 ? TIER_Y[tier - 1] + BOX_H : 0
  const nextTop = tier < TIER_Y.length - 1 ? TIER_Y[tier + 1] : V_CANVAS_H
  const ly = tier === 0 ? 8 : (prevBot + tierTop) / 2 + LANE_GAP / 2
  const by = tier === TIER_Y.length - 1 ? V_CANVAS_H - 8 : (tierBot + nextTop) / 2 - LANE_GAP / 2
  return { y: ly, h: by - ly }
}

function hLaneBounds(col: number): { x: number; w: number } {
  const colLeft = H_COL_X[col]
  const colRight = colLeft + BOX_W
  const prevRight = col > 0 ? H_COL_X[col - 1] + BOX_W : 0
  const nextLeft = col < H_COL_X.length - 1 ? H_COL_X[col + 1] : H_CANVAS_W
  const lx = col === 0 ? 8 : (prevRight + colLeft) / 2 + LANE_GAP / 2
  const rx = col === H_COL_X.length - 1 ? H_CANVAS_W - 8 : (colRight + nextLeft) / 2 - LANE_GAP / 2
  return { x: lx, w: rx - lx }
}

// ── Components (15 nodes, 6 tiers) ──────────────────────────────────────────

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

// ── Links (21 connections) ───────────────────────────────────────────────────

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

// ── Scenarios ────────────────────────────────────────────────────────────────

const SCENARIO_STEPS: Record<FlowScenario, string[][]> = {
  idle: [],
  'page-load': [['browser-chi'], ['chi-auth'], ['auth-api', 'auth-sse'], ['api-store', 'api-k8s', 'sse-cache'], ['store-pg', 'k8s-api-call', 'cache-k8s']],
  'sleep-execution': [['browser-chi'], ['chi-auth'], ['auth-api'], ['api-scheduler', 'api-audit'], ['scheduler-scaler', 'scheduler-store', 'scheduler-broker'], ['scaler-k8s', 'scaler-store'], ['k8s-api-call', 'store-pg', 'audit-store']],
  'wake-execution': [['browser-chi'], ['chi-auth'], ['auth-api'], ['api-scheduler', 'api-audit'], ['scheduler-scaler', 'scheduler-store', 'scheduler-broker'], ['scaler-k8s', 'scaler-store'], ['k8s-api-call', 'store-pg', 'audit-store']],
  'ws-stream': [['browser-chi'], ['chi-auth'], ['auth-ws'], ['ws-broker'], ['scheduler-broker', 'scheduler-scaler'], ['scaler-k8s', 'scaler-store'], ['k8s-api-call', 'store-pg']],
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

const MAX_PARTICLES = 800
const TRAIL_LEN = 12
const LS_KEY_PREFIX = 'kp-rivers-drag-offsets-'

// ── Control section wrapper ──────────────────────────────────────────────────

function ControlSection({ label, children, flex }: { label: string; children: React.ReactNode; flex?: string }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flex: flex ?? '0 0 auto' }}>
      <Typography variant="caption" sx={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'text.disabled', lineHeight: 1 }}>
        {label}
      </Typography>
      {children}
    </Box>
  )
}

// ── Drag offsets ─────────────────────────────────────────────────────────────

type DragOffsets = Record<string, { dx: number; dy: number }>

// ── Helpers ──────────────────────────────────────────────────────────────────

function compRectBase(c: SystemComponent, mode: LayoutMode) {
  if (mode === 'vertical') {
    const tierSize = TIER_SIZES[c.row]
    return { x: tierX(tierSize, c.col, c.row), y: TIER_Y[c.row], w: BOX_W, h: BOX_H }
  }
  return { x: hColX(c.hCol), y: hRowY(c.hRow), w: BOX_W, h: BOX_H }
}

function compRect(c: SystemComponent, offsets: DragOffsets, mode: LayoutMode) {
  const base = compRectBase(c, mode)
  const off = offsets[c.id]
  if (off) return { ...base, x: base.x + off.dx, y: base.y + off.dy }
  return base
}

function portPoint(comp: SystemComponent, side: PortSide, offsets: DragOffsets, mode: LayoutMode): { x: number; y: number } {
  const r = compRect(comp, offsets, mode)
  switch (side) {
    case 'right': return { x: r.x + r.w, y: r.y + r.h / 2 }
    case 'left': return { x: r.x, y: r.y + r.h / 2 }
    case 'top': return { x: r.x + r.w / 2, y: r.y }
    case 'bottom': return { x: r.x + r.w / 2, y: r.y + r.h }
  }
}

function buildPath(link: InternalLink, offsets: DragOffsets, mode: LayoutMode): string {
  const src = COMP_MAP.get(link.source)
  const tgt = COMP_MAP.get(link.target)
  if (!src || !tgt) return ''

  const sp = mode === 'vertical' ? link.sourcePort : link.hSourcePort
  const tp = mode === 'vertical' ? link.targetPort : link.hTargetPort
  const s = portPoint(src, sp, offsets, mode)
  const t = portPoint(tgt, tp, offsets, mode)
  const dx = t.x - s.x
  const dy = t.y - s.y

  if (sp === 'bottom' && tp === 'top') {
    const midY = s.y + dy * 0.5
    return `M ${s.x} ${s.y} C ${s.x} ${midY}, ${t.x} ${midY}, ${t.x} ${t.y}`
  }
  if (sp === 'right' && tp === 'left') {
    if (Math.abs(dy) < 15) {
      const cpx = s.x + dx * 0.5
      return `M ${s.x} ${s.y} C ${cpx} ${s.y}, ${cpx} ${t.y}, ${t.x} ${t.y}`
    }
    const bend = Math.min(Math.abs(dx) * 0.35, 100)
    return `M ${s.x} ${s.y} C ${s.x + bend} ${s.y}, ${t.x - bend} ${t.y}, ${t.x} ${t.y}`
  }
  if (sp === 'bottom' && tp === 'left') {
    const midY = s.y + Math.abs(dy) * 0.6
    return `M ${s.x} ${s.y} C ${s.x} ${midY}, ${s.x} ${t.y}, ${t.x} ${t.y}`
  }
  if (sp === 'right' && tp === 'bottom') {
    const midX = s.x + Math.abs(dx) * 0.6
    return `M ${s.x} ${s.y} C ${midX} ${s.y}, ${t.x} ${s.y}, ${t.x} ${t.y}`
  }
  const midY = s.y + dy * 0.5
  return `M ${s.x} ${s.y} C ${s.x} ${midY}, ${t.x} ${midY}, ${t.x} ${t.y}`
}

function strokeW(rps: number): number {
  return Math.max(1.5, Math.min(6, rps / 22))
}

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

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return `#${[clamp(r), clamp(g), clamp(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

function shiftColor(hex: string): string {
  const [r, g, b] = hexToRgb(hex)
  const offset = () => Math.round(Math.random() * 30 - 15)
  return rgbToHex(r + offset(), g + offset(), b + offset())
}

function bfsDepthMap(startId: string): Map<string, number> {
  const depths = new Map<string, number>()
  const queue = [startId]
  depths.set(startId, 0)
  while (queue.length > 0) {
    const cid = queue.shift()!
    const depth = depths.get(cid)!
    for (const l of ALL_LINKS) {
      if (l.source !== cid || depths.has(l.target)) continue
      depths.set(l.target, depth + 1)
      queue.push(l.target)
    }
  }
  return depths
}

function bfsPathTo(startId: string, endId: string): string[] {
  const parent = new Map<string, string>()
  const queue = [startId]
  parent.set(startId, '')
  while (queue.length > 0) {
    const cid = queue.shift()!
    if (cid === endId) break
    for (const l of ALL_LINKS) {
      if (l.source !== cid || parent.has(l.target)) continue
      parent.set(l.target, cid)
      queue.push(l.target)
    }
  }
  if (!parent.has(endId)) return []
  const path: string[] = []
  let cur = endId
  while (cur) {
    path.unshift(cur)
    cur = parent.get(cur)!
  }
  return path
}

function computeCriticalPath(): Set<string> {
  const depths = bfsDepthMap('browser')
  const externals = COMPONENTS.filter((c) => c.kind === 'external')
  let maxLatency = 0
  let slowestPath: string[] = []

  for (const ext of externals) {
    const path = bfsPathTo('browser', ext.id)
    if (path.length < 2) continue
    let cumLatency = 0
    for (let i = 0; i < path.length - 1; i++) {
      const link = ALL_LINKS.find((l) => l.source === path[i] && l.target === path[i + 1])
      cumLatency += link?.latencyMs ?? 0
    }
    if (cumLatency > maxLatency) {
      maxLatency = cumLatency
      slowestPath = path
    }
  }

  const linkIds = new Set<string>()
  for (let i = 0; i < slowestPath.length - 1; i++) {
    const link = ALL_LINKS.find((l) => l.source === slowestPath[i] && l.target === slowestPath[i + 1])
    if (link) linkIds.add(link.id)
  }
  return linkIds
}

function statusIndicatorColor(status: string | undefined): string {
  if (status === 'crit') return '#EF4444'
  if (status === 'warn') return '#FBBF24'
  return '#22C55E'
}

function formatReqS(rps: number | undefined): string {
  if (rps == null) return ''
  return rps >= 1000 ? `${(rps / 1000).toFixed(1)}k req/s` : `${Math.round(rps)} req/s`
}

// ── Main component ───────────────────────────────────────────────────────────

interface Props {
  stream: ObservabilityStreamState
}

export default function ApiRivers({ stream }: Props) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const router = useRouter()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const pathRefs = useRef<(SVGPathElement | null)[]>([])
  const particlesRef = useRef<RiverParticle[]>([])
  const shockwavesRef = useRef<Shockwave[]>([])
  const animFrameRef = useRef(0)
  const gsapCtxRef = useRef<gsap.Context | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const previousPathsRef = useRef<string[]>([])
  const prevEventsLenRef = useRef(0)

  const [layoutMode, setLayoutMode] = useState<LayoutMode>('vertical')
  const [scenario, setScenario] = useState<FlowScenario>('all')
  const [speed, setSpeed] = useState(1)
  const [density, setDensity] = useState(1)
  const [hoveredComp, setHoveredComp] = useState<string | null>(null)
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null)
  const [particleCount, setParticleCount] = useState(0)
  const [traceMode, setTraceMode] = useState(false)
  const [traceCompId, setTraceCompId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [fullscreen, setFullscreen] = useState(false)
  const [clickedLinkId, setClickedLinkId] = useState<string | null>(null)
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  // Drag state
  const [dragOffsets, setDragOffsets] = useState<DragOffsets>({})
  const dragRef = useRef<{ id: string; startX: number; startY: number; origDx: number; origDy: number } | null>(null)

  // N: Load drag offsets from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY_PREFIX + layoutMode)
      if (stored) setDragOffsets(JSON.parse(stored))
    } catch { /* ignore corrupt data */ }
  }, [layoutMode])

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

  // N: Save drag offsets to localStorage on drag end
  const handleDragEnd = useCallback(() => {
    if (dragRef.current) {
      try {
        localStorage.setItem(LS_KEY_PREFIX + layoutMode, JSON.stringify(dragOffsets))
      } catch { /* storage full, ignore */ }
    }
    dragRef.current = null
  }, [dragOffsets, layoutMode])

  // Map SSE component statuses to component IDs
  const componentStatusMap = useMemo(() => {
    const map: Record<string, string> = {}
    if (stream.latest) {
      for (const c of stream.latest.components) {
        map[c.component] = c.status
      }
    }
    return map
  }, [stream.latest])

  // J: Live RPS map from stream
  const liveRpsMap = useMemo(() => {
    const map: Record<string, { rps: number; latencyMs: number }> = {}
    if (!stream.latest?.links) return map
    for (const l of stream.latest.links) {
      const key = `${l.source}-${l.target}`
      map[key] = { rps: l.rps, latencyMs: l.latencyMs }
    }
    return map
  }, [stream.latest])

  const liveRpsMapRef = useRef(liveRpsMap)
  useEffect(() => { liveRpsMapRef.current = liveRpsMap }, [liveRpsMap])

  const componentStatusMapRef = useRef(componentStatusMap)
  useEffect(() => { componentStatusMapRef.current = componentStatusMap }, [componentStatusMap])

  const litLinks = useMemo(() => new Set(SCENARIO_FLAT[scenario]), [scenario])

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

  const resolvedPaths = useMemo(() => ALL_LINKS.map((l) => buildPath(l, dragOffsets, layoutMode)), [dragOffsets, layoutMode])

  // O: Critical path highlighting
  const criticalPathLinkIds = useMemo(() => computeCriticalPath(), [])


  // Q: Breadcrumb trail
  const breadcrumbPath = useMemo(() => {
    if (!traceMode || !traceCompId) return []
    return bfsPathTo('browser', traceCompId)
  }, [traceMode, traceCompId])

  const canvasW = layoutMode === 'vertical' ? V_CANVAS_W : H_CANVAS_W
  const canvasH = layoutMode === 'vertical' ? V_CANVAS_H : H_CANVAS_H

  const setPathRef = useCallback(
    (i: number) => (el: SVGPathElement | null) => { pathRefs.current[i] = el }, [],
  )

  const connectedLinks = useMemo(() => {
    if (!hoveredComp) return new Set<string>()
    return new Set(
      ALL_LINKS.filter((l) => l.source === hoveredComp || l.target === hoveredComp).map((l) => l.id),
    )
  }, [hoveredComp])

  // B: Minimap data
  const minimapNodes = useMemo(() =>
    COMPONENTS.map((c) => {
      const r = compRect(c, dragOffsets, layoutMode)
      return { id: c.id, x: r.x, y: r.y, w: r.w, h: r.h, kindColor: kindBorder(c.kind) }
    }), [dragOffsets, layoutMode])

  const minimapLinks = useMemo(() =>
    ALL_LINKS.map((l, i) => ({
      path: resolvedPaths[i],
      color: CATEGORY_COLORS[l.category],
      active: effectiveLinks.has(l.id),
    })), [resolvedPaths, effectiveLinks])

  // D: Component preview data helpers
  const computeCompPreviewData = useCallback((compId: string) => {
    const incoming = ALL_LINKS.filter((l) => l.target === compId).map((l) => ({
      sourceLabel: COMP_MAP.get(l.source)?.label,
      rps: liveRpsMap[l.id]?.rps ?? l.rps,
      category: l.category,
    }))
    const outgoing = ALL_LINKS.filter((l) => l.source === compId).map((l) => ({
      targetLabel: COMP_MAP.get(l.target)?.label,
      rps: liveRpsMap[l.id]?.rps ?? l.rps,
      category: l.category,
    }))
    return { incoming, outgoing }
  }, [liveRpsMap])

  // I: Smooth path transitions with GSAP
  useEffect(() => {
    const prevPaths = previousPathsRef.current
    if (prevPaths.length > 0) {
      pathRefs.current.forEach((el, i) => {
        if (!el || !resolvedPaths[i]) return
        gsap.to(el, { attr: { d: resolvedPaths[i] }, duration: 0.5, ease: 'power2.inOut' })
      })
    }
    previousPathsRef.current = resolvedPaths
  }, [resolvedPaths])

  // GSAP stroke animations
  useEffect(() => {
    gsapCtxRef.current?.revert()
    gsapCtxRef.current = gsap.context(() => {
      pathRefs.current.forEach((el, i) => {
        if (!el) return
        const link = ALL_LINKS[i]
        const isLit = effectiveLinks.has(link.id)
        const liveRps = liveRpsMap[link.id]?.rps ?? link.rps
        gsap.to(el, {
          attr: { 'stroke-width': isLit ? strokeW(liveRps) : 0.4, 'stroke-opacity': isLit ? 0.28 : 0.04 },
          stroke: CATEGORY_COLORS[link.category],
          duration: 0.5, ease: 'power2.out',
        })
      })
    })
    return () => { gsapCtxRef.current?.revert() }
  }, [effectiveLinks, liveRpsMap])

  // S: Error shockwave watcher
  useEffect(() => {
    const events = stream.events
    if (!events || events.length <= prevEventsLenRef.current) {
      prevEventsLenRef.current = events?.length ?? 0
      return
    }
    const newEvents = events.slice(prevEventsLenRef.current)
    prevEventsLenRef.current = events.length
    for (const ev of newEvents) {
      const comp = COMPONENTS.find((c) => c.id === ev.panelKey || c.label === ev.panelKey)
      if (!comp) continue
      const r = compRect(comp, dragOffsets, layoutMode)
      shockwavesRef.current.push({
        x: r.x + r.w / 2,
        y: r.y + r.h / 2,
        radius: 10,
        opacity: 0.4,
        color: '#EF4444',
      })
    }
  }, [stream.events, dragOffsets, layoutMode])

  // Particle animation loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = canvasW * dpr
    canvas.height = canvasH * dpr
    canvas.style.width = `${canvasW}px`
    canvas.style.height = `${canvasH}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)

    let spawnAcc = 0

    const spawn = (li: number, isAmbient: boolean): RiverParticle => {
      const link = ALL_LINKS[li]
      const liveRps = liveRpsMapRef.current[link.id]?.rps ?? link.rps
      if (isAmbient) {
        return {
          linkIndex: li, progress: 0,
          speed: 0.003,
          color: shiftColor(CATEGORY_COLORS[link.category]),
          radius: 1.0, opacity: 0.15, trail: [],
        }
      }
      const base = Math.max(0.003, (liveRps / 120) * 0.007) * speed
      return {
        linkIndex: li, progress: 0,
        speed: base + Math.random() * 0.002,
        color: shiftColor(CATEGORY_COLORS[link.category]),
        radius: 1.8 + Math.random() * 1.2,
        opacity: 0.8 + Math.random() * 0.2,
        trail: [],
      }
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvasW, canvasH)

      spawnAcc++
      if (spawnAcc >= 2) {
        spawnAcc = 0
        ALL_LINKS.forEach((link, i) => {
          const isActive = effectiveLinks.has(link.id)
          const liveRps = liveRpsMapRef.current[link.id]?.rps ?? link.rps
          if (isActive) {
            const d = liveRps / 120
            if (Math.random() < d * 0.2 * density && particlesRef.current.length < MAX_PARTICLES) {
              particlesRef.current.push(spawn(i, false))
            }
          } else {
            if (Math.random() < 0.002 * density && particlesRef.current.length < MAX_PARTICLES) {
              particlesRef.current.push(spawn(i, true))
            }
          }
        })
      }

      particlesRef.current = particlesRef.current.filter((p) => {
        if (p.isBurst) return p.opacity > 0
        return p.progress < 1
      })

      for (const p of particlesRef.current) {
        if (p.isBurst) {
          p.burstX! += Math.cos(p.burstAngle!) * p.speed
          p.burstY! += Math.sin(p.burstAngle!) * p.speed
          p.opacity -= 0.015
          if (p.opacity <= 0) continue
          ctx.beginPath()
          ctx.arc(p.burstX!, p.burstY!, p.radius, 0, Math.PI * 2)
          ctx.fillStyle = p.color
          ctx.globalAlpha = Math.max(0, p.opacity)
          ctx.fill()
          continue
        }

        p.progress += p.speed
        const pathEl = pathRefs.current[p.linkIndex]
        if (!pathEl) continue

        const len = pathEl.getTotalLength()
        const pt = pathEl.getPointAtLength(p.progress * len)

        p.trail.push({ x: pt.x, y: pt.y })
        if (p.trail.length > TRAIL_LEN) p.trail.shift()

        for (let t = 0; t < p.trail.length - 1; t++) {
          const tp = p.trail[t]
          const frac = t / p.trail.length
          ctx.beginPath()
          ctx.arc(tp.x, tp.y, p.radius * frac * 0.7, 0, Math.PI * 2)
          ctx.fillStyle = p.color
          ctx.globalAlpha = frac * 0.5 * p.opacity
          ctx.fill()
        }

        ctx.shadowBlur = 6
        ctx.shadowColor = p.color
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = p.opacity * (1 - p.progress * 0.2)
        ctx.fill()
        ctx.shadowBlur = 0
      }

      // S: Render shockwaves
      for (let i = shockwavesRef.current.length - 1; i >= 0; i--) {
        const sw = shockwavesRef.current[i]
        sw.radius += 1.5
        sw.opacity -= 0.005
        if (sw.opacity <= 0 || sw.radius > 80) {
          shockwavesRef.current.splice(i, 1)
          continue
        }
        ctx.beginPath()
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2)
        ctx.strokeStyle = sw.color
        ctx.lineWidth = 2
        ctx.globalAlpha = sw.opacity
        ctx.stroke()
      }

      ctx.globalAlpha = 1
      setParticleCount(particlesRef.current.length)
      animFrameRef.current = requestAnimationFrame(animate)
    }

    animFrameRef.current = requestAnimationFrame(animate)
    return () => { cancelAnimationFrame(animFrameRef.current) }
  }, [effectiveLinks, speed, density, canvasW, canvasH])

  // G: Spawn burst particles on scenario change
  const spawnBurstParticles = useCallback(() => {
    const activeCompIds = new Set<string>()
    for (const lid of effectiveLinks) {
      const link = LINK_MAP.get(lid)
      if (link) {
        activeCompIds.add(link.source)
        activeCompIds.add(link.target)
      }
    }
    for (const cid of activeCompIds) {
      const comp = COMP_MAP.get(cid)
      if (!comp) continue
      const r = compRect(comp, dragOffsets, layoutMode)
      const cx = r.x + r.w / 2
      const cy = r.y + r.h / 2
      for (let i = 0; i < 20; i++) {
        particlesRef.current.push({
          linkIndex: 0, progress: 0,
          speed: 0.02 + Math.random() * 0.03,
          color: shiftColor(kindBorder(comp.kind)),
          radius: 1.5, opacity: 0.6,
          trail: [], isBurst: true,
          burstAngle: Math.random() * Math.PI * 2,
          burstX: cx, burstY: cy,
        })
      }
    }
  }, [effectiveLinks, dragOffsets, layoutMode])

  const handleScenarioChange = useCallback((s: FlowScenario) => {
    spawnBurstParticles()
    particlesRef.current = particlesRef.current.filter((p) => p.isBurst)
    setScenario(s)
    setTraceCompId(null)
  }, [spawnBurstParticles])

  const handleCompClick = useCallback((compId: string) => {
    if (traceMode) setTraceCompId((prev) => prev === compId ? null : compId)
  }, [traceMode])

  // A: Wheel zoom handler
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setZoom((prev) => Math.max(0.25, Math.min(3.0, prev + delta)))
  }, [])

  // C: Link click handler
  const handleLinkClick = useCallback((linkId: string, e: React.MouseEvent) => {
    setClickedLinkId(linkId)
    setClickPosition({ x: e.clientX, y: e.clientY })
  }, [])

  // R: Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    setFullscreen((prev) => !prev)
  }, [])

  const systemStatus = useMemo(() => {
    if (!stream.latest) return 'healthy'
    const statuses = stream.latest.components.map((c) => c.status)
    if (statuses.includes('crit')) return 'critical'
    if (statuses.includes('warn')) return 'warning'
    return 'healthy'
  }, [stream.latest])

  const statusColor = systemStatus === 'critical' ? theme.palette.error.main : systemStatus === 'warning' ? theme.palette.warning.main : theme.palette.success.main

  const diagramContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Controls */}
      <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 1.5, flexWrap: 'wrap', px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        {/* Status */}
        <ControlSection label="Status">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, height: 32 }}>
            <FiberManualRecordIcon sx={{ fontSize: 10, color: statusColor }} />
            <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.75rem' }}>
              {systemStatus === 'critical' ? 'Critical' : systemStatus === 'warning' ? 'Warning' : 'Healthy'}
            </Typography>
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.6rem', fontFamily: 'monospace' }}>
              {particleCount}p · {effectiveLinks.size}/{ALL_LINKS.length}
            </Typography>
          </Box>
        </ControlSection>

        {/* Scenario selector */}
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
            {(Object.keys(SCENARIO_LABELS) as FlowScenario[]).filter((s) => s !== 'idle').map((s) => (
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

        {/* Speed */}
        <ControlSection label="Speed">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, height: 32 }}>
            <SpeedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
            <Slider value={speed} onChange={(_, v) => setSpeed(v as number)} min={0.25} max={5} step={0.25} size="small"
              sx={{ width: 70, '& .MuiSlider-thumb': { width: 10, height: 10 }, color: '#60A5FA' }} />
            <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 600, fontFamily: 'monospace', color: 'text.secondary', minWidth: 28 }}>
              {speed}x
            </Typography>
          </Box>
        </ControlSection>

        {/* M: Density slider */}
        <ControlSection label="Density">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, height: 32 }}>
            <BubbleChartIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
            <Slider value={density} onChange={(_, v) => setDensity(v as number)} min={0.1} max={3} step={0.1} size="small"
              sx={{ width: 70, '& .MuiSlider-thumb': { width: 10, height: 10 }, color: '#34D399' }} />
            <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 600, fontFamily: 'monospace', color: 'text.secondary', minWidth: 28 }}>
              {density.toFixed(1)}x
            </Typography>
          </Box>
        </ControlSection>

        {/* Categories */}
        <ControlSection label="Categories">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, height: 32 }}>
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


        {/* View & Reset */}
        <ControlSection label="View">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, height: 32 }}>
            <Chip
              icon={fullscreen ? <FullscreenExitIcon sx={{ fontSize: 14 }} /> : <FullscreenIcon sx={{ fontSize: 14 }} />}
              label={fullscreen ? 'Exit' : 'Fullscreen'}
              size="small"
              onClick={toggleFullscreen}
              sx={{ height: 26, fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer', border: '1px solid', borderColor: 'divider' }}
            />
            {Object.keys(dragOffsets).length > 0 && (
              <Chip
                label="Reset Layout"
                size="small"
                onClick={() => {
                  setDragOffsets({})
                  try { localStorage.removeItem(LS_KEY_PREFIX + layoutMode) } catch { /* ignore */ }
                }}
                sx={{ height: 26, fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer', border: '1px solid', borderColor: 'divider' }}
              />
            )}
          </Box>
        </ControlSection>
      </Box>

      {/* Q: Breadcrumb trail */}
      {traceMode && traceCompId && breadcrumbPath.length > 1 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 2, py: 0.75, borderBottom: 1, borderColor: 'divider', flexWrap: 'wrap' }}>
          {breadcrumbPath.map((cid, idx) => {
            const comp = COMP_MAP.get(cid)
            if (!comp) return null
            return (
              <Box key={cid} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {idx > 0 && (
                  <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.7rem' }}>
                    {'\u2192'}
                  </Typography>
                )}
                <Chip
                  label={comp.label}
                  size="small"
                  onClick={() => setTraceCompId(cid)}
                  sx={{
                    height: 22, fontSize: '0.6rem', fontWeight: 600, cursor: 'pointer',
                    bgcolor: cid === traceCompId ? alpha('#A855F7', 0.2) : alpha(kindBorder(comp.kind), 0.1),
                    color: cid === traceCompId ? '#A855F7' : kindBorder(comp.kind),
                    border: '1px solid',
                    borderColor: cid === traceCompId ? alpha('#A855F7', 0.3) : 'transparent',
                  }}
                />
              </Box>
            )
          })}
        </Box>
      )}

      {/* Diagram */}
      <Box
        ref={scrollContainerRef}
        onWheel={handleWheel}
        sx={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', pt: 1 }}
      >
        <Box sx={{
          position: 'relative', width: canvasW, height: canvasH, flexShrink: 0,
          transform: `scale(${zoom})`, transformOrigin: 'top left',
        }}>
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
          <svg ref={svgRef} viewBox={`0 0 ${canvasW} ${canvasH}`} width={canvasW} height={canvasH} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
            <defs>
              {ALL_LINKS.map((link) => (
                <marker key={`a-${link.id}`} id={`a-${link.id}`} markerWidth="5" markerHeight="4" refX="4" refY="2" orient="auto">
                  <path d="M0,0.5 L5,2 L0,3.5" fill={CATEGORY_COLORS[link.category]} fillOpacity={0.45} />
                </marker>
              ))}
              <filter id="glow-critical">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {ALL_LINKS.map((link, i) => {
              const isLit = effectiveLinks.has(link.id)
              const isHigh = hoveredLinkId === link.id || connectedLinks.has(link.id)
              const isCritical = criticalPathLinkIds.has(link.id)
              return (
                <g key={link.id}>
                  {/* O: Critical path glow underlay */}
                  {isCritical && isLit && (
                    <path d={resolvedPaths[i]} fill="none"
                      stroke={CATEGORY_COLORS[link.category]}
                      strokeWidth={strokeW(link.rps) + 4}
                      strokeOpacity={0.15}
                      filter="url(#glow-critical)"
                      strokeLinecap="round" />
                  )}
                  <path ref={setPathRef(i)} d={resolvedPaths[i]} fill="none"
                    stroke={CATEGORY_COLORS[link.category]}
                    strokeWidth={isLit ? strokeW(link.rps) : 0.4}
                    strokeOpacity={isHigh ? 0.5 : isLit ? 0.28 : 0.04}
                    strokeLinecap="round" markerEnd={isLit ? `url(#a-${link.id})` : undefined}
                    style={{ transition: 'stroke-opacity 200ms' }} />
                  {/* C: Invisible hit-area path with click handler */}
                  <path d={resolvedPaths[i]} fill="none" stroke="transparent" strokeWidth={14}
                    style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredLinkId(link.id)}
                    onMouseLeave={() => setHoveredLinkId(null)}
                    onClick={(e) => handleLinkClick(link.id, e)} />
                </g>
              )
            })}
          </svg>

          {/* Canvas particles */}
          <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: canvasW, height: canvasH, pointerEvents: 'none' }} />

          {/* Component boxes */}
          {COMPONENTS.map((comp, ci) => {
            const r = compRect(comp, dragOffsets, layoutMode)
            const isDragging = dragRef.current?.id === comp.id
            const isConn = !hoveredComp || hoveredComp === comp.id ||
              ALL_LINKS.some((l) => (l.source === hoveredComp && l.target === comp.id) || (l.target === hoveredComp && l.source === comp.id))
            const isTrace = traceMode && traceCompId === comp.id
            const compStatus = componentStatusMap[comp.id]
            const hasWarn = compStatus === 'warn' || compStatus === 'crit'
            const liveComp = stream.latest?.components.find((c) => c.component === comp.id)

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
                onClick={() => handleCompClick(comp.id)}
                onDoubleClick={() => router.push(`/observability/${comp.id}`)}>
                <Box sx={{
                  width: '100%', height: '100%', bgcolor: kindBg(comp.kind, isDark),
                  border: '1.5px solid', borderColor: hasWarn ? (compStatus === 'crit' ? '#EF4444' : '#F59E0B') : isTrace ? '#A855F7' : kindBorder(comp.kind),
                  borderRadius: 1.5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: 0.8,
                  cursor: traceMode ? 'crosshair' : isDragging ? 'grabbing' : 'grab',
                  opacity: isConn ? 1 : 0.25, transition: isDragging ? 'box-shadow 100ms' : 'opacity 200ms, box-shadow 200ms, border-color 200ms',
                  boxShadow: isDragging ? '0 4px 20px rgba(0,0,0,0.3)' : hoveredComp === comp.id ? `0 0 14px ${kindBorder(comp.kind)}50` : hasWarn ? `0 0 8px rgba(239,68,68,0.3)` : isTrace ? '0 0 8px rgba(168,85,247,0.4)' : 'none',
                  userSelect: 'none', position: 'relative',
                }}>
                  {/* K: Status indicator badge */}
                  <Box sx={{
                    position: 'absolute', top: 6, right: 6,
                    width: 8, height: 8, borderRadius: '50%',
                    bgcolor: statusIndicatorColor(compStatus),
                    boxShadow: `0 0 3px ${statusIndicatorColor(compStatus)}`,
                    ...(compStatus === 'crit' && {
                      animation: 'pulse-status 1.2s ease-in-out infinite',
                      '@keyframes pulse-status': {
                        '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                        '50%': { opacity: 0.5, transform: 'scale(1.5)' },
                      },
                    }),
                  }} />

                  <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 700, fontSize: '0.68rem', lineHeight: 1.2, textAlign: 'center', pointerEvents: 'none' }}>
                    {comp.label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.5rem', lineHeight: 1.2, textAlign: 'center', pointerEvents: 'none' }}>
                    {comp.sublabel}
                  </Typography>

                  {/* L: Live throughput counter */}
                  {liveComp?.rpsIn != null && (
                    <Typography variant="caption" sx={{
                      fontSize: '8px', fontFamily: 'monospace', fontWeight: 600,
                      color: kindBorder(comp.kind), lineHeight: 1, mt: 0.2,
                      pointerEvents: 'none',
                    }}>
                      {formatReqS(liveComp.rpsIn)}
                    </Typography>
                  )}
                </Box>
              </motion.div>
            )
          })}

          {/* Link tooltip */}
          <AnimatePresence>
            {hoveredLinkId && (() => {
              const link = LINK_MAP.get(hoveredLinkId)
              if (!link) return null
              const src = COMP_MAP.get(link.source)
              const tgt = COMP_MAP.get(link.target)
              if (!src || !tgt) return null
              const sp = layoutMode === 'vertical' ? link.sourcePort : link.hSourcePort
              const tp = layoutMode === 'vertical' ? link.targetPort : link.hTargetPort
              const s = portPoint(src, sp, dragOffsets, layoutMode)
              const t = portPoint(tgt, tp, dragOffsets, layoutMode)
              const mx = (s.x + t.x) / 2
              const my = Math.min(s.y, t.y) - 14

              return (
                <motion.div key="link-tip" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.1 }}
                  style={{ position: 'absolute', left: mx, top: my, transform: 'translate(-50%, -100%)', zIndex: 20, pointerEvents: 'none' }}>
                  <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, px: 1.5, py: 1, minWidth: 220, maxWidth: 380, boxShadow: 6 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.3 }}>
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: CATEGORY_COLORS[link.category] }} />
                      <Typography variant="caption" fontWeight={700} color="text.primary" sx={{ fontSize: '0.68rem' }}>
                        {src.label} {'\u2192'} {tgt.label}
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
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.52rem' }}>{liveRpsMap[link.id]?.rps ?? link.rps} RPS</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.52rem' }}>{liveRpsMap[link.id]?.latencyMs ?? link.latencyMs}ms</Typography>
                    </Box>
                  </Box>
                </motion.div>
              )
            })()}
          </AnimatePresence>

          {/* D: Component preview (replaces old inline tooltip) */}
          <AnimatePresence>
            {hoveredComp && !hoveredLinkId && (() => {
              const comp = COMP_MAP.get(hoveredComp)
              if (!comp) return null
              const r = compRect(comp, dragOffsets, layoutMode)
              const above = r.y > 180
              const tx = r.x + r.w / 2
              const ty = above ? r.y - 8 : r.y + r.h + 8
              const liveMetrics = stream.latest?.components.find((c) => c.component === hoveredComp)
              const limits = stream.runtimeConfig?.components[hoveredComp]
              const { incoming, outgoing } = computeCompPreviewData(hoveredComp)

              return (
                <RiversComponentPreview
                  key="comp-preview"
                  component={{ id: comp.id, label: comp.label, sublabel: comp.sublabel, kind: comp.kind, goFile: comp.goFile }}
                  position={{ x: tx, y: ty, above }}
                  liveMetrics={liveMetrics}
                  limits={limits}
                  incomingLinks={incoming}
                  outgoingLinks={outgoing}
                />
              )
            })()}
          </AnimatePresence>

          {/* C: Link click popover */}
          {clickedLinkId && (() => {
            const link = LINK_MAP.get(clickedLinkId)
            if (!link) return null
            const src = COMP_MAP.get(link.source)
            const tgt = COMP_MAP.get(link.target)
            if (!src || !tgt) return null
            const live = liveRpsMap[link.id]

            return (
              <RiversLinkPopover
                link={link}
                sourceLabel={src.label}
                targetLabel={tgt.label}
                position={clickPosition}
                onClose={() => setClickedLinkId(null)}
                onTrace={(sourceId) => {
                  setTraceMode(true)
                  setTraceCompId(sourceId)
                  setClickedLinkId(null)
                }}
                liveRps={live?.rps}
                liveLatencyMs={live?.latencyMs}
              />
            )
          })()}

          {/* A: Zoom controls */}
          <ZoomControls zoom={zoom} onZoomChange={setZoom} onReset={() => setZoom(1)} />

          {/* B: Minimap */}
          <RiversMinimap
            canvasWidth={canvasW}
            canvasHeight={canvasH}
            scrollRef={scrollContainerRef}
            nodes={minimapNodes}
            links={minimapLinks}
          />
        </Box>
      </Box>
    </Box>
  )

  // R: Fullscreen wrapper
  if (fullscreen) {
    return (
      <Box sx={{
        position: 'fixed', inset: 0, zIndex: 9999,
        bgcolor: 'background.default',
        display: 'flex', flexDirection: 'column',
      }}>
        {diagramContent}
      </Box>
    )
  }

  return diagramContent
}
