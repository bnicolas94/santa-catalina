import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params
        const customer = await prisma.cliente.findUnique({
            where: { id },
            select: {
                id: true,
                nombreComercial: true,
                contactoNombre: true,
                contactoTelefono: true,
                direccion: true,
                zona: true,
                localidad: true,
                segmento: true,
                activo: true,
                _count: { select: { pedidos: true } },
                pedidos: {
                    orderBy: [{ fechaPedido: 'desc' }, { createdAt: 'desc' }],
                    take: 5,
                    select: {
                        id: true,
                        fechaPedido: true,
                        fechaEntrega: true,
                        estado: true,
                        totalUnidades: true,
                        totalPacks: true,
                        totalImporte: true,
                        abonado: true,
                    },
                },
            },
        })
        if (!customer) return NextResponse.json({ error: 'El cliente no existe.' }, { status: 404 })

        return NextResponse.json({
            id: customer.id,
            commercialName: customer.nombreComercial,
            contactName: customer.contactoNombre,
            phone: customer.contactoTelefono,
            address: customer.direccion,
            zone: customer.zona,
            locality: customer.localidad,
            segment: customer.segmento,
            active: customer.activo,
            orderCount: customer._count.pedidos,
            recentOrders: customer.pedidos.map(order => ({
                id: order.id,
                orderedAt: order.fechaPedido.toISOString(),
                deliveryAt: order.fechaEntrega.toISOString(),
                status: order.estado,
                totalUnits: order.totalUnidades,
                totalPacks: order.totalPacks,
                totalAmount: order.totalImporte,
                paid: order.abonado,
            })),
        }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
        console.error('[CRM internal] No se pudo obtener el resumen:', error)
        return NextResponse.json({ error: 'No se pudo consultar el cliente.' }, { status: 500 })
    }
}
