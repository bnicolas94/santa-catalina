import assert from 'node:assert/strict'
import test from 'node:test'
import { convertirPedidoOnline, esDelivery, estaCancelado, parsearCsvPedidosOnline } from './pedidos-online-excel'

const encabezados = 'ID,Fecha/Hora,Nombre,Apellido,Teléfono,Dirección,Producto,Cantidad,Precio,Pago,Modalidad,Ubicación,Estado,Fecha Entrega,Observaciones'
const fila = (estado = 'Pendiente') => `123,11/11/2026 10:30,Ana,Pérez,1122334455,Calle 123,"1x 48 Jamón y Queso + 1x 48 Surtidos Clásicos + 8 Surtidos Elegidos",3,0,Efectivo,Delivery,Local 1,${estado},14/11/2026,"🌐 PEDIDO ONLINE\nTurno: Mañana\nRetira en: Local 1\n\n🎨 Pedido Personalizado\nSabores (8): 8x Zanahoria y Huevo"`

test('traduce un pedido mixto y cuenta planchas sin duplicar los elegidos', () => {
    const [origen] = parsearCsvPedidosOnline(`${encabezados}\n${fila()}`)
    assert.equal(esDelivery(origen), true)
    const { pedido, error } = convertirPedidoOnline(origen)
    assert.equal(error, null)
    assert.deepEqual(pedido, {
        fecha: '2026-11-11', nombre: 'Ana Pérez', pedido: '48jyq 48clasicos 8zyh',
        cantidad: 13, calle: 'Calle 123', telefono: '1122334455', horario: 'Mañana', entrega: '2026-11-14',
    })
})

test('lee la primera de dos columnas Observaciones con el mismo encabezado', () => {
    const [origen] = parsearCsvPedidosOnline(`${encabezados},Observaciones\n${fila()},`)
    assert.match(origen.observaciones, /Turno: Mañana/)
    assert.match(origen.observaciones, /Sabores \(8\): 8x Zanahoria y Huevo/)
    assert.equal(convertirPedidoOnline(origen).error, null)
})

test('traduce Jamón Crudo dentro de los sabores elegidos', () => {
    const csv = fila()
        .replace('1x 48 Jamón y Queso + 1x 48 Surtidos Clásicos + 8 Surtidos Elegidos', '1x 48 Surtidos Especiales + 48 Surtidos Elegidos')
        .replace('Sabores (8): 8x Zanahoria y Huevo', 'Sabores (48): 8x Salame, 8x Ananá, 8x Jamón Crudo, 8x Palmito, 8x Pollo, 8x Roquefort')
    const [origen] = parsearCsvPedidosOnline(`${encabezados},Observaciones\n${csv},`)
    const { pedido, error } = convertirPedidoOnline(origen)
    assert.equal(error, null)
    assert.equal(pedido?.pedido, '48esp 8salame 8anana 8crudo 8palmito 8pollo 8roque')
    assert.equal(pedido?.cantidad, 12)
})

test('detecta cancelación y no toma un ID duplicado', () => {
    const [normal] = parsearCsvPedidosOnline(`${encabezados}\n${fila()}`)
    const [cancelado] = parsearCsvPedidosOnline(`${encabezados}\n${fila('Cancelado')}`)
    assert.equal(estaCancelado(cancelado), true)
    const [duplicado] = parsearCsvPedidosOnline(`${encabezados}\n${fila()}\n${fila()}`)
    assert.equal(duplicado.duplicado, true)
    assert.notEqual(duplicado.huella, normal.huella)
    assert.match(convertirPedidoOnline(duplicado).error || '', /duplicado/)
})

test('rechaza sabores que no completan la cantidad elegida', () => {
    const [origen] = parsearCsvPedidosOnline(`${encabezados}\n${fila().replace('Sabores (8): 8x Zanahoria y Huevo', 'Sabores (8): 8x Tomate + 8x Huevo')}`)
    assert.match(convertirPedidoOnline(origen).error || '', /sabores elegidos/)
})
