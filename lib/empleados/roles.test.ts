import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizarRolEmpleado } from './roles'

test('normaliza la identidad y los importes del tipo de empleado', () => {
    assert.deepEqual(normalizarRolEmpleado({
        nombre: ' administración general ',
        descripcion: '  Gestión interna  ',
        color: '#A3152F',
        cicloPago: 'mensual',
        jornal: '150000.129',
        valorHoraExtra: '4500',
        permisoCaja: true,
    }), {
        nombre: 'ADMINISTRACIÓN_GENERAL',
        descripcion: 'Gestión interna',
        color: '#a3152f',
        permisoDashboard: false,
        permisoStock: false,
        permisoCaja: true,
        permisoPersonal: false,
        permisoProduccion: false,
        permisoCostos: false,
        jornal: 150000.13,
        valorHoraExtra: 4500,
        cicloPago: 'MENSUAL',
    })
})

test('rechaza importes negativos, colores y ciclos inválidos', () => {
    assert.throws(() => normalizarRolEmpleado({ nombre: 'ROL', jornal: -1 }))
    assert.throws(() => normalizarRolEmpleado({ nombre: 'ROL', color: 'rojo' }))
    assert.throws(() => normalizarRolEmpleado({ nombre: 'ROL', cicloPago: 'QUINCENAL' }))
})
