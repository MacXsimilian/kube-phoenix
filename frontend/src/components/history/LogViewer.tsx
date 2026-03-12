'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import CloseIcon from '@mui/icons-material/Close'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
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
  const bottomRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)

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

  return (
    <Drawer
      anchor="right"
      open={!!execution}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100vw', md: 640 },
          bgcolor: 'background.paper',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
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
                <Chip label={`↓ ${execution.countScaled} scaled`} size="small" sx={{ height: 18, fontSize: 10 }} />
                <Chip label={`⌀ ${execution.countDrained} drained`} size="small" sx={{ height: 18, fontSize: 10 }} />
                {execution.countErrors > 0 && (
                  <Chip
                    label={`✕ ${execution.countErrors} errors`}
                    size="small"
                    color="error"
                    sx={{ height: 18, fontSize: 10 }}
                  />
                )}
              </Box>
            </Box>
            <IconButton size="small" onClick={onClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          <Divider />

          {/* Log area */}
          <Box
            sx={{
              flex: 1,
              overflow: 'auto',
              p: 2,
              bgcolor: '#0A0A0F',
            }}
          >
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
  )
}
