/**
 * Shared constants used across multiple components.
 */

export const TIMEZONES = [
  'UTC',
  // Europe
  'Europe/London', 'Europe/Dublin', 'Europe/Lisbon',
  'Europe/Paris', 'Europe/Berlin', 'Europe/Amsterdam', 'Europe/Brussels',
  'Europe/Madrid', 'Europe/Rome', 'Europe/Zurich',
  'Europe/Budapest', 'Europe/Warsaw', 'Europe/Prague', 'Europe/Vienna',
  'Europe/Athens', 'Europe/Helsinki', 'Europe/Stockholm',
  'Europe/Moscow', 'Europe/Istanbul',
  // Americas
  'America/New_York', 'America/Toronto',
  'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'America/Vancouver',
  'America/Sao_Paulo', 'America/Argentina/Buenos_Aires',
  'America/Mexico_City', 'America/Bogota',
  // Asia
  'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata',
  'Asia/Dhaka', 'Asia/Bangkok', 'Asia/Singapore', 'Asia/Shanghai',
  'Asia/Tokyo', 'Asia/Seoul',
  // Africa
  'Africa/Cairo', 'Africa/Nairobi', 'Africa/Johannesburg', 'Africa/Lagos',
  // Pacific & Oceania
  'Australia/Sydney', 'Australia/Melbourne', 'Australia/Perth',
  'Pacific/Auckland',
]

// ── Polling & timeout intervals (ms) ──
export const REQUEST_TIMEOUT_MS = 30_000
export const DEFAULT_STALE_TIME_MS = 30_000
export const WORKLOADS_REFETCH_MS = 30_000
export const NODES_REFETCH_MS = 30_000
export const POLICIES_REFETCH_MS = 30_000
export const EXCEPTIONS_REFETCH_MS = 30_000
export const ACTIVITY_FEED_STALE_MS = 14_000
export const ACTIVITY_FEED_REFETCH_MS = 15_000
export const NODE_PODS_REFETCH_MS = 15_000
export const WORKLOAD_PODS_REFETCH_MS = 15_000
export const WS_RECONNECT_DELAY_MS = 3_000
export const SNACKBAR_AUTO_HIDE_MS = 4_000

// ── Drawer constraints ──
export const DRAWER_MIN_WIDTH = 360
export const DRAWER_MAX_WIDTH_RATIO = 0.9

// ── Log viewer ──
export const LOG_INITIAL_TAIL = 500
export const LOG_LOAD_INCREMENT = 2_000
export const LOG_MAX_LINES = 10_000

// ── Policy ──
export const MAX_TIMEOUT_MINUTES = 1_440   // 24 hours

// ── Time units ──
export const MINUTES_PER_HOUR = 60
export const MINUTES_PER_DAY = 24 * 60
export const HOURS_PER_WEEK = 7 * 24
