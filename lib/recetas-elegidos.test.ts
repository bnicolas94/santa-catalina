import assert from 'node:assert/strict'
import { test } from 'node:test'
import { saboresConfigurables, validarLineaElegidos } from './recetas-elegidos'
import { cantidadParaGuardar, cantidadParaPlancha } from './recetas-elegidos-unidades'

test('el editor ofrece todos los sabores del Sheet una sola vez', () => {
    const codigos = saboresConfigurables.map(s => s.codigo)
    assert.equal(new Set(codigos).size, codigos.length)
    for (const codigo of ['tom', 'hue', 'crudo', 'panceta', 'pollo']) assert.ok(codigos.includes(codigo))
})

test('valida cantidad, merma y alcance de base, sabor y empaque', () => {
    assert.equal(validarLineaElegidos({ alcance: 'base', insumoId: 'pan', cantidad: .5, merma: 0 }).codigoSabor, null)
    assert.equal(validarLineaElegidos({ alcance: 'sabor', codigoSabor: 'tom', insumoId: 'tomate', cantidad: 1, merma: 10 }).codigoSabor, 'tom')
    assert.equal(validarLineaElegidos({ alcance: 'empaque', presentacionId: 'x24', insumoId: 'caja', cantidad: 1, merma: 0 }).presentacionId, 'x24')
    assert.throws(() => validarLineaElegidos({ alcance: 'sabor', codigoSabor: 'desconocido', insumoId: 'x', cantidad: 1, merma: 0 }))
    assert.throws(() => validarLineaElegidos({ alcance: 'empaque', insumoId: 'x', cantidad: 1, merma: 0 }))
    assert.throws(() => validarLineaElegidos({ alcance: 'base', insumoId: 'x', cantidad: 0, merma: 0 }))
    assert.throws(() => validarLineaElegidos({ alcance: 'base', insumoId: 'x', cantidad: 1, merma: 100 }))
})

test('la base se carga por plancha y conserva el consumo histórico por sándwich', () => {
    const cantidadHistoricaPorSandwich = 0.08
    assert.equal(cantidadParaPlancha('base', cantidadHistoricaPorSandwich), 0.64)
    assert.equal(cantidadParaGuardar('base', 0.64), cantidadHistoricaPorSandwich)
    assert.equal(cantidadParaGuardar('sabor', 0.64), 0.64)
    assert.equal(cantidadParaGuardar('empaque', 1), 1)
})
