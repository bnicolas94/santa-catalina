import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/caja — Movimientos de caja del día (o fecha especificada)
export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        const userRol = (session?.user as any)?.rol
        const permisos = (session?.user as any)?.permisos || {}

        if (userRol !== 'ADMIN' && !permisos.permisoCaja) {
            return NextResponse.json({ error: 'No tienes permiso para ver la caja' }, { status: 403 })
        }
        const { searchParams } = new URL(request.url)
        const fechaParam = searchParams.get('fecha')

        // Parsear como hora local para evitar desfasaje de timezone
        let startOfDay: Date, endOfDay: Date
        if (fechaParam) {
            const [y, m, d] = fechaParam.split('-').map(Number)
            startOfDay = new Date(y, m - 1, d, 0, 0, 0, 0)
            endOfDay = new Date(y, m - 1, d, 23, 59, 59, 999)
        } else {
            const now = new Date()
            startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
        }

        const movimientos = await prisma.movimientoCaja.findMany({
            where: { fecha: { gte: startOfDay, lte: endOfDay } },
            orderBy: { fecha: 'desc' },
            include: {
                pedido: { select: { id: true, totalImporte: true, cliente: { select: { nombreComercial: true } } } },
                rendicion: { select: { id: true, chofer: { select: { nombre: true } } } },
            },
        })

        // Resumen del día
        let ingresosEfectivo = 0
        let ingresosTransferencia = 0
        let egresosTotal = 0

        for (const m of movimientos) {
            if (m.tipo === 'ingreso') {
                if (m.medioPago === 'efectivo') ingresosEfectivo += m.monto
                else ingresosTransferencia += m.monto
            } else {
                egresosTotal += m.monto
            }
        }

        return NextResponse.json({
            movimientos,
            resumen: {
                ingresosEfectivo,
                ingresosTransferencia,
                egresosTotal,
                saldo: ingresosEfectivo + ingresosTransferencia - egresosTotal,
            }
        })
    } catch (error) {
        console.error('Error obteniendo caja:', error)
        return NextResponse.json({ error: 'Error al cargar la caja' }, { status: 500 })
    }
}

// POST /api/caja — Registrar movimiento manual
export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        const userRol = (session?.user as any)?.rol
        const permisos = (session?.user as any)?.permisos || {}

        if (userRol !== 'ADMIN' && !permisos.permisoCaja) {
            return NextResponse.json({ error: 'No tienes permiso para operar en caja' }, { status: 403 })
        }

        const body = await request.json()
        console.log('[CAJA API] Recibido POST:', body)
        const { tipo, concepto, monto, medioPago, descripcion, pedidoId, gastoId, cajaOrigen, choferId } = body

        if (!tipo || !concepto || monto === undefined || monto === null || monto === '') {
            return NextResponse.json({ error: 'Tipo, concepto y monto son requeridos' }, { status: 400 })
        }

        const numericMonto = parseFloat(monto)
        if (isNaN(numericMonto)) {
            return NextResponse.json({ error: 'El monto debe ser un número válido' }, { status: 400 })
        }

        let rendicionId = null
        // Si es rendición de chofer y viene un choferId, buscamos o creamos la rendición de hoy
        if (concepto === 'rendicion_chofer' && choferId) {
            const now = new Date()
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

            let rendicion = await prisma.rendicionChofer.findFirst({
                where: {
                    choferId,
                    fecha: { gte: startOfDay, lte: endOfDay }
                }
            })

            if (!rendicion) {
                rendicion = await prisma.rendicionChofer.create({
                    data: {
                        choferId,
                        fecha: now,
                        montoEsperado: 0, // Se asume 0 si es carga manual inicial o se actualizará luego
                        estado: 'pendiente'
                    }
                })
            }
            rendicionId = rendicion.id
        }

        const mov = await prisma.movimientoCaja.create({
            data: {
                tipo,
                concepto,
                monto: numericMonto,
                medioPago: medioPago || 'efectivo',
                cajaOrigen: cajaOrigen || null,
                descripcion: descripcion || null,
                pedidoId: pedidoId || null,
                gastoId: gastoId || null,
                rendicionId: rendicionId,
            },
        })

        console.log('[CAJA API] Movimiento creado exitosamente:', mov.id)
        return NextResponse.json(mov, { status: 201 })
    } catch (error) {
        console.error('[CAJA API] Error crítico creando movimiento:', error)
        return NextResponse.json({
            error: 'Error interno al registrar movimiento',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 })
    }
}

// PUT /api/caja — Editar movimiento
export async function PUT(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        const userRol = (session?.user as any)?.rol
        const permisos = (session?.user as any)?.permisos || {}

        if (userRol !== 'ADMIN' && !permisos.permisoCaja) {
            return NextResponse.json({ error: 'No tienes permiso para editar caja' }, { status: 403 })
        }

        const body = await request.json()
        const { id, tipo, concepto, monto, medioPago, cajaOrigen, descripcion } = body

        if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

        const mov = await prisma.movimientoCaja.update({
            where: { id },
            data: {
                ...(tipo && { tipo }),
                ...(concepto && { concepto }),
                ...(monto !== undefined && { monto: parseFloat(monto) }),
                ...(medioPago && { medioPago }),
                ...(cajaOrigen !== undefined && { cajaOrigen: cajaOrigen || null }),
                ...(descripcion !== undefined && { descripcion: descripcion || null }),
            },
        })
        return NextResponse.json(mov)
    } catch (error) {
        console.error('Error editando movimiento:', error)
        return NextResponse.json({ error: 'Error al editar movimiento' }, { status: 500 })
    }
}

// DELETE /api/caja — Eliminar movimiento
export async function DELETE(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        const userRol = (session?.user as any)?.rol
        const permisos = (session?.user as any)?.permisos || {}

        if (userRol !== 'ADMIN' && !permisos.permisoCaja) {
            return NextResponse.json({ error: 'No tienes permiso para eliminar en caja' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')
        if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

        await prisma.movimientoCaja.delete({ where: { id } })
        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error('Error eliminando movimiento:', error)
        return NextResponse.json({ error: 'Error al eliminar movimiento' }, { status: 500 })
    }
}
