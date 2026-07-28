import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { CierreMensualMixtoService } from '@/lib/services/cierre-mensual-mixto.service'

function respuestaError(error: unknown) {
    const mensaje = error instanceof Error ? error.message : 'No se pudo procesar el cierre mensual.'
    const status = mensaje.includes('ya tiene un cierre') || mensaje.includes('superpuestas') ? 409 : 400
    return NextResponse.json({ error: mensaje }, { status })
}

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        const usuario = session?.user as { id?: string; rol?: string } | undefined
        if (!usuario?.id) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
        if (usuario.rol !== 'ADMIN') {
            return NextResponse.json({ error: 'Sólo un administrador puede consultar estos cierres.' }, { status: 403 })
        }

        const periodo = new URL(request.url).searchParams.get('periodo') || ''
        return NextResponse.json({
            periodo,
            empleados: await CierreMensualMixtoService.obtener(periodo),
        })
    } catch (error) {
        console.error('Error obteniendo cierres mensuales mixtos:', error)
        return respuestaError(error)
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        const usuario = session?.user as { id?: string; rol?: string } | undefined
        if (!usuario?.id) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
        if (usuario.rol !== 'ADMIN') {
            return NextResponse.json({ error: 'Sólo un administrador puede cerrar un período mensual.' }, { status: 403 })
        }

        const body = await request.json() as Record<string, unknown>
        const empleadoId = typeof body.empleadoId === 'string' ? body.empleadoId : ''
        const periodo = typeof body.periodo === 'string' ? body.periodo : ''
        if (!empleadoId || !periodo) {
            return NextResponse.json({ error: 'El empleado y el período son requeridos.' }, { status: 400 })
        }

        const cierre = await CierreMensualMixtoService.cerrar({
            empleadoId,
            periodo,
            netoRecibo: body.netoRecibo,
        })
        return NextResponse.json(cierre, { status: 201 })
    } catch (error) {
        console.error('Error creando cierre mensual mixto:', error)
        return respuestaError(error)
    }
}
