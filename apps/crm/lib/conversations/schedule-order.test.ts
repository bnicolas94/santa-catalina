import assert from 'node:assert/strict'
import test from 'node:test'
import { CrmApiError } from '../api'
import { scheduledOrderSnapshot } from './schedule-order'

test('genera una fotografía completa para un pedido agendado con envío', () => {
  const snapshot = scheduledOrderSnapshot({
    orderDate: '2026-09-15',
    orderAddress: 'Calle 12 345',
    orderFulfillment: 'DELIVERY',
    orderShift: 'MORNING',
    orderPaid: true,
  })

  assert.deepEqual(snapshot, {
    orderDate: '2026-09-15',
    orderAddress: 'Calle 12 345',
    orderFulfillment: 'DELIVERY',
    orderPickupLocationId: null,
    orderPickupLocationName: null,
    orderShift: 'MORNING',
    orderPaid: true,
  })
})

test('conserva el local elegido en la fotografía histórica de retiro', () => {
  const snapshot = scheduledOrderSnapshot({
    orderDate: '2026-09-15',
    orderFulfillment: 'PICKUP',
    orderPickupLocationId: 'local-1',
    orderPickupLocationName: 'Local Gutierrez',
    orderShift: 'SIESTA',
  })

  assert.equal(snapshot.orderPickupLocationId, 'local-1')
  assert.equal(snapshot.orderPickupLocationName, 'Local Gutierrez')
  assert.equal(snapshot.orderAddress, null)
})

test('impide agendar una ficha incompleta', () => {
  assert.throws(
    () => scheduledOrderSnapshot({ orderDate: '2026-09-15', orderFulfillment: 'DELIVERY' }),
    (error: unknown) => error instanceof CrmApiError && error.code === 'ORDER_DRAFT_INCOMPLETE',
  )
})
