import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUserReportPrefs, updateUserReportPrefs } from '@/lib/services/reportes'

export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const userId = (session.user as any).id
        const prefs = await getUserReportPrefs(userId)
        
        return NextResponse.json(prefs)
    } catch (error) {
        console.error('Error fetching report preferences:', error)
        return NextResponse.json({ error: 'Error al obtener preferencias' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const userId = (session.user as any).id
        const prefs = await request.json()
        
        await updateUserReportPrefs(userId, prefs)
        
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error saving report preferences:', error)
        return NextResponse.json({ error: 'Error al guardar preferencias' }, { status: 500 })
    }
}
