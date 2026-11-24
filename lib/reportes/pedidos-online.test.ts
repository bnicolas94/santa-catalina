import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calcularReportePedidosFuentes, calcularReportePedidosOnline, contarPaquetesPedido, distribuirImportePaquetes, fechaEntregaIso, interpretarLineasPaquetes, interpretarSaboresVentaRapida, validarFiltrosPedidosOnline } from './pedidos-online'

const cabecera = 'ID,Fecha/Hora,Nombre,Apellido,Telefono,Direccion,Producto,Modalidad,Estado,Fecha Entrega,Observaciones,Precio,Pago,Ubicacion'
const fila = (id: string, fecha: string, modalidad: string, estado: string, precio: string, ubicacion = 'Centro', fechaEntrega = '13/11/2026') =>
    [id, fecha, 'Ana', 'Pérez', '123', 'Calle 1', '48 Jamon y Queso', modalidad, estado, fechaEntrega, 'Turno: Mañana', precio, 'Efectivo', ubicacion].join(',')

test('ingreso esperado usa sólo entregados válidos y compara el mismo período anterior', () => {
    const csv = [cabecera,
        fila('previo', '12/11/2026 10:00', 'Delivery', 'Entregado', '800', 'Centro', '12/11/2026'),
        fila('uno', '13/11/2026 10:00', 'Delivery', 'Entregado', '1000'),
        fila('dos', '13/11/2026 11:00', 'Retiro', 'Entregado', '2000'),
        fila('pendiente', '13/11/2026 12:00', 'Delivery', 'Pendiente', '3000'),
        fila('cancelado', '13/11/2026 13:00', 'Retiro', 'Cancelado', '4000'),
        fila('sin-precio', '13/11/2026 14:00', 'Delivery', 'Entregado', ''),
        fila('dup', '13/11/2026 15:00', 'Delivery', 'Entregado', '900'),
        fila('dup', '13/11/2026 15:00', 'Delivery', 'Entregado', '900'),
    ].join('\n')
    const r = calcularReportePedidosOnline(csv, { desde: '2026-11-13', hasta: '2026-11-13' })
    assert.equal(r.resumen.ingresoEsperado, 3000)
    assert.equal(r.resumen.ingresoPotencial, 3000)
    assert.equal(r.resumen.entregados, 3)
    assert.equal(r.resumen.ticketPromedio, 1500)
    assert.equal(r.resumen.anterior.ingresoEsperado, 800)
    assert.equal(r.calidad.duplicados, 1)
    assert.equal(r.calidad.sinPrecio, 1)
    assert.equal(r.totalFilas, 6)
    const retiro = calcularReportePedidosOnline(csv, { desde: '2026-11-13', hasta: '2026-11-13', modalidad: 'Retiro' })
    assert.equal(retiro.resumen.ingresoEsperado, 2000)
    assert.equal(retiro.resumen.cancelados, 1)
})

test('período y página inválidos se rechazan', () => {
    assert.throws(() => validarFiltrosPedidosOnline({ desde: '2026-11-14', hasta: '2026-11-13' }))
    assert.throws(() => validarFiltrosPedidosOnline({ desde: '2026-11-13', hasta: '2026-11-13', pagina: 0 }))
})

test('IDs contradictorios y fechas imposibles no inflan el ingreso', () => {
    const csv = [cabecera,
        fila('conflicto', '13/11/2026 10:00', 'Delivery', 'Entregado', '1000'),
        fila('conflicto', '13/11/2026 10:00', 'Delivery', 'Entregado', '2000'),
        fila('fecha-mala', '13/11/2026 10:00', 'Delivery', 'Entregado', '3000', 'Centro', '31/02/2026'),
    ].join('\n')
    const r = calcularReportePedidosOnline(csv, { desde: '2026-11-13', hasta: '2026-11-13' })
    assert.equal(r.resumen.ingresoEsperado, 0)
    assert.equal(r.calidad.conflictos, 1)
    assert.equal(r.calidad.sinFechaEntrega, 1)
})

test('el reporte conjunto suma las dos hojas y separa IDs iguales por origen', () => {
    const local = 'ID,Fecha/Hora,Precio,Pago,Ubicación,Estado,Modalidad,Producto,Fecha Entrega\n' +
        '42,12/11/2026 10:00,1500,Efectivo,Centro,Entregado,Retiro,Mixto,13/11/2026'
    const online = [cabecera, fila('42', '13/11/2026 11:00', 'Delivery', 'Entregado', '2500')].join('\n')
    const fuentes = [{ origen: 'Pedidos_comunes', csv: local }, { origen: 'Pedidos_online', csv: online }]
    const filtros = { desde: '2026-11-13', hasta: '2026-11-13' }
    const ambos = calcularReportePedidosFuentes(fuentes, filtros)
    assert.equal(ambos.resumen.entregados, 2)
    assert.equal(ambos.resumen.ingresoEsperado, 4000)
    assert.equal(ambos.registros.length, 2)
    assert.deepEqual(ambos.porOrigen.map(x => x.importeEsperado).sort((a, b) => a - b), [1500, 2500])
    const soloLocal = calcularReportePedidosFuentes(fuentes, { ...filtros, origen: 'Pedidos_comunes' })
    assert.equal(soloLocal.resumen.ingresoEsperado, 1500)
})

test('el detalle muestra diez pedidos por página sin recortar los totales', () => {
    const csv = [cabecera, ...Array.from({ length: 11 }, (_, i) =>
        fila(String(i + 1), `13/11/2026 ${String(i + 8).padStart(2, '0')}:00`, 'Delivery', 'Entregado', '100'))].join('\n')
    const filtros = { desde: '2026-11-13', hasta: '2026-11-13' }
    const primera = calcularReportePedidosOnline(csv, { ...filtros, pagina: 1 })
    const segunda = calcularReportePedidosOnline(csv, { ...filtros, pagina: 2 })
    assert.equal(primera.registros.length, 10)
    assert.equal(segunda.registros.length, 1)
    assert.equal(primera.paginas, 2)
    assert.equal(primera.resumen.ingresoEsperado, 1100)
    assert.equal(segunda.resumen.ingresoEsperado, 1100)
})

test('paquetes usa presentaciones del producto y valida los sándwiches del Sheet', () => {
    assert.equal(contarPaquetesPedido('48 Jamón y Queso', '48'), 1)
    assert.equal(contarPaquetesPedido('2x 24 Jamón y Queso + 48 Surtidos Clásicos', '96'), 3)
    assert.equal(contarPaquetesPedido('48 Jamón y Queso', '24'), null)
    assert.equal(contarPaquetesPedido('#ERROR!', '8'), null)
    assert.equal(contarPaquetesPedido('48 Jamón y Queso', ''), null)
    assert.equal(contarPaquetesPedido('Personalizado x24 (3 planchas)', '24'), 1)
    assert.equal(contarPaquetesPedido('Personalizado x48 (6 planchas)', '48'), 1)
    assert.equal(contarPaquetesPedido('Personalizado x48 (3 planchas)', '48'), null)
    assert.equal(contarPaquetesPedido('Personalizado x72 (9 planchas)', '72'), null)
})

test('venta rápida con sabores en Producto cuenta planchas y usa Fecha Entrega', () => {
    const producto = '=== SABORES PERSONALIZADOS ===\n• Jamón y Queso: 1 plancha (8 sandwiches)'
    assert.deepEqual(interpretarLineasPaquetes(producto, '8'), [{ clave: '8:surtidos elegidos',
        nombre: 'Surtidos Elegidos', presentacion: 8, paquetes: 1, sandwiches: 8 }])
    assert.deepEqual(interpretarSaboresVentaRapida(producto, 8), [{ codigo: 'jyq', nombre: 'Jamon Y Queso', sandwiches: 8 }])
    assert.equal(interpretarSaboresVentaRapida(producto, 16), null)
    assert.equal(interpretarLineasPaquetes(producto, '16'), null)
    const encabezados = `${cabecera},Cantidad`
    const columna = (valor: string | number) => `"${String(valor).replace(/"/g, '""')}"`
    const linea = (id: string, entrega: string) => [id, '20/11/2026 10:45', 'Venta rápida', 'Mostrador', '123', 'Mostrador',
        producto, 'Retiro', 'Entregado', entrega, '', '12000', 'Efectivo', 'Centro', 8].map(columna).join(',')
    const csv = [encabezados, linea('36137', '21/11/2026'), linea('anterior', '20/11/2026')].join('\n')
    const r = calcularReportePedidosFuentes([{ origen: 'Pedidos_comunes', csv }], { desde: '2026-11-21', hasta: '2026-11-21' })
    assert.equal(r.resumen.paquetesVendidos, 1)
    assert.equal(r.calidad.ventasRapidasPersonalizadas, 1)
    assert.equal(r.calidad.sinPaquetes, 0)
    assert.equal(r.porTipoPaquete[0].paquetes, 1)
    assert.equal(r.porSaborElegido.find(sabor => sabor.codigo === 'jyq')?.planchas, 1)
    assert.equal(r.pedidosElegidos[0].origen, 'Pedidos_comunes')
})

test('Pedido Express anterior conserva sabores escritos en Observaciones', () => {
    const observaciones = 'Turno: Tarde === SABORES PERSONALIZADOS === • Jamón y Queso: 1 plancha (8 sándwiches) • Aceitunas: 1 plancha (8 sándwiches) 🔗 PEDIDO COMBINADO'
    assert.deepEqual(interpretarSaboresVentaRapida(observaciones, 16)?.map(sabor => sabor.codigo), ['jyq', 'ace'])
    const columna = (valor: string | number) => `"${String(valor).replace(/"/g, '""')}"`
    const csv = [`${cabecera},Cantidad`, [1, '20/11/2026 10:45', 'Venta rápida', 'Mostrador', '123', 'Mostrador',
        'Personalizado x16 (2 planchas)', 'Retiro', 'Entregado', '21/11/2026', observaciones,
        '12000', 'Efectivo', 'Centro', 16].map(columna).join(',')].join('\n')
    const r = calcularReportePedidosFuentes([{ origen: 'Pedidos_comunes', csv }], { desde: '2026-11-21', hasta: '2026-11-21' })
    assert.equal(r.resumen.paquetesVendidos, 1)
    assert.equal(r.calidad.sinSaboresElegidos, 0)
    assert.equal(r.calidad.ventasRapidasPersonalizadas, 1)
    assert.equal(r.porSaborElegido.find(sabor => sabor.codigo === 'ace')?.planchas, 1)
})

test('planchas por sabor suma Local y Online según Fecha Entrega y omite pendientes o sabores inválidos', () => {
    const columna = (valor: string | number) => `"${String(valor).replace(/"/g, '""')}"`
    const linea = (id: string, producto: string, cantidad: number, observaciones: string,
        entrega: string, estado = 'Entregado', precio = '100') => [id, '20/11/2026 10:45', 'Ana', 'Test', '123', 'Calle',
        producto, 'Retiro', estado, entrega, observaciones, precio, 'Efectivo', 'Centro', cantidad].map(columna).join(',')
    const encabezados = `${cabecera},Cantidad`
    const local = [encabezados,
        linea('local-16', '16 Surtidos Elegidos', 16, 'Sabores (16): 8x Huevo + 8x Tomate', '21/11/2026', 'Entregado', ''),
        linea('pendiente', '8 Surtidos Elegidos', 8, 'Sabores (8): 8x Tomate', '21/11/2026', 'Pendiente'),
        linea('sin-sabor', '8 Surtidos Elegidos', 8, 'Sin sabores', '21/11/2026'),
    ].join('\n')
    const online = [encabezados,
        linea('online-8', '8 Surtidos Elegidos', 8, 'Sabores (8): 8x Huevo', '21/11/2026'),
        linea('anterior', '8 Surtidos Elegidos', 8, 'Sabores (8): 8x Huevo', '20/11/2026'),
    ].join('\n')
    const fuentes = [{ origen: 'Pedidos_comunes', csv: local }, { origen: 'Pedidos_online', csv: online }]
    const actual = calcularReportePedidosFuentes(fuentes, { desde: '2026-11-21', hasta: '2026-11-21' })
    assert.equal(actual.porSaborElegido.find(sabor => sabor.codigo === 'hue')?.planchas, 2)
    assert.equal(actual.porSaborElegido.find(sabor => sabor.codigo === 'tom')?.planchas, 1)
    assert.equal(actual.porSaborElegido.reduce((total, sabor) => total + sabor.planchas, 0), 3)
    assert.equal(actual.calidad.sinSaboresElegidos, 1)
    const anterior = calcularReportePedidosFuentes(fuentes, { desde: '2026-11-20', hasta: '2026-11-20' })
    assert.equal(anterior.porSaborElegido.find(sabor => sabor.codigo === 'hue')?.planchas, 1)
})

test('compara paquetes del día elegido y dos ventanas consecutivas de siete días', () => {
    const csv = [`${cabecera},Cantidad`,
        `${fila('hoy', '13/11/2026 10:00', 'Delivery', 'Entregado', '100')},48`,
        `${fila('ayer', '12/11/2026 10:00', 'Delivery', 'Entregado', '100', 'Centro', '12/11/2026')},48`,
        `${fila('semana-pasada', '06/11/2026 10:00', 'Delivery', 'Entregado', '100', 'Centro', '06/11/2026')},48`,
        `${fila('pendiente', '13/11/2026 11:00', 'Delivery', 'Pendiente', '100')},48`,
        `${fila('error', '13/11/2026 12:00', 'Delivery', 'Entregado', '100').replace('48 Jamon y Queso', '#ERROR!')},8`,
    ].join('\n')
    const r = calcularReportePedidosOnline(csv, { desde: '2026-11-12', hasta: '2026-11-13', fechaComparacion: '2026-11-13' })
    assert.equal(r.comparacionPaquetes.actual.paquetes, 1)
    assert.equal(r.comparacionPaquetes.actual.sinClasificar, 1)
    assert.equal(r.comparacionPaquetes.semanaAnterior.paquetes, 1)
    assert.equal(r.comparacionPaquetes.ultimos7.paquetes, 2)
    assert.equal(r.comparacionPaquetes.sietePrevios.paquetes, 1)
    assert.equal(r.calidad.sinPaquetes, 1)
    assert.deepEqual(r.porDia.map(x => x.paquetes), [1, 1])
})

test('filtros, ingresos y paquetes usan Fecha Entrega aunque el registro sea otro día', () => {
    const csv = [`${cabecera},Cantidad`,
        `${fila('entrega-hoy', 'fecha de registro inválida', 'Delivery', 'Entregado', '1000', 'Centro', '13/11/2026')},48`,
        `${fila('entrega-mañana', '13/11/2026 10:00', 'Delivery', 'Entregado', '2000', 'Centro', '14/11/2026')},48`,
        `${fila('entrega-previa', '13/11/2026 11:00', 'Delivery', 'Entregado', '3000', 'Centro', '06/11/2026')},48`,
    ].join('\n')
    const r = calcularReportePedidosOnline(csv, { desde: '2026-11-13', hasta: '2026-11-13', fechaComparacion: '2026-11-13' })
    assert.equal(r.totalFilas, 1)
    assert.equal(r.registros[0].id, 'entrega-hoy')
    assert.equal(r.resumen.ingresoEsperado, 1000)
    assert.equal(r.resumen.paquetesVendidos, 1)
    assert.equal(r.comparacionPaquetes.actual.paquetes, 1)
    assert.equal(r.comparacionPaquetes.semanaAnterior.paquetes, 1)
    assert.equal(r.porDia[0].fecha, '2026-11-13')
})

test('Fecha Entrega se valida como día local sin corrimiento UTC', () => {
    assert.equal(fechaEntregaIso('13/11/2026'), '2026-11-13')
    assert.equal(fechaEntregaIso('13/11/2026 09:30'), '2026-11-13')
    assert.equal(fechaEntregaIso('2026-11-13'), '2026-11-13')
    assert.equal(fechaEntregaIso('31/02/2026'), null)
    assert.equal(fechaEntregaIso(''), null)
})

test('distribuye el precio mixto en centavos por sándwich sin perder importe', () => {
    const lineas = interpretarLineasPaquetes('24 Jamón y Queso + 48 Surtidos Clásicos', '72')
    assert.ok(lineas)
    assert.deepEqual(distribuirImportePaquetes(lineas, 10001), [3334, 6667])
    assert.equal(distribuirImportePaquetes(lineas, 10001).reduce((a, b) => a + b, 0), 10001)
})

test('desglosa paquetes e ingreso atribuido por producto y presentación', () => {
    const encabezados = `${cabecera},Cantidad`
    const linea = (id: string, producto: string, cantidad: string, precio: string, entrega = '13/11/2026', estado = 'Entregado') =>
        `${fila(id, '12/11/2026 10:00', 'Delivery', estado, precio, 'Centro', entrega).replace('48 Jamon y Queso', producto)},${cantidad}`
    const csv = [encabezados,
        linea('mixto', '24 Jamón y Queso + 48 Surtidos Clásicos', '72', '100.01'),
        linea('dos', '2x 24 Jamón y Queso', '48', '80'),
        linea('error', '#ERROR!', '8', '25'),
        linea('sin-precio', '48 Jamón y Queso', '48', ''),
        linea('pendiente', '48 Jamón y Queso', '48', '200', '13/11/2026', 'Pendiente'),
        linea('previo', '48 Surtidos Clásicos', '48', '60', '12/11/2026'),
    ].join('\n')
    const r = calcularReportePedidosOnline(csv, { desde: '2026-11-13', hasta: '2026-11-13' })
    assert.equal(r.resumen.paquetesVendidos, 5)
    assert.equal(r.resumen.ingresoEsperado, 205.01)
    assert.equal(r.resumen.ingresoAtribuidoPaquetes, 180.01)
    assert.equal(r.resumen.ingresoSinAsignarPaquetes, 25)
    const jq24 = r.porTipoPaquete.find(x => x.nombre === 'Jamón y Queso' && x.presentacion === 24)
    const clasicos48 = r.porTipoPaquete.find(x => x.nombre === 'Surtidos Clásicos' && x.presentacion === 48)
    const jq48 = r.porTipoPaquete.find(x => x.nombre === 'Jamón y Queso' && x.presentacion === 48)
    assert.equal(jq24?.paquetes, 3)
    assert.equal(jq24?.ingresoAtribuido, 113.34)
    assert.equal(clasicos48?.ingresoAtribuido, 66.67)
    assert.equal(clasicos48?.paquetesAnteriores, 1)
    assert.equal(clasicos48?.ingresoAnterior, 60)
    assert.equal(jq48?.paquetes, 1)
    assert.equal(jq48?.precioPromedioPaquete, null)
    assert.equal(r.calidad.sinPaquetes, 1)
})
