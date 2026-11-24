import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calcularReportePedidosOnline } from './pedidos-online'
import { calcularConsumoPedidos, type ProductoConReceta } from './consumo-pedidos'

const cabecera = 'ID,Fecha/Hora,Nombre,Apellido,Telefono,Direccion,Producto,Modalidad,Estado,Fecha Entrega,Observaciones,Precio,Pago,Ubicacion,Cantidad'
const fila = (id: string, producto: string, cantidad: string, precio: string, entrega = '13/11/2026') =>
    `${id},12/11/2026 10:00,Ana,Test,123,Calle,"${producto}",Delivery,Entregado,${entrega},,${precio},Efectivo,Centro,${cantidad}`

const ficha = (insumoId: string, precioUnitario: number, cantidadPorUnidad: number, opciones: { merma?: number; tipoConsumo?: string; presentacionId?: string } = {}) => ({
    insumoId, cantidadPorUnidad, merma: opciones.merma ?? 0, tipoConsumo: opciones.tipoConsumo ?? 'por_unidad',
    presentacionId: opciones.presentacionId ?? null,
    insumo: { nombre: insumoId, unidadMedida: 'kg', precioUnitario },
})

test('unifica ventas del Sheet con consumo y costo de recetas sin confundir cobertura con margen', () => {
    const csv = [cabecera,
        fila('1', '24 Jamón y Queso + 48 Surtidos Clásicos', '72', '120'),
        fila('2', '24 Jamón y Queso', '24', ''),
        fila('3', '48 Surtidos Especiales', '48', '70'),
        fila('4', '#ERROR!', '8', '30'),
        fila('5', '24 Jamón y Queso', '24', '40', '12/11/2026'),
    ].join('\n')
    const reporte = { ...calcularReportePedidosOnline(csv, { desde: '2026-11-13', hasta: '2026-11-13' }), actualizado: '2026-11-13T12:00:00Z' }
    const productos: ProductoConReceta[] = [
        { id: 'jq', nombre: 'Jamón y Queso', codigoInterno: 'JQ', presentaciones: [{ id: 'jq24', cantidad: 24 }],
            fichasTecnicas: [ficha('pan', 2, .5), ficha('caja', 10, 1, { tipoConsumo: 'por_paquete', presentacionId: 'jq24' })] },
        { id: 'cla', nombre: 'Surtido Clásico', codigoInterno: 'CLA', presentaciones: [{ id: 'cla48', cantidad: 48 }],
            fichasTecnicas: [ficha('queso', 4, .25, { merma: 20 })] },
    ]
    const r = calcularConsumoPedidos(reporte, productos)
    assert.equal(r.resumen.ingresoEsperado, 220)
    assert.equal(r.resumen.paquetesVendidos, 4)
    assert.equal(r.resumen.paquetesValorados, 3)
    assert.equal(r.resumen.paquetesSinCosto, 1)
    assert.equal(r.resumen.costoEstimado, 128)
    assert.equal(r.resumen.costoComparable, 94)
    assert.equal(r.resumen.ingresoConCosto, 120)
    assert.equal(r.resumen.margenComparable, 26)
    assert.equal(r.resumen.ingresoSinCosto, 100)
    assert.equal(r.resumen.costoAnterior, 34)
    assert.equal(r.porInsumo.find(x => x.id === 'pan')?.cantidad, 24)
    assert.equal(r.porInsumo.find(x => x.id === 'caja')?.cantidad, 2)
    assert.equal(r.porInsumo.find(x => x.id === 'queso')?.cantidad, 15)
    assert.equal(r.porTipo.find(x => x.nombre === 'Surtidos Especiales')?.motivo, 'Sin producto inequívoco en ERP')
})

test('una receta sin precio completo no suma un costo parcial', () => {
    const csv = [cabecera, fila('1', '24 Jamón y Queso', '24', '100')].join('\n')
    const reporte = { ...calcularReportePedidosOnline(csv, { desde: '2026-11-13', hasta: '2026-11-13' }), actualizado: '' }
    const productos: ProductoConReceta[] = [{ id: 'jq', nombre: 'Jamón y Queso', codigoInterno: 'JQ',
        presentaciones: [{ id: 'jq24', cantidad: 24 }], fichasTecnicas: [ficha('pan', 2, .5), ficha('queso', 0, .25)] }]
    const r = calcularConsumoPedidos(reporte, productos)
    assert.equal(r.resumen.costoEstimado, 0)
    assert.equal(r.resumen.ingresoSinCosto, 100)
    assert.equal(r.resumen.paquetesSinCosto, 1)
    assert.equal(r.porTipo[0].costoEstimado, null)
    assert.equal(r.porTipo[0].motivo, 'Sin precio de insumo: queso')
    assert.deepEqual(r.porInsumo, [])
})

test('el filtro interno de sedes admite varios textos del Sheet para una sede ERP', () => {
    const csv = [cabecera, fila('1', '24 Jamón y Queso', '24', '100'),
        fila('2', '24 Jamón y Queso', '24', '100').replace(',Centro,', ',Fábrica,'),
        fila('3', '24 Jamón y Queso', '24', '100').replace(',Centro,', ',Otra,')].join('\n')
    const r = calcularReportePedidosOnline(csv, { desde: '2026-11-13', hasta: '2026-11-13', ubicaciones: ['centro', 'fabrica'] })
    assert.equal(r.resumen.ingresoEsperado, 200)
})

test('el período anterior incluye tipos que ya no se vendieron en el período elegido', () => {
    const csv = [cabecera, fila('1', '24 Jamón y Queso', '24', '40', '12/11/2026')].join('\n')
    const reporte = { ...calcularReportePedidosOnline(csv, { desde: '2026-11-13', hasta: '2026-11-13' }), actualizado: '' }
    const productos: ProductoConReceta[] = [{ id: 'jq', nombre: 'Jamón y Queso', codigoInterno: 'JQ',
        presentaciones: [{ id: 'jq24', cantidad: 24 }], fichasTecnicas: [ficha('pan', 2, .5)] }]
    const r = calcularConsumoPedidos(reporte, productos)
    assert.equal(r.resumen.costoEstimado, 0)
    assert.equal(r.resumen.costoAnterior, 24)
    assert.equal(r.resumen.paquetesAnteriores, 1)
    assert.deepEqual(r.porTipo, [])
})
