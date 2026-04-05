'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getPolicyExecutionLogs, wsPolicyLogsUrl } from '@/lib/api'
import type { LogLine } from '@/lib/types'

const RECONNECT_BASE_MS = 1_000
const RECONNECT_MAX_MS = 15_000
const MAX_RETRIES = 10

export function useExecutionLogs(executionId: number | undefined, isRunning: boolean) {
  const [liveLines, setLiveLines] = useState<LogLine[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retriesRef = useRef(0)
  const seenIdsRef = useRef(new Set<number>())

  const isRunningRef = useRef(isRunning)
  isRunningRef.current = isRunning

  const { data: historicLines = [], isError: logsError } = useQuery({
    queryKey: ['logs', executionId],
    queryFn: () => getPolicyExecutionLogs(executionId!),
    enabled: !!executionId && !isRunning,
  })

  useEffect(() => {
    if (!executionId || !isRunning) return
    setLiveLines([])
    setIsConnected(false)
    retriesRef.current = 0
    seenIdsRef.current = new Set()

    function scheduleReconnect() {
      if (retriesRef.current >= MAX_RETRIES) return
      if (!isRunningRef.current) return

      const delay = Math.min(
        RECONNECT_BASE_MS * Math.pow(2, retriesRef.current),
        RECONNECT_MAX_MS,
      )
      retriesRef.current++

      reconnectTimerRef.current = setTimeout(() => {
        if (isRunningRef.current && wsRef.current === null) openWs()
      }, delay)
    }

    function openWs() {
      const ws = new WebSocket(wsPolicyLogsUrl(executionId!))
      wsRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)
        retriesRef.current = 0
      }

      ws.onmessage = (e) => {
        try {
          const line: LogLine = JSON.parse(e.data)
          const lineId = line.id ?? line.seq
          if (seenIdsRef.current.has(lineId)) return
          seenIdsRef.current.add(lineId)
          setLiveLines((prev) => [...prev, line])
        } catch (err) {
          if (process.env.NODE_ENV === 'development') console.warn('[kp] skipping malformed WS message:', err)
        }
      }

      ws.onerror = () => {
        setIsConnected(false)
        ws.close()
        wsRef.current = null
      }

      ws.onclose = () => {
        setIsConnected(false)
        wsRef.current = null
        if (isRunningRef.current) scheduleReconnect()
      }
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
