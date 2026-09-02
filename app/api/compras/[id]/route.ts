import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { ComprasService } from '@/lib/services/compras.service'
import { normalizarNombreInsumo } from '@/lib/insumos/nombres'
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
    tipoItem: 'insumo' | 'gasto'
    movimientoId: string | null
    gastoId: string | null
    insumoId: string | null
    insumoNombre: string | null
    descripcion: string | null
    categoriaGastoId: string | null
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
        gastos: {
            where: { tipoRegistro: 'concepto_compra' },
            orderBy: { createdAt: 'asc' as const },
            include: { categoria: { select: { id: true, nombre: true, color: true } } },
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
            const tipoItem = item.tipoItem === 'gasto' ? 'gasto' : 'insumo'
            const insumoId = String(item.insumoId || '') || null
            const insumoNombre = String(item.insumoNombre || '').trim() || null
            const descripcion = String(item.descripcion || '').trim() || null
            const categoriaGastoId = String(item.categoriaGastoId || '') || null
            if (tipoItem === 'insumo' && !insumoId && !insumoNombre) {
                throw new CompraValidationError(`Seleccione el insumo del ítem ${index + 1}`)
            }
            if (tipoItem === 'gasto' && (!descripcion || !categoriaGastoId)) {
                throw new CompraValidationError(`Complete la descripción y categoría del gasto ${index + 1}`)
            }
            return {
                tipoItem,
                movimientoId: String(item.movimientoId || '') || null,
                gastoId: String(item.gastoId || '') || null,
                insumoId,
                insumoNombre,
                descripcion,
                categoriaGastoId,
                unidadMedida: String(item.unidadMedida || 'unidades'),
                cantidad: tipoItem === 'insumo'
                    ? numeroPositivo(item.cantidad, `Cantidad del ítem ${index + 1}`)
                    : 0,
                cantidadSecundaria: tipoItem === 'insumo' && item.cantidadSecundaria
                    ? numeroPositivo(item.cantidadSecundaria, `Cantidad secundaria del ítem ${index + 1}`)
                    : 0,
                costoTotal: numeroNoNegativo(item.costoTotal, `Costo del ítem ${index + 1}`),
                fechaVencimiento: item.fechaVencimiento
                    ? fechaCivil(item.fechaVencimiento, new Date())
                    : null,
                actualizarCosto: item.actualizarCosto === true,
            }
        })

        const idsMovimientosRecibidos = items.flatMap(item => item.movimientoId ? [item.movimientoId] : [])
        const idsGastosRecibidos = items.flatMap(item => item.gastoId ? [item.gastoId] : [])

        const resultado = await prisma.$transaction(async tx => {
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'compra:' + id}))::text AS lock_result`
            const compra = await tx.compra.findUnique({
                where: { id },
                include: {
                    movimientosStock: true,
                    gastos: { where: { tipoRegistro: 'concepto_compra' } },
                },
            })
            if (!compra) throw new CompraValidationError('Factura no encontrada')
            validarIdsEdicionCompra(compra.movimientosStock.map(item => item.id), idsMovimientosRecibidos)
            validarIdsEdicionCompra(compra.gastos.map(item => item.id), idsGastosRecibidos)

            const categoriasGastoIds = [...new Set(items.flatMap(item => item.categoriaGastoId ? [item.categoriaGastoId] : []))]
            if (categoriasGastoIds.length > 0) {
                const categoriasEncontradas = await tx.categoriaGasto.count({ where: { id: { in: categoriasGastoIds } } })
                if (categoriasEncontradas !== categoriasGastoIds.length) {
                    throw new CompraValidationError('Una de las categorías de gasto no existe')
                }
            }

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
                if (item.tipoItem === 'gasto') {
                    itemsResueltos.push(item)
                    continue
                }
                let insumoId = item.insumoId
                if (!insumoId && item.insumoNombre) {
                    const clave = item.insumoNombre.toLocaleLowerCase('es-AR')
                    insumoId = cacheInsumos.get(clave) || null
                    if (!insumoId) {
                        const candidatos = await tx.insumo.findMany({ where: { activo: true } })
                        const existente = candidatos.find(insumo => normalizarNombreInsumo(insumo.nombre) === normalizarNombreInsumo(item.insumoNombre!))
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
                if (proveedorId) {
                    await tx.insumoProveedor.upsert({
                        where: { insumoId_proveedorId: { insumoId, proveedorId } },
                        update: {},
                        create: { insumoId, proveedorId },
                    })
                }
                itemsResueltos.push({ ...item, insumoId })
            }

            const itemsStock = itemsResueltos
                .filter(item => item.tipoItem === 'insumo' && item.insumoId)
                .map(item => ({ ...item, insumoId: item.insumoId! }))
            const itemsGasto = itemsResueltos.filter(item => item.tipoItem === 'gasto')
            const idsConservados = itemsStock.flatMap(item => item.movimientoId ? [item.movimientoId] : [])
            await tx.movimientoStock.deleteMany({
                where: {
                    compraId: id,
                    ...(idsConservados.length > 0 ? { id: { notIn: idsConservados } } : {}),
                },
            })
            const idsGastosConservados = itemsGasto.flatMap(item => item.gastoId ? [item.gastoId] : [])
            await tx.gastoOperativo.deleteMany({
                where: {
                    compraId: id,
                    tipoRegistro: 'concepto_compra',
                    ...(idsGastosConservados.length > 0 ? { id: { notIn: idsGastosConservados } } : {}),
                },
            })

            const montosPorItem = distribuirMontoPagadoPorCostos(
                itemsStock.map(item => item.costoTotal),
                compra.montoPagado,
                costoTotal
            )
            for (let index = 0; index < itemsStock.length; index += 1) {
                const item = itemsStock[index]
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

            for (const item of itemsGasto) {
                const data = {
                    fecha: fechaFactura || fechaMovimiento,
                    monto: item.costoTotal,
                    descripcion: item.descripcion!,
                    categoriaId: item.categoriaGastoId!,
                    compraId: id,
                    tipoRegistro: 'concepto_compra',
                    ubicacionId,
                }
                if (item.gastoId) {
                    await tx.gastoOperativo.update({ where: { id: item.gastoId }, data })
                } else {
                    await tx.gastoOperativo.create({ data })
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

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        await prisma.$transaction(async tx => {
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'compra:' + id}))::text AS lock_result`
            const compra = await tx.compra.findUnique({
                where: { id },
                include: { movimientosStock: true },
            })
            if (!compra) throw new CompraValidationError('Factura no encontrada')

            for (const movimiento of compra.movimientosStock) {
                await ComprasService.aplicarStockEnTx(tx, {
                    insumoId: movimiento.insumoId,
                    ubicacionId: movimiento.ubicacionId,
                    cantidad: movimiento.cantidad,
                    cantidadSecundaria: movimiento.cantidadSecundaria,
                }, -1)
            }

            await ComprasService.revertirFinanzasCompraEnTx(tx, id)
            await tx.movimientoStock.deleteMany({ where: { compraId: id } })
            await tx.compra.delete({ where: { id } })
        })

        return NextResponse.json({ message: 'Factura eliminada; stock, gastos y pagos fueron revertidos' })
    } catch (error) {
        if (error instanceof CompraValidationError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        console.error('Error eliminando factura:', error)
        return NextResponse.json({ error: 'Error al eliminar la factura' }, { status: 500 })
    }
}
