import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import type { MedioPagoMixto } from '@/lib/payroll/cierreMensualMixto'
import { CierreMensualMixtoService } from '@/lib/services/cierre-mensual-mixto.service'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions)
        const usuario = session?.user as { id?: string; rol?: string } | undefined
        if (!usuario?.id) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
        if (usuario.rol !== 'ADMIN') {
            return NextResponse.json({ error: 'Sólo un administrador puede registrar estos pagos.' }, { status: 403 })
        }

        const { id } = await context.params
        const body = await request.json() as Record<string, unknown>
        const medio = typeof body.medio === 'string' ? body.medio : ''
        const cajaId = typeof body.cajaId === 'string' ? body.cajaId : ''
        if (!['TRANSFERENCIA', 'EFECTIVO'].includes(medio) || !cajaId) {
            return NextResponse.json({ error: 'El medio de pago y la caja son requeridos.' }, { status: 400 })
        }

        const cierre = await CierreMensualMixtoService.pagar({
            cierreId: id,
            medio: medio as MedioPagoMixto,
            cajaId,
            usuarioId: usuario.id,
        })
        return NextResponse.json(cierre)
    } catch (error) {
        console.error('Error pagando cierre mensual mixto:', error)
        const mensaje = error instanceof Error ? error.message : 'No se pudo registrar el pago.'
        const status = mensaje.includes('ya fue registrado') || mensaje.includes('fue anulado') ? 409 : 400
        return NextResponse.json({ error: mensaje }, { status })
    }
}
