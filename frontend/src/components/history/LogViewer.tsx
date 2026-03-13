'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import Tooltip from '@mui/material/Tooltip'
import Snackbar from '@mui/material/Snackbar'
import CloseIcon from '@mui/icons-material/Close'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import { getExecutionLogs, wsLogsUrl } from '@/lib/api'
import type { Execution, LogLine } from '@/lib/types'

const LEVEL_COLORS: Record<LogLine['level'], string> = {
  info: '#22D3EE',
  ok: '#22C55E',
  plan: '#C084FC',
  error: '#F87171',
  warn: '#FBBF24',
}

function LogLineRow({ line }: { line: LogLine }) {
  return (
    <Box
      component="div"
      sx={{
        fontFamily: 'monospace',
        fontSize: 12,
        lineHeight: 1.7,
        color: LEVEL_COLORS[line.level] ?? '#CBD5E1',
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
  execution: Execution | null
  onClose: () => void
}) {
  const [liveLines, setLiveLines] = useState<LogLine[]>([])
  const [copied, setCopied] = useState(false)
  const [drawerWidth, setDrawerWidth] = useState(640)
  const bottomRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = drawerWidth

    const onMouseMove = (mv: MouseEvent) => {
      const delta = startX - mv.clientX
      const next = Math.min(Math.max(startWidth + delta, 360), window.innerWidth * 0.9)
      setDrawerWidth(Math.round(next))
    }
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [drawerWidth])

  const isRunning = execution?.status === 'running'

  const { data: historicLines = [] } = useQuery({
    queryKey: ['logs', execution?.id],
    queryFn: () => getExecutionLogs(execution!.id),
    enabled: !!execution && !isRunning,
  })

  // WebSocket for live executions
  useEffect(() => {
    if (!execution || !isRunning) return
    setLiveLines([])

    const ws = new WebSocket(wsLogsUrl(execution.id))
    wsRef.current = ws

    ws.onmessage = (e) => {
      try {
        const line: LogLine = JSON.parse(e.data)
        setLiveLines((prev) => [...prev, line])
      } catch {
        // ignore parse errors
      }
    }
    ws.onerror = () => ws.close()

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [execution?.id, isRunning])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [liveLines, historicLines])

  const lines = isRunning ? liveLines : historicLines

  function handleCopy() {
    const text = lines
      .map((l) => `${new Date(l.timestamp).toLocaleTimeString()}  ${l.message}`)
      .join('\n')
    navigator.clipboard.writeText(text).then(() => setCopied(true))
  }

  return (
    <>
      <Drawer
        anchor="right"
        open={!!execution}
        onClose={onClose}
        PaperProps={{
          sx: {
            width: { xs: '100vw', md: drawerWidth },
            bgcolor: 'background.paper',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'visible',
          },
        }}
      >
        {/* Resize handle */}
        <Box
          onMouseDown={handleResizeMouseDown}
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
                  {execution.schedule?.type === 'scale_down' ? (
                    <BedtimeIcon sx={{ color: 'primary.main', fontSize: 18 }} />
                  ) : (
                    <WbSunnyIcon sx={{ color: 'warning.main', fontSize: 18 }} />
                  )}
                  <Typography variant="subtitle1" fontWeight={700}>
                    {execution.schedule?.name ?? 'Execution'} #{execution.id}
                  </Typography>
                  {isRunning && <CircularProgress size={14} />}
                </Box>
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                  <Chip
                    label={execution.mode.toUpperCase()}
                    size="small"
                    sx={{
                      height: 18, fontSize: 10,
                      bgcolor: execution.mode === 'apply' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)',
                      color: execution.mode === 'apply' ? 'warning.main' : 'info.main',
                    }}
                  />
                  <Chip
                    icon={<ArrowDownwardIcon sx={{ fontSize: '12px !important' }} />}
                    label={`${execution.countScaled} scaled`}
                    size="small"
                    sx={{ height: 18, fontSize: 10 }}
                  />
                  <Chip
                    icon={<CloudOffIcon sx={{ fontSize: '12px !important' }} />}
                    label={`${execution.countDrained} drained`}
                    size="small"
                    sx={{ height: 18, fontSize: 10 }}
                  />
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
                <Tooltip title="Copy logs">
                  <span>
                    <IconButton size="small" onClick={handleCopy} disabled={lines.length === 0}>
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <IconButton size="small" onClick={onClose}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>

            <Divider />

            {/* Log area */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 2, bgcolor: '#0A0A0F' }}>
              {lines.length === 0 && !isRunning && (
                <Typography variant="body2" color="text.secondary">
                  No log lines found.
                </Typography>
              )}
              {lines.map((line, i) => (
                <LogLineRow key={`${line.id ?? line.seq}-${i}`} line={line} />
              ))}
              <div ref={bottomRef} />
            </Box>
          </>
        )}
      </Drawer>

      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        message="Logs copied to clipboard"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  )
}
