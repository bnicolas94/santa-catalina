import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { empleadoId, remeraTalle, buzoTalle, remeraCant, buzoCant } = body

        // 1. Upsert TalleUniforme with the sizes and impreso = true
        await prisma.talleUniforme.upsert({
            where: { empleadoId },
            update: { 
                remera: remeraTalle || null, 
                buzo: buzoTalle || null,
                impreso: true 
            },
            create: { 
                empleadoId, 
                remera: remeraTalle || null, 
                buzo: buzoTalle || null,
                impreso: true
            }
        })

        // 2. Create EntregaUniforme
        const entrega = await prisma.entregaUniforme.create({
            data: {
                empleadoId,
                remera: Number(remeraCant) || 0,
                buzo: Number(buzoCant) || 0,
                fecha: new Date(),
                observaciones: 'Impreso desde planilla central'
            }
        })

        return NextResponse.json({ success: true, entregaId: entrega.id })
    } catch (error: any) {
        return NextResponse.json({ error: 'Error al procesar impresión', detalle: error.message }, { status: 500 })
    }
}
