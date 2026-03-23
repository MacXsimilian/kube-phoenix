import type { SleepWindow } from './types'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * Format a time string "HH:MM" to locale-friendly display.
 * e.g. "19:00" → "7:00 PM", "07:00" → "7:00 AM"
 */
export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0 ? `${hour12} ${suffix}` : `${hour12}:${String(m).padStart(2, '0')} ${suffix}`
}

/**
 * Returns true if the window crosses midnight (end <= start).
 * AllDay windows do not cross midnight — they cover the full day.
 */
export function isOvernight(w: SleepWindow): boolean {
  if (w.allDay) return false
  const [sh, sm] = w.startTime.split(':').map(Number)
  const [eh, em] = w.endTime.split(':').map(Number)
  return eh * 60 + em <= sh * 60 + sm
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
  if (arrEq(sorted, weekdays)) return 'Mon\u2013Fri'
  if (arrEq(sorted, weekend)) return 'Sat\u2013Sun'
  if (arrEq(sorted, [0, 1, 2, 3, 4, 5, 6])) return 'Every day'

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
      r.length >= 3
        ? `${DAY_NAMES[r[0]]}\u2013${DAY_NAMES[r[r.length - 1]]}`
        : r.map(d => DAY_NAMES[d]).join(', '),
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
    .map(w => {
      const days = formatDayRange(w.daysOfWeek)
      if (w.allDay) return `${days} all day`
      return `${days} ${formatTime(w.startTime)} \u2013 ${formatTime(w.endTime)}`
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
