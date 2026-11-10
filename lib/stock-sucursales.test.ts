import assert from 'node:assert/strict'
import test from 'node:test'
import { fechaLocalArgentina, leerReporteInput } from './stock-sucursales'

test('la fecha del reporte sigue el día de Argentina', () => {
    assert.equal(fechaLocalArgentina(new Date('2026-11-11T01:30:00Z')), '2026-11-10')
})

test('distingue vacío de cero y valida cantidades de reposición', () => {
    const reporte = leerReporteInput({ version: 0, detalles: [
        { insumoId: 'a', cantidadInformada: '0', cantidadSolicitada: '' },
        { insumoId: 'b', cantidadInformada: '', cantidadSolicitada: '1,5' },
        { insumoId: 'c', cantidadInformada: '', cantidadSolicitada: '' },
    ] })
    assert.deepEqual(reporte.detalles, [
        { insumoId: 'a', cantidadInformada: 0, cantidadSolicitada: null },
        { insumoId: 'b', cantidadInformada: null, cantidadSolicitada: 1.5 },
    ])
    assert.throws(() => leerReporteInput({ version: 0, detalles: [{ insumoId: 'a', cantidadSolicitada: '-1' }] }))
    assert.throws(() => leerReporteInput({ version: 0, detalles: [{ insumoId: 'a', cantidadSolicitada: '1' }, { insumoId: 'a', cantidadInformada: '2' }] }))
})
