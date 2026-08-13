import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { CajaService } from '@/lib/services/caja.service'

// GET /api/caja/rendiciones — Rendiciones pendientes de choferes por ruta/turno
export async function GET() {
    try {
        // Buscar todas las rutas sin rendición asociada que contengan entregas en efectivo completadas y no cobradas
        const rutasPendientes = await prisma.ruta.findMany({
            where: {
                rendicion: null, // Sin RendicionChofer asociada
                entregas: {
                    some: {
                        pedido: {
                            medioPago: 'efectivo',
                            estado: 'entregado',
                            abonado: false
                        }
                    }
                }
            },
            include: {
                chofer: { select: { id: true, nombre: true } },
                entregas: {
                    where: {
                        pedido: {
                            medioPago: 'efectivo',
                            estado: 'entregado',
                            abonado: false
                        }
                    },
                    include: {
                        pedido: {
                            select: {
                                id: true,
                                totalImporte: true,
                                totalUnidades: true,
                                cliente: { select: { nombreComercial: true } }
                            }
                        },
                        cliente: { select: { nombreComercial: true } }
                    }
                }
            },
            orderBy: [
                { fecha: 'asc' },
                { createdAt: 'asc' }
            ]
        })

        // Mapear rutas a formato detallado para la interfaz
        const result = rutasPendientes.map(ruta => {
            const entregasEfectivo = ruta.entregas
            const montoEsperado = entregasEfectivo.reduce((sum, e) => sum + e.pedido.totalImporte, 0)

            return {
                rutaId: ruta.id,
                fecha: ruta.fecha.toISOString(),
                turno: ruta.turno,
                choferId: ruta.chofer.id,
                choferNombre: ruta.chofer.nombre,
                montoEsperado,
                pedidosEfectivo: entregasEfectivo.length,
                bloqueada: false, // se marca abajo
                pedidos: entregasEfectivo.map(e => ({
                    id: e.pedido.id,
                    entregaId: e.id,
                    clienteNombre: e.cliente?.nombreComercial || e.pedido?.cliente?.nombreComercial || 'Desconocido',
                    totalImporte: e.pedido.totalImporte,
                    totalUnidades: e.pedido.totalUnidades
                }))
            }
        })

        // Evaluar bloqueos cronológicos por chofer:
        // Si el chofer tiene más de una ruta pendiente, solo la más antigua (primera en la lista)
        // se puede rendir. Las demás se marcan como bloqueadas.
        const driverRouteCounts: Record<string, number> = {}
        for (const r of result) {
            const cId = r.choferId
            if (!driverRouteCounts[cId]) {
                driverRouteCounts[cId] = 1
                r.bloqueada = false
            } else {
                driverRouteCounts[cId]++
                r.bloqueada = true
            }
        }

        return NextResponse.json(result)
    } catch (error) {
        console.error('Error obteniendo rendiciones:', error)
        return NextResponse.json({ error: 'Error al cargar rendiciones' }, { status: 500 })
    }
}

// POST /api/caja/rendiciones — Confirmar rendición de una ruta
export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const body = await request.json()
        const { rutaId, montoEsperado, montoEntregado, observaciones } = body

        if (!rutaId || montoEntregado === undefined) {
            return NextResponse.json({ error: 'Faltan datos obligatorios (rutaId, montoEntregado)' }, { status: 400 })
        }

        const result = await CajaService.confirmarRendicion(
            rutaId,
            parseFloat(montoEsperado),
            parseFloat(montoEntregado),
            observaciones,
            (session.user as any)?.id || null,
        )

        return NextResponse.json(result, { status: 201 })
    } catch (error: any) {
        console.error('Error confirmando rendición:', error)
        return NextResponse.json({ error: error.message || 'Error al confirmar rendición' }, { status: 500 })
    }
}
