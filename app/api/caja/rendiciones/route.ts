import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/caja/rendiciones — Rendiciones pendientes del día
export async function GET() {
    try {
        const now = new Date()
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

        // Buscar choferes que tuvieron rutas hoy
        const rutasHoy = await prisma.ruta.findMany({
            where: { fecha: { gte: startOfDay, lte: endOfDay } },
            include: {
                chofer: { select: { id: true, nombre: true } },
                entregas: {
                    include: {
                        pedido: { select: { id: true, totalImporte: true, medioPago: true, estado: true } },
                    }
                },
            },
        })

        // Para cada ruta, calcular cuánto efectivo debe rendir el chofer
        const rendicionesPorChofer: Record<string, {
            choferId: string; choferNombre: string; montoEsperado: number;
            pedidosEfectivo: number; rendicionId: string | null; estado: string
        }> = {}

        for (const ruta of rutasHoy) {
            const cId = ruta.chofer.id
            if (!rendicionesPorChofer[cId]) {
                rendicionesPorChofer[cId] = {
                    choferId: cId, choferNombre: ruta.chofer.nombre,
                    montoEsperado: 0, pedidosEfectivo: 0, rendicionId: null, estado: 'pendiente',
                }
            }

            for (const entrega of ruta.entregas) {
                if (entrega.pedido.medioPago === 'efectivo' && entrega.pedido.estado === 'entregado') {
                    rendicionesPorChofer[cId].montoEsperado += entrega.pedido.totalImporte
                    rendicionesPorChofer[cId].pedidosEfectivo++
                }
            }
        }

        // Verificar si ya hay rendiciones creadas hoy para estos choferes
        const rendicionesExistentes = await prisma.rendicionChofer.findMany({
            where: { fecha: { gte: startOfDay, lte: endOfDay } },
        })

        for (const rend of rendicionesExistentes) {
            if (rendicionesPorChofer[rend.choferId]) {
                rendicionesPorChofer[rend.choferId].rendicionId = rend.id
                rendicionesPorChofer[rend.choferId].estado = rend.estado
            }
        }

        return NextResponse.json(Object.values(rendicionesPorChofer))
    } catch (error) {
        console.error('Error obteniendo rendiciones:', error)
        return NextResponse.json({ error: 'Error al cargar rendiciones' }, { status: 500 })
    }
}

// POST /api/caja/rendiciones — Confirmar rendición (Controlado)
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { choferId, montoEsperado, montoEntregado, observaciones } = body

        if (!choferId || montoEntregado === undefined) {
            return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 })
        }

        const montoReal = parseFloat(montoEntregado)
        const diferencia = montoReal - parseFloat(montoEsperado)

        const result = await prisma.$transaction(async (tx) => {
            // 1. Crear la rendición
            const rendicion = await tx.rendicionChofer.create({
                data: {
                    choferId,
                    montoEsperado: parseFloat(montoEsperado),
                    montoEntregado: montoReal,
                    diferencia,
                    estado: 'controlado',
                    observaciones: observaciones || null,
                },
            })

            // 2. Crear movimiento de caja (ingreso del efectivo)
            await tx.movimientoCaja.create({
                data: {
                    tipo: 'ingreso',
                    concepto: 'rendicion_chofer',
                    monto: montoReal,
                    medioPago: 'efectivo',
                    descripcion: `Rendición chofer - ${diferencia !== 0 ? `Diferencia: $${diferencia.toFixed(2)}` : 'Sin diferencia'}`,
                    rendicionId: rendicion.id,
                },
            })

            return rendicion
        })

        return NextResponse.json(result, { status: 201 })
    } catch (error) {
        console.error('Error confirmando rendición:', error)
        return NextResponse.json({ error: 'Error al confirmar rendición' }, { status: 500 })
    }
}
