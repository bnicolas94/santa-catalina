import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { updateUserReportPrefs, getUserReportPrefs } from '@/lib/services/reportes'

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        const userId = (session?.user as any)?.id
        if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const prefs = await getUserReportPrefs(userId)
        return NextResponse.json(prefs)
    } catch (error) {
        return NextResponse.json({ error: 'Error al obtener preferencias' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        const userId = (session?.user as any)?.id
        
        if (!userId) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
        }

        const { preferencias } = await request.json()
        if (!preferencias) return NextResponse.json({ error: 'Preferencias requeridas' }, { status: 400 })

        await updateUserReportPrefs(userId, preferencias)
        
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error updating prefs:', error)
        return NextResponse.json({ error: 'Error al actualizar preferencias' }, { status: 500 })
    }
}
