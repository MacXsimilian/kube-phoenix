import type { LogLine } from './types'

// ── Policy state colors ──────────────────────────────────────────────────────

export const STATE_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  sleeping:      { bg: 'rgba(99,102,241,0.18)',  color: '#a5b4fc', label: 'Sleeping' },
  awake:         { bg: 'rgba(34,197,94,0.18)',   color: '#86efac', label: 'Awake' },
  transitioning: { bg: 'rgba(245,158,11,0.18)',  color: '#fcd34d', label: 'Transitioning' },
  unknown:       { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8', label: 'Unknown' },
}

// ── Execution / exception status colors ──────────────────────────────────────

export const EXECUTION_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  running:     { bg: 'rgba(245,158,11,0.18)',  color: '#fcd34d' },
  success:     { bg: 'rgba(34,197,94,0.18)',   color: '#86efac' },
  failed:      { bg: 'rgba(239,68,68,0.18)',   color: '#fca5a5' },
  interrupted: { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8' },
  skipped:     { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8' },
  pending:     { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8' },
  active:      { bg: 'rgba(34,197,94,0.18)',   color: '#86efac' },
  completed:   { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8' },
  cancelled:   { bg: 'rgba(239,68,68,0.18)',   color: '#fca5a5' },
}

export const EXECUTION_STATUS_FALLBACK: { bg: string; color: string } = {
  bg: 'rgba(148,163,184,0.15)',
  color: '#94a3b8',
}

// ── Mode colors (plan / apply chips) ─────────────────────────────────────────

export const MODE_COLORS: Record<string, { bg: string; color: string }> = {
  apply: { bg: 'rgba(245,158,11,0.18)', color: '#FCD34D' },
  plan:  { bg: 'rgba(59,130,246,0.18)',  color: '#93C5FD' },
}

export const SMALL_CHIP_SX = { height: 18, fontSize: 10 } as const

// ── Exception / override type labels ─────────────────────────────────────────

export const TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  stay_awake:  { label: 'Stay Awake',  color: '#FCD34D', bg: 'rgba(245,158,11,0.15)' },
  force_sleep: { label: 'Force Sleep', color: '#FCA5A5', bg: 'rgba(239,68,68,0.15)' },
  skip_sleep:  { label: 'Skip Sleep',  color: '#A5B4FC', bg: 'rgba(99,102,241,0.15)' },
  skip_wake:   { label: 'Skip Wake',   color: '#A5B4FC', bg: 'rgba(99,102,241,0.15)' },
}

export const TYPE_LABEL_FALLBACK = { label: 'Unknown', color: '#94A3B8', bg: 'rgba(148,163,184,0.15)' }

// ── Log level colors ─────────────────────────────────────────────────────────

export const LOG_LEVEL_COLORS_DARK: Record<LogLine['level'], string> = {
  info: '#22D3EE',
  ok: '#22C55E',
  plan: '#C084FC',
  error: '#F87171',
  warn: '#FBBF24',
}

export const LOG_LEVEL_COLORS_LIGHT: Record<LogLine['level'], string> = {
  info: '#0369A1',
  ok: '#15803D',
  plan: '#6D28D9',
  error: '#B91C1C',
  warn: '#92400E',
}

// ── Audit action labels ─────────────────────────────────────────────────────

export const ACTION_LABELS: Record<string, string> = {
  'policy.create': 'Policy Create', 'policy.update': 'Policy Update', 'policy.delete': 'Policy Delete',
  'policy.sleep': 'Policy Sleep', 'policy.wake': 'Policy Wake',
  'policy.override.create': 'Override Create', 'policy.override.delete': 'Override Delete',
  'exception.create': 'Exception Create', 'exception.update': 'Exception Update', 'exception.delete': 'Exception Delete',
  'guardrail.update': 'Guardrail Update',
  'admin.reset_db': 'Reset Database',
  'user.create': 'User Create', 'user.update': 'User Update', 'user.delete': 'User Delete',
  'auth.login': 'Login', 'auth.logout': 'Logout', 'auth.password_change': 'Password Change',
}

export function formatActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function actionColor(action: string): 'error' | 'warning' | 'info' | 'success' | 'default' {
  if (action === 'admin.reset_db') return 'error'
  if (action.endsWith('.delete')) return 'error'
  if (action.endsWith('.create')) return 'success'
  if (action === 'auth.login') return 'success'
  if (action === 'auth.logout') return 'default'
  if (action.endsWith('.sleep') || action.endsWith('.wake') || action === 'auth.password_change') return 'warning'
  return 'info'
}
