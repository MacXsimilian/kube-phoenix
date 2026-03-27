/**
 * Shared formatting utilities used across cluster, overview, and history components.
 */

const MILLICORES_PER_CORE = 1000
const BYTES_PER_GIB = 1_073_741_824
const BYTES_PER_MIB = 1_048_576
const SECONDS_PER_HOUR = 3_600
const SECONDS_PER_DAY = 86_400

function safeDate(iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, opts)
}

function getElapsedParts(seconds: number): { value: number; unit: string } {
  if (seconds < SECONDS_PER_HOUR) return { value: Math.floor(seconds / 60), unit: 'm' }
  if (seconds < SECONDS_PER_DAY) return { value: Math.floor(seconds / SECONDS_PER_HOUR), unit: 'h' }
  return { value: Math.floor(seconds / SECONDS_PER_DAY), unit: 'd' }
}

/** Format millicores → "1.5c" or "500m" */
export function formatCpu(m: number): string {
  return m >= MILLICORES_PER_CORE ? `${(m / MILLICORES_PER_CORE).toFixed(1)}c` : `${m}m`
}

/** Format bytes → "1.5G" or "512M" */
export function formatMem(bytes: number): string {
  const gib = bytes / BYTES_PER_GIB
  return gib >= 1 ? `${gib.toFixed(1)}G` : `${Math.round(bytes / BYTES_PER_MIB)}M`
}

/** Format an ISO timestamp as a short age string: "5m", "3h", "2d" */
export function formatPodAge(iso: string): string {
  if (!iso) return '—'
  const ageSeconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  const { value, unit } = getElapsedParts(ageSeconds)
  return `${value}${unit}`
}

/** Format a millisecond timestamp as "just now", "5s ago", "3m ago" */
export function formatTimeSinceMs(ms: number): string {
  const elapsedSeconds = Math.floor((Date.now() - ms) / 1000)
  if (elapsedSeconds < 10) return 'just now'
  if (elapsedSeconds < 60) return `${elapsedSeconds}s ago`
  return `${Math.floor(elapsedSeconds / 60)}m ago`
}

/** Format an ISO timestamp as a countdown: "now", "in 5m", "in 2h 30m", "in 5d 8h" */
export function formatCountdown(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'now'
  const minutesDiff = Math.floor(diff / 60000)
  if (minutesDiff < 60) return `in ${minutesDiff}m`
  const hoursDiff = Math.floor(minutesDiff / 60)
  if (hoursDiff < 24) return minutesDiff % 60 > 0 ? `in ${hoursDiff}h ${minutesDiff % 60}m` : `in ${hoursDiff}h`
  const daysDiff = Math.floor(hoursDiff / 24)
  const remH = hoursDiff % 24
  return remH > 0 ? `in ${daysDiff}d ${remH}h` : `in ${daysDiff}d`
}

/** Calculate a percentage, returning 0 when total is zero */
export function calculatePercentage(used: number, total: number): number {
  return total > 0 ? Math.round((used / total) * 100) : 0
}

/** Return a colour for a percentage value, red >= 85, amber >= 65, green otherwise */
export function getPercentageColor(p: number, isDark: boolean): string {
  if (p >= 85) return isDark ? '#F87171' : '#B91C1C'
  if (p >= 65) return '#FBBF24'
  return isDark ? '#22C55E' : '#15803D'
}

/** Format an ISO date-time string to a locale string, returning an em-dash for nullish values */
export function formatDateTime(iso: string | null | undefined): string {
  return safeDate(iso)
}

/** Format an ISO date-time string as a short date: "Mar 24, 2026, 2:15 PM" */
export function formatDateTimeShort(iso: string | null | undefined): string {
  return safeDate(iso, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/** Format execution duration from start/end ISO timestamps */
export function formatDuration(startedAt: string, finishedAt: string | null): string {
  if (!finishedAt) return 'Running\u2026'
  const seconds = Math.floor(
    (new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000
  )
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

/** Format an ISO timestamp as a relative past time: "just now", "5m ago", "2h ago", "3d ago" */
export function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutesDiff = Math.floor(diff / 60000)
  if (minutesDiff < 1) return 'just now'
  if (minutesDiff < 60) return `${minutesDiff}m ago`
  const hoursDiff = Math.floor(minutesDiff / 60)
  if (hoursDiff < 24) return `${hoursDiff}h ago`
  const { value } = getElapsedParts(Math.floor(diff / 1000))
  return `${value}d ago`
}
