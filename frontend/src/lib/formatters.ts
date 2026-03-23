/**
 * Shared formatting utilities used across cluster, overview, and history components.
 */

/** Format millicores → "1.5c" or "500m" */
export function fmtCpu(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}c` : `${m}m`
}

/** Format bytes → "1.5G" or "512M" */
export function fmtMem(bytes: number): string {
  const gib = bytes / 1073741824
  return gib >= 1 ? `${gib.toFixed(1)}G` : `${Math.round(bytes / 1048576)}M`
}

/** Format an ISO timestamp as a short age string: "5m", "3h", "2d" */
export function podAge(iso: string): string {
  if (!iso) return '—'
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

/** Format a millisecond timestamp as "just now", "5s ago", "3m ago" */
export function sinceMs(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 10) return 'just now'
  if (s < 60) return `${s}s ago`
  return `${Math.floor(s / 60)}m ago`
}

/** Format an ISO timestamp as a countdown: "now", "in 5m", "in 2h 30m", "in 5d 8h" */
export function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'now'
  const m = Math.floor(diff / 60000)
  if (m < 60) return `in ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return m % 60 > 0 ? `in ${h}h ${m % 60}m` : `in ${h}h`
  const d = Math.floor(h / 24)
  const remH = h % 24
  return remH > 0 ? `in ${d}d ${remH}h` : `in ${d}d`
}

/** Calculate a percentage, returning 0 when total is zero */
export function pct(used: number, total: number): number {
  return total > 0 ? Math.round((used / total) * 100) : 0
}

/** Return a colour for a percentage value, red >= 85, amber >= 65, green otherwise */
export function pctColor(p: number, isDark: boolean): string {
  if (p >= 85) return isDark ? '#F87171' : '#B91C1C'
  if (p >= 65) return '#FBBF24'
  return isDark ? '#22C55E' : '#15803D'
}

/** Format an ISO date-time string to a locale string, returning an em-dash for nullish values */
export function fmtDt(iso: string | null | undefined): string {
  if (!iso) return '\u2014'
  return new Date(iso).toLocaleString()
}

/** Format an ISO timestamp as a relative past time: "just now", "5m ago", "2h ago", "3d ago" */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
