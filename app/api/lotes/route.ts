// VERSION_IDENTIFIER: 2026-03-13_V3_CLEAN
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

        // Operaciones de fecha únicas
        const [year, month, day] = fechaProduccion.split('-').map(Number)
        const fecha = new Date(Date.UTC(year, month - 1, day))
        const yyyymmdd = fechaProduccion.replace(/-/g, '')

        const startOfProdDay = new Date(fecha)
        startOfProdDay.setHours(0, 0, 0, 0)
        const endOfProdDay = new Date(fecha)
        endOfProdDay.setHours(23, 59, 59, 999)

        const producto = await prisma.producto.findUnique({ where: { id: productoId } })
        if (!producto) {
            return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
        }

        const countHoy = await prisma.lote.count({
            where: {
                productoId,
                fechaProduccion: { gte: startOfProdDay, lte: endOfProdDay },
            },
        })

        const loteId = `SC-${yyyymmdd}-${producto.codigoInterno}-${String(countHoy + 1).padStart(2, '0')}`
        const qtyPaquetes = parseInt(unidadesProducidas)

        // Obtener posicionamiento para el día
        const posicionamientosStr = await prisma.asignacionOperario.findMany({
            where: {
                fecha: { gte: startOfProdDay, lte: endOfProdDay },
                ubicacionId,
            },
            include: {
                empleado: { select: { nombre: true, apellido: true } },
                concepto: { select: { nombre: true } }
            }
        }).then((asigs: any[]) => asigs.map(a => `${a.empleado.nombre} (${a.concepto.nombre})`).join(', '))

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

            const fichasT = await tx.fichaTecnica.findMany({
                where: { productoId }
            })

            if (fichasT.length > 0) {
                const obsPersonal = posicionamientosStr ? `. Personal: ${posicionamientosStr}` : ''
                await tx.movimientoStock.createMany({
                    data: fichasT.map(f => ({
                        insumoId: f.insumoId,
                        tipo: 'salida',
                        cantidad: f.cantidadPorUnidad * qtyPaquetes,
                        observaciones: `Consumo automático por Lote ${loteId}${obsPersonal}`,
                        loteOrigenId: loteId
                    }))
                })

                for (const f of fichasT) {
                    await tx.insumo.update({
                        where: { id: f.insumoId },
                        data: { stockActual: { decrement: f.cantidadPorUnidad * qtyPaquetes } }
                    })
                }
            }

            if ((estado || 'en_camara') !== 'en_produccion') {
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
