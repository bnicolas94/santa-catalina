import assert from 'node:assert/strict'
import test from 'node:test'
import { CrmApiError } from '@/lib/api'
import { getErpCustomerSummary, resolveErpCustomer } from './client'

const originalFetch = globalThis.fetch
const originalBaseUrl = process.env.ERP_BASE_URL

test.afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalBaseUrl === undefined) delete process.env.ERP_BASE_URL
  else process.env.ERP_BASE_URL = originalBaseUrl
})

test('consulta el ERP con la cookie de sesión y el teléfono codificado', async () => {
  process.env.ERP_BASE_URL = 'https://app.example.test'
  let receivedUrl = ''
  let receivedCookie = ''
  globalThis.fetch = async (input, init) => {
    receivedUrl = String(input)
    receivedCookie = new Headers(init?.headers).get('cookie') || ''
    return new Response(JSON.stringify({ candidates: [] }), { status: 200 })
  }

  const result = await resolveErpCustomer('+54 9 11 1234-5678', 'session=segura')
  assert.deepEqual(result, { candidates: [] })
  assert.match(receivedUrl, /phoneE164=%2B54\+9\+11\+1234-5678/)
  assert.equal(receivedCookie, 'session=segura')
})

test('no sigue una redirección de autenticación del ERP', async () => {
  process.env.ERP_BASE_URL = 'https://app.example.test'
  globalThis.fetch = async () => new Response(null, { status: 307, headers: { location: '/login' } })

  await assert.rejects(
    () => getErpCustomerSummary('cliente-1', 'session=incorrecta'),
    (error: unknown) => error instanceof CrmApiError && error.code === 'ERP_AUTH_FAILED',
  )
})
