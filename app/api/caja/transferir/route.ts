import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { CajaService } from '@/lib/services/caja.service'
import { puedeTransferirEntreCajas } from '@/lib/caja/acceso'

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const { origen, destino, monto, fecha } = await req.json()
        const numericMonto = parseFloat(monto)

        if (!origen || !destino || !numericMonto || numericMonto <= 0) {
            return NextResponse.json({ error: 'Datos de transferencia inválidos' }, { status: 400 })
        }

        if (origen === destino) {
            return NextResponse.json({ error: 'La caja de origen y destino deben ser diferentes' }, { status: 400 })
        }

        // Validación de ubicación
        const userRol = (session?.user as any)?.rol
        if (userRol !== 'ADMIN') {
            const uType = (session?.user as any)?.ubicacionTipo?.toUpperCase()
            if (!puedeTransferirEntreCajas(uType, origen, destino)) {
                return NextResponse.json({ error: 'No tienes permiso para operar en estas cajas' }, { status: 403 })
            }
        }

        const result = await CajaService.transferir(
            origen,
            destino,
            numericMonto,
            fecha,
            (session?.user as any)?.id || null,
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
