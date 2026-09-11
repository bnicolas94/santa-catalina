import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { diagnosticarPagoMP, validarIdsDiagnostico } from '@/lib/mercadopago-diagnostico'

export const maxDuration = 60

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    if ((session.user as { rol?: string }).rol !== 'ADMIN') return NextResponse.json({ error: 'Sólo ADMIN puede diagnosticar Mercado Pago.' }, { status: 403 })
    let ids: string[]
    try { ids = validarIdsDiagnostico((await req.json()).ids) }
    catch { return NextResponse.json({ error: 'Ingresá entre 1 y 30 IDs numéricos.' }, { status: 400 }) }
    const token = process.env.MP_ACCESS_TOKEN
    if (!token) return NextResponse.json({ error: 'Mercado Pago no está configurado.' }, { status: 503 })
    try {
        const registros = await prisma.movimientoMercadoPago.findMany({
            where: { mpId: { in: ids } }, select: { mpId: true, movimientoCaja: { select: { estado: true, monto: true, tipo: true, cajaOrigen: true } } },
        })
        const resultados = []
        // Hasta cinco consultas concurrentes, con duración máxima por consulta.
        for (let i = 0; i < ids.length; i += 5) {
            const lote = await Promise.all(ids.slice(i, i + 5).map(id => diagnosticarPagoMP(id, token, process.env.MP_COLLECTOR_ID || '231378824')))
            resultados.push(...lote.map(resultado => {
                const registro = registros.find(r => r.mpId === resultado.id)
                return { ...resultado, registradoMP: Boolean(registro), caja: registro?.movimientoCaja ?? null }
            }))
        }
        return NextResponse.json({ resultados })
    } catch {
        return NextResponse.json({ error: 'No se pudo consultar el registro interno de Caja.' }, { status: 500 })
    }
}
