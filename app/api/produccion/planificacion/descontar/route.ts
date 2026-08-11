import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

type SessionUser = {
    rol?: string
    permisos?: { permisoStock?: boolean; permisoProduccion?: boolean }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        const user = session?.user as SessionUser | undefined
        const userRol = user?.rol
        const permisos = user?.permisos || {}

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

        // 3. Obtener necesidades manuales a descontar (solo FABRICA).
        // Los pedidos incluidos en rutas ya descuentan producto terminado al crear
        // la ruta y no deben volver a descontarse desde planificación.
        const manuales = await prisma.requerimientoProduccion.findMany({
            where: { fecha: { gte: startOfDay, lte: endOfDay }, turno, destino: { not: 'LOCAL' } },
            include: { 
                presentacion: {
                    include: { producto: { select: { codigoInterno: true } } }
                } 
            }
        })

        // Consolidar UNIDADES
        const consolidadoUnidades: Record<string, { productoId: string, presentacionId: string, totalUnidades: number, presCant: number }> = {}

        manuales.forEach(m => {
            if (!m.presentacionId || !m.presentacion) return 
            
            // OMITIR ELEGIDOS Y PREMIUM: Son bajo demanda y no tienen stock físico real
            const code = m.presentacion.producto.codigoInterno
            if (code === 'ELE' || code === 'PRE') return

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
            await prisma.planificacionDescuento.create({
                data: { fecha: startOfDay, turno },
            })
            return NextResponse.json({
                success: true,
                message: 'No hay requerimientos manuales para descontar. Los pedidos de rutas ya se descuentan automáticamente al despachar.',
                resumen: [],
            })
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
                        observaciones: `Descuento automático Planilla [Día: ${fecha}, Turno: ${turno}]`,
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

    } catch (error: unknown) {
        console.error('Error en descuento de stock:', error)
        return NextResponse.json({ error: 'Error interno', details: error instanceof Error ? error.message : String(error) }, { status: 500 })
    }
}

export async function DELETE(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        const user = session?.user as SessionUser | undefined
        const userRol = user?.rol
        const permisos = user?.permisos || {}

        // Verificar permisos de stock o producción (solo ADMIN por seguridad adicional en reversión)
        if (userRol !== 'ADMIN' && !permisos.permisoStock && !permisos.permisoProduccion) {
            return NextResponse.json({ error: 'No tienes permiso para revertir el stock' }, { status: 403 })
        }

        const { fecha, turno } = await request.json()
        if (!fecha || !turno) {
            return NextResponse.json({ error: 'Faltan datos requeridos (fecha, turno)' }, { status: 400 })
        }

        const startOfDay = new Date(`${fecha}T00:00:00.000Z`)

        // 1. Buscar registro de descuento
        const descuento = await prisma.planificacionDescuento.findUnique({
            where: { fecha_turno: { fecha: startOfDay, turno } }
        })

        if (!descuento) {
            return NextResponse.json({ error: 'No se encontró un descuento registrado para este turno y fecha.' }, { status: 404 })
        }

        // 2. Buscar movimientos asociados (con margen de tiempo y patrón de observación)
        const margenMinutos = 2
        const createdMin = new Date(descuento.createdAt.getTime() - (margenMinutos * 60000))
        const createdMax = new Date(descuento.createdAt.getTime() + (margenMinutos * 60000))

        const movimientos = await prisma.movimientoProducto.findMany({
            where: {
                tipo: 'egreso',
                signo: '-',
                createdAt: { gte: createdMin, lte: createdMax },
                OR: [
                    { observaciones: `Descuento automático Planilla [Turno: ${turno}]` },
                    { observaciones: `Descuento automático Planilla [Día: ${fecha}, Turno: ${turno}]` }
                ]
            }
        })

        // 3. Ejecutar en transacción
        await prisma.$transaction(async (tx) => {
            for (const mov of movimientos) {
                // Revertir StockProducto (sumar lo que se restó)
                await tx.stockProducto.upsert({
                    where: { 
                        productoId_presentacionId_ubicacionId: {
                            productoId: mov.productoId,
                            presentacionId: mov.presentacionId,
                            ubicacionId: mov.ubicacionId
                        }
                    },
                    update: { cantidad: { increment: mov.cantidad } },
                    create: {
                        productoId: mov.productoId,
                        presentacionId: mov.presentacionId,
                        ubicacionId: mov.ubicacionId,
                        cantidad: mov.cantidad
                    }
                })

                // Eliminar el movimiento
                await tx.movimientoProducto.delete({
                    where: { id: mov.id }
                })
            }

            // Eliminar registro de planificación
            await tx.planificacionDescuento.delete({
                where: { id: descuento.id }
            })
        })

        return NextResponse.json({ 
            success: true, 
            message: `Reversión exitosa. Se han reincorporado ${movimientos.length} productos al stock.`
        })

    } catch (error: unknown) {
        console.error('Error en reversión de stock:', error)
        return NextResponse.json({ error: 'Error interno', details: error instanceof Error ? error.message : String(error) }, { status: 500 })
    }
}
