import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        const userRol = (session?.user as any)?.rol
        const permisos = (session?.user as any)?.permisos || {}

        // Verificar permisos de stock o producción
        if (userRol !== 'ADMIN' && !permisos.permisoStock && !permisos.permisoProduccion) {
            return NextResponse.json({ error: 'No tienes permiso para descontar stock' }, { status: 403 })
        }

        const { fecha, turno } = await request.json()
        if (!fecha || !turno) {
            return NextResponse.json({ error: 'Faltan datos requeridos (fecha, turno)' }, { status: 400 })
        }

        const startOfDay = new Date(`${fecha}T00:00:00.000Z`)
        const endOfDay = new Date(`${fecha}T23:59:59.999Z`)

        // 1. Verificar si ya fue descontado
        const yaDescontado = await prisma.planificacionDescuento.findUnique({
            where: { fecha_turno: { fecha: startOfDay, turno } }
        })
        if (yaDescontado) {
            return NextResponse.json({ error: `El stock para el turno ${turno} del ${fecha} ya fue descontado anteriormente.` }, { status: 400 })
        }

        // 2. Obtener ubicación FÁBRICA
        const ubiFabrica = await prisma.ubicacion.findFirst({ where: { tipo: 'FABRICA' } })
        if (!ubiFabrica) {
            return NextResponse.json({ error: 'No se encontró la ubicación de FÁBRICA' }, { status: 404 })
        }

        // 3. Obtener necesidades a descontar (solo FABRICA)
        // Rutas del turno
        const rutas = await prisma.ruta.findMany({
            where: { fecha: { gte: startOfDay, lte: endOfDay }, turno },
            include: { 
                entregas: { 
                    include: { 
                        pedido: { 
                            include: { 
                                detalles: { 
                                    include: { 
                                        presentacion: true 
                                    } 
                                } 
                            } 
                        } 
                    } 
                } 
            }
        })

        // Requerimientos manuales del turno que NO sean LOCAL
        const manuales = await prisma.requerimientoProduccion.findMany({
            where: { fecha: { gte: startOfDay, lte: endOfDay }, turno, destino: { not: 'LOCAL' } },
            include: { presentacion: true }
        })

        // Consolidar UNIDADES
        const consolidadoUnidades: Record<string, { productoId: string, presentacionId: string, totalUnidades: number, presCant: number }> = {}

        rutas.forEach(ruta => {
            ruta.entregas.forEach(ent => {
                ent.pedido.detalles.forEach(det => {
                    const key = det.presentacionId
                    if (!consolidadoUnidades[key]) {
                        consolidadoUnidades[key] = { 
                            productoId: det.presentacion.productoId, 
                            presentacionId: det.presentacionId, 
                            totalUnidades: 0,
                            presCant: det.presentacion.cantidad
                        }
                    }
                    consolidadoUnidades[key].totalUnidades += (det.cantidad * det.presentacion.cantidad)
                })
            })
        })

        manuales.forEach(m => {
            if (!m.presentacionId || !m.presentacion) return 
            const key = m.presentacionId
            if (!consolidadoUnidades[key]) {
                consolidadoUnidades[key] = { 
                    productoId: m.productoId as string, 
                    presentacionId: m.presentacionId, 
                    totalUnidades: 0,
                    presCant: m.presentacion.cantidad
                }
            }
            consolidadoUnidades[key].totalUnidades += m.cantidad
        })

        // Convertir a PAQUETES (redondeo hacia arriba para asegurar descuento completo)
        const itemsADescontar = Object.values(consolidadoUnidades).map(item => ({
            ...item,
            paquetes: Math.ceil(item.totalUnidades / item.presCant)
        })).filter(i => i.paquetes > 0)

        if (itemsADescontar.length === 0) {
            return NextResponse.json({ error: 'No hay paquetes para descontar en este turno.' }, { status: 400 })
        }

        // 4. Ejecutar en transacción
        await prisma.$transaction(async (tx) => {
            for (const item of itemsADescontar) {
                // Actualizar o crear StockProducto
                await tx.stockProducto.upsert({
                    where: { 
                        productoId_presentacionId_ubicacionId: {
                            productoId: item.productoId,
                            presentacionId: item.presentacionId,
                            ubicacionId: ubiFabrica.id
                        }
                    },
                    update: { cantidad: { decrement: item.paquetes } },
                    create: {
                        productoId: item.productoId,
                        presentacionId: item.presentacionId,
                        ubicacionId: ubiFabrica.id,
                        cantidad: -item.paquetes
                    }
                })

                // Crear MovimientoProducto
                await tx.movimientoProducto.create({
                    data: {
                        tipo: 'egreso',
                        signo: '-',
                        cantidad: item.paquetes,
                        fecha: new Date(),
                        observaciones: `Descuento automático Planilla [Turno: ${turno}]`,
                        productoId: item.productoId,
                        presentacionId: item.presentacionId,
                        ubicacionId: ubiFabrica.id
                    }
                })
            }

            // Registrar que el turno fue procesado
            await tx.planificacionDescuento.create({
                data: { fecha: startOfDay, turno }
            })
        })

        return NextResponse.json({ 
            success: true, 
            message: `Stock descontado para el turno ${turno} (${itemsADescontar.length} productos afectados).`,
            resumen: itemsADescontar.map(i => ({ id: i.presentacionId, paquetes: i.paquetes }))
        })

    } catch (error: any) {
        console.error('Error en descuento de stock:', error)
        return NextResponse.json({ error: 'Error interno', details: error.message }, { status: 500 })
    }
}
