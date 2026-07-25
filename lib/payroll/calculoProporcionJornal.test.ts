import assert from 'node:assert/strict'
import test from 'node:test'

import { calcularProporcionJornal } from '../../utils/horas'

test('prorratea el jornal por las horas reales cuando no se completa la jornada', () => {
    assert.equal(calcularProporcionJornal(8, 9), 8 / 9)
})

test('limita el jornal base a un día completo cuando existen horas extras', () => {
    assert.equal(calcularProporcionJornal(10, 9), 1)
})

test('no genera un jornal negativo o inválido', () => {
    assert.equal(calcularProporcionJornal(-1, 9), 0)
    assert.equal(calcularProporcionJornal(8, 0), 0)
})
