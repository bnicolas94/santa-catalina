import assert from 'node:assert/strict'
import test from 'node:test'
import { buildDailyProductionSummary } from './dailyProductionSummary'

const jq = { id: 'jq', codigoInterno: 'JQ', nombre: 'Jamón y Queso', presentaciones: [{ id: 'jq48', cantidad: 48 }, { id: 'jq24', cantidad: 24 }] }
const clasico = { id: 'cla', codigoInterno: 'CLA', nombre: 'Surtido Clásico', presentaciones: [{ id: 'cla48', cantidad: 48 }] }

test('agrupa los paquetes finales por producto y presentación', () => {
    const result = buildDailyProductionSummary([
        { estado: 'en_camara', unidadesProducidas: 14, producto: jq, movimientosProducto: [{ presentacionId: 'jq48', cantidad: 7 }, { presentacionId: 'jq24', cantidad: 14 }] },
        { estado: 'distribuido', unidadesProducidas: 21, producto: jq, movimientosProducto: [{ presentacionId: 'jq48', cantidad: 21 }] },
        { estado: 'en_camara', unidadesProducidas: 14, producto: clasico, movimientosProducto: [{ presentacionId: 'cla48', cantidad: 14 }] },
    ])

    assert.deepEqual(result.map(item => [item.code, item.presentationSize, item.packages]), [
        ['JQ', 48, 28],
        ['JQ', 24, 14],
        ['CLA', 48, 14],
    ])
})

test('excluye lotes activos y anulados, y usa la distribución guardada como respaldo', () => {
    const result = buildDailyProductionSummary([
        { estado: 'en_produccion', unidadesProducidas: 50, producto: jq, distribucion: [{ presentacionId: 'jq48', cantidad: 50 }] },
        { estado: 'cancelado', unidadesProducidas: 30, producto: jq, distribucion: [{ presentacionId: 'jq48', cantidad: 30 }] },
        { estado: 'en_camara', unidadesProducidas: 14, producto: jq, distribucion: [{ presentacionId: 'jq48', cantidad: 7 }, { presentacionId: 'jq24', cantidad: 14 }] },
    ])

    assert.deepEqual(result.map(item => [item.presentationSize, item.packages]), [[48, 7], [24, 14]])
})
