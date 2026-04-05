'use client'

import { createContext, useContext } from 'react'
import { useObservabilityStream, type ObservabilityStreamState } from './useObservabilityStream'

const ObservabilityStreamContext = createContext<ObservabilityStreamState | null>(null)

export function ObservabilityStreamProvider({ children }: { children: React.ReactNode }) {
  const stream = useObservabilityStream()
  return (
    <ObservabilityStreamContext.Provider value={stream}>
      {children}
    </ObservabilityStreamContext.Provider>
  )
}

export function useSharedObservabilityStream(): ObservabilityStreamState {
  const ctx = useContext(ObservabilityStreamContext)
  if (!ctx) {
    throw new Error('useSharedObservabilityStream must be used within ObservabilityStreamProvider')
  }
  return ctx
}
