import type { MetricSnapshot, TimeRange } from './observability-types'

export const TIME_RANGE_MS: Record<TimeRange, number> = {
  '1m': 60_000,
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '1h': 60 * 60_000,
  '6h': 6 * 60 * 60_000,
  '1d': 24 * 60 * 60_000,
  '3d': 3 * 24 * 60 * 60_000,
}

/** Join stored history and live samples within the selected rolling range. */
export function mergeMetricHistory(
  stored: MetricSnapshot[] | null | undefined,
  live: MetricSnapshot[],
  range: TimeRange,
  endMs: number,
): MetricSnapshot[] {
  const startMs = endMs - TIME_RANGE_MS[range]
  const samples = new Map<number, MetricSnapshot>()
  for (const snapshot of [...(stored ?? []), ...live]) {
    const timestamp = Date.parse(snapshot.timestamp)
    if (timestamp >= startMs && timestamp <= endMs) samples.set(timestamp, snapshot)
  }
  return [...samples.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, snapshot]) => snapshot)
}

export function metricSeries(
  history: MetricSnapshot[],
  value: (snapshot: MetricSnapshot) => number,
): [number, number][] {
  return history.map(snapshot => [Date.parse(snapshot.timestamp), value(snapshot)])
}

/** Overlay the first half of the time span on the second half. */
export function previousPeriodSeries(
  history: MetricSnapshot[],
  value: (snapshot: MetricSnapshot) => number,
): [number, number][] {
  if (history.length <= 30) return []
  const start = Date.parse(history[0].timestamp)
  const end = Date.parse(history[history.length - 1].timestamp)
  const halfSpan = (end - start) / 2
  if (halfSpan <= 0) return []
  return metricSeries(history, value)
    .filter(([timestamp]) => timestamp < start + halfSpan)
    .map(([timestamp, metric]) => [timestamp + halfSpan, metric])
}
