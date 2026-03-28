import type { AuditLogEntry } from '@/lib/types'

// ── Snapshot parsing ────────────────────────────────────────────────────────

const NULL_SNAPSHOT = 'null'

function isEmptySnapshot(json?: string): boolean {
  return !json || json === NULL_SNAPSHOT
}

export function flattenToLeaves(value: unknown, prefix = ''): Record<string, string> {
  if (value === null || value === undefined) return prefix ? { [prefix]: 'null' } : {}
  if (typeof value !== 'object' || Array.isArray(value)) return { [prefix]: JSON.stringify(value) }
  const result: Record<string, string> = {}
  for (const [fieldKey, child] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${fieldKey}` : fieldKey
    Object.assign(result, flattenToLeaves(child, path))
  }
  return result
}

export function parseSnapshot(json: string): Record<string, string> | null {
  try {
    return flattenToLeaves(JSON.parse(json))
  } catch {
    return null
  }
}

// ── Diff computation ────────────────────────────────────────────────────────

export type DiffType = 'added' | 'removed' | 'changed' | 'unchanged'

export interface DiffEntry {
  key: string
  type: DiffType
  before?: string
  after?: string
}

type DiffStyle = { bg: string; border: string; text: string; prefix: string }

export const DIFF_STYLE: Record<DiffType, DiffStyle> = {
  added:     { bg: 'rgba(34,197,94,0.10)',  border: '#86efac', text: '#86efac', prefix: '+' },
  removed:   { bg: 'rgba(239,68,68,0.10)',  border: '#fca5a5', text: '#fca5a5', prefix: '-' },
  changed:   { bg: 'rgba(245,158,11,0.10)', border: '#fcd34d', text: '#fcd34d', prefix: '~' },
  unchanged: { bg: 'transparent',           border: 'transparent', text: '',    prefix: ' ' },
}

function classifyLine(key: string, beforeValue: string | undefined, afterValue: string | undefined): DiffEntry {
  if (beforeValue === undefined) return { key, type: 'added', after: afterValue }
  if (afterValue === undefined) return { key, type: 'removed', before: beforeValue }
  if (beforeValue !== afterValue) return { key, type: 'changed', before: beforeValue, after: afterValue }
  return { key, type: 'unchanged', before: beforeValue, after: afterValue }
}

export function computeDiff(beforeJson?: string, afterJson?: string): DiffEntry[] | null {
  if (isEmptySnapshot(beforeJson) && isEmptySnapshot(afterJson)) return null

  const flatBefore = isEmptySnapshot(beforeJson) ? {} : parseSnapshot(beforeJson!)
  const flatAfter  = isEmptySnapshot(afterJson)  ? {} : parseSnapshot(afterJson!)

  if (flatBefore === null || flatAfter === null) return null

  const allKeys = Array.from(new Set([...Object.keys(flatBefore), ...Object.keys(flatAfter)])).sort()
  return allKeys.map(key => classifyLine(key, flatBefore[key], flatAfter[key]))
}

export function formatChangeSummary(changedCount: number): string {
  if (changedCount === 0) return 'No fields changed'
  return `${changedCount} field${changedCount !== 1 ? 's' : ''} changed`
}

// ── CSV export ──────────────────────────────────────────────────────────────

function toUTCString(ts: string): string {
  return new Date(ts).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
}

export function downloadCSV(items: AuditLogEntry[]): void {
  const header = ['Time (UTC)', 'User', 'Action', 'Resource', 'IP Address']
  const rows = items.map(e => [
    toUTCString(e.timestamp),
    e.username,
    e.action,
    e.resourceType ? `${e.resourceType}${e.resourceId != null ? ' #' + e.resourceId : ''}` : '',
    e.ipAddress ?? '',
  ])
  const csv = [header, ...rows]
    .map(row => row.map(v => `"${v.replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `audit-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
