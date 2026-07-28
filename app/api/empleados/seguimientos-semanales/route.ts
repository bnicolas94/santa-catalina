import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { SeguimientoSemanalMixtoService } from '@/lib/services/seguimiento-semanal-mixto.service'

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        const usuario = session?.user as { id?: string; rol?: string } | undefined
        if (!usuario?.id) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
        if (usuario.rol !== 'ADMIN') {
            return NextResponse.json({ error: 'Sólo un administrador puede guardar seguimientos salariales.' }, { status: 403 })
        }

        const body = await request.json() as Record<string, unknown>
        const empleadoId = typeof body.empleadoId === 'string' ? body.empleadoId : ''
        const fechaInicio = typeof body.fechaInicio === 'string' ? body.fechaInicio : ''
        const fechaFin = typeof body.fechaFin === 'string' ? body.fechaFin : ''
        if (!empleadoId || !fechaInicio || !fechaFin) {
            return NextResponse.json({ error: 'El empleado y la semana son requeridos.' }, { status: 400 })
        }

        const resultado = await SeguimientoSemanalMixtoService.guardar({
            empleadoId,
            fechaInicio,
            fechaFin,
            calculatedData: body.calculatedData,
            usuarioId: usuario.id,
        })
        return NextResponse.json(resultado)
    } catch (error) {
        console.error('Error guardando seguimiento semanal mixto:', error)
        const mensaje = error instanceof Error ? error.message : 'No se pudo guardar el seguimiento semanal.'
        return NextResponse.json({ error: mensaje }, { status: 400 })
    }
}
