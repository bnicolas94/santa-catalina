import assert from 'node:assert/strict'
import test from 'node:test'
import { getCrmCallbackUrl } from './auth-redirects'

test('reemplaza el origen interno de Railway por el dominio público del CRM', () => {
  const callbackUrl = getCrmCallbackUrl(
    'http://localhost:3001/conversations/abc?tab=nuevas',
    'https://atencion.santacatalina.online',
  )

  assert.equal(
    callbackUrl,
    'https://atencion.santacatalina.online/conversations/abc?tab=nuevas',
  )
})

test('conserva la URL recibida cuando CRM_BASE_URL no está configurada', () => {
  assert.equal(
    getCrmCallbackUrl('http://localhost:3001/?filtro=mias'),
    'http://localhost:3001/?filtro=mias',
  )
})
