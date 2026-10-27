import assert from 'node:assert/strict'
import test from 'node:test'
import {
    nombreEmpleadoApellidoPrimero,
    ordenarEmpleadosPorApellido,
} from './nombres-empleados'

test('muestra apellido, coma y nombres', () => {
    assert.equal(nombreEmpleadoApellidoPrimero({ nombre: 'Yaqueline', apellido: 'Acosta' }), 'Acosta, Yaqueline')
    assert.equal(nombreEmpleadoApellidoPrimero({ nombre: 'Administrador', apellido: null }), 'Administrador')
})
test('ordena por apellido y luego por nombres ignorando acentos y mayúsculas', () => {
    const originales = [
        { id: '4', nombre: 'Administrador', apellido: null },
        { id: '3', nombre: 'Zoe', apellido: 'Álvarez' },
        { id: '2', nombre: 'Ana', apellido: 'alvarez' },
        { id: '1', nombre: 'Valentina', apellido: 'Díaz' },
    ]

    const ordenados = ordenarEmpleadosPorApellido(originales)
    assert.deepEqual(ordenados.map(empleado => empleado.id), ['2', '3', '1', '4'])
    assert.deepEqual(originales.map(empleado => empleado.id), ['4', '3', '2', '1'])
})

