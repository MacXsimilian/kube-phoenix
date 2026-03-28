'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DownloadIcon from '@mui/icons-material/Download'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import { useColors } from '@/lib/colors'
import { useSnackbar } from '@/lib/useSnackbar'
import type { PodContainer } from '@/lib/types'
import { usePodLogStream } from './usePodLogStream'
import LogSearchBar from './LogSearchBar'

interface PodLogViewerProps {
  namespace: string
  podName: string
  containers: PodContainer[]
  onBack: () => void
}

export default function PodLogViewer({ namespace, podName, containers, onBack }: PodLogViewerProps) {
  const colors = useColors()
  const { notify, SnackbarAlert } = useSnackbar()
  const [container, setContainer] = useState(containers[0]?.name ?? '')
  const [search, setSearch] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [currentMatchIdx, setCurrentMatchIdx] = useState(-1)
  const logRef = useRef<HTMLDivElement>(null)
  const lineEls = useRef<(HTMLElement | null)[]>([])

  const {
    lines, isStreaming, isLoading, hasError, errorMsg,
    mode, setMode, canLoadMore, handleLoadMore,
    startStream, fetchPrevious, clear,
  } = usePodLogStream({ namespace, podName, container })

  const selectedContainer = containers.find((c) => c.name === container)
  const hasPreviousInstance = !!selectedContainer?.lastState

  // Match indices within the full lines array (no filtering -- all lines shown)
  const matchIndices = useMemo(() => {
    if (!search) return []
    const lower = search.toLowerCase()
    return lines.reduce<number[]>((acc, l, i) => {
      if (l.toLowerCase().includes(lower)) acc.push(i)
      return acc
    }, [])
  }, [lines, search])

  // O(1) lookup set for highlighting matched lines
  const matchSet = useMemo(() => new Set(matchIndices), [matchIndices])

  // Reset match cursor when search text changes (not when new log lines arrive).
  const prevSearchRef = useRef(search)
  useEffect(() => {
    if (prevSearchRef.current !== search) {
      setCurrentMatchIdx(matchIndices.length > 0 ? 0 : -1)
      prevSearchRef.current = search
    }
  }, [search, matchIndices])

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

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleCopy = useCallback(() => {
    const text = lines.join('\n')
    navigator.clipboard.writeText(text).then(() => notify('Logs copied to clipboard', 'success'))
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
    clear()
    setAutoScroll(true)
  }, [container, clear])

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
          {mode === 'live' && isStreaming && !isLoading && (
            <Chip
              icon={<FiberManualRecordIcon sx={{ fontSize: '10px !important', color: `${colors.success} !important` }} />}
              label="LIVE"
              size="small"
              sx={{ height: 18, fontSize: 10, bgcolor: colors.successBg, color: colors.success }}
            />
          )}
          {mode === 'live' && !isStreaming && !isLoading && !hasError && (
            <Chip label="ENDED" size="small" sx={{ height: 18, fontSize: 10, bgcolor: colors.mutedBg, color: colors.muted }} />
          )}
        </Stack>

        {/* Container selector -- only for multi-container pods */}
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

      {/* Previous container banner */}
      {hasPreviousInstance && selectedContainer && mode === 'live' && (
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
          <LogSearchBar
            search={search}
            onSearchChange={setSearch}
            matchCount={matchIndices.length}
            currentMatchIdx={currentMatchIdx}
            onJump={jumpToMatch}
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
          <Tooltip title="Copy all logs">
            <span>
              <IconButton size="small" onClick={handleCopy} disabled={lines.length === 0} aria-label="Copy all logs">
                <ContentCopyIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
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
              onClick={() => mode === 'live' ? startStream(0) : fetchPrevious()}
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
          flex: 1, overflow: 'auto', bgcolor: 'background.default',
          fontFamily: 'monospace', fontSize: '0.75rem', lineHeight: 1.7, p: 1, minHeight: 0,
        }}
      >
        {mode === 'live' && lines.length > 0 && canLoadMore && (
          <Box sx={{ textAlign: 'center', py: 1 }}>
            <Button size="small" variant="text" onClick={handleLoadMore} sx={{ fontSize: 11, textTransform: 'none', color: 'text.secondary' }}>
              Load older logs
            </Button>
          </Box>
        )}
        {isLoading && lines.length === 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
        )}
        {!isLoading && lines.length === 0 && !hasError && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>No log lines found.</Typography>
        )}
        {lines.map((line, i) => {
          const isMatch = search && matchSet.has(i)
          const isCurrent = isMatch && matchIndices[currentMatchIdx] === i
          return (
            <Box
              key={i}
              ref={(el) => { lineEls.current[i] = el as HTMLElement | null }}
              sx={{
                px: 1, py: 0.125, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'text.primary',
                '&:hover': { bgcolor: 'action.hover' },
                ...(isCurrent
                  ? { bgcolor: 'rgba(124,58,237,0.35)', borderLeft: '2px solid', borderColor: 'primary.main' }
                  : isMatch ? { bgcolor: 'rgba(124,58,237,0.12)' } : {}),
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
            <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: 'monospace' }}>previous instance</Typography>
          )}
        </Stack>
      </Box>

      {SnackbarAlert}
    </Box>
  )
}
