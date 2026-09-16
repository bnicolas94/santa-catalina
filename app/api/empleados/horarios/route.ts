import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { cargarPlanHorarios, guardarPlanHorario } from '@/lib/services/horarios-empleado.service'
import { validarFechaCivilRRHH } from '@/lib/rrhh/fechas'
import { prisma } from '@/lib/prisma'
import { rangoDiasRRHH } from '@/lib/rrhh/fechas'

export async function GET(request: Request) {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
    try {
        const params = new URL(request.url).searchParams
        const ids = (params.get('empleadoIds') || params.get('empleadoId') || '').split(',').filter(Boolean)
        if (!ids.length || ids.length > 100) throw new Error('Seleccioná hasta cien empleados.')
        const desde = validarFechaCivilRRHH(params.get('desde') || '')
        const hasta = validarFechaCivilRRHH(params.get('hasta') || '')
        if (desde > hasta || new Date(hasta).getTime() - new Date(desde).getTime() > 31 * 86400000) throw new Error('Rango inválido.')
        const [plan, fichadas] = await Promise.all([
            cargarPlanHorarios(ids, desde, hasta),
            prisma.fichadaEmpleado.findMany({ where: { empleadoId: { in: ids }, fechaHora: rangoDiasRRHH(desde, hasta) }, select: { empleadoId: true, fechaHora: true, tipo: true }, orderBy: { fechaHora: 'asc' } }),
        ])
        return NextResponse.json({ ...plan, fichadas })
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo consultar la planificación.' }, { status: 400 })
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions)
    const user = session?.user as { id?: string; rol?: string } | undefined
    if (!user?.id) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
    if (user.rol !== 'ADMIN') return NextResponse.json({ error: 'Sólo ADMIN puede modificar horarios.' }, { status: 403 })
    try {
        return NextResponse.json(await guardarPlanHorario(await request.json(), user.id))
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo guardar el horario.' }, { status: 400 })
    }
}
