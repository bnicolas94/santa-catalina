import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseStatsUpload, summarizeDailySnapshots } from './whatsapp-stats'

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
