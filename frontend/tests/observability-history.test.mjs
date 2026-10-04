import assert from 'node:assert/strict'
import test from 'node:test'
import {
  TIME_RANGE_MS,
  mergeMetricHistory,
  metricSeries,
  previousPeriodSeries,
} from '../src/lib/observabilityHistory.ts'

const now = Date.parse('2026-10-04T12:00:00Z')
const snapshot = (timestamp, value = 1) => ({
  timestamp: new Date(timestamp).toISOString(),
  httpRequestRate: value,
})
const getValue = sample => sample.httpRequestRate

test('each range includes its boundary and excludes older and future samples', () => {
  for (const [range, duration] of Object.entries(TIME_RANGE_MS)) {
    const boundary = snapshot(now - duration)
    const recent = snapshot(now)
    assert.deepEqual(mergeMetricHistory([
      snapshot(now - duration - 1), boundary, recent, snapshot(now + 1),
    ], [], range, now), [boundary, recent], range)
  }
})

test('historical and live samples are sorted and deduplicated by timestamp', () => {
  const older = snapshot(now - 30_000, 3)
  const latest = snapshot(now, 8)
  const replacement = snapshot(now - 30_000, 5)
  assert.deepEqual(mergeMetricHistory([
    latest, older, { timestamp: 'invalid', httpRequestRate: 99 },
  ], [replacement], '1m', now), [replacement, latest])
})

test('missing stored history still accepts live samples and an empty range stays empty', () => {
  const live = snapshot(now)
  assert.deepEqual(mergeMetricHistory(null, [live], '1h', now), [live])
  assert.deepEqual(mergeMetricHistory(undefined, [], '3d', now), [])
  assert.deepEqual(mergeMetricHistory([snapshot(now - 90_000)], [], '1m', now), [])
})

test('switching ranges and advancing live time removes samples outside the selected span', () => {
  const stored = [snapshot(now - 2 * 24 * 60 * 60_000), snapshot(now - 30 * 60_000)]
  const live = [snapshot(now - 30_000), snapshot(now)]
  assert.equal(mergeMetricHistory(stored, live, '3d', now).length, 4)
  assert.equal(mergeMetricHistory(stored, live, '1h', now).length, 3)
  assert.equal(mergeMetricHistory(stored, live, '1m', now).length, 2)
  assert.deepEqual(mergeMetricHistory(stored, live, '1m', now + 61_000), [])
})

test('series preserve real timestamps rather than equally spaced sample indices', () => {
  const history = [snapshot(now - 60_000, 4), snapshot(now - 2_000, 7), snapshot(now, 9)]
  assert.deepEqual(metricSeries(history, getValue), [
    [now - 60_000, 4], [now - 2_000, 7], [now, 9],
  ])
  assert.deepEqual(metricSeries([], getValue), [])
})

test('comparison aligns by time span even when samples cluster near the end', () => {
  const history = [snapshot(now - 60_000, 2)]
  for (let i = 30; i >= 0; i--) history.push(snapshot(now - i * 100, 10))
  assert.deepEqual(previousPeriodSeries(history, getValue), [[now - 30_000, 2]])
  assert.deepEqual(previousPeriodSeries(history.slice(-2), getValue), [])
})
