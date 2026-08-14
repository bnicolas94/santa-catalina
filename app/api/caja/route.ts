import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { CajaService } from '@/lib/services/caja.service'
import { esMovimientoGestionadoPorRRHH } from '@/lib/caja/movimientosProtegidos'

// ─── Helpers de Autorización ─────────────────────────────────────────────────

function getAllowedBoxes(userRol: string, ubicacionTipo: string): string[] | undefined {
    if (userRol === 'ADMIN') return undefined // Sin restricción
    const uType = ubicacionTipo?.toUpperCase()
    if (uType === 'LOCAL') return ['local', 'caja_chica_local']
    if (uType === 'FABRICA') return ['caja_madre', 'caja_chica']
    return []
}

function validateCajaAccess(userRol: string, ubicacionTipo: string, cajaOrigen: string): string | null {
    if (userRol?.toUpperCase() === 'ADMIN') return null
    const cajaLower = cajaOrigen.toLowerCase()
    const uType = ubicacionTipo?.toUpperCase()

    if (uType === 'LOCAL') {
        if (cajaLower !== 'local' && cajaLower !== 'caja_chica_local') {
            return `No tienes permiso para operar en la caja '${cajaOrigen}' desde ubicación LOCAL`
        }
    } else if (uType === 'FABRICA') {
        if (!['caja_madre', 'caja_chica'].includes(cajaLower)) {
            return `No tienes permiso para operar en la caja '${cajaOrigen}' desde ubicación FABRICA`
        }
    } else {
        return 'Tu usuario no tiene una ubicación asignada para operar en caja'
    }
    return null
}

// ─── GET /api/caja ───────────────────────────────────────────────────────────

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

        const dateToFilter = fechaParam ? new Date(fechaParam + 'T00:00:00') : new Date()
        const startOfDay = new Date(dateToFilter.getFullYear(), dateToFilter.getMonth(), dateToFilter.getDate(), 0, 0, 0, 0)
        const endOfDay = new Date(dateToFilter.getFullYear(), dateToFilter.getMonth(), dateToFilter.getDate(), 23, 59, 59, 999)

        const ubicacionTipo = (session?.user as any)?.ubicacionTipo
        const allowedBoxes = getAllowedBoxes(userRol, ubicacionTipo)
        const esAdmin = userRol === 'ADMIN'

        const movimientos = await prisma.movimientoCaja.findMany({
            where: {
                fecha: { gte: startOfDay, lte: endOfDay },
                ...(!esAdmin && { estado: 'activo' }),
                ...(allowedBoxes && { cajaOrigen: { in: allowedBoxes } })
            },
            orderBy: { fecha: 'desc' },
            include: {
                pedido: { select: { id: true, totalImporte: true, cliente: { select: { nombreComercial: true } } } },
                rendicion: { select: { id: true, chofer: { select: { nombre: true } } } },
                movimientoMp: true,
                depositoIngreso: { select: { id: true } },
                depositoAjuste: { select: { id: true } },
                depositoTransferenciaOrigen: { select: { id: true } },
                depositoTransferenciaDestino: { select: { id: true } },
                creadoPor: { select: { id: true, nombre: true, apellido: true } },
                actualizadoPor: { select: { id: true, nombre: true, apellido: true } },
                anuladoPor: { select: { id: true, nombre: true, apellido: true } },
                auditorias: esAdmin ? {
                    orderBy: { createdAt: 'desc' },
                    include: { usuario: { select: { id: true, nombre: true, apellido: true } } },
                } : false,
            },
        })

        let ingresosEfectivo = 0
        let ingresosTransferencia = 0
        let egresosTotal = 0

        for (const m of movimientos) {
            if (m.estado === 'anulado') continue
            if (m.tipo === 'ingreso') {
                if (m.medioPago === 'efectivo') ingresosEfectivo += m.monto
                else ingresosTransferencia += m.monto
            } else {
                egresosTotal += m.monto
            }
        }

        return NextResponse.json({
            movimientos: movimientos.map(movimiento => ({
                ...movimiento,
                gestionadoPorRRHH: esMovimientoGestionadoPorRRHH(movimiento),
                gestionadoPorDeposito: Boolean(
                    movimiento.depositoIngreso ||
                    movimiento.depositoAjuste ||
                    movimiento.depositoTransferenciaOrigen ||
                    movimiento.depositoTransferenciaDestino
                ),
            })),
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

// ─── POST /api/caja ──────────────────────────────────────────────────────────

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

        // Validación de ubicación
        if (userRol?.toUpperCase() !== 'ADMIN' && cajaOrigen) {
            const ubicacionTipo = (session?.user as any)?.ubicacionTipo?.toUpperCase()
            const error = validateCajaAccess(userRol, ubicacionTipo, cajaOrigen)
            if (error) return NextResponse.json({ error }, { status: 403 })
        }

        const numericMonto = parseFloat(monto)
        if (isNaN(numericMonto)) {
            return NextResponse.json({ error: 'El monto debe ser un número válido' }, { status: 400 })
        }

        // Rendición de chofer: buscar o crear rendición del día
        let rendicionId = null
        if (concepto === 'rendicion_chofer' && choferId) {
            const now = new Date()
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

            let rendicion = await prisma.rendicionChofer.findFirst({
                where: { choferId, fecha: { gte: startOfDay, lte: endOfDay } }
            })

            if (!rendicion) {
                rendicion = await prisma.rendicionChofer.create({
                    data: { choferId, fecha: now, montoEsperado: 0, estado: 'pendiente' }
                })
            }
            rendicionId = rendicion.id
        }

        const result = await CajaService.createMovimiento({
            tipo,
            concepto,
            monto: numericMonto,
            medioPago: medioPago || 'efectivo',
            cajaOrigen: cajaOrigen || null,
            descripcion: descripcion || null,
            pedidoId: pedidoId || null,
            gastoId: gastoId || null,
            rendicionId,
            fecha,
            usuarioId: (session?.user as any)?.id || null,
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

// ─── PUT /api/caja ───────────────────────────────────────────────────────────

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

        // Validar acceso al movimiento existente
        if (userRol !== 'ADMIN') {
            const oldMov = await prisma.movimientoCaja.findUnique({ where: { id } })
            if (!oldMov) return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })

            const ubicacionTipo = (session?.user as any)?.ubicacionTipo
            if (oldMov.cajaOrigen) {
                const err = validateCajaAccess(userRol, ubicacionTipo, oldMov.cajaOrigen)
                if (err) return NextResponse.json({ error: 'No tienes permiso para editar este movimiento' }, { status: 403 })
            }
            if (cajaOrigen) {
                const err = validateCajaAccess(userRol, ubicacionTipo, cajaOrigen)
                if (err) return NextResponse.json({ error: 'No tienes permiso para mover fondos a esta caja' }, { status: 403 })
            }
        }

        const result = await CajaService.updateMovimiento(id, {
            tipo,
            concepto,
            monto: monto !== undefined ? parseFloat(monto) : undefined,
            medioPago,
            cajaOrigen,
            descripcion,
            fecha,
            usuarioId: (session?.user as any)?.id || null,
        })

        return NextResponse.json(result)
    } catch (error) {
        console.error('Error editando movimiento:', error)
        const mensaje = error instanceof Error ? error.message : 'Error al editar movimiento'
        const status = mensaje.includes('pertenece a RR. HH.') ? 409 : 500
        return NextResponse.json({ error: mensaje }, { status })
    }
}

// ─── DELETE /api/caja ────────────────────────────────────────────────────────

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
        const body = await request.json().catch(() => ({}))
        const motivo = body?.motivo

        // Validar acceso
        if (userRol !== 'ADMIN') {
            const mov = await prisma.movimientoCaja.findUnique({ where: { id } })
            if (mov?.cajaOrigen) {
                const ubicacionTipo = (session?.user as any)?.ubicacionTipo
                const err = validateCajaAccess(userRol, ubicacionTipo, mov.cajaOrigen)
                if (err) return NextResponse.json({ error: 'No tienes permiso para eliminar este movimiento' }, { status: 403 })
            }
        }

        await CajaService.anularMovimiento(id, motivo, (session?.user as any)?.id || null)

        return NextResponse.json({ ok: true, estado: 'anulado' })
    } catch (error) {
        console.error('Error anulando movimiento:', error)
        const mensaje = error instanceof Error ? error.message : 'Error al anular movimiento'
        const status = mensaje.includes('motivo') || mensaje.includes('500 caracteres')
            ? 400
            : mensaje.includes('pertenece a RR. HH.') || mensaje.includes('ya se encuentra anulado')
                ? 409
                : 500
        return NextResponse.json({ error: mensaje }, { status })
    }
}
