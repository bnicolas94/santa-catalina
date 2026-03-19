import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

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
        const { insumoId, tipo, cantidad, cantidadSecundaria, observaciones, proveedorId, costoTotal, estadoPago, actualizarCosto, fechaVencimiento, ubicacionId } = body

        if (!insumoId || !tipo || !cantidad || !ubicacionId) {
            return NextResponse.json({ error: 'Insumo, tipo, cantidad y ubicación son requeridos' }, { status: 400 })
        }

        if (!['entrada', 'salida'].includes(tipo)) {
            return NextResponse.json({ error: 'Tipo debe ser "entrada" o "salida"' }, { status: 400 })
        }

        const cant = parseFloat(cantidad)
        const costoTotalFloat = costoTotal ? parseFloat(costoTotal) : null
        const estado = tipo === 'entrada' ? (estadoPago || 'pagado') : null

        const result = await prisma.$transaction(async (tx) => {
            // 1. Si es entrada y está pagado, creamos el gasto
            let gastoId = null
            if (tipo === 'entrada' && costoTotalFloat && estado === 'pagado') {
                // Buscar o crear categoria "Proveedores"
                let cat = await tx.categoriaGasto.findUnique({ where: { nombre: 'Proveedores' } })
                if (!cat) {
                    cat = await tx.categoriaGasto.create({ data: { nombre: 'Proveedores', color: '#3498DB' } })
                }

                const gasto = await tx.gastoOperativo.create({
                    data: {
                        fecha: new Date(),
                        monto: costoTotalFloat,
                        descripcion: `Compra de Insumos - ${observaciones || 'Directa'}`,
                        categoriaId: cat.id
                    }
                })
                gastoId = gasto.id

                // NUEVO: Crear Movimiento de Caja y Actualizar Saldo
                await tx.movimientoCaja.create({
                    data: {
                        tipo: 'egreso',
                        concepto: 'compra_insumos',
                        monto: costoTotalFloat,
                        medioPago: 'efectivo',
                        cajaOrigen: 'caja_madre',
                        descripcion: `Compra de Insumos: ${observaciones || 'Directa'}`,
                        gastoId: gastoId,
                        fecha: new Date()
                    }
                })

                await tx.saldoCaja.update({
                    where: { tipo: 'caja_madre' },
                    data: { saldo: { decrement: costoTotalFloat } }
                })
            }

            // 2. Crear MovimientoStock
            const movCantSec = cantidadSecundaria ? parseFloat(cantidadSecundaria) : null
            const movimiento = await tx.movimientoStock.create({
                data: {
                    insumoId,
                    tipo,
                    cantidad: cant,
                    cantidadSecundaria: movCantSec,
                    observaciones: observaciones || null,
                    proveedorId: proveedorId || null,
                    costoTotal: costoTotalFloat,
                    estadoPago: estado,
                    fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
                    gastoId,
                    ubicacionId
                },
                include: {
                    insumo: { select: { id: true, nombre: true, unidadMedida: true } },
                    proveedor: { select: { id: true, nombre: true } },
                },
            })
    
            // 3. Actualizar stock del insumo y precio unitario si corresponde
            const delta = tipo === 'entrada' ? cant : -cant
            const deltaSec = movCantSec ? (tipo === 'entrada' ? movCantSec : -movCantSec) : 0
            
            const dataInsumo: any = { 
                stockActual: { increment: delta },
                stockActualSecundario: { increment: deltaSec }
            }
    
            if (tipo === 'entrada' && costoTotalFloat && actualizarCosto) {
                if (costoTotalFloat > 0 && cant > 0) {
                    dataInsumo.precioUnitario = costoTotalFloat / cant
                }
            }
    
            await tx.insumo.update({
                where: { id: insumoId },
                data: dataInsumo,
            })
    
            // 4. Actualizar stock por ubicación (StockInsumo)
            await tx.stockInsumo.upsert({
                where: { insumoId_ubicacionId: { insumoId, ubicacionId } },
                create: { 
                    insumoId, 
                    ubicacionId, 
                    cantidad: delta,
                    cantidadSecundaria: deltaSec
                },
                update: { 
                    cantidad: { increment: delta },
                    cantidadSecundaria: { increment: deltaSec }
                }
            })

            return movimiento
        })

        return NextResponse.json(result, { status: 201 })
    } catch (error) {
        console.error('Error creating movimiento:', error)
        return NextResponse.json({ error: 'Error al registrar movimiento' }, { status: 500 })
    }
}
