import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { exigirAccesoCaja } from '@/lib/services/cajas-catalogo.service'
import type { UsuarioCajas } from '@/lib/caja/catalogo'

// El middleware ya valida Compras/Stock; este control adicional limita las cajas a la sede.
export async function autorizarCajasCompra(tipos: string[]) {
    if (!tipos.length) return
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Sesión requerida.' }, { status: 401 })
    const usuario = session.user as UsuarioCajas
    try {
        for (const tipo of new Set(tipos)) await exigirAccesoCaja({ ...usuario, permisos: { permisoCaja: true } }, tipo)
    } catch { return NextResponse.json({ error: 'El pago requiere una caja activa de tu sede.' }, { status: 403 }) }
}
