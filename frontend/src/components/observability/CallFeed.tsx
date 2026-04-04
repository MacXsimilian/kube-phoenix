'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Button from '@mui/material/Button'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { useTheme, alpha, type Theme } from '@mui/material/styles'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import SearchIcon from '@mui/icons-material/Search'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import type { ApiCall } from '@/lib/observability-types'

// ── Constants ──────────────────────────────────────────────────────────────

const CATEGORIES = ['all', 'http', 'k8s', 'store', 'internal', 'ws'] as const
type CategoryFilter = (typeof CATEGORIES)[number]

const METHOD_COLORS: Record<string, string> = {
  GET: '#22C55E', POST: '#3B82F6', PUT: '#F59E0B', DELETE: '#EF4444',
  PATCH: '#A855F7', WS: '#06B6D4', SSE: '#8B5CF6',
}

const CATEGORY_COLORS: Record<string, string> = {
  http: '#60A5FA', k8s: '#A78BFA', store: '#34D399', internal: '#94A3B8', ws: '#FBBF24',
}

const DURATION_CAP_MS = 200
const ROW_HEIGHT = 28
const CALLS_PER_SEC_WINDOW_MS = 10_000
const RELATIVE_TIME_INTERVAL_MS = 1_000
const SCROLL_NEAR_BOTTOM_PX = 40
const SKELETON_ROW_COUNT = 8
const COPY_FEEDBACK_MS = 1_500
const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
const ANIMATED_ROW_COUNT = 5
const SPARKLINE_BAR_WIDTH = 4
const SPARKLINE_MAX_HEIGHT = 16

type ViewMode = 'stream' | 'grouped'

interface CallGroup {
  key: string
  component: string
  goFunc: string
  count: number
  avgDurationMs: number
  errorPercent: number
}

interface LatencyBucket {
  count: number
  color: string
}

const TABLE_COLUMNS = '68px 52px 1fr 1fr 80px 72px'
const COLUMN_HEADERS = ['Time', 'Method', 'Path', 'Function', 'Component', 'Duration']

const livePulseAnimation = {
  animation: 'livePulse 1.8s ease-in-out infinite',
  '@keyframes livePulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.2 } },
} as const

const rowEntrance = {
  initial: { opacity: 0, y: -8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
  transition: { duration: 0.2, ease: 'easeOut' as const },
}

// ── Hooks ──────────────────────────────────────────────────────────────────

function useFilteredCalls(calls: ApiCall[], filter: CategoryFilter, search: string): ApiCall[] {
  return useMemo(() => {
    const byCategory = filter === 'all' ? calls : calls.filter((c) => c.category === filter)
    if (!search.trim()) return byCategory
    const term = search.toLowerCase()
    return byCategory.filter((c) => matchesSearch(c, term))
  }, [calls, filter, search])
}

function useTickingClock(setNow: (t: number) => void) {
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), RELATIVE_TIME_INTERVAL_MS)
    return () => clearInterval(id)
  }, [setNow])
}

function useCallsPerSec(calls: ApiCall[], now: number): number {
  return useMemo(() => {
    const cutoff = now - CALLS_PER_SEC_WINDOW_MS
    const recent = calls.filter((c) => new Date(c.timestamp).getTime() > cutoff)
    return recent.length / (CALLS_PER_SEC_WINDOW_MS / 1000)
  }, [calls, now])
}

function useAutoScroll(calls: ApiCall[]) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isScrollPaused, setIsScrollPaused] = useState(false)

  const isNearBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_NEAR_BOTTOM_PX
  }, [])

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    setIsScrollPaused(false)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const handleScroll = () => setIsScrollPaused(!isNearBottom())
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [isNearBottom])

  useEffect(() => {
    if (!isScrollPaused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [calls.length, isScrollPaused])

  return { scrollRef, isScrollPaused, scrollToBottom }
}

function matchesSearch(call: ApiCall, term: string): boolean {
  return (
    call.path.toLowerCase().includes(term) ||
    call.goFunc.toLowerCase().includes(term) ||
    call.component.toLowerCase().includes(term)
  )
}

function useLatencyBuckets(calls: ApiCall[]): LatencyBucket[] {
  return useMemo(() => {
    let fast = 0, medium = 0, slow = 0
    for (const c of calls) {
      if (c.durationMs < 50) fast++
      else if (c.durationMs <= 100) medium++
      else slow++
    }
    return [
      { count: fast, color: '#22C55E' },
      { count: medium, color: '#F59E0B' },
      { count: slow, color: '#EF4444' },
    ]
  }, [calls])
}

function useGroupedCalls(calls: ApiCall[]): CallGroup[] {
  return useMemo(() => {
    const map = new Map<string, { total: number; durationSum: number; errors: number; component: string; goFunc: string }>()
    for (const c of calls) {
      const key = `${c.component}::${c.goFunc}`
      const entry = map.get(key) ?? { total: 0, durationSum: 0, errors: 0, component: c.component, goFunc: c.goFunc }
      entry.total++
      entry.durationSum += c.durationMs
      if (c.statusCode >= 400) entry.errors++
      map.set(key, entry)
    }
    return Array.from(map.entries())
      .map(([key, e]) => ({
        key,
        component: e.component,
        goFunc: e.goFunc,
        count: e.total,
        avgDurationMs: e.durationSum / e.total,
        errorPercent: (e.errors / e.total) * 100,
      }))
      .sort((a, b) => b.count - a.count)
  }, [calls])
}

function getDurationColor(ms: number, theme: Theme): string {
  if (ms > 100) return theme.palette.error.main
  if (ms > 50) return theme.palette.warning.main
  return theme.palette.success.main
}

// ── Props ──────────────────────────────────────────────────────────────────

interface CallFeedProps {
  calls: ApiCall[]
}

// ── Component ──────────────────────────────────────────────────────────────

export default function CallFeed({ calls }: CallFeedProps) {
  const [filter, setFilter] = useState<CategoryFilter>('all')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const [viewMode, setViewMode] = useState<ViewMode>('stream')

  useTickingClock(setNow)

  const filtered = useFilteredCalls(calls, filter, search)
  const errorCount = useMemo(() => filtered.filter((c) => c.statusCode >= 400).length, [filtered])
  const callsPerSec = useCallsPerSec(calls, now)
  const latencyBuckets = useLatencyBuckets(filtered)
  const groupedCalls = useGroupedCalls(filtered)
  const { scrollRef, isScrollPaused, scrollToBottom } = useAutoScroll(calls)

  const toggleExpanded = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }, [])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <HeaderBar
        callCount={filtered.length}
        callsPerSec={callsPerSec}
        latencyBuckets={latencyBuckets}
        filter={filter}
        onFilterChange={setFilter}
        search={search}
        onSearchChange={setSearch}
        errorCount={errorCount}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />
      {viewMode === 'stream' && <TableHeader />}
      {viewMode === 'stream' ? (
        <CallList
          scrollRef={scrollRef}
          calls={calls}
          filtered={filtered}
          now={now}
          expandedId={expandedId}
          onToggleExpanded={toggleExpanded}
          isScrollPaused={isScrollPaused}
          scrollToBottom={scrollToBottom}
        />
      ) : (
        <GroupedView groups={groupedCalls} />
      )}
    </Box>
  )
}

// ── CallList ──────────────────────────────────────────────────────────────

interface CallListProps {
  scrollRef: React.RefObject<HTMLDivElement | null>
  calls: ApiCall[]
  filtered: ApiCall[]
  now: number
  expandedId: string | null
  onToggleExpanded: (id: string) => void
  isScrollPaused: boolean
  scrollToBottom: () => void
}

function CallList({ scrollRef, calls, filtered, now, expandedId, onToggleExpanded, isScrollPaused, scrollToBottom }: CallListProps) {
  const animatedCutoff = filtered.length - ANIMATED_ROW_COUNT
  return (
    <Box ref={scrollRef} sx={{ flex: 1, overflow: 'auto', position: 'relative' }}>
      {calls.length === 0 ? (
        <SkeletonRows />
      ) : (
        <>
          {filtered.slice(0, Math.max(0, animatedCutoff)).map((call, index) => (
            <StaticCallRow
              key={call.id}
              call={call}
              now={now}
              isEven={index % 2 === 0}
              isExpanded={expandedId === call.id}
              onToggle={() => onToggleExpanded(call.id)}
            />
          ))}
          <AnimatePresence initial={false}>
            {filtered.slice(Math.max(0, animatedCutoff)).map((call, index) => (
              <CallRow
                key={call.id}
                call={call}
                now={now}
                isEven={(animatedCutoff + index) % 2 === 0}
                isExpanded={expandedId === call.id}
                onToggle={() => onToggleExpanded(call.id)}
              />
            ))}
          </AnimatePresence>
        </>
      )}
      {isScrollPaused && <NewCallsBanner onClick={scrollToBottom} />}
    </Box>
  )
}

// ── HeaderBar ──────────────────────────────────────────────────────────────

interface HeaderBarProps {
  callCount: number
  callsPerSec: number
  latencyBuckets: LatencyBucket[]
  filter: CategoryFilter
  onFilterChange: (cat: CategoryFilter) => void
  search: string
  onSearchChange: (value: string) => void
  errorCount: number
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
}

function HeaderBar({ callCount, callsPerSec, latencyBuckets, filter, onFilterChange, search, onSearchChange, errorCount, viewMode, onViewModeChange }: HeaderBarProps) {
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1,
      px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', flexWrap: 'wrap',
    }}>
      <Typography variant="subtitle2" fontWeight={700}>
        Live API & Function Calls
      </Typography>
      <LiveCallCount count={callCount} />
      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 10, fontFamily: 'monospace' }}>
        {callsPerSec.toFixed(1)}/s
      </Typography>
      <LatencySparkline buckets={latencyBuckets} />
      <SearchInput value={search} onChange={onSearchChange} />
      <ViewModeToggle value={viewMode} onChange={onViewModeChange} />
      <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto', alignItems: 'center' }}>
        {CATEGORIES.map((cat) => (
          <CategoryChip
            key={cat}
            category={cat}
            isActive={filter === cat}
            onClick={() => onFilterChange(cat)}
          />
        ))}
        {errorCount > 0 && <ErrorCountBadge count={errorCount} />}
      </Box>
    </Box>
  )
}

// ── LiveCallCount ──────────────────────────────────────────────────────────

function LiveCallCount({ count }: { count: number }) {
  const theme = useTheme()

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <FiberManualRecordIcon sx={{ fontSize: 8, color: theme.palette.success.main, ...livePulseAnimation }} />
      <Typography variant="caption" color="text.secondary">
        last {count}
      </Typography>
    </Box>
  )
}

// ── SearchInput ───────────────────────────────────────────────────────────

function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const theme = useTheme()

  return (
    <TextField
      size="small"
      placeholder="Search paths, functions..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            </InputAdornment>
          ),
        },
      }}
      sx={{
        width: 200,
        '& .MuiOutlinedInput-root': {
          height: 28, fontSize: 11,
          bgcolor: alpha(theme.palette.text.primary, 0.03),
          '& fieldset': { borderColor: alpha(theme.palette.divider, 0.5) },
        },
      }}
    />
  )
}

// ── LatencySparkline ──────────────────────────────────────────────────────

function LatencySparkline({ buckets }: { buckets: LatencyBucket[] }) {
  const maxCount = Math.max(1, ...buckets.map((b) => b.count))

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '1px', width: 40, height: SPARKLINE_MAX_HEIGHT }}>
      {buckets.map((bucket) => (
        <SparklineBar key={bucket.color} bucket={bucket} maxCount={maxCount} />
      ))}
    </Box>
  )
}

function SparklineBar({ bucket, maxCount }: { bucket: LatencyBucket; maxCount: number }) {
  const height = Math.max(2, (bucket.count / maxCount) * SPARKLINE_MAX_HEIGHT)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: SPARKLINE_BAR_WIDTH * 2.5 }}>
      <Box sx={{
        width: SPARKLINE_BAR_WIDTH,
        height,
        bgcolor: bucket.color,
        borderRadius: '1px 1px 0 0',
      }} />
      <Typography sx={{ fontSize: 8, color: 'text.secondary', lineHeight: 1 }}>
        {bucket.count}
      </Typography>
    </Box>
  )
}

// ── ViewModeToggle ────────────────────────────────────────────────────────

function ViewModeToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      size="small"
      onChange={(_, next) => { if (next) onChange(next as ViewMode) }}
      sx={{ height: 24 }}
    >
      <ToggleButton value="stream" sx={{ fontSize: 10, px: 1, py: 0, textTransform: 'none' }}>
        Stream
      </ToggleButton>
      <ToggleButton value="grouped" sx={{ fontSize: 10, px: 1, py: 0, textTransform: 'none' }}>
        Grouped
      </ToggleButton>
    </ToggleButtonGroup>
  )
}

// ── ErrorCountBadge ───────────────────────────────────────────────────────

function ErrorCountBadge({ count }: { count: number }) {
  const theme = useTheme()

  return (
    <Chip
      label={`${count} error${count !== 1 ? 's' : ''}`}
      size="small"
      sx={{
        height: 20, fontSize: 10, fontWeight: 700,
        bgcolor: alpha(theme.palette.error.main, 0.12),
        color: theme.palette.error.main,
      }}
    />
  )
}

// ── CategoryChip ───────────────────────────────────────────────────────────

interface CategoryChipProps {
  category: CategoryFilter
  isActive: boolean
  onClick: () => void
}

function CategoryChip({ category, isActive, onClick }: CategoryChipProps) {
  const theme = useTheme()
  const color = category === 'all' ? theme.palette.primary.main : (CATEGORY_COLORS[category] ?? theme.palette.text.secondary)

  return (
    <Chip
      label={category === 'all' ? 'All' : category}
      size="small"
      onClick={onClick}
      sx={{
        height: 20, fontSize: 10, fontWeight: 600,
        bgcolor: isActive ? alpha(color, 0.12) : 'transparent',
        color: isActive ? color : theme.palette.text.secondary,
        '&:hover': { bgcolor: alpha(color, 0.08) },
      }}
    />
  )
}

// ── TableHeader ────────────────────────────────────────────────────────────

function TableHeader() {
  const theme = useTheme()

  return (
    <Box sx={{
      display: 'grid', gridTemplateColumns: TABLE_COLUMNS, gap: 1,
      px: 2, py: 0.5,
      bgcolor: alpha(theme.palette.text.primary, 0.02),
      borderBottom: 1, borderColor: 'divider',
    }}>
      {COLUMN_HEADERS.map((h) => (
        <Typography key={h} variant="caption" color="text.secondary" fontWeight={700} sx={{ fontSize: 10 }}>
          {h}
        </Typography>
      ))}
    </Box>
  )
}

// ── CallRow ────────────────────────────────────────────────────────────────

interface CallRowProps {
  call: ApiCall
  now: number
  isEven: boolean
  isExpanded: boolean
  onToggle: () => void
}

function CallRowContent({ call, now, isEven, isExpanded, onToggle }: CallRowProps) {
  const theme = useTheme()
  const isError = call.statusCode >= 400

  return (
    <>
      <Box
        onClick={onToggle}
        sx={{
          display: 'grid', gridTemplateColumns: TABLE_COLUMNS, gap: 1,
          px: 2, height: ROW_HEIGHT, alignItems: 'center', cursor: 'pointer',
          borderLeft: isError ? `2px solid ${alpha(theme.palette.error.main, 0.6)}` : '2px solid transparent',
          bgcolor: isExpanded
            ? alpha(theme.palette.primary.main, 0.08)
            : isEven ? alpha(theme.palette.text.primary, 0.015) : 'transparent',
          '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06) },
          transition: 'background-color 120ms',
        }}>
        <TimeCell timestamp={call.timestamp} now={now} />
        <MethodBadge method={call.method} />
        <PathCell path={call.path} statusCode={call.statusCode} />
        <FunctionCell goFunc={call.goFunc} />
        <ComponentChip component={call.component} category={call.category} />
        <DurationCell durationMs={call.durationMs} />
      </Box>
      <AnimatePresence>
        {isExpanded && <CallDetailPanel call={call} />}
      </AnimatePresence>
    </>
  )
}

function StaticCallRow(props: CallRowProps) {
  return (
    <div>
      <CallRowContent {...props} />
    </div>
  )
}

function CallRow(props: CallRowProps) {
  return (
    <motion.div initial={rowEntrance.initial} animate={rowEntrance.animate} exit={rowEntrance.exit} transition={rowEntrance.transition} layout>
      <CallRowContent {...props} />
    </motion.div>
  )
}

// ── CallDetailPanel ───────────────────────────────────────────────────────

function CallDetailPanel({ call }: { call: ApiCall }) {
  const theme = useTheme()
  const router = useRouter()

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{ overflow: 'hidden' }}
    >
      <Box sx={{
        px: 3, py: 1.5, ml: 2,
        borderLeft: `2px solid ${alpha(theme.palette.primary.main, 0.3)}`,
        bgcolor: alpha(theme.palette.primary.main, 0.03),
      }}>
        <DetailRow label="Path" value={call.path} mono />
        <DetailRow label="Function" value={call.goFunc} mono />
        <DetailRow
          label="Request"
          value={`${call.statusCode} ${call.method} -- ${call.durationMs.toFixed(1)}ms`}
          mono
        />
        <DetailRow label="Component" value={`${call.component} / ${call.category}`} />
        <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
          <Button
            size="small"
            variant="text"
            onClick={(e) => {
              e.stopPropagation()
              router.push(`/observability/${call.component}`)
            }}
            sx={{ fontSize: 11, textTransform: 'none', fontWeight: 600 }}
          >
            View Component
          </Button>
          {HTTP_METHODS.has(call.method) && <CopyCurlButton call={call} />}
        </Box>
      </Box>
    </motion.div>
  )
}

// ── CopyCurlButton ───────────────────────────────────────────────────────

function buildCurlCommand(call: ApiCall): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
  const escapedPath = call.path.replace(/'/g, "'\\''")
  return `curl -X ${call.method} '${baseUrl}${escapedPath}'`
}

function CopyCurlButton({ call }: { call: ApiCall }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(buildCurlCommand(call))
    setCopied(true)
    setTimeout(() => setCopied(false), COPY_FEEDBACK_MS)
  }, [call])

  return (
    <Button
      size="small"
      variant="outlined"
      startIcon={<ContentCopyIcon sx={{ fontSize: 12 }} />}
      onClick={handleCopy}
      sx={{ fontSize: 11, textTransform: 'none', fontWeight: 600 }}
    >
      {copied ? 'Copied!' : 'Copy cURL'}
    </Button>
  )
}

// ── DetailRow ─────────────────────────────────────────────────────────────

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'baseline', mb: 0.25 }}>
      <Typography variant="caption" sx={{ fontSize: 10, color: 'text.secondary', minWidth: 60 }}>
        {label}
      </Typography>
      <Typography variant="caption" sx={{
        fontSize: 11,
        fontFamily: mono ? 'monospace' : 'inherit',
        wordBreak: 'break-all',
      }}>
        {value}
      </Typography>
    </Box>
  )
}

// ── Cell components ────────────────────────────────────────────────────────

function TimeCell({ timestamp, now }: { timestamp: string; now: number }) {
  const elapsed = Math.max(0, Math.floor((now - new Date(timestamp).getTime()) / 1000))
  const label = elapsed < 60 ? `${elapsed}s ago` : `${Math.floor(elapsed / 60)}m ago`

  return (
    <Typography variant="caption" sx={{ fontSize: 10, fontFamily: 'monospace', color: 'text.secondary' }}>
      {label}
    </Typography>
  )
}

function MethodBadge({ method }: { method: ApiCall['method'] }) {
  const color = METHOD_COLORS[method] ?? '#94A3B8'

  return (
    <Chip
      label={method}
      size="small"
      sx={{
        height: 18, fontSize: 9, fontWeight: 700, borderRadius: 0.5,
        bgcolor: alpha(color, 0.1),
        color,
      }}
    />
  )
}

function PathCell({ path, statusCode }: { path: string; statusCode: number }) {
  const theme = useTheme()
  const isError = statusCode >= 400

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, overflow: 'hidden' }}>
      <Typography variant="caption" sx={{
        fontSize: 11, fontFamily: 'monospace',
        color: isError ? theme.palette.error.main : 'text.primary',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {path}
      </Typography>
      {isError && (
        <Chip
          label={statusCode}
          size="small"
          sx={{
            height: 16, fontSize: 9, fontWeight: 700, flexShrink: 0,
            bgcolor: alpha(theme.palette.error.main, 0.12),
            color: theme.palette.error.main,
          }}
        />
      )}
    </Box>
  )
}

function FunctionCell({ goFunc }: { goFunc: string }) {
  return (
    <Typography variant="caption" sx={{
      fontSize: 10, fontFamily: 'monospace', color: 'text.secondary',
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }}>
      {goFunc}
    </Typography>
  )
}

function ComponentChip({ component, category }: { component: string; category: ApiCall['category'] }) {
  const color = CATEGORY_COLORS[category] ?? '#94A3B8'

  return (
    <Chip
      label={component}
      size="small"
      sx={{
        height: 16, fontSize: 9,
        bgcolor: alpha(color, 0.1),
        color,
      }}
    />
  )
}

function DurationCell({ durationMs }: { durationMs: number }) {
  const theme = useTheme()
  const color = getDurationColor(durationMs, theme)
  const barWidth = Math.min(1, durationMs / DURATION_CAP_MS) * 100

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end' }}>
      <Typography variant="caption" sx={{
        fontSize: 10, fontFamily: 'monospace', fontWeight: durationMs > 100 ? 600 : 400,
        color, whiteSpace: 'nowrap',
      }}>
        {durationMs > 0 ? `${durationMs.toFixed(1)}ms` : '--'}
      </Typography>
      {durationMs > 0 && (
        <Box sx={{
          width: 32, height: 4, borderRadius: 0.5,
          bgcolor: alpha(color, 0.15),
        }}>
          <Box sx={{
            width: `${barWidth}%`, height: '100%', borderRadius: 0.5,
            bgcolor: color,
          }} />
        </Box>
      )}
    </Box>
  )
}

// ── GroupedView ───────────────────────────────────────────────────────────

const GROUPED_COLUMNS = '1fr 1fr 80px 100px 80px'
const GROUPED_HEADERS = ['Function', 'Component', 'Count', 'Avg Duration', 'Error %']

function GroupedView({ groups }: { groups: CallGroup[] }) {
  return (
    <Box sx={{ flex: 1, overflow: 'auto' }}>
      <GroupedTableHeader />
      {groups.map((group) => (
        <GroupedRow key={group.key} group={group} />
      ))}
    </Box>
  )
}

function GroupedTableHeader() {
  const theme = useTheme()

  return (
    <Box sx={{
      display: 'grid', gridTemplateColumns: GROUPED_COLUMNS, gap: 1,
      px: 2, py: 0.5,
      bgcolor: alpha(theme.palette.text.primary, 0.02),
      borderBottom: 1, borderColor: 'divider',
    }}>
      {GROUPED_HEADERS.map((h) => (
        <Typography key={h} variant="caption" color="text.secondary" fontWeight={700} sx={{ fontSize: 10 }}>
          {h}
        </Typography>
      ))}
    </Box>
  )
}

function GroupedRow({ group }: { group: CallGroup }) {
  const theme = useTheme()
  const router = useRouter()

  return (
    <Box
      onClick={() => router.push(`/observability/${group.component}`)}
      sx={{
        display: 'grid', gridTemplateColumns: GROUPED_COLUMNS, gap: 1,
        px: 2, height: ROW_HEIGHT, alignItems: 'center', cursor: 'pointer',
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06) },
      }}
    >
      <Typography variant="caption" sx={{ fontSize: 10, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {group.goFunc}
      </Typography>
      <Typography variant="caption" sx={{ fontSize: 10, color: 'text.secondary' }}>
        {group.component}
      </Typography>
      <Typography variant="caption" sx={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 600 }}>
        {group.count}
      </Typography>
      <Typography variant="caption" sx={{ fontSize: 10, fontFamily: 'monospace', color: getDurationColor(group.avgDurationMs, theme) }}>
        {group.avgDurationMs.toFixed(1)}ms
      </Typography>
      <GroupedErrorCell percent={group.errorPercent} />
    </Box>
  )
}

function GroupedErrorCell({ percent }: { percent: number }) {
  const theme = useTheme()
  const color = percent > 0 ? theme.palette.error.main : theme.palette.success.main

  return (
    <Typography variant="caption" sx={{ fontSize: 10, fontFamily: 'monospace', color }}>
      {percent.toFixed(1)}%
    </Typography>
  )
}

// ── SkeletonRows ───────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <Box>
      {Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
        <Box key={i} sx={{
          display: 'grid', gridTemplateColumns: TABLE_COLUMNS, gap: 1,
          px: 2, height: ROW_HEIGHT, alignItems: 'center',
        }}>
          <Skeleton variant="text" width={48} height={12} />
          <Skeleton variant="rounded" width={36} height={16} />
          <Skeleton variant="text" width="80%" height={12} />
          <Skeleton variant="text" width="60%" height={12} />
          <Skeleton variant="rounded" width={56} height={14} />
          <Skeleton variant="text" width={40} height={12} sx={{ ml: 'auto' }} />
        </Box>
      ))}
    </Box>
  )
}

// ── NewCallsBanner ─────────────────────────────────────────────────────────

function NewCallsBanner({ onClick }: { onClick: () => void }) {
  const theme = useTheme()

  return (
    <Box
      onClick={onClick}
      sx={{
        position: 'sticky', bottom: 8, mx: 'auto', width: 'fit-content',
        display: 'flex', alignItems: 'center', gap: 0.5,
        px: 1.5, py: 0.5, borderRadius: 2, cursor: 'pointer',
        bgcolor: alpha(theme.palette.primary.main, 0.9),
        color: '#fff', fontSize: 11, fontWeight: 600,
        boxShadow: 2,
        '&:hover': { bgcolor: theme.palette.primary.main },
      }}
    >
      <KeyboardArrowDownIcon sx={{ fontSize: 14 }} />
      New calls below
    </Box>
  )
}

