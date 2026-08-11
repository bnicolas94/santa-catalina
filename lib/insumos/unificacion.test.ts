import test from 'node:test'
import assert from 'node:assert/strict'
import { prepararTransferenciaStock } from './unificacion'

test('convierte barras del duplicado a kg y barras del insumo principal', () => {
    const [transferencia] = prepararTransferenciaStock(50, 0, [{
        ubicacionId: 'central', cantidad: 50, cantidadSecundaria: 0,
    }], 5.2, 1)

    assert.equal(transferencia.cantidadDestino, 260)
    assert.equal(transferencia.cantidadSecundariaDestino, 50)
})

test('impide unificar si el stock global no coincide con las ubicaciones', () => {
    assert.throws(() => prepararTransferenciaStock(50, 0, [{
        ubicacionId: 'central', cantidad: 40, cantidadSecundaria: 0,
    }], 5.2, 1))
})
