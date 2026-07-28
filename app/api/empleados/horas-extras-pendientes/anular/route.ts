import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
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
        const id = typeof body.id === 'string' ? body.id : ''
        const motivo = body.motivo
        if (!id) return NextResponse.json({ error: 'El pago es requerido.' }, { status: 400 })

        const deuda = await prisma.horaExtraPendiente.findUnique({
            where: { id },
            select: { pagado: true, liquidacionId: true },
        })
        if (!deuda?.pagado || !deuda.liquidacionId) {
            return NextResponse.json({ error: 'El pago no existe o ya fue anulado.' }, { status: 409 })
        }

        const liquidacion = await prisma.liquidacionSueldo.findUnique({
            where: { id: deuda.liquidacionId },
            select: { tipo: true },
        })
        if (!liquidacion || liquidacion.tipo !== 'HORAS_EXTRAS_ADEUDADAS') {
            return NextResponse.json({ error: 'La deuda no está vinculada a un pago de horas extras válido.' }, { status: 409 })
        }

        await PayrollService.anularLiquidacion(deuda.liquidacionId, motivo, usuario.id)
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error anulando pago de horas extras adeudadas:', error)
        const mensaje = error instanceof Error ? error.message : 'No se pudo anular el pago.'
        return NextResponse.json({ error: mensaje }, { status: 400 })
    }
}
