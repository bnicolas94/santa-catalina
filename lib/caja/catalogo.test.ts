import assert from 'node:assert/strict'
import test from 'node:test'
import { tieneAccesoCaja, validarCambioCaja, validarDatosCaja } from './catalogo'
import { canAccessPath } from '@/lib/access-control'

const local = { rol: 'CAJERO', ubicacionId: 'centro', ubicacionTipo: 'LOCAL' }
const caja = { tipo: 'caja_centro', activo: true, ubicacionId: 'centro', ubicacion: { activo: true } }
const datos = { nombre: 'Mostrador', ubicacionId: 'centro', activo: true, recibeDepositos: false, conceptoDeposito: 'Depósito diario' }

test('dos locales del mismo tipo no comparten cajas; sin sede no hay acceso', () => {
    assert.equal(tieneAccesoCaja(local, caja), true)
    assert.equal(tieneAccesoCaja({ ...local, ubicacionId: 'norte' }, caja), false)
    assert.equal(tieneAccesoCaja({ ...local, ubicacionId: null }, caja), false)
    assert.equal(tieneAccesoCaja(local, { ...caja, ubicacionId: null }), false)
    assert.equal(tieneAccesoCaja({ rol: 'ADMIN' }, caja), true)
    assert.equal(tieneAccesoCaja({ ...local, ubicacionTipo: 'FABRICA' }, caja), false)
    assert.equal(tieneAccesoCaja({ ...local, ubicacionTipo: 'FABRICA', permisos: { permisoCaja: true } }, caja), true)
})
test('una caja inactiva conserva historial pero no admite operaciones nuevas; sede inactiva bloquea al personal', () => {
    assert.equal(tieneAccesoCaja(local, { ...caja, activo: false }), false)
    assert.equal(tieneAccesoCaja(local, { ...caja, activo: false }, false), true)
    assert.equal(tieneAccesoCaja(local, { ...caja, ubicacion: { activo: false } }, false), false)
    assert.equal(tieneAccesoCaja({ rol: 'ADMIN' }, { ...caja, activo: false }), false)
})
test('administrar cajas exige ADMIN incluso para personal del local con permisoCaja', () => {
    for (const ruta of ['/cajas', '/api/cajas']) {
        assert.equal(canAccessPath(ruta, { ...local, permisos: { permisoCaja: true } }), false)
        assert.equal(canAccessPath(ruta, { rol: 'ADMIN' }), true)
    }
})
test('validación de nombre, sede y depósito; el saldo y el identificador enviados no se aceptan como configuración', () => {
    assert.deepEqual(validarDatosCaja({ ...datos, nombre: ' Mostrador ', saldo: 90000, tipo: 'mercado_pago' }), datos)
    assert.throws(() => validarDatosCaja({ ...datos, nombre: ' ' }), /nombre/)
    assert.throws(() => validarDatosCaja({ ...datos, recibeDepositos: true, ubicacionId: null }), /sede/)
    assert.throws(() => validarDatosCaja({ ...datos, activo: 'true' }), /Estado/)
})
test('baja lógica sólo sin saldo ni depósitos pendientes; no traslada historial ni desactiva cajas de sistema', () => {
    const actual = { ubicacionId: 'centro', sistema: false, saldo: 0 }
    assert.doesNotThrow(() => validarCambioCaja(actual, { ...datos, activo: false }, true, false))
    assert.throws(() => validarCambioCaja({ ...actual, saldo: 1 }, { ...datos, activo: false }, true, false), /saldo en cero/)
    assert.throws(() => validarCambioCaja({ ...actual, saldo: -1 }, { ...datos, activo: false }, true, false), /saldo en cero/)
    assert.throws(() => validarCambioCaja(actual, { ...datos, activo: false }, false, true), /pendientes/)
    assert.throws(() => validarCambioCaja({ ...actual, sistema: true }, { ...datos, activo: false }, false, false), /otros módulos/)
    assert.throws(() => validarCambioCaja(actual, { ...datos, ubicacionId: 'norte' }, true, false), /historial/)
    assert.doesNotThrow(() => validarCambioCaja({ ...actual, ubicacionId: null }, datos, true, false))
})
