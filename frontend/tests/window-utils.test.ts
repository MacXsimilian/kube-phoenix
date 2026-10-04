import assert from 'node:assert/strict'
import test from 'node:test'
import { computeTimeRangeBlocks, nowInTimezone } from '../src/lib/windowUtils'

test('policy civil times are independent of the browser timezone and DST gaps', () => {
  const originalTimezone = process.env.TZ
  try {
    for (const host of ['UTC', 'Europe/Budapest', 'America/New_York']) {
      process.env.TZ = host
      assert.deepEqual(computeTimeRangeBlocks(
        '2026-03-29T02:00:00Z', '2026-03-29T03:00:00Z', 'UTC',
      ), [{ row: 6, startHour: 2, endHour: 3 }], host)
      assert.deepEqual(computeTimeRangeBlocks(
        '2026-03-29T00:30:00Z', '2026-03-29T02:30:00Z', 'Europe/Budapest',
      ), [{ row: 6, startHour: 1.5, endHour: 4.5 }], host)
      assert.deepEqual(computeTimeRangeBlocks(
        '2026-10-25T00:00:00Z', '2026-10-25T02:00:00Z', 'Europe/Budapest',
      ), [{ row: 6, startHour: 2, endHour: 3 }], host)
    }
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ
    else process.env.TZ = originalTimezone
  }
})

test('midnight and week rollover stay on the correct civil days', () => {
  assert.deepEqual(computeTimeRangeBlocks(
    '2026-03-29T23:30:00Z', '2026-03-30T00:15:00Z', 'UTC',
  ), [
    { row: 6, startHour: 23.5, endHour: 24 },
    { row: 0, startHour: 0, endHour: 0.25 },
  ])
  assert.deepEqual(computeTimeRangeBlocks(
    '2026-03-30T00:00:00Z', '2026-03-30T01:00:00Z', 'UTC',
  ), [{ row: 0, startHour: 0, endHour: 1 }])
})

test('current policy time avoids host DST normalization and preserves local fallback', t => {
  const originalTimezone = process.env.TZ
  process.env.TZ = 'Europe/Budapest'
  t.after(() => {
    if (originalTimezone === undefined) delete process.env.TZ
    else process.env.TZ = originalTimezone
  })
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-03-29T02:30:00Z') })
  assert.deepEqual(nowInTimezone('UTC'), { dayOfWeek: 0, fractionalHour: 2.5 })
  assert.deepEqual(nowInTimezone(), { dayOfWeek: 0, fractionalHour: 4.5 })
  assert.deepEqual(computeTimeRangeBlocks(
    '2026-03-29T00:30:00Z', '2026-03-29T02:30:00Z',
  ), [{ row: 6, startHour: 1.5, endHour: 4.5 }])
  t.mock.timers.setTime(Date.parse('2026-03-29T23:30:00Z'))
  assert.deepEqual(nowInTimezone('Asia/Kolkata'), { dayOfWeek: 1, fractionalHour: 5 })
  t.mock.timers.setTime(Date.parse('2026-03-30T00:00:00Z'))
  assert.deepEqual(nowInTimezone('UTC'), { dayOfWeek: 1, fractionalHour: 0 })
})
