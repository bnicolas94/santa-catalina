import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calcularReportePedidosOnline } from './pedidos-online'
import { calcularProductMix } from './product-mix'
import { diasPersonalizadosEntreConteos, resumirPersonalizadosParaConteo } from './conciliacion-personalizados'
import type { ProductoConReceta } from './consumo-pedidos'

const cabecera = 'ID,Fecha/Hora,Nombre,Apellido,Telefono,Direccion,Producto,Modalidad,Estado,Fecha Entrega,Observaciones,Precio,Pago,Ubicacion,Cantidad'
const fila = (id: string, producto: string, cantidad: number, observaciones: string) =>
    `${id},12/11/2026 10:00,Ana,Test,123,Calle,"${producto}",Delivery,Entregado,13/11/2026,"${observaciones}",100,Efectivo,Centro,${cantidad}`
const insumo = (nombre: string, unidadMedida: string, precioUnitario: number) => ({ nombre, unidadMedida, precioUnitario })

test('cuenta sólo personalizados entregados, incluidos sabores y empaque, aunque un insumo no tenga precio', () => {
    const csv = [cabecera,
        fila('1', '8 Surtidos Elegidos', 8, 'Sabores (8): 8x Huevo'),
        fila('2', '24 Jamón y Queso', 24, ''),
        fila('3', '8 Surtidos Elegidos', 8, 'Sabores (8): 8x Huevo').replace(',Entregado,', ',Cancelado,'),
    ].join('\n')
    const reporte = { ...calcularReportePedidosOnline(csv, { desde: '2026-11-13', hasta: '2026-11-13' }), actualizado: '' }
    const productos: ProductoConReceta[] = [{ id: 'ele', nombre: 'Elegidos', codigoInterno: 'ELE',
        presentaciones: [{ id: 'ele8', cantidad: 8 }], fichasTecnicas: [], recetasElegidos: [
            { alcance: 'sabor', cantidad: .08, merma: 0, insumoId: 'mayo', variante: { codigo: 'hue' },
                presentacion: null, insumo: insumo('Mayonesa', 'kg', 0) },
            { alcance: 'empaque', cantidad: 1, merma: 0, insumoId: 'caja', variante: null,
                presentacion: { cantidad: 8 }, insumo: insumo('Caja', 'u', 5) },
        ] }]
    const resumen = resumirPersonalizadosParaConteo(reporte, calcularProductMix(reporte, productos))
    assert.equal(resumen.pedidos, 1)
    assert.equal(resumen.paquetes, 1)
    assert.deepEqual(resumen.insumos.map(i => [i.id, i.cantidad]), [['caja', 1], ['mayo', .08]])
    assert.equal(resumen.filasPendientes, 0)
})

test('asigna pedidos desde el día siguiente al conteo inicial hasta el día del final', () => {
    assert.deepEqual(diasPersonalizadosEntreConteos(
        new Date('2026-11-12T19:00:00Z'), new Date('2026-11-14T20:00:00Z')),
    { desde: '2026-11-13', hasta: '2026-11-14' })
    assert.equal(diasPersonalizadosEntreConteos(
        new Date('2026-11-12T12:00:00Z'), new Date('2026-11-12T20:00:00Z')), null)
})
