import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { autorizarOrdenCompra } from '@/lib/compras/ordenes-api'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const acceso = await autorizarOrdenCompra()
    if (acceso.rechazo) return acceso.rechazo
    const { id } = await params
    try {
        const orden = await prisma.ordenCompra.findUnique({ where: { id }, include: { detalles: { orderBy: { posicion: 'asc' } } } })
        return orden ? NextResponse.json(orden) : NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    } catch (error) {
        console.error('Error obteniendo orden:', error)
        return NextResponse.json({ error: 'No se pudo cargar la orden' }, { status: 500 })
    }
}
