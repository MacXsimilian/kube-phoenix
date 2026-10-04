'use client'

import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { User } from './types'
import { REQUEST_TIMEOUT_MS } from './constants'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

// How often to re-fetch /api/auth/me to detect role changes or session expiry.
const ME_POLL_INTERVAL = 5 * 60 * 1000 // 5 minutes

const DEV_PERMISSIONS = [
  'view.all', 'schedule.edit', 'schedule.trigger', 'guardrail.edit',
  'user.manage', 'admin.reset_db', 'audit.view', 'password.change',
] as const

interface AuthState {
  isAuthenticated: boolean
  checking: boolean
  backendError: boolean
  user: User | null
  oidcEnabled: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  /** Re-fetch the current user from /api/auth/me (e.g. after settings change). */
  refreshUser: () => Promise<void>
}

type FetchMeResult =
  | { kind: 'user'; user: User }
  | { kind: 'unauthenticated' }
  | { kind: 'error' }

function usersEqual(a: User | null, b: User | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.id === b.id &&
    a.username === b.username &&
    a.role === b.role &&
    a.source === b.source &&
    a.enabled === b.enabled &&
    a.createdAt === b.createdAt &&
    a.defaultTimezone === b.defaultTimezone &&
    a.permissions.length === b.permissions.length &&
    a.permissions.every((p, i) => p === b.permissions[i])
  )
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
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)
  const [backendError, setBackendError] = useState(false)
  const [oidcEnabled, setOidcEnabled] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const userRef = useRef<User | null>(null)

  const updateUser = useCallback((nextUser: User | null) => {
    if (userRef.current?.id !== nextUser?.id) queryClient.clear()
    userRef.current = nextUser
    setUser(prev => usersEqual(prev, nextUser) ? prev : nextUser)
  }, [queryClient])

  const fetchMe = useCallback(async (): Promise<FetchMeResult> => {
    try {
      const res = await fetch(`${BASE}/api/auth/me`, { credentials: 'include' })
      if (res.ok) {
        return { kind: 'user', user: (await res.json()) as User }
      }
      if (res.status === 401 || res.status === 403) {
        return { kind: 'unauthenticated' }
      }
      return { kind: 'error' }
    } catch {
      return { kind: 'error' }
    }
  }, [])

  // Initial check on mount.
  useEffect(() => {
    // Check OIDC config in parallel.
    fetch(`${BASE}/api/auth/oidc/config`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.enabled) setOidcEnabled(true) })
      // OIDC is optional — silent failure is acceptable; log only in dev for debugging.
      .catch((err) => { if (process.env.NODE_ENV === 'development') console.warn('[kp] OIDC config fetch failed:', err) })

    fetchMe()
      .then(result => {
        if (result.kind === 'user') {
          updateUser(result.user)
        } else if (result.kind === 'unauthenticated') {
          // Probe if backend requires auth at all (dev mode check). The probe
          // intentionally bypasses apiFetch because 401/403 is the expected
          // signal for "auth required" rather than a real session-expiry event.
          fetch(`${BASE}/api/policies`, {
            credentials: 'include',
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          })
            .then(res => {
              if (res.ok) {
                // No auth required — dev mode. Create a synthetic user.
                updateUser({
                  id: 0, username: 'dev', role: 'admin', source: 'local',
                  enabled: true, createdAt: '', permissions: [...DEV_PERMISSIONS],
                })
              } else if (res.status !== 401 && res.status !== 403) {
                setBackendError(true)
              }
            })
            .catch(() => setBackendError(true))
        } else {
          // Network or server error — assume backend trouble rather than logout.
          setBackendError(true)
        }
      })
      .finally(() => setChecking(false))
  }, [fetchMe, updateUser])

  // Listen for session-expired events from the API layer (401 responses).
  useEffect(() => {
    const handler = () => updateUser(null)
    window.addEventListener('kp-session-expired', handler)
    return () => window.removeEventListener('kp-session-expired', handler)
  }, [updateUser])

  // Periodic refresh — detect role changes, session expiry, disabled accounts.
  // Derive a stable boolean so the interval starts/stops on login/logout but does
  // not restart every time the user object is refreshed.
  const shouldPoll = !!user && user.id !== 0
  useEffect(() => {
    if (!shouldPoll) return
    intervalRef.current = setInterval(async () => {
      if (!userRef.current || userRef.current.id === 0) return
      const requestedUserId = userRef.current.id
      const result = await fetchMe()
      if (userRef.current?.id !== requestedUserId) return
      if (result.kind === 'user') {
        updateUser(result.user)
      } else if (result.kind === 'unauthenticated') {
        // Session expired or user disabled — log out.
        updateUser(null)
      }
      // 'error' (network / 5xx): preserve current user; the next poll will retry.
    }, ME_POLL_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [shouldPoll, fetchMe, updateUser])

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
    updateUser(me.kind === 'user' ? me.user : data.user)
  }, [fetchMe, updateUser])

  const refreshUser = useCallback(async () => {
    const requestedUserId = userRef.current?.id
    const me = await fetchMe()
    if (userRef.current?.id !== requestedUserId) return
    if (me.kind === 'user') updateUser(me.user)
    else if (me.kind === 'unauthenticated') updateUser(null)
  }, [fetchMe, updateUser])

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
          updateUser(null)
          window.location.href = data.oidcLogoutUrl
          return
        }
      }
    } catch (err) { if (process.env.NODE_ENV === 'development') console.warn('[kp] logout failed:', err) }
    updateUser(null)
  }, [updateUser])

  const value = useMemo(() => ({
    isAuthenticated: !!user,
    checking,
    backendError,
    user,
    oidcEnabled,
    login,
    logout,
    refreshUser,
  }), [user, checking, backendError, oidcEnabled, login, logout, refreshUser])

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
