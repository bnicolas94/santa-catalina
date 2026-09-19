import assert from 'node:assert/strict'
import test from 'node:test'
import { cajaSugeridaParaEmpleado, cajasActivasParaLiquidacion } from './cajasLiquidacion'

const cajas = [
    { tipo: 'central', nombre: 'Caja Chica Fábrica', activo: true, ubicacionId: 'fabrica', ubicacion: { activo: true } },
    { tipo: 'villa_fuerte', nombre: 'Caja Fuerte Villa Elisa', activo: true, ubicacionId: 'villa', recibeDepositos: true, ubicacion: { activo: true } },
    { tipo: 'villa_chica', nombre: 'Caja Chica Villa Elisa', activo: true, ubicacionId: 'villa', ubicacion: { activo: true } },
    { tipo: 'villa_inactiva', nombre: 'Caja anterior', activo: false, ubicacionId: 'villa', ubicacion: { activo: true } },
]

test('sugiere una caja operativa de la sede del empleado', () => {
    assert.equal(cajaSugeridaParaEmpleado({ ubicacionId: 'villa' }, cajas, 'central'), 'villa_chica')
})

test('usa la caja predeterminada cuando el empleado no tiene una caja de su sede', () => {
    assert.equal(cajaSugeridaParaEmpleado({ ubicacionId: 'otra' }, cajas, 'central'), 'central')
})

test('excluye cajas y sedes inactivas', () => {
    assert.deepEqual(cajasActivasParaLiquidacion([
        ...cajas,
        { tipo: 'sede_cerrada', activo: true, ubicacionId: 'cerrada', ubicacion: { activo: false } },
    ]).map(caja => caja.tipo), ['central', 'villa_fuerte', 'villa_chica'])
})

