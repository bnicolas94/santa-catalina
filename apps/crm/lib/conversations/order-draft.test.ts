import assert from 'node:assert/strict'
import test from 'node:test'
import { CrmApiError } from '../api'
import { canonicalizeOrderItems, isOrderDraftComplete, normalizeOrderDraft } from './order-draft'

const ORDER_ITEM = { productId: 'product-1', presentationId: 'presentation-48', productName: 'Triple clásico', productCode: 'CLA', unitsPerPackage: 48, quantity: 2 }

test('normaliza una ficha de envío completa', () => {
  const draft = normalizeOrderDraft({
    orderDate: '2026-09-12', orderAddress: '  Av. Siempre Viva 123  ', orderFulfillment: 'DELIVERY', orderShift: 'MORNING', orderItems: [ORDER_ITEM],
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
    orderItems: [ORDER_ITEM],
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
    orderItems: [ORDER_ITEM],
  })
  assert.equal(isOrderDraftComplete(delivery), true)
  assert.equal(delivery.orderPickupLocationId, null)
  assert.equal(delivery.orderPickupLocationName, null)
})

test('completa los productos exclusivamente con referencias vigentes del ERP', () => {
  const items = canonicalizeOrderItems([{ presentationId: 'presentation-48', quantity: 3 }], [{
    id: 'product-1', name: 'Triple clásico', code: 'CLA', variants: [], presentations: [{ id: 'presentation-48', unitsPerPackage: 48, basePrice: 42000 }],
  }])
  assert.deepEqual(items, [{ ...ORDER_ITEM, quantity: 3 }])
  assert.throws(
    () => canonicalizeOrderItems([{ presentationId: 'inactive', quantity: 1 }], []),
    (error: unknown) => error instanceof CrmApiError && error.code === 'ORDER_PRESENTATION_UNAVAILABLE',
  )
})

test('exige y conserva una variedad estructurada en productos configurables', () => {
  const catalog = [{
    id: 'product-selected', name: 'Elegidos', code: 'ELE',
    variants: [{ id: 'variant-tom', code: 'tom', name: 'TOM' }, { id: 'variant-lechu', code: 'lechu', name: 'LECHU' }],
    presentations: [{ id: 'selected-16', unitsPerPackage: 16, basePrice: 9500 }, { id: 'selected-8', unitsPerPackage: 8, basePrice: 4700 }],
  }]
  assert.deepEqual(canonicalizeOrderItems([{ presentationId: 'selected-8', variantId: 'variant-tom', quantity: 1 }], catalog), [{
    productId: 'product-selected', presentationId: 'selected-8', productName: 'Elegidos', productCode: 'ELE', unitsPerPackage: 8, quantity: 1,
    variantId: 'variant-tom', variantCode: 'tom', variantName: 'TOM',
  }])
  assert.throws(
    () => canonicalizeOrderItems([{ presentationId: 'selected-8', quantity: 1 }], catalog),
    (error: unknown) => error instanceof CrmApiError && error.code === 'ORDER_VARIANT_REQUIRED',
  )
  assert.equal(canonicalizeOrderItems([
    { presentationId: 'selected-8', variantId: 'variant-tom', quantity: 1 },
    { presentationId: 'selected-8', variantId: 'variant-lechu', quantity: 1 },
  ], catalog).length, 2)
  assert.throws(
    () => canonicalizeOrderItems([{ presentationId: 'selected-16', variantId: 'variant-tom', quantity: 1 }], catalog),
    (error: unknown) => error instanceof CrmApiError && error.code === 'ORDER_VARIANT_UNIT_INVALID',
  )
})

test('la ficha requiere al menos un producto para quedar completa', () => {
  assert.equal(isOrderDraftComplete(normalizeOrderDraft({
    orderDate: '2026-09-12', orderAddress: 'Calle 10', orderFulfillment: 'DELIVERY', orderShift: 'MORNING',
  })), false)
})

test('rechaza fechas imposibles y valores desconocidos', () => {
  assert.throws(() => normalizeOrderDraft({ orderDate: '2026-02-30' }), (error: unknown) => error instanceof CrmApiError && error.code === 'INVALID_ORDER_DATE')
  assert.throws(() => normalizeOrderDraft({ orderFulfillment: 'DRONE' }), (error: unknown) => error instanceof CrmApiError && error.code === 'INVALID_FULFILLMENT')
  assert.throws(() => normalizeOrderDraft({ orderPaid: 'sí' }), (error: unknown) => error instanceof CrmApiError && error.code === 'INVALID_PAYMENT_STATUS')
})
