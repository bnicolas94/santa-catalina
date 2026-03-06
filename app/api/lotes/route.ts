import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/lotes
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        const userRol = (session?.user as any)?.rol
        const permisos = (session?.user as any)?.permisos || {}

        if (userRol !== 'ADMIN' && !permisos.permisoProduccion) {
            return NextResponse.json({ error: 'No tienes permiso para ver producción' }, { status: 403 })
        }
        const lotes = await prisma.lote.findMany({
            orderBy: { fechaProduccion: 'desc' },
            include: {
                producto: { include: { presentaciones: true } },
                coordinador: { select: { id: true, nombre: true } },
                ubicacion: { select: { id: true, nombre: true } },
                _count: { select: { detallePedidos: true } },
                movimientosProducto: {
                    where: { tipo: 'produccion', signo: 'entrada' },
                    select: { presentacionId: true, cantidad: true }
                }
            },
        })
        return NextResponse.json(lotes)
    } catch (error) {
        console.error('Error fetching lotes:', error)
        return NextResponse.json({ error: 'Error al obtener lotes' }, { status: 500 })
    }
}

// POST /api/lotes
export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        const userRol = (session?.user as any)?.rol
        const permisos = (session?.user as any)?.permisos || {}

        if (userRol !== 'ADMIN' && !permisos.permisoProduccion) {
            return NextResponse.json({ error: 'No tienes permiso para registrar producción' }, { status: 403 })
        }

        const body = await request.json()
        const { productoId, fechaProduccion, unidadesProducidas, empleadosRonda, coordinadorId, estado, ubicacionId } = body

        if (!productoId || !fechaProduccion || !unidadesProducidas || !ubicacionId) {
            return NextResponse.json({ error: 'Producto, fecha, unidades y ubicación son requeridos' }, { status: 400 })
        }

        // Generar ID de lote: SC-YYYYMMDD-COD-NN
        const fecha = new Date(fechaProduccion)
        const yyyymmdd = fecha.toISOString().slice(0, 10).replace(/-/g, '')

        const producto = await prisma.producto.findUnique({ where: { id: productoId } })
        if (!producto) {
            return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
        }

        // Contar lotes del día para ese producto
        const startOfDay = new Date(fecha)
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(fecha)
        endOfDay.setHours(23, 59, 59, 999)

        const countHoy = await prisma.lote.count({
            where: {
                productoId,
                fechaProduccion: { gte: startOfDay, lte: endOfDay },
            },
        })

        const loteId = `SC-${yyyymmdd}-${producto.codigoInterno}-${String(countHoy + 1).padStart(2, '0')}`

        // Receta para descontar stock (usar transacción)
        const fichasT = await prisma.fichaTecnica.findMany({
            where: { productoId }
        })
        // La ficha técnica normalmente detalla la cantidad por PLANCHA o por SÁNDWICH?
        // En la UI de producto dice "Cantidad por sándwich" que es lo mismo que por paquete (x1).
        // En realidad la UI de Producto[id] dice: `addInsumoToFicha`
        // Y en el form dice "Cantidad por sándwich/unidad", es decir por 1 paquete de x1.
        // Pero en la base de datos `unidadesProducidas` son "paquetes".
        // Entonces Insumo Descontado = (CantidadPorUnidad en ficha) * unidadesProducidas * planchasPorPaquete ?? 
        // Asumamos que `cantidadPorUnidad` es literalmente por PAQUETE para simplificar, o miremos UI. 
        // La UI decía `const cdi = producto.fichasTecnicas.reduce((acc, f) => acc + f.cantidadPorUnidad * f.insumo.precioUnitario, 0)`.
        // Como ese es el CDI, significa que `cantidadPorUnidad` es la cantidad DE INSUMO por 1 PAQUETE de producto. 

        const qtyPaquetes = parseInt(unidadesProducidas)

        const lote = await prisma.$transaction(async (tx) => {
            const nuevoLote = await tx.lote.create({
                data: {
                    id: loteId,
                    fechaProduccion: fecha,
                    horaInicio: new Date(),
                    unidadesProducidas: qtyPaquetes,
                    empleadosRonda: parseInt(empleadosRonda) || 1,
                    estado: estado || 'en_camara',
                    productoId,
                    coordinadorId: coordinadorId || null,
                    ubicacionId,
                },
                include: {
                    producto: true,
                    coordinador: { select: { id: true, nombre: true } },
                },
            })

            // Descontar insumos
            if (fichasT.length > 0) {
                const movimientosData = fichasT.map(f => ({
                    insumoId: f.insumoId,
                    tipo: 'salida',
                    cantidad: f.cantidadPorUnidad * qtyPaquetes,
                    observaciones: `Consumo automático por Lote ${loteId}`,
                    loteOrigenId: loteId
                }))

                await tx.movimientoStock.createMany({
                    data: movimientosData
                })

                // Actualizar saldos de los insumos
                for (const f of fichasT) {
                    await tx.insumo.update({
                        where: { id: f.insumoId },
                        data: {
                            stockActual: {
                                decrement: f.cantidadPorUnidad * qtyPaquetes
                            }
                        }
                    })
                }
            }

            // Sumar producto terminado al stock de fábrica SOLO si ya está terminado
            const estadoInicial = estado || 'en_camara'
            if (estadoInicial !== 'en_produccion') {
                // By default, use the largest presentacion available for this product
                const presentacion = await tx.presentacion.findFirst({
                    where: { productoId },
                    orderBy: { cantidad: 'desc' }
                })

                if (presentacion) {
                    await tx.stockProducto.upsert({
                        where: { productoId_presentacionId_ubicacionId: { productoId, presentacionId: presentacion.id, ubicacionId } },
                        create: { productoId, presentacionId: presentacion.id, ubicacionId, cantidad: qtyPaquetes },
                        update: { cantidad: { increment: qtyPaquetes } },
                    })

                    // Registrar movimiento de producto terminado
                    await tx.movimientoProducto.create({
                        data: {
                            productoId,
                            presentacionId: presentacion.id,
                            tipo: 'produccion',
                            cantidad: qtyPaquetes,
                            ubicacionId,
                            signo: 'entrada',
                            observaciones: `Producción Lote ${loteId}`,
                            loteId,
                        },
                    })
                }
            }

            return nuevoLote
        })

        return NextResponse.json(lote, { status: 201 })
    } catch (error) {
        console.error('Error creating lote:', error)
        return NextResponse.json({ error: 'Error al crear lote' }, { status: 500 })
    }
}
