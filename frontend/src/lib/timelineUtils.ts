import { computeTimeRangeBlocks } from '@/lib/windowUtils'

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/**
 * Convert a UTC ISO time range to per-row X-fraction segments.
 * startX and endX are fractions in [0, 1] representing position within a 24-hour bar.
 * Multiply by your BAR_W and add LABEL_W to get pixel coordinates.
 */
export function timeRangeToSegments(
  start: string,
  end: string,
  tz?: string,
): { row: number; startX: number; endX: number }[] {
  return computeTimeRangeBlocks(start, end, tz).map(tb => ({
    row: tb.row,
    startX: tb.startHour / 24,
    endX: tb.endHour / 24,
  }))
}
