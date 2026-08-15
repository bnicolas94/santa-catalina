import assert from 'node:assert/strict'
import test from 'node:test'
import { isLeaseOwned, LOCK_LEASE_SECONDS } from './locking'

test('el lease exige propietario, token y vencimiento vigentes', () => {
  const future = new Date(Date.now() + 30_000)
  const lock = { assignedToId: 'a1', activeById: 'a1', lockToken: 'token-1', lockExpiresAt: future }
  assert.equal(isLeaseOwned(lock, 'a1', 'token-1'), true)
  assert.equal(isLeaseOwned(lock, 'a2', 'token-1'), false)
  assert.equal(isLeaseOwned(lock, 'a1', 'otro-token'), false)
})

test('un lease vencido nunca habilita el envío', () => {
  const lock = {
    assignedToId: 'a1', activeById: 'a1', lockToken: 'token-1',
    lockExpiresAt: new Date(Date.now() - 1),
  }
  assert.equal(isLeaseOwned(lock, 'a1', 'token-1'), false)
  assert.equal(LOCK_LEASE_SECONDS, 75)
})
