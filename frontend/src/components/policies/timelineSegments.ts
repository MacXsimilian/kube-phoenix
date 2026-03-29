import type { SleepWindow, ScheduledException } from '@/lib/types'
import { timeToHours, isOvernight, DOW_MAP, computeTimeRangeBlocks } from '@/lib/windowUtils'
import { TIMELINE_COLORS } from '@/lib/colors'

// ── Shared types ────────────────────────────────────────────────────────────

export interface TimelineSegment {
  row: number
  startHour: number
  endHour: number
  color: string
  /** Extra visual field — used differently by each timeline variant */
  variant: string
}

// ── Computation functions ───────────────────────────────────────────────────

export function computeWindowSegments(windows: SleepWindow[]): TimelineSegment[] {
  const segs: TimelineSegment[] = []
  for (const sleepWindow of windows) {
    for (const dow of sleepWindow.daysOfWeek) {
      const row = DOW_MAP.indexOf(dow)
      if (row === -1) continue

      if (sleepWindow.allDay) {
        segs.push({ row, startHour: 0, endHour: 24, color: TIMELINE_COLORS.sleep, variant: 'sleep' })
      } else {
        const startH = timeToHours(sleepWindow.startTime)
        const endH = timeToHours(sleepWindow.endTime)
        if (isOvernight(sleepWindow)) {
          segs.push({ row, startHour: startH, endHour: 24, color: TIMELINE_COLORS.sleep, variant: 'sleep' })
          const nextRow = (row + 1) % 7
          segs.push({ row: nextRow, startHour: 0, endHour: endH, color: TIMELINE_COLORS.sleep, variant: 'sleep' })
        } else {
          segs.push({ row, startHour: startH, endHour: endH, color: TIMELINE_COLORS.sleep, variant: 'sleep' })
        }
      }
    }
  }
  return segs
}

function timeRangeToSegments(
  startISO: string,
  endISO: string,
  color: string,
  variant: string,
  tz?: string,
): TimelineSegment[] {
  return computeTimeRangeBlocks(startISO, endISO, tz).map(tb => ({
    row: tb.row,
    startHour: tb.startHour,
    endHour: tb.endHour,
    color,
    variant,
  }))
}

export function computeExceptionSegments(exceptions: ScheduledException[], tz?: string): TimelineSegment[] {
  if (!exceptions) return []
  const segs: TimelineSegment[] = []
  for (const ex of exceptions) {
    if (ex.status === 'cancelled' || ex.status === 'completed') continue
    const color = ex.exceptionType === 'force_sleep' ? TIMELINE_COLORS.exception : TIMELINE_COLORS.awake
    const variant = ex.exceptionType === 'force_sleep' ? 'exception' : 'awake'
    segs.push(...timeRangeToSegments(ex.startsAt, ex.endsAt, color, variant, tz))
  }
  return segs
}
