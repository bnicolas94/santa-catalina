import assert from 'node:assert/strict'
import test from 'node:test'
import { CrmApiError } from '../api'
import { isOrderDraftComplete, normalizeOrderDraft } from './order-draft'

test('normaliza una ficha de envío completa', () => {
  const draft = normalizeOrderDraft({
    orderDate: '2026-09-12', orderAddress: '  Av. Siempre Viva 123  ', orderFulfillment: 'DELIVERY', orderShift: 'MORNING',
  })
  assert.equal(draft.orderAddress, 'Av. Siempre Viva 123')
  assert.equal(isOrderDraftComplete(draft), true)
})

test('retiro no exige dirección y envío sí', () => {
  assert.equal(isOrderDraftComplete(normalizeOrderDraft({ orderDate: '2026-09-12', orderFulfillment: 'PICKUP', orderShift: 'SIESTA' })), true)
  assert.equal(isOrderDraftComplete(normalizeOrderDraft({ orderDate: '2026-09-12', orderFulfillment: 'DELIVERY', orderShift: 'SIESTA' })), false)
})

test('rechaza fechas imposibles y valores desconocidos', () => {
  assert.throws(() => normalizeOrderDraft({ orderDate: '2026-02-30' }), (error: unknown) => error instanceof CrmApiError && error.code === 'INVALID_ORDER_DATE')
  assert.throws(() => normalizeOrderDraft({ orderFulfillment: 'DRONE' }), (error: unknown) => error instanceof CrmApiError && error.code === 'INVALID_FULFILLMENT')
})
