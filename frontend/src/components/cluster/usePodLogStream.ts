import { useCallback, useEffect, useRef, useState } from 'react'
import { getPodLogs, streamPodLogs } from '@/lib/api'

const INITIAL_TAIL = 500
const LOAD_MORE_INCREMENT = 2000
const MAX_LINES = 10_000

interface PodLogStreamOptions {
  namespace: string
  podName: string
  container: string
}

export interface PodLogStreamResult {
  lines: string[]
  isStreaming: boolean
  isLoading: boolean
  hasError: boolean
  errorMsg: string | null
  mode: 'live' | 'previous'
  setMode: (mode: 'live' | 'previous') => void
  canLoadMore: boolean
  handleLoadMore: () => void
  startStream: (tail: number) => void
  fetchPrevious: () => void
  clear: () => void
}

export function usePodLogStream({ namespace, podName, container }: PodLogStreamOptions): PodLogStreamResult {
  const [mode, setMode] = useState<'live' | 'previous'>('live')

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

  const [canLoadMore, setCanLoadMore] = useState(true)

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

  // ── Load more ───────────────────────────────────────────────────────────────

  const handleLoadMore = useCallback(() => {
    const next = tailLines + LOAD_MORE_INCREMENT
    setTailLines(next)
    setCanLoadMore(next < MAX_LINES)
  }, [tailLines])

  // ── Clear / reset ───────────────────────────────────────────────────────────

  const clear = useCallback(() => {
    setMode('live')
    setTailLines(INITIAL_TAIL)
    setCanLoadMore(true)
    setPrevLines([])
    setStreamLines([])
  }, [])

  // ── Derived state ───────────────────────────────────────────────────────────

  const lines = mode === 'live' ? streamLines : prevLines
  const isLoading = mode === 'live' ? (streaming && streamLines.length === 0) : prevLoading
  const hasError = mode === 'live' ? !!streamError : !!prevError
  const errorMsg = mode === 'live' ? streamError : prevError

  return {
    lines,
    isStreaming: streaming,
    isLoading,
    hasError,
    errorMsg,
    mode,
    setMode,
    canLoadMore,
    handleLoadMore,
    startStream,
    fetchPrevious,
    clear,
  }
}
