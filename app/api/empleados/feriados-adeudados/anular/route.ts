import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { TIPO_FERIADO_ADEUDADO } from '@/lib/payroll/feriadosAdeudados'
import { prisma } from '@/lib/prisma'
import { PayrollService } from '@/lib/services/payroll.service'

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        const usuario = session?.user as { id?: string; rol?: string } | undefined
        if (!usuario?.id) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
        if (usuario.rol !== 'ADMIN') {
            return NextResponse.json({ error: 'Sólo un administrador puede anular pagos.' }, { status: 403 })
        }

        const body = await request.json() as Record<string, unknown>
        const liquidacionId = typeof body.liquidacionId === 'string' ? body.liquidacionId : ''
        if (!liquidacionId) return NextResponse.json({ error: 'El pago es requerido.' }, { status: 400 })

        const liquidacion = await prisma.liquidacionSueldo.findUnique({
            where: { id: liquidacionId },
            select: { tipo: true, estado: true },
        })
        if (!liquidacion || liquidacion.tipo !== TIPO_FERIADO_ADEUDADO || liquidacion.estado !== 'pagado') {
            return NextResponse.json({ error: 'El pago no existe, ya fue anulado o no corresponde a un feriado adeudado.' }, { status: 409 })
        }

        await PayrollService.anularLiquidacion(liquidacionId, body.motivo, usuario.id)
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error anulando pago de feriado adeudado:', error)
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'No se pudo anular el pago.',
        }, { status: 400 })
    }
}
