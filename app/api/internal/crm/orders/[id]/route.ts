import type { ErpOrderDetailItem, ErpOrderDetails } from '@santa-catalina/contracts'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const order = await prisma.pedido.findUnique({
      where: { id },
      include: {
        cliente: {
          select: {
            id: true,
            nombreComercial: true,
            contactoNombre: true,
            contactoTelefono: true,
            direccion: true,
            localidad: true,
            zona: true,
          },
        },
        ubicacion: { select: { id: true, nombre: true } },
        detalles: {
          orderBy: { id: 'asc' },
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
    if (!order) return NextResponse.json({ error: 'El pedido no existe.' }, { status: 404 })

    const groupedItems = new Map<string, ErpOrderDetailItem>()
    for (const detail of order.detalles) {
      const key = `${detail.presentacionId}:${detail.precioUnitario}:${detail.observaciones || ''}`
      const current = groupedItems.get(key)
      const quantity = current ? current.quantity + detail.cantidad : detail.cantidad
      groupedItems.set(key, {
        productId: detail.presentacion.producto.id,
        presentationId: detail.presentacionId,
        productName: detail.presentacion.producto.nombre,
        productCode: detail.presentacion.producto.codigoInterno,
        unitsPerPackage: detail.presentacion.cantidad,
        quantity,
        unitPrice: detail.precioUnitario,
        totalAmount: quantity * detail.precioUnitario,
        totalUnits: quantity * detail.presentacion.cantidad,
        notes: detail.observaciones,
      })
    }

    const response: ErpOrderDetails = {
      id: order.id,
      orderedAt: order.fechaPedido.toISOString(),
      deliveryAt: order.fechaEntrega.toISOString(),
      status: order.estado,
      totalUnits: order.totalUnidades,
      totalPacks: order.totalPacks,
      totalAmount: order.totalImporte,
      paid: order.abonado,
      paymentMethod: order.medioPago,
      fulfillment: order.esRetiro ? 'PICKUP' : 'DELIVERY',
      shift: order.turno,
      pickupLocation: order.ubicacion ? { id: order.ubicacion.id, name: order.ubicacion.nombre } : null,
      customer: {
        id: order.cliente.id,
        commercialName: order.cliente.nombreComercial,
        contactName: order.cliente.contactoNombre,
        phone: order.cliente.contactoTelefono,
        currentAddress: order.cliente.direccion,
        locality: order.cliente.localidad,
        zone: order.cliente.zona,
      },
      items: [...groupedItems.values()],
    }
    return NextResponse.json(response, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[CRM internal] No se pudo obtener el pedido:', error)
    return NextResponse.json({ error: 'No se pudo consultar el pedido.' }, { status: 500 })
  }
}
