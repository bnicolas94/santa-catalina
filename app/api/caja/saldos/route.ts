import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { exigirAccesoCaja, listarCajas } from '@/lib/services/cajas-catalogo.service'
import { tieneAccesoCaja, type UsuarioCajas } from '@/lib/caja/catalogo'

// GET /api/caja/saldos — Obtener saldos actuales de Caja Madre y Caja Chica
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) return NextResponse.json({ error: 'Sesión requerida.' }, { status: 401 })
        const cajas = await listarCajas(session.user as UsuarioCajas, true)
        const porTipo = Object.fromEntries(cajas.map(c => [c.tipo, c]))
        return NextResponse.json({ cajas, cajaMadre: porTipo.caja_madre, cajaChica: porTipo.caja_chica,
            local: porTipo.local, cajaChicaLocal: porTipo.caja_chica_local,
            mercadoPago: porTipo.mercado_pago, mercadoPagoJuani: porTipo.mercado_pago_juani })
    } catch (error) {
        console.error('Error obteniendo saldos:', error)
        return NextResponse.json({ error: 'Error al obtener saldos' }, { status: 500 })
    }
}

// PUT /api/caja/saldos — Actualizar saldo de una caja y registrar el ajuste en movimientos
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json()
        const { tipo, saldo, motivo, descripcion } = body

        const session = await getServerSession(authOptions)
        if (!session?.user) return NextResponse.json({ error: 'Sesión requerida.' }, { status: 401 })
        try { await exigirAccesoCaja(session.user as UsuarioCajas, tipo) }
        catch { return NextResponse.json({ error: 'Caja no autorizada o inactiva.' }, { status: 403 }) }
        const nuevoSaldo = Number(saldo)
        if (saldo === null || saldo === '' || !Number.isFinite(nuevoSaldo)) return NextResponse.json({ error: 'Saldo inválido.' }, { status: 400 })

        const result = await prisma.$transaction(async (tx) => {
            // 1. Obtener saldo actual
            const actual = await tx.saldoCaja.findUnique({ where: { tipo }, include: { ubicacion: true } })
            if (!actual || !tieneAccesoCaja(session.user as UsuarioCajas, actual)) throw new Error('La caja cambió o ya no está activa.')
            const saldoAnterior = actual?.saldo || 0
            const diferencia = nuevoSaldo - saldoAnterior

            // 2. Si hay diferencia, registrar el movimiento
            if (diferencia !== 0) {
                const movimiento = await tx.movimientoCaja.create({
                    data: {
                        tipo: diferencia > 0 ? 'ingreso' : 'egreso',
                        concepto: motivo || 'ajuste', // ajuste o arqueo
                        monto: Math.abs(diferencia),
                        medioPago: 'efectivo',
                        cajaOrigen: tipo,
                        descripcion: descripcion || `Cambio manual de saldo (${motivo || 'ajuste'})`,
                        creadoPorId: (session?.user as any)?.id || null,
                        fecha: new Date()
                    }
                })
                await tx.auditoriaMovimientoCaja.create({
                    data: {
                        movimientoId: movimiento.id,
                        usuarioId: (session?.user as any)?.id || null,
                        accion: 'CREACION',
                        motivo: motivo || 'ajuste',
                        valoresNuevos: {
                            tipo: movimiento.tipo,
                            concepto: movimiento.concepto,
                            monto: movimiento.monto,
                            medioPago: movimiento.medioPago,
                            cajaOrigen: movimiento.cajaOrigen,
                            descripcion: movimiento.descripcion,
                            fecha: movimiento.fecha.toISOString(),
                            estado: movimiento.estado,
                        },
                    },
                })
            }

            // 3. Actualizar el saldo
            return await tx.saldoCaja.upsert({
                where: { tipo },
                create: { tipo, saldo: nuevoSaldo },
                update: { saldo: nuevoSaldo },
            })
        }, { isolationLevel: 'Serializable' })

        return NextResponse.json(result)
    } catch (error) {
        console.error('Error actualizando saldo:', error)
        return NextResponse.json({ error: 'Error al actualizar saldo' }, { status: 500 })
    }
}
