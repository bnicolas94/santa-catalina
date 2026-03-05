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

// PUT /api/caja/saldos — Actualizar saldo de una caja
export async function PUT(request: Request) {
    try {
        const body = await request.json()
        const { tipo, saldo } = body

        if (!tipo || saldo === undefined) {
            return NextResponse.json({ error: 'Tipo y saldo son requeridos' }, { status: 400 })
        }

        if (!['caja_madre', 'caja_chica', 'local'].includes(tipo)) {
            return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
        }

        const updated = await prisma.saldoCaja.upsert({
            where: { tipo },
            create: { tipo, saldo: parseFloat(saldo) },
            update: { saldo: parseFloat(saldo) },
        })

        return NextResponse.json(updated)
    } catch (error) {
        console.error('Error actualizando saldo:', error)
        return NextResponse.json({ error: 'Error al actualizar saldo' }, { status: 500 })
    }
}
