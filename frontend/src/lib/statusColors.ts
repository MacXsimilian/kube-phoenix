import type { LogLine } from './types'

// ── Policy state colors ──────────────────────────────────────────────────────

type PolicyState = 'sleeping' | 'awake' | 'transitioning' | 'unknown'

const STATE_COLORS_DARK: Record<PolicyState, { bg: string; color: string; label: string }> = {
  sleeping:      { bg: 'rgba(99,102,241,0.18)',  color: '#a5b4fc', label: 'Sleeping' },
  awake:         { bg: 'rgba(34,197,94,0.18)',   color: '#86efac', label: 'Awake' },
  transitioning: { bg: 'rgba(245,158,11,0.18)',  color: '#fcd34d', label: 'Transitioning' },
  unknown:       { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8', label: 'Unknown' },
}
const STATE_COLORS_LIGHT: Record<PolicyState, { bg: string; color: string; label: string }> = {
  sleeping:      { bg: 'rgba(99,102,241,0.18)',  color: '#4F46E5', label: 'Sleeping' },
  awake:         { bg: 'rgba(34,197,94,0.18)',   color: '#15803D', label: 'Awake' },
  transitioning: { bg: 'rgba(245,158,11,0.18)',  color: '#92400E', label: 'Transitioning' },
  unknown:       { bg: 'rgba(148,163,184,0.15)', color: '#475569', label: 'Unknown' },
}
export function stateColors(isDark: boolean): Record<PolicyState, { bg: string; color: string; label: string }> {
  return isDark ? STATE_COLORS_DARK : STATE_COLORS_LIGHT
}

// ── Execution / exception status colors ──────────────────────────────────────

type ExecutionStatus = 'running' | 'success' | 'failed' | 'interrupted' | 'skipped' | 'pending' | 'active' | 'completed' | 'cancelled'

const EXEC_STATUS_DARK: Record<ExecutionStatus, { bg: string; color: string }> = {
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
const EXEC_STATUS_LIGHT: Record<ExecutionStatus, { bg: string; color: string }> = {
  running:     { bg: 'rgba(245,158,11,0.18)',  color: '#92400E' },
  success:     { bg: 'rgba(34,197,94,0.18)',   color: '#15803D' },
  failed:      { bg: 'rgba(239,68,68,0.18)',   color: '#B91C1C' },
  interrupted: { bg: 'rgba(148,163,184,0.15)', color: '#475569' },
  skipped:     { bg: 'rgba(148,163,184,0.15)', color: '#475569' },
  pending:     { bg: 'rgba(148,163,184,0.15)', color: '#475569' },
  active:      { bg: 'rgba(34,197,94,0.18)',   color: '#15803D' },
  completed:   { bg: 'rgba(148,163,184,0.15)', color: '#475569' },
  cancelled:   { bg: 'rgba(239,68,68,0.18)',   color: '#B91C1C' },
}
export function executionStatusColors(isDark: boolean): Record<ExecutionStatus, { bg: string; color: string }> {
  return isDark ? EXEC_STATUS_DARK : EXEC_STATUS_LIGHT
}

const EXEC_FALLBACK_DARK = { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8' }
const EXEC_FALLBACK_LIGHT = { bg: 'rgba(148,163,184,0.15)', color: '#475569' }
export function executionStatusFallback(isDark: boolean): { bg: string; color: string } {
  return isDark ? EXEC_FALLBACK_DARK : EXEC_FALLBACK_LIGHT
}

// ── Mode colors (plan / apply chips) ─────────────────────────────────────────

type ExecutionMode = 'apply' | 'plan'

const MODE_DARK: Record<ExecutionMode, { bg: string; color: string }> = {
  apply: { bg: 'rgba(245,158,11,0.18)', color: '#FCD34D' },
  plan:  { bg: 'rgba(59,130,246,0.18)',  color: '#93C5FD' },
}
const MODE_LIGHT: Record<ExecutionMode, { bg: string; color: string }> = {
  apply: { bg: 'rgba(245,158,11,0.18)', color: '#92400E' },
  plan:  { bg: 'rgba(59,130,246,0.18)',  color: '#1D4ED8' },
}
export function modeColors(isDark: boolean): Record<ExecutionMode, { bg: string; color: string }> {
  return isDark ? MODE_DARK : MODE_LIGHT
}

export const SMALL_CHIP_SX = { height: 18, fontSize: 10 } as const

// ── Header gradient bars (per policy state) ──────────────────────────────────

/** Horizontal gradient for PolicyCard top edge */
export const CARD_HEADER_GRADIENTS: Record<PolicyState, string> = {
  sleeping:      'linear-gradient(90deg, #7C3AED 0%, #a5b4fc 50%, rgba(165,180,252,0.15) 100%)',
  awake:         'linear-gradient(90deg, #22C55E 0%, #86efac 50%, rgba(134,239,172,0.15) 100%)',
  transitioning: 'linear-gradient(90deg, #F59E0B 0%, #fcd34d 50%, rgba(252,211,77,0.15) 100%)',
  unknown:       'linear-gradient(90deg, #475569 0%, #64748b 40%, rgba(100,116,139,0.1) 100%)',
}

/** Vertical gradient for detail page hero band background */
export const HERO_HEADER_GRADIENTS: Record<PolicyState, string> = {
  sleeping:      'linear-gradient(180deg, rgba(124,58,237,0.08) 0%, transparent 100%)',
  awake:         'linear-gradient(180deg, rgba(34,197,94,0.06) 0%, transparent 100%)',
  transitioning: 'linear-gradient(180deg, rgba(245,158,11,0.06) 0%, transparent 100%)',
  unknown:       'linear-gradient(180deg, rgba(148,163,184,0.04) 0%, transparent 100%)',
}

/** LED dot colors per policy state */
export const LED_COLORS: Record<PolicyState, { bg: string; glow: string }> = {
  sleeping:      { bg: '#a5b4fc', glow: 'rgba(165,180,252,0.5)' },
  awake:         { bg: '#86efac', glow: 'rgba(134,239,172,0.5)' },
  transitioning: { bg: '#fcd34d', glow: 'rgba(252,211,77,0.5)' },
  unknown:       { bg: '#64748b', glow: 'none' },
}

/** Subtle separator used between full-width bands */
export function subtleBorder(isDark: boolean): string {
  return isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)'
}

// ── Exception / override type labels ─────────────────────────────────────────

type OverrideType = 'stay_awake' | 'force_sleep' | 'skip_sleep' | 'skip_wake'

const TYPE_LABELS_DARK: Record<OverrideType, { label: string; color: string; bg: string }> = {
  stay_awake:  { label: 'Stay Awake',  color: '#FCD34D', bg: 'rgba(245,158,11,0.15)' },
  force_sleep: { label: 'Force Sleep', color: '#FCA5A5', bg: 'rgba(239,68,68,0.15)' },
  skip_sleep:  { label: 'Skip Sleep',  color: '#A5B4FC', bg: 'rgba(99,102,241,0.15)' },
  skip_wake:   { label: 'Skip Wake',   color: '#A5B4FC', bg: 'rgba(99,102,241,0.15)' },
}
const TYPE_LABELS_LIGHT: Record<OverrideType, { label: string; color: string; bg: string }> = {
  stay_awake:  { label: 'Stay Awake',  color: '#92400E', bg: 'rgba(245,158,11,0.15)' },
  force_sleep: { label: 'Force Sleep', color: '#B91C1C', bg: 'rgba(239,68,68,0.15)' },
  skip_sleep:  { label: 'Skip Sleep',  color: '#4F46E5', bg: 'rgba(99,102,241,0.15)' },
  skip_wake:   { label: 'Skip Wake',   color: '#4F46E5', bg: 'rgba(99,102,241,0.15)' },
}
export function typeLabels(isDark: boolean): Record<OverrideType, { label: string; color: string; bg: string }> {
  return isDark ? TYPE_LABELS_DARK : TYPE_LABELS_LIGHT
}

const TYPE_FALLBACK_DARK = { label: 'Unknown', color: '#94A3B8', bg: 'rgba(148,163,184,0.15)' }
const TYPE_FALLBACK_LIGHT = { label: 'Unknown', color: '#475569', bg: 'rgba(148,163,184,0.15)' }
export function typeLabelFallback(isDark: boolean): { label: string; color: string; bg: string } {
  return isDark ? TYPE_FALLBACK_DARK : TYPE_FALLBACK_LIGHT
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

// ── Audit action labels ─────────────────────────────────────────────────────

type AuditAction =
  | 'policy.create' | 'policy.update' | 'policy.delete' | 'policy.sleep' | 'policy.wake'
  | 'policy.override.create' | 'policy.override.delete'
  | 'exception.create' | 'exception.update' | 'exception.delete'
  | 'guardrail.update' | 'admin.reset_db'
  | 'user.create' | 'user.update' | 'user.delete'
  | 'auth.login' | 'auth.logout' | 'auth.password_change'

const ACTION_LABELS: Record<AuditAction, string> = {
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
  return (ACTION_LABELS as Record<string, string>)[action] ?? action.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
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
