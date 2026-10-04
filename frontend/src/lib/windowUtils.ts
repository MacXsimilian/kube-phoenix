import type { SleepWindow } from './types'
import { HOURS_PER_WEEK, MINUTES_PER_DAY, MINUTES_PER_HOUR } from './constants'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * Format a time string "HH:MM" to locale-friendly display.
 * e.g. "19:00" → "7:00 PM", "07:00" → "7:00 AM"
 */
function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0 ? `${hour12} ${suffix}` : `${hour12}:${String(m).padStart(2, '0')} ${suffix}`
}

/**
 * Returns true if the window crosses midnight (end <= start).
 * AllDay windows do not cross midnight.
 */
export function isOvernight(window: SleepWindow): boolean {
  if (window.allDay) return false
  const [sh, sm] = window.startTime.split(':').map(Number)
  const [eh, em] = window.endTime.split(':').map(Number)
  return eh * MINUTES_PER_HOUR + em <= sh * MINUTES_PER_HOUR + sm
}

/**
 * Format an array of day numbers into a compact range string.
 * e.g. [1,2,3,4,5] → "Mon–Fri", [0,6] → "Sat–Sun", [1,3,5] → "Mon, Wed, Fri"
 */
function formatDayRange(days: number[]): string {
  if (days.length === 0) return ''
  if (days.length === 7) return 'Every day'

  const sorted = [...days].sort((a, b) => a - b)

  // Check for known compact patterns
  const weekdays = [1, 2, 3, 4, 5]
  const weekend = [0, 6]
  if (arrEq(sorted, weekdays)) return 'Mon\u2013Fri'
  if (arrEq(sorted, weekend)) return 'Sat\u2013Sun'

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
    .map((r) =>
      r.length >= 3
        ? `${DAY_NAMES[r[0]]}\u2013${DAY_NAMES[r[r.length - 1]]}`
        : r.map((d) => DAY_NAMES[d]).join(', '),
    )
    .join(', ')
}

function arrEq(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

/**
 * Format sleep windows into a human-readable summary.
 * e.g. "Mon–Fri 7 PM – 7 AM" or "Mon–Fri 7 PM – 7 AM, Sat–Sun all day"
 */
export function windowsToText(windows: SleepWindow[]): string {
  if (!windows || windows.length === 0) return ''

  return windows
    .map((sw) => {
      const days = formatDayRange(sw.daysOfWeek)
      if (sw.allDay) return `${days} all day`
      return `${days} ${formatTime(sw.startTime)} \u2013 ${formatTime(sw.endTime)}`
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
export function hasSleepWindows(
  windows: SleepWindow[] | null | undefined,
): windows is SleepWindow[] {
  return !!windows && windows.length > 0
}

/** Count the union of all sleep intervals in the recurring week. */
function weeklySleepMinutes(windows: SleepWindow[]): number {
  const days: [number, number][][] = Array.from({ length: 7 }, () => [])
  for (const sw of windows) {
    const [startHour, startMinute] = sw.startTime.split(':').map(Number)
    const [endHour, endMinute] = sw.endTime.split(':').map(Number)
    const startMin = sw.allDay ? 0 : startHour * MINUTES_PER_HOUR + startMinute
    const endMin = sw.allDay ? MINUTES_PER_DAY : endHour * MINUTES_PER_HOUR + endMinute
    for (const day of sw.daysOfWeek) {
      if (endMin > startMin) {
        days[day].push([startMin, endMin])
      } else {
        days[day].push([startMin, MINUTES_PER_DAY])
        days[(day + 1) % 7].push([0, endMin])
      }
    }
  }

  let total = 0
  for (const intervals of days) {
    intervals.sort(([a], [b]) => a - b)
    let start = 0
    let end = 0
    for (const [nextStart, nextEnd] of intervals) {
      if (nextStart > end) {
        total += end - start
        start = nextStart
        end = nextEnd
      } else {
        end = Math.max(end, nextEnd)
      }
    }
    total += end - start
  }
  return total
}

/** Compute rounded weekly sleep and awake hours, merging overlapping windows. */
export function computeWeeklyStats(windows: SleepWindow[]): {
  sleepHours: number
  awakeHours: number
} {
  const sleepHours = Math.round(weeklySleepMinutes(windows) / MINUTES_PER_HOUR)
  return { sleepHours, awakeHours: HOURS_PER_WEEK - sleepHours }
}

/** Weekly savings percentage, calculated from merged minutes before rounding. */
export function weeklySavingsPercent(windows: SleepWindow[]): { percent: number } {
  return { percent: Math.round(weeklySleepMinutes(windows) / (HOURS_PER_WEEK * MINUTES_PER_HOUR) * 100) }
}

/**
 * Encode civil timezone fields in a UTC Date so the browser's DST rules cannot
 * normalize them. Read these internal dates with UTC getters only.
 */
function dateInTimezone(date: Date, tz?: string): Date {
  if (!tz) {
    return new Date(Date.UTC(
      date.getFullYear(), date.getMonth(), date.getDate(),
      date.getHours(), date.getMinutes(), date.getSeconds(),
    ))
  }
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]))
  return new Date(Date.UTC(
    +parts.year, +parts.month - 1, +parts.day,
    +parts.hour, +parts.minute, +parts.second,
  ))
}

/**
 * Returns the current day-of-week (0=Sun) and fractional hour,
 * optionally converted to the given IANA timezone.
 */
export function nowInTimezone(tz?: string): { dayOfWeek: number; fractionalHour: number } {
  const now = new Date()
  const d = dateInTimezone(now, tz)
  return {
    dayOfWeek: d.getUTCDay(),
    fractionalHour: d.getUTCHours() + d.getUTCMinutes() / 60,
  }
}

// ── Shared timeline math ─────────────────────────────────────────────────────

/** Day-of-week index mapping: array index -> JS getDay() value (Monday-first layout) */
const MONDAY_FIRST_DOW_MAP = [1, 2, 3, 4, 5, 6, 0] // Mon..Sun

export const DOW_MAP = MONDAY_FIRST_DOW_MAP

/** Convert an ISO timestamp to an internal UTC-encoded civil date. */
function toTimezone(iso: string, tz?: string): Date {
  const d = new Date(iso)
  return dateInTimezone(d, tz)
}

/** A day-row + fractional-hour range, independent of visual layout. */
interface TimeBlock {
  row: number // 0=Mon .. 6=Sun (index into DOW_MAP)
  startHour: number // fractional hour 0–24
  endHour: number // fractional hour 0–24
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
  cursor.setUTCHours(0, 0, 0, 0)
  const endDay = new Date(end)
  endDay.setUTCHours(0, 0, 0, 0)

  while (cursor <= endDay) {
    const row = MONDAY_FIRST_DOW_MAP.indexOf(cursor.getUTCDay())
    if (row !== -1) {
      const isSameAsStart =
        cursor.getTime() ===
        new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())).getTime()
      const isSameAsEnd = cursor.getTime() === endDay.getTime()
      const sh = isSameAsStart ? start.getUTCHours() + start.getUTCMinutes() / 60 : 0
      const eh = isSameAsEnd ? end.getUTCHours() + end.getUTCMinutes() / 60 : 24
      if (eh > sh) {
        blocks.push({ row, startHour: sh, endHour: eh })
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return blocks
}
