import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { CajaService } from '@/lib/services/caja.service'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions)
        const usuario = session?.user as { id?: string; rol?: string } | undefined
        if (!usuario?.id) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
        if (usuario.rol !== 'ADMIN') {
            return NextResponse.json({ error: 'Sólo un administrador puede corregir la caja de un pago.' }, { status: 403 })
        }

        const { id } = await context.params
        const body = await request.json() as Record<string, unknown>
        const cajaNueva = typeof body.cajaNueva === 'string' ? body.cajaNueva : ''
        const resultado = await CajaService.reasignarCajaMovimientoRRHH({
            movimientoId: id,
            cajaNueva,
            motivo: body.motivo,
            usuarioId: usuario.id,
        })
        return NextResponse.json(resultado)
    } catch (error) {
        console.error('Error reasignando caja de pago RRHH:', error)
        const mensaje = error instanceof Error ? error.message : 'No se pudo corregir la caja del pago.'
        return NextResponse.json({ error: mensaje }, { status: 400 })
    }
}
