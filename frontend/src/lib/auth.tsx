'use client'

import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, ReactNode } from 'react'
import type { User } from './types'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

// How often to re-fetch /api/auth/me to detect role changes or session expiry.
const ME_POLL_INTERVAL = 5 * 60 * 1000 // 5 minutes

interface AuthState {
  isAuthenticated: boolean
  checking: boolean
  backendError: boolean
  user: User | null
  oidcEnabled: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

/**
 * Read the CSRF token from the __kp_csrf cookie.
 * Returns '' if unavailable (e.g. SSR).
 */
export function getCSRFToken(): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(/(?:^|;\s*)__kp_csrf=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)
  const [backendError, setBackendError] = useState(false)
  const [oidcEnabled, setOidcEnabled] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchMe = useCallback(async (): Promise<User | null> => {
    try {
      const res = await fetch(`${BASE}/api/auth/me`, { credentials: 'include' })
      if (res.ok) {
        return (await res.json()) as User
      }
      return null
    } catch {
      return null
    }
  }, [])

  // Initial check on mount.
  useEffect(() => {
    // Check OIDC config in parallel.
    fetch(`${BASE}/api/auth/oidc/config`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.enabled) setOidcEnabled(true) })
      .catch(() => {})

    fetchMe()
      .then(u => {
        if (u) {
          setUser(u)
        } else {
          // Probe if backend requires auth at all (dev mode check).
          fetch(`${BASE}/api/policies`, { credentials: 'include' })
            .then(res => {
              if (res.ok) {
                // No auth required — dev mode. Create a synthetic user.
                setUser({
                  id: 0, username: 'dev', role: 'admin', source: 'local',
                  enabled: true, createdAt: '', permissions: [
                    'view.all', 'schedule.edit', 'schedule.trigger', 'guardrail.edit',
                    'user.manage', 'admin.reset_db', 'audit.view', 'password.change',
                  ],
                })
              } else if (res.status !== 401 && res.status !== 403) {
                setBackendError(true)
              }
            })
            .catch(() => setBackendError(true))
        }
      })
      .finally(() => setChecking(false))
  }, [fetchMe])

  // Listen for session-expired events from the API layer (401 responses).
  useEffect(() => {
    const handler = () => setUser(null)
    window.addEventListener('kp-session-expired', handler)
    return () => window.removeEventListener('kp-session-expired', handler)
  }, [])

  // Periodic refresh — detect role changes, session expiry, disabled accounts.
  useEffect(() => {
    if (!user || user.id === 0) return
    intervalRef.current = setInterval(async () => {
      const u = await fetchMe()
      if (u) {
        setUser(u)
      } else {
        // Session expired or user disabled — log out.
        setUser(null)
      }
    }, ME_POLL_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [user, fetchMe])

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (res.status === 401 || res.status === 403) throw new Error('Invalid credentials')
    if (res.status === 429) throw new Error('Too many attempts')
    if (!res.ok) throw new Error(`Server error (${res.status})`)
    const data = await res.json()
    // After login, fetch full me (with permissions) — the login response has
    // the user but the /me endpoint is authoritative with permissions.
    const me = await fetchMe()
    setUser(me ?? data.user)
  }, [fetchMe])

  const logout = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': getCSRFToken() },
      })
      // OIDC users: backend returns the Keycloak end_session URL.
      // Navigate the browser there so Keycloak terminates the SSO session.
      if (res.ok && res.status === 200) {
        const data = await res.json()
        if (data.oidcLogoutUrl) {
          window.location.href = data.oidcLogoutUrl
          return
        }
      }
    } catch { /* ignore */ }
    setUser(null)
  }, [])

  const value = useMemo(() => ({
    isAuthenticated: !!user,
    checking,
    backendError,
    user,
    oidcEnabled,
    login,
    logout,
  }), [user, checking, backendError, oidcEnabled, login, logout])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

/** Convenience hook that returns the current user (throws if not authenticated). */
export function useUser(): User {
  const { user } = useAuth()
  if (!user) throw new Error('useUser called without authenticated user')
  return user
}
