import assert from 'node:assert/strict'
import test from 'node:test'

import { empleadoIncluidoEnNomina, validarEmpleadoIncluidoEnNomina } from './elegibilidadNomina'

test('mantiene elegibles los registros anteriores y empleados activos incluidos', () => {
    assert.equal(empleadoIncluidoEnNomina({ activo: true }), true)
    assert.equal(empleadoIncluidoEnNomina({ activo: true, incluidoNomina: true }), true)
})

test('excluye inactivos y personas marcadas fuera de nómina', () => {
    assert.equal(empleadoIncluidoEnNomina({ activo: false, incluidoNomina: true }), false)
    assert.equal(empleadoIncluidoEnNomina({ activo: true, incluidoNomina: false }), false)
    assert.throws(
        () => validarEmpleadoIncluidoEnNomina({ activo: true, incluidoNomina: false }),
        /no está incluida en la nómina/,
    )
})
