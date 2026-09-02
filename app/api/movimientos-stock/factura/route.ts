import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { ComprasService } from '@/lib/services/compras.service'
import { normalizarNombreInsumo } from '@/lib/insumos/nombres'
import {
    CompraValidationError,
    estadoPagoDesdeMontos,
    numeroNoNegativo,
    numeroPositivo,
    validarMontoPagado,
    validarPagosDivididos,
} from '@/lib/compras/validacion'

type ItemFactura = {
    tipoItem: 'insumo' | 'gasto'
    insumoId: string | null
    insumoNombre: string | null
    descripcion: string | null
    categoriaGastoId: string | null
    unidadMedida: string
    cantidad: number
    cantidadSecundaria: number | null
    costoTotal: number
    actualizarCosto: boolean
    fechaVencimiento: Date | null
}

function fechaCivil(value: unknown, fallback = new Date()): Date {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? new Date(`${value}T12:00:00Z`)
        : fallback
}

export async function POST(request: Request) {
    try {
        const body = await request.json() as Record<string, unknown>
        const proveedorIdSolicitado = String(body.proveedorId || '') || null
        const proveedorNombre = String(body.proveedorNombre || '').trim() || null
        const ubicacionId = String(body.ubicacionId || '')
        if ((!proveedorIdSolicitado && !proveedorNombre) || !ubicacionId) {
            throw new CompraValidationError('Seleccione proveedor y ubicación')
        }
        if (!Array.isArray(body.items) || body.items.length === 0) {
            throw new CompraValidationError('Debe agregar al menos un ítem')
        }

        const items: ItemFactura[] = body.items.map((raw, index) => {
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
                    : null,
                costoTotal: numeroNoNegativo(item.costoTotal, `Costo del ítem ${index + 1}`),
                actualizarCosto: item.actualizarCosto === true,
                fechaVencimiento: item.fechaVencimiento ? fechaCivil(item.fechaVencimiento) : null,
            }
        })

        const costoTotal = items.reduce((acc, item) => acc + item.costoTotal, 0)
        const estadoSolicitado = String(body.estadoPago || 'pendiente')
        if (!['pagado', 'pendiente', 'a_cuenta'].includes(estadoSolicitado)) {
            throw new CompraValidationError('Estado de pago inválido')
        }
        const montoPagado = costoTotal === 0
            ? 0
            : estadoSolicitado === 'pagado'
                ? costoTotal
                : estadoSolicitado === 'a_cuenta'
                    ? numeroPositivo(body.montoPagado, 'Monto pagado')
                    : 0
        validarMontoPagado(costoTotal, montoPagado)
        if (estadoSolicitado === 'a_cuenta' && montoPagado >= costoTotal) {
            throw new CompraValidationError('El pago a cuenta debe ser menor al total')
        }
        const estadoPago = estadoPagoDesdeMontos(costoTotal, montoPagado)
        const cajaOrigen = String(body.cajaOrigen || 'caja_chica')
        const pagos = montoPagado > 0
            ? validarPagosDivididos(body.pagoDividido ? body.pagos : undefined, montoPagado, cajaOrigen)
            : []
        const fechaMovimiento = fechaCivil(body.fechaMovimiento)
        const fechaFactura = body.fechaFactura ? fechaCivil(body.fechaFactura) : null
        const numeroFactura = String(body.numeroFactura || '').trim() || null
        const observaciones = String(body.observaciones || '').trim() || null

        const result = await prisma.$transaction(async tx => {
            const categoriasGastoIds = [...new Set(items.flatMap(item => item.categoriaGastoId ? [item.categoriaGastoId] : []))]
            if (categoriasGastoIds.length > 0) {
                const categoriasEncontradas = await tx.categoriaGasto.count({ where: { id: { in: categoriasGastoIds } } })
                if (categoriasEncontradas !== categoriasGastoIds.length) {
                    throw new CompraValidationError('Una de las categorías de gasto no existe')
                }
            }

            let proveedorId = proveedorIdSolicitado
            let nombreProveedor = proveedorNombre || 'Proveedor'
            if (!proveedorId && proveedorNombre) {
                const existente = await tx.proveedor.findFirst({
                    where: { nombre: { equals: proveedorNombre, mode: 'insensitive' } },
                })
                if (existente) {
                    proveedorId = existente.id
                    nombreProveedor = existente.nombre
                } else {
                    const creado = await tx.proveedor.create({ data: { nombre: proveedorNombre } })
                    proveedorId = creado.id
                    nombreProveedor = creado.nombre
                }
            } else if (proveedorId) {
                const proveedor = await tx.proveedor.findUnique({ where: { id: proveedorId } })
                if (!proveedor) throw new CompraValidationError('Proveedor no encontrado')
                nombreProveedor = proveedor.nombre
            }

            const compra = await tx.compra.create({
                data: {
                    proveedorId,
                    ubicacionId,
                    numeroFactura,
                    fechaMovimiento,
                    fechaFactura,
                    estadoPago,
                    costoTotal,
                    montoPagado,
                    observaciones,
                },
            })

            let gastoId: string | null = null
            if (montoPagado > 0) {
                const gasto = await ComprasService.registrarPagoEnTx(tx, {
                    compraId: compra.id,
                    monto: montoPagado,
                    pagos,
                    fecha: fechaMovimiento,
                    ubicacionId,
                    descripcion: estadoPago === 'a_cuenta'
                        ? `Pago a cuenta Fac. ${numeroFactura || 'S/N'} - ${nombreProveedor}`
                        : `Factura ${numeroFactura || 'S/N'} - ${nombreProveedor}`,
                })
                gastoId = gasto.id
            }

            const cacheInsumos = new Map<string, string>()
            const movimientos = []
            const conceptosGasto = []
            for (const item of items) {
                if (item.tipoItem === 'gasto') {
                    const concepto = await tx.gastoOperativo.create({
                        data: {
                            fecha: fechaFactura || fechaMovimiento,
                            monto: item.costoTotal,
                            descripcion: item.descripcion!,
                            categoriaId: item.categoriaGastoId!,
                            compraId: compra.id,
                            tipoRegistro: 'concepto_compra',
                            ubicacionId,
                        },
                    })
                    conceptosGasto.push(concepto)
                    continue
                }

                let insumoId = item.insumoId
                if (!insumoId && item.insumoNombre) {
                    const clave = item.insumoNombre.toLocaleLowerCase('es-AR')
                    insumoId = cacheInsumos.get(clave) || null
                    if (!insumoId) {
                        const candidatos = await tx.insumo.findMany({ where: { activo: true } })
                        const existente = candidatos.find(insumo => normalizarNombreInsumo(insumo.nombre) === normalizarNombreInsumo(item.insumoNombre!))
                        if (existente) {
                            insumoId = existente.id
                        } else {
                            const creado = await tx.insumo.create({
                                data: {
                                    nombre: item.insumoNombre,
                                    unidadMedida: item.unidadMedida,
                                    proveedorId,
                                },
                            })
                            insumoId = creado.id
                        }
                        cacheInsumos.set(clave, insumoId)
                    }
                }
                if (!insumoId) throw new CompraValidationError('No se pudo resolver un insumo de la factura')
                if (proveedorId) {
                    await tx.insumoProveedor.upsert({
                        where: { insumoId_proveedorId: { insumoId, proveedorId } },
                        update: {},
                        create: { insumoId, proveedorId },
                    })
                }

                const pagoItem = costoTotal > 0 ? montoPagado * (item.costoTotal / costoTotal) : 0
                const movimiento = await tx.movimientoStock.create({
                    data: {
                        insumoId,
                        compraId: compra.id,
                        tipo: 'entrada',
                        fecha: fechaMovimiento,
                        cantidad: item.cantidad,
                        cantidadSecundaria: item.cantidadSecundaria,
                        observaciones,
                        proveedorId,
                        numeroFactura,
                        costoTotal: item.costoTotal,
                        estadoPago,
                        montoPagado: pagoItem,
                        gastoId,
                        fechaVencimiento: item.fechaVencimiento,
                        fechaFactura,
                        ubicacionId,
                    },
                })
                movimientos.push(movimiento)

                await ComprasService.aplicarStockEnTx(tx, {
                    insumoId,
                    ubicacionId,
                    cantidad: item.cantidad,
                    cantidadSecundaria: item.cantidadSecundaria,
                }, 1)
                if (item.actualizarCosto && item.costoTotal > 0) {
                    await tx.insumo.update({
                        where: { id: insumoId },
                        data: { precioUnitario: item.costoTotal / item.cantidad },
                    })
                }
            }

            return { compra, count: movimientos.length + conceptosGasto.length }
        })

        return NextResponse.json({
            message: 'Factura procesada correctamente',
            compraId: result.compra.id,
            count: result.count,
        }, { status: 201 })
    } catch (error) {
        if (error instanceof CompraValidationError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        console.error('Error en POST /api/movimientos-stock/factura:', error)
        return NextResponse.json({ error: 'Error al registrar la factura' }, { status: 500 })
    }
}
