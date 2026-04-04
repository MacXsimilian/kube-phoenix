'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Card from '@mui/material/Card'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Tooltip from '@mui/material/Tooltip'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import CloseIcon from '@mui/icons-material/Close'
import { useRouter } from 'next/navigation'
import gsap from 'gsap'
import { AnimatePresence, motion } from 'framer-motion'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PodStatus = 'running' | 'pending' | 'failed'

interface PodData {
  id: string
  status: PodStatus
}

interface StationData {
  id: string
  name: string
  kind: 'Deployment' | 'StatefulSet' | 'DaemonSet'
  x: number
  y: number
  pods: PodData[]
  cpu: string
  memory: string
}

interface MetroLine {
  id: string
  namespace: string
  color: string
  stations: StationData[]
  sleeping: boolean
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LINE_STROKE = 6
const GLOW_STROKE = 14
const STATION_RADIUS = 8
const POD_WIDTH = 4
const POD_HEIGHT = 8
const VIEWBOX_DEFAULT = '0 0 1200 700'

const STATUS_COLORS: Record<PodStatus, string> = {
  running: '#22C55E',
  pending: '#F59E0B',
  failed: '#EF4444',
}

// ---------------------------------------------------------------------------
// Mock Data Factory
// ---------------------------------------------------------------------------

function makePods(count: number): PodData[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `pod-${i}`,
    status: 'running' as PodStatus,
  }))
}

function buildLines(): MetroLine[] {
  return [
    {
      id: 'production',
      namespace: 'production',
      color: '#22C55E',
      sleeping: false,
      stations: [
        { id: 'prod-api', name: 'api-gateway', kind: 'Deployment', x: 200, y: 350, pods: makePods(3), cpu: '120m', memory: '256Mi' },
        { id: 'prod-web', name: 'web-frontend', kind: 'Deployment', x: 320, y: 350, pods: makePods(3), cpu: '80m', memory: '192Mi' },
        { id: 'prod-order', name: 'order-service', kind: 'Deployment', x: 440, y: 320, pods: makePods(2), cpu: '200m', memory: '384Mi' },
        { id: 'prod-pay', name: 'payment-service', kind: 'Deployment', x: 560, y: 320, pods: makePods(2), cpu: '150m', memory: '320Mi' },
        { id: 'prod-user', name: 'user-service', kind: 'Deployment', x: 680, y: 350, pods: makePods(2), cpu: '90m', memory: '256Mi' },
        { id: 'prod-notif', name: 'notification-svc', kind: 'Deployment', x: 780, y: 380, pods: makePods(1), cpu: '40m', memory: '128Mi' },
        { id: 'prod-pg', name: 'postgres', kind: 'StatefulSet', x: 900, y: 380, pods: makePods(1), cpu: '300m', memory: '512Mi' },
        { id: 'prod-redis', name: 'redis', kind: 'StatefulSet', x: 1000, y: 350, pods: makePods(1), cpu: '60m', memory: '128Mi' },
      ],
    },
    {
      id: 'staging',
      namespace: 'staging',
      color: '#7C3AED',
      sleeping: false,
      stations: [
        { id: 'stg-api', name: 'api-gateway', kind: 'Deployment', x: 200, y: 350, pods: makePods(2), cpu: '80m', memory: '192Mi' },
        { id: 'stg-web', name: 'web-frontend', kind: 'Deployment', x: 320, y: 280, pods: makePods(2), cpu: '60m', memory: '128Mi' },
        { id: 'stg-order', name: 'order-service', kind: 'Deployment', x: 440, y: 220, pods: makePods(1), cpu: '100m', memory: '256Mi' },
        { id: 'stg-pay', name: 'payment-service', kind: 'Deployment', x: 560, y: 200, pods: makePods(1), cpu: '80m', memory: '192Mi' },
        { id: 'stg-pg', name: 'postgres', kind: 'StatefulSet', x: 680, y: 220, pods: makePods(1), cpu: '150m', memory: '384Mi' },
        { id: 'stg-redis', name: 'redis', kind: 'StatefulSet', x: 780, y: 260, pods: makePods(1), cpu: '40m', memory: '96Mi' },
      ],
    },
    {
      id: 'dev',
      namespace: 'dev',
      color: '#3B82F6',
      sleeping: false,
      stations: [
        { id: 'dev-api', name: 'api-gateway', kind: 'Deployment', x: 200, y: 350, pods: makePods(1), cpu: '40m', memory: '128Mi' },
        { id: 'dev-web', name: 'web-frontend', kind: 'Deployment', x: 320, y: 420, pods: makePods(1), cpu: '30m', memory: '96Mi' },
        { id: 'dev-feat', name: 'feature-branch-svc', kind: 'Deployment', x: 440, y: 460, pods: makePods(1), cpu: '50m', memory: '128Mi' },
        { id: 'dev-pg', name: 'postgres', kind: 'StatefulSet', x: 560, y: 480, pods: makePods(1), cpu: '100m', memory: '256Mi' },
      ],
    },
    {
      id: 'monitoring',
      namespace: 'monitoring',
      color: '#22D3EE',
      sleeping: false,
      stations: [
        { id: 'mon-prom', name: 'prometheus', kind: 'StatefulSet', x: 300, y: 120, pods: makePods(1), cpu: '250m', memory: '512Mi' },
        { id: 'mon-graf', name: 'grafana', kind: 'Deployment', x: 450, y: 100, pods: makePods(1), cpu: '100m', memory: '256Mi' },
        { id: 'mon-alert', name: 'alertmanager', kind: 'Deployment', x: 600, y: 120, pods: makePods(1), cpu: '50m', memory: '128Mi' },
        { id: 'mon-loki', name: 'loki', kind: 'StatefulSet', x: 700, y: 160, pods: makePods(1), cpu: '200m', memory: '384Mi' },
      ],
    },
    {
      id: 'kube-system',
      namespace: 'kube-system',
      color: '#F59E0B',
      sleeping: false,
      stations: [
        { id: 'ks-dns', name: 'coredns', kind: 'Deployment', x: 350, y: 560, pods: makePods(2), cpu: '30m', memory: '64Mi' },
        { id: 'ks-proxy', name: 'kube-proxy', kind: 'DaemonSet', x: 500, y: 580, pods: makePods(3), cpu: '20m', memory: '48Mi' },
        { id: 'ks-metrics', name: 'metrics-server', kind: 'Deployment', x: 650, y: 560, pods: makePods(1), cpu: '50m', memory: '96Mi' },
      ],
    },
  ]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function metroPath(points: [number, number][]): string {
  if (points.length < 2) return ''
  const BEND = 25
  let d = `M ${points[0][0]} ${points[0][1]}`
  for (let i = 1; i < points.length; i++) {
    const [px, py] = points[i - 1]
    const [cx, cy] = points[i]
    const dx = cx - px
    const dy = cy - py
    if (dy === 0) {
      d += ` L ${cx} ${cy}`
    } else if (dx === 0) {
      d += ` L ${cx} ${cy}`
    } else {
      const diagLen = Math.min(Math.abs(dx), Math.abs(dy), BEND)
      const sx = Math.sign(dx)
      const sy = Math.sign(dy)
      const midX = px + (Math.abs(dx) - diagLen) * sx
      d += ` L ${midX} ${py}`
      d += ` L ${midX + diagLen * sx} ${py + diagLen * sy}`
      d += ` L ${cx} ${cy}`
    }
  }
  return d
}

function riverPath(): string {
  return 'M 80 450 Q 200 500 350 440 Q 500 380 650 420 Q 800 460 950 400 Q 1050 370 1150 390'
}

function findInterchanges(lines: MetroLine[]): Map<string, { x: number; y: number; colors: string[] }> {
  const stationMap = new Map<string, { x: number; y: number; colors: string[] }>()
  for (const line of lines) {
    for (const station of line.stations) {
      const key = `${station.x},${station.y}`
      const existing = stationMap.get(key)
      if (existing) {
        if (!existing.colors.includes(line.color)) {
          existing.colors.push(line.color)
        }
      } else {
        stationMap.set(key, { x: station.x, y: station.y, colors: [line.color] })
      }
    }
  }
  const interchanges = new Map<string, { x: number; y: number; colors: string[] }>()
  for (const [key, val] of stationMap.entries()) {
    if (val.colors.length > 1) interchanges.set(key, val)
  }
  return interchanges
}

function totalPods(lines: MetroLine[]): number {
  return lines.reduce((sum, l) => sum + l.stations.reduce((s, st) => s + st.pods.length, 0), 0)
}

function totalStations(lines: MetroLine[]): number {
  return lines.reduce((sum, l) => sum + l.stations.length, 0)
}

// ---------------------------------------------------------------------------
// SVG Sub-components
// ---------------------------------------------------------------------------

function River() {
  return (
    <path
      d={riverPath()}
      fill="none"
      stroke="#1E3A5F"
      strokeWidth={28}
      strokeLinecap="round"
      opacity={0.18}
    />
  )
}

function ZoneMarkers() {
  return (
    <g opacity={0.08}>
      <circle cx={500} cy={350} r={180} fill="none" stroke="#fff" strokeWidth={1} strokeDasharray="6 4" />
      <circle cx={500} cy={350} r={340} fill="none" stroke="#fff" strokeWidth={1} strokeDasharray="6 4" />
      <text x={500} y={178} textAnchor="middle" fill="#fff" fontSize={10} fontFamily="sans-serif">Zone 1</text>
      <text x={500} y={18} textAnchor="middle" fill="#fff" fontSize={10} fontFamily="sans-serif">Zone 2</text>
    </g>
  )
}

function CompassRose() {
  return (
    <g transform="translate(1120, 80)">
      <circle cx={0} cy={0} r={18} fill="none" stroke="#555" strokeWidth={1} />
      <line x1={0} y1={-16} x2={0} y2={-8} stroke="#888" strokeWidth={1.5} />
      <text x={0} y={-20} textAnchor="middle" fill="#888" fontSize={9} fontFamily="sans-serif" fontWeight={700}>N</text>
    </g>
  )
}

function MapTitle() {
  return (
    <g>
      <text x={60} y={45} fill="#ffffff" fontSize={16} fontFamily="'Helvetica Neue', Arial, sans-serif" fontWeight={700} letterSpacing={3}>
        KUBE-PHOENIX TRANSIT MAP
      </text>
      <text x={60} y={62} fill="#888" fontSize={9} fontFamily="'Helvetica Neue', Arial, sans-serif" letterSpacing={1}>
        CLUSTER TOPOLOGY
      </text>
    </g>
  )
}

interface LinePathProps {
  line: MetroLine
  dimmed: boolean
  highlighted: boolean
}

function LinePath({ line, dimmed, highlighted }: LinePathProps) {
  const points: [number, number][] = line.stations.map(s => [s.x, s.y])
  const d = metroPath(points)
  const glowOpacity = dimmed ? 0 : highlighted ? 0.35 : 0.2
  const lineOpacity = dimmed ? 0.3 : 1
  const strokeColor = dimmed ? '#555' : line.color

  return (
    <g className={`line-group-${line.id}`}>
      <path
        className={`line-glow-${line.id}`}
        d={d}
        fill="none"
        stroke={line.color}
        strokeWidth={GLOW_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={glowOpacity}
      />
      <path
        className={`line-path-${line.id}`}
        d={d}
        fill="none"
        stroke={strokeColor}
        strokeWidth={LINE_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={lineOpacity}
        strokeDasharray={dimmed ? '8 6' : 'none'}
      />
    </g>
  )
}

interface StationMarkerProps {
  station: StationData
  lineColor: string
  lineId: string
  sleeping: boolean
  dimmed: boolean
  onHover: (station: StationData | null, lineId: string) => void
  onClick: (station: StationData, lineId: string) => void
  isInterchange: boolean
  interchangeColors: string[]
}

function StationMarker({
  station, lineColor, lineId, sleeping, dimmed, onHover, onClick,
  isInterchange, interchangeColors,
}: StationMarkerProps) {
  const stationColor = dimmed ? '#666' : lineColor
  const textOpacity = dimmed ? 0.4 : 0.9
  const radius = isInterchange ? STATION_RADIUS + 3 : STATION_RADIUS

  return (
    <g
      className={`station-group-${lineId}-${station.id}`}
      style={{ cursor: 'pointer' }}
      onMouseEnter={() => onHover(station, lineId)}
      onMouseLeave={() => onHover(null, lineId)}
      onClick={() => onClick(station, lineId)}
    >
      {isInterchange && (
        <>
          <circle cx={station.x} cy={station.y} r={radius + 2} fill="#1a1a2e" stroke="#fff" strokeWidth={2} />
          {interchangeColors.map((c, i) => {
            const startAngle = (i / interchangeColors.length) * 360 - 90
            const endAngle = ((i + 1) / interchangeColors.length) * 360 - 90
            const r = radius + 1
            const x1 = station.x + r * Math.cos((startAngle * Math.PI) / 180)
            const y1 = station.y + r * Math.sin((startAngle * Math.PI) / 180)
            const x2 = station.x + r * Math.cos((endAngle * Math.PI) / 180)
            const y2 = station.y + r * Math.sin((endAngle * Math.PI) / 180)
            const large = endAngle - startAngle > 180 ? 1 : 0
            return (
              <path
                key={c}
                d={`M ${station.x} ${station.y} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`}
                fill={c}
                opacity={0.6}
              />
            )
          })}
        </>
      )}
      <circle
        className={`station-dot-${lineId}-${station.id}`}
        cx={station.x}
        cy={station.y}
        r={isInterchange ? 4 : STATION_RADIUS}
        fill={isInterchange ? '#fff' : stationColor}
        stroke="#fff"
        strokeWidth={2}
      />
      <text
        className={`station-label-${lineId}-${station.id}`}
        x={station.x + 12}
        y={station.y - 12}
        fill="#ccc"
        fontSize={9}
        fontFamily="'Helvetica Neue', Arial, sans-serif"
        opacity={textOpacity}
        transform={`rotate(-45, ${station.x + 12}, ${station.y - 12})`}
      >
        {station.name}
      </text>
      {!sleeping && (
        <g className={`pods-group-${lineId}-${station.id}`}>
          {station.pods.map((pod, i) => (
            <rect
              key={pod.id}
              className={`pod-${lineId}-${station.id}-${pod.id}`}
              x={station.x - (station.pods.length * (POD_WIDTH + 2)) / 2 + i * (POD_WIDTH + 2)}
              y={station.y + STATION_RADIUS + 4}
              width={POD_WIDTH}
              height={POD_HEIGHT}
              rx={1}
              fill={STATUS_COLORS[pod.status]}
              opacity={0.9}
            >
              {pod.status === 'running' && (
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values={`${-1} 0; ${1} 0; ${-1} 0`}
                  dur="3s"
                  repeatCount="indefinite"
                />
              )}
            </rect>
          ))}
        </g>
      )}
    </g>
  )
}

interface SuspendedMarkerProps {
  station: StationData
}

function SuspendedMarker({ station }: SuspendedMarkerProps) {
  return (
    <motion.g
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      style={{ originX: `${station.x}px`, originY: `${station.y}px` }}
    >
      <circle cx={station.x + 14} cy={station.y + 14} r={7} fill="#EF4444" opacity={0.9} />
      <text
        x={station.x + 14}
        y={station.y + 18}
        textAnchor="middle"
        fill="#fff"
        fontSize={10}
        fontWeight={700}
        fontFamily="sans-serif"
      >
        X
      </text>
    </motion.g>
  )
}

interface InterchangeNodeProps {
  x: number
  y: number
  colors: string[]
}

function InterchangeNode({ x, y, colors }: InterchangeNodeProps) {
  const r = STATION_RADIUS + 4
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="#1a1a2e" stroke="#fff" strokeWidth={2.5} />
      {colors.map((c, i) => {
        const startAngle = (i / colors.length) * 360 - 90
        const endAngle = ((i + 1) / colors.length) * 360 - 90
        const x1 = x + r * Math.cos((startAngle * Math.PI) / 180)
        const y1 = y + r * Math.sin((startAngle * Math.PI) / 180)
        const x2 = x + r * Math.cos((endAngle * Math.PI) / 180)
        const y2 = y + r * Math.sin((endAngle * Math.PI) / 180)
        const large = endAngle - startAngle > 180 ? 1 : 0
        return (
          <path
            key={`interchange-${x}-${y}-${c}`}
            d={`M ${x} ${y} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`}
            fill={c}
            opacity={0.5}
          />
        )
      })}
      <circle cx={x} cy={y} r={4} fill="#fff" />
    </g>
  )
}

// ---------------------------------------------------------------------------
// Legend Component
// ---------------------------------------------------------------------------

interface LegendProps {
  lines: MetroLine[]
  visibleLines: Set<string>
  onToggleLine: (lineId: string) => void
}

function Legend({ lines, visibleLines, onToggleLine }: LegendProps) {
  return (
    <g transform="translate(950, 80)">
      <rect x={0} y={0} width={200} height={lines.length * 28 + 30} rx={6} fill="#0d1117" stroke="#333" strokeWidth={1} opacity={0.9} />
      <text x={15} y={22} fill="#fff" fontSize={11} fontWeight={700} fontFamily="sans-serif" letterSpacing={1}>KEY</text>
      {lines.map((line, i) => {
        const visible = visibleLines.has(line.id)
        return (
          <g
            key={line.id}
            transform={`translate(15, ${35 + i * 28})`}
            style={{ cursor: 'pointer' }}
            onClick={() => onToggleLine(line.id)}
            opacity={visible ? 1 : 0.35}
          >
            <line x1={0} y1={8} x2={24} y2={8} stroke={line.color} strokeWidth={4} strokeLinecap="round" />
            <circle cx={12} cy={8} r={4} fill={line.color} stroke="#fff" strokeWidth={1.5} />
            <text x={32} y={12} fill="#ccc" fontSize={10} fontFamily="sans-serif">{line.namespace}</text>
            {line.sleeping && (
              <text x={140} y={12} fill="#EF4444" fontSize={8} fontFamily="sans-serif" fontWeight={700}>SUSPENDED</text>
            )}
          </g>
        )
      })}
    </g>
  )
}

// ---------------------------------------------------------------------------
// Banner Component
// ---------------------------------------------------------------------------

interface BannerProps {
  text: string | null
}

function Banner({ text }: BannerProps) {
  return (
    <AnimatePresence>
      {text && (
        <motion.g
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <rect x={0} y={0} width={1200} height={36} fill="#EF4444" opacity={0.92} />
          <motion.text
            x={1300}
            animate={{ x: -400 }}
            transition={{ duration: 4, ease: 'linear' }}
            y={24}
            fill="#fff"
            fontSize={14}
            fontWeight={700}
            fontFamily="'Helvetica Neue', Arial, sans-serif"
            letterSpacing={2}
          >
            {text}
          </motion.text>
        </motion.g>
      )}
    </AnimatePresence>
  )
}

// ---------------------------------------------------------------------------
// Station Detail Card
// ---------------------------------------------------------------------------

interface StationCardProps {
  station: StationData
  lineColor: string
  namespace: string
  onClose: () => void
}

function StationCard({ station, lineColor, namespace, onClose }: StationCardProps) {
  const runningPods = station.pods.filter(p => p.status === 'running').length
  const pendingPods = station.pods.filter(p => p.status === 'pending').length
  const failedPods = station.pods.filter(p => p.status === 'failed').length

  return (
    <Card
      sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        bgcolor: '#0d1117',
        border: `1px solid ${lineColor}`,
        borderRadius: 2,
        p: 2.5,
        minWidth: 280,
        zIndex: 100,
        boxShadow: `0 0 30px ${lineColor}33`,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="subtitle1" sx={{ color: lineColor, fontWeight: 700 }}>
          {station.name}
        </Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: '#888' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Typography variant="caption" sx={{ color: '#888' }}>
          Namespace: <span style={{ color: '#ccc' }}>{namespace}</span>
        </Typography>
        <Typography variant="caption" sx={{ color: '#888' }}>
          Kind: <span style={{ color: '#ccc' }}>{station.kind}</span>
        </Typography>
        <Typography variant="caption" sx={{ color: '#888' }}>
          CPU: <span style={{ color: '#ccc' }}>{station.cpu}</span>
        </Typography>
        <Typography variant="caption" sx={{ color: '#888' }}>
          Memory: <span style={{ color: '#ccc' }}>{station.memory}</span>
        </Typography>
        <Box sx={{ mt: 1, display: 'flex', gap: 0.5 }}>
          {runningPods > 0 && <Chip label={`${runningPods} running`} size="small" sx={{ bgcolor: '#22C55E22', color: '#22C55E', fontSize: 10 }} />}
          {pendingPods > 0 && <Chip label={`${pendingPods} pending`} size="small" sx={{ bgcolor: '#F59E0B22', color: '#F59E0B', fontSize: 10 }} />}
          {failedPods > 0 && <Chip label={`${failedPods} failed`} size="small" sx={{ bgcolor: '#EF444422', color: '#EF4444', fontSize: 10 }} />}
        </Box>
      </Box>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Tooltip Content
// ---------------------------------------------------------------------------

interface StationTooltipContentProps {
  station: StationData
  namespace: string
  lineColor: string
}

function StationTooltipContent({ station, namespace, lineColor }: StationTooltipContentProps) {
  const running = station.pods.filter(p => p.status === 'running').length
  return (
    <Box sx={{ p: 0.5 }}>
      <Typography sx={{ fontWeight: 700, color: lineColor, fontSize: 12 }}>{station.name}</Typography>
      <Typography sx={{ color: '#aaa', fontSize: 10 }}>{namespace} / {station.kind}</Typography>
      <Typography sx={{ color: '#aaa', fontSize: 10 }}>
        Replicas: {running}/{station.pods.length} | CPU: {station.cpu} | Mem: {station.memory}
      </Typography>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function FlagshipMetroPage() {
  const router = useRouter()
  const svgRef = useRef<SVGSVGElement>(null)
  const [lines, setLines] = useState<MetroLine[]>(buildLines)
  const [visibleLines, setVisibleLines] = useState<Set<string>>(new Set(buildLines().map(l => l.id)))
  const [hoveredStation, setHoveredStation] = useState<{ station: StationData; lineId: string } | null>(null)
  const [hoveredLine, setHoveredLine] = useState<string | null>(null)
  const [selectedStation, setSelectedStation] = useState<{ station: StationData; lineId: string } | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [simulating, setSimulating] = useState(true)
  const [viewBox, setViewBox] = useState(VIEWBOX_DEFAULT)
  const animatingRef = useRef(false)
  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const interchanges = useMemo(() => findInterchanges(lines), [lines])

  const isInterchangeStation = useCallback((station: StationData): { is: boolean; colors: string[] } => {
    const key = `${station.x},${station.y}`
    const entry = interchanges.get(key)
    return entry ? { is: true, colors: entry.colors } : { is: false, colors: [] }
  }, [interchanges])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      gsap.killTweensOf('*')
      if (simIntervalRef.current) clearInterval(simIntervalRef.current)
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current)
    }
  }, [])

  // Live simulation
  useEffect(() => {
    if (!simulating) {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current)
      simIntervalRef.current = null
      return
    }

    simIntervalRef.current = setInterval(() => {
      setLines(prev => {
        const next = prev.map(line => ({
          ...line,
          stations: line.stations.map(station => ({
            ...station,
            pods: station.pods.map(pod => ({ ...pod })),
          })),
        }))

        const awakeLines = next.filter(l => !l.sleeping)
        if (awakeLines.length === 0) return next

        const line = awakeLines[Math.floor(Math.random() * awakeLines.length)]
        const station = line.stations[Math.floor(Math.random() * line.stations.length)]
        if (station.pods.length === 0) return next

        const podIndex = Math.floor(Math.random() * station.pods.length)
        const pod = station.pods[podIndex]

        if (pod.status === 'running') {
          const isFail = Math.random() < 0.15
          pod.status = isFail ? 'failed' : 'pending'
        } else {
          pod.status = 'running'
        }

        return next
      })
    }, 2000)

    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current)
    }
  }, [simulating])

  const showBanner = useCallback((text: string) => {
    setBanner(text)
    if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current)
    bannerTimeoutRef.current = setTimeout(() => setBanner(null), 3500)
  }, [])

  const sleepLine = useCallback((lineId: string) => {
    if (animatingRef.current) return
    animatingRef.current = true

    const line = lines.find(l => l.id === lineId)
    if (!line || line.sleeping) {
      animatingRef.current = false
      return
    }

    showBanner(`SERVICE SUSPENDED \u2014 ${line.namespace} line`)

    const tl = gsap.timeline({
      onComplete: () => {
        setLines(prev => prev.map(l =>
          l.id === lineId
            ? { ...l, sleeping: true, stations: l.stations.map(s => ({ ...s, pods: s.pods.map(p => ({ ...p, status: 'running' as PodStatus })) })) }
            : l
        ))
        animatingRef.current = false
      },
    })

    line.stations.forEach((station, i) => {
      tl.to(`.pods-group-${lineId}-${station.id}`, {
        x: 200,
        opacity: 0,
        duration: 0.4,
        ease: 'power2.in',
      }, i * 0.15)
    })

    line.stations.forEach((station, i) => {
      tl.to(`.station-dot-${lineId}-${station.id}`, {
        attr: { r: STATION_RADIUS * 0.6, fill: '#666' },
        duration: 0.3,
      }, 0.8 + i * 0.1)
      tl.to(`.station-label-${lineId}-${station.id}`, {
        opacity: 0.4,
        duration: 0.3,
      }, 0.8 + i * 0.1)
    })

    tl.to(`.line-path-${lineId}`, {
      attr: { stroke: '#555', strokeDasharray: '8 6' },
      opacity: 0.3,
      duration: 0.5,
    }, 1.2)

    tl.to(`.line-glow-${lineId}`, {
      opacity: 0,
      duration: 0.4,
    }, 1.2)
  }, [lines, showBanner])

  const wakeLine = useCallback((lineId: string) => {
    if (animatingRef.current) return
    animatingRef.current = true

    const line = lines.find(l => l.id === lineId)
    if (!line || !line.sleeping) {
      animatingRef.current = false
      return
    }

    setLines(prev => prev.map(l =>
      l.id === lineId ? { ...l, sleeping: false } : l
    ))

    showBanner(`SERVICE RESTORED \u2014 ${line.namespace} line`)

    const tl = gsap.timeline({
      onComplete: () => {
        animatingRef.current = false
      },
    })

    tl.to(`.line-path-${lineId}`, {
      attr: { stroke: line.color, strokeDasharray: 'none' },
      opacity: 1,
      duration: 0.5,
    }, 0)

    tl.to(`.line-glow-${lineId}`, {
      opacity: 0.2,
      duration: 0.4,
    }, 0)

    line.stations.forEach((station, i) => {
      tl.to(`.station-dot-${lineId}-${station.id}`, {
        attr: { r: STATION_RADIUS, fill: line.color },
        duration: 0.3,
      }, 0.3 + i * 0.1)
      tl.to(`.station-label-${lineId}-${station.id}`, {
        opacity: 0.9,
        duration: 0.3,
      }, 0.3 + i * 0.1)
    })

    line.stations.forEach((station, i) => {
      tl.fromTo(
        `.pods-group-${lineId}-${station.id}`,
        { x: -200, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.4, ease: 'power2.out' },
        0.8 + i * 0.15,
      )
    })
  }, [lines, showBanner])

  const handleStationHover = useCallback((station: StationData | null, lineId: string) => {
    if (station) {
      setHoveredStation({ station, lineId })
      setHoveredLine(lineId)
      gsap.to(`.station-dot-${lineId}-${station.id}`, { attr: { r: STATION_RADIUS * 1.5 }, duration: 0.2 })
    } else {
      if (hoveredStation) {
        gsap.to(`.station-dot-${lineId}-${hoveredStation.station.id}`, { attr: { r: STATION_RADIUS }, duration: 0.2 })
      }
      setHoveredStation(null)
      setHoveredLine(null)
    }
  }, [hoveredStation])

  const handleStationClick = useCallback((station: StationData, lineId: string) => {
    if (selectedStation?.station.id === station.id && selectedStation?.lineId === lineId) {
      setSelectedStation(null)
      gsap.to(svgRef.current, { attr: { viewBox: VIEWBOX_DEFAULT }, duration: 0.6, ease: 'power2.inOut' })
      return
    }
    setSelectedStation({ station, lineId })
    const zoomW = 400
    const zoomH = 280
    const zoomX = station.x - zoomW / 2
    const zoomY = station.y - zoomH / 2
    gsap.to(svgRef.current, {
      attr: { viewBox: `${zoomX} ${zoomY} ${zoomW} ${zoomH}` },
      duration: 0.6,
      ease: 'power2.inOut',
    })
  }, [selectedStation])

  const handleMapClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as SVGElement).tagName === 'svg' || (e.target as SVGElement).classList.contains('map-bg')) {
      if (selectedStation) {
        setSelectedStation(null)
        gsap.to(svgRef.current, { attr: { viewBox: VIEWBOX_DEFAULT }, duration: 0.6, ease: 'power2.inOut' })
      }
    }
  }, [selectedStation])

  const toggleLineVisibility = useCallback((lineId: string) => {
    setVisibleLines(prev => {
      const next = new Set(prev)
      if (next.has(lineId)) {
        next.delete(lineId)
      } else {
        next.add(lineId)
      }
      return next
    })
  }, [])

  const handleReset = useCallback(() => {
    gsap.killTweensOf('*')
    animatingRef.current = false
    setLines(buildLines())
    setVisibleLines(new Set(buildLines().map(l => l.id)))
    setSelectedStation(null)
    setHoveredStation(null)
    setHoveredLine(null)
    setBanner(null)
    setViewBox(VIEWBOX_DEFAULT)
    if (svgRef.current) {
      svgRef.current.setAttribute('viewBox', VIEWBOX_DEFAULT)
    }
  }, [])

  const sleepingCount = lines.filter(l => l.sleeping).length
  const awakeCount = lines.filter(l => !l.sleeping).length

  return (
    <Box sx={{ height: '100vh', bgcolor: '#0a0e17', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, borderBottom: '1px solid #1e293b' }}>
        <IconButton size="small" onClick={() => router.push('/prototypes')} sx={{ color: '#94a3b8' }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography variant="subtitle2" sx={{ color: '#94a3b8', fontWeight: 600 }}>
          FL11 — Metro Map
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Chip label={`${totalStations(lines)} stations`} size="small" sx={{ bgcolor: '#1e293b', color: '#94a3b8', fontSize: 11 }} />
        <Chip label={`${totalPods(lines)} pods`} size="small" sx={{ bgcolor: '#1e293b', color: '#94a3b8', fontSize: 11 }} />
        <Chip label={`${awakeCount} active`} size="small" sx={{ bgcolor: '#22C55E22', color: '#22C55E', fontSize: 11 }} />
        {sleepingCount > 0 && (
          <Chip label={`${sleepingCount} suspended`} size="small" sx={{ bgcolor: '#EF444422', color: '#EF4444', fontSize: 11 }} />
        )}
      </Box>

      {/* SVG Map */}
      <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <svg
          ref={svgRef}
          viewBox={viewBox}
          width="100%"
          height="100%"
          style={{ display: 'block' }}
          onClick={handleMapClick}
        >
          <rect className="map-bg" x={0} y={0} width={1200} height={700} fill="#0a0e17" />

          <ZoneMarkers />
          <River />
          <CompassRose />
          <MapTitle />

          {/* Render lines */}
          {lines.map(line => {
            if (!visibleLines.has(line.id)) return null
            return (
              <LinePath
                key={line.id}
                line={line}
                dimmed={line.sleeping}
                highlighted={hoveredLine === line.id}
              />
            )
          })}

          {/* Render interchange markers (behind stations) */}
          {Array.from(interchanges.entries()).map(([key, interchange]) => {
            const allVisible = interchange.colors.every(c => {
              const line = lines.find(l => l.color === c)
              return line ? visibleLines.has(line.id) : false
            })
            if (!allVisible) return null
            return (
              <InterchangeNode
                key={`interchange-${key}`}
                x={interchange.x}
                y={interchange.y}
                colors={interchange.colors}
              />
            )
          })}

          {/* Render stations */}
          {lines.map(line => {
            if (!visibleLines.has(line.id)) return null
            return line.stations.map(station => {
              const interchange = isInterchangeStation(station)
              return (
                <Tooltip
                  key={`${line.id}-${station.id}`}
                  title={
                    <StationTooltipContent
                      station={station}
                      namespace={line.namespace}
                      lineColor={line.color}
                    />
                  }
                  placement="top"
                  arrow
                  slotProps={{
                    tooltip: {
                      sx: { bgcolor: '#1a1a2e', border: '1px solid #333', maxWidth: 280 },
                    },
                    arrow: {
                      sx: { color: '#1a1a2e' },
                    },
                  }}
                >
                  <g>
                    <StationMarker
                      station={station}
                      lineColor={line.color}
                      lineId={line.id}
                      sleeping={line.sleeping}
                      dimmed={line.sleeping}
                      onHover={handleStationHover}
                      onClick={handleStationClick}
                      isInterchange={interchange.is}
                      interchangeColors={interchange.colors}
                    />
                  </g>
                </Tooltip>
              )
            })
          })}

          {/* Suspended markers */}
          <AnimatePresence>
            {lines.filter(l => l.sleeping && visibleLines.has(l.id)).flatMap(line =>
              line.stations.map(station => (
                <SuspendedMarker key={`susp-${line.id}-${station.id}`} station={station} />
              ))
            )}
          </AnimatePresence>

          {/* Hovering line label */}
          {hoveredLine && (() => {
            const line = lines.find(l => l.id === hoveredLine)
            if (!line) return null
            const midStation = line.stations[Math.floor(line.stations.length / 2)]
            return (
              <g>
                <rect
                  x={midStation.x - 60}
                  y={midStation.y - 40}
                  width={120}
                  height={24}
                  rx={4}
                  fill="#0d1117"
                  stroke={line.color}
                  strokeWidth={1}
                  opacity={0.95}
                />
                <text
                  x={midStation.x}
                  y={midStation.y - 24}
                  textAnchor="middle"
                  fill={line.color}
                  fontSize={10}
                  fontWeight={700}
                  fontFamily="sans-serif"
                >
                  {line.namespace} ({line.stations.length})
                </text>
              </g>
            )
          })()}

          {/* Banner */}
          <Banner text={banner} />

          {/* Legend */}
          <Legend lines={lines} visibleLines={visibleLines} onToggleLine={toggleLineVisibility} />
        </svg>

        {/* Station detail card */}
        {selectedStation && (() => {
          const line = lines.find(l => l.id === selectedStation.lineId)
          if (!line) return null
          return (
            <StationCard
              station={selectedStation.station}
              lineColor={line.color}
              namespace={line.namespace}
              onClose={() => {
                setSelectedStation(null)
                gsap.to(svgRef.current, { attr: { viewBox: VIEWBOX_DEFAULT }, duration: 0.6, ease: 'power2.inOut' })
              }}
            />
          )
        })()}
      </Box>

      {/* Control Bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1,
          borderTop: '1px solid #1e293b',
          bgcolor: '#0d1117',
          flexWrap: 'wrap',
        }}
      >
        {lines.map(line => (
          <Button
            key={line.id}
            size="small"
            variant="outlined"
            startIcon={line.sleeping ? <WbSunnyIcon /> : <BedtimeIcon />}
            onClick={() => line.sleeping ? wakeLine(line.id) : sleepLine(line.id)}
            sx={{
              borderColor: line.color + '66',
              color: line.color,
              fontSize: 11,
              textTransform: 'none',
              '&:hover': { borderColor: line.color, bgcolor: line.color + '11' },
            }}
          >
            {line.sleeping ? 'Wake' : 'Sleep'} {line.namespace}
          </Button>
        ))}

        <Box sx={{ flex: 1 }} />

        <Button
          size="small"
          variant="outlined"
          startIcon={simulating ? <PauseIcon /> : <PlayArrowIcon />}
          onClick={() => setSimulating(prev => !prev)}
          sx={{
            borderColor: '#475569',
            color: '#94a3b8',
            fontSize: 11,
            textTransform: 'none',
            '&:hover': { borderColor: '#64748b' },
          }}
        >
          {simulating ? 'Pause' : 'Simulate'}
        </Button>

        <Button
          size="small"
          variant="outlined"
          startIcon={<RestartAltIcon />}
          onClick={handleReset}
          sx={{
            borderColor: '#475569',
            color: '#94a3b8',
            fontSize: 11,
            textTransform: 'none',
            '&:hover': { borderColor: '#64748b' },
          }}
        >
          Reset
        </Button>

        {lines.map(line => (
          <FormControlLabel
            key={`toggle-${line.id}`}
            control={
              <Checkbox
                checked={visibleLines.has(line.id)}
                onChange={() => toggleLineVisibility(line.id)}
                size="small"
                sx={{ color: line.color, '&.Mui-checked': { color: line.color }, p: 0.5 }}
              />
            }
            label={
              <Typography sx={{ fontSize: 10, color: '#94a3b8' }}>{line.namespace}</Typography>
            }
            sx={{ mr: 0.5 }}
          />
        ))}
      </Box>
    </Box>
  )
}
