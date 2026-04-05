'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import Slide from '@mui/material/Slide'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Tooltip from '@mui/material/Tooltip'
import CloseIcon from '@mui/icons-material/Close'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import ReportProblemIcon from '@mui/icons-material/ReportProblem'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import { useIsDark } from '@/lib/useIsDark'
import { useColors } from '@/lib/colors'
import { useDrawerResize } from '@/lib/useDrawerResize'
import type { PolicyExecution, LogLine } from '@/lib/types'
import { LOG_LEVEL_COLORS_DARK, LOG_LEVEL_COLORS_LIGHT, getModeStyle } from '@/lib/statusColors'
import { useSnackbar } from '@/lib/useSnackbar'
import { LOG_WATERFALL_SX } from '@/lib/animations'
import ExecutionSummary from './ExecutionSummary'
import { useExecutionLogs } from './useExecutionLogs'

// ── Rollout Progress Bar (C3) ────────────────────────────────────────────────
//
// Requirements: R1–R11 (dynamic phases, accurate counting, proportional
// segments, per-phase colors, wave awareness, graceful degradation).

interface RolloutPhase {
  label: string
  color: string
  weight: number
}

const ESTIMATE_RE = /(?:Estimate:\s+\w+\s+(\d+)\s+workloads|Found\s+(\d+)\s+matching\s+workloads|restoring\s+(\d+)\s+snapshotted\s+workloads)/i
const WORKLOAD_NAME_RE = /(?:Slept |Restored |Enforced sleep on |Would sleep |Would restore |Would enforce sleep )(?:\w+\s+)?(\S+\/\S+)|(?:Scaled (?:deployment|statefulset) )(\S+)/
const DRAINED_RE = /^(Drained node |Would drain node )/i
const DRAIN_PHASE_RE = /^(Drain|Would drain |Drained node |Fetching nodes|Identifying nodes)/i
const WAVE_START_RE = /^Wave\s+(\d+)\/(\d+)/
const COMPLETE_RE = /(complete|completed|interrupted)/i

interface ParsedState {
  total: number
  scaled: number
  hasDrain: boolean
  drained: number
  hasWaves: boolean
  currentWave: number
  waveTotal: number
  scaledPerWave: Map<number, Set<string>>
  lineCount: number
  done: boolean
}

function parseLogState(lines: LogLine[]): ParsedState {
  let total = 0
  const scaledAll = new Set<string>()
  let hasDrain = false
  let drained = 0
  let hasWaves = false
  let currentWave = 0
  let waveTotal = 0
  const scaledPerWave = new Map<number, Set<string>>()
  let activeWave = 0
  let done = false

  for (const line of lines) {
    const msg = line.message

    if (!total) {
      const m = ESTIMATE_RE.exec(msg)
      if (m) total = parseInt(m[1] ?? m[2] ?? m[3], 10)
    }

    const wv = WAVE_START_RE.exec(msg)
    if (wv) {
      hasWaves = true
      activeWave = parseInt(wv[1], 10)
      waveTotal = parseInt(wv[2], 10)
      currentWave = activeWave
      if (!scaledPerWave.has(activeWave)) scaledPerWave.set(activeWave, new Set())
    }

    const wm = WORKLOAD_NAME_RE.exec(msg)
    if (wm) {
      const workloadName = wm[1] ?? wm[2]
      scaledAll.add(workloadName)
      if (hasWaves && activeWave > 0) {
        scaledPerWave.get(activeWave)?.add(workloadName)
      }
    }

    // #1 fix: Only count actual per-node drain completions, not headers/deletes
    if (DRAIN_PHASE_RE.test(msg)) hasDrain = true
    if (DRAINED_RE.test(msg)) drained++

    if (COMPLETE_RE.test(msg)) done = true
  }

  return {
    total, scaled: scaledAll.size, hasDrain, drained,
    hasWaves, currentWave, waveTotal, scaledPerWave,
    lineCount: lines.length, done,
  }
}

function buildPhases(state: ParsedState, direction: string, colors: ReturnType<typeof useColors>): RolloutPhase[] {
  const phases: RolloutPhase[] = []

  phases.push({ label: 'Discover', color: colors.info, weight: 0.10 })

  const hasDrainPhase = direction === 'sleep'
  const scaleWeight = hasDrainPhase ? 0.78 : 0.88

  if (state.hasWaves && state.waveTotal > 1) {
    const perWave = scaleWeight / state.waveTotal
    for (let i = 1; i <= state.waveTotal; i++) {
      phases.push({ label: '', color: colors.purple, weight: perWave })
    }
  } else {
    phases.push({ label: direction === 'wake' ? 'Restore' : 'Scale', color: colors.purple, weight: scaleWeight })
  }

  if (hasDrainPhase) {
    phases.push({ label: 'Drain', color: colors.vividYellow, weight: 0.10 })
  }

  phases.push({ label: 'Done', color: colors.success, weight: 0.02 })
  return phases
}

function computeProgress(
  state: ParsedState,
  phases: RolloutPhase[],
  status: string,
): { progress: number; activeIdx: number } {
  if (status === 'success' || state.done) {
    return { progress: 1, activeIdx: phases.length - 1 }
  }

  if (state.lineCount === 0) return { progress: 0, activeIdx: 0 }

  const bounds: number[] = [0]
  let sum = 0
  for (const p of phases) { sum += p.weight; bounds.push(sum) }

  const { total, scaled, hasDrain, drained, hasWaves, currentWave, waveTotal, scaledPerWave } = state
  const effectiveTotal = Math.max(total, scaled, 1)
  const doneIdx = phases.length - 1
  const drainIdx = phases.findIndex((p) => p.label === 'Drain')
  const clamp = status === 'failed' || status === 'interrupted' ? 0.95 : 0.98

  // Drain phase active
  if (hasDrain && drained > 0 && drainIdx >= 0) {
    const drainStart = bounds[drainIdx]
    const drainEnd = bounds[drainIdx + 1]
    const drainPct = Math.min(drained * 0.3, 1)
    return { progress: Math.min(drainStart + drainPct * (drainEnd - drainStart), clamp), activeIdx: drainIdx }
  }

  // #13 fix: If all workloads scaled and drain phase exists but no drain yet, show transition
  if (scaled > 0 && scaled >= effectiveTotal && drainIdx >= 0 && !hasDrain) {
    const drainStart = bounds[drainIdx]
    return { progress: Math.min(drainStart * 0.99, clamp), activeIdx: drainIdx }
  }

  // Discover phase — #2 fix: smoother ramp with wider discover
  if (scaled === 0) {
    const discoverEnd = bounds[1]
    const discoverPct = Math.min(state.lineCount * 0.12, 0.9)
    return { progress: discoverPct * discoverEnd, activeIdx: 0 }
  }

  // Scaling/restoring
  const scaleStartBound = bounds[1]
  const scaleEndBound = drainIdx >= 0 ? bounds[drainIdx] : bounds[doneIdx]

  if (hasWaves && waveTotal > 1) {
    let completedWavePct = 0
    let activeIdx = Math.min(currentWave, waveTotal)
    for (let w = 1; w <= waveTotal; w++) {
      const waveScaled = scaledPerWave.get(w)?.size ?? 0
      const wavePhaseIdx = w
      if (w < currentWave) {
        completedWavePct += phases[wavePhaseIdx].weight
      } else if (w === currentWave) {
        const waveWorkloadCount = Math.max(Math.ceil(effectiveTotal / waveTotal), 1)
        const withinPct = Math.min(waveScaled / waveWorkloadCount, 1)
        completedWavePct += withinPct * phases[wavePhaseIdx].weight
        activeIdx = wavePhaseIdx
      }
    }
    return { progress: Math.min(bounds[1] + completedWavePct, clamp), activeIdx }
  }

  const scalePct = Math.min(scaled / effectiveTotal, 1)
  const progress = scaleStartBound + scalePct * (scaleEndBound - scaleStartBound)
  return { progress: Math.min(progress, clamp), activeIdx: 1 }
}

// #6 fix: Extract label grouping to a named function
interface LabelGroup {
  label: string
  weight: number
  indices: number[]
}

function buildLabelGroups(phases: RolloutPhase[], direction: string): LabelGroup[] {
  const groups: LabelGroup[] = []
  for (let i = 0; i < phases.length; i++) {
    const p = phases[i]
    if (p.label === '' && groups.length > 0 && groups[groups.length - 1].label === '') {
      groups[groups.length - 1].weight += p.weight
      groups[groups.length - 1].indices.push(i)
    } else {
      groups.push({ label: p.label, weight: p.weight, indices: [i] })
    }
  }
  const waveGroup = groups.find((g) => g.label === '' && g.indices.length > 1)
  if (waveGroup) waveGroup.label = direction === 'wake' ? 'Restore' : 'Scale'
  return groups
}

// #6 fix: Extract fill segment merging to a named function
interface FillSegment {
  start: number
  end: number
  color: string
  hasActive: boolean
}

function buildFillSegments(
  phases: RolloutPhase[],
  bounds: number[],
  progress: number,
  activeIdx: number,
  isFailed: boolean,
  isRunning: boolean,
  errorColor: string,
): FillSegment[] {
  const fills: FillSegment[] = []
  for (let i = 0; i < phases.length; i++) {
    const segStart = bounds[i]
    const segEnd = bounds[i + 1]
    const fillWidth = Math.max(Math.min(progress, segEnd) - segStart, 0)
    if (fillWidth <= 0) continue

    const color = isFailed && i === activeIdx ? errorColor : phases[i].color
    const last = fills[fills.length - 1]

    // Merge consecutive same-color segments into a single fill
    // (the barberpole overlay is rendered separately)
    if (last && last.color === color) {
      last.end = segStart + fillWidth
    } else {
      fills.push({ start: segStart, end: segStart + fillWidth, color, hasActive: false })
    }
  }

  // Mark the fill containing the active segment for barberpole overlay
  if (isRunning) {
    const activeStart = bounds[activeIdx]
    for (const f of fills) {
      if (activeStart >= f.start && activeStart < f.end) {
        f.hasActive = true
        break
      }
    }
  }

  return fills
}

function RolloutProgressBar({ lines, status, direction }: { lines: LogLine[]; status: string; direction: string }) {
  // #5 fix: Use semantic colors from theme instead of hardcoded hex
  const colors = useColors()

  const state = useMemo(() => parseLogState(lines), [lines])
  const phases = useMemo(() => buildPhases(state, direction, colors), [state, direction, colors])
  const { progress, activeIdx } = computeProgress(state, phases, status)

  const isFailed = status === 'failed' || status === 'interrupted'
  const isSuccess = status === 'success'
  const isRunning = status === 'running'

  const bounds = useMemo(() => {
    const b = [0]
    let s = 0
    for (const p of phases) { s += p.weight; b.push(s) }
    return b
  }, [phases])

  const labelGroups = useMemo(() => buildLabelGroups(phases, direction), [phases, direction])
  const fills = useMemo(
    () => buildFillSegments(phases, bounds, progress, activeIdx, isFailed, isRunning, colors.error),
    [phases, bounds, progress, activeIdx, isFailed, isRunning, colors.error],
  )

  const pct = Math.round(progress * 100)

  return (
    <Box
      sx={{ px: 2.5, py: 1.5 }}
      // #3 fix: ARIA progressbar attributes
      role="progressbar"
      aria-label={`Execution progress: ${pct}%`}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {/* Phase labels */}
      <Box sx={{ display: 'flex', mb: 0.75 }}>
        {labelGroups.map((g) => {
          const isActive = g.indices.includes(activeIdx)
          const allBefore = g.indices.every((idx) => idx < activeIdx)
          return (
            <Box key={g.indices[0]} sx={{ flex: g.weight, textAlign: 'center', minWidth: 0 }}>
              <Typography
                variant="caption"
                noWrap
                sx={{
                  fontSize: 10,
                  fontWeight: isActive && isRunning ? 700 : 400,
                  color: allBefore || isSuccess ? colors.success
                    : isActive && isRunning ? phases[g.indices[0]].color
                    : isActive && isFailed ? colors.error
                    : 'text.disabled',
                  transition: 'color 300ms ease',
                }}
              >
                {g.label}
              </Typography>
            </Box>
          )
        })}
      </Box>

      {/* Segmented bar */}
      <Box sx={{ position: 'relative', height: 16, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        {/* Fills */}
        {fills.map((f, i) => (
          <Box
            key={`fill-${i}`}
            sx={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${f.start * 100}%`,
              width: `${(f.end - f.start) * 100}%`,
              bgcolor: f.color,
              transition: 'width 500ms cubic-bezier(0.22, 1, 0.36, 1)',
              // #15 fix: Barberpole slowed from 400ms to 700ms
              backgroundImage: f.hasActive
                ? 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255,255,255,0.1) 4px, rgba(255,255,255,0.1) 8px)'
                : undefined,
              backgroundSize: '16px 16px',
              animation: f.hasActive ? 'rolloutPole 700ms linear infinite' : undefined,
              '@keyframes rolloutPole': { '0%': { backgroundPosition: '0 0' }, '100%': { backgroundPosition: '16px 0' } },
            }}
          />
        ))}

        {/* Phase dividers — only between different-color phases, not between same-color waves */}
        {bounds.slice(1, -1).map((b, i) => {
          const leftColor = phases[i]?.color
          const rightColor = phases[i + 1]?.color
          if (leftColor === rightColor) return null
          return (
            <Box key={`div-${i}`} sx={{ position: 'absolute', left: `${b * 100}%`, top: 0, bottom: 0, width: 1, bgcolor: 'rgba(0,0,0,0.3)', zIndex: 3 }} />
          )
        })}

        {/* #17 fix: Glow tip only when progress > 0 */}
        {/* #15 fix: Tip pulse slowed to 1.2s, narrowed range */}
        {isRunning && progress > 0 && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${progress * 100}%`,
              width: 6,
              transform: 'translateX(-3px)',
              transition: 'left 500ms cubic-bezier(0.22, 1, 0.36, 1)',
              borderRadius: 0.5,
              bgcolor: 'white',
              opacity: 0.6,
              boxShadow: `0 0 8px ${phases[activeIdx]?.color ?? colors.purple}, 0 0 16px ${phases[activeIdx]?.color ?? colors.purple}60`,
              zIndex: 4,
              animation: 'rolloutTip 1.2s ease-in-out infinite',
              '@keyframes rolloutTip': { '0%, 100%': { opacity: 0.6 }, '50%': { opacity: 0.35 } },
            }}
          />
        )}

        {/* Success flash */}
        {isSuccess && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              bgcolor: 'rgba(255,255,255,0.25)',
              borderRadius: 1,
              animation: 'rolloutFlash 600ms ease-out forwards',
              '@keyframes rolloutFlash': { '0%': { opacity: 0.5 }, '100%': { opacity: 0 } },
            }}
          />
        )}

        {/* #4 + #16 fix: Percentage with dark backdrop for contrast, bumped to 11px */}
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 5,
            bgcolor: 'rgba(0,0,0,0.4)',
            borderRadius: 0.5,
            px: 0.5,
            lineHeight: 1,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              fontSize: 11,
              color: 'white',
            }}
          >
            {pct}%
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}

// ── Log line row ──────────────────────────────────────────────────────────────

function LogLineRow({ line }: { line: LogLine }) {
  const isDark = useIsDark()
  const colors = useColors()
  const levelColors = isDark ? LOG_LEVEL_COLORS_DARK : LOG_LEVEL_COLORS_LIGHT
  const color = levelColors[line.level] ?? colors.muted
  const isError = line.level === 'error'
  const isWarn = line.level === 'warn'
  return (
    <Box
      component="div"
      sx={{
        fontFamily: 'monospace',
        fontSize: 12,
        lineHeight: 1.7,
        color,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        borderLeft: `3px solid ${color}`,
        pl: 1,
        ml: 0.5,
        borderRadius: 0.5,
        bgcolor: isError ? 'rgba(239,68,68,0.06)' : 'transparent',
        '&:hover': { bgcolor: isError ? 'rgba(239,68,68,0.10)' : 'rgba(255,255,255,0.03)' },
        ...LOG_WATERFALL_SX,
      }}
    >
      <Box component="span" sx={{ opacity: 0.4, mr: 1.5, userSelect: 'none' }}>
        {new Date(line.timestamp).toLocaleTimeString()}
      </Box>
      <Box component="span" sx={{ fontWeight: isError || isWarn ? 500 : 400 }}>
        {line.message}
      </Box>
    </Box>
  )
}

export default function LogViewer({
  execution,
  onClose,
}: {
  execution: PolicyExecution | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const isDark = useIsDark()
  const { notify, SnackbarAlert } = useSnackbar()
  const { width: drawerWidth, onMouseDown: handleResizeMouseDown, onTouchStart: handleResizeTouchStart } = useDrawerResize(640)
  const [currentErrorIdx, setCurrentErrorIdx] = useState(-1)
  const [autoScroll, setAutoScroll] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const logContainerRef = useRef<HTMLDivElement>(null)
  const lineEls = useRef<(HTMLElement | null)[]>([])

  const isRunning = execution?.status === 'running'
  const [wsToastOpen, setWsToastOpen] = useState(false)
  const wasConnectedRef = useRef(false)

  const { lines, isConnected, logsError, maxRetriesReached } = useExecutionLogs(execution?.id, isRunning)

  // Show floating toast when WebSocket disconnects (only after it was connected)
  useEffect(() => {
    if (isConnected) {
      wasConnectedRef.current = true
      setWsToastOpen(false)
    } else if (wasConnectedRef.current && isRunning) {
      setWsToastOpen(true)
    }
  }, [isConnected, isRunning])

  // Reset error cursor and re-enable auto-scroll when switching executions
  useEffect(() => {
    setCurrentErrorIdx(-1)
    setWsToastOpen(false)
    wasConnectedRef.current = false
    setAutoScroll(true)
    lineEls.current = []
  }, [execution?.id])

  // Auto-scroll when enabled
  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [lines, autoScroll])

  // Detect manual scroll-up to pause auto-scroll, re-enable when scrolled to bottom
  useEffect(() => {
    const el = logContainerRef.current
    if (!el) return
    function handleScroll() {
      if (!el) return
      const SCROLL_THRESHOLD_PX = 40
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD_PX
      setAutoScroll(atBottom)
    }
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [execution?.id])

  const errorIndices = useMemo(
    () => lines.reduce<number[]>((acc, l, i) => {
      if (l.level === 'error') acc.push(i)
      return acc
    }, []),
    [lines],
  )

  function jumpToError() {
    if (errorIndices.length === 0) return
    const next = (currentErrorIdx + 1) % errorIndices.length
    setCurrentErrorIdx(next)
    lineEls.current[errorIndices[next]]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function handleCopy() {
    const text = lines
      .map((l) => `${new Date(l.timestamp).toLocaleTimeString()}  ${l.message}`)
      .join('\n')
    navigator.clipboard.writeText(text)
      .then(() => notify('Logs copied to clipboard', 'success'))
      .catch(() => notify('Failed to copy logs', 'error'))
  }

  return (
    <>
      <Drawer
        anchor="right"
        open={!!execution}
        onClose={onClose}
        slotProps={{ paper: {
          sx: {
            width: { xs: '100vw', md: drawerWidth },
            bgcolor: 'background.paper',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'visible',
          },
        } }}
      >
        {/* Resize handle */}
        <Box
          onMouseDown={handleResizeMouseDown}
          onTouchStart={handleResizeTouchStart}
          sx={{
            position: 'absolute',
            left: -4,
            top: 0,
            bottom: 0,
            width: 8,
            cursor: 'col-resize',
            zIndex: 1,
            '&:hover': { bgcolor: 'primary.main', opacity: 0.4 },
            display: { xs: 'none', md: 'block' },
          }}
        />

        {execution && (
          <>
            {/* Header */}
            <Box sx={{ p: 2.5, display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  {execution.direction === 'sleep' ? (
                    <BedtimeIcon sx={{ color: 'primary.main', fontSize: 18 }} />
                  ) : (
                    <WbSunnyIcon sx={{ color: 'warning.main', fontSize: 18 }} />
                  )}
                  <Typography variant="subtitle1" fontWeight={700}>
                    {execution.direction === 'sleep' ? 'Sleep' : 'Wake'} #{execution.id}
                  </Typography>
                  {isRunning && <CircularProgress size={14} />}
                </Box>
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                  <Chip
                    label={execution.mode.toUpperCase()}
                    size="small"
                    sx={{
                      height: 18, fontSize: 10,
                      bgcolor: getModeStyle(isDark, execution.mode).bg,
                      color: getModeStyle(isDark, execution.mode).color,
                    }}
                  />
                  {execution.direction === 'wake' ? (
                    <Chip
                      icon={<ArrowUpwardIcon sx={{ fontSize: '12px !important' }} />}
                      label={`${execution.countScaled} restored`}
                      size="small"
                      sx={{ height: 18, fontSize: 10 }}
                    />
                  ) : (
                    <Chip
                      icon={<ArrowDownwardIcon sx={{ fontSize: '12px !important' }} />}
                      label={`${execution.countScaled} scaled`}
                      size="small"
                      sx={{ height: 18, fontSize: 10 }}
                    />
                  )}
                  {execution.countDrained > 0 && (
                    <Chip
                      icon={<CloudOffIcon sx={{ fontSize: '12px !important' }} />}
                      label={`${execution.countDrained} drained`}
                      size="small"
                      sx={{ height: 18, fontSize: 10 }}
                    />
                  )}
                  {execution.countErrors > 0 && (
                    <Chip
                      icon={<ErrorOutlineIcon sx={{ fontSize: '12px !important' }} />}
                      label={`${execution.countErrors} errors`}
                      size="small"
                      color="error"
                      sx={{ height: 18, fontSize: 10 }}
                    />
                  )}
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {errorIndices.length > 0 && (
                  <Tooltip title={`Jump to error${errorIndices.length > 1 ? ` (${currentErrorIdx === -1 ? 1 : currentErrorIdx + 1}/${errorIndices.length})` : ''}`}>
                    <IconButton size="small" onClick={jumpToError} aria-label="Jump to error">
                      <ReportProblemIcon fontSize="small" sx={{ color: 'error.main' }} />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Copy logs">
                  <span>
                    <IconButton size="small" onClick={handleCopy} disabled={lines.length === 0} aria-label="Copy logs">
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <IconButton size="small" onClick={onClose} aria-label="Close log viewer">
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>

            <Divider />

            <RolloutProgressBar lines={lines} status={execution.status} direction={execution.direction} />

            <ExecutionSummary lines={lines} />

            {/* Log area */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
              <Box sx={{ minHeight: 40, px: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" fontWeight={700} letterSpacing={0.8} sx={{ color: 'text.secondary', textTransform: 'uppercase' }}>
                  Logs
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={autoScroll}
                      onChange={(e) => {
                        const on = e.target.checked
                        setAutoScroll(on)
                        if (on) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
                      }}
                      sx={{ '& .MuiSwitch-thumb': { background: (t) => t.palette.primary.main } }}
                    />
                  }
                  label={<Typography variant="caption" sx={{ color: 'text.secondary' }}>Auto-scroll</Typography>}
                  sx={{ m: 0 }}
                />
              </Box>
              {/* WebSocket disconnected — floating toast handled below */}
              {logsError && !isRunning && (
                <Alert
                  severity="error"
                  sx={{ borderRadius: 0 }}
                  action={
                    <Button color="inherit" size="small" onClick={() => queryClient.invalidateQueries({ queryKey: ['logs', execution?.id] })}>
                      Retry
                    </Button>
                  }
                >
                  Could not load logs.
                </Alert>
              )}
              {maxRetriesReached && isRunning && (
                <Alert severity="error" sx={{ borderRadius: 0 }}>
                  Log stream failed after {10} reconnect attempts.
                </Alert>
              )}
              <Box ref={logContainerRef} role="log" aria-label="Execution logs" sx={{ flex: 1, overflow: 'auto', p: 2, bgcolor: 'background.default', minHeight: 0 }}>
                {lines.length === 0 && !isRunning && !logsError && (
                  <Typography variant="body2" color="text.secondary">
                    No log lines found.
                  </Typography>
                )}
                {lines.map((line, i) => (
                  <Box key={`${line.id ?? line.seq}-${i}`} ref={(el: HTMLElement | null) => { lineEls.current[i] = el }}>
                    <LogLineRow line={line} />
                  </Box>
                ))}
                <div ref={bottomRef} />
              </Box>
            </Box>
          </>
        )}
      </Drawer>

      {/* WebSocket disconnect floating toast */}
      <Snackbar
        open={wsToastOpen}
        autoHideDuration={isConnected ? 3000 : undefined}
        onClose={() => setWsToastOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        TransitionComponent={Slide}
        sx={{ mt: 1 }}
      >
        <Alert
          severity="warning"
          variant="filled"
          onClose={() => setWsToastOpen(false)}
          sx={{ minWidth: 280, boxShadow: 6, borderRadius: 2 }}
        >
          Log stream disconnected — reconnecting...
        </Alert>
      </Snackbar>

      {SnackbarAlert}
    </>
  )
}
