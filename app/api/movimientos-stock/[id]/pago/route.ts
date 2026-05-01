import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { CajaService } from '@/lib/services/caja.service'

// PUT /api/movimientos-stock/:id/pago — Registrar pago total o parcial (a cuenta)
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        
        // Accept optional cajaOrigen and monto from body
        let selectedCaja = 'caja_chica'
        let montoParcial: number | null = null
        try {
            const body = await request.json()
            if (body.cajaOrigen) selectedCaja = body.cajaOrigen
            if (body.monto !== undefined && body.monto !== null && body.monto !== '') {
                montoParcial = parseFloat(String(body.monto).replace(',', '.'))
            }
        } catch { /* no body = defaults */ }

        const movimiento = await prisma.movimientoStock.findUnique({
            where: { id },
            include: { insumo: true, proveedor: true }
        })

        if (!movimiento || movimiento.tipo !== 'entrada') {
            return NextResponse.json({ error: 'Movimiento no encontrado o no es una compra' }, { status: 404 })
        }

        if (movimiento.estadoPago === 'pagado') {
            return NextResponse.json({ error: 'El movimiento ya se encuentra totalmente pagado' }, { status: 400 })
        }

        if (!movimiento.costoTotal) {
            return NextResponse.json({ error: 'El movimiento no tiene un costo total registrado' }, { status: 400 })
        }

        const yaPagado = movimiento.montoPagado || 0
        const saldoPendiente = movimiento.costoTotal - yaPagado

        if (saldoPendiente <= 0) {
            return NextResponse.json({ error: 'No hay saldo pendiente en este movimiento' }, { status: 400 })
        }

        // Si no se envía monto, se paga todo el saldo pendiente
        const montoAPagar = montoParcial !== null ? montoParcial : saldoPendiente

        if (montoAPagar <= 0) {
            return NextResponse.json({ error: 'El monto a pagar debe ser mayor a 0' }, { status: 400 })
        }

        if (montoAPagar > saldoPendiente + 0.01) {
            return NextResponse.json({ error: `El monto ($${montoAPagar.toLocaleString('es-AR')}) supera el saldo pendiente ($${saldoPendiente.toLocaleString('es-AR')})` }, { status: 400 })
        }

        const nuevoMontoPagado = yaPagado + montoAPagar
        const quedaCompletamentePagado = Math.abs(nuevoMontoPagado - movimiento.costoTotal) < 0.01

        const actualizado = await prisma.$transaction(async (tx) => {
            // 1. Crear categoria Proveedores si no existe
            let cat = await tx.categoriaGasto.findUnique({ where: { nombre: 'Proveedores' } })
            if (!cat) {
                cat = await tx.categoriaGasto.create({ data: { nombre: 'Proveedores', color: '#3498DB' } })
            }

            // 2. Crear Gasto Operativo por el monto abonado
            const gasto = await tx.gastoOperativo.create({
                data: {
                    fecha: new Date(),
                    monto: montoAPagar,
                    descripcion: quedaCompletamentePagado
                        ? `Pago final de deuda — ${movimiento.insumo.nombre} (Prov: ${movimiento.proveedor?.nombre || 'General'})`
                        : `Pago a cuenta — ${movimiento.insumo.nombre} (Prov: ${movimiento.proveedor?.nombre || 'General'}) — Abonado: $${nuevoMontoPagado.toLocaleString('es-AR')} / $${movimiento.costoTotal!.toLocaleString('es-AR')}`,
                    categoriaId: cat.id
                }
            })

            // 3. Crear Movimiento de Caja
            await CajaService.createMovimientoEnTx(tx, {
                tipo: 'egreso',
                concepto: 'pago_proveedor',
                monto: montoAPagar,
                medioPago: selectedCaja.includes('mercado_pago') ? 'transferencia' : 'efectivo',
                cajaOrigen: selectedCaja,
                descripcion: gasto.descripcion,
                gastoId: gasto.id,
                fecha: new Date(),
            })

            // 4. Actualizar el movimiento de stock
            const movActualizado = await tx.movimientoStock.update({
                where: { id },
                data: {
                    estadoPago: quedaCompletamentePagado ? 'pagado' : 'a_cuenta',
                    montoPagado: nuevoMontoPagado,
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
