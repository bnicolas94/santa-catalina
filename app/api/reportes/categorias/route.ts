import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { updateCategoriaOperativa } from '@/lib/services/reportes'
import { revalidateTag } from 'next/cache'

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if ((session?.user as any)?.rol !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
        }

        const { id, esOperativo } = await request.json()
        if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

        await updateCategoriaOperativa(id, esOperativo)
        
        // Invalidar caché de reportes
        try {
            revalidateTag('reportes', 'default')
        } catch (e) {
            console.error('Error revalidating tag:', e)
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error updating category:', error)
        return NextResponse.json({ error: 'Error al actualizar categoría' }, { status: 500 })
    }
}
