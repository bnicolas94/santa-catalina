export type ResponseStats = {
    answered: number
    pendingChats: number
    medianMinutes: number | null
    within15Percent: number | null
}

export type DailySnapshot = {
    date: string
    incomingMessages: number
    outgoingMessages: number
    uniqueChatIds: string[]
    newIncomingChats: number
    hourlyIncoming: number[]
    hourlyChats: number[]
    hourlyNewChats: number[]
    response: ResponseStats
    hourlyResponse: ResponseStats[]
}

export type ChatLink = { chatId: string; phoneE164: string }

const hashPattern = /^[a-f0-9]{64}$/
const phonePattern = /^\+[1-9]\d{7,14}$/

function nonNegativeInteger(value: unknown): value is number {
    return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 1_000_000_000
}

function validDate(value: unknown): value is string {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(Date.parse(value)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
}

function validHourly(value: unknown): value is number[] {
    return Array.isArray(value) && value.length === 24 && value.every(nonNegativeInteger)
}

function validResponse(value: unknown): value is ResponseStats {
    if (!value || typeof value !== 'object') return false
    const row = value as Record<string, unknown>
    return nonNegativeInteger(row.answered) && nonNegativeInteger(row.pendingChats) &&
        (row.medianMinutes === null || (typeof row.medianMinutes === 'number' &&
            Number.isFinite(row.medianMinutes) && row.medianMinutes >= 0 && row.medianMinutes <= 1_000_000)) &&
        (row.within15Percent === null || (nonNegativeInteger(row.within15Percent) && row.within15Percent <= 100)) &&
        (row.answered === 0 ? row.medianMinutes === null && row.within15Percent === null :
            row.medianMinutes !== null && row.within15Percent !== null)
}

function responseOnly(value: ResponseStats): ResponseStats {
    return { answered: value.answered, pendingChats: value.pendingChats,
        medianMinutes: value.medianMinutes, within15Percent: value.within15Percent }
}

export function parseStatsUpload(input: unknown): { snapshots: DailySnapshot[]; links: ChatLink[] } {
    if (!input || typeof input !== 'object') throw new Error('Carga inválida')
    const body = input as Record<string, unknown>
    if (!Array.isArray(body.snapshots) || body.snapshots.length < 1 || body.snapshots.length > 31 ||
        !Array.isArray(body.links) || body.links.length > 1000) throw new Error('Cantidad de registros inválida')
    const dates = new Set<string>()
    const snapshots = body.snapshots.map((item): DailySnapshot => {
        if (!item || typeof item !== 'object') throw new Error('Resumen inválido')
        const row = item as Record<string, unknown>
        if (!validDate(row.date) || dates.has(row.date) ||
            !nonNegativeInteger(row.incomingMessages) || !nonNegativeInteger(row.outgoingMessages) ||
            !nonNegativeInteger(row.newIncomingChats) || !validHourly(row.hourlyIncoming) ||
            !validHourly(row.hourlyChats) || !validHourly(row.hourlyNewChats) ||
            !Array.isArray(row.uniqueChatIds) || row.uniqueChatIds.length > 10000 ||
            !row.uniqueChatIds.every((id) => typeof id === 'string' && hashPattern.test(id)) ||
            new Set(row.uniqueChatIds).size !== row.uniqueChatIds.length ||
            !validResponse(row.response) || !Array.isArray(row.hourlyResponse) ||
            row.hourlyResponse.length !== 24 || !row.hourlyResponse.every(validResponse)) {
            throw new Error('Resumen inválido')
        }
        const hourlyIncoming = row.hourlyIncoming as number[]
        const hourlyChats = row.hourlyChats as number[]
        const hourlyNewChats = row.hourlyNewChats as number[]
        if (hourlyIncoming.reduce((sum, count) => sum + count, 0) !== row.incomingMessages ||
            row.uniqueChatIds.length > row.incomingMessages || row.newIncomingChats > row.uniqueChatIds.length ||
            hourlyChats.some((count, hour) => count > hourlyIncoming[hour]) ||
            hourlyNewChats.some((count, hour) => count > hourlyChats[hour])) {
            throw new Error('Totales incoherentes')
        }
        dates.add(row.date)
        return {
            date: row.date,
            incomingMessages: row.incomingMessages,
            outgoingMessages: row.outgoingMessages,
            uniqueChatIds: [...row.uniqueChatIds],
            newIncomingChats: row.newIncomingChats,
            hourlyIncoming: [...row.hourlyIncoming],
            hourlyChats: [...row.hourlyChats],
            hourlyNewChats: [...row.hourlyNewChats],
            response: responseOnly(row.response),
            hourlyResponse: row.hourlyResponse.map(responseOnly),
        }
    })
    const links = body.links.map((item): ChatLink => {
        if (!item || typeof item !== 'object') throw new Error('Vínculo inválido')
        const row = item as Record<string, unknown>
        if (typeof row.chatId !== 'string' || !hashPattern.test(row.chatId) ||
            typeof row.phoneE164 !== 'string' || !phonePattern.test(row.phoneE164)) {
            throw new Error('Vínculo inválido')
        }
        return { chatId: row.chatId, phoneE164: row.phoneE164 }
    })
    if (new Set(links.map((link) => link.chatId)).size !== links.length) throw new Error('Vínculos duplicados')
    return { snapshots, links }
}

export function summarizeDailySnapshots(snapshots: DailySnapshot[]) {
    const chats = new Set<string>()
    const totals = { incomingMessages: 0, outgoingMessages: 0, newIncomingChats: 0,
        answered: 0, pendingChats: 0, hourlyIncoming: Array(24).fill(0) as number[],
        hourlyChats: Array(24).fill(0) as number[] }
    for (const snapshot of snapshots) {
        totals.incomingMessages += snapshot.incomingMessages
        totals.outgoingMessages += snapshot.outgoingMessages
        totals.newIncomingChats += snapshot.newIncomingChats
        totals.answered += snapshot.response.answered
        totals.pendingChats += snapshot.response.pendingChats
        snapshot.uniqueChatIds.forEach((id) => chats.add(id))
        for (let hour = 0; hour < 24; hour++) {
            totals.hourlyIncoming[hour] += snapshot.hourlyIncoming[hour]
            totals.hourlyChats[hour] += snapshot.hourlyChats[hour]
        }
    }
    return { ...totals, uniqueChats: chats.size }
}
