export type TimestampedMessage = {
  id: string
  providerTimestamp: Date | string | null
  createdAt: Date | string
}

export function messageOccurredAt(message: TimestampedMessage) {
  const value = message.providerTimestamp || message.createdAt
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

export function sortMessagesChronologically<T extends TimestampedMessage>(messages: T[]) {
  return [...messages].sort((left, right) => {
    const difference = messageOccurredAt(left) - messageOccurredAt(right)
    if (difference !== 0) return difference
    return left.id.localeCompare(right.id)
  })
}
