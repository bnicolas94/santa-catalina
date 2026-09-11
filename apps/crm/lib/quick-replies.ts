import { CrmApiError, requireText } from './api'

export type QuickReplyInput = {
  shortcut: string
  title: string
  body: string
  active: boolean
}

export function normalizeQuickReplyInput(value: Record<string, unknown>, fallback?: QuickReplyInput): QuickReplyInput {
  const shortcut = requireText(value.shortcut ?? fallback?.shortcut, 'El atajo', 40)
    .replace(/^\/+/, '')
    .toLowerCase()

  if (!/^[a-z0-9_-]+$/.test(shortcut)) {
    throw new CrmApiError(400, 'INVALID_SHORTCUT', 'El atajo sólo puede contener letras, números, guiones y guiones bajos.')
  }

  return {
    shortcut,
    title: requireText(value.title ?? fallback?.title, 'El nombre', 80),
    body: requireText(value.body ?? fallback?.body, 'El mensaje', 2_000),
    active: typeof value.active === 'boolean' ? value.active : fallback?.active ?? true,
  }
}
