import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

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

        if (!proveedorId || !ubicacionId || !items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: 'Faltan campos obligatorios o ítems' }, { status: 400 })
        }

        const parsedFecha = fechaMovimiento ? new Date(`${fechaMovimiento}T12:00:00Z`) : new Date()
        const selectedCaja = cajaOrigen || 'caja_madre'

        // 1. Calcular costo total de la factura
        const costoTotalFactura = items.reduce((acc: number, item: any) => acc + (parseFloat(String(item.costoTotal || 0).replace(',', '.'))), 0)

        const result = await prisma.$transaction(async (tx) => {
            let gastoId = null
            
            // 2. Si hay costo y está pagado, creamos UN solo gasto
            if (costoTotalFactura > 0 && estadoPago === 'pagado') {
                console.log('Factura: Processing paid entry financial records for total:', costoTotalFactura)
                
                let cat = await tx.categoriaGasto.findUnique({ where: { nombre: 'Proveedores' } })
                if (!cat) {
                    cat = await tx.categoriaGasto.create({ data: { nombre: 'Proveedores', color: '#3498DB' } })
                }

                const gasto = await tx.gastoOperativo.create({
                    data: {
                        fecha: parsedFecha,
                        monto: costoTotalFactura,
                        descripcion: `Factura ${numeroFactura || 'S/N'} - Proveedor`, // Maybe fetch proveedor name, but ID is enough trace or just "Compra insumos"
                        categoriaId: cat.id
                    }
                })
                gastoId = gasto.id

                await tx.movimientoCaja.create({
                    data: {
                        tipo: 'egreso',
                        concepto: 'pago_proveedor',
                        monto: costoTotalFactura,
                        medioPago: 'efectivo',
                        cajaOrigen: selectedCaja,
                        descripcion: `Pago Fac. ${numeroFactura || 'S/N'} - ${observaciones || 'Compra Insumos'}`,
                        gastoId: gastoId,
                        fecha: parsedFecha
                    }
                })

                const saldo = await tx.saldoCaja.findUnique({ where: { tipo: selectedCaja } })
                if (saldo) {
                    await tx.saldoCaja.update({
                        where: { tipo: selectedCaja },
                        data: { saldo: { decrement: costoTotalFactura } }
                    })
                }
            }

            // 3. Crear cada MovimientoStock y actualizar Insumo
            const creados = []
            
            for (const item of items) {
                const cantidadFloat = parseFloat(String(item.cantidad).replace(',', '.'))
                const movCantSec = item.cantidadSecundaria ? parseFloat(String(item.cantidadSecundaria).replace(',', '.')) : null
                const costoItemFloat = item.costoTotal ? parseFloat(String(item.costoTotal).replace(',', '.')) : null

                const movimiento = await tx.movimientoStock.create({
                    data: {
                        insumoId: item.insumoId,
                        tipo: 'entrada',
                        fecha: parsedFecha,
                        cantidad: cantidadFloat,
                        cantidadSecundaria: movCantSec,
                        observaciones: observaciones || null,
                        proveedorId: proveedorId || null,
                        numeroFactura: numeroFactura || null,
                        costoTotal: costoItemFloat,
                        estadoPago: estadoPago || 'pendiente',
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
                    where: { id: item.insumoId },
                    data: dataInsumo
                })

                // Actualizar StockInsumo para ubicación específica
                await tx.stockInsumo.upsert({
                    where: { insumoId_ubicacionId: { insumoId: item.insumoId, ubicacionId } },
                    update: {
                        cantidad: { increment: cantidadFloat },
                        cantidadSecundaria: { increment: movCantSec || 0 }
                    },
                    create: {
                        insumoId: item.insumoId,
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
