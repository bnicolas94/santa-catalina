import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getProduccionReport } from '@/lib/services/reportes'
import { revalidateTag } from 'next/cache'
import { tienePermisoEnSesion } from '@/lib/auth/permisosSesion'

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        if (!tienePermisoEnSesion(session, 'permisoReportes')) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const ubicacionId = searchParams.get('ubicacionId') || undefined
        const refresh = searchParams.get('refresh') === 'true'

        if (refresh) {
            revalidateTag('reportes', 'default')
        }
        const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires',
            year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
        let desdeIso = searchParams.get('desde')
        let hastaIso = searchParams.get('hasta')

        if (!desdeIso || !hastaIso) {
            const mes = Number(searchParams.get('mes') || hoy.slice(5, 7))
            const anio = Number(searchParams.get('anio') || hoy.slice(0, 4))
            if (!Number.isInteger(mes) || mes < 1 || mes > 12 || !Number.isInteger(anio) || anio < 2000 || anio > 2100) {
                return NextResponse.json({ error: 'Mes o año inválido' }, { status: 400 })
            }
            desdeIso = `${anio}-${String(mes).padStart(2, '0')}-01`
            hastaIso = new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10)
        }

        const data = await getProduccionReport(desdeIso, hastaIso, ubicacionId)

        return NextResponse.json(data)

    } catch (error) {
        if (error instanceof Error && (error.message.includes('fechas válidas') || error.message.includes('período de hasta'))) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        console.error('Error calculando reporte producción:', error)
        return NextResponse.json({ error: 'Error calculando reporte' }, { status: 500 })
    }
}
