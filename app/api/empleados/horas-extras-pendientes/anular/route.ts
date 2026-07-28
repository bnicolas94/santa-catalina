import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { PayrollService } from '@/lib/services/payroll.service'

export async function POST(request: Request) {
    try {
        const body = await request.json() as Record<string, unknown>
        const id = typeof body.id === 'string' ? body.id : ''
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

        await PayrollService.revertirLiquidacion(deuda.liquidacionId)
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error anulando pago de horas extras adeudadas:', error)
        const mensaje = error instanceof Error ? error.message : 'No se pudo anular el pago.'
        return NextResponse.json({ error: mensaje }, { status: 400 })
    }
}
