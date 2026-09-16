import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listarCajas } from '@/lib/services/cajas-catalogo.service'
import type { UsuarioCajas } from '@/lib/caja/catalogo'

// Listado mínimo para seleccionar el origen de un pago desde Compras.
// No expone operaciones de ajuste de caja.
export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Sesión requerida.' }, { status: 401 })
    const cajas = await listarCajas({ ...session.user as UsuarioCajas, permisos: { permisoCaja: true } })
    return NextResponse.json(cajas.map(c => ({ tipo: c.tipo, nombre: `${c.nombre || c.tipo}${c.ubicacion ? ' · ' + c.ubicacion.nombre : ''}` })))
}
