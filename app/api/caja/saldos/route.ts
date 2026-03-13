import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/caja/saldos — Obtener saldos actuales de Caja Madre y Caja Chica
export async function GET() {
    try {
        // Crear registros si no existen (upsert)
        const [cajaMadre, cajaChica, local] = await Promise.all([
            prisma.saldoCaja.upsert({
                where: { tipo: 'caja_madre' },
                create: { tipo: 'caja_madre', saldo: 0 },
                update: {},
            }),
            prisma.saldoCaja.upsert({
                where: { tipo: 'caja_chica' },
                create: { tipo: 'caja_chica', saldo: 0 },
                update: {},
            }),
            prisma.saldoCaja.upsert({
                where: { tipo: 'local' },
                create: { tipo: 'local', saldo: 0 },
                update: {},
            }),
        ])

        return NextResponse.json({ cajaMadre, cajaChica, local })
    } catch (error) {
        console.error('Error obteniendo saldos:', error)
        return NextResponse.json({ error: 'Error al obtener saldos' }, { status: 500 })
    }
}

// PUT /api/caja/saldos — Actualizar saldo de una caja y registrar el ajuste en movimientos
export async function PUT(request: Request) {
    try {
        const body = await request.json()
        const { tipo, saldo, motivo, descripcion } = body

        const session = await getServerSession(authOptions)
        const userRol = (session?.user as any)?.rol
        const permisos = (session?.user as any)?.permisos || {}

        if (userRol?.toUpperCase() !== 'ADMIN') {
            if (!permisos.permisoCaja) {
                return NextResponse.json({ error: 'No tienes permiso para operar en caja' }, { status: 403 })
            }
            const ubicacionTipo = (session?.user as any)?.ubicacionTipo?.toUpperCase()
            const cajaLower = tipo?.toLowerCase()

            if (ubicacionTipo === 'LOCAL') {
                if (cajaLower !== 'local') {
                    return NextResponse.json({ error: `No tienes permiso para ajustar la caja '${tipo}' desde ubicación LOCAL` }, { status: 403 })
                }
            } else if (ubicacionTipo === 'FABRICA') {
                const allowed = ['caja_madre', 'caja_chica']
                if (!allowed.includes(cajaLower)) {
                    return NextResponse.json({ error: `No tienes permiso para ajustar la caja '${tipo}' desde ubicación FABRICA` }, { status: 403 })
                }
            } else {
                return NextResponse.json({ error: 'Tu usuario no tiene una ubicación asignada para operar en caja' }, { status: 403 })
            }
        }

        if (!tipo || saldo === undefined) {
            return NextResponse.json({ error: 'Tipo y saldo son requeridos' }, { status: 400 })
        }

        if (!['caja_madre', 'caja_chica', 'local'].includes(tipo)) {
            return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
        }

        const nuevoSaldo = parseFloat(saldo)

        const result = await prisma.$transaction(async (tx) => {
            // 1. Obtener saldo actual
            const actual = await tx.saldoCaja.findUnique({ where: { tipo } })
            const saldoAnterior = actual?.saldo || 0
            const diferencia = nuevoSaldo - saldoAnterior

            // 2. Si hay diferencia, registrar el movimiento
            if (diferencia !== 0) {
                await tx.movimientoCaja.create({
                    data: {
                        tipo: diferencia > 0 ? 'ingreso' : 'egreso',
                        concepto: motivo || 'ajuste', // ajuste o arqueo
                        monto: Math.abs(diferencia),
                        medioPago: 'efectivo',
                        cajaOrigen: tipo,
                        descripcion: descripcion || `Cambio manual de saldo (${motivo || 'ajuste'})`,
                        fecha: new Date()
                    }
                })
            }

            // 3. Actualizar el saldo
            return await tx.saldoCaja.upsert({
                where: { tipo },
                create: { tipo, saldo: nuevoSaldo },
                update: { saldo: nuevoSaldo },
            })
        })

        return NextResponse.json(result)
    } catch (error) {
        console.error('Error actualizando saldo:', error)
        return NextResponse.json({ error: 'Error al actualizar saldo' }, { status: 500 })
    }
}
