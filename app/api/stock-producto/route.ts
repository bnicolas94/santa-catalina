import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/stock-producto
// Retorna el stock actual de todos los productos agrupados por ubicación
export async function GET() {
    try {
        const stocks = await prisma.stockProducto.findMany({
            include: {
                producto: {
                    select: {
                        id: true,
                        nombre: true,
                        codigoInterno: true,
                        planchasPorPaquete: true,
                    },
                },
                presentacion: {
                    select: {
                        id: true,
                        cantidad: true,
                        stockMinimo: true,
                    }
                },
                ubicacion: true
            },
            orderBy: [{ producto: { nombre: 'asc' } }, { presentacion: { cantidad: 'desc' } }],
        })

        // Agrupar por producto y presentación para UI
        const agrupado: Record<string, {
            productoId: string
            presentacionId: string
            nombre: string
            codigoInterno: string
            planchasPorPaquete: number
            cantidadPresentacion: number
            fabrica: number // Suma de lo que es tipo FABRICA
            local: number   // Suma de lo que es tipo LOCAL
            stockMinimo: number
            ubicaciones: Record<string, number> // nombre -> cantidad
        }> = {}

        for (const s of stocks) {
            const key = `${s.productoId}_${s.presentacionId}`
            if (!agrupado[key]) {
                agrupado[key] = {
                    productoId: s.productoId,
                    presentacionId: s.presentacionId,
                    nombre: s.producto.nombre,
                    codigoInterno: s.producto.codigoInterno,
                    planchasPorPaquete: s.producto.planchasPorPaquete,
                    cantidadPresentacion: s.presentacion.cantidad,
                    fabrica: 0,
                    local: 0,
                    stockMinimo: s.presentacion.stockMinimo || 0,
                    ubicaciones: {}
                }
            }

            // Guardar el stock por nombre de ubicación
            agrupado[key].ubicaciones[s.ubicacion.nombre] = s.cantidad

            // Para compatibilidad con el dashboard actual (que espera 'fabrica' y 'local')
            if (s.ubicacion.tipo === 'FABRICA') agrupado[key].fabrica += s.cantidad
            if (s.ubicacion.tipo === 'LOCAL') agrupado[key].local += s.cantidad
        }

        return NextResponse.json(Object.values(agrupado))
    } catch (error) {
        console.error('Error fetching stock producto:', error)
        return NextResponse.json({ error: 'Error al obtener stock de productos' }, { status: 500 })
    }
}
