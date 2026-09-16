import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { leerConfigDepositos } from '@/lib/caja/configDepositos'

// GET: Obtener la configuración de depósito según la ubicación del usuario o todas si es ADMIN
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const config = await leerConfigDepositos()
        const userUbicacionTipo = (session?.user as { ubicacionId?: string })?.ubicacionId || ''
        const userRol = (session?.user as any)?.rol

        if (userRol === 'ADMIN') {
            return NextResponse.json(config)
        }

        return NextResponse.json(config[userUbicacionTipo] || { habilitarDeposito: false })
    } catch (error) {
        return NextResponse.json({ error: 'Error al obtener configuración' }, { status: 500 })
    }
}

// POST: Actualizar configuración (Solo ADMIN)
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if ((session?.user as any)?.rol !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
        }

        return NextResponse.json({ error: 'La configuración de depósitos se administra desde Cajas por sede.' }, { status: 410 })
    } catch (error) {
        return NextResponse.json({ error: 'Error al guardar configuración' }, { status: 500 })
    }
}
