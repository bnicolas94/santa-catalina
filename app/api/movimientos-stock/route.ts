import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { ComprasService } from '@/lib/services/compras.service'
import {
    CompraValidationError,
    estadoPagoDesdeMontos,
    numeroNoNegativo,
    numeroPositivo,
    validarMontoPagado,
    validarPagosDivididos,
} from '@/lib/compras/validacion'

const ESTADOS_PAGO = new Set(['pagado', 'pendiente', 'a_cuenta'])

function fechaCivil(value: unknown, fallback = new Date()): Date {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? new Date(`${value}T12:00:00Z`)
        : fallback
}

// GET /api/movimientos-stock
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const insumoId = searchParams.get('insumoId')
        const tipo = searchParams.get('tipo')
        const requestedLimit = Number(searchParams.get('limit') || 100)
        const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 500) : 100

        const movimientos = await prisma.movimientoStock.findMany({
            where: {
                ...(insumoId ? { insumoId } : {}),
                ...(tipo === 'entrada' || tipo === 'salida' ? { tipo } : {}),
            },
            orderBy: { fecha: 'desc' },
            take: limit,
            include: {
                insumo: { select: { id: true, nombre: true, unidadMedida: true, unidadSecundaria: true } },
                proveedor: { select: { id: true, nombre: true } },
                loteOrigen: { select: { id: true } },
                ubicacion: { select: { id: true, nombre: true } },
                compra: {
                    select: {
                        id: true,
                        costoTotal: true,
                        montoPagado: true,
                        estadoPago: true,
                        numeroFactura: true,
                    },
                },
            },
        })
        return NextResponse.json(movimientos)
    } catch (error) {
        console.error('Error fetching movimientos:', error)
        return NextResponse.json({ error: 'Error al obtener movimientos' }, { status: 500 })
    }
}

// POST /api/movimientos-stock
export async function POST(request: Request) {
    try {
        const body = await request.json() as Record<string, unknown>
        const insumoId = String(body.insumoId || '')
        const tipo = String(body.tipo || '')
        const ubicacionId = String(body.ubicacionId || '')
        if (!insumoId || !ubicacionId) throw new CompraValidationError('Faltan insumo o ubicación')
        if (tipo !== 'entrada' && tipo !== 'salida') throw new CompraValidationError('Tipo debe ser entrada o salida')

        const cantidad = numeroPositivo(body.cantidad, 'Cantidad')
        const cantidadSecundaria = body.cantidadSecundaria
            ? numeroPositivo(body.cantidadSecundaria, 'Cantidad secundaria')
            : null
        const costoTotal = body.costoTotal === '' || body.costoTotal === undefined
            ? null
            : numeroNoNegativo(body.costoTotal, 'Costo total')
        const observaciones = String(body.observaciones || '').trim() || null
        const proveedorId = String(body.proveedorId || '') || null
        const fechaMovimiento = fechaCivil(body.fechaMovimiento)
        const fechaFactura = body.fechaFactura ? fechaCivil(body.fechaFactura) : null
        const fechaVencimiento = body.fechaVencimiento ? fechaCivil(body.fechaVencimiento) : null

        const estadoSolicitado = String(body.estadoPago || 'pendiente')
        if (tipo === 'entrada' && !ESTADOS_PAGO.has(estadoSolicitado)) {
            throw new CompraValidationError('Estado de pago inválido')
        }

        const total = costoTotal || 0
        const montoPagado = tipo !== 'entrada' || total === 0
            ? 0
            : estadoSolicitado === 'pagado'
                ? total
                : estadoSolicitado === 'a_cuenta'
                    ? numeroPositivo(body.montoPagado, 'Monto pagado')
                    : 0
        validarMontoPagado(total, montoPagado)
        if (estadoSolicitado === 'a_cuenta' && montoPagado >= total) {
            throw new CompraValidationError('El pago a cuenta debe ser menor al total')
        }
        const estadoPago = tipo === 'entrada' ? estadoPagoDesdeMontos(total, montoPagado) : null
        const cajaOrigen = String(body.cajaOrigen || 'caja_chica')
        const pagos = montoPagado > 0
            ? validarPagosDivididos(body.pagoDividido ? body.pagos : undefined, montoPagado, cajaOrigen)
            : []

        const result = await prisma.$transaction(async tx => {
            if (tipo === 'entrada' && proveedorId) {
                await tx.insumoProveedor.upsert({
                    where: { insumoId_proveedorId: { insumoId, proveedorId } },
                    update: {},
                    create: { insumoId, proveedorId },
                })
            }
            const compra = tipo === 'entrada'
                ? await tx.compra.create({
                    data: {
                        proveedorId,
                        ubicacionId,
                        numeroFactura: String(body.numeroFactura || '') || null,
                        fechaMovimiento,
                        fechaFactura,
                        estadoPago: estadoPago || 'pendiente',
                        costoTotal: total,
                        montoPagado,
                        observaciones,
                    },
                })
                : null

            let gastoId: string | null = null
            if (compra && montoPagado > 0) {
                const gasto = await ComprasService.registrarPagoEnTx(tx, {
                    compraId: compra.id,
                    monto: montoPagado,
                    pagos,
                    fecha: fechaMovimiento,
                    ubicacionId,
                    descripcion: estadoPago === 'a_cuenta'
                        ? `Pago a cuenta de compra - ${observaciones || 'Directa'}`
                        : `Compra de insumos - ${observaciones || 'Directa'}`,
                })
                gastoId = gasto.id
            }

            const movimiento = await tx.movimientoStock.create({
                data: {
                    insumoId,
                    tipo,
                    fecha: fechaMovimiento,
                    cantidad,
                    cantidadSecundaria,
                    observaciones,
                    proveedorId,
                    costoTotal,
                    estadoPago,
                    montoPagado,
                    gastoId,
                    compraId: compra?.id || null,
                    fechaVencimiento,
                    fechaFactura,
                    ubicacionId,
                },
            })

            const signo = tipo === 'entrada' ? 1 : -1
            const delta = signo * cantidad
            const deltaSecundario = signo * (cantidadSecundaria || 0)
            await tx.insumo.update({
                where: { id: insumoId },
                data: {
                    stockActual: { increment: delta },
                    stockActualSecundario: { increment: deltaSecundario },
                    ...(tipo === 'entrada' && costoTotal && body.actualizarCosto
                        ? { precioUnitario: costoTotal / cantidad }
                        : {}),
                },
            })
            await tx.stockInsumo.upsert({
                where: { insumoId_ubicacionId: { insumoId, ubicacionId } },
                update: {
                    cantidad: { increment: delta },
                    cantidadSecundaria: { increment: deltaSecundario },
                },
                create: {
                    insumoId,
                    ubicacionId,
                    cantidad: delta,
                    cantidadSecundaria: deltaSecundario,
                },
            })

            return tx.movimientoStock.findUnique({
                where: { id: movimiento.id },
                include: { compra: true },
            })
        })

        return NextResponse.json(result, { status: 201 })
    } catch (error) {
        if (error instanceof CompraValidationError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        console.error('Error en POST /api/movimientos-stock:', error)
        return NextResponse.json({ error: 'Error al registrar movimiento' }, { status: 500 })
    }
}
