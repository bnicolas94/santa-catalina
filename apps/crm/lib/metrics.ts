const DAY_MS = 24 * 60 * 60 * 1_000
const ARGENTINA_OFFSET_MS = 3 * 60 * 60 * 1_000

export type DailyConversationCount = { day: string; conversations: number }

export function argentinaMetricsRange(days: number, now = new Date()) {
  const safeDays = [7, 14, 30, 90].includes(days) ? days : 7
  const argentinaNow = new Date(now.getTime() - ARGENTINA_OFFSET_MS)
  const end = new Date(Date.UTC(
    argentinaNow.getUTCFullYear(),
    argentinaNow.getUTCMonth(),
    argentinaNow.getUTCDate() + 1,
    3,
  ))
  return { days: safeDays, from: new Date(end.getTime() - safeDays * DAY_MS), to: end }
}

export function completeDailyConversationSeries(
  from: Date,
  days: number,
  rows: DailyConversationCount[],
): DailyConversationCount[] {
  const counts = new Map(rows.map(row => [row.day, Number(row.conversations)]))
  return Array.from({ length: days }, (_, index) => {
    const localDate = new Date(from.getTime() - ARGENTINA_OFFSET_MS + index * DAY_MS)
    const day = localDate.toISOString().slice(0, 10)
    return { day, conversations: counts.get(day) || 0 }
  })
}
