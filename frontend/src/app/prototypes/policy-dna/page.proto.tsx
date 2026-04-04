'use client'

// PROTOTYPE: Policy DNA Sequencer
// DEPS: framer-motion gsap
// LIBS: D3 math, SVG, Framer Motion, GSAP
// DATA: Policy schedules, sleep windows
// DESCRIPTION: Policy sleep windows visualized as a DNA double-helix timeline

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import ButtonGroup from '@mui/material/ButtonGroup'
import Chip from '@mui/material/Chip'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SleepWindow {
  startHour: number
  endHour: number
  days: number[]
}

interface PolicySchedule {
  name: string
  targets: string[]
  savingsPerMinute: number
  windows: SleepWindow[]
  color: string
  accentColor: string
}

interface BasePair {
  index: number
  hour: number
  minute: number
  state: 'sleeping' | 'awake' | 'transitioning'
  policyName: string
  saving: number
}

interface TooltipData {
  x: number
  y: number
  pair: BasePair
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const POLICIES: PolicySchedule[] = [
  {
    name: 'Non-production Sleep',
    targets: ['staging', 'dev-sandbox', 'internal-tools'],
    savingsPerMinute: 0.43,
    windows: [
      { startHour: 19, endHour: 31, days: [1, 2, 3, 4, 5] },
      { startHour: 0, endHour: 24, days: [0, 6] },
    ],
    color: '#3B82F6',
    accentColor: '#60A5FA',
  },
  {
    name: 'ML Training Shutdown',
    targets: ['ml-training'],
    savingsPerMinute: 0.18,
    windows: [
      { startHour: 22, endHour: 30, days: [0, 1, 2, 3, 4, 5, 6] },
    ],
    color: '#A855F7',
    accentColor: '#C084FC',
  },
  {
    name: 'Weekend Full Sleep',
    targets: ['payments', 'auth-service'],
    savingsPerMinute: 0.31,
    windows: [
      { startHour: 0, endHour: 24, days: [0, 6] },
    ],
    color: '#F59E0B',
    accentColor: '#FCD34D',
  },
]

const TOTAL_PAIRS = 48
const PAIR_DURATION_MIN = 30

// ---------------------------------------------------------------------------
// Helix math
// ---------------------------------------------------------------------------

const HELIX_CONFIG = {
  pairWidth: 32,
  amplitude: 28,
  strandThickness: 3,
  pairStroke: 2,
  verticalPadding: 60,
  rotationsPerDay: 4,
}

function computeHelixY(index: number, strand: 0 | 1): number {
  const phase = strand === 0 ? 0 : Math.PI
  const frequency = (2 * Math.PI * HELIX_CONFIG.rotationsPerDay) / TOTAL_PAIRS
  return HELIX_CONFIG.amplitude * Math.sin(frequency * index + phase)
}

function computeHelixX(index: number): number {
  return index * HELIX_CONFIG.pairWidth + HELIX_CONFIG.pairWidth / 2
}

// ---------------------------------------------------------------------------
// Schedule helpers
// ---------------------------------------------------------------------------

function isSleeping(policy: PolicySchedule, hour: number, dayOfWeek: number): boolean {
  return policy.windows.some(window => {
    if (!window.days.includes(dayOfWeek)) return false
    const normalizedEnd = window.endHour > 24 ? window.endHour : window.endHour
    if (window.startHour < normalizedEnd) {
      return hour >= window.startHour && hour < normalizedEnd
    }
    return hour >= window.startHour || hour < (normalizedEnd % 24)
  })
}

function buildBasePairs(policy: PolicySchedule, dayOfWeek: number): BasePair[] {
  return Array.from({ length: TOTAL_PAIRS }, (_, i) => {
    const hour = Math.floor(i / 2)
    const minute = (i % 2) * 30
    const normalizedHour = hour + minute / 60
    const sleeping = isSleeping(policy, normalizedHour, dayOfWeek)
    const nextSleeping = i < TOTAL_PAIRS - 1
      ? isSleeping(policy, Math.floor((i + 1) / 2) + ((i + 1) % 2) * 0.5, dayOfWeek)
      : sleeping
    const transitioning = sleeping !== nextSleeping

    return {
      index: i,
      hour,
      minute,
      state: transitioning ? 'transitioning' : sleeping ? 'sleeping' : 'awake',
      policyName: policy.name,
      saving: sleeping ? policy.savingsPerMinute * PAIR_DURATION_MIN : 0,
    }
  })
}

function findNextTransitionIndex(pairs: BasePair[], currentTime: number): number {
  const currentIndex = Math.floor(currentTime / PAIR_DURATION_MIN) % TOTAL_PAIRS
  for (let offset = 1; offset <= TOTAL_PAIRS; offset++) {
    const checkIndex = (currentIndex + offset) % TOTAL_PAIRS
    if (pairs[checkIndex]?.state === 'transitioning') return checkIndex
  }
  return -1
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const STATE_COLORS = {
  sleeping: { fill: '#1E293B', stroke: '#334155', glow: 'rgba(251,146,60,0.15)' },
  awake: { fill: '#D1FAE5', stroke: '#6EE7B7', glow: 'rgba(110,231,183,0.4)' },
  transitioning: { fill: '#FDE68A', stroke: '#F59E0B', glow: 'rgba(245,158,11,0.5)' },
}

// ---------------------------------------------------------------------------
// HelixStrand component
// ---------------------------------------------------------------------------

function HelixStrand({
  pairs,
  policyColor,
  helixIndex,
  isPlaying,
  speed,
  onHover,
  onLeave,
}: {
  pairs: BasePair[]
  policyColor: string
  helixIndex: number
  isPlaying: boolean
  speed: number
  onHover: (data: TooltipData) => void
  onLeave: () => void
}) {
  const svgRef = useRef<SVGGElement>(null)
  const scanLineRef = useRef<SVGLineElement>(null)
  const glowRefs = useRef<(SVGCircleElement | null)[]>([])
  const timelineRef = useRef<gsap.core.Timeline | null>(null)

  const svgWidth = TOTAL_PAIRS * HELIX_CONFIG.pairWidth + HELIX_CONFIG.pairWidth
  const midY = HELIX_CONFIG.amplitude + HELIX_CONFIG.verticalPadding / 2

  const strandPath = useCallback((strand: 0 | 1) => {
    const points: string[] = []
    for (let i = 0; i <= TOTAL_PAIRS; i++) {
      const x = computeHelixX(i)
      const y = midY + computeHelixY(i, strand)
      points.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`)
    }
    return points.join(' ')
  }, [midY])

  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.kill()
    }

    const tl = gsap.timeline({ repeat: -1, paused: !isPlaying })
    timelineRef.current = tl

    if (scanLineRef.current) {
      tl.fromTo(
        scanLineRef.current,
        { attr: { x1: 0, x2: 0 } },
        {
          attr: { x1: svgWidth, x2: svgWidth },
          duration: 12 / speed,
          ease: 'none',
        },
      )
    }

    glowRefs.current.forEach((el, i) => {
      if (!el) return
      const pair = pairs[i]
      if (pair.state === 'transitioning') {
        tl.to(el, {
          attr: { r: 8 },
          opacity: 0.8,
          duration: 0.6 / speed,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        }, 0)
      }
      if (pair.state === 'sleeping') {
        tl.to(el, {
          opacity: 0.3,
          duration: 2 / speed,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        }, i * 0.05)
      }
    })

    return () => {
      tl.kill()
    }
  }, [pairs, isPlaying, speed, svgWidth])

  useEffect(() => {
    if (!timelineRef.current) return
    if (isPlaying) {
      timelineRef.current.play()
    } else {
      timelineRef.current.pause()
    }
  }, [isPlaying])

  const handlePairHover = useCallback((e: React.MouseEvent, pair: BasePair) => {
    onHover({
      x: e.clientX,
      y: e.clientY,
      pair,
    })
  }, [onHover])

  return (
    <g ref={svgRef}>
      {/* Strand 0 glow */}
      <path
        d={strandPath(0)}
        fill="none"
        stroke={policyColor}
        strokeWidth={HELIX_CONFIG.strandThickness + 4}
        strokeOpacity={0.15}
      />
      {/* Strand 0 */}
      <path
        d={strandPath(0)}
        fill="none"
        stroke={policyColor}
        strokeWidth={HELIX_CONFIG.strandThickness}
        strokeOpacity={0.8}
        strokeLinecap="round"
      />
      {/* Strand 1 glow */}
      <path
        d={strandPath(1)}
        fill="none"
        stroke={policyColor}
        strokeWidth={HELIX_CONFIG.strandThickness + 4}
        strokeOpacity={0.15}
      />
      {/* Strand 1 */}
      <path
        d={strandPath(1)}
        fill="none"
        stroke={policyColor}
        strokeWidth={HELIX_CONFIG.strandThickness}
        strokeOpacity={0.8}
        strokeLinecap="round"
      />

      {/* Base pairs */}
      {pairs.map((pair, i) => {
        const x = computeHelixX(i)
        const y0 = midY + computeHelixY(i, 0)
        const y1 = midY + computeHelixY(i, 1)
        const colors = STATE_COLORS[pair.state]
        const depth = Math.cos((2 * Math.PI * HELIX_CONFIG.rotationsPerDay / TOTAL_PAIRS) * i)
        const opacity = 0.5 + 0.5 * Math.abs(depth)

        return (
          <g
            key={i}
            onMouseEnter={(e) => handlePairHover(e, pair)}
            onMouseLeave={onLeave}
            style={{ cursor: 'pointer' }}
          >
            {/* Connecting line */}
            <line
              x1={x}
              y1={y0}
              x2={x}
              y2={y1}
              stroke={colors.stroke}
              strokeWidth={HELIX_CONFIG.pairStroke}
              strokeOpacity={opacity}
            />
            {/* Top node */}
            <circle
              cx={x}
              cy={y0}
              r={3}
              fill={colors.fill}
              stroke={colors.stroke}
              strokeWidth={1}
              opacity={opacity}
            />
            {/* Bottom node */}
            <circle
              cx={x}
              cy={y1}
              r={3}
              fill={colors.fill}
              stroke={colors.stroke}
              strokeWidth={1}
              opacity={opacity}
            />
            {/* Glow circle for animated states */}
            <circle
              ref={(el) => { glowRefs.current[i] = el }}
              cx={x}
              cy={midY}
              r={pair.state === 'transitioning' ? 5 : 4}
              fill={colors.glow}
              opacity={pair.state === 'awake' ? 0 : 0.2}
            />
          </g>
        )
      })}

      {/* Scan line */}
      <line
        ref={scanLineRef}
        x1={0}
        y1={midY - HELIX_CONFIG.amplitude - 10}
        x2={0}
        y2={midY + HELIX_CONFIG.amplitude + 10}
        stroke={policyColor}
        strokeWidth={1.5}
        strokeOpacity={0.6}
        strokeDasharray="4 3"
      />
    </g>
  )
}

// ---------------------------------------------------------------------------
// Tooltip component
// ---------------------------------------------------------------------------

function PairTooltip({ data }: { data: TooltipData }) {
  const { pair } = data
  const timeStr = `${String(pair.hour).padStart(2, '0')}:${String(pair.minute).padStart(2, '0')}`
  const endMinute = pair.minute + PAIR_DURATION_MIN
  const endHour = pair.hour + Math.floor(endMinute / 60)
  const endMin = endMinute % 60
  const endStr = `${String(endHour % 24).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`

  const stateIcon = pair.state === 'sleeping'
    ? <BedtimeIcon sx={{ fontSize: 14, color: '#64748B' }} />
    : pair.state === 'awake'
      ? <WbSunnyIcon sx={{ fontSize: 14, color: '#6EE7B7' }} />
      : <WarningAmberIcon sx={{ fontSize: 14, color: '#F59E0B' }} />

  return (
    <Box
      sx={{
        position: 'fixed',
        left: data.x + 14,
        top: data.y - 80,
        zIndex: 10000,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        p: 1.5,
        minWidth: 200,
        pointerEvents: 'none',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        {stateIcon}
        <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', fontSize: 10 }}>
          {pair.state}
        </Typography>
      </Box>
      <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
        {timeStr} – {endStr}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        Policy: {pair.policyName}
      </Typography>
      {pair.saving > 0 && (
        <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600 }}>
          Saves ${pair.saving.toFixed(2)} this window
        </Typography>
      )}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function PolicyDnaPrototype() {
  const router = useRouter()
  const [isPlaying, setIsPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [key, setKey] = useState(0)
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const entranceTlRef = useRef<gsap.core.Timeline | null>(null)
  const helixGroupRefs = useRef<(HTMLDivElement | null)[]>([])

  const dayOfWeek = 2

  const policyPairs = useMemo(() => {
    return POLICIES.map(policy => ({
      policy,
      pairs: buildBasePairs(policy, dayOfWeek),
    }))
  }, [dayOfWeek])

  const overlapMap = useMemo(() => {
    const map = new Map<number, number>()
    for (let i = 0; i < TOTAL_PAIRS; i++) {
      let sleepCount = 0
      policyPairs.forEach(({ pairs }) => {
        if (pairs[i].state === 'sleeping') sleepCount++
      })
      map.set(i, sleepCount)
    }
    return map
  }, [policyPairs])

  const svgWidth = TOTAL_PAIRS * HELIX_CONFIG.pairWidth + HELIX_CONFIG.pairWidth
  const helixHeight = HELIX_CONFIG.amplitude * 2 + HELIX_CONFIG.verticalPadding

  useEffect(() => {
    if (entranceTlRef.current) {
      entranceTlRef.current.kill()
    }

    const tl = gsap.timeline()
    entranceTlRef.current = tl

    helixGroupRefs.current.forEach((el, i) => {
      if (!el) return
      gsap.set(el, { opacity: 0, y: 30 })
      tl.to(el, {
        opacity: 1,
        y: 0,
        duration: 0.6,
        ease: 'power2.out',
      }, i * 0.4)
    })

    return () => {
      tl.kill()
    }
  }, [key])

  const handleReset = useCallback(() => {
    setKey(k => k + 1)
    setIsPlaying(true)
  }, [])

  const handleHover = useCallback((data: TooltipData) => {
    setTooltip(data)
  }, [])

  const handleLeave = useCallback(() => {
    setTooltip(null)
  }, [])

  const totalDailySavings = useMemo(() => {
    return policyPairs.reduce((sum, { pairs }) => {
      return sum + pairs.reduce((s, p) => s + p.saving, 0)
    }, 0)
  }, [policyPairs])

  return (
    <Box sx={{ minHeight: '100vh', pb: 10 }}>
      {/* Header */}
      <Box sx={{ maxWidth: 1200, mx: 'auto', pt: 4, px: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <IconButton onClick={() => router.push('/prototypes/')} size="small">
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" fontWeight={800}>
              FL14 — Policy DNA Sequencer
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sleep windows as a DNA double-helix — each base pair = 30 min
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip
              icon={<BedtimeIcon sx={{ fontSize: 14 }} />}
              label="Tuesday"
              size="small"
              variant="outlined"
            />
            <Chip
              label={`$${totalDailySavings.toFixed(0)}/day saved`}
              size="small"
              sx={{ bgcolor: 'success.main', color: 'success.contrastText', fontWeight: 700 }}
            />
          </Box>
        </Box>

        {/* Legend */}
        <Box
          sx={{
            display: 'flex',
            gap: 3,
            mb: 3,
            p: 1.5,
            borderRadius: 2,
            bgcolor: 'action.hover',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          {[
            { label: 'Sleeping', color: STATE_COLORS.sleeping.stroke, icon: <BedtimeIcon sx={{ fontSize: 12 }} /> },
            { label: 'Awake', color: STATE_COLORS.awake.stroke, icon: <WbSunnyIcon sx={{ fontSize: 12 }} /> },
            { label: 'Transitioning', color: STATE_COLORS.transitioning.stroke, icon: <WarningAmberIcon sx={{ fontSize: 12 }} /> },
          ].map(item => (
            <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: item.color }} />
              {item.icon}
              <Typography variant="caption" color="text.secondary">{item.label}</Typography>
            </Box>
          ))}
          <Box sx={{ ml: 'auto', display: 'flex', gap: 2 }}>
            {POLICIES.map(p => (
              <Box key={p.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 16, height: 3, borderRadius: 1, bgcolor: p.color }} />
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                  {p.name}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Overlap indicator */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            Overlap density — brighter = more policies sleeping simultaneously
          </Typography>
          <Box sx={{ display: 'flex', height: 6, borderRadius: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
            {Array.from({ length: TOTAL_PAIRS }, (_, i) => {
              const count = overlapMap.get(i) ?? 0
              const intensity = count / POLICIES.length
              return (
                <Box
                  key={i}
                  sx={{
                    flex: 1,
                    bgcolor: count === 0
                      ? 'action.disabledBackground'
                      : `rgba(59, 130, 246, ${0.2 + intensity * 0.8})`,
                    transition: 'background-color 0.3s',
                  }}
                />
              )
            })}
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.25 }}>
            {Array.from({ length: 9 }, (_, i) => (
              <Typography key={i} variant="caption" sx={{ fontSize: 9, color: 'text.disabled', fontFamily: 'monospace' }}>
                {String(i * 3).padStart(2, '0')}:00
              </Typography>
            ))}
          </Box>
        </Box>
      </Box>

      {/* Helix area */}
      <Box
        ref={scrollRef}
        sx={{
          overflowX: 'auto',
          overflowY: 'visible',
          px: 2,
          pb: 2,
          '&::-webkit-scrollbar': { height: 6 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'action.disabled', borderRadius: 3 },
        }}
      >
        <Box sx={{ minWidth: svgWidth + 200, maxWidth: svgWidth + 200, mx: 'auto' }}>
          {/* Time axis */}
          <Box sx={{ display: 'flex', ml: '160px', mb: 0.5 }}>
            {Array.from({ length: 25 }, (_, i) => (
              <Typography
                key={i}
                variant="caption"
                sx={{
                  width: HELIX_CONFIG.pairWidth * 2,
                  fontSize: 10,
                  color: 'text.disabled',
                  fontFamily: 'monospace',
                  textAlign: 'center',
                }}
              >
                {String(i).padStart(2, '0')}:00
              </Typography>
            ))}
          </Box>

          {/* Policy helices */}
          <AnimatePresence mode="wait">
            {policyPairs.map(({ policy, pairs }, helixIdx) => (
              <Box
                key={`${key}-${helixIdx}`}
                ref={(el: HTMLDivElement | null) => { helixGroupRefs.current[helixIdx] = el }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  mb: 1,
                  opacity: 0,
                }}
              >
                {/* Policy label */}
                <Box sx={{ width: 160, pr: 2, flexShrink: 0 }}>
                  <Typography variant="body2" fontWeight={700} sx={{ color: policy.color, fontSize: 13 }}>
                    {policy.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, display: 'block' }}>
                    {policy.targets.join(', ')}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600, fontSize: 10 }}>
                    ${policy.savingsPerMinute}/min
                  </Typography>
                </Box>

                {/* Helix SVG */}
                <svg
                  width={svgWidth}
                  height={helixHeight}
                  viewBox={`0 0 ${svgWidth} ${helixHeight}`}
                  style={{ display: 'block' }}
                >
                  <HelixStrand
                    pairs={pairs}
                    policyColor={policy.color}
                    helixIndex={helixIdx}
                    isPlaying={isPlaying}
                    speed={speed}
                    onHover={handleHover}
                    onLeave={handleLeave}
                  />
                </svg>
              </Box>
            ))}
          </AnimatePresence>
        </Box>
      </Box>

      {/* Tooltip */}
      {tooltip && <PairTooltip data={tooltip} />}

      {/* Policy summary cards */}
      <Box sx={{ maxWidth: 1200, mx: 'auto', px: 2, mt: 3 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
          {policyPairs.map(({ policy, pairs }) => {
            const sleepingPairs = pairs.filter(p => p.state === 'sleeping').length
            const transitionPairs = pairs.filter(p => p.state === 'transitioning').length
            const sleepHours = (sleepingPairs * PAIR_DURATION_MIN) / 60
            const dailySaving = pairs.reduce((s, p) => s + p.saving, 0)
            const nextTransition = findNextTransitionIndex(pairs, 0)
            const nextTime = nextTransition >= 0
              ? `${String(Math.floor(nextTransition / 2)).padStart(2, '0')}:${nextTransition % 2 === 0 ? '00' : '30'}`
              : 'None'

            return (
              <motion.div
                key={policy.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + policyPairs.indexOf(policyPairs.find(pp => pp.policy === policy)!) * 0.2 }}
              >
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <Box sx={{ width: 4, height: 24, borderRadius: 1, bgcolor: policy.color }} />
                    <Typography variant="body2" fontWeight={700}>{policy.name}</Typography>
                  </Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                        Sleep hours
                      </Typography>
                      <Typography variant="h6" fontWeight={800} sx={{ fontSize: 18 }}>
                        {sleepHours.toFixed(1)}h
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                        Daily savings
                      </Typography>
                      <Typography variant="h6" fontWeight={800} sx={{ fontSize: 18, color: 'success.main' }}>
                        ${dailySaving.toFixed(0)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                        Transitions
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {transitionPairs}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                        Next transition
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {nextTime}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </motion.div>
            )
          })}
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
          py: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
        }}
      >
        <Typography variant="caption" fontWeight={700} sx={{ color: 'text.secondary', fontSize: 10, mr: 1 }}>
          DEV TOOLBAR
        </Typography>

        <IconButton
          size="small"
          onClick={() => setIsPlaying(p => !p)}
          sx={{ bgcolor: 'action.hover' }}
        >
          {isPlaying ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
        </IconButton>

        <IconButton
          size="small"
          onClick={handleReset}
          sx={{ bgcolor: 'action.hover' }}
        >
          <RestartAltIcon fontSize="small" />
        </IconButton>

        <Box sx={{ height: 20, width: 1, bgcolor: 'divider' }} />

        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
          Speed
        </Typography>
        <ButtonGroup size="small" variant="outlined">
          {[1, 2, 5].map(s => (
            <Button
              key={s}
              onClick={() => setSpeed(s)}
              variant={speed === s ? 'contained' : 'outlined'}
              sx={{ minWidth: 36, fontSize: 11 }}
            >
              {s}x
            </Button>
          ))}
        </ButtonGroup>

        <Box sx={{ height: 20, width: 1, bgcolor: 'divider' }} />

        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
          {isPlaying ? 'Playing' : 'Paused'} · {TOTAL_PAIRS} base pairs · {POLICIES.length} policies
        </Typography>
      </Box>
    </Box>
  )
}
