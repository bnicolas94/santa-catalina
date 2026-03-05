import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/reportes/rentabilidad
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const mesParam = searchParams.get('mes')
        const anioParam = searchParams.get('anio')

        const date = new Date()
        const anio = anioParam ? parseInt(anioParam) : date.getFullYear()
        const mes = mesParam ? parseInt(mesParam) : date.getMonth() + 1

        const startOfMonth = new Date(anio, mes - 1, 1)
        const endOfMonth = new Date(anio, mes, 0, 23, 59, 59, 999)

        // 1. Obtener Ingresos: Pedidos en estado 'entregado'
        const pedidos = await prisma.pedido.findMany({
            where: {
                estado: 'entregado',
                fechaEntrega: { gte: startOfMonth, lte: endOfMonth }
            },
            include: {
                detalles: {
                    include: {
                        presentacion: {
                            include: {
                                producto: {
                                    include: { fichasTecnicas: { include: { insumo: true } } }
                                }
                            }
                        }
                    }
                }
            }
        })

        let ingresosTotales = 0
        let costoMercaderiaVendida = 0

        // 2. Calcular Ingresos y CMV (Costo Directo por Ficha Técnica * unidades vendidas)
        for (const ped of pedidos) {
            ingresosTotales += ped.totalImporte

            for (const det of ped.detalles) {
                // det.cantidad = paquetes
                // det.presentacion.cantidad = unidades por paquete
                // El CDI ya asume que 'cantidadPorUnidad' es el insumo por paquete (x1). 
                // Pero ojo, presentacion.cantidad = 48 implica que si piden 1 de "x48", la Fichatecnica ¿es por sandwich o por plancha?
                // Según logica anterior de lote, 'unidadesProducidas' = cajas/paquetes.
                // Asumiremos CDI (Costo Directo Unitario) a nivel Producto base, y lo multiplicaremos por la cantidad total de sándwiches en la presentacion.
                // Si la fichaT dice: "cantidad por unidad" = insumo por sándwich individual.

                let costoPorSandwich = 0
                for (const ft of det.presentacion.producto.fichasTecnicas) {
                    costoPorSandwich += ft.cantidadPorUnidad * (ft.insumo.precioUnitario || 0)
                }

                // Si la cantidadPorUnidad ya es por "paquete de 1 sandwich", entonces:
                // Costo total de esta linea = costoPorSandwich * (presentacion.cantidad) * det.cantidad
                costoMercaderiaVendida += costoPorSandwich * det.presentacion.cantidad * det.cantidad
            }
        }

        const margenBruto = ingresosTotales - costoMercaderiaVendida

        // 3. Gastos Operativos (Costos Fijos)
        const gastos = await prisma.gastoOperativo.findMany({
            where: {
                fecha: { gte: startOfMonth, lte: endOfMonth }
            },
            include: { categoria: true }
        })

        const totalGastos = gastos
            .filter((g) => g.categoria.nombre !== 'Proveedores')
            .reduce((acc: number, g: { monto: number }) => acc + g.monto, 0)

        // 4. Rentabilidad Neta
        const rentabilidadNeta = margenBruto - totalGastos

        // Agrupar gastos por categoría para el gráfico (excluyendo Proveedores)
        const gastosPorCategoria: Record<string, number> = {}
        for (const g of gastos) {
            const catName = g.categoria.nombre
            if (catName !== 'Proveedores') {
                gastosPorCategoria[catName] = (gastosPorCategoria[catName] || 0) + g.monto
            }
        }

        return NextResponse.json({
            mes,
            anio,
            ingresosTotales,
            costoMercaderiaVendida,
            margenBruto,
            totalGastos,
            rentabilidadNeta,
            gastosPorCategoria,
            margenEbitda: ingresosTotales > 0 ? (rentabilidadNeta / ingresosTotales) * 100 : 0
        })

    } catch (error) {
        console.error('Error calculando rentabilidad:', error)
        return NextResponse.json({ error: 'Error calculando reporte' }, { status: 500 })
    }
}
