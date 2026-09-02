import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const limiteSolicitado = Number(searchParams.get('limit') || 100)
        const take = Number.isFinite(limiteSolicitado)
            ? Math.min(Math.max(Math.trunc(limiteSolicitado), 1), 500)
            : 100

        const compras = await prisma.compra.findMany({
            where: searchParams.get('conGastos') === 'true'
                ? { gastos: { some: { tipoRegistro: 'concepto_compra' } } }
                : undefined,
            orderBy: { fechaMovimiento: 'desc' },
            take,
            include: {
                proveedor: { select: { id: true, nombre: true } },
                ubicacion: { select: { id: true, nombre: true } },
                movimientosStock: { select: { id: true } },
                gastos: {
                    where: { tipoRegistro: 'concepto_compra' },
                    orderBy: { createdAt: 'asc' },
                    include: { categoria: { select: { id: true, nombre: true, color: true } } },
                },
            },
        })

        return NextResponse.json(compras)
    } catch (error) {
        console.error('Error obteniendo facturas:', error)
        return NextResponse.json({ error: 'No se pudieron obtener las facturas' }, { status: 500 })
    }
}
