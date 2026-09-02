import test from 'node:test'
import assert from 'node:assert/strict'
import { motivoBloqueoDesactivacion } from './desactivacion'

test('permite desactivar sin borrar historial cuando no hay stock ni fichas técnicas', () => {
    assert.equal(motivoBloqueoDesactivacion({
        stockActual: 0,
        stockActualSecundario: 0,
        stocks: [{ cantidad: 0, cantidadSecundaria: 0 }],
        cantidadFichasTecnicas: 0,
    }), null)
})

test('bloquea la baja si queda stock global o por ubicación', () => {
    assert.match(motivoBloqueoDesactivacion({
        stockActual: 0,
        stockActualSecundario: 0,
        stocks: [{ cantidad: 1, cantidadSecundaria: 0 }],
        cantidadFichasTecnicas: 0,
    }) || '', /stock/)
})

test('bloquea la baja si el insumo todavía integra una ficha técnica', () => {
    assert.match(motivoBloqueoDesactivacion({
        stockActual: 0,
        stockActualSecundario: 0,
        stocks: [],
        cantidadFichasTecnicas: 1,
    }) || '', /ficha técnica/)
})
