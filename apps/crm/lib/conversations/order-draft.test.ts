import assert from 'node:assert/strict'
import test from 'node:test'
import { CrmApiError } from '../api'
import { isOrderDraftComplete, normalizeOrderDraft } from './order-draft'

test('normaliza una ficha de envío completa', () => {
  const draft = normalizeOrderDraft({
    orderDate: '2026-09-12', orderAddress: '  Av. Siempre Viva 123  ', orderFulfillment: 'DELIVERY', orderShift: 'MORNING',
  })
  assert.equal(draft.orderAddress, 'Av. Siempre Viva 123')
  assert.equal(draft.orderPaid, false)
  assert.equal(isOrderDraftComplete(draft), true)
})

test('retiro exige un local real y no exige dirección', () => {
  assert.equal(isOrderDraftComplete(normalizeOrderDraft({ orderDate: '2026-09-12', orderFulfillment: 'PICKUP', orderShift: 'SIESTA' })), false)
  const pickup = normalizeOrderDraft({
    orderDate: '2026-09-12',
    orderAddress: 'Esta dirección debe limpiarse',
    orderFulfillment: 'PICKUP',
    orderPickupLocationId: 'local-1',
    orderPickupLocationName: 'Local Centro',
    orderShift: 'SIESTA',
    orderPaid: true,
  })
  assert.equal(isOrderDraftComplete(pickup), true)
  assert.equal(pickup.orderAddress, null)
  assert.equal(pickup.orderPaid, true)
})

test('envío exige dirección y limpia cualquier local de retiro anterior', () => {
  assert.equal(isOrderDraftComplete(normalizeOrderDraft({ orderDate: '2026-09-12', orderFulfillment: 'DELIVERY', orderShift: 'SIESTA' })), false)
  const delivery = normalizeOrderDraft({
    orderDate: '2026-09-12',
    orderAddress: 'Calle 10',
    orderFulfillment: 'DELIVERY',
    orderPickupLocationId: 'local-1',
    orderPickupLocationName: 'Local Centro',
    orderShift: 'AFTERNOON',
  })
  assert.equal(isOrderDraftComplete(delivery), true)
  assert.equal(delivery.orderPickupLocationId, null)
  assert.equal(delivery.orderPickupLocationName, null)
})

test('rechaza fechas imposibles y valores desconocidos', () => {
  assert.throws(() => normalizeOrderDraft({ orderDate: '2026-02-30' }), (error: unknown) => error instanceof CrmApiError && error.code === 'INVALID_ORDER_DATE')
  assert.throws(() => normalizeOrderDraft({ orderFulfillment: 'DRONE' }), (error: unknown) => error instanceof CrmApiError && error.code === 'INVALID_FULFILLMENT')
  assert.throws(() => normalizeOrderDraft({ orderPaid: 'sí' }), (error: unknown) => error instanceof CrmApiError && error.code === 'INVALID_PAYMENT_STATUS')
})
