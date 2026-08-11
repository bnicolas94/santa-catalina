import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { ComprasService } from '@/lib/services/compras.service'
import {
    CompraValidationError,
    distribuirMontoPagadoPorCostos,
    estadoPagoDesdeMontos,
    numeroNoNegativo,
    numeroPositivo,
    validarMontoPagado,
    validarIdsEdicionCompra,
} from '@/lib/compras/validacion'

type ItemEdicion = {
    movimientoId: string | null
    insumoId: string | null
    insumoNombre: string | null
    unidadMedida: string
    cantidad: number
    cantidadSecundaria: number
    costoTotal: number
    fechaVencimiento: Date | null
    actualizarCosto: boolean
}

function fechaCivil(value: unknown, fallback: Date): Date {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback
    const fecha = new Date(`${value}T12:00:00Z`)
    const [anio, mes, dia] = value.split('-').map(Number)
    if (
        Number.isNaN(fecha.getTime())
        || fecha.getUTCFullYear() !== anio
        || fecha.getUTCMonth() + 1 !== mes
        || fecha.getUTCDate() !== dia
    ) throw new CompraValidationError('Fecha inválida')
    return fecha
}

function incluirCompraCompleta() {
    return {
        proveedor: { select: { id: true, nombre: true } },
        ubicacion: { select: { id: true, nombre: true, tipo: true } },
        movimientosStock: {
            orderBy: { createdAt: 'asc' as const },
            include: {
                insumo: {
                    select: {
                        id: true,
                        nombre: true,
                        unidadMedida: true,
                        unidadSecundaria: true,
                    },
                },
            },
        },
    }
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const compra = await prisma.compra.findUnique({
            where: { id },
            include: incluirCompraCompleta(),
        })
        if (!compra) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
        return NextResponse.json(compra)
    } catch (error) {
        console.error('Error obteniendo factura:', error)
        return NextResponse.json({ error: 'Error al obtener la factura' }, { status: 500 })
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json() as Record<string, unknown>
        const proveedorIdSolicitado = String(body.proveedorId || '') || null
        const proveedorNombre = String(body.proveedorNombre || '').trim() || null
        const ubicacionId = String(body.ubicacionId || '')
        if ((!proveedorIdSolicitado && !proveedorNombre) || !ubicacionId) {
            throw new CompraValidationError('Seleccione proveedor y ubicación')
        }
        if (!Array.isArray(body.items) || body.items.length === 0) {
            throw new CompraValidationError('La factura debe conservar al menos un ítem')
        }

        const items: ItemEdicion[] = body.items.map((raw, index) => {
            if (!raw || typeof raw !== 'object') throw new CompraValidationError(`Ítem ${index + 1} inválido`)
            const item = raw as Record<string, unknown>
            const insumoId = String(item.insumoId || '') || null
            const insumoNombre = String(item.insumoNombre || '').trim() || null
            if (!insumoId && !insumoNombre) throw new CompraValidationError(`Seleccione el insumo del ítem ${index + 1}`)
            return {
                movimientoId: String(item.movimientoId || '') || null,
                insumoId,
                insumoNombre,
                unidadMedida: String(item.unidadMedida || 'unidades'),
                cantidad: numeroPositivo(item.cantidad, `Cantidad del ítem ${index + 1}`),
                cantidadSecundaria: item.cantidadSecundaria
                    ? numeroPositivo(item.cantidadSecundaria, `Cantidad secundaria del ítem ${index + 1}`)
                    : 0,
                costoTotal: numeroNoNegativo(item.costoTotal, `Costo del ítem ${index + 1}`),
                fechaVencimiento: item.fechaVencimiento
                    ? fechaCivil(item.fechaVencimiento, new Date())
                    : null,
                actualizarCosto: item.actualizarCosto === true,
            }
        })

        const idsRecibidos = items.flatMap(item => item.movimientoId ? [item.movimientoId] : [])

        const resultado = await prisma.$transaction(async tx => {
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'compra:' + id}))::text AS lock_result`
            const compra = await tx.compra.findUnique({
                where: { id },
                include: { movimientosStock: true },
            })
            if (!compra) throw new CompraValidationError('Factura no encontrada')
            validarIdsEdicionCompra(compra.movimientosStock.map(item => item.id), idsRecibidos)

            const costoTotal = items.reduce((acc, item) => acc + item.costoTotal, 0)
            validarMontoPagado(costoTotal, compra.montoPagado)
            const estadoPago = estadoPagoDesdeMontos(costoTotal, compra.montoPagado)
            const numeroFactura = String(body.numeroFactura || '').trim() || null
            const observaciones = String(body.observaciones || '').trim() || null
            const fechaMovimiento = fechaCivil(body.fechaMovimiento, compra.fechaMovimiento)
            const fechaFactura = body.fechaFactura
                ? fechaCivil(body.fechaFactura, compra.fechaFactura || compra.fechaMovimiento)
                : null

            let proveedorId = proveedorIdSolicitado
            if (!proveedorId && proveedorNombre) {
                const existente = await tx.proveedor.findFirst({
                    where: { nombre: { equals: proveedorNombre, mode: 'insensitive' } },
                })
                proveedorId = existente?.id || (await tx.proveedor.create({ data: { nombre: proveedorNombre } })).id
            } else if (proveedorId) {
                const proveedor = await tx.proveedor.findUnique({ where: { id: proveedorId } })
                if (!proveedor) throw new CompraValidationError('Proveedor no encontrado')
            }

            for (const movimiento of compra.movimientosStock) {
                await ComprasService.aplicarStockEnTx(tx, {
                    insumoId: movimiento.insumoId,
                    ubicacionId: movimiento.ubicacionId,
                    cantidad: movimiento.cantidad,
                    cantidadSecundaria: movimiento.cantidadSecundaria,
                }, -1)
            }

            const cacheInsumos = new Map<string, string>()
            const itemsResueltos = []
            for (const item of items) {
                let insumoId = item.insumoId
                if (!insumoId && item.insumoNombre) {
                    const clave = item.insumoNombre.toLocaleLowerCase('es-AR')
                    insumoId = cacheInsumos.get(clave) || null
                    if (!insumoId) {
                        const existente = await tx.insumo.findFirst({
                            where: { nombre: { equals: item.insumoNombre, mode: 'insensitive' } },
                        })
                        insumoId = existente?.id || (await tx.insumo.create({
                            data: {
                                nombre: item.insumoNombre,
                                unidadMedida: item.unidadMedida,
                                proveedorId,
                            },
                        })).id
                        cacheInsumos.set(clave, insumoId)
                    }
                }
                if (!insumoId) throw new CompraValidationError('No se pudo resolver un insumo')
                itemsResueltos.push({ ...item, insumoId })
            }

            const idsConservados = itemsResueltos.flatMap(item => item.movimientoId ? [item.movimientoId] : [])
            await tx.movimientoStock.deleteMany({
                where: {
                    compraId: id,
                    ...(idsConservados.length > 0 ? { id: { notIn: idsConservados } } : {}),
                },
            })

            const montosPorItem = distribuirMontoPagadoPorCostos(itemsResueltos.map(item => item.costoTotal), compra.montoPagado)
            for (let index = 0; index < itemsResueltos.length; index += 1) {
                const item = itemsResueltos[index]
                const montoItem = montosPorItem[index]
                const data = {
                    insumoId: item.insumoId,
                    tipo: 'entrada',
                    fecha: fechaMovimiento,
                    cantidad: item.cantidad,
                    cantidadSecundaria: item.cantidadSecundaria,
                    observaciones,
                    proveedorId,
                    numeroFactura,
                    costoTotal: item.costoTotal,
                    estadoPago,
                    montoPagado: montoItem,
                    fechaVencimiento: item.fechaVencimiento,
                    fechaFactura,
                    ubicacionId,
                    compraId: id,
                }
                if (item.movimientoId) {
                    await tx.movimientoStock.update({ where: { id: item.movimientoId }, data })
                } else {
                    await tx.movimientoStock.create({ data })
                }

                await ComprasService.aplicarStockEnTx(tx, {
                    insumoId: item.insumoId,
                    ubicacionId,
                    cantidad: item.cantidad,
                    cantidadSecundaria: item.cantidadSecundaria,
                }, 1)
                if (item.actualizarCosto && item.costoTotal > 0) {
                    await tx.insumo.update({
                        where: { id: item.insumoId },
                        data: { precioUnitario: item.costoTotal / item.cantidad },
                    })
                }
            }

            await tx.gastoOperativo.updateMany({
                where: { compraId: id },
                data: { ubicacionId },
            })
            await tx.compra.update({
                where: { id },
                data: {
                    proveedorId,
                    ubicacionId,
                    numeroFactura,
                    fechaMovimiento,
                    fechaFactura,
                    observaciones,
                    costoTotal,
                    estadoPago,
                },
            })

            return tx.compra.findUnique({
                where: { id },
                include: incluirCompraCompleta(),
            })
        })

        return NextResponse.json(resultado)
    } catch (error) {
        if (error instanceof CompraValidationError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        console.error('Error editando factura:', error)
        return NextResponse.json({ error: 'Error al editar la factura' }, { status: 500 })
    }
}
