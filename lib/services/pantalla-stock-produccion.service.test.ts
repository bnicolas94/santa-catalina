import assert from 'node:assert/strict'
import test from 'node:test'
import { obtenerPantallaStockProduccion } from './pantalla-stock-produccion.service'

test('antes de las 9 muestra la espera aunque el Excel no esté configurado', async t => {
    const urlAnterior = process.env.PRODUCCION_PEDIDOS_EXCEL_URL
    process.env.PRODUCCION_PEDIDOS_EXCEL_URL = ''
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-25T11:42:00Z') })
    try {
        assert.deepEqual(await obtenerPantallaStockProduccion(), {
            estado: 'esperando_inicio', fecha: '2026-09-25',
        })
    } finally {
        t.mock.timers.reset()
        if (urlAnterior === undefined) delete process.env.PRODUCCION_PEDIDOS_EXCEL_URL
        else process.env.PRODUCCION_PEDIDOS_EXCEL_URL = urlAnterior
    }
})
