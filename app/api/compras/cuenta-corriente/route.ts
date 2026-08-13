import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { agruparMovimientosHistoricos, resumirCuentaCorriente, type FacturaCuentaCorriente } from '@/lib/compras/cuenta-corriente'

export async function GET() {
    try {
        const [compras, movimientosHistoricos] = await Promise.all([
            prisma.compra.findMany({
                where: {
                    estadoPago: { in: ['pendiente', 'a_cuenta'] },
                    costoTotal: { gt: 0 },
                },
                select: {
                    id: true,
                    numeroFactura: true,
                    fechaFactura: true,
                    fechaMovimiento: true,
                    costoTotal: true,
                    montoPagado: true,
                    proveedorId: true,
                    proveedor: { select: { nombre: true } },
                },
            }),
            prisma.movimientoStock.findMany({
                where: {
                    compraId: null,
                    tipo: 'entrada',
                    estadoPago: { in: ['pendiente', 'a_cuenta'] },
                    costoTotal: { gt: 0 },
                },
                select: {
                    id: true,
                    numeroFactura: true,
                    fechaFactura: true,
                    fecha: true,
                    costoTotal: true,
                    montoPagado: true,
                    proveedorId: true,
                    proveedor: { select: { nombre: true } },
                },
            }),
        ])

        const facturasNuevas: FacturaCuentaCorriente[] = compras.map(compra => ({
            id: compra.id,
            proveedorId: compra.proveedorId,
            proveedorNombre: compra.proveedor?.nombre || 'Sin proveedor',
            numeroFactura: compra.numeroFactura,
            fecha: compra.fechaFactura || compra.fechaMovimiento,
            costoTotal: compra.costoTotal,
            montoPagado: compra.montoPagado,
            origen: 'compra',
        }))
        const facturasHistoricas = agruparMovimientosHistoricos(movimientosHistoricos.map(movimiento => ({
            id: movimiento.id,
            proveedorId: movimiento.proveedorId,
            proveedorNombre: movimiento.proveedor?.nombre || 'Sin proveedor',
            numeroFactura: movimiento.numeroFactura,
            fecha: movimiento.fechaFactura || movimiento.fecha,
            costoTotal: movimiento.costoTotal || 0,
            montoPagado: movimiento.montoPagado || 0,
        })))

        return NextResponse.json(resumirCuentaCorriente([...facturasNuevas, ...facturasHistoricas]))
    } catch (error) {
        console.error('Error obteniendo cuenta corriente de proveedores:', error)
        return NextResponse.json({ error: 'No se pudo obtener la cuenta corriente de proveedores' }, { status: 500 })
    }
}
