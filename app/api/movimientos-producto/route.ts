import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/movimientos-producto
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const productoId = searchParams.get('productoId')
        const ubicacionId = searchParams.get('ubicacionId')
        const limit = parseInt(searchParams.get('limit') || '200')

        const where: any = {}
        if (productoId) where.productoId = productoId
        if (ubicacionId) where.ubicacionId = ubicacionId

        const movimientos = await prisma.movimientoProducto.findMany({
            where,
            orderBy: { fecha: 'desc' },
            take: limit,
            include: {
                producto: { select: { id: true, nombre: true, codigoInterno: true } },
                lote: { select: { id: true } },
                ubicacion: { select: { id: true, nombre: true } }
            },
        })
        return NextResponse.json(movimientos)
    } catch (error) {
        console.error('Error fetching movimientos producto:', error)
        return NextResponse.json({ error: 'Error al obtener movimientos' }, { status: 500 })
    }
}

// POST /api/movimientos-producto
// Tipos soportados: "traslado", "venta_local", "reparto", "merma", "ajuste"
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { productoId, presentacionId, tipo, cantidad, observaciones, ubicacionId, destinoUbicacionId } = body

        const cant = parseInt(cantidad)
        const tiposPermitidos = ['traslado', 'venta_local', 'reparto', 'merma', 'ajuste', 'ajuste_fabrica', 'ajuste_local']
        if (!tiposPermitidos.includes(tipo)) {
            return NextResponse.json({ error: `Tipo inválido. Permitidos: ${tiposPermitidos.join(', ')}` }, { status: 400 })
        }

        const result = await prisma.$transaction(async (tx) => {
            if (tipo === 'traslado') {
                if (!ubicacionId || !destinoUbicacionId) {
                    throw new Error('Ubicación de origen y destino son requeridas para traslado')
                }
                // Verificar stock disponible en origen
                const stockOri = await tx.stockProducto.findUnique({
                    where: { productoId_presentacionId_ubicacionId: { productoId, presentacionId, ubicacionId } },
                })
                if (!stockOri || stockOri.cantidad < cant) {
                    throw new Error(`Stock insuficiente en origen. Disponible: ${stockOri?.cantidad || 0} paq`)
                }

                // Restar de origen
                await tx.stockProducto.update({
                    where: { productoId_presentacionId_ubicacionId: { productoId, presentacionId, ubicacionId } },
                    data: { cantidad: { decrement: cant } },
                })
                // Sumar a destino
                await tx.stockProducto.upsert({
                    where: { productoId_presentacionId_ubicacionId: { productoId, presentacionId, ubicacionId: destinoUbicacionId } },
                    create: { productoId, presentacionId, ubicacionId: destinoUbicacionId, cantidad: cant },
                    update: { cantidad: { increment: cant } },
                })

                // Crear 2 movimientos
                await tx.movimientoProducto.createMany({
                    data: [
                        { productoId, presentacionId, tipo: 'traslado', cantidad: cant, ubicacionId: ubicacionId, signo: 'salida', observaciones: observaciones || 'Traslado (Salida)' },
                        { productoId, presentacionId, tipo: 'traslado', cantidad: cant, ubicacionId: destinoUbicacionId, signo: 'entrada', observaciones: observaciones || 'Traslado (Entrada)' },
                    ],
                })
                return { ok: true, mensaje: `${cant} paquetes trasladados correctamente` }

            } else if (tipo === 'reparto' || tipo === 'venta_local' || tipo === 'merma') {
                if (!ubicacionId) throw new Error('Ubicación es requerida para este movimiento')

                const stock = await tx.stockProducto.findUnique({
                    where: { productoId_presentacionId_ubicacionId: { productoId, presentacionId, ubicacionId } },
                })
                if (!stock || stock.cantidad < cant) {
                    throw new Error(`Stock insuficiente. Disponible: ${stock?.cantidad || 0} paq`)
                }
                await tx.stockProducto.update({
                    where: { productoId_presentacionId_ubicacionId: { productoId, presentacionId, ubicacionId } },
                    data: { cantidad: { decrement: cant } },
                })
                await tx.movimientoProducto.create({
                    data: { productoId, presentacionId, tipo, cantidad: cant, ubicacionId, signo: 'salida', observaciones: observaciones || tipo },
                })
                return { ok: true, mensaje: `${cant} paquetes descontados correctamente` }

            } else if (tipo === 'ajuste' || tipo === 'ajuste_fabrica' || tipo === 'ajuste_local') {
                if (!ubicacionId) throw new Error('Ubicación es requerida para ajuste')

                // Obtener stock actual para calcular la diferencia
                const stockActual = await tx.stockProducto.findUnique({
                    where: { productoId_presentacionId_ubicacionId: { productoId, presentacionId, ubicacionId } },
                })

                const cantActual = stockActual?.cantidad || 0
                const diferencia = cant - cantActual

                if (diferencia === 0) return { ok: true, mensaje: `El stock ya es ${cant}. No se requiere ajuste.` }

                await tx.stockProducto.upsert({
                    where: { productoId_presentacionId_ubicacionId: { productoId, presentacionId, ubicacionId } },
                    create: { productoId, presentacionId, ubicacionId, cantidad: cant },
                    update: { cantidad: cant },
                })

                await tx.movimientoProducto.create({
                    data: {
                        productoId,
                        presentacionId,
                        tipo: 'ajuste',
                        cantidad: Math.abs(diferencia),
                        ubicacionId,
                        signo: diferencia > 0 ? 'entrada' : 'salida',
                        observaciones: observaciones || `Ajuste manual de stock (de ${cantActual} a ${cant})`
                    },
                })
                return { ok: true, mensaje: `Stock ajustado a ${cant} paquetes` }
            }

            throw new Error('Tipo no implementado')
        })

        return NextResponse.json(result, { status: 201 })
    } catch (error) {
        console.error('Error en movimiento producto:', error)
        const message = error instanceof Error ? error.message : 'Error al registrar movimiento'
        return NextResponse.json({ error: message }, { status: 400 })
    }
}
