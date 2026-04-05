import { useState, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Overview } from '@/lib/types'
import { queryKeys } from '@/lib/queryKeys'

const STREAM_RECONNECT_DELAY_MS = 5_000

// useClusterStream subscribes to the backend SSE stream and pushes received
// Overview updates directly into the TanStack Query cache, eliminating polling.
export function useClusterStream() {
  const queryClient = useQueryClient()
  const mountedRef = useRef(true)
  const [disconnected, setDisconnected] = useState(false)
  const failCountRef = useRef(0)

  useEffect(() => {
    mountedRef.current = true
    const controller = new AbortController()

    async function connect() {
      while (mountedRef.current) {
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/cluster/stream`,
            { signal: controller.signal, credentials: 'include' },
          )
          if (!res.ok || !res.body) {
            failCountRef.current += 1
            if (failCountRef.current > 1) setDisconnected(true)
            await new Promise((r) => setTimeout(r, STREAM_RECONNECT_DELAY_MS))
            if (controller.signal.aborted) break
            continue
          }
          failCountRef.current = 0
          setDisconnected(false)
          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          let buf = ''
          while (mountedRef.current) {
            const { done, value } = await reader.read()
            if (done) break
            buf += decoder.decode(value, { stream: true })
            const lines = buf.split('\n')
            buf = lines.pop() ?? ''
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  queryClient.setQueryData<Overview>(queryKeys.overview(), JSON.parse(line.slice(6)))
                } catch (e) { if (process.env.NODE_ENV === 'development') console.warn('[kp] skipping malformed SSE event:', e) }
              }
            }
          }
        } catch (err) {
          if (!mountedRef.current || controller.signal.aborted) break
          if (err instanceof DOMException && err.name === 'AbortError') break
          if (process.env.NODE_ENV === 'development') console.warn('[kp] cluster stream error:', err)
          failCountRef.current += 1
          if (failCountRef.current > 1) setDisconnected(true)
          await new Promise((r) => setTimeout(r, STREAM_RECONNECT_DELAY_MS))
          if (controller.signal.aborted) break
        }
      }
    }

    connect()
    return () => {
      mountedRef.current = false
      controller.abort()
    }
  }, [queryClient])

  return disconnected
}
