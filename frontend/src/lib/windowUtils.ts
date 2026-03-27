import type { SleepWindow } from './types'
import { HOURS_PER_WEEK, MINUTES_PER_DAY, MINUTES_PER_HOUR } from './constants'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const MIN_DAYS_FOR_RANGE_NOTATION = 3
const HOURS_PER_HALF_DAY = 12

interface TimeRange {
  startMin: number
  endMin: number
}

function parseTimeRange(startTime: string, endTime: string): TimeRange {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  return {
    startMin: sh * MINUTES_PER_HOUR + sm,
    endMin: eh * MINUTES_PER_HOUR + em,
  }
}

/**
 * Format a time string "HH:MM" to locale-friendly display.
 * e.g. "19:00" → "7:00 PM", "07:00" → "7:00 AM"
 */
export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const suffix = h >= HOURS_PER_HALF_DAY ? 'PM' : 'AM'
  const hour12 = h === 0 ? HOURS_PER_HALF_DAY : h > HOURS_PER_HALF_DAY ? h - HOURS_PER_HALF_DAY : h
  return m === 0 ? `${hour12} ${suffix}` : `${hour12}:${String(m).padStart(2, '0')} ${suffix}`
}

/**
 * Returns true if the window crosses midnight (end <= start).
 * AllDay windows do not cross midnight.
 */
export function isOvernight(window: SleepWindow): boolean {
  if (window.allDay) return false
  const { startMin, endMin } = parseTimeRange(window.startTime, window.endTime)
  return endMin <= startMin
}

/**
 * Format an array of day numbers into a compact range string.
 * e.g. [1,2,3,4,5] → "Mon–Fri", [0,6] → "Sat–Sun", [1,3,5] → "Mon, Wed, Fri"
 */
export function formatDayRange(days: number[]): string {
  if (days.length === 0) return ''
  if (days.length === 7) return 'Every day'

  const sorted = [...days].sort((a, b) => a - b)

  // Check for known compact patterns
  const weekdays = [1, 2, 3, 4, 5]
  const weekend = [0, 6]
  if (arrayEquals(sorted, weekdays)) return 'Mon\u2013Fri'
  if (arrayEquals(sorted, weekend)) return 'Sat\u2013Sun'

  // Try to find consecutive runs
  const runs: number[][] = []
  let run: number[] = [sorted[0]]
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === run[run.length - 1] + 1) {
      run.push(sorted[i])
    } else {
      runs.push(run)
      run = [sorted[i]]
    }
  }
  runs.push(run)

  return runs
    .map(r =>
      r.length >= MIN_DAYS_FOR_RANGE_NOTATION
        ? `${DAY_NAMES[r[0]]}\u2013${DAY_NAMES[r[r.length - 1]]}`
        : r.map(d => DAY_NAMES[d]).join(', '),
    )
    .join(', ')
}

function arrayEquals(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

/**
 * Format sleep windows into a human-readable summary.
 * e.g. "Mon–Fri 7 PM – 7 AM" or "Mon–Fri 7 PM – 7 AM, Sat–Sun all day"
 */
export function windowsToText(windows: SleepWindow[]): string {
  if (!windows || windows.length === 0) return ''

  return windows
    .map(window => {
      const days = formatDayRange(window.daysOfWeek)
      if (window.allDay) return `${days} all day`
      return `${days} ${formatTime(window.startTime)} \u2013 ${formatTime(window.endTime)}`
    })
    .join(', ')
}

/**
 * Convert "HH:MM" to fractional hours (0–24). Used for timeline rendering.
 */
export function timeToHours(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h + m / 60
}

/** Returns true if the policy has at least one sleep window configured. */
export function hasSleepWindows(windows: SleepWindow[] | null | undefined): windows is SleepWindow[] {
  return !!windows && windows.length > 0
}

/**
 * Compute total weekly sleep and awake hours from sleep windows.
 */
export function computeWeeklyStats(windows: SleepWindow[]): { sleepHours: number; awakeHours: number } {
  let sleepMinutes = 0

  for (const window of windows) {
    if (window.daysOfWeek.length === 0) continue
    let minutesPerDay: number
    if (window.allDay) {
      minutesPerDay = MINUTES_PER_DAY
    } else {
      const { startMin, endMin } = parseTimeRange(window.startTime, window.endTime)
      minutesPerDay = endMin <= startMin
        ? (MINUTES_PER_DAY - startMin) + endMin // overnight
        : endMin - startMin
    }
    sleepMinutes += minutesPerDay * window.daysOfWeek.length
  }

  const sleepHours = Math.round(sleepMinutes / MINUTES_PER_HOUR)
  return { sleepHours, awakeHours: HOURS_PER_WEEK - sleepHours }
}

/**
 * Returns the current day-of-week (0=Sun) and fractional hour,
 * optionally converted to the given IANA timezone.
 */
export function nowInTimezone(tz?: string): { dayOfWeek: number; fractionalHour: number } {
  let now = new Date()
  if (tz) {
    const dateInTimezone = now.toLocaleString('en-US', { timeZone: tz })
    now = new Date(dateInTimezone)
  }
  return {
    dayOfWeek: now.getDay(),
    fractionalHour: now.getHours() + now.getMinutes() / 60,
  }
}

// ── Shared timeline math ─────────────────────────────────────────────────────

/**
 * Maps JS Date.getDay() output (0 = Sun .. 6 = Sat) to UI week-row index (0 = Mon .. 6 = Sun).
 */
export const DOW_MAP = [1, 2, 3, 4, 5, 6, 0] // Mon..Sun

/** Convert an ISO timestamp to a Date in the given IANA timezone. */
export function toTimezone(iso: string, tz?: string): Date {
  const d = new Date(iso)
  if (!tz) return d
  return new Date(d.toLocaleString('en-US', { timeZone: tz }))
}

/** A day-row + fractional-hour range, independent of visual layout. */
export interface TimeBlock {
  row: number       // 0=Mon .. 6=Sun (index into DOW_MAP)
  startHour: number // fractional hour 0–24
  endHour: number   // fractional hour 0–24
}

/**
 * Split an absolute time range (ISO start/end) into per-day TimeBlocks,
 * one per calendar day the range touches.
 */
export function computeTimeRangeBlocks(startISO: string, endISO: string, tz?: string): TimeBlock[] {
  const blocks: TimeBlock[] = []
  const start = toTimezone(startISO, tz)
  const end = toTimezone(endISO, tz)

  const cursor = new Date(start)
  cursor.setHours(0, 0, 0, 0)
  const endDay = new Date(end)
  endDay.setHours(0, 0, 0, 0)

  while (cursor <= endDay) {
    const row = DOW_MAP.indexOf(cursor.getDay())
    if (row !== -1) {
      const isSameAsStart = cursor.getTime() === new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()
      const isSameAsEnd = cursor.getTime() === endDay.getTime()
      const sh = isSameAsStart ? start.getHours() + start.getMinutes() / 60 : 0
      const eh = isSameAsEnd ? end.getHours() + end.getMinutes() / 60 : 24
      if (eh > sh) {
        blocks.push({ row, startHour: sh, endHour: eh })
      }
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return blocks
}
