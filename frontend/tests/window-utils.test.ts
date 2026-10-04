import assert from 'node:assert/strict'
import test from 'node:test'
import { computeTimeRangeBlocks, nowInTimezone, computeWeeklyStats, weeklySavingsPercent } from '../src/lib/windowUtils'
import type { SleepWindow } from '../src/lib/types'

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

const window = (daysOfWeek: number[], startTime: string, endTime: string, allDay = false): SleepWindow =>
  ({ name: 'Sleep', daysOfWeek, startTime, endTime, allDay })

const unionCases: [string, SleepWindow[], number][] = [
  ['duplicate windows', [window([1], '01:00', '05:00'), window([1], '01:00', '05:00')], 4],
  ['partial overlaps', [window([1], '01:00', '05:00'), window([1], '03:00', '07:00')], 6],
  ['adjacent intervals', [window([1], '01:00', '03:00'), window([1], '03:00', '05:00')], 4],
  ['overnight overlaps', [window([1], '22:00', '03:00'), window([2], '01:00', '05:00')], 7],
  ['week rollover overlaps', [window([6], '22:00', '03:00'), window([0], '01:00', '05:00')], 7],
  ['all-day overlaps', [window([1], '00:00', '00:00', true), window([1], '01:00', '05:00')], 24],
  ['full-week duplicates', [window([0, 1, 2, 3, 4, 5, 6], '00:00', '00:00', true), window([0, 1, 2, 3, 4, 5, 6], '00:00', '00:00', true)], 168],
  ['empty schedules', [], 0],
]

for (const [name, windows, hours] of unionCases) {
  test(`weekly stats merge ${name}`, () => {
    assert.deepEqual(computeWeeklyStats(windows), { sleepHours: hours, awakeHours: 168 - hours })
    assert.deepEqual(weeklySavingsPercent(windows), { percent: Math.round(hours / 168 * 100) })
  })
}

test('savings retains minute precision before rounding display hours', () => {
  const windows = [window([1], '00:00', '00:45'), window([1], '00:15', '00:30')]
  assert.deepEqual(computeWeeklyStats(windows), { sleepHours: 1, awakeHours: 167 })
  assert.deepEqual(weeklySavingsPercent(windows), { percent: 0 })
})
