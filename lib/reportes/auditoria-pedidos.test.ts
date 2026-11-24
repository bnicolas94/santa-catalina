import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calcularReportePedidosFuentes } from './pedidos-online'
import { calcularConsumoPedidos, type ProductoConReceta } from './consumo-pedidos'
import { calcularAuditoriaPedidos } from './auditoria-pedidos'

const cabecera = 'ID,Fecha/Hora,Nombre,Apellido,Telefono,Direccion,Producto,Modalidad,Estado,Fecha Entrega,Observaciones,Precio,Pago,Ubicacion,Cantidad'
const columna = (valor: string | number) => `"${String(valor).replace(/"/g, '""')}"`
const fila = (id: string, producto: string, cantidad: number, precio: string, entrega = '13/11/2026', observaciones = '') =>
    [id, '12/11/2026 10:00', 'Ana', 'Test', '123', 'Calle', producto, 'Retiro', 'Entregado',
        entrega, observaciones, precio, 'Efectivo', 'Centro', cantidad].map(columna).join(',')

test('audita cada ID pendiente sin incluir pedidos completos ni confundir orígenes', () => {
    const local = [cabecera,
        fila('1', '24 Jamón y Queso', 24, '100'),
        fila('2', '#ERROR!', 8, '50'),
        fila('3', '8 Surtidos Elegidos', 8, '80', '13/11/2026', 'Sabores (8): 8x Huevo'),
        fila('4', '24 Jamón y Queso', 24, ''),
        fila('5', '24 Jamón y Queso', 24, '90', ''),
        fila('6', '24 Jamón y Queso', 24, '90'),
        fila('6', '24 Jamón y Queso', 24, '90'),
    ].join('\n')
    const online = [cabecera, fila('2', '24 Jamón y Queso', 24, '110')].join('\n')
    const reporte = { ...calcularReportePedidosFuentes([
        { origen: 'Pedidos_comunes', csv: local }, { origen: 'Pedidos_online', csv: online },
    ], { desde: '2026-11-13', hasta: '2026-11-13', todos: true, auditar: true }), actualizado: '' }
    const productos: ProductoConReceta[] = [{ id: 'jq', nombre: 'Jamón y Queso', codigoInterno: 'JQ',
        presentaciones: [{ id: 'jq24', cantidad: 24 }], fichasTecnicas: [{ insumoId: 'pan',
            cantidadPorUnidad: .1, merma: 0, tipoConsumo: 'por_unidad', presentacionId: null,
            insumo: { nombre: 'Pan', unidadMedida: 'kg', precioUnitario: 10 } }] }]
    const auditoria = calcularAuditoriaPedidos(reporte, calcularConsumoPedidos(reporte, productos))
    assert.equal(auditoria.pedidosUnicos, 5)
    assert.equal(auditoria.incidencias.length, 6)
    assert.deepEqual(auditoria.incidencias.filter(item => item.id === '1'), [])
    assert.deepEqual(auditoria.incidencias.filter(item => item.origen === 'Pedidos_online'), [])
    assert.equal(auditoria.incidencias.find(item => item.id === '2')?.impacto, 'sin_paquetes')
    assert.equal(auditoria.incidencias.find(item => item.id === '2')?.motivo, 'Producto contiene un error del Sheet')
    assert.deepEqual(auditoria.incidencias.filter(item => item.id === '3').map(item => item.motivo).sort(),
        ['Falta receta de empaque x8', 'Falta receta de sabor Huevo'])
    assert.equal(auditoria.incidencias.find(item => item.id === '4')?.impacto, 'sin_ingreso')
    assert.equal(auditoria.incidencias.find(item => item.id === '5')?.fechaEntrega, '')
    assert.equal(auditoria.incidencias.find(item => item.id === '5')?.impacto, 'fuera_del_periodo')
    assert.equal(auditoria.incidencias.find(item => item.id === '6')?.impacto, 'datos_ambiguos')
    assert.equal(auditoria.motivos.find(item => item.motivo === 'Falta receta de sabor Huevo')?.pedidos, 1)
})

test('identifica el pedido cuyo paquete existe en Sheet pero no tiene receta en ERP', () => {
    const csv = [cabecera, fila('7', '48 Surtidos Especiales', 48, '200')].join('\n')
    const reporte = { ...calcularReportePedidosFuentes([{ origen: 'Pedidos_online', csv }],
        { desde: '2026-11-13', hasta: '2026-11-13', todos: true, auditar: true }), actualizado: '' }
    const consumo = calcularConsumoPedidos(reporte, [])
    const auditoria = calcularAuditoriaPedidos(reporte, consumo)
    assert.equal(reporte.resumen.paquetesVendidos, 1)
    assert.deepEqual(auditoria.incidencias.map(item => ({ id: item.id, impacto: item.impacto, motivo: item.motivo })),
        [{ id: '7', impacto: 'sin_costo', motivo: 'Surtidos Especiales x48: Sin producto inequívoco en ERP' }])
})
