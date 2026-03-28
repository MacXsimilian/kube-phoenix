'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getPolicyExecutionLogs, wsPolicyLogsUrl } from '@/lib/api'
import type { LogLine } from '@/lib/types'

/**
 * Manages log lines for a policy execution, handling both historical log
 * fetching (for completed runs) and live WebSocket streaming (for running
 * executions).
 */
export function useExecutionLogs(executionId: number | undefined, isRunning: boolean) {
  const [liveLines, setLiveLines] = useState<LogLine[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Ref keeps the latest isRunning value accessible inside the WebSocket
  // closure without adding isRunning to the effect dependency array, which
  // would cause the socket to reconnect on every status change.
  const isRunningRef = useRef(isRunning)
  isRunningRef.current = isRunning

  const { data: historicLines = [], isError: logsError } = useQuery({
    queryKey: ['logs', executionId],
    queryFn: () => getPolicyExecutionLogs(executionId!),
    enabled: !!executionId && !isRunning,
  })

  // WebSocket for live executions
  useEffect(() => {
    if (!executionId || !isRunning) return
    setLiveLines([])
    setIsConnected(false)

    function openWs() {
      const ws = new WebSocket(wsPolicyLogsUrl(executionId!))
      wsRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)
      }

      ws.onmessage = (e) => {
        try {
          const line: LogLine = JSON.parse(e.data)
          setLiveLines((prev) => [...prev, line])
        } catch {
          // ignore parse errors
        }
      }

      ws.onerror = () => {
        setIsConnected(false)
        ws.close()
        wsRef.current = null
        reconnectTimerRef.current = setTimeout(() => {
          if (isRunningRef.current && wsRef.current === null) openWs()
        }, 3000)
      }

      ws.onclose = () => setIsConnected(false)
    }

    openWs()

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [executionId, isRunning])

  const lines = isRunning ? liveLines : historicLines

  return { lines, isConnected: isRunning ? isConnected : true, logsError }
}
