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
import { useIsDark } from '@/lib/useIsDark'
import { useDrawerResize } from '@/lib/useDrawerResize'
import type { PolicyExecution, LogLine } from '@/lib/types'
import { LOG_LEVEL_COLORS_DARK, LOG_LEVEL_COLORS_LIGHT, modeColors } from '@/lib/statusColors'
import { useSnackbar } from '@/lib/useSnackbar'
import ExecutionSummary from './ExecutionSummary'
import { useExecutionLogs } from './useExecutionLogs'

// ── Log line row ──────────────────────────────────────────────────────────────

function LogLineRow({ line }: { line: LogLine }) {
  const isDark = useIsDark()
  const levelColors = isDark ? LOG_LEVEL_COLORS_DARK : LOG_LEVEL_COLORS_LIGHT
  return (
    <Box
      component="div"
      sx={{
        fontFamily: 'monospace',
        fontSize: 12,
        lineHeight: 1.7,
        color: levelColors[line.level] ?? 'text.primary',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}
    >
      <Box component="span" sx={{ opacity: 0.4, mr: 1.5, userSelect: 'none' }}>
        {new Date(line.timestamp).toLocaleTimeString()}
      </Box>
      {line.message}
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
  const MODE_COLORS = modeColors(useIsDark())
  const { notify, SnackbarAlert } = useSnackbar()
  const { width: drawerWidth, onMouseDown: handleResizeMouseDown, onTouchStart: handleResizeTouchStart } = useDrawerResize(640)
  const [currentErrorIdx, setCurrentErrorIdx] = useState(-1)
  const bottomRef = useRef<HTMLDivElement>(null)
  const lineEls = useRef<(HTMLElement | null)[]>([])

  const isRunning = execution?.status === 'running'

  const { lines, isConnected, logsError } = useExecutionLogs(execution?.id, isRunning)

  // Reset error cursor when switching executions
  useEffect(() => {
    setCurrentErrorIdx(-1)
    lineEls.current = []
  }, [execution?.id])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

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
    navigator.clipboard.writeText(text).then(() => notify('Logs copied to clipboard', 'success'))
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
                      bgcolor: (MODE_COLORS[execution.mode] ?? MODE_COLORS.plan).bg,
                      color: (MODE_COLORS[execution.mode] ?? MODE_COLORS.plan).color,
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

            <ExecutionSummary lines={lines} />

            {/* Log area */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
              <Box sx={{ minHeight: 40, px: 2.5, display: 'flex', alignItems: 'center', borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" fontWeight={700} letterSpacing={0.8} sx={{ color: 'text.secondary', textTransform: 'uppercase' }}>
                  Logs
                </Typography>
              </Box>
              {!isConnected && isRunning && (
                <Alert severity="error" sx={{ borderRadius: 0 }}>
                  WebSocket connection lost. Logs may be incomplete.
                </Alert>
              )}
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
              <Box sx={{ flex: 1, overflow: 'auto', p: 2, bgcolor: 'background.default', minHeight: 0 }}>
                {lines.length === 0 && !isRunning && !logsError && (
                  <Typography variant="body2" color="text.secondary">
                    No log lines found.
                  </Typography>
                )}
                {lines.map((line, i) => (
                  <Box key={`${line.id ?? line.seq}-${i}`} ref={(el) => { lineEls.current[i] = el as HTMLElement | null }}>
                    <LogLineRow line={line} />
                  </Box>
                ))}
                <div ref={bottomRef} />
              </Box>
            </Box>
          </>
        )}
      </Drawer>

      {SnackbarAlert}
    </>
  )
}
