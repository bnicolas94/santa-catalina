import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { CajaService } from '@/lib/services/caja.service'

// GET /api/movimientos-stock
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const insumoId = searchParams.get('insumoId')

        const movimientos = await prisma.movimientoStock.findMany({
            where: insumoId ? { insumoId } : {},
            orderBy: { fecha: 'desc' },
            take: 100,
            include: {
                insumo: { select: { id: true, nombre: true, unidadMedida: true } },
                proveedor: { select: { id: true, nombre: true } },
                loteOrigen: { select: { id: true } },
                ubicacion: { select: { id: true, nombre: true } },
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
        const body = await request.json()
        console.log('--- POST /api/movimientos-stock PAYLOAD:', JSON.stringify(body, null, 2))
        
        const { 
            insumoId, tipo, cantidad, cantidadSecundaria, observaciones, 
            proveedorId, costoTotal, estadoPago, actualizarCosto, 
            fechaVencimiento, ubicacionId, fechaMovimiento, cajaOrigen,
            pagoDividido, pagos, montoPagado
        } = body

        if (!insumoId || !tipo || !cantidad || !ubicacionId) {
            return NextResponse.json({ error: 'Faltan campos obligatorios (insumo, tipo, cantidad, ubicacion)' }, { status: 400 })
        }

        if (!['entrada', 'salida'].includes(tipo)) {
            return NextResponse.json({ error: 'Tipo debe ser "entrada" o "salida"' }, { status: 400 })
        }

        const result = await prisma.$transaction(async (tx) => {
            const costoTotalFloat = costoTotal ? parseFloat(String(costoTotal).replace(',', '.')) : null
            const cantidadFloat = parseFloat(String(cantidad).replace(',', '.'))
            const movCantSec = cantidadSecundaria ? parseFloat(String(cantidadSecundaria).replace(',', '.')) : null
            const parsedFecha = fechaMovimiento ? new Date(`${fechaMovimiento}T12:00:00Z`) : new Date()
            const selectedCaja = cajaOrigen || 'caja_madre'
            
            let gastoId = null
            let movimientoCajaId = null

            // 1. Manejo de Gasto y Caja si es entrada pagada o a cuenta
            const esPagado = estadoPago === 'pagado'
            const esACuenta = estadoPago === 'a_cuenta'
            const montoACuentaFloat = montoPagado ? parseFloat(String(montoPagado).replace(',', '.')) : 0
            const montoADescontar = esPagado ? costoTotalFloat : (esACuenta ? montoACuentaFloat : 0)

            if (tipo === 'entrada' && montoADescontar && montoADescontar > 0) {
                console.log(`Processing ${esPagado ? 'paid' : 'partial'} entry financial records... Amount: ${montoADescontar}`)
                try {
                    let cat = await tx.categoriaGasto.findUnique({ where: { nombre: 'Proveedores' } })
                    if (!cat) {
                        cat = await tx.categoriaGasto.create({ data: { nombre: 'Proveedores', color: '#3498DB' } })
                    }

                    const gasto = await tx.gastoOperativo.create({
                        data: {
                            fecha: parsedFecha,
                            monto: montoADescontar,
                            descripcion: esACuenta 
                                ? `Pago a cuenta Insumos - ${observaciones || 'Directa'} (Abonado: $${montoADescontar.toLocaleString('es-AR')} / $${costoTotalFloat?.toLocaleString('es-AR')})`
                                : `Compra de Insumos - ${observaciones || 'Directa'}`,
                            categoriaId: cat.id
                        }
                    })
                    gastoId = gasto.id
                    console.log('Gasto created:', gastoId)

                    if (pagoDividido && pagos && Array.isArray(pagos)) {
                        for (const pago of pagos) {
                            const montoPagoItem = parseFloat(String(pago.monto).replace(',', '.'));
                            if (montoPagoItem > 0) {
                                await CajaService.createMovimientoEnTx(tx, {
                                    tipo: 'egreso',
                                    concepto: 'pago_proveedor',
                                    monto: montoPagoItem,
                                    medioPago: pago.cajaOrigen?.includes('mercado_pago') ? 'transferencia' : 'efectivo',
                                    cajaOrigen: pago.cajaOrigen,
                                    descripcion: `Compra de Insumos: ${observaciones || 'Directa'}`,
                                    gastoId: gastoId,
                                    fecha: parsedFecha,
                                })
                            }
                        }
                        movimientoCajaId = 'multiple_pagos';
                        console.log('Multiple MovimientoCaja created via CajaService');
                    } else {
                        const movCaja = await CajaService.createMovimientoEnTx(tx, {
                            tipo: 'egreso',
                            concepto: 'pago_proveedor',
                            monto: montoADescontar,
                            medioPago: selectedCaja.includes('mercado_pago') ? 'transferencia' : 'efectivo',
                            cajaOrigen: selectedCaja,
                            descripcion: esACuenta 
                                ? `Pago a cuenta: ${observaciones || 'Directa'}`
                                : `Compra de Insumos: ${observaciones || 'Directa'}`,
                            gastoId: gastoId,
                            fecha: parsedFecha,
                        })
                        movimientoCajaId = movCaja.id
                        console.log('MovimientoCaja created via CajaService:', movimientoCajaId)
                    }
                } catch (financialError) {
                    console.error('ERROR in financial steps:', financialError)
                    throw new Error('Error en el proceso financiero (gasto/caja): ' + (financialError instanceof Error ? financialError.message : String(financialError)))
                }
            }

            // 2. Crear Movimiento de Stock
            console.log('Creating MovimientoStock...')
            const movimiento = await tx.movimientoStock.create({
                data: {
                    insumoId,
                    tipo,
                    fecha: parsedFecha,
                    cantidad: cantidadFloat,
                    cantidadSecundaria: movCantSec,
                    observaciones: observaciones || null,
                    proveedorId: proveedorId || null,
                    costoTotal: costoTotalFloat,
                    estadoPago: tipo === 'entrada' ? (estadoPago || 'pendiente') : null,
                    montoPagado: esPagado ? costoTotalFloat : (esACuenta ? montoACuentaFloat : 0),
                    gastoId,
                    fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
                    ubicacionId
                }
            })
            console.log('MovimientoStock created:', movimiento.id)

            // 3. Actualizar Insumo Global
            const delta = tipo === 'entrada' ? cantidadFloat : -cantidadFloat
            const deltaSec = movCantSec ? (tipo === 'entrada' ? movCantSec : -movCantSec) : 0
            
            const dataInsumo: any = { 
                stockActual: { increment: delta },
                stockActualSecundario: { increment: deltaSec }
            }

            if (tipo === 'entrada' && costoTotalFloat && actualizarCosto && cantidadFloat > 0) {
                dataInsumo.precioUnitario = costoTotalFloat / cantidadFloat
                console.log('Updating insumo price unitario:', dataInsumo.precioUnitario)
            }
            await tx.insumo.update({
                where: { id: insumoId },
                data: dataInsumo
            })
            console.log('Global Insumo stock updated')

            // 4. Actualizar/Crear el StockInsumo para esa ubicación específica
            console.log('Upserting StockInsumo for location:', ubicacionId)
            await tx.stockInsumo.upsert({
                where: { insumoId_ubicacionId: { insumoId, ubicacionId } },
                update: {
                    cantidad: { increment: delta },
                    cantidadSecundaria: { increment: deltaSec }
                },
                create: {
                    insumoId,
                    ubicacionId,
                    cantidad: delta,
                    cantidadSecundaria: deltaSec
                }
            })
            console.log('StockInsumo upserted')

            return movimiento
        })

        return NextResponse.json(result, { status: 201 })
    } catch (error: any) {
        console.error('CRITICAL ERROR in POST /api/movimientos-stock:', error)
        return NextResponse.json({ 
            error: 'Error al registrar movimiento',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 })
    }
}
