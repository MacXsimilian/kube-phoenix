'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeModeContextValue {
  mode: ThemeMode
  setMode: (m: ThemeMode) => void
  resolvedMode: 'light' | 'dark'
}

const ThemeModeContext = createContext<ThemeModeContextValue>({
  mode: 'dark',
  setMode: () => {},
  resolvedMode: 'dark',
})

const STORAGE_KEY = 'kube-phoenix-theme'

export function ThemeModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark')
  const [systemDark, setSystemDark] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      setModeState(stored)
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    setSystemDark(mq.matches)
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  function setMode(m: ThemeMode) {
    setModeState(m)
    localStorage.setItem(STORAGE_KEY, m)
  }

  const resolvedMode: 'light' | 'dark' =
    mode === 'system' ? (systemDark ? 'dark' : 'light') : mode

  const value = useMemo(
    () => ({ mode, setMode, resolvedMode }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, resolvedMode],
  )

  return (
    <ThemeModeContext.Provider value={value}>
      {children}
    </ThemeModeContext.Provider>
  )
}

export function useThemeMode() {
  return useContext(ThemeModeContext)
}
