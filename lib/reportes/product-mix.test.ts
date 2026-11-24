import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calcularReportePedidosOnline } from './pedidos-online'
import { calcularProductMix } from './product-mix'
import type { ProductoConReceta } from './consumo-pedidos'

const cabecera = 'ID,Fecha/Hora,Nombre,Apellido,Telefono,Direccion,Producto,Modalidad,Estado,Fecha Entrega,Observaciones,Precio,Pago,Ubicacion,Cantidad'
const fila = (id: string, producto: string, sandwiches: number, precio: string, observaciones = '', entrega = '13/11/2026') =>
    `${id},12/11/2026 10:00,Ana,Test,123,Calle,"${producto}",Delivery,Entregado,${entrega},"${observaciones}",${precio},Efectivo,Centro,${sandwiches}`
const insumo = (nombre: string, unidadMedida: string, precioUnitario: number) => ({ nombre, unidadMedida, precioUnitario })

test('Product Mix suma insumos por producto y total del período según Fecha Entrega', () => {
    const csv = [cabecera,
        fila('1', '24 Jamón y Queso', 24, '100'),
        fila('2', '16 Surtidos Elegidos', 16, '160', 'Sabores (16): 8x Huevo + 8x Tomate'),
        fila('3', '16 Surtidos Elegidos', 16, '160', 'Sabores (16): 16x Huevo', '12/11/2026'),
    ].join('\n')
    const reporte = { ...calcularReportePedidosOnline(csv, { desde: '2026-11-13', hasta: '2026-11-13' }), actualizado: '' }
    const productos: ProductoConReceta[] = [
        { id: 'jq', nombre: 'Jamón y Queso', codigoInterno: 'JQ', presentaciones: [{ id: 'jq24', cantidad: 24 }],
            fichasTecnicas: [
                { insumoId: 'pan', cantidadPorUnidad: .05, merma: 0, tipoConsumo: 'por_unidad', presentacionId: null,
                    insumo: insumo('Pan', 'kg', 100) },
                { insumoId: 'mayo', cantidadPorUnidad: .01, merma: 0, tipoConsumo: 'por_unidad', presentacionId: null,
                    insumo: insumo('Mayonesa', 'kg', 200) },
                { insumoId: 'caja', cantidadPorUnidad: 1, merma: 0, tipoConsumo: 'por_paquete', presentacionId: 'jq24',
                    insumo: insumo('Caja', 'u', 5) },
            ] },
        { id: 'ele', nombre: 'Elegidos', codigoInterno: 'ELE', presentaciones: [{ id: 'ele16', cantidad: 16 }],
            fichasTecnicas: [], recetasElegidos: [
                { alcance: 'sabor', cantidad: .08, merma: 0, insumoId: 'mayo', variante: { codigo: 'hue' },
                    presentacion: null, insumo: insumo('Mayonesa', 'kg', 200) },
                { alcance: 'sabor', cantidad: .02, merma: 0, insumoId: 'mayo', variante: { codigo: 'tom' },
                    presentacion: null, insumo: insumo('Mayonesa', 'kg', 200) },
                { alcance: 'sabor', cantidad: .5, merma: 0, insumoId: 'tomate', variante: { codigo: 'tom' },
                    presentacion: null, insumo: insumo('Tomate', 'kg', 50) },
                { alcance: 'empaque', cantidad: 1, merma: 0, insumoId: 'caja', variante: null,
                    presentacion: { cantidad: 16 }, insumo: insumo('Caja', 'u', 5) },
            ] },
    ]
    const mix = calcularProductMix(reporte, productos)
    assert.equal(mix.paquetes, 2)
    assert.equal(mix.filasIncompletas, 0)
    assert.equal(mix.filas.find(f => f.nombre === 'Surtidos Elegidos')?.ingresoAtribuido, 160)
    assert.equal(mix.filas.find(f => f.nombre === 'Surtidos Elegidos')?.insumos.find(i => i.id === 'mayo')?.cantidad, .1)
    assert.equal(mix.totales.find(i => i.id === 'mayo')?.cantidad, .34)
    assert.equal(mix.totales.find(i => i.id === 'caja')?.cantidad, 2)
    assert.equal(mix.totales.find(i => i.id === 'pan')?.cantidad, 1.2)
    assert.equal(mix.totales.find(i => i.id === 'tomate')?.cantidad, .5)
})

test('Product Mix muestra consumo parcial aunque falten empaque y precio', () => {
    const csv = [cabecera, fila('1', '8 Surtidos Elegidos', 8, '100', 'Sabores (8): 8x Huevo')].join('\n')
    const reporte = { ...calcularReportePedidosOnline(csv, { desde: '2026-11-13', hasta: '2026-11-13' }), actualizado: '' }
    const productos: ProductoConReceta[] = [{ id: 'ele', nombre: 'Elegidos', codigoInterno: 'ELE',
        presentaciones: [{ id: 'ele8', cantidad: 8 }], fichasTecnicas: [], recetasElegidos: [
            { alcance: 'sabor', cantidad: .08, merma: 0, insumoId: 'mayo', variante: { codigo: 'hue' },
                presentacion: null, insumo: insumo('Mayonesa', 'kg', 0) },
        ] }]
    const mix = calcularProductMix(reporte, productos)
    assert.equal(mix.paquetes, 1)
    assert.equal(mix.totales[0].cantidad, .08)
    assert.equal(mix.totales[0].costoIdentificado, null)
    assert.deepEqual(mix.filas[0].faltantes, ['Sin precio: Mayonesa', 'Falta empaque x8'])
    assert.equal(mix.filasIncompletas, 1)
})
