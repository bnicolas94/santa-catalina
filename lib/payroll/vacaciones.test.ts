import assert from 'node:assert/strict'
import test from 'node:test'

import { fechasDeRangoVacaciones, periodoLaboralCubiertoPorVacaciones, rangoVacacionesDesdeDesglose } from './vacaciones'

test('recupera rangos de vacaciones guardados en liquidaciones históricas', () => {
    assert.deepEqual(rangoVacacionesDesdeDesglose({ fechaInicioGoce: '2026-07-20', fechaFinGoce: '2026-07-26' }), {
        desde: '2026-07-20',
        hasta: '2026-07-26',
    })
    assert.equal(rangoVacacionesDesdeDesglose([{ fecha: '2026-07-20' }]), null)
})

test('genera todas las fechas civiles del período de vacaciones', () => {
    assert.deepEqual(fechasDeRangoVacaciones('2026-07-30', '2026-08-02'), [
        '2026-07-30', '2026-07-31', '2026-08-01', '2026-08-02',
    ])
})

test('excluye una liquidación semanal cuando todos los días laborales están de vacaciones', () => {
    const vacaciones = new Set(fechasDeRangoVacaciones('2026-07-20', '2026-07-24'))
    assert.equal(periodoLaboralCubiertoPorVacaciones('2026-07-20', '2026-07-26', 'Lunes a Viernes', vacaciones), true)
    vacaciones.delete('2026-07-22')
    assert.equal(periodoLaboralCubiertoPorVacaciones('2026-07-20', '2026-07-26', 'Lunes a Viernes', vacaciones), false)
})
