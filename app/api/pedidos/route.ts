import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/pedidos
export async function GET() {
    try {
        const pedidos = await prisma.pedido.findMany({
            orderBy: { fechaPedido: 'desc' },
            include: {
                cliente: { select: { id: true, nombreComercial: true, zona: true, latitud: true, longitud: true, direccion: true } },
                detalles: {
                    include: {
                        presentacion: {
                            include: {
                                producto: { select: { id: true, nombre: true, codigoInterno: true } },
                            },
                        },
                    },
                },
            },
        })
        return NextResponse.json(pedidos)
    } catch (error) {
        console.error('Error fetching pedidos:', error)
        return NextResponse.json({ error: 'Error al obtener pedidos' }, { status: 500 })
    }
}

// POST /api/pedidos
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { clienteId, fechaEntrega, detalles, medioPago } = body

        if (!clienteId || !fechaEntrega || !detalles?.length) {
            return NextResponse.json({ error: 'Cliente, fecha de entrega y al menos un producto son requeridos' }, { status: 400 })
        }

        let totalUnidades = 0
        let totalImporte = 0
        const detallesCreate = []

        for (const det of detalles) {
            const presentacion = await prisma.presentacion.findUnique({
                where: { id: det.presentacionId },
            })
            if (!presentacion) continue
            const precio = presentacion.precioVenta
            const cant = parseInt(det.cantidad)
            totalUnidades += cant * presentacion.cantidad // total sándwiches
            totalImporte += cant * precio
            detallesCreate.push({
                presentacionId: det.presentacionId,
                cantidad: cant,
                precioUnitario: precio,
            })
        }

        const pedido = await prisma.pedido.create({
            data: {
                clienteId,
                fechaPedido: new Date(),
                fechaEntrega: new Date(fechaEntrega),
                medioPago: medioPago || 'efectivo',
                totalUnidades,
                totalImporte,
                detalles: { create: detallesCreate },
            },
            include: {
                cliente: { select: { id: true, nombreComercial: true } },
                detalles: {
                    include: {
                        presentacion: {
                            include: { producto: { select: { id: true, nombre: true, codigoInterno: true } } },
                        },
                    },
                },
            },
        })

        return NextResponse.json(pedido, { status: 201 })
    } catch (error) {
        console.error('Error creating pedido:', error)
        return NextResponse.json({ error: 'Error al crear pedido' }, { status: 500 })
    }
}
