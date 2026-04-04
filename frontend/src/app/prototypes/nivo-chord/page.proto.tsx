'use client'

// PROTOTYPE: Nivo Chord Dependency Map
// DEPS: framer-motion gsap
// LIBS: SVG, D3 math, Framer Motion, GSAP
// DATA: Namespace cross-traffic matrix
// DESCRIPTION: Service dependency chord diagram — sleeping namespaces retract all chords

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Slider from '@mui/material/Slider'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import ReplayIcon from '@mui/icons-material/Replay'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TrafficLink {
  source: string
  target: string
  value: number
}

interface NamespaceInfo {
  name: string
  color: string
  sleeping: boolean
}

interface ArcData {
  index: number
  name: string
  color: string
  startAngle: number
  endAngle: number
  totalTraffic: number
  sleeping: boolean
}

interface ChordData {
  sourceIndex: number
  targetIndex: number
  sourceName: string
  targetName: string
  value: number
  sourceStartAngle: number
  sourceEndAngle: number
  targetStartAngle: number
  targetEndAngle: number
}

interface BumpPoint {
  hour: number
  rank: number
}

interface BumpSeries {
  name: string
  color: string
  points: BumpPoint[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NAMESPACE_COLORS: Record<string, string> = {
  production: '#22C55E',
  payments: '#3B82F6',
  auth: '#F59E0B',
  'data-pipeline': '#EC4899',
  'ml-training': '#8B5CF6',
  monitoring: '#14B8A6',
  staging: '#F97316',
  'internal-tools': '#06B6D4',
  'dev-sandbox': '#EF4444',
}

const NAMESPACES: string[] = [
  'production',
  'payments',
  'auth',
  'data-pipeline',
  'ml-training',
  'monitoring',
  'staging',
  'internal-tools',
  'dev-sandbox',
]

const TRAFFIC_LINKS: TrafficLink[] = [
  { source: 'production', target: 'payments', value: 400 },
  { source: 'production', target: 'auth', value: 800 },
  { source: 'production', target: 'monitoring', value: 50 },
  { source: 'payments', target: 'auth', value: 200 },
  { source: 'payments', target: 'data-pipeline', value: 150 },
  { source: 'auth', target: 'monitoring', value: 30 },
  { source: 'data-pipeline', target: 'ml-training', value: 300 },
  { source: 'data-pipeline', target: 'monitoring', value: 40 },
  { source: 'staging', target: 'monitoring', value: 20 },
  { source: 'internal-tools', target: 'auth', value: 15 },
  { source: 'dev-sandbox', target: 'staging', value: 10 },
]

const CHORD_RADIUS = 220
const ARC_THICKNESS = 24
const GAP_ANGLE = 0.04

// ---------------------------------------------------------------------------
// Chord math helpers
// ---------------------------------------------------------------------------

function computeArcs(
  namespaces: string[],
  links: TrafficLink[],
  sleepSet: Set<string>,
): ArcData[] {
  const trafficByNs: Record<string, number> = {}
  for (const ns of namespaces) {
    trafficByNs[ns] = 0
  }
  for (const link of links) {
    trafficByNs[link.source] += link.value
    trafficByNs[link.target] += link.value
  }

  const totalTraffic = Object.values(trafficByNs).reduce((a, b) => a + b, 0)
  const totalGap = GAP_ANGLE * namespaces.length
  const availableAngle = Math.PI * 2 - totalGap

  let currentAngle = 0
  return namespaces.map((name, index) => {
    const fraction = totalTraffic > 0 ? trafficByNs[name] / totalTraffic : 1 / namespaces.length
    const sweep = fraction * availableAngle
    const arc: ArcData = {
      index,
      name,
      color: NAMESPACE_COLORS[name],
      startAngle: currentAngle,
      endAngle: currentAngle + sweep,
      totalTraffic: trafficByNs[name],
      sleeping: sleepSet.has(name),
    }
    currentAngle += sweep + GAP_ANGLE
    return arc
  })
}

function computeChords(arcs: ArcData[], links: TrafficLink[]): ChordData[] {
  const arcByName: Record<string, ArcData> = {}
  for (const arc of arcs) {
    arcByName[arc.name] = arc
  }

  const consumed: Record<string, number> = {}
  for (const arc of arcs) {
    consumed[arc.name] = 0
  }

  return links.map((link) => {
    const srcArc = arcByName[link.source]
    const tgtArc = arcByName[link.target]
    const srcSweep = srcArc.endAngle - srcArc.startAngle
    const tgtSweep = tgtArc.endAngle - tgtArc.startAngle

    const srcFraction = srcArc.totalTraffic > 0 ? link.value / srcArc.totalTraffic : 0
    const tgtFraction = tgtArc.totalTraffic > 0 ? link.value / tgtArc.totalTraffic : 0

    const srcChordSweep = srcFraction * srcSweep
    const tgtChordSweep = tgtFraction * tgtSweep

    const srcStart = srcArc.startAngle + consumed[link.source] * srcSweep
    const tgtStart = tgtArc.startAngle + consumed[link.target] * tgtSweep

    consumed[link.source] += srcFraction
    consumed[link.target] += tgtFraction

    return {
      sourceIndex: srcArc.index,
      targetIndex: tgtArc.index,
      sourceName: link.source,
      targetName: link.target,
      value: link.value,
      sourceStartAngle: srcStart,
      sourceEndAngle: srcStart + srcChordSweep,
      targetStartAngle: tgtStart,
      targetEndAngle: tgtStart + tgtChordSweep,
    }
  })
}

function arcPath(startAngle: number, endAngle: number, innerR: number, outerR: number): string {
  const sinS = Math.sin(startAngle)
  const cosS = Math.cos(startAngle)
  const sinE = Math.sin(endAngle)
  const cosE = Math.cos(endAngle)
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0

  return [
    `M ${outerR * cosS} ${outerR * sinS}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerR * cosE} ${outerR * sinE}`,
    `L ${innerR * cosE} ${innerR * sinE}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerR * cosS} ${innerR * sinS}`,
    'Z',
  ].join(' ')
}

function ribbonPath(
  srcStart: number,
  srcEnd: number,
  tgtStart: number,
  tgtEnd: number,
  radius: number,
): string {
  const r = radius
  const s1x = r * Math.cos(srcStart), s1y = r * Math.sin(srcStart)
  const s2x = r * Math.cos(srcEnd), s2y = r * Math.sin(srcEnd)
  const t1x = r * Math.cos(tgtStart), t1y = r * Math.sin(tgtStart)
  const t2x = r * Math.cos(tgtEnd), t2y = r * Math.sin(tgtEnd)
  const largeArcSrc = srcEnd - srcStart > Math.PI ? 1 : 0
  const largeArcTgt = tgtEnd - tgtStart > Math.PI ? 1 : 0

  return [
    `M ${s1x} ${s1y}`,
    `A ${r} ${r} 0 ${largeArcSrc} 1 ${s2x} ${s2y}`,
    `C 0 0, 0 0, ${t1x} ${t1y}`,
    `A ${r} ${r} 0 ${largeArcTgt} 1 ${t2x} ${t2y}`,
    `C 0 0, 0 0, ${s1x} ${s1y}`,
    'Z',
  ].join(' ')
}

// ---------------------------------------------------------------------------
// Bump chart data generation
// ---------------------------------------------------------------------------

function generateBumpData(sleepingNamespaces: Set<string>): BumpSeries[] {
  const baseRanks: Record<string, number> = {
    production: 1,
    auth: 2,
    payments: 3,
    'data-pipeline': 4,
    'ml-training': 5,
    monitoring: 6,
    staging: 7,
    'internal-tools': 8,
    'dev-sandbox': 9,
  }

  return NAMESPACES.map((ns) => {
    const points: BumpPoint[] = []
    const isSleeping = sleepingNamespaces.has(ns)
    for (let h = 0; h <= 24; h++) {
      let rank = baseRanks[ns]
      if (isSleeping && h >= 12) {
        rank = 9
      } else if (!isSleeping) {
        const jitter = Math.sin(h * 0.5 + baseRanks[ns]) * 0.8
        rank = Math.max(1, Math.min(9, Math.round(rank + jitter)))
      }
      points.push({ hour: h, rank })
    }
    return { name: ns, color: NAMESPACE_COLORS[ns], points }
  })
}

// ---------------------------------------------------------------------------
// SVG Bump Chart Component
// ---------------------------------------------------------------------------

const BUMP_WIDTH = 700
const BUMP_HEIGHT = 200
const BUMP_PAD = { top: 20, right: 120, bottom: 30, left: 40 }

function BumpChart({ sleepSet }: { sleepSet: Set<string> }) {
  const data = useMemo(() => generateBumpData(sleepSet), [sleepSet])
  const innerW = BUMP_WIDTH - BUMP_PAD.left - BUMP_PAD.right
  const innerH = BUMP_HEIGHT - BUMP_PAD.top - BUMP_PAD.bottom

  const xScale = useCallback((h: number) => BUMP_PAD.left + (h / 24) * innerW, [innerW])
  const yScale = useCallback((r: number) => BUMP_PAD.top + ((r - 1) / 8) * innerH, [innerH])

  function smoothPath(points: BumpPoint[]): string {
    if (points.length < 2) return ''
    let d = `M ${xScale(points[0].hour)} ${yScale(points[0].rank)}`
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]
      const curr = points[i]
      const cpx = (xScale(prev.hour) + xScale(curr.hour)) / 2
      d += ` C ${cpx} ${yScale(prev.rank)}, ${cpx} ${yScale(curr.rank)}, ${xScale(curr.hour)} ${yScale(curr.rank)}`
    }
    return d
  }

  return (
    <svg viewBox={`0 0 ${BUMP_WIDTH} ${BUMP_HEIGHT}`} width="100%" style={{ maxWidth: BUMP_WIDTH }}>
      {[0, 6, 12, 18, 24].map((h) => (
        <g key={h}>
          <line
            x1={xScale(h)} y1={BUMP_PAD.top}
            x2={xScale(h)} y2={BUMP_PAD.top + innerH}
            stroke="rgba(148,163,184,0.15)" strokeWidth={1}
          />
          <text
            x={xScale(h)} y={BUMP_HEIGHT - 6}
            fill="rgba(148,163,184,0.6)" fontSize={10} textAnchor="middle"
          >
            {`${h}:00`}
          </text>
        </g>
      ))}
      {[1, 3, 5, 7, 9].map((r) => (
        <text
          key={r} x={BUMP_PAD.left - 8} y={yScale(r) + 4}
          fill="rgba(148,163,184,0.4)" fontSize={9} textAnchor="end"
        >
          #{r}
        </text>
      ))}
      {data.map((series) => (
        <g key={series.name}>
          <path
            d={smoothPath(series.points)}
            fill="none"
            stroke={series.color}
            strokeWidth={2.5}
            strokeLinecap="round"
            opacity={sleepSet.has(series.name) ? 0.4 : 0.85}
          />
          <circle
            cx={xScale(24)}
            cy={yScale(series.points[24].rank)}
            r={3}
            fill={series.color}
            opacity={sleepSet.has(series.name) ? 0.4 : 1}
          />
          <text
            x={xScale(24) + 8}
            y={yScale(series.points[24].rank) + 3.5}
            fill={series.color}
            fontSize={9}
            opacity={sleepSet.has(series.name) ? 0.4 : 1}
          >
            {series.name}
          </text>
        </g>
      ))}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function NivoChordPrototype() {
  const router = useRouter()
  const svgRef = useRef<SVGSVGElement>(null)
  const gsapCtxRef = useRef<gsap.Context | null>(null)

  const [sleepSet, setSleepSet] = useState<Set<string>>(new Set())
  const [hoveredNs, setHoveredNs] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [sleepTarget, setSleepTarget] = useState('staging')

  const animFrameRef = useRef<number>(0)
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const arcs = useMemo(() => computeArcs(NAMESPACES, TRAFFIC_LINKS, sleepSet), [sleepSet])
  const chords = useMemo(() => computeChords(arcs, TRAFFIC_LINKS), [arcs])

  const sleepCycle = useCallback(() => {
    const candidates = NAMESPACES.filter((ns) => ns !== 'production')
    const idx = Math.floor(Math.random() * candidates.length)
    const target = candidates[idx]
    setSleepSet((prev) => {
      const next = new Set(prev)
      if (next.has(target)) {
        next.delete(target)
      } else {
        next.add(target)
      }
      return next
    })
  }, [])

  useEffect(() => {
    if (playing) {
      const interval = (3000 / speed)
      playIntervalRef.current = setInterval(sleepCycle, interval)
    }
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current)
        playIntervalRef.current = null
      }
    }
  }, [playing, speed, sleepCycle])

  useEffect(() => {
    if (!svgRef.current) return
    gsapCtxRef.current = gsap.context(() => {
      gsap.fromTo(
        '.chord-ribbon',
        { opacity: 0, scale: 0.5, transformOrigin: 'center center' },
        { opacity: 1, scale: 1, duration: 0.8, ease: 'power3.out', stagger: 0.04 },
      )
      gsap.fromTo(
        '.chord-arc',
        { opacity: 0 },
        { opacity: 1, duration: 0.6, ease: 'power2.out', stagger: 0.06 },
      )
    }, svgRef.current)

    return () => {
      gsapCtxRef.current?.revert()
    }
  }, [])

  function handleReset() {
    setPlaying(false)
    setSleepSet(new Set())
    setHoveredNs(null)
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current)
      playIntervalRef.current = null
    }
    if (gsapCtxRef.current) {
      gsapCtxRef.current.revert()
    }
    if (svgRef.current) {
      gsapCtxRef.current = gsap.context(() => {
        gsap.fromTo(
          '.chord-ribbon',
          { opacity: 0, scale: 0.5, transformOrigin: 'center center' },
          { opacity: 1, scale: 1, duration: 0.8, ease: 'power3.out', stagger: 0.04 },
        )
        gsap.fromTo(
          '.chord-arc',
          { opacity: 0 },
          { opacity: 1, duration: 0.6, ease: 'power2.out', stagger: 0.06 },
        )
      }, svgRef.current)
    }
  }

  function handleSleepToggle() {
    setSleepSet((prev) => {
      const next = new Set(prev)
      if (next.has(sleepTarget)) {
        next.delete(sleepTarget)
      } else {
        next.add(sleepTarget)
      }
      return next
    })
  }

  function chordOpacity(chord: ChordData): number {
    const srcSleeping = sleepSet.has(chord.sourceName)
    const tgtSleeping = sleepSet.has(chord.targetName)
    if (srcSleeping || tgtSleeping) return 0

    if (hoveredNs === null) return 0.55

    if (chord.sourceName === hoveredNs || chord.targetName === hoveredNs) return 0.75
    return 0.12
  }

  function chordColor(chord: ChordData): string {
    const srcColor = NAMESPACE_COLORS[chord.sourceName]
    const tgtColor = NAMESPACE_COLORS[chord.targetName]
    if (hoveredNs === chord.sourceName) return srcColor
    if (hoveredNs === chord.targetName) return tgtColor
    return srcColor
  }

  const viewSize = (CHORD_RADIUS + ARC_THICKNESS + 40) * 2
  const center = viewSize / 2

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', py: 4, px: 2, pb: 12 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Namespace Dependency Chord
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Cross-namespace traffic — sleeping namespaces retract all chords
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {Array.from(sleepSet).map((ns) => (
            <Chip
              key={ns}
              label={ns}
              size="small"
              icon={<BedtimeIcon sx={{ fontSize: 14 }} />}
              sx={{ bgcolor: 'rgba(124,58,237,0.15)', color: '#A78BFA', fontSize: 11 }}
            />
          ))}
        </Box>
      </Box>

      {/* Chord Diagram */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${viewSize} ${viewSize}`}
          width="100%"
          style={{ maxWidth: 560 }}
          onMouseLeave={() => setHoveredNs(null)}
        >
          <g transform={`translate(${center}, ${center})`}>
            {/* Ribbons */}
            {chords.map((chord, i) => {
              const isSleeping = sleepSet.has(chord.sourceName) || sleepSet.has(chord.targetName)
              return (
                <motion.path
                  key={`${chord.sourceName}-${chord.targetName}`}
                  className="chord-ribbon"
                  d={ribbonPath(
                    chord.sourceStartAngle,
                    chord.sourceEndAngle,
                    chord.targetStartAngle,
                    chord.targetEndAngle,
                    CHORD_RADIUS,
                  )}
                  fill={chordColor(chord)}
                  animate={{
                    opacity: chordOpacity(chord),
                    scale: isSleeping ? 0 : 1,
                  }}
                  transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                  style={{ transformOrigin: '0px 0px' }}
                  onMouseEnter={() => {
                    if (!isSleeping) {
                      setHoveredNs(chord.sourceName)
                    }
                  }}
                />
              )
            })}

            {/* Arcs */}
            {arcs.map((arc) => (
              <motion.path
                key={arc.name}
                className="chord-arc"
                d={arcPath(arc.startAngle, arc.endAngle, CHORD_RADIUS, CHORD_RADIUS + ARC_THICKNESS)}
                fill={arc.color}
                animate={{
                  opacity: sleepSet.has(arc.name) ? 0.2 : hoveredNs && hoveredNs !== arc.name ? 0.4 : 1,
                }}
                transition={{ duration: 0.4 }}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredNs(arc.name)}
              />
            ))}

            {/* Labels */}
            {arcs.map((arc) => {
              const midAngle = (arc.startAngle + arc.endAngle) / 2
              const labelR = CHORD_RADIUS + ARC_THICKNESS + 16
              const x = labelR * Math.cos(midAngle)
              const y = labelR * Math.sin(midAngle)
              const rotation = (midAngle * 180) / Math.PI
              const flipText = rotation > 90 && rotation < 270

              return (
                <motion.text
                  key={`label-${arc.name}`}
                  x={x}
                  y={y}
                  textAnchor={flipText ? 'end' : 'start'}
                  dominantBaseline="central"
                  transform={`rotate(${flipText ? rotation + 180 : rotation}, ${x}, ${y})`}
                  fill={sleepSet.has(arc.name) ? 'rgba(148,163,184,0.3)' : 'rgba(226,232,240,0.85)'}
                  fontSize={11}
                  fontFamily='"Inter", sans-serif'
                  fontWeight={hoveredNs === arc.name ? 700 : 400}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onMouseEnter={() => setHoveredNs(arc.name)}
                  animate={{ opacity: sleepSet.has(arc.name) ? 0.3 : 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {arc.name}
                  {sleepSet.has(arc.name) ? ' 💤' : ''}
                </motion.text>
              )
            })}
          </g>
        </svg>
      </Box>

      {/* Bump Chart */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
          Traffic Rank Over 24h
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <BumpChart sleepSet={sleepSet} />
        </Box>
      </Box>

      {/* Hover tooltip */}
      <AnimatePresence>
        {hoveredNs && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            style={{ textAlign: 'center', marginTop: 8 }}
          >
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              <Box component="span" sx={{ color: NAMESPACE_COLORS[hoveredNs], fontWeight: 700 }}>
                {hoveredNs}
              </Box>
              {sleepSet.has(hoveredNs) ? ' — sleeping (chords retracted)' : ` — ${arcs.find((a) => a.name === hoveredNs)?.totalTraffic ?? 0} req/min total`}
            </Typography>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dev Toolbar */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          bgcolor: 'rgba(15,23,42,0.95)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(148,163,184,0.1)',
          px: 3,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, mr: 1 }}>
          DEV
        </Typography>

        <IconButton
          size="small"
          onClick={() => setPlaying(!playing)}
          sx={{ color: playing ? '#22C55E' : 'text.secondary' }}
        >
          {playing ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
        </IconButton>

        <IconButton size="small" onClick={handleReset} sx={{ color: 'text.secondary' }}>
          <ReplayIcon fontSize="small" />
        </IconButton>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 140 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
            Speed
          </Typography>
          <Slider
            size="small"
            value={speed}
            min={0.25}
            max={4}
            step={0.25}
            onChange={(_, v) => setSpeed(v as number)}
            sx={{ width: 80, color: 'primary.main' }}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 30 }}>
            {speed}x
          </Typography>
        </Box>

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <Select
            value={sleepTarget}
            onChange={(e) => setSleepTarget(e.target.value)}
            sx={{
              color: 'text.secondary',
              fontSize: 12,
              height: 32,
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.2)' },
            }}
          >
            {NAMESPACES.filter((ns) => ns !== 'production').map((ns) => (
              <MenuItem key={ns} value={ns} sx={{ fontSize: 12 }}>
                {ns}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          size="small"
          variant="outlined"
          startIcon={<BedtimeIcon sx={{ fontSize: 14 }} />}
          onClick={handleSleepToggle}
          sx={{
            fontSize: 11,
            textTransform: 'none',
            borderColor: 'rgba(148,163,184,0.2)',
            color: sleepSet.has(sleepTarget) ? '#22C55E' : '#A78BFA',
          }}
        >
          {sleepSet.has(sleepTarget) ? 'Wake' : 'Sleep'} {sleepTarget}
        </Button>
      </Box>
    </Box>
  )
}
