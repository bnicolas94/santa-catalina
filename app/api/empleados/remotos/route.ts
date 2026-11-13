import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { canAccessPath, type AccessToken } from '@/lib/access-control'
import { consultarTrabajadoresRemotos } from '@/lib/services/trabajadores-remotos.service'

export async function GET() {
    const sesion = await getServerSession(authOptions)
    const usuario = sesion?.user as ({ id?: string } & AccessToken) | undefined
    if (!usuario?.id) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
    if (!canAccessPath('/api/empleados/remotos', usuario)) {
        return NextResponse.json({ error: 'Sin permiso para consultar Personal.' }, { status: 403 })
    }
    try {
        return NextResponse.json(await consultarTrabajadoresRemotos(), { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (error) {
        console.error('Error al consultar trabajadores remotos:', error)
        return NextResponse.json({ error: 'No se pudo consultar el fichado remoto.' }, { status: 500 })
    }
}
