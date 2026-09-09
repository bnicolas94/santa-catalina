import assert from 'node:assert/strict'
import test from 'node:test'
import { validarSede, validarCambioTipo } from './sedes'

test('normaliza nombres y conserva la desactivación explícita', () => {
    assert.deepEqual(validarSede({ nombre: '  Centro  ', tipo: 'LOCAL', activo: false }), { nombre: 'Centro', tipo: 'LOCAL', activo: false })
})
test('rechaza entradas inválidas sin aceptar estados o tipos arbitrarios', () => {
    for (const input of [null, {}, { nombre: ' ', tipo: 'LOCAL' }, { nombre: 'a'.repeat(101), tipo: 'LOCAL' }, { nombre: 'Centro', tipo: 'OTRO' }, { nombre: 'Centro', tipo: 'LOCAL', activo: 'false' }]) {
        assert.throws(() => validarSede(input))
    }
})
test('permite renombrar sedes usadas pero impide reclasificar su historial', () => {
    assert.doesNotThrow(() => validarCambioTipo('LOCAL', 'LOCAL', { empleados: 1 }))
    assert.doesNotThrow(() => validarCambioTipo('LOCAL', 'FABRICA', { empleados: 0 }))
    for (const relacion of ['empleados', 'stocks', 'pedidos', 'movimientosStock']) {
        assert.throws(() => validarCambioTipo('LOCAL', 'FABRICA', { [relacion]: 1 }))
    }
})
