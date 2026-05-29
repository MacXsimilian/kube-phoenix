'use client'

import { createContext, useContext, useEffect, useState } from 'react'

const TICK_INTERVAL_MS = 30_000

const ClockTickContext = createContext<number>(0)

/**
 * Single shared 30-second clock used by components that need to refresh
 * time-derived UI (e.g. "now" indicators). Replaces per-instance setIntervals
 * so N consumers share one timer.
 */
export function ClockTickProvider({ children }: { children: React.ReactNode }) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setTick(prev => prev + 1)
    }, TICK_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  return <ClockTickContext value={tick}>{children}</ClockTickContext>
}

export function useClockTick(): number {
  return useContext(ClockTickContext)
}
