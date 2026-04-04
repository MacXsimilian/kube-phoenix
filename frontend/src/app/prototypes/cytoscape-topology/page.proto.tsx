'use client'

// PROTOTYPE: Cytoscape Topology Pro
// DEPS: framer-motion gsap
// LIBS: Custom Graph Rendering, Framer Motion, GSAP, Canvas 2D
// DATA: Namespaces, deployments, pods, service connections
// DESCRIPTION: Production-grade 2D cluster graph with compound nodes and live updates

import { useState, useEffect, useRef, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Chip from '@mui/material/Chip'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import ReplayIcon from '@mui/icons-material/Replay'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import GridViewIcon from '@mui/icons-material/GridView'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import { useTheme } from '@mui/material/styles'
import gsap from 'gsap'

// ─── Types ──────────────────────────────────────────────────────────────────

type PodStatus = 'running' | 'pending' | 'failed' | 'sleeping'
type LayoutMode = 'grid' | 'tree'

interface PodData {
  id: string
  name: string
  status: PodStatus
  cpu: number
  memory: number
}

interface DeploymentData {
  id: string
  name: string
  pods: PodData[]
  rps: number
  status: PodStatus
}

interface NamespaceData {
  id: string
  name: string
  color: string
  deployments: DeploymentData[]
  collapsed: boolean
  sleeping: boolean
  opacity: number
  x: number
  y: number
  width: number
  height: number
}

interface EdgeData {
  id: string
  sourceDeployment: string
  targetDeployment: string
  rps: number
  sourceNamespace: string
  targetNamespace: string
}

interface HoveredNode {
  type: 'namespace' | 'deployment' | 'pod'
  id: string
  x: number
  y: number
  data: NamespaceData | DeploymentData | PodData
}

interface DragState {
  active: boolean
  nodeId: string | null
  offsetX: number
  offsetY: number
  hasDragged: boolean
}

interface Camera {
  x: number
  y: number
  zoom: number
}

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<PodStatus, string> = {
  running: '#22C55E',
  pending: '#F59E0B',
  failed: '#EF4444',
  sleeping: '#6B7280',
}

const POD_RADIUS = 6
const DEPLOY_PADDING = 12
const NS_PADDING = 16
const NS_HEADER = 32
const DEPLOY_HEADER = 24
const POD_SPACING = 18
const DEPLOY_GAP = 12
const NS_GAP = 24

// ─── Mock Data ──────────────────────────────────────────────────────────────

function randomSuffix(): string {
  return Math.random().toString(36).substring(2, 7)
}

function createPods(count: number, status: PodStatus = 'running'): PodData[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `pod-${randomSuffix()}`,
    name: `pod-${randomSuffix()}`,
    status,
    cpu: Math.floor(Math.random() * 60 + 15),
    memory: Math.floor(Math.random() * 50 + 20),
  }))
}

function createInitialNamespaces(): NamespaceData[] {
  return [
    {
      id: 'ns-production', name: 'production', color: '#3B82F6',
      collapsed: false, sleeping: false, opacity: 1, x: 0, y: 0, width: 0, height: 0,
      deployments: [
        { id: 'dep-api-gateway', name: 'api-gateway', pods: createPods(8), rps: 2400, status: 'running' },
        { id: 'dep-redis-sentinel', name: 'redis-sentinel', pods: createPods(3), rps: 0, status: 'running' },
      ],
    },
    {
      id: 'ns-payments', name: 'payments', color: '#A855F7',
      collapsed: false, sleeping: false, opacity: 1, x: 0, y: 0, width: 0, height: 0,
      deployments: [
        { id: 'dep-checkout-service', name: 'checkout-service', pods: createPods(4), rps: 400, status: 'running' },
        { id: 'dep-payment-processor', name: 'payment-processor', pods: createPods(3), rps: 350, status: 'running' },
      ],
    },
    {
      id: 'ns-auth-service', name: 'auth-service', color: '#EC4899',
      collapsed: false, sleeping: false, opacity: 1, x: 0, y: 0, width: 0, height: 0,
      deployments: [
        { id: 'dep-user-auth', name: 'user-auth', pods: createPods(6), rps: 800, status: 'running' },
        { id: 'dep-session-manager', name: 'session-manager', pods: createPods(2), rps: 120, status: 'running' },
      ],
    },
    {
      id: 'ns-data-pipeline', name: 'data-pipeline', color: '#14B8A6',
      collapsed: false, sleeping: false, opacity: 1, x: 0, y: 0, width: 0, height: 0,
      deployments: [
        { id: 'dep-kafka-consumer', name: 'kafka-consumer', pods: createPods(5), rps: 200, status: 'running' },
      ],
    },
    {
      id: 'ns-ml-training', name: 'ml-training', color: '#F97316',
      collapsed: false, sleeping: false, opacity: 1, x: 0, y: 0, width: 0, height: 0,
      deployments: [
        { id: 'dep-spark-driver', name: 'spark-driver', pods: createPods(2), rps: 0, status: 'running' },
        { id: 'dep-feature-store', name: 'feature-store', pods: createPods(4), rps: 60, status: 'running' },
      ],
    },
    {
      id: 'ns-internal-tools', name: 'internal-tools', color: '#EAB308',
      collapsed: false, sleeping: false, opacity: 1, x: 0, y: 0, width: 0, height: 0,
      deployments: [
        { id: 'dep-admin-portal', name: 'admin-portal', pods: createPods(3), rps: 50, status: 'running' },
      ],
    },
    {
      id: 'ns-staging', name: 'staging', color: '#06B6D4',
      collapsed: false, sleeping: false, opacity: 1, x: 0, y: 0, width: 0, height: 0,
      deployments: [
        { id: 'dep-staging-api', name: 'staging-api', pods: createPods(6), rps: 180, status: 'pending' },
      ],
    },
    {
      id: 'ns-monitoring', name: 'monitoring', color: '#8B5CF6',
      collapsed: false, sleeping: false, opacity: 1, x: 0, y: 0, width: 0, height: 0,
      deployments: [
        { id: 'dep-grafana', name: 'grafana', pods: createPods(2), rps: 30, status: 'running' },
        { id: 'dep-prometheus', name: 'prometheus', pods: createPods(1), rps: 0, status: 'running' },
      ],
    },
    {
      id: 'ns-dev-sandbox', name: 'dev-sandbox', color: '#78716C',
      collapsed: false, sleeping: false, opacity: 1, x: 0, y: 0, width: 0, height: 0,
      deployments: [
        { id: 'dep-dev-api', name: 'dev-api', pods: createPods(2), rps: 10, status: 'running' },
      ],
    },
  ]
}

function createEdges(): EdgeData[] {
  return [
    { id: 'e-1', sourceDeployment: 'dep-api-gateway', targetDeployment: 'dep-user-auth', rps: 800, sourceNamespace: 'ns-production', targetNamespace: 'ns-auth-service' },
    { id: 'e-2', sourceDeployment: 'dep-api-gateway', targetDeployment: 'dep-checkout-service', rps: 400, sourceNamespace: 'ns-production', targetNamespace: 'ns-payments' },
    { id: 'e-3', sourceDeployment: 'dep-checkout-service', targetDeployment: 'dep-payment-processor', rps: 350, sourceNamespace: 'ns-payments', targetNamespace: 'ns-payments' },
    { id: 'e-4', sourceDeployment: 'dep-api-gateway', targetDeployment: 'dep-kafka-consumer', rps: 200, sourceNamespace: 'ns-production', targetNamespace: 'ns-data-pipeline' },
    { id: 'e-5', sourceDeployment: 'dep-api-gateway', targetDeployment: 'dep-redis-sentinel', rps: 1200, sourceNamespace: 'ns-production', targetNamespace: 'ns-production' },
    { id: 'e-6', sourceDeployment: 'dep-user-auth', targetDeployment: 'dep-session-manager', rps: 600, sourceNamespace: 'ns-auth-service', targetNamespace: 'ns-auth-service' },
    { id: 'e-7', sourceDeployment: 'dep-kafka-consumer', targetDeployment: 'dep-spark-driver', rps: 150, sourceNamespace: 'ns-data-pipeline', targetNamespace: 'ns-ml-training' },
    { id: 'e-8', sourceDeployment: 'dep-spark-driver', targetDeployment: 'dep-feature-store', rps: 100, sourceNamespace: 'ns-ml-training', targetNamespace: 'ns-ml-training' },
    { id: 'e-9', sourceDeployment: 'dep-api-gateway', targetDeployment: 'dep-staging-api', rps: 80, sourceNamespace: 'ns-production', targetNamespace: 'ns-staging' },
    { id: 'e-10', sourceDeployment: 'dep-api-gateway', targetDeployment: 'dep-admin-portal', rps: 50, sourceNamespace: 'ns-production', targetNamespace: 'ns-internal-tools' },
    { id: 'e-11', sourceDeployment: 'dep-grafana', targetDeployment: 'dep-prometheus', rps: 30, sourceNamespace: 'ns-monitoring', targetNamespace: 'ns-monitoring' },
  ]
}

// ─── Layout Engine ──────────────────────────────────────────────────────────

function calculateDeploymentSize(dep: DeploymentData, collapsed: boolean): { w: number; h: number } {
  if (collapsed) return { w: 0, h: 0 }
  const podCols = Math.min(dep.pods.length, 6)
  const podRows = Math.ceil(dep.pods.length / 6)
  const w = Math.max(podCols * POD_SPACING + DEPLOY_PADDING * 2, 80)
  const h = podRows * POD_SPACING + DEPLOY_HEADER + DEPLOY_PADDING
  return { w, h }
}

function layoutNamespaces(namespaces: NamespaceData[], mode: LayoutMode): NamespaceData[] {
  const cols = mode === 'grid' ? 3 : 2
  const startX = 60
  const startY = 60

  const colWidths: number[] = Array(cols).fill(0)
  const rowHeights: number[] = []

  const measured = namespaces.map((ns) => {
    let contentWidth = 0
    let contentHeight = 0

    if (!ns.collapsed) {
      let depX = NS_PADDING
      let depRowHeight = 0
      let depRowWidth = 0
      const deployWidths: number[] = []
      const deployHeights: number[] = []

      for (const dep of ns.deployments) {
        const size = calculateDeploymentSize(dep, ns.collapsed)
        deployWidths.push(size.w)
        deployHeights.push(size.h)
      }

      const depCols = Math.min(ns.deployments.length, 2)
      const rows: number[][] = []
      let currentRow: number[] = []
      for (let i = 0; i < ns.deployments.length; i++) {
        currentRow.push(i)
        if (currentRow.length >= depCols) {
          rows.push(currentRow)
          currentRow = []
        }
      }
      if (currentRow.length > 0) rows.push(currentRow)

      for (const row of rows) {
        let rowW = 0
        let rowH = 0
        for (const idx of row) {
          rowW += deployWidths[idx] + DEPLOY_GAP
          rowH = Math.max(rowH, deployHeights[idx])
        }
        contentWidth = Math.max(contentWidth, rowW - DEPLOY_GAP)
        contentHeight += rowH + DEPLOY_GAP
      }
      contentHeight -= DEPLOY_GAP
    }

    const nsW = Math.max(contentWidth + NS_PADDING * 2, 140)
    const nsH = ns.collapsed ? NS_HEADER + 8 : contentHeight + NS_HEADER + NS_PADDING * 2

    return { ns, width: nsW, height: nsH }
  })

  const positions: { x: number; y: number }[] = []
  let row = 0
  let col = 0
  let maxRowHeight = 0

  for (const item of measured) {
    if (col >= cols) {
      row++
      col = 0
    }
    positions.push({ x: col, y: row })
    colWidths[col] = Math.max(colWidths[col] || 0, item.width)
    if (!rowHeights[row]) rowHeights[row] = 0
    rowHeights[row] = Math.max(rowHeights[row], item.height)
    col++
  }

  return measured.map((item, i) => {
    const pos = positions[i]
    let px = startX
    for (let c = 0; c < pos.x; c++) {
      px += (colWidths[c] || 0) + NS_GAP
    }
    let py = startY
    for (let r = 0; r < pos.y; r++) {
      py += (rowHeights[r] || 0) + NS_GAP
    }

    return {
      ...item.ns,
      x: px,
      y: py,
      width: item.width,
      height: item.height,
    }
  })
}

function getDeploymentRect(
  ns: NamespaceData,
  depIndex: number
): { x: number; y: number; w: number; h: number } {
  if (ns.collapsed) return { x: ns.x, y: ns.y, w: 0, h: 0 }

  const depCols = Math.min(ns.deployments.length, 2)
  const row = Math.floor(depIndex / depCols)
  const col = depIndex % depCols

  let yOffset = ns.y + NS_HEADER + NS_PADDING
  for (let r = 0; r < row; r++) {
    let maxH = 0
    for (let c = 0; c < depCols; c++) {
      const idx = r * depCols + c
      if (idx < ns.deployments.length) {
        const size = calculateDeploymentSize(ns.deployments[idx], ns.collapsed)
        maxH = Math.max(maxH, size.h)
      }
    }
    yOffset += maxH + DEPLOY_GAP
  }

  let xOffset = ns.x + NS_PADDING
  for (let c = 0; c < col; c++) {
    const idx = row * depCols + c
    if (idx < ns.deployments.length) {
      const size = calculateDeploymentSize(ns.deployments[idx], ns.collapsed)
      xOffset += size.w + DEPLOY_GAP
    }
  }

  const dep = ns.deployments[depIndex]
  const size = calculateDeploymentSize(dep, ns.collapsed)
  return { x: xOffset, y: yOffset, w: size.w, h: size.h }
}

function getDeploymentCenter(namespaces: NamespaceData[], depId: string): { x: number; y: number } | null {
  for (const ns of namespaces) {
    for (let i = 0; i < ns.deployments.length; i++) {
      if (ns.deployments[i].id === depId) {
        const rect = getDeploymentRect(ns, i)
        return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }
      }
    }
  }
  return null
}

// ─── Canvas Renderer ────────────────────────────────────────────────────────

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  r: number
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawMoonIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.beginPath()
  ctx.arc(cx, cy, size, 0, Math.PI * 2)
  ctx.fillStyle = '#6B7280'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx + size * 0.35, cy - size * 0.2, size * 0.75, 0, Math.PI * 2)
  ctx.fillStyle = ctx.canvas.dataset.bg || '#1E1E2E'
  ctx.fill()
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  width: number,
  color: string,
  alpha: number
) {
  const headLen = 8
  const midX = (x1 + x2) / 2

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.setLineDash([])

  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.quadraticCurveTo(midX, y1, x2, y2)
  ctx.stroke()

  const arrowX = (x1 + 3 * x2) / 4
  const arrowY = (y1 + 3 * y2) / 4
  const endAngle = Math.atan2(y2 - y1, x2 - midX)

  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(arrowX, arrowY)
  ctx.lineTo(arrowX - headLen * Math.cos(endAngle - 0.4), arrowY - headLen * Math.sin(endAngle - 0.4))
  ctx.lineTo(arrowX - headLen * Math.cos(endAngle + 0.4), arrowY - headLen * Math.sin(endAngle + 0.4))
  ctx.closePath()
  ctx.fill()

  ctx.restore()
}

function renderGraph(
  ctx: CanvasRenderingContext2D,
  namespaces: NamespaceData[],
  edges: EdgeData[],
  camera: Camera,
  hoveredNode: HoveredNode | null,
  isDark: boolean,
  animPhase: number
) {
  const { width, height } = ctx.canvas
  const bg = isDark ? '#121212' : '#FAFAFA'
  ctx.canvas.dataset.bg = bg

  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)

  // Grid dots
  ctx.save()
  ctx.translate(camera.x, camera.y)
  ctx.scale(camera.zoom, camera.zoom)

  const gridStep = 40
  const gridColor = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'
  ctx.fillStyle = gridColor
  const startGX = Math.floor(-camera.x / camera.zoom / gridStep) * gridStep - gridStep
  const startGY = Math.floor(-camera.y / camera.zoom / gridStep) * gridStep - gridStep
  const endGX = startGX + width / camera.zoom + gridStep * 2
  const endGY = startGY + height / camera.zoom + gridStep * 2
  for (let gx = startGX; gx < endGX; gx += gridStep) {
    for (let gy = startGY; gy < endGY; gy += gridStep) {
      ctx.fillRect(gx, gy, 1.5, 1.5)
    }
  }

  // Edges
  for (const edge of edges) {
    const srcCenter = getDeploymentCenter(namespaces, edge.sourceDeployment)
    const tgtCenter = getDeploymentCenter(namespaces, edge.targetDeployment)
    if (!srcCenter || !tgtCenter) continue

    const srcNs = namespaces.find(n => n.id === edge.sourceNamespace)
    const tgtNs = namespaces.find(n => n.id === edge.targetNamespace)
    if (!srcNs || !tgtNs) continue

    const alpha = Math.min(srcNs.opacity, tgtNs.opacity) * 0.6
    if (alpha < 0.01) continue

    const rpsNorm = Math.min(edge.rps / 1000, 1)
    const edgeWidth = 1 + rpsNorm * 3
    const edgeColor = isDark ? `rgba(100,180,255,${0.3 + rpsNorm * 0.4})` : `rgba(40,100,200,${0.3 + rpsNorm * 0.4})`

    drawArrow(ctx, srcCenter.x, srcCenter.y, tgtCenter.x, tgtCenter.y, edgeWidth, edgeColor, alpha)
  }

  // Namespaces
  for (const ns of namespaces) {
    if (ns.opacity < 0.01) continue

    ctx.save()
    ctx.globalAlpha = ns.opacity

    const isHovered = hoveredNode?.type === 'namespace' && hoveredNode.id === ns.id
    const borderColor = ns.sleeping ? STATUS_COLORS.sleeping : ns.color
    const fillColor = isDark
      ? `rgba(${hexToRgb(ns.color)}, 0.06)`
      : `rgba(${hexToRgb(ns.color)}, 0.04)`

    drawRoundedRect(ctx, ns.x, ns.y, ns.width, ns.height, 12)
    ctx.fillStyle = fillColor
    ctx.fill()
    ctx.strokeStyle = borderColor
    ctx.lineWidth = isHovered ? 2.5 : 1.5
    ctx.setLineDash(ns.sleeping ? [6, 4] : [])
    ctx.stroke()
    ctx.setLineDash([])

    // Header
    ctx.fillStyle = isDark ? '#E0E0E0' : '#333333'
    ctx.font = 'bold 13px Inter, system-ui, sans-serif'
    ctx.fillText(ns.name, ns.x + NS_PADDING, ns.y + 22)

    // Pod count chip
    const totalPods = ns.deployments.reduce((s, d) => s + d.pods.length, 0)
    const chipText = ns.collapsed ? `${totalPods} pods` : `${ns.deployments.length} deploys`
    const chipW = ctx.measureText(chipText).width + 16
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
    drawRoundedRect(ctx, ns.x + ns.width - chipW - NS_PADDING, ns.y + 10, chipW, 20, 10)
    ctx.fill()
    ctx.fillStyle = isDark ? '#AAA' : '#666'
    ctx.font = '11px Inter, system-ui, sans-serif'
    ctx.fillText(chipText, ns.x + ns.width - chipW - NS_PADDING + 8, ns.y + 24)

    // Sleeping moon icon
    if (ns.sleeping) {
      drawMoonIcon(ctx, ns.x + ns.width - 20, ns.y + 20, 7)
    }

    // Deployments (only if not collapsed)
    if (!ns.collapsed) {
      for (let di = 0; di < ns.deployments.length; di++) {
        const dep = ns.deployments[di]
        const rect = getDeploymentRect(ns, di)
        const depHovered = hoveredNode?.type === 'deployment' && hoveredNode.id === dep.id
        const depColor = ns.sleeping ? STATUS_COLORS.sleeping : STATUS_COLORS[dep.status]

        drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 6)
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
        ctx.fill()
        ctx.strokeStyle = depColor
        ctx.lineWidth = depHovered ? 2 : 1
        ctx.stroke()

        // Deploy name
        ctx.fillStyle = isDark ? '#CCC' : '#444'
        ctx.font = '11px Inter, system-ui, sans-serif'
        ctx.fillText(dep.name, rect.x + 8, rect.y + 16)

        // Pods
        for (let pi = 0; pi < dep.pods.length; pi++) {
          const pod = dep.pods[pi]
          const pRow = Math.floor(pi / 6)
          const pCol = pi % 6
          const px = rect.x + DEPLOY_PADDING + pCol * POD_SPACING + POD_RADIUS
          const py = rect.y + DEPLOY_HEADER + pRow * POD_SPACING + POD_RADIUS

          const podColor = ns.sleeping ? STATUS_COLORS.sleeping : STATUS_COLORS[pod.status]
          const podHovered = hoveredNode?.type === 'pod' && hoveredNode.id === pod.id

          // Glow for running pods
          if (pod.status === 'running' && !ns.sleeping) {
            const glowAlpha = 0.15 + Math.sin(animPhase + pi * 0.5) * 0.08
            ctx.beginPath()
            ctx.arc(px, py, POD_RADIUS + 3, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(${hexToRgb(podColor)}, ${glowAlpha})`
            ctx.fill()
          }

          ctx.beginPath()
          ctx.arc(px, py, podHovered ? POD_RADIUS + 2 : POD_RADIUS, 0, Math.PI * 2)
          ctx.fillStyle = podColor
          ctx.fill()

          if (podHovered) {
            ctx.strokeStyle = isDark ? '#FFF' : '#000'
            ctx.lineWidth = 1.5
            ctx.stroke()
          }
        }
      }
    }

    ctx.restore()
  }

  ctx.restore()
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return '128,128,128'
  return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`
}

function screenToWorld(sx: number, sy: number, camera: Camera): { x: number; y: number } {
  return {
    x: (sx - camera.x) / camera.zoom,
    y: (sy - camera.y) / camera.zoom,
  }
}

// ─── Hit Testing ────────────────────────────────────────────────────────────

function hitTest(
  wx: number, wy: number,
  namespaces: NamespaceData[]
): HoveredNode | null {
  // Check pods first (smallest), then deployments, then namespaces
  for (const ns of namespaces) {
    if (ns.opacity < 0.1) continue
    if (!ns.collapsed) {
      for (let di = 0; di < ns.deployments.length; di++) {
        const dep = ns.deployments[di]
        const rect = getDeploymentRect(ns, di)

        for (let pi = 0; pi < dep.pods.length; pi++) {
          const pod = dep.pods[pi]
          const pCol = pi % 6
          const pRow = Math.floor(pi / 6)
          const px = rect.x + DEPLOY_PADDING + pCol * POD_SPACING + POD_RADIUS
          const py = rect.y + DEPLOY_HEADER + pRow * POD_SPACING + POD_RADIUS
          const dist = Math.sqrt((wx - px) ** 2 + (wy - py) ** 2)
          if (dist <= POD_RADIUS + 4) {
            return { type: 'pod', id: pod.id, x: px, y: py, data: pod }
          }
        }

        if (wx >= rect.x && wx <= rect.x + rect.w && wy >= rect.y && wy <= rect.y + rect.h) {
          return { type: 'deployment', id: dep.id, x: rect.x + rect.w / 2, y: rect.y, data: dep }
        }
      }
    }

    if (wx >= ns.x && wx <= ns.x + ns.width && wy >= ns.y && wy <= ns.y + ns.height) {
      return { type: 'namespace', id: ns.id, x: ns.x + ns.width / 2, y: ns.y, data: ns }
    }
  }

  return null
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function CytoscapeTopologyPrototype() {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)
  const animPhaseRef = useRef(0)

  const [namespaces, setNamespaces] = useState<NamespaceData[]>(() =>
    layoutNamespaces(createInitialNamespaces(), 'grid')
  )
  const [edges] = useState<EdgeData[]>(createEdges)
  const [camera, setCamera] = useState<Camera>({ x: 20, y: 20, zoom: 1 })
  const [hoveredNode, setHoveredNode] = useState<HoveredNode | null>(null)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('grid')
  const dragRef = useRef<DragState>({ active: false, nodeId: null, offsetX: 0, offsetY: 0, hasDragged: false })
  const didDragRef = useRef(false)
  const panRef = useRef<{ active: boolean; startX: number; startY: number; camX: number; camY: number }>({
    active: false, startX: 0, startY: 0, camX: 0, camY: 0,
  })
  const cameraRef = useRef(camera)
  cameraRef.current = camera
  const namespacesRef = useRef(namespaces)
  namespacesRef.current = namespaces

  // Tooltip state
  const [tooltipInfo, setTooltipInfo] = useState<{
    show: boolean
    x: number
    y: number
    content: string[]
  }>({ show: false, x: 0, y: 0, content: [] })

  // Relayout when mode changes
  useEffect(() => {
    setNamespaces(prev => layoutNamespaces(prev, layoutMode))
  }, [layoutMode])

  // Canvas rendering loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.scale(dpr, dpr)
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    let lastTime = 0
    const loop = (time: number) => {
      const dt = (time - lastTime) / 1000
      lastTime = time

      if (playing) {
        animPhaseRef.current += dt * speed * 2
      }

      renderGraph(
        ctx,
        namespacesRef.current,
        edges,
        cameraRef.current,
        hoveredNode,
        isDark,
        animPhaseRef.current
      )

      animFrameRef.current = requestAnimationFrame(loop)
    }
    animFrameRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [playing, speed, isDark, edges, hoveredNode])

  // Mouse handlers
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top

    if (panRef.current.active) {
      const dx = sx - panRef.current.startX
      const dy = sy - panRef.current.startY
      setCamera(prev => ({
        ...prev,
        x: panRef.current.camX + dx,
        y: panRef.current.camY + dy,
      }))
      return
    }

    if (dragRef.current.active && dragRef.current.nodeId) {
      const world = screenToWorld(sx, sy, cameraRef.current)
      dragRef.current.hasDragged = true
      setNamespaces(prev =>
        prev.map(ns =>
          ns.id === dragRef.current.nodeId
            ? { ...ns, x: world.x - dragRef.current.offsetX, y: world.y - dragRef.current.offsetY }
            : ns
        )
      )
      return
    }

    const world = screenToWorld(sx, sy, cameraRef.current)
    const hit = hitTest(world.x, world.y, namespacesRef.current)
    setHoveredNode(hit)

    if (hit) {
      const content = buildTooltipContent(hit)
      setTooltipInfo({ show: true, x: e.clientX, y: e.clientY - 12, content })
    } else {
      setTooltipInfo(prev => (prev.show ? { ...prev, show: false } : prev))
    }
  }, [layoutMode])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const world = screenToWorld(sx, sy, cameraRef.current)

    const hit = hitTest(world.x, world.y, namespacesRef.current)

    if (hit?.type === 'namespace') {
      dragRef.current = {
        active: true,
        nodeId: hit.id,
        offsetX: world.x - (hit.data as NamespaceData).x,
        offsetY: world.y - (hit.data as NamespaceData).y,
        hasDragged: false,
      }
      return
    }

    // Pan
    panRef.current = { active: true, startX: sx, startY: sy, camX: cameraRef.current.x, camY: cameraRef.current.y }
  }, [])

  const handleMouseUp = useCallback(() => {
    didDragRef.current = dragRef.current.hasDragged || panRef.current.active
    dragRef.current = { active: false, nodeId: null, offsetX: 0, offsetY: 0, hasDragged: false }
    panRef.current = { ...panRef.current, active: false }
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top

    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92
    setCamera(prev => {
      const newZoom = Math.max(0.2, Math.min(3, prev.zoom * zoomFactor))
      const worldX = (sx - prev.x) / prev.zoom
      const worldY = (sy - prev.y) / prev.zoom
      return {
        zoom: newZoom,
        x: sx - worldX * newZoom,
        y: sy - worldY * newZoom,
      }
    })
  }, [])

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (didDragRef.current) {
      didDragRef.current = false
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const world = screenToWorld(sx, sy, cameraRef.current)

    const hit = hitTest(world.x, world.y, namespacesRef.current)
    if (hit?.type === 'namespace') {
      toggleCollapse(hit.id)
    }
  }, [])

  // Actions
  const toggleCollapse = useCallback((nsId: string) => {
    setNamespaces(prev => {
      const updated = prev.map(ns =>
        ns.id === nsId ? { ...ns, collapsed: !ns.collapsed } : ns
      )
      return layoutNamespaces(updated, layoutMode)
    })
  }, [layoutMode])

  const sleepNamespace = useCallback((nsId: string) => {
    const ns = namespacesRef.current.find(n => n.id === nsId)
    if (!ns) return

    const isSleeping = !ns.sleeping

    if (isSleeping) {
      // Staggered sleep: pods disappear one by one
      const podCount = ns.deployments.reduce((s, d) => s + d.pods.length, 0)
      const staggerDelay = 0.08

      // Animate opacity
      const target = { opacity: ns.opacity }
      gsap.to(target, {
        opacity: 0.4,
        duration: 0.3 + podCount * staggerDelay * 0.5,
        ease: 'power2.inOut',
        onUpdate: () => {
          setNamespaces(prev =>
            prev.map(n => n.id === nsId ? { ...n, opacity: target.opacity } : n)
          )
        },
      })

      // Set sleeping state and collapse
      setTimeout(() => {
        setNamespaces(prev => {
          const updated = prev.map(n =>
            n.id === nsId ? { ...n, sleeping: true, collapsed: true } : n
          )
          return layoutNamespaces(updated, layoutMode)
        })
      }, podCount * staggerDelay * 80)
    } else {
      // Wake up
      const target = { opacity: ns.opacity }
      gsap.to(target, {
        opacity: 1,
        duration: 0.5,
        ease: 'power2.out',
        onUpdate: () => {
          setNamespaces(prev =>
            prev.map(n => n.id === nsId ? { ...n, opacity: target.opacity } : n)
          )
        },
      })

      setNamespaces(prev => {
        const updated = prev.map(n =>
          n.id === nsId ? { ...n, sleeping: false, collapsed: false } : n
        )
        return layoutNamespaces(updated, layoutMode)
      })
    }
  }, [layoutMode])

  const resetView = useCallback(() => {
    setCamera({ x: 20, y: 20, zoom: 1 })
    setNamespaces(layoutNamespaces(createInitialNamespaces(), layoutMode))
  }, [layoutMode])

  // Build tooltip content
  function buildTooltipContent(hit: HoveredNode): string[] {
    if (hit.type === 'namespace') {
      const ns = hit.data as NamespaceData
      const totalPods = ns.deployments.reduce((s, d) => s + d.pods.length, 0)
      const totalRps = ns.deployments.reduce((s, d) => s + d.rps, 0)
      return [
        `Namespace: ${ns.name}`,
        `Deployments: ${ns.deployments.length}`,
        `Pods: ${totalPods}`,
        `Total RPS: ${totalRps.toLocaleString()}`,
        ns.sleeping ? 'Status: Sleeping' : 'Status: Active',
      ]
    }
    if (hit.type === 'deployment') {
      const dep = hit.data as DeploymentData
      return [
        `Deployment: ${dep.name}`,
        `Pods: ${dep.pods.length}`,
        `RPS: ${dep.rps.toLocaleString()}`,
        `Status: ${dep.status}`,
      ]
    }
    if (hit.type === 'pod') {
      const pod = hit.data as PodData
      return [
        `Pod: ${pod.name}`,
        `CPU: ${pod.cpu}%`,
        `Memory: ${pod.memory}%`,
        `Status: ${pod.status}`,
      ]
    }
    return []
  }

  // Find sleepable namespaces for toolbar
  const sleepableNamespaces = namespaces.filter(ns => !ns.sleeping)
  const sleepingNamespaces = namespaces.filter(ns => ns.sleeping)

  return (
    <Box sx={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', bgcolor: 'background.default' }}>
      {/* Header */}
      <Box sx={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        px: 3, py: 1.5,
        display: 'flex', alignItems: 'center', gap: 2,
        backdropFilter: 'blur(12px)',
        bgcolor: isDark ? 'rgba(18,18,18,0.85)' : 'rgba(255,255,255,0.85)',
        borderBottom: 1, borderColor: 'divider',
      }}>
        <Typography variant="h6" fontWeight={700} sx={{ color: 'text.primary' }}>
          Cluster Topology
        </Typography>
        <Chip
          size="small"
          label={`${namespaces.length} namespaces`}
          sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
        />
        <Chip
          size="small"
          label={`${namespaces.reduce((s, ns) => s + ns.deployments.reduce((s2, d) => s2 + d.pods.length, 0), 0)} pods`}
          color="success"
          variant="outlined"
        />
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary">
          Click namespace to collapse · Drag to move · Scroll to zoom
        </Typography>
      </Box>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', cursor: panRef.current.active ? 'grabbing' : 'grab' }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onWheel={handleWheel}
      />

      {/* Tooltip */}
      {tooltipInfo.show && (
        <Box
          sx={{
            position: 'fixed',
            left: tooltipInfo.x + 12,
            top: tooltipInfo.y - 8,
            zIndex: 9998,
            px: 1.5, py: 1,
            borderRadius: 1.5,
            bgcolor: isDark ? 'grey.900' : 'grey.50',
            border: 1,
            borderColor: 'divider',
            boxShadow: 4,
            pointerEvents: 'none',
            minWidth: 160,
          }}
        >
          {tooltipInfo.content.map((line, i) => (
            <Typography
              key={i}
              variant="caption"
              display="block"
              sx={{
                color: i === 0 ? 'text.primary' : 'text.secondary',
                fontWeight: i === 0 ? 600 : 400,
                lineHeight: 1.6,
              }}
            >
              {line}
            </Typography>
          ))}
        </Box>
      )}

      {/* Dev Toolbar */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1,
          bgcolor: isDark ? 'rgba(18,18,18,0.95)' : 'rgba(255,255,255,0.95)',
          borderTop: 1,
          borderColor: 'divider',
          backdropFilter: 'blur(12px)',
        }}
      >
        <Chip
          label="FL20"
          size="small"
          sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 700, fontSize: 11 }}
        />

        <Tooltip title={playing ? 'Pause' : 'Play'}>
          <IconButton size="small" onClick={() => setPlaying(p => !p)}>
            {playing ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        <Tooltip title="Reset">
          <IconButton size="small" onClick={resetView}>
            <ReplayIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary">Speed:</Typography>
          {[0.5, 1, 2].map(s => (
            <Chip
              key={s}
              label={`${s}x`}
              size="small"
              variant={speed === s ? 'filled' : 'outlined'}
              onClick={() => setSpeed(s)}
              sx={{ cursor: 'pointer', minWidth: 38 }}
            />
          ))}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary">Layout:</Typography>
          <Tooltip title="Grid">
            <IconButton
              size="small"
              onClick={() => setLayoutMode('grid')}
              sx={{ color: layoutMode === 'grid' ? 'primary.main' : 'text.secondary' }}
            >
              <GridViewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Tree">
            <IconButton
              size="small"
              onClick={() => setLayoutMode('tree')}
              sx={{ color: layoutMode === 'tree' ? 'primary.main' : 'text.secondary' }}
            >
              <AccountTreeIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        <Box sx={{ mx: 1, height: 20, borderLeft: 1, borderColor: 'divider' }} />

        {/* Sleep buttons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
          <Tooltip title="Sleep a namespace">
            <BedtimeIcon fontSize="small" sx={{ color: 'text.secondary', mr: 0.5 }} />
          </Tooltip>
          {sleepableNamespaces.slice(0, 4).map(ns => (
            <Chip
              key={ns.id}
              label={ns.name}
              size="small"
              variant="outlined"
              icon={<BedtimeIcon sx={{ fontSize: 14 }} />}
              onClick={() => sleepNamespace(ns.id)}
              sx={{ cursor: 'pointer', borderColor: ns.color, fontSize: 11 }}
            />
          ))}
          {sleepableNamespaces.length > 4 && (
            <Typography variant="caption" color="text.secondary">
              +{sleepableNamespaces.length - 4} more
            </Typography>
          )}
        </Box>

        {sleepingNamespaces.length > 0 && (
          <>
            <Box sx={{ mx: 1, height: 20, borderLeft: 1, borderColor: 'divider' }} />
            <Tooltip title="Wake namespaces">
              <WbSunnyIcon fontSize="small" sx={{ color: 'warning.main', mr: 0.5 }} />
            </Tooltip>
            {sleepingNamespaces.map(ns => (
              <Chip
                key={ns.id}
                label={ns.name}
                size="small"
                color="warning"
                variant="outlined"
                icon={<WbSunnyIcon sx={{ fontSize: 14 }} />}
                onClick={() => sleepNamespace(ns.id)}
                sx={{ cursor: 'pointer', fontSize: 11 }}
              />
            ))}
          </>
        )}

        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary">
          Zoom: {(camera.zoom * 100).toFixed(0)}%
        </Typography>
      </Box>
    </Box>
  )
}
