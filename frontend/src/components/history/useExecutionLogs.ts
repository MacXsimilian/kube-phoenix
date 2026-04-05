'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getPolicyExecutionLogs, wsPolicyLogsUrl } from '@/lib/api'
import type { LogLine } from '@/lib/types'

const RECONNECT_BASE_MS = 1_000
const RECONNECT_MAX_MS = 15_000
const MAX_RETRIES = 10
const MAX_SEEN_IDS = 50_000
const SEEN_IDS_TRIM = 25_000

export function useExecutionLogs(executionId: number | undefined, isRunning: boolean) {
  const [liveLines, setLiveLines] = useState<LogLine[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [maxRetriesReached, setMaxRetriesReached] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retriesRef = useRef(0)
  const seenIdsRef = useRef(new Set<number>())
  const mountedRef = useRef(true)

  const isRunningRef = useRef(isRunning)
  isRunningRef.current = isRunning

  const { data: historicLines = [], isError: logsError } = useQuery({
    queryKey: ['logs', executionId],
    queryFn: () => getPolicyExecutionLogs(executionId!),
    enabled: !!executionId && !isRunning && !isConnected,
    staleTime: Infinity,
  })

  const scheduleReconnect = useCallback(function scheduleReconnect(openWs: () => void) {
    if (retriesRef.current >= MAX_RETRIES) {
      if (mountedRef.current) setMaxRetriesReached(true)
      return
    }
    if (!isRunningRef.current) return

    const delay = Math.min(
      RECONNECT_BASE_MS * Math.pow(2, retriesRef.current),
      RECONNECT_MAX_MS,
    )
    const jitter = Math.random() * 0.1 * delay
    retriesRef.current++

    reconnectTimerRef.current = setTimeout(() => {
      if (isRunningRef.current && wsRef.current === null) openWs()
    }, delay + jitter)
  }, [])

  useEffect(() => {
    if (!executionId || !isRunning) return
    mountedRef.current = true
    setLiveLines([])
    setIsConnected(false)
    setMaxRetriesReached(false)
    retriesRef.current = 0
    seenIdsRef.current = new Set()

    function openWs() {
      const ws = new WebSocket(wsPolicyLogsUrl(executionId!))
      wsRef.current = ws

      ws.onopen = () => {
        if (!mountedRef.current) return
        setIsConnected(true)
        retriesRef.current = 0
      }

      ws.onmessage = (e) => {
        if (!mountedRef.current) return
        try {
          const line: LogLine = JSON.parse(e.data)
          const lineId = line.id ?? line.seq
          if (seenIdsRef.current.has(lineId)) return
          if (seenIdsRef.current.size >= MAX_SEEN_IDS) {
            const ids = Array.from(seenIdsRef.current)
            seenIdsRef.current = new Set(ids.slice(-SEEN_IDS_TRIM))
          }
          seenIdsRef.current.add(lineId)
          setLiveLines((prev) => [...prev, line])
        } catch (err) {
          if (process.env.NODE_ENV === 'development') console.warn('[kp] skipping malformed WS message:', err)
        }
      }

      ws.onerror = () => {
        ws.close()
      }

      ws.onclose = (event) => {
        if (!mountedRef.current) return
        setIsConnected(false)
        wsRef.current = null
        if (event.code !== 1000 && isRunningRef.current) scheduleReconnect(openWs)
      }
    }

    openWs()

    return () => {
      mountedRef.current = false
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [executionId, isRunning, scheduleReconnect])

  const lines = isRunning ? liveLines : historicLines

  return { lines, isConnected: isRunning ? isConnected : true, logsError, maxRetriesReached }
}
