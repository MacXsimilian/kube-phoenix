'use client'

import { createContext, useContext, useMemo } from 'react'
import { useObservabilityStream } from './useObservabilityStream'
import type {
  ObservabilityStreamPayload,
  MetricSnapshot,
  IncidentEvent,
  ApiCall,
  RuntimeConfig,
} from '@/lib/observability-types'

interface MetricsSlice {
  latest: ObservabilityStreamPayload | null
  history: MetricSnapshot[]
}

interface ConnectionSlice {
  runtimeConfig: RuntimeConfig | null
  disconnected: boolean
}

const MetricsContext = createContext<MetricsSlice | null>(null)
const EventsContext = createContext<IncidentEvent[] | null>(null)
const CallsContext = createContext<ApiCall[] | null>(null)
const ConnectionContext = createContext<ConnectionSlice | null>(null)

export function ObservabilityStreamProvider({ children }: { children: React.ReactNode }) {
  const { latest, history, events, recentCalls, runtimeConfig, disconnected } = useObservabilityStream()
  const metrics = useMemo<MetricsSlice>(() => ({ latest, history }), [latest, history])
  const connection = useMemo<ConnectionSlice>(() => ({ runtimeConfig, disconnected }), [runtimeConfig, disconnected])

  return (
    <MetricsContext.Provider value={metrics}>
      <EventsContext.Provider value={events}>
        <CallsContext.Provider value={recentCalls}>
          <ConnectionContext.Provider value={connection}>
            {children}
          </ConnectionContext.Provider>
        </CallsContext.Provider>
      </EventsContext.Provider>
    </MetricsContext.Provider>
  )
}

function useSlice<T>(context: React.Context<T | null>, hookName: string): T {
  const value = useContext(context)
  if (value === null) {
    throw new Error(`${hookName} must be used within ObservabilityStreamProvider`)
  }
  return value
}

export function useObservabilityMetrics(): MetricsSlice {
  return useSlice(MetricsContext, 'useObservabilityMetrics')
}

export function useObservabilityEvents(): IncidentEvent[] {
  return useSlice(EventsContext, 'useObservabilityEvents')
}

export function useObservabilityCalls(): ApiCall[] {
  return useSlice(CallsContext, 'useObservabilityCalls')
}

export function useObservabilityConnection(): ConnectionSlice {
  return useSlice(ConnectionContext, 'useObservabilityConnection')
}
