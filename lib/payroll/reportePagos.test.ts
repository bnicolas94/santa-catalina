import assert from 'node:assert/strict'
import test from 'node:test'
import { ordenarReportePagosAlfabeticamente } from './reportePagos'

test('ordena el reporte de pagos de A a Z ignorando acentos y mayúsculas', () => {
    const original = [
        { id: '4', empleado: 'Yaqueline Acosta' },
        { id: '3', empleado: 'Érica Gómez' },
        { id: '2', empleado: 'ana Pérez' },
        { id: '1', empleado: 'Álvaro Díaz' },
    ]

    const ordenadas = ordenarReportePagosAlfabeticamente(original)

    assert.deepEqual(ordenadas.map(fila => fila.id), ['1', '2', '3', '4'])
    assert.deepEqual(original.map(fila => fila.id), ['4', '3', '2', '1'])
})

