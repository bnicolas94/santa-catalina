import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calcularCostosProduccion, validarRangoCostosProduccion, type LoteParaCostos } from './costos-produccion'

const producto: LoteParaCostos['producto'] = { id: 'jq', nombre: 'Jamón y Queso', codigoInterno: 'JQ',
    presentaciones: [{ id: 'p48', cantidad: 48 }, { id: 'p24', cantidad: 24 }],
    fichasTecnicas: [
        { insumoId: 'pan', cantidadPorUnidad: .01, merma: 20, tipoConsumo: 'por_unidad', presentacionId: null,
            insumo: { nombre: 'Pan', unidadMedida: 'kg', precioUnitario: 100 } },
        { insumoId: 'caja', cantidadPorUnidad: 1, merma: 0, tipoConsumo: 'por_paquete', presentacionId: 'p48',
            insumo: { nombre: 'Caja', unidadMedida: 'u', precioUnitario: 5 } },
    ] }
const lote = (id: string, presentacionId: string, estado = 'en_camara'): LoteParaCostos => ({
    id, fechaProduccion: new Date('2026-11-26T00:00:00Z'), estado,
    unidadesProducidas: 2, unidadesRechazadas: 1,
    distribucion: [{ presentacionId, cantidad: 1 }], movimientosProducto: [], producto,
})

test('el rango usa el día de producción guardado en UTC y valida hasta 366 días', () => {
    const rango = validarRangoCostosProduccion('2026-11-26', '2026-11-26')
    assert.equal(rango.inicio.toISOString(), '2026-11-26T00:00:00.000Z')
    assert.equal(rango.finExclusivo.toISOString(), '2026-11-27T00:00:00.000Z')
    assert.throws(() => validarRangoCostosProduccion('2026-02-30', '2026-03-01'))
    assert.throws(() => validarRangoCostosProduccion('2026-11-27', '2026-11-26'))
    assert.throws(() => validarRangoCostosProduccion('2025-01-01', '2026-01-02'))
})

test('valora paquetes producidos brutos con merma y empaque de la presentación base', () => {
    const reporte = calcularCostosProduccion([lote('l48', 'p48'), lote('l24', 'p24'), lote('abierto', 'p48', 'en_produccion'),
        lote('anulado', 'p48', 'cancelado')])
    assert.equal(reporte.resumen.lotes, 2)
    assert.equal(reporte.resumen.lotesExcluidos, 2)
    assert.equal(reporte.resumen.paquetes, 4)
    assert.equal(reporte.resumen.rechazados, 2)
    assert.equal(reporte.resumen.buenos, 2)
    assert.equal(reporte.resumen.costoIdentificado, 190)
    assert.equal(reporte.resumen.costoCompleto, true)
    assert.equal(reporte.porProducto.find(item => item.presentacion === 48)?.costoIdentificado, 130)
    assert.equal(reporte.porProducto.find(item => item.presentacion === 24)?.costoIdentificado, 60)
    assert.equal(reporte.porInsumo.find(item => item.id === 'pan')?.cantidad, 1.8)
    assert.equal(reporte.porInsumo.find(item => item.id === 'caja')?.cantidad, 2)
    assert.equal(reporte.porDia[0].paquetes, 4)
})

test('conserva consumo identificable y señala lotes sin precio o presentación inequívoca', () => {
    const sinPrecio = lote('sin-precio', 'p48')
    sinPrecio.producto = { ...producto, fichasTecnicas: producto.fichasTecnicas.map(ficha =>
        ficha.insumoId === 'pan' ? { ...ficha, insumo: { ...ficha.insumo, precioUnitario: 0 } } : ficha) }
    const ambiguo = lote('ambiguo', 'p48')
    ambiguo.distribucion = null
    ambiguo.movimientosProducto = []
    const reporte = calcularCostosProduccion([sinPrecio, ambiguo])
    assert.equal(reporte.resumen.paquetes, 4)
    assert.equal(reporte.resumen.costoIdentificado, 10)
    assert.equal(reporte.resumen.costoCompleto, false)
    assert.equal(reporte.porInsumo.find(item => item.id === 'pan')?.cantidad, 1.2)
    assert.equal(reporte.porInsumo.find(item => item.id === 'pan')?.precioValido, false)
    assert.match(reporte.pendientes.find(item => item.loteId === 'sin-precio')?.motivos.join(' ') ?? '', /Sin precio/)
    assert.match(reporte.pendientes.find(item => item.loteId === 'ambiguo')?.motivos.join(' ') ?? '', /Presentación base/)
})

test('usa la presentación base del lote aunque toda la producción buena se haya convertido', () => {
    const convertido = lote('convertido', 'p48')
    convertido.distribucion = [{ presentacionId: 'p48', cantidad: 0 }, { presentacionId: 'p24', cantidad: 2 }]
    convertido.movimientosProducto = [{ presentacionId: 'p24' }]
    const reporte = calcularCostosProduccion([convertido])
    assert.equal(reporte.porProducto[0].presentacion, 48)
    assert.equal(reporte.porInsumo.find(item => item.id === 'pan')?.cantidad, 1.2)
    assert.equal(reporte.porInsumo.find(item => item.id === 'caja')?.cantidad, 2)
    assert.equal(reporte.resumen.costoIdentificado, 130)
})
