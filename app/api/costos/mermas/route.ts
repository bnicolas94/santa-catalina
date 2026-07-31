import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getMermasCostos, registrarMerma, type RegistrarMermaInput } from '@/lib/services/mermas-costos'
import { revalidateTag } from 'next/cache'

async function requireSession() {
    const session = await getServerSession(authOptions)
    if (!session) throw new Error('UNAUTHORIZED')
}

export async function GET(request: Request) {
    try {
        await requireSession()
        const { searchParams } = new URL(request.url)
        const hoy = new Date()
        const mes = Number(searchParams.get('mes') || hoy.getMonth() + 1)
        const anio = Number(searchParams.get('anio') || hoy.getFullYear())
        const desdeParam = searchParams.get('desde')
        const hastaParam = searchParams.get('hasta')
        const desde = desdeParam ? new Date(desdeParam) : new Date(anio, mes - 1, 1)
        const hasta = hastaParam ? new Date(hastaParam) : new Date(anio, mes, 0, 23, 59, 59, 999)

        if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime()) || desde > hasta) {
            return NextResponse.json({ error: 'El rango de fechas no es válido' }, { status: 400 })
        }

        const data = await getMermasCostos(desde, hasta, searchParams.get('ubicacionId') || undefined)
        return NextResponse.json(data)
    } catch (error) {
        if (error instanceof Error && error.message === 'UNAUTHORIZED') {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
        }
        console.error('Error obteniendo mermas de costos:', error)
        return NextResponse.json({ error: 'Error al obtener mermas y desperdicios' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        await requireSession()
        const body = await request.json()
        const input: RegistrarMermaInput = {
            tipo: body.tipo,
            ubicacionId: String(body.ubicacionId || ''),
            cantidad: Number(body.cantidad),
            fecha: body.fecha,
            motivo: String(body.motivo || ''),
            observaciones: body.observaciones ? String(body.observaciones) : undefined,
            insumoId: body.insumoId ? String(body.insumoId) : undefined,
            productoId: body.productoId ? String(body.productoId) : undefined,
            presentacionId: body.presentacionId ? String(body.presentacionId) : undefined
        }

        const resultado = await registrarMerma(input)
        revalidateTag('reportes', 'default')
        return NextResponse.json(resultado, { status: 201 })
    } catch (error) {
        if (error instanceof Error && error.message === 'UNAUTHORIZED') {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
        }
        const message = error instanceof Error ? error.message : 'Error al registrar la merma'
        const esValidacion = /obligatori|inválid|cantidad|stock|existe|superar|cambió/i.test(message)
        if (!esValidacion) console.error('Error registrando merma de costos:', error)
        return NextResponse.json({ error: message }, { status: esValidacion ? 400 : 500 })
    }
}
