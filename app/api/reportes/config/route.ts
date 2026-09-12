import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { updateGlobalConfig, getGlobalConfig } from '@/lib/services/reportes'
import { revalidateTag } from 'next/cache'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const clave = searchParams.get('clave')
        if (!clave) return NextResponse.json({ error: 'Clave requerida' }, { status: 400 })
        if (clave.startsWith('mp:')) return NextResponse.json({ error: 'El estado de MP se consulta desde Caja.' }, { status: 403 })

        const valor = await getGlobalConfig(clave, null)
        return NextResponse.json({ valor })
    } catch (error) {
        return NextResponse.json({ error: 'Error al obtener config' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if ((session?.user as { rol?: string } | undefined)?.rol !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
        }

        const { clave, valor } = await request.json()
        if (!clave) return NextResponse.json({ error: 'Clave requerida' }, { status: 400 })
        if (typeof clave !== 'string' || clave.startsWith('mp:')) return NextResponse.json({ error: 'Esta configuración es administrada por el proceso de MP.' }, { status: 403 })

        await updateGlobalConfig(clave, valor)
        
        // Invalidar caché de reportes
        try {
            revalidateTag('reportes', 'default')
        } catch (e) {
            console.error('Error revalidating tag:', e)
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error updating config:', error)
        return NextResponse.json({ error: 'Error al actualizar configuración' }, { status: 500 })
    }
}
