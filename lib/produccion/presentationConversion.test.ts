import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateJqPresentationSplit } from './presentationConversion'

test('convierte cada paquete base x48 asignado a x24 en dos paquetes x24', () => {
    assert.deepEqual(calculateJqPresentationSplit(7, 7), {
        basePackages: 14,
        outputX48: 7,
        outputX24: 14,
        outputPackages: 21,
    })
})

test('ignora cantidades negativas, decimales o inválidas', () => {
    assert.deepEqual(calculateJqPresentationSplit(-1, 2.5), {
        basePackages: 0,
        outputX48: 0,
        outputX24: 0,
        outputPackages: 0,
    })
})
