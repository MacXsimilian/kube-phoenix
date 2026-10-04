import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Overview } from '@/lib/types'
import { queryKeys } from '@/lib/queryKeys'
import { waitForStreamRetry } from '@/lib/streamRetry'

const RECONNECT_BASE_MS = 1_000
const RECONNECT_MAX_MS = 15_000

// useClusterStream subscribes to the backend SSE stream and pushes received
// Overview updates directly into the TanStack Query cache, eliminating polling.
export function useClusterStream() {
  const queryClient = useQueryClient()
  const [disconnected, setDisconnected] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    let failCount = 0

    function nextDelay() {
      const base = Math.min(
        RECONNECT_BASE_MS * Math.pow(2, failCount - 1),
        RECONNECT_MAX_MS,
      )
      return base + Math.random() * 0.1 * base
    }

    async function connect() {
      while (!controller.signal.aborted) {
        let connectedAt = 0
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/cluster/stream`,
            { signal: controller.signal, credentials: 'include' },
          )
          if (!res.ok || !res.body) throw new Error(`Cluster stream unavailable (${res.status})`)
          connectedAt = Date.now()
          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          let buf = ''
          try {
            while (!controller.signal.aborted) {
              const { done, value } = await reader.read()
              if (done || controller.signal.aborted) break
              buf += decoder.decode(value, { stream: true })
              const lines = buf.split('\n')
              buf = lines.pop() ?? ''
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    queryClient.setQueryData<Overview>(queryKeys.overview(), JSON.parse(line.slice(6)))
                    setDisconnected(false)
                  } catch (e) { if (process.env.NODE_ENV === 'development') console.warn('[kp] skipping malformed SSE event:', e) }
                }
              }
            }
          } finally {
            reader.releaseLock()
          }
          throw new Error('Cluster stream closed')
        } catch (err) {
          if (controller.signal.aborted) break
          if (err instanceof DOMException && err.name === 'AbortError') break
          if (process.env.NODE_ENV === 'development') console.warn('[kp] cluster stream error:', err)
          if (connectedAt && Date.now() - connectedAt >= RECONNECT_MAX_MS) failCount = 0
          failCount += 1
          setDisconnected(true)
          await waitForStreamRetry(nextDelay(), controller.signal)
          if (controller.signal.aborted) break
        }
      }
    }

    connect()
    return () => {
      controller.abort()
    }
  }, [queryClient])

  return disconnected
}
