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
