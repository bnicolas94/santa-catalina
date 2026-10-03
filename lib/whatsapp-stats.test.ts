import { test } from 'node:test'
import assert from 'node:assert/strict'
import { comparisonRange, daysInRange, parseStatsUpload, summarizeDailySnapshots } from './whatsapp-stats'

const snapshot = {
    date: '2026-09-26', incomingMessages: 1, outgoingMessages: 0,
    uniqueChatIds: ['a'.repeat(64)], newIncomingChats: 1,
    hourlyIncoming: Array.from({ length: 24 }, (_, hour) => hour === 10 ? 1 : 0),
    hourlyChats: Array.from({ length: 24 }, (_, hour) => hour === 10 ? 1 : 0),
    hourlyNewChats: Array.from({ length: 24 }, (_, hour) => hour === 10 ? 1 : 0),
    response: { answered: 0, pendingChats: 1, medianMinutes: null, within15Percent: null },
    hourlyResponse: Array.from({ length: 24 }, (_, hour) =>
        ({ answered: 0, pendingChats: hour === 10 ? 1 : 0, medianMinutes: null, within15Percent: null })),
}

test('sólo admite estadísticas coherentes y descarta campos extra', () => {
    const parsed = parseStatsUpload({ snapshots: [{ ...snapshot, text: 'mensaje privado' }],
        links: [{ chatId: 'a'.repeat(64), phoneE164: '+5491123456789', nombre: 'Privado' }] })
    assert.equal(JSON.stringify(parsed).includes('mensaje privado'), false)
    assert.equal(JSON.stringify(parsed).includes('Privado'), false)
    assert.equal(summarizeDailySnapshots(parsed.snapshots).uniqueChats, 1)
    assert.throws(() => parseStatsUpload({ snapshots: [{ ...snapshot, incomingMessages: 2 }], links: [] }))
    assert.throws(() => parseStatsUpload({ snapshots: [snapshot], links: [
        { chatId: 'a'.repeat(64), phoneE164: '+123' }] }))
})

test('compara el rango seleccionado con el período anterior, la semana y el mes anterior', () => {
    assert.deepEqual(comparisonRange('2026-10-03', '2026-10-03', 'previous'),
        { desde: '2026-10-02', hasta: '2026-10-02' })
    assert.deepEqual(comparisonRange('2026-10-01', '2026-10-07', 'previous'),
        { desde: '2026-09-24', hasta: '2026-09-30' })
    assert.deepEqual(comparisonRange('2026-10-01', '2026-10-07', 'week'),
        { desde: '2026-09-24', hasta: '2026-09-30' })
    assert.deepEqual(comparisonRange('2026-03-01', '2026-03-31', 'month'),
        { desde: '2026-02-01', hasta: '2026-02-28' })
    assert.deepEqual(comparisonRange('2024-03-31', '2024-03-31', 'month'),
        { desde: '2024-02-29', hasta: '2024-02-29' })
    assert.equal(daysInRange('2026-09-24', '2026-09-30'), 7)
})
