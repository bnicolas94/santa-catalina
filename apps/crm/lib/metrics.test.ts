import assert from 'node:assert/strict'
import test from 'node:test'
import { argentinaMetricsRange, completeDailyConversationSeries } from './metrics'

test('el período diario respeta la medianoche de Argentina', () => {
  const range = argentinaMetricsRange(7, new Date('2026-09-11T02:30:00.000Z'))
  assert.equal(range.from.toISOString(), '2026-09-04T03:00:00.000Z')
  assert.equal(range.to.toISOString(), '2026-09-11T03:00:00.000Z')
})

test('la serie incluye días sin conversaciones y conserva el día local', () => {
  const rows = completeDailyConversationSeries(new Date('2026-09-05T03:00:00.000Z'), 3, [
    { day: '2026-09-05', conversations: 4 },
    { day: '2026-09-07', conversations: 2 },
  ])
  assert.deepEqual(rows, [
    { day: '2026-09-05', conversations: 4 },
    { day: '2026-09-06', conversations: 0 },
    { day: '2026-09-07', conversations: 2 },
  ])
})

test('usa siete días ante un período no permitido', () => {
  assert.equal(argentinaMetricsRange(8).days, 7)
})
