import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { construirHistorialProveedor, resumirHistorialProveedor } from '@/lib/proveedores/historial'

const pagosSelect = {
    id: true, fecha: true, monto: true, medioPago: true, cajaOrigen: true,
    tipo: true, estado: true, movimientoReversaDeId: true,
} as const
const sedeSelect = { id: true, nombre: true } as const
const stockSelect = {
    id: true, cantidad: true, costoTotal: true,
    insumo: { select: { nombre: true, unidadMedida: true } },
} as const

// GET /api/proveedores/[id]
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const proveedor = await prisma.proveedor.findUnique({
            where: { id },
            include: {
                insumos: {
                    include: {
                        familia: true
                    }
                },
                _count: {
                    select: {
                        insumos: true,
                        movimientosStock: true,
                        compras: true
                    }
                }
            }
        })

        if (!proveedor) {
            return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
        }

        const [compras, historicos] = await Promise.all([
            prisma.compra.findMany({
                where: { proveedorId: id },
                select: {
                    id: true, numeroFactura: true, fechaFactura: true, fechaMovimiento: true,
                    costoTotal: true, montoPagado: true, observaciones: true,
                    ubicacion: { select: sedeSelect },
                    movimientosStock: { where: { tipo: 'entrada' }, select: stockSelect },
                    gastos: { select: {
                        id: true, descripcion: true, monto: true, cantidad: true, tipoRegistro: true,
                        categoria: { select: { nombre: true } }, movimientosCaja: { select: pagosSelect },
                    } },
                },
            }),
            prisma.movimientoStock.findMany({
                where: { proveedorId: id, tipo: 'entrada', compraId: null },
                select: {
                    ...stockSelect, numeroFactura: true, fechaFactura: true, fecha: true,
                    montoPagado: true, estadoPago: true, observaciones: true,
                    ubicacion: { select: sedeSelect },
                    gasto: { select: { id: true, movimientosCaja: { select: pagosSelect } } },
                },
            }),
        ])
        const tiposCaja = [...new Set([
            ...compras.flatMap(compra => compra.gastos.flatMap(gasto => gasto.movimientosCaja)),
            ...historicos.flatMap(mov => mov.gasto?.movimientosCaja || []),
        ].flatMap(mov => mov.cajaOrigen ? [mov.cajaOrigen] : []))]
        const cajas = await prisma.saldoCaja.findMany({
            where: { tipo: { in: tiposCaja } },
            select: { tipo: true, nombre: true, ubicacion: { select: { nombre: true } } },
        })
        const facturas = construirHistorialProveedor(compras, historicos, cajas)

        return NextResponse.json({
            ...proveedor,
            facturas,
            resumen: resumirHistorialProveedor(facturas),
            _count: {
                ...proveedor._count,
                compras: facturas.length
            }
        })
    } catch (error) {
        console.error('Error fetching proveedor:', error)
        return NextResponse.json({ error: 'Error al obtener el proveedor' }, { status: 500 })
    }
}

// PATCH /api/proveedores/[id]
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()
        const { nombre, contacto, telefono, email, direccion, categoria, activo } = body

        const proveedor = await prisma.proveedor.update({
            where: { id },
            data: {
                nombre,
                contacto,
                telefono,
                email,
                direccion,
                categoria,
                activo
            }
        })

        return NextResponse.json(proveedor)
    } catch (error) {
        console.error('Error updating proveedor:', error)
        return NextResponse.json({ error: 'Error al actualizar el proveedor' }, { status: 500 })
    }
}

// DELETE /api/proveedores/[id] (Borrado lógico)
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        // Verificamos si tiene movimientos antes de "borrar" (desactivar)
        const count = await prisma.movimientoStock.count({
            where: { proveedorId: id }
        })

        if (count > 0) {
            // Si tiene movimientos, forzamos borrado lógico
            const proveedor = await prisma.proveedor.update({
                where: { id },
                data: { activo: false }
            })
            return NextResponse.json({ message: 'Proveedor desactivado debido a que tiene historial de movimientos', proveedor })
        }

        // Si no tiene historial, lo desactivamos siguiendo el plan.
        const proveedor = await prisma.proveedor.update({
            where: { id },
            data: { activo: false }
        })

        return NextResponse.json({ message: 'Proveedor desactivado correctamente', proveedor })
    } catch (error) {
        console.error('Error deleting proveedor:', error)
        return NextResponse.json({ error: 'Error al procesar la baja del proveedor' }, { status: 500 })
    }
}
