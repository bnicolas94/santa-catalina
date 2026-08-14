import assert from 'node:assert/strict'
import test from 'node:test'

import { isOwnMercadoPagoPayment } from './mercadopago'

test('acepta únicamente pagos cobrados por la cuenta configurada', () => {
  const previousCollectorId = process.env.MP_COLLECTOR_ID
  process.env.MP_COLLECTOR_ID = '231378824'

  try {
    assert.equal(isOwnMercadoPagoPayment({ collector_id: 231378824 }), true)
    assert.equal(isOwnMercadoPagoPayment({ collector_id: 999999999 }), false)
    assert.equal(isOwnMercadoPagoPayment({}), false)
  } finally {
    if (previousCollectorId === undefined) delete process.env.MP_COLLECTOR_ID
    else process.env.MP_COLLECTOR_ID = previousCollectorId
  }
})
