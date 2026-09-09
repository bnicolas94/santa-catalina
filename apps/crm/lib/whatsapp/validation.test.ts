import assert from 'node:assert/strict'
import test from 'node:test'
import { CrmApiError } from '../api'
import { validateMetaChannel } from './validation'

const input = { graphApiVersion: 'v23.0', wabaId: 'waba-1', phoneNumberId: 'phone-2', accessToken: 'secret-token' }

test('valida que el número pertenezca al WABA sin exponer el token', async () => {
  const fetcher: typeof fetch = async (request, init) => {
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer secret-token')
    if (String(request).includes('/waba-1/phone_numbers')) {
      return Response.json({ data: [
        { id: 'phone-1' },
        { id: 'phone-2', display_phone_number: '+54 11 5555 5555', verified_name: 'Santa Catalina', quality_rating: 'GREEN', platform_type: 'CLOUD_API' },
      ] })
    }
    assert.match(String(request), /v23\.0\/phone-2/)
    assert.match(String(request), /is_on_biz_app/)
    return Response.json({ data: [
    ], id: 'phone-2', display_phone_number: '+54 11 5555 5555', verified_name: 'Santa Catalina', quality_rating: 'GREEN', platform_type: 'CLOUD_API', is_on_biz_app: true })
  }
  const result = await validateMetaChannel(input, fetcher)
  assert.equal(result.verifiedName, 'Santa Catalina')
  assert.equal(result.qualityRating, 'GREEN')
  assert.equal(result.isOnBizApp, true)
})

test('rechaza un Phone Number ID ajeno al WABA', async () => {
  const fetcher: typeof fetch = async () => Response.json({ data: [{ id: 'another-phone' }] })
  await assert.rejects(() => validateMetaChannel(input, fetcher), (error: unknown) => {
    return error instanceof CrmApiError && error.code === 'PHONE_NOT_IN_WABA'
  })
})

test('convierte errores de Meta en una respuesta segura y acotada', async () => {
  const fetcher: typeof fetch = async () => Response.json({ error: { code: 190, message: 'Invalid OAuth access token.' } }, { status: 401 })
  await assert.rejects(() => validateMetaChannel(input, fetcher), (error: unknown) => {
    return error instanceof CrmApiError
      && error.code === 'META_VALIDATION_FAILED'
      && !error.message.includes(input.accessToken)
  })
})
