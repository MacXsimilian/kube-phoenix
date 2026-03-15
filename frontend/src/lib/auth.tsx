'use client'

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'

const STORAGE_KEY = 'kube-phoenix-auth'
const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

interface AuthState {
  isAuthenticated: boolean
  checking: boolean
  backendError: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function getAuthHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const token = sessionStorage.getItem(STORAGE_KEY)
  return token ? { Authorization: `Basic ${token}` } : {}
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const [backendError, setBackendError] = useState(false)

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (stored) {
      setToken(stored)
      setChecking(false)
      return
    }
    // Probe: if backend has no basic auth (dev mode), skip login screen
    fetch(`${BASE}/api/schedules`)
      .then(res => {
        if (res.ok) {
          setToken('__no_auth__')
        } else if (res.status !== 401 && res.status !== 403) {
          setBackendError(true)
        }
      })
      .catch(() => { setBackendError(true) })
      .finally(() => setChecking(false))
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const t = btoa(`${username}:${password}`)
    const res = await fetch(`${BASE}/api/schedules`, {
      headers: { Authorization: `Basic ${t}` },
    })
    if (res.status === 401 || res.status === 403) throw new Error('Invalid credentials')
    if (!res.ok) throw new Error(`Server error (${res.status})`)
    sessionStorage.setItem(STORAGE_KEY, t)
    setToken(t)
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY)
    setToken(null)
  }, [])

  return (
    <AuthContext.Provider value={{ isAuthenticated: !!token, checking, backendError, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
