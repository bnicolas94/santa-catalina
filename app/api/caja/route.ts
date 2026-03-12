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

        // Si hay fecha especificada, usamos medianoche local para el rango
        // Si no hay fecha, usamos el momento actual
        const dateToFilter = fechaParam ? new Date(fechaParam + 'T00:00:00') : new Date()
        const startOfDay = new Date(dateToFilter.getFullYear(), dateToFilter.getMonth(), dateToFilter.getDate(), 0, 0, 0, 0)
        const endOfDay = new Date(dateToFilter.getFullYear(), dateToFilter.getMonth(), dateToFilter.getDate(), 23, 59, 59, 999)

        // Definir cajas permitidas según ubicación
        let allowedBoxes: string[] | undefined = undefined
        if (userRol !== 'ADMIN') {
            const ubicacionTipo = (session?.user as any)?.ubicacionTipo
            if (ubicacionTipo === 'LOCAL') {
                allowedBoxes = ['local']
            } else if (ubicacionTipo === 'FABRICA') {
                allowedBoxes = ['caja_madre', 'caja_chica']
            }
        }

        const movimientos = await prisma.movimientoCaja.findMany({
            where: { 
                fecha: { gte: startOfDay, lte: endOfDay },
                ...(allowedBoxes && { cajaOrigen: { in: allowedBoxes } })
            },
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
        const { tipo, concepto, monto, medioPago, descripcion, pedidoId, gastoId, cajaOrigen, choferId, fecha } = body

        if (!tipo || !concepto || monto === undefined || monto === null || monto === '') {
            return NextResponse.json({ error: 'Tipo, concepto y monto son requeridos' }, { status: 400 })
        }

        // VALIDACIÓN DE UBICACIÓN
        if (userRol !== 'ADMIN' && cajaOrigen) {
            const ubicacionTipo = (session?.user as any)?.ubicacionTipo
            if (ubicacionTipo === 'LOCAL' && cajaOrigen !== 'local') {
                return NextResponse.json({ error: 'No tienes permiso para operar en esta caja' }, { status: 403 })
            }
            if (ubicacionTipo === 'FABRICA' && !['caja_madre', 'caja_chica'].includes(cajaOrigen)) {
                return NextResponse.json({ error: 'No tienes permiso para operar en esta caja' }, { status: 403 })
            }
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

        const result = await prisma.$transaction(async (tx) => {
            const mov = await tx.movimientoCaja.create({
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
                    // Si viene una fecha de string (YYYY-MM-DD), le agregamos mediodía para evitar saltos de zona horaria
                    fecha: (fecha && typeof fecha === 'string' && fecha.length === 10) 
                        ? new Date(fecha + 'T12:00:00') 
                        : (fecha ? new Date(fecha) : new Date()),
                },
            })

            // Actualizar SaldoCaja si hay caja origen
            if (cajaOrigen) {
                if (tipo === 'ingreso') {
                    await tx.saldoCaja.update({
                        where: { tipo: cajaOrigen },
                        data: { saldo: { increment: numericMonto } }
                    })
                } else {
                    await tx.saldoCaja.update({
                        where: { tipo: cajaOrigen },
                        data: { saldo: { decrement: numericMonto } }
                    })
                }
            }

            return mov
        })

        console.log('[CAJA API] Movimiento creado exitosamente:', result.id)
        return NextResponse.json(result, { status: 201 })
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
        const { id, tipo, concepto, monto, medioPago, cajaOrigen, descripcion, fecha } = body

        if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

        const result = await prisma.$transaction(async (tx) => {
            const oldMov = await tx.movimientoCaja.findUnique({ where: { id } })
            if (!oldMov) throw new Error('Movimiento no encontrado')

            // VALIDACIÓN DE UBICACIÓN (Movimiento Existente)
            if (userRol !== 'ADMIN' && oldMov.cajaOrigen) {
                const ubicacionTipo = (session?.user as any)?.ubicacionTipo
                if (ubicacionTipo === 'LOCAL' && oldMov.cajaOrigen !== 'local') {
                    throw new Error('No tienes permiso para editar este movimiento')
                }
                if (ubicacionTipo === 'FABRICA' && !['caja_madre', 'caja_chica'].includes(oldMov.cajaOrigen)) {
                    throw new Error('No tienes permiso para editar este movimiento')
                }
            }

            // VALIDACIÓN DE UBICACIÓN (Nuevos Valores)
            if (userRol !== 'ADMIN' && cajaOrigen) {
                const ubicacionTipo = (session?.user as any)?.ubicacionTipo
                if (ubicacionTipo === 'LOCAL' && cajaOrigen !== 'local') {
                    throw new Error('No tienes permiso para mover fondos a esta caja')
                }
                if (ubicacionTipo === 'FABRICA' && !['caja_madre', 'caja_chica'].includes(cajaOrigen)) {
                    throw new Error('No tienes permiso para mover fondos a esta caja')
                }
            }

            // 1. Revertir impacto viejo en saldo
            if (oldMov.cajaOrigen) {
                if (oldMov.tipo === 'ingreso') {
                    await tx.saldoCaja.update({
                        where: { tipo: oldMov.cajaOrigen },
                        data: { saldo: { decrement: oldMov.monto } }
                    })
                } else {
                    await tx.saldoCaja.update({
                        where: { tipo: oldMov.cajaOrigen },
                        data: { saldo: { increment: oldMov.monto } }
                    })
                }
            }

            // 2. Actualizar el movimiento
            const mov = await tx.movimientoCaja.update({
                where: { id },
                data: {
                    ...(tipo && { tipo }),
                    ...(concepto && { concepto }),
                    ...(monto !== undefined && { monto: parseFloat(monto) }),
                    ...(medioPago && { medioPago }),
                    ...(cajaOrigen !== undefined && { cajaOrigen: cajaOrigen || null }),
                    ...(descripcion !== undefined && { descripcion: descripcion || null }),
                    // Si viene una fecha de string (YYYY-MM-DD), le agregamos mediodía para evitar saltos de zona horaria
                    ...(fecha && { 
                        fecha: (typeof fecha === 'string' && fecha.length === 10) 
                            ? new Date(fecha + 'T12:00:00') 
                            : new Date(fecha) 
                    }),
                },
            })

            // 3. Aplicar nuevo impacto en saldo
            if (mov.cajaOrigen) {
                if (mov.tipo === 'ingreso') {
                    await tx.saldoCaja.update({
                        where: { tipo: mov.cajaOrigen },
                        data: { saldo: { increment: mov.monto } }
                    })
                } else {
                    await tx.saldoCaja.update({
                        where: { tipo: mov.cajaOrigen },
                        data: { saldo: { decrement: mov.monto } }
                    })
                }
            }

            return mov
        })

        return NextResponse.json(result)
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

        await prisma.$transaction(async (tx) => {
            const mov = await tx.movimientoCaja.findUnique({ where: { id } })
            if (!mov) return

            // VALIDACIÓN DE UBICACIÓN
            if (userRol !== 'ADMIN' && mov.cajaOrigen) {
                const ubicacionTipo = (session?.user as any)?.ubicacionTipo
                if (ubicacionTipo === 'LOCAL' && mov.cajaOrigen !== 'local') {
                    throw new Error('No tienes permiso para eliminar este movimiento')
                }
                if (ubicacionTipo === 'FABRICA' && !['caja_madre', 'caja_chica'].includes(mov.cajaOrigen)) {
                    throw new Error('No tienes permiso para eliminar este movimiento')
                }
            }

            // Revertir impacto en saldo
            if (mov.cajaOrigen) {
                if (mov.tipo === 'ingreso') {
                    await tx.saldoCaja.update({
                        where: { tipo: mov.cajaOrigen },
                        data: { saldo: { decrement: mov.monto } }
                    })
                } else {
                    await tx.saldoCaja.update({
                        where: { tipo: mov.cajaOrigen },
                        data: { saldo: { increment: mov.monto } }
                    })
                }
            }

            await tx.movimientoCaja.delete({ where: { id } })
        })

        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error('Error eliminando movimiento:', error)
        return NextResponse.json({ error: 'Error al eliminar movimiento' }, { status: 500 })
    }
}
