import assert from 'node:assert/strict'
import test from 'node:test'
import { calcularReporteRepartos } from './repartos-sheet'

const encabezado = 'ID;Fecha/Hora;Nombre;Dirección;Precio;Pago;Modalidad;Ubicación;Estado;Fecha Entrega;Observaciones;Chofer'
const filtros = { desde: '2026-11-25', hasta: '2026-11-26' }

test('agrupa ingresos esperados por chofer, fecha y turno sin mezclar retiros ni pedidos pendientes', () => {
    const csv = [encabezado,
        '1;25/11/2026 10:00;Ana;Calle 1;12000;Efectivo;Delivery;Local 1;Entregado;26/11/2026;Turno: Mañana;Juan',
        '2;25/11/2026 11:00;Bea;Calle 2;8000;Transferencia;Delivery;Local 1;Entregado;26/11/2026;Turno: Mañana;Juan',
        '3;25/11/2026 12:00;Cora;Calle 3;5000;Efectivo;Retiro;Local 1;Entregado;26/11/2026;Turno: Mañana;Juan',
        '4;25/11/2026 13:00;Dora;Calle 4;7000;Efectivo;Delivery;Local 1;Pendiente;26/11/2026;Turno: Tarde;Luis',
    ].join('\n')
    const reporte = calcularReporteRepartos([{ origen: 'Pedidos_comunes', csv }], filtros)
    assert.equal(reporte.totalPedidos, 2)
    assert.equal(reporte.ingresoAsignado, 20000)
    assert.deepEqual(reporte.porChofer.map(x => [x.chofer, x.ingresoEsperado]), [['Juan', 20000]])
    assert.deepEqual(reporte.porChoferDiaTurno.map(x => [x.fecha, x.turno, x.chofer, x.pedidos, x.efectivo, x.transferencia]),
        [['2026-11-26', 'Mañana', 'Juan', 2, 12000, 8000]])
})

test('deja el ingreso sin chofer separado y excluye IDs financieros en conflicto', () => {
    const csv = ['ID;Fecha/Hora;Nombre;Precio;Pago;Modalidad;Ubicación;Estado;Fecha Entrega;Observaciones',
        '1;25/11/2026 10:00;Ana;10000;Efectivo;Delivery;Local 1;Entregado;26/11/2026;Turno: Siesta',
        '2;25/11/2026 10:00;Bea;20000;Efectivo;Delivery;Local 1;Entregado;26/11/2026;Turno: Siesta',
        '2;25/11/2026 10:00;Bea;21000;Efectivo;Delivery;Local 1;Entregado;26/11/2026;Turno: Siesta',
    ].join('\n')
    const reporte = calcularReporteRepartos([{ origen: 'Pedidos_online', csv }], filtros)
    assert.equal(reporte.tieneColumnaChofer, false)
    assert.equal(reporte.ingresoSinChofer, 10000)
    assert.equal(reporte.ingresoAsignado, 0)
    assert.equal(reporte.calidad.conflictos, 1)
    assert.equal(calcularReporteRepartos([{ origen: 'Pedidos_online', csv }], { ...filtros, chofer: 'Sin chofer' }).ingresoSinChofer, 10000)
})

test('un ID con dos choferes distintos no atribuye dinero a ninguno', () => {
    const csv = [encabezado,
        '1;25/11/2026 10:00;Ana;Calle 1;12000;Efectivo;Delivery;Local 1;Entregado;26/11/2026;Turno: Mañana;Juan',
        '1;25/11/2026 10:00;Ana;Calle 1;12000;Efectivo;Delivery;Local 1;Entregado;26/11/2026;Turno: Mañana;Luis',
    ].join('\n')
    const reporte = calcularReporteRepartos([{ origen: 'Pedidos_comunes', csv }], filtros)
    assert.equal(reporte.ingresoAsignado, 0)
    assert.equal(reporte.calidad.conflictos, 1)
})
