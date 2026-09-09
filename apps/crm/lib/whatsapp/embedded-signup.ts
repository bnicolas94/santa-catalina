import { CrmApiError } from '../api'
import { validateMetaChannel, type ValidatedWhatsAppChannel } from './validation'

const REQUIRED_ENV = [
  'META_APP_ID',
  'META_APP_SECRET',
  'META_EMBEDDED_SIGNUP_CONFIG_ID',
  'META_GRAPH_API_VERSION',
  'META_WEBHOOK_VERIFY_TOKEN',
] as const

export type EmbeddedSignupConfiguration = {
  appId: string
  appSecret: string
  configId: string
  graphApiVersion: string
  webhookVerifyToken: string
}

export function embeddedSignupConfigurationStatus(env: NodeJS.ProcessEnv = process.env) {
  const missing = REQUIRED_ENV.filter(key => !env[key]?.trim())
  const graphApiVersion = env.META_GRAPH_API_VERSION?.trim() || ''
  if (graphApiVersion && !/^v\d+\.\d+$/.test(graphApiVersion)) missing.push('META_GRAPH_API_VERSION')
  return {
    available: missing.length === 0,
    missing: [...new Set(missing)],
    appId: env.META_APP_ID?.trim() || null,
    configId: env.META_EMBEDDED_SIGNUP_CONFIG_ID?.trim() || null,
    graphApiVersion: graphApiVersion || null,
  }
}

export function requireEmbeddedSignupConfiguration(env: NodeJS.ProcessEnv = process.env): EmbeddedSignupConfiguration {
  const status = embeddedSignupConfigurationStatus(env)
  if (!status.available) {
    throw new CrmApiError(
      503,
      'EMBEDDED_SIGNUP_NOT_CONFIGURED',
      `Falta configurar Embedded Signup: ${status.missing.join(', ')}.`,
    )
  }
  return {
    appId: env.META_APP_ID!.trim(),
    appSecret: env.META_APP_SECRET!.trim(),
    configId: env.META_EMBEDDED_SIGNUP_CONFIG_ID!.trim(),
    graphApiVersion: env.META_GRAPH_API_VERSION!.trim(),
    webhookVerifyToken: env.META_WEBHOOK_VERIFY_TOKEN!.trim(),
  }
}

type MetaError = { error?: { message?: string; code?: number } }

async function metaJson<T>(response: Response, code: string): Promise<T> {
  const result = await response.json().catch(() => ({})) as T & MetaError
  if (!response.ok) {
    const detail = String(result.error?.message || '').replace(/\s+/g, ' ').slice(0, 240)
    throw new CrmApiError(502, code, detail ? `Meta rechazó la operación: ${detail}` : `Meta rechazó la operación (HTTP ${response.status}).`)
  }
  return result
}

export async function exchangeEmbeddedSignupCode(
  config: EmbeddedSignupConfiguration,
  code: string,
  fetcher: typeof fetch = fetch,
) {
  const url = new URL(`${config.graphApiVersion}/oauth/access_token`, 'https://graph.facebook.com/')
  url.searchParams.set('client_id', config.appId)
  url.searchParams.set('client_secret', config.appSecret)
  url.searchParams.set('code', code)
  const response = await fetcher(url, { method: 'GET', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(12_000) })
  const result = await metaJson<{ access_token?: string }>(response, 'META_CODE_EXCHANGE_FAILED')
  if (!result.access_token) throw new CrmApiError(502, 'META_TOKEN_MISSING', 'Meta no devolvió una credencial para completar la conexión.')
  return result.access_token
}

async function listPhoneNumberIds(
  config: EmbeddedSignupConfiguration,
  wabaId: string,
  accessToken: string,
  fetcher: typeof fetch,
) {
  const url = new URL(`${config.graphApiVersion}/${encodeURIComponent(wabaId)}/phone_numbers`, 'https://graph.facebook.com/')
  url.searchParams.set('fields', 'id')
  const response = await fetcher(url, {
    method: 'GET', headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }, signal: AbortSignal.timeout(12_000),
  })
  const result = await metaJson<{ data?: Array<{ id?: string }> }>(response, 'META_PHONE_DISCOVERY_FAILED')
  return (result.data || []).map(item => item.id).filter((id): id is string => Boolean(id))
}

async function subscribeApp(
  config: EmbeddedSignupConfiguration,
  wabaId: string,
  accessToken: string,
  fetcher: typeof fetch,
) {
  const url = new URL(`${config.graphApiVersion}/${encodeURIComponent(wabaId)}/subscribed_apps`, 'https://graph.facebook.com/')
  const response = await fetcher(url, {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }, signal: AbortSignal.timeout(12_000),
  })
  const result = await metaJson<{ success?: boolean }>(response, 'META_WEBHOOK_SUBSCRIPTION_FAILED')
  if (result.success !== true) throw new CrmApiError(502, 'META_WEBHOOK_SUBSCRIPTION_FAILED', 'Meta no confirmó la suscripción del webhook.')
}

export async function completeCoexistenceOnboarding(input: {
  code: string
  wabaId: string
  phoneNumberId?: string | null
}, config = requireEmbeddedSignupConfiguration(), fetcher: typeof fetch = fetch): Promise<{
  accessToken: string
  validation: ValidatedWhatsAppChannel
}> {
  const accessToken = await exchangeEmbeddedSignupCode(config, input.code, fetcher)
  const phoneIds = await listPhoneNumberIds(config, input.wabaId, accessToken, fetcher)
  const candidates = input.phoneNumberId ? phoneIds.filter(id => id === input.phoneNumberId) : phoneIds
  if (input.phoneNumberId && candidates.length === 0) {
    throw new CrmApiError(409, 'PHONE_NOT_IN_WABA', 'El número informado por Embedded Signup no pertenece al WABA autorizado.')
  }

  const coexistence: ValidatedWhatsAppChannel[] = []
  for (const phoneNumberId of candidates) {
    const validation = await validateMetaChannel({
      graphApiVersion: config.graphApiVersion,
      wabaId: input.wabaId,
      phoneNumberId,
      accessToken,
    }, fetcher)
    if (validation.isOnBizApp && validation.platformType === 'CLOUD_API') coexistence.push(validation)
  }
  if (coexistence.length === 0) {
    throw new CrmApiError(409, 'COEXISTENCE_NOT_CONFIRMED', 'Meta no confirmó que el número continúe activo en WhatsApp Business. El canal no fue habilitado.')
  }
  if (coexistence.length > 1) {
    throw new CrmApiError(409, 'COEXISTENCE_PHONE_AMBIGUOUS', 'Meta devolvió más de un número en Coexistence. Seleccioná el número exacto y repetí el onboarding.')
  }
  await subscribeApp(config, input.wabaId, accessToken, fetcher)
  return { accessToken, validation: coexistence[0] }
}
