import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// PUT /api/movimientos-stock/:id/pago — Marcar compra como pagada y generar asiento de caja
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        
        // Accept optional cajaOrigen from body
        let selectedCaja = 'caja_madre'
        try {
            const body = await request.json()
            if (body.cajaOrigen) selectedCaja = body.cajaOrigen
        } catch { /* no body = default caja_madre */ }

        const movimiento = await prisma.movimientoStock.findUnique({
            where: { id },
            include: { insumo: true, proveedor: true }
        })

        if (!movimiento || movimiento.tipo !== 'entrada') {
            return NextResponse.json({ error: 'Movimiento no encontrado o no es una compra' }, { status: 404 })
        }

        if (movimiento.estadoPago === 'pagado') {
            return NextResponse.json({ error: 'El movimiento ya se encuentra pagado' }, { status: 400 })
        }

        if (!movimiento.costoTotal) {
            return NextResponse.json({ error: 'El movimiento no tiene un costo total registrado' }, { status: 400 })
        }

        const actualizado = await prisma.$transaction(async (tx) => {
            // 1. Crear categoria Proveedores si no existe
            let cat = await tx.categoriaGasto.findUnique({ where: { nombre: 'Proveedores' } })
            if (!cat) {
                cat = await tx.categoriaGasto.create({ data: { nombre: 'Proveedores', color: '#3498DB' } })
            }

            // 2. Crear Gasto Operativo
            const gasto = await tx.gastoOperativo.create({
                data: {
                    fecha: new Date(), // Se gasta HOY la plata.
                    monto: movimiento.costoTotal || 0,
                    descripcion: `Pago de deuda — ${movimiento.insumo.nombre} (Prov: ${movimiento.proveedor?.nombre || 'General'})`,
                    categoriaId: cat.id
                }
            })

            // 3. Crear Movimiento de Caja vinculado al gasto
            const movCaja = await tx.movimientoCaja.create({
                data: {
                    tipo: 'egreso',
                    concepto: 'pago_proveedor',
                    monto: movimiento.costoTotal || 0,
                    medioPago: 'efectivo',
                    cajaOrigen: selectedCaja,
                    descripcion: gasto.descripcion,
                    gastoId: gasto.id,
                    fecha: new Date()
                }
            })

            // 4. Actualizar Saldo de Caja
            const saldo = await tx.saldoCaja.findUnique({ where: { tipo: selectedCaja } })
            if (saldo) {
                await tx.saldoCaja.update({
                    where: { tipo: selectedCaja },
                    data: { saldo: { decrement: movimiento.costoTotal || 0 } }
                })
            }

            // 5. Vincular Gasto y cambiar estado a pagado
            const movActualizado = await tx.movimientoStock.update({
                where: { id },
                data: {
                    estadoPago: 'pagado',
                    gastoId: gasto.id
                },
                include: {
                    insumo: { select: { id: true, nombre: true, unidadMedida: true } },
                    proveedor: { select: { id: true, nombre: true } },
                }
            })

            return movActualizado
        })

        return NextResponse.json(actualizado)
    } catch (error) {
        console.error('Error actualizando pago de movimiento:', error)
        return NextResponse.json({ error: 'Error al actualizar el estado de pago' }, { status: 500 })
    }
}
