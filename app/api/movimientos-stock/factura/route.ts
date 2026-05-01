import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { CajaService } from '@/lib/services/caja.service'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        console.log('--- POST /api/movimientos-stock/factura PAYLOAD:', JSON.stringify(body, null, 2))
        
        const { 
            proveedorId, 
            numeroFactura, 
            fechaMovimiento, 
            estadoPago, 
            cajaOrigen, 
            ubicacionId, 
            observaciones,
            items 
        } = body

        if ((!proveedorId && !body.proveedorNombre) || !ubicacionId || !items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: 'Faltan campos obligatorios o ítems' }, { status: 400 })
        }

        const parsedFecha = fechaMovimiento ? new Date(`${fechaMovimiento}T12:00:00Z`) : new Date()
        const selectedCaja = cajaOrigen || 'caja_madre'

        // 1. Calcular costo total de la factura
        const costoTotalFactura = items.reduce((acc: number, item: any) => acc + (parseFloat(String(item.costoTotal || 0).replace(',', '.'))), 0)
        
        const esACuenta = estadoPago === 'a_cuenta'
        const montoACuentaFloat = body.montoPagado ? parseFloat(String(body.montoPagado).replace(',', '.')) : 0
        const montoADescontar = estadoPago === 'pagado' ? costoTotalFactura : (esACuenta ? montoACuentaFloat : 0)

        const result = await prisma.$transaction(async (tx) => {
            let gastoId = null
            
            // 2. Resolver o Crear Proveedor (Upsert Seguro)
            let finalProveedorId = proveedorId
            let resolvedProveedorNombre = body.proveedorNombre || 'Proveedor'

            if (!finalProveedorId && body.proveedorNombre) {
                // Chequear si existe por string
                const provExistente = await tx.proveedor.findFirst({
                    where: { nombre: { equals: body.proveedorNombre, mode: 'insensitive' } }
                })
                if (provExistente) {
                    finalProveedorId = provExistente.id
                    resolvedProveedorNombre = provExistente.nombre
                } else {
                    const nuevoProv = await tx.proveedor.create({
                        data: { nombre: body.proveedorNombre }
                    })
                    finalProveedorId = nuevoProv.id
                    resolvedProveedorNombre = nuevoProv.nombre
                }
            } else if (finalProveedorId) {
                const provParams = await tx.proveedor.findUnique({ where: { id: finalProveedorId } })
                if (provParams) resolvedProveedorNombre = provParams.nombre
            }

            // 3. Si hay costo y está pagado o a cuenta, creamos UN solo gasto
            if (montoADescontar > 0) {
                console.log(`Factura: Processing ${estadoPago} entry financial records for amount:`, montoADescontar)
                
                let cat = await tx.categoriaGasto.findUnique({ where: { nombre: 'Proveedores' } })
                if (!cat) {
                    cat = await tx.categoriaGasto.create({ data: { nombre: 'Proveedores', color: '#3498DB' } })
                }

                const gasto = await tx.gastoOperativo.create({
                    data: {
                        fecha: parsedFecha,
                        monto: montoADescontar,
                        descripcion: esACuenta
                            ? `Pago a cuenta Fac. ${numeroFactura || 'S/N'} - ${resolvedProveedorNombre} (Abonado: $${montoADescontar.toLocaleString('es-AR')} / $${costoTotalFactura.toLocaleString('es-AR')})`
                            : `Factura ${numeroFactura || 'S/N'} - ${resolvedProveedorNombre}`,
                        categoriaId: cat.id
                    }
                })
                gastoId = gasto.id

                if (body.pagoDividido && body.pagos && Array.isArray(body.pagos)) {
                    for (const pago of body.pagos) {
                        const montoPago = parseFloat(String(pago.monto).replace(',', '.'));
                        if (montoPago > 0) {
                            await CajaService.createMovimientoEnTx(tx, {
                                tipo: 'egreso',
                                concepto: 'pago_proveedor',
                                monto: montoPago,
                                medioPago: pago.cajaOrigen?.includes('mercado_pago') ? 'transferencia' : 'efectivo',
                                cajaOrigen: pago.cajaOrigen,
                                descripcion: `Pago Fac. ${numeroFactura || 'S/N'} - ${observaciones || 'Compra Insumos'}`,
                                gastoId: gastoId,
                                fecha: parsedFecha,
                            })
                        }
                    }
                } else {
                    await CajaService.createMovimientoEnTx(tx, {
                        tipo: 'egreso',
                        concepto: 'pago_proveedor',
                        monto: montoADescontar,
                        medioPago: selectedCaja.includes('mercado_pago') ? 'transferencia' : 'efectivo',
                        cajaOrigen: selectedCaja,
                        descripcion: esACuenta
                            ? `Pago a cuenta Fac. ${numeroFactura || 'S/N'} - ${observaciones || 'Compra Insumos'}`
                            : `Pago Fac. ${numeroFactura || 'S/N'} - ${observaciones || 'Compra Insumos'}`,
                        gastoId: gastoId,
                        fecha: parsedFecha,
                    })
                }
            }

            // 4. Crear cada MovimientoStock y actualizar Insumo
            const creados = []
            const newInsumosCache = new Map<string, string>()
            
            for (const item of items) {
                const cantidadFloat = parseFloat(String(item.cantidad).replace(',', '.'))
                const movCantSec = item.cantidadSecundaria ? parseFloat(String(item.cantidadSecundaria).replace(',', '.')) : null
                const costoItemFloat = item.costoTotal ? parseFloat(String(item.costoTotal).replace(',', '.')) : null

                let finalInsumoId = item.insumoId
                if (!finalInsumoId && item.insumoNombre) {
                    const normalizedName = item.insumoNombre.trim().toLowerCase()
                    if (newInsumosCache.has(normalizedName)) {
                        finalInsumoId = newInsumosCache.get(normalizedName)
                    } else {
                        const insExistente = await tx.insumo.findFirst({
                            where: { nombre: { equals: item.insumoNombre.trim(), mode: 'insensitive' } }
                        })
                        if (insExistente) {
                            finalInsumoId = insExistente.id
                            newInsumosCache.set(normalizedName, finalInsumoId)
                        } else {
                            const nuevoIns = await tx.insumo.create({
                                data: {
                                    nombre: item.insumoNombre,
                                    unidadMedida: 'unidades',
                                    proveedorId: finalProveedorId || null
                                }
                            })
                            finalInsumoId = nuevoIns.id
                            newInsumosCache.set(normalizedName, finalInsumoId)
                        }
                    }
                }

                const movimiento = await tx.movimientoStock.create({
                    data: {
                        insumoId: finalInsumoId,
                        tipo: 'entrada',
                        fecha: parsedFecha,
                        cantidad: cantidadFloat,
                        cantidadSecundaria: movCantSec,
                        observaciones: observaciones || null,
                        proveedorId: finalProveedorId || null,
                        numeroFactura: numeroFactura || null,
                        costoTotal: costoItemFloat,
                        estadoPago: estadoPago || 'pendiente',
                        montoPagado: estadoPago === 'pagado' ? costoItemFloat : (esACuenta && costoItemFloat ? (montoACuentaFloat / costoTotalFactura * (costoItemFloat || 0)) : 0),
                        gastoId,
                        fechaVencimiento: item.fechaVencimiento ? new Date(item.fechaVencimiento) : null,
                        ubicacionId
                    }
                })
                creados.push(movimiento)

                // Actualizar Insumo Global
                const dataInsumo: any = { 
                    stockActual: { increment: cantidadFloat },
                    stockActualSecundario: { increment: movCantSec || 0 }
                }

                if (costoItemFloat && item.actualizarCosto && cantidadFloat > 0) {
                    dataInsumo.precioUnitario = costoItemFloat / cantidadFloat
                }
                
                await tx.insumo.update({
                    where: { id: finalInsumoId },
                    data: dataInsumo
                })

                // Actualizar StockInsumo para ubicación específica
                await tx.stockInsumo.upsert({
                    where: { insumoId_ubicacionId: { insumoId: finalInsumoId, ubicacionId } },
                    update: {
                        cantidad: { increment: cantidadFloat },
                        cantidadSecundaria: { increment: movCantSec || 0 }
                    },
                    create: {
                        insumoId: finalInsumoId,
                        ubicacionId,
                        cantidad: cantidadFloat,
                        cantidadSecundaria: movCantSec || 0
                    }
                })
            }

            return creados
        })

        return NextResponse.json({ message: 'Factura procesada correctamente', count: result.length }, { status: 201 })
    } catch (error: any) {
        console.error('CRITICAL ERROR in POST /api/movimientos-stock/factura:', error)
        return NextResponse.json({ 
            error: 'Error al registrar la factura',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 })
    }
}
