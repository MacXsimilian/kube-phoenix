'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Snackbar from '@mui/material/Snackbar'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DownloadIcon from '@mui/icons-material/Download'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import SearchIcon from '@mui/icons-material/Search'
import { getPodLogs, streamPodLogs } from '@/lib/api'
import { useColors } from '@/lib/colors'
import type { PodContainer } from '@/lib/types'

const INITIAL_TAIL = 500
const LOAD_MORE_INCREMENT = 2000
const MAX_LINES = 10_000

interface PodLogViewerProps {
  namespace: string
  podName: string
  containers: PodContainer[]
  onBack: () => void
}

/**
 * PodLogViewer — displays live-streaming and historical logs for a selected pod container.
 *
 * Features:
 * - Streams logs via fetch/ReadableStream with live "LIVE" / "ENDED" status indicators
 * - Supports current (live) and previous (terminated) container instance logs
 * - Per-line search with match count, prev/next navigation, and highlight for current match
 * - Container selector rendered only for multi-container pods
 * - Auto-scroll that disengages on manual upward scroll and re-engages at bottom
 * - "Load older logs" button increments tail window up to a MAX_LINES cap
 * - Copy-to-clipboard and .log file download actions
 * - Aborts in-flight streams on container change or mode switch to avoid stale data
 */
export default function PodLogViewer({ namespace, podName, containers, onBack }: PodLogViewerProps) {
  const colors = useColors()
  const [container, setContainer] = useState(containers[0]?.name ?? '')
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState(false)
  const [mode, setMode] = useState<'live' | 'previous'>('live')
  const [autoScroll, setAutoScroll] = useState(true)
  const [currentMatchIdx, setCurrentMatchIdx] = useState(-1)
  const logRef = useRef<HTMLDivElement>(null)
  const lineEls = useRef<(HTMLElement | null)[]>([])

  // Streaming state (live mode)
  const [streamLines, setStreamLines] = useState<string[]>([])
  const [streaming, setStreaming] = useState(false)
  const [streamError, setStreamError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [tailLines, setTailLines] = useState(INITIAL_TAIL)

  // Previous mode state
  const [prevLines, setPrevLines] = useState<string[]>([])
  const [prevLoading, setPrevLoading] = useState(false)
  const [prevError, setPrevError] = useState<string | null>(null)

  const selectedContainer = containers.find((c) => c.name === container)
  const hasPreviousInstance = !!selectedContainer?.lastState

  // ── Live streaming ──────────────────────────────────────────────────────────

  const startStream = useCallback((tail: number) => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    setStreamLines([])
    setStreaming(true)
    setStreamError(null)

    const { start } = streamPodLogs(namespace, podName, container || undefined, tail, ac.signal)

    start(
      (line) => {
        setStreamLines((prev) => {
          const next = [...prev, line]
          return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next
        })
      },
      (err) => {
        setStreamError(err.message)
        setStreaming(false)
      },
      () => {
        setStreaming(false)
      },
    )
  }, [namespace, podName, container])

  // Start/restart stream when in live mode
  useEffect(() => {
    if (mode !== 'live') {
      abortRef.current?.abort()
      setStreaming(false)
      return
    }
    startStream(tailLines)
    return () => { abortRef.current?.abort() }
  }, [mode, startStream, tailLines])

  // ── Previous logs fetch ─────────────────────────────────────────────────────

  const fetchPrevious = useCallback(async () => {
    setPrevLoading(true)
    setPrevError(null)
    try {
      const raw = await getPodLogs(namespace, podName, container || undefined, 5000, true)
      setPrevLines(raw.split('\n').filter((l) => l.length > 0))
    } catch (err) {
      setPrevError(err instanceof Error ? err.message : 'Failed to load previous logs')
    } finally {
      setPrevLoading(false)
    }
  }, [namespace, podName, container])

  useEffect(() => {
    if (mode === 'previous') fetchPrevious()
  }, [mode, fetchPrevious])

  // ── Derived state ───────────────────────────────────────────────────────────

  const lines = mode === 'live' ? streamLines : prevLines
  const isLoading = mode === 'live' ? (streaming && streamLines.length === 0) : prevLoading
  const hasError = mode === 'live' ? !!streamError : !!prevError
  const errorMsg = mode === 'live' ? streamError : prevError

  // Match indices within the full lines array (no filtering — all lines shown)
  const matchIndices = useMemo(() => {
    if (!search) return []
    const lower = search.toLowerCase()
    return lines.reduce<number[]>((acc, l, i) => {
      if (l.toLowerCase().includes(lower)) acc.push(i)
      return acc
    }, [])
  }, [lines, search])

  // Reset match cursor when search changes
  useEffect(() => {
    setCurrentMatchIdx(matchIndices.length > 0 ? 0 : -1)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to current match
  useEffect(() => {
    if (currentMatchIdx >= 0 && currentMatchIdx < matchIndices.length) {
      const lineIdx = matchIndices[currentMatchIdx]
      lineEls.current[lineIdx]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [currentMatchIdx, matchIndices])

  const jumpToMatch = useCallback((direction: 'next' | 'prev') => {
    if (matchIndices.length === 0) return
    setAutoScroll(false)
    setCurrentMatchIdx((cur) => {
      if (direction === 'next') return (cur + 1) % matchIndices.length
      return (cur - 1 + matchIndices.length) % matchIndices.length
    })
  }, [matchIndices.length])

  // ── Auto-scroll ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [lines, autoScroll])

  const handleScroll = useCallback(() => {
    if (!logRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = logRef.current
    const atBottom = scrollHeight - scrollTop - clientHeight < 40
    setAutoScroll(atBottom)
  }, [])

  // ── Load older lines (scroll-to-top trigger) ───────────────────────────────

  const [canLoadMore, setCanLoadMore] = useState(true)

  const handleLoadMore = useCallback(() => {
    const next = tailLines + LOAD_MORE_INCREMENT
    setTailLines(next)
    setCanLoadMore(next < MAX_LINES)
    // Stream will restart via the tailLines dependency in the useEffect
  }, [tailLines])

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleCopy = useCallback(() => {
    const text = lines.join('\n')
    navigator.clipboard.writeText(text).then(() => setCopied(true)).catch(() => setCopied(false))
  }, [lines])

  const handleDownload = useCallback(() => {
    const text = lines.join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const downloadLink = document.createElement('a')
    downloadLink.href = url
    downloadLink.download = `${namespace}-${podName}-${container || 'default'}.log`
    downloadLink.click()
    URL.revokeObjectURL(url)
  }, [lines, namespace, podName, container])

  // Reset when container changes
  useEffect(() => {
    setMode('live')
    setTailLines(INITIAL_TAIL)
    setCanLoadMore(true)
    setPrevLines([])
    setStreamLines([])
    setAutoScroll(true)
  }, [container])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Header */}
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: containers.length > 1 ? 1 : 0 }}>
          <Tooltip title="Back to pod details">
            <IconButton size="small" onClick={onBack} aria-label="Back to pod details">
              <ArrowBackIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Typography variant="body2" fontWeight={700}>
            Container Logs
          </Typography>
          {containers.length === 1 && (
            <Chip label={container} size="small" sx={{ fontFamily: 'monospace', fontSize: 11 }} />
          )}
          {isLoading && <CircularProgress size={14} />}
          {mode === 'live' && streaming && !isLoading && (
            <Chip
              icon={<FiberManualRecordIcon sx={{ fontSize: '10px !important', color: `${colors.success} !important` }} />}
              label="LIVE"
              size="small"
              sx={{ height: 18, fontSize: 10, bgcolor: colors.successBg, color: colors.success }}
            />
          )}
          {mode === 'live' && !streaming && !isLoading && !streamError && (
            <Chip label="ENDED" size="small" sx={{ height: 18, fontSize: 10, bgcolor: colors.mutedBg, color: colors.muted }} />
          )}
        </Stack>

        {/* Container selector — only for multi-container pods */}
        {containers.length > 1 && (
          <Select
            size="small"
            value={container}
            onChange={(e) => setContainer(e.target.value)}
            sx={{ minWidth: 160, fontSize: 12 }}
          >
            {containers.map((c) => (
              <MenuItem key={c.name} value={c.name} sx={{ fontSize: 12 }}>
                {c.name}
              </MenuItem>
            ))}
          </Select>
        )}
      </Box>

      {/* Previous container banner — only shown when relevant */}
      {hasPreviousInstance && mode === 'live' && (
        <Box sx={{ px: 2, py: 1, bgcolor: 'rgba(245,158,11,0.06)', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="caption" sx={{ color: 'warning.main', flex: 1 }}>
              Container restarted (last state: {selectedContainer.lastState})
            </Typography>
            <Button
              size="small"
              variant="text"
              onClick={() => setMode('previous')}
              sx={{ fontSize: 11, textTransform: 'none', color: 'warning.main', minWidth: 0, px: 1 }}
            >
              View previous logs
            </Button>
          </Stack>
        </Box>
      )}

      {/* Previous mode header */}
      {mode === 'previous' && (
        <Box sx={{ px: 2, py: 1, bgcolor: 'rgba(245,158,11,0.06)', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="caption" sx={{ color: 'warning.main', flex: 1 }}>
              Viewing previous container instance
            </Typography>
            <Button
              size="small"
              variant="text"
              onClick={() => setMode('live')}
              sx={{ fontSize: 11, textTransform: 'none', color: 'primary.main', minWidth: 0, px: 1 }}
            >
              Back to live
            </Button>
          </Stack>
        </Box>
      )}

      {/* Search + actions toolbar */}
      <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            size="small"
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && matchIndices.length > 0) {
                jumpToMatch(e.shiftKey ? 'prev' : 'next')
              }
            }}
            sx={{ flex: 1, maxWidth: 280 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                  </InputAdornment>
                ),
                endAdornment: search ? (
                  <InputAdornment position="end">
                    <Stack direction="row" alignItems="center" spacing={0.25}>
                      <Typography variant="caption" sx={{ color: matchIndices.length > 0 ? 'primary.main' : 'error.main', whiteSpace: 'nowrap' }}>
                        {matchIndices.length > 0 ? `${currentMatchIdx + 1}/${matchIndices.length}` : 'No matches'}
                      </Typography>
                      <IconButton size="small" onClick={() => jumpToMatch('prev')} disabled={matchIndices.length === 0} sx={{ p: 0.25 }} aria-label="Previous match">
                        <KeyboardArrowUpIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                      <IconButton size="small" onClick={() => jumpToMatch('next')} disabled={matchIndices.length === 0} sx={{ p: 0.25 }} aria-label="Next match">
                        <KeyboardArrowDownIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Stack>
                  </InputAdornment>
                ) : undefined,
                sx: { fontSize: 12 },
              },
            }}
          />
          <Box sx={{ flex: 1 }} />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                sx={{ '& .MuiSwitch-thumb': { background: (t) => t.palette.primary.main } }}
              />
            }
            label={<Typography variant="caption" sx={{ color: 'text.secondary' }}>Auto-scroll</Typography>}
            sx={{ m: 0 }}
          />
          <Tooltip title={copied ? 'Copied!' : 'Copy all logs'}>
            <span>
              <IconButton size="small" onClick={handleCopy} disabled={lines.length === 0} aria-label="Copy all logs">
                <ContentCopyIcon sx={{ fontSize: 16, color: copied ? 'success.main' : 'text.secondary' }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Download as .log">
            <span>
              <IconButton size="small" onClick={handleDownload} disabled={lines.length === 0} aria-label="Download logs">
                <DownloadIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Box>

      {/* Error state */}
      {hasError && (
        <Alert
          severity="error"
          sx={{ borderRadius: 0 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => mode === 'live' ? startStream(tailLines) : fetchPrevious()}
            >
              {mode === 'live' ? 'Reconnect' : 'Retry'}
            </Button>
          }
        >
          {errorMsg}
        </Alert>
      )}

      {/* Log lines */}
      <Box
        ref={logRef}
        onScroll={handleScroll}
        sx={{
          flex: 1,
          overflow: 'auto',
          bgcolor: 'background.default',
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          lineHeight: 1.7,
          p: 1,
          minHeight: 0,
        }}
      >
        {/* Load more button at the top */}
        {mode === 'live' && lines.length > 0 && canLoadMore && (
          <Box sx={{ textAlign: 'center', py: 1 }}>
            <Button
              size="small"
              variant="text"
              onClick={handleLoadMore}
              sx={{ fontSize: 11, textTransform: 'none', color: 'text.secondary' }}
            >
              Load older logs
            </Button>
          </Box>
        )}

        {isLoading && lines.length === 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        )}
        {!isLoading && lines.length === 0 && !hasError && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            No log lines found.
          </Typography>
        )}
        {lines.map((line, i) => {
          const isMatch = search && matchIndices.includes(i)
          const isCurrent = isMatch && matchIndices[currentMatchIdx] === i
          return (
            <Box
              key={i}
              ref={(el) => { lineEls.current[i] = el as HTMLElement | null }}
              sx={{
                px: 1,
                py: 0.125,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                color: 'text.primary',
                '&:hover': { bgcolor: 'action.hover' },
                ...(isCurrent
                  ? { bgcolor: 'rgba(124,58,237,0.35)', borderLeft: '2px solid', borderColor: 'primary.main' }
                  : isMatch
                    ? { bgcolor: 'rgba(124,58,237,0.12)' }
                    : {}),
              }}
            >
              {line}
            </Box>
          )
        })}
      </Box>

      {/* Status bar */}
      <Box sx={{ px: 2, py: 0.75, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {lines.length} lines
            {search && ` (${matchIndices.length} match${matchIndices.length !== 1 ? 'es' : ''})`}
          </Typography>
          {mode === 'previous' && (
            <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: 'monospace' }}>
              previous instance
            </Typography>
          )}
        </Stack>
      </Box>

      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        message="Logs copied to clipboard"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
