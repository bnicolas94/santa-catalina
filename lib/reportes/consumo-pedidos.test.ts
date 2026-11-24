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

test('no atribuye la ficha genérica de ELE a sabores elegidos del Sheet', () => {
    const csv = [cabecera, fila('1', '8 Surtidos Elegidos', '8', '100')
        .replace('13/11/2026,,100', '13/11/2026,"Sabores (8): 8x Huevo",100')].join('\n')
    const reporte = { ...calcularReportePedidosOnline(csv, { desde: '2026-11-13', hasta: '2026-11-13' }), actualizado: '' }
    const productos: ProductoConReceta[] = [{ id: 'ele', nombre: 'Elegidos', codigoInterno: 'ELE',
        presentaciones: [{ id: 'ele8', cantidad: 8 }], fichasTecnicas: [ficha('relleno', 10, 1)] }]
    const r = calcularConsumoPedidos(reporte, productos)
    assert.equal(r.resumen.costoEstimado, 0)
    assert.equal(r.resumen.ingresoSinCosto, 100)
    assert.equal(r.porTipo[0].motivo, 'Costo según mezcla de sabores en el resumen')
    assert.deepEqual(reporte.porSaborElegido.map(x => ({ codigo: x.codigo, planchas: x.planchas })), [{ codigo: 'hue', planchas: 1 }])
    assert.equal(reporte.calidad.sinSaboresElegidos, 0)
})

test('si Observaciones no detalla los sabores, informa la falta sin inventar planchas', () => {
    const csv = [cabecera, fila('1', '8 Surtidos Elegidos', '8', '100')].join('\n')
    const reporte = calcularReportePedidosOnline(csv, { desde: '2026-11-13', hasta: '2026-11-13' })
    assert.deepEqual(reporte.porSaborElegido, [])
    assert.equal(reporte.calidad.sinSaboresElegidos, 1)
})

test('valora cada ficha completa por plancha, incluido un sabor premium, sin sumar la base anterior', () => {
    const csv = [cabecera, fila('1', '24 Surtidos Elegidos', '24', '240')
        .replace('13/11/2026,,240', '13/11/2026,"Sabores (24): 16x Tomate + 8x Roquefort",240')].join('\n')
    const reporte = { ...calcularReportePedidosOnline(csv, { desde: '2026-11-13', hasta: '2026-11-13' }), actualizado: '' }
    const insumo = (nombre: string, precioUnitario: number) => ({ nombre, unidadMedida: 'kg', precioUnitario })
    const productos: ProductoConReceta[] = [{ id: 'ele', nombre: 'Elegidos', codigoInterno: 'ELE',
        presentaciones: [{ id: 'ele24', cantidad: 24 }], fichasTecnicas: [ficha('generico', 999, 1)],
        recetasElegidos: [
            { alcance: 'base', cantidad: .5, merma: 0, insumoId: 'pan', variante: null, presentacion: null, insumo: insumo('Pan', 2) },
            { alcance: 'sabor', cantidad: .5, merma: 0, insumoId: 'pan', variante: { codigo: 'tom' }, presentacion: null, insumo: insumo('Pan', 2) },
            { alcance: 'sabor', cantidad: 3, merma: 0, insumoId: 'tomate', variante: { codigo: 'tom' }, presentacion: null, insumo: insumo('Tomate', 10) },
            { alcance: 'sabor', cantidad: .5, merma: 0, insumoId: 'pan', variante: { codigo: 'roque' }, presentacion: null, insumo: insumo('Pan', 2) },
            { alcance: 'sabor', cantidad: 1, merma: 0, insumoId: 'roque', variante: { codigo: 'roque' }, presentacion: null, insumo: insumo('Roquefort', 20) },
            { alcance: 'empaque', cantidad: 1, merma: 0, insumoId: 'bandeja', variante: null, presentacion: { cantidad: 24 }, insumo: insumo('Bandeja', 5) },
        ] }]
    const r = calcularConsumoPedidos(reporte, productos)
    assert.equal(r.resumen.costoEstimado, 88)
    assert.equal(r.resumen.ingresoConCosto, 240)
    assert.equal(r.resumen.margenComparable, 152)
    assert.equal(r.resumen.paquetesValorados, 1)
    assert.equal(r.resumen.paquetesSinCosto, 0)
    assert.equal(r.resumen.elegidos.paquetesValorados, 1)
    assert.equal(r.porInsumo.find(x => x.id === 'tomate')?.cantidad, 6)
    assert.equal(r.porInsumo.find(x => x.id === 'pan')?.cantidad, 1.5)
    assert.deepEqual(r.porSaborCosto.map(x => ({ codigo: x.codigo, planchas: x.planchasValoradas, costo: x.costoEstimado })), [
        { codigo: 'tom', planchas: 2, costo: 62 },
        { codigo: 'roque', planchas: 1, costo: 21 },
    ])
    assert.equal(r.porInsumo.some(x => x.id === 'generico'), false)
})

test('Personalizado usa las fichas de sus sabores como Elegidos', () => {
    const csv = [cabecera, fila('1', 'Personalizado x16 (2 planchas)', '16', '160')
        .replace('13/11/2026,,160', '13/11/2026,"Sabores (16): 8x Tomate + 8x Roquefort",160')].join('\n')
    const reporte = { ...calcularReportePedidosOnline(csv, { desde: '2026-11-13', hasta: '2026-11-13' }), actualizado: '' }
    assert.deepEqual(reporte.pedidosElegidos[0]?.sabores?.map(x => x.codigo), ['tom', 'roque'])
    assert.deepEqual(reporte.pedidosElegidos[0]?.presentaciones, [{ cantidad: 16, paquetes: 1 }])
    const insumo = (nombre: string, precioUnitario: number) => ({ nombre, unidadMedida: 'u', precioUnitario })
    const calculo = calcularConsumoPedidos(reporte, [{ id: 'ele', nombre: 'Elegidos', codigoInterno: 'ELE',
        presentaciones: [{ id: 'ele16', cantidad: 16 }], fichasTecnicas: [], recetasElegidos: [
            { alcance: 'sabor', cantidad: 2, merma: 0, insumoId: 'tomate', variante: { codigo: 'tom' }, presentacion: null, insumo: insumo('Tomate', 3) },
            { alcance: 'sabor', cantidad: 1, merma: 0, insumoId: 'roque', variante: { codigo: 'roque' }, presentacion: null, insumo: insumo('Roquefort', 10) },
            { alcance: 'empaque', cantidad: 1, merma: 0, insumoId: 'caja', variante: null, presentacion: { cantidad: 16 }, insumo: insumo('Caja', 4) },
        ] }])
    assert.equal(calculo.resumen.elegidos.costoEstimado, 20)
    assert.equal(calculo.resumen.margenComparable, 140)
})

test('un sabor sin receta deja pendiente todo el pedido Elegidos', () => {
    const csv = [cabecera, fila('1', '16 Surtidos Elegidos', '16', '160')
        .replace('13/11/2026,,160', '13/11/2026,"Sabores (16): 8x Tomate + 8x Huevo",160')].join('\n')
    const reporte = { ...calcularReportePedidosOnline(csv, { desde: '2026-11-13', hasta: '2026-11-13' }), actualizado: '' }
    const productos: ProductoConReceta[] = [{ id: 'ele', nombre: 'Elegidos', codigoInterno: 'ELE',
        presentaciones: [{ id: 'ele16', cantidad: 16 }], fichasTecnicas: [], recetasElegidos: [
            { alcance: 'base', cantidad: .5, merma: 0, insumoId: 'pan', variante: null, presentacion: null, insumo: { nombre: 'Pan', unidadMedida: 'kg', precioUnitario: 2 } },
            { alcance: 'sabor', cantidad: 1, merma: 0, insumoId: 'tomate', variante: { codigo: 'tom' }, presentacion: null, insumo: { nombre: 'Tomate', unidadMedida: 'kg', precioUnitario: 10 } },
            { alcance: 'empaque', cantidad: 1, merma: 0, insumoId: 'bandeja', variante: null, presentacion: { cantidad: 16 }, insumo: { nombre: 'Bandeja', unidadMedida: 'u', precioUnitario: 5 } },
        ] }]
    const r = calcularConsumoPedidos(reporte, productos)
    assert.equal(r.resumen.costoEstimado, 0)
    assert.equal(r.resumen.ingresoSinCosto, 160)
    assert.deepEqual(r.porInsumo, [])
    assert.equal(r.resumen.elegidos.costoSaboresIdentificados, 10)
    assert.deepEqual(r.porSaborCosto.map(x => ({ codigo: x.codigo, planchas: x.planchasValoradas, costo: x.costoEstimado })),
        [{ codigo: 'tom', planchas: 1, costo: 10 }])
    assert.deepEqual(r.resumen.elegidos.faltantes, [{ motivo: 'Falta receta de sabor Huevo', paquetes: 1 }])
})

test('muestra el costo de sabores cargados aunque falte empaque y enumera todos los faltantes', () => {
    const csv = [cabecera, fila('1', '16 Surtidos Elegidos', '16', '160')
        .replace('13/11/2026,,160', '13/11/2026,"Sabores (16): 8x Tomate + 8x Huevo",160')].join('\n')
    const reporte = { ...calcularReportePedidosOnline(csv, { desde: '2026-11-13', hasta: '2026-11-13' }), actualizado: '' }
    const r = calcularConsumoPedidos(reporte, [{ id: 'ele', nombre: 'Elegidos', codigoInterno: 'ELE',
        presentaciones: [{ id: 'ele16', cantidad: 16 }], fichasTecnicas: [], recetasElegidos: [
            { alcance: 'sabor', cantidad: 2, merma: 0, insumoId: 'tomate', variante: { codigo: 'tom' }, presentacion: null,
                insumo: { nombre: 'Tomate', unidadMedida: 'kg', precioUnitario: 5 } },
        ] }])
    assert.equal(r.resumen.elegidos.paquetesValorados, 0)
    assert.equal(r.resumen.elegidos.paquetesSinCosto, 1)
    assert.equal(r.resumen.elegidos.planchasConCosto, 1)
    assert.equal(r.resumen.elegidos.costoSaboresIdentificados, 10)
    assert.equal(r.resumen.costoEstimado, 0)
    assert.deepEqual(r.resumen.elegidos.faltantes, [
        { motivo: 'Falta receta de sabor Huevo', paquetes: 1 },
        { motivo: 'Falta receta de empaque x16', paquetes: 1 },
    ])
})

test('un pedido mixto atribuye a Elegidos sólo su parte del precio', () => {
    const csv = [cabecera, fila('1', '24 Surtidos Elegidos + 24 Jamón y Queso', '48', '100')
        .replace('13/11/2026,,100', '13/11/2026,"Sabores (24): 24x Tomate",100')].join('\n')
    const reporte = calcularReportePedidosOnline(csv, { desde: '2026-11-13', hasta: '2026-11-13' })
    assert.equal(reporte.pedidosElegidos[0].ingresoAtribuido, 50)
    assert.deepEqual(reporte.pedidosElegidos[0].presentaciones, [{ cantidad: 24, paquetes: 1 }])
})
