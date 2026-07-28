import assert from 'node:assert/strict'
import test from 'node:test'

import { agruparLiquidacionesPorTipo, etiquetaTipoLiquidacion, normalizarTipoLiquidacion } from './liquidaciones'

test('normaliza las clases de liquidación sin mezclar sueldo, SAC y vacaciones', () => {
    assert.equal(normalizarTipoLiquidacion('NORMAL'), 'NORMAL')
    assert.equal(normalizarTipoLiquidacion('SAC'), 'SAC')
    assert.equal(normalizarTipoLiquidacion('VACACIONES'), 'VACACIONES')
    assert.equal(normalizarTipoLiquidacion('LIQUIDACION_FINAL'), 'FINAL')
    assert.equal(normalizarTipoLiquidacion('HORAS_EXTRAS_ADEUDADAS'), 'HORAS_EXTRAS_ADEUDADAS')
    assert.equal(normalizarTipoLiquidacion('NORMAL', 'SAC 1º Semestre 2025'), 'SAC')
    assert.equal(etiquetaTipoLiquidacion('VACACIONES'), 'Vacaciones')
})

test('agrupa importes y cantidades por naturaleza de liquidación', () => {
    const grupos = agruparLiquidacionesPorTipo([
        { tipo: 'NORMAL', totalNeto: 100_000 },
        { tipo: 'NORMAL', totalNeto: 120_000 },
        { tipo: 'NORMAL', periodo: 'SAC 1º Semestre 2025', totalNeto: 80_000 },
        { tipo: 'VACACIONES', totalNeto: 60_000 },
        { tipo: 'HORAS_EXTRAS_ADEUDADAS', totalNeto: 15_000 },
    ])

    assert.deepEqual(grupos.find(grupo => grupo.tipo === 'NORMAL'), {
        tipo: 'NORMAL', etiqueta: 'Sueldo habitual', total: 220_000, cantidad: 2,
    })
    assert.equal(grupos.find(grupo => grupo.tipo === 'SAC')?.total, 80_000)
    assert.equal(grupos.find(grupo => grupo.tipo === 'VACACIONES')?.total, 60_000)
    assert.equal(grupos.find(grupo => grupo.tipo === 'HORAS_EXTRAS_ADEUDADAS')?.total, 15_000)
})
