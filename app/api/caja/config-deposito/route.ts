import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { guardarConfigDepositos, leerConfigDepositos } from '@/lib/caja/configDepositos'

// GET: Obtener la configuración de depósito según la ubicación del usuario o todas si es ADMIN
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const config = await leerConfigDepositos()
        const userUbicacionTipo = ((session?.user as any)?.ubicacionTipo || 'LOCAL').toUpperCase()
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

        const body = await req.json()
        await guardarConfigDepositos(body)

        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: 'Error al guardar configuración' }, { status: 500 })
    }
}
