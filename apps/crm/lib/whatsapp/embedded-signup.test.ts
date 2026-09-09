import assert from 'node:assert/strict'
import test from 'node:test'
import { CrmApiError } from '../api'
import {
  completeCoexistenceOnboarding,
  embeddedSignupConfigurationStatus,
  type EmbeddedSignupConfiguration,
} from './embedded-signup'

const config: EmbeddedSignupConfiguration = {
  appId: 'app-1',
  appSecret: 'secret-1',
  configId: 'config-1',
  graphApiVersion: 'v25.0',
  webhookVerifyToken: 'verify-1',
}

test('no expone secretos en el estado público de Embedded Signup', () => {
  const status = embeddedSignupConfigurationStatus({
    META_APP_ID: config.appId,
    META_APP_SECRET: config.appSecret,
    META_EMBEDDED_SIGNUP_CONFIG_ID: config.configId,
    META_GRAPH_API_VERSION: config.graphApiVersion,
    META_WEBHOOK_VERIFY_TOKEN: config.webhookVerifyToken,
  })
  assert.equal(status.available, true)
  assert.equal('appSecret' in status, false)
  assert.equal('webhookVerifyToken' in status, false)
})

test('completa solamente un número confirmado en Coexistence y suscribe el webhook', async () => {
  const requests: string[] = []
  const fetcher: typeof fetch = async request => {
    const url = String(request)
    requests.push(url)
    if (url.includes('/oauth/access_token')) return Response.json({ access_token: 'bisu-token' })
    if (url.includes('/waba-1/phone_numbers')) return Response.json({ data: [{ id: 'phone-1' }] })
    if (url.includes('/phone-1?')) return Response.json({ id: 'phone-1', display_phone_number: '+54 11 5555 5555', verified_name: 'Santa Catalina', platform_type: 'CLOUD_API', is_on_biz_app: true })
    if (url.includes('/waba-1/subscribed_apps')) return Response.json({ success: true })
    throw new Error(`Solicitud inesperada: ${url}`)
  }
  const result = await completeCoexistenceOnboarding({ code: 'single-use-code', wabaId: 'waba-1' }, config, fetcher)
  assert.equal(result.accessToken, 'bisu-token')
  assert.equal(result.validation.isOnBizApp, true)
  assert.ok(requests.some(url => url.includes('/subscribed_apps')))
})

test('bloquea el alta si Meta no confirma que la app sigue activa', async () => {
  const fetcher: typeof fetch = async request => {
    const url = String(request)
    if (url.includes('/oauth/access_token')) return Response.json({ access_token: 'bisu-token' })
    if (url.includes('/waba-1/phone_numbers')) return Response.json({ data: [{ id: 'phone-1' }] })
    if (url.includes('/phone-1?')) return Response.json({ id: 'phone-1', platform_type: 'CLOUD_API', is_on_biz_app: false })
    throw new Error(`No debe suscribirse: ${url}`)
  }
  await assert.rejects(
    () => completeCoexistenceOnboarding({ code: 'code', wabaId: 'waba-1' }, config, fetcher),
    (error: unknown) => error instanceof CrmApiError && error.code === 'COEXISTENCE_NOT_CONFIRMED',
  )
})
