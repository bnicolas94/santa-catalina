import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calcularReportePedidosFuentes, calcularReportePedidosOnline, contarPaquetesPedido, fechaEntregaIso, validarFiltrosPedidosOnline } from './pedidos-online'

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
