import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { PayrollService } from '@/lib/services/payroll.service'

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const session = await getServerSession(authOptions)
        const usuario = session?.user as { id?: string; rol?: string } | undefined
        if (!usuario?.id) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
        if (usuario.rol !== 'ADMIN') {
            return NextResponse.json({ error: 'Sólo un administrador puede anular liquidaciones.' }, { status: 403 })
        }

        const { id } = await params
        const body = await request.json() as Record<string, unknown>
        const liquidacion = await PayrollService.anularLiquidacion(id, body.motivo, usuario.id)
        return NextResponse.json(liquidacion)
    } catch (error) {
        console.error('Error anulando liquidación:', error)
        const mensaje = error instanceof Error ? error.message : 'No se pudo anular la liquidación.'
        const status = /motivo de anulación/i.test(mensaje)
            ? 400
            : /no encontrada/i.test(mensaje)
                ? 404
                : /(ya fue|sólo puede|históric|Caja|movimiento|importe)/i.test(mensaje)
                    ? 409
                    : 500
        return NextResponse.json({ error: status === 500 ? 'No se pudo anular la liquidación.' : mensaje }, { status })
    }
}
