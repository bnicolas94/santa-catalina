import assert from 'node:assert/strict'
import test from 'node:test'
import { calcularConsumosProduccion } from './produccion-insumos'

test('convierte paquetes x48 a unidades antes de calcular el consumo', () => {
    const receta = [{ insumoId: 'jamon', cantidadPorUnidad: 10 / 48, merma: 0 }]
    const [consumo] = calcularConsumosProduccion(receta, 7, 48)

    assert.equal(consumo.cantidad, 70)
})

test('incorpora la merma técnica configurada en la ficha', () => {
    const receta = [{ insumoId: 'pan', cantidadPorUnidad: 1, merma: 10 }]
    const [consumo] = calcularConsumosProduccion(receta, 2, 48)

    assert.equal(consumo.cantidad, 106.666667)
})

test('dos paquetes x24 consumen lo mismo que uno x48', () => {
    const receta = [{ insumoId: 'queso', cantidadPorUnidad: 0.025, merma: 0 }]
    const x48 = calcularConsumosProduccion(receta, 1, 48)
    const x24 = calcularConsumosProduccion(receta, 2, 24)

    assert.deepEqual(x24, x48)
})

test('rechaza cantidades de paquetes decimales o negativas', () => {
    assert.throws(() => calcularConsumosProduccion([], 1.5, 48), /entero/)
    assert.throws(() => calcularConsumosProduccion([], -1, 48), /entero/)
})
