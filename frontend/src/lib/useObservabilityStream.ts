import { useState, useEffect, useRef, useCallback } from 'react'
import type {
  ObservabilityStreamPayload,
  MetricSnapshot,
  IncidentEvent,
  ObservabilityThreshold,
  ApiCall,
  RuntimeConfig,
} from '@/lib/observability-types'

const RECONNECT_BASE_MS = 5_000
const RECONNECT_MAX_MS = 30_000

function reconnectDelay(failCount: number): number {
  return Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * Math.pow(2, failCount - 1))
}

const HISTORY_SIZE = 60
const EVENT_TTL_MS = 10_000
const MAX_EVENTS = 5
const MAX_CALLS = 50

export interface ObservabilityStreamState {
  latest: ObservabilityStreamPayload | null
  history: MetricSnapshot[]
  events: IncidentEvent[]
  recentCalls: ApiCall[]
  runtimeConfig: RuntimeConfig | null
  disconnected: boolean
}

export function useObservabilityStream(): ObservabilityStreamState {
  const [latest, setLatest] = useState<ObservabilityStreamPayload | null>(null)
  const [history, setHistory] = useState<MetricSnapshot[]>([])
  const [events, setEvents] = useState<IncidentEvent[]>([])
  const [recentCalls, setRecentCalls] = useState<ApiCall[]>([])
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig | null>(null)
  const [disconnected, setDisconnected] = useState(false)
  const mountedRef = useRef(true)
  const prevThresholdsRef = useRef<Record<string, string>>({})
  const failCountRef = useRef(0)

  const checkThresholdCrossing = useCallback(
    (snap: MetricSnapshot, thresholds: ObservabilityThreshold[]) => {
      const checks: { panelKey: string; value: number; label: string }[] = [
        { panelKey: 'http_rate', value: snap.httpRequestRate, label: 'HTTP Request Rate' },
        { panelKey: 'latency_p99', value: snap.httpLatencyP99Ms, label: 'P99 Latency' },
        { panelKey: 'k8s_api', value: (snap.k8sGetRate + snap.k8sPatchRate + snap.k8sDeleteRate) / 60, label: 'K8s API Calls' },
        { panelKey: 'error_rate', value: snap.totalErrorRate, label: 'Error Rate' },
        { panelKey: 'cache_hit', value: snap.cacheHitRate, label: 'Cache Hit Rate' },
        { panelKey: 'ws_connections', value: snap.wsActiveConnections, label: 'WS Connections' },
      ]

      const newEvents: IncidentEvent[] = []
      const thresholdMap = new Map(thresholds.map((t) => [t.panelKey, t]))

      for (const { panelKey, value, label } of checks) {
        const t = thresholdMap.get(panelKey)
        if (!t) continue

        let status: string
        if (panelKey === 'cache_hit') {
          status = value < t.critVal ? 'crit' : value < t.warnVal ? 'warn' : 'ok'
        } else {
          status = value >= t.critVal ? 'crit' : value >= t.warnVal ? 'warn' : 'ok'
        }

        const prev = prevThresholdsRef.current[panelKey]
        if (status !== 'ok' && status !== prev) {
          newEvents.push({
            id: `${panelKey}-${Date.now()}`,
            severity: status === 'crit' ? 'critical' : 'warning',
            message: `${label}: ${value.toFixed(1)} exceeded ${status === 'crit' ? 'critical' : 'warning'} threshold`,
            timestamp: new Date().toISOString(),
            panelKey,
          })
        }
        prevThresholdsRef.current[panelKey] = status
      }

      if (newEvents.length > 0) {
        setEvents((prev) => [...newEvents, ...prev].slice(0, MAX_EVENTS))
      }
    },
    [],
  )

  // Fetch runtime config (polls every 30s to pick up guardrail changes)
  useEffect(() => {
    let active = true
    async function fetchConfig() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/observability/config`, { credentials: 'include' })
        if (res.ok && active) setRuntimeConfig(await res.json())
      } catch { /* ignore */ }
    }
    fetchConfig()
    const interval = setInterval(fetchConfig, 30_000)
    return () => { active = false; clearInterval(interval) }
  }, [])

  // Event TTL cleanup
  useEffect(() => {
    const interval = setInterval(() => {
      const cutoff = Date.now() - EVENT_TTL_MS
      setEvents((prev) => prev.filter((e) => new Date(e.timestamp).getTime() > cutoff))
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    const controller = new AbortController()

    async function connect() {
      while (mountedRef.current) {
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/observability/stream`,
            { signal: controller.signal, credentials: 'include' },
          )
          if (!res.ok || !res.body) {
            failCountRef.current += 1
            if (failCountRef.current > 1) setDisconnected(true)
            await new Promise((r) => setTimeout(r, reconnectDelay(failCountRef.current)))
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
                  const payload: ObservabilityStreamPayload = JSON.parse(line.slice(6))
                  setLatest(payload)
                  setHistory((prev) => {
                    const next = [...prev, payload.snapshot]
                    return next.length > HISTORY_SIZE ? next.slice(-HISTORY_SIZE) : next
                  })
                  if (payload.recentCalls?.length) {
                    setRecentCalls((prev) => {
                      const seen = new Set(prev.map((c) => c.id))
                      const fresh = payload.recentCalls.filter((c) => !seen.has(c.id))
                      return [...fresh, ...prev].slice(0, MAX_CALLS)
                    })
                  }
                  checkThresholdCrossing(payload.snapshot, payload.thresholds)
                } catch {
                  // skip malformed events
                }
              }
            }
          }
        } catch {
          if (!mountedRef.current) break
          failCountRef.current += 1
          if (failCountRef.current > 1) setDisconnected(true)
          await new Promise((r) => setTimeout(r, reconnectDelay(failCountRef.current)))
          if (controller.signal.aborted) break
        }
      }
    }

    connect()
    return () => {
      mountedRef.current = false
      controller.abort()
    }
  }, [checkThresholdCrossing])

  return { latest, history, events, recentCalls, runtimeConfig, disconnected }
}
