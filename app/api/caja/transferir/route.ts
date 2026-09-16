import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { CajaService } from '@/lib/services/caja.service'
import { exigirAccesoCaja } from '@/lib/services/cajas-catalogo.service'
import type { UsuarioCajas } from '@/lib/caja/catalogo'

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const { origen, destino, monto, fecha } = await req.json()
        const numericMonto = parseFloat(monto)

        if (!origen || !destino || !Number.isFinite(numericMonto) || numericMonto <= 0) {
            return NextResponse.json({ error: 'Datos de transferencia inválidos' }, { status: 400 })
        }

        if (origen === destino) {
            return NextResponse.json({ error: 'La caja de origen y destino deben ser diferentes' }, { status: 400 })
        }

        try {
            await exigirAccesoCaja(session.user as UsuarioCajas, origen)
            await exigirAccesoCaja(session.user as UsuarioCajas, destino)
        } catch { return NextResponse.json({ error: 'Sólo podés transferir entre cajas activas autorizadas de tu sede.' }, { status: 403 }) }

        const result = await CajaService.transferir(
            origen,
            destino,
            numericMonto,
            fecha,
            (session?.user as any)?.id || null,
            (session.user as UsuarioCajas).rol === 'ADMIN' ? undefined : (session.user as UsuarioCajas).ubicacionId || '__sin_sede__',
        )

        return NextResponse.json(result)
    } catch (error: any) {
        console.error('Error en transferencia:', error)
        return NextResponse.json({ 
            error: 'Error al procesar la transferencia',
            details: error?.message || String(error)
        }, { status: 500 })
    }
}
