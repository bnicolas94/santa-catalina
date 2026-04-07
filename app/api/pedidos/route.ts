import { prisma } from '@/lib/prisma'
import { NextResponse, NextRequest } from 'next/server'

// GET /api/pedidos — Paginado, filtrable por fecha/estado/búsqueda
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
        const fechaDesde = searchParams.get('fechaDesde')
        const fechaHasta = searchParams.get('fechaHasta')
        const estado = searchParams.get('estado')
        const search = searchParams.get('search')

        // Construir filtros dinámicos
        const where: any = {}

        if (fechaDesde || fechaHasta) {
            where.fechaEntrega = {}
            if (fechaDesde) where.fechaEntrega.gte = new Date(fechaDesde + 'T00:00:00.000Z')
            if (fechaHasta) where.fechaEntrega.lte = new Date(fechaHasta + 'T23:59:59.999Z')
        }

        if (estado) where.estado = estado

        if (search) {
            where.cliente = {
                nombreComercial: { contains: search, mode: 'insensitive' }
            }
        }

        // Consultas en paralelo: pedidos paginados + total + stats
        const [pedidos, total, stats] = await Promise.all([
            prisma.pedido.findMany({
                where,
                orderBy: { fechaEntrega: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    cliente: { select: { id: true, nombreComercial: true, zona: true, latitud: true, longitud: true, direccion: true } },
                    detalles: {
                        include: {
                            presentacion: {
                                include: {
                                    producto: { select: { id: true, nombre: true, codigoInterno: true } },
                                },
                            },
                        },
                    },
                },
            }),
            prisma.pedido.count({ where }),
            prisma.pedido.aggregate({
                where,
                _sum: { totalImporte: true, totalUnidades: true, totalPacks: true },
                _count: true,
            }),
        ])

        return NextResponse.json({
            pedidos,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
            stats: {
                totalPedidos: stats._count,
                totalImporte: stats._sum.totalImporte || 0,
                totalUnidades: stats._sum.totalUnidades || 0,
                totalPacks: stats._sum.totalPacks || 0,
            },
        })
    } catch (error) {
        console.error('Error fetching pedidos:', error)
        return NextResponse.json({ error: 'Error al obtener pedidos' }, { status: 500 })
    }
}

// POST /api/pedidos
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { clienteId, fechaEntrega, detalles, medioPago, esRetiro } = body

        if (!clienteId || !fechaEntrega || !detalles?.length) {
            return NextResponse.json({ error: 'Cliente, fecha de entrega y al menos un producto son requeridos' }, { status: 400 })
        }

        let totalUnidades = 0
        let totalImporte = 0
        const detallesBrutos: any[] = []

        for (const det of detalles) {
            const presentacion = await prisma.presentacion.findUnique({
                where: { id: det.presentacionId },
                include: { producto: { select: { codigoInterno: true } } }
            })
            if (!presentacion) continue
            const precio = presentacion.precioVenta
            const cant = parseInt(det.cantidad)
            
            // Unidades físicas totales
            totalUnidades += cant * presentacion.cantidad 
            totalImporte += cant * precio
            
            // Guardamos para procesar packs después
            for (let i = 0; i < cant; i++) {
                detallesBrutos.push({
                    presentacionId: det.presentacionId,
                    cantidad: 1,
                    precioUnitario: precio,
                    unidadesFisicas: presentacion.cantidad,
                    codigo: presentacion.producto.codigoInterno.toUpperCase()
                })
            }
        }

        // Lógica de asignación de packs (similar al parser)
        let nextPackNro = 1;
        let currentMixedPackNro: number | null = null;
        let currentMixedPackUnits = 0;

        const detallesCreate = detallesBrutos.map(d => {
            let nroPack: number | undefined;
            const isClosed48 = d.unidadesFisicas === 48 && (d.codigo.includes("JYQ") || d.codigo.includes("CL") || d.codigo.includes("ES"));
            const isClosed24JYQ = d.unidadesFisicas === 24 && d.codigo.includes("JYQ");

            if (isClosed48 || isClosed24JYQ) {
                nroPack = nextPackNro++;
            } else if (d.unidadesFisicas % 8 === 0) {
                if (currentMixedPackNro && (currentMixedPackUnits + d.unidadesFisicas <= 48)) {
                    nroPack = currentMixedPackNro;
                    currentMixedPackUnits += d.unidadesFisicas;
                } else {
                    currentMixedPackNro = nextPackNro++;
                    currentMixedPackUnits = d.unidadesFisicas;
                    nroPack = currentMixedPackNro;
                }
                if (currentMixedPackUnits >= 48) {
                    currentMixedPackNro = null;
                    currentMixedPackUnits = 0;
                }
            }

            return {
                presentacionId: d.presentacionId,
                cantidad: 1,
                precioUnitario: d.precioUnitario,
                nroPack
            };
        });

        const uniquePacks = new Set(detallesCreate.map(d => d.nroPack).filter(n => n !== undefined));
        
        // CALCULO DE DESCUENTO POR EFECTIVO (Pack volume-based)
        let totalDescuento = 0;
        if ((medioPago || 'efectivo') === 'efectivo') {
            // Agrupamos unidades físicas por nroPack
            const packVolumes: Record<number, number> = {};
            detallesCreate.forEach(d => {
                if (d.nroPack !== undefined) {
                    const vol = detallesBrutos[0].unidadesFisicas; // Aproximación, pero mejor usar d.presentacionId
                    // Realmente necesitamos las unidades físicas de cada item en el pack
                }
            });
            
            // Re-calculamos volúmenes de forma precisa
            const packMap = new Map<number, number>();
            detallesCreate.forEach((d, idx) => {
                if (d.nroPack !== undefined) {
                    const vol = detallesBrutos[idx].unidadesFisicas;
                    packMap.set(d.nroPack, (packMap.get(d.nroPack) || 0) + vol);
                }
            });

            for (const [nPack, totalUnits] of packMap.entries()) {
                if (totalUnits >= 48) totalDescuento += 2000;
                else if (totalUnits >= 24) totalDescuento += 1000;
            }
        }

        const totalPacks = uniquePacks.size + detallesCreate.filter(d => d.nroPack === undefined).length;

        const pedido = await prisma.pedido.create({
            data: {
                clienteId,
                fechaPedido: new Date(),
                fechaEntrega: new Date(fechaEntrega),
                medioPago: medioPago || 'efectivo',
                esRetiro: !!esRetiro,
                totalUnidades,
                totalImporte: totalImporte - totalDescuento,
                totalPacks,
                detalles: { create: detallesCreate },
            },
            include: {
                cliente: { select: { id: true, nombreComercial: true } },
                detalles: {
                    include: {
                        presentacion: {
                            include: { producto: { select: { id: true, nombre: true, codigoInterno: true } } },
                        },
                    },
                },
            },
        })

        return NextResponse.json(pedido, { status: 201 })
    } catch (error) {
        console.error('Error creating pedido:', error)
        return NextResponse.json({ error: 'Error al crear pedido' }, { status: 500 })
    }
}
// DELETE /api/pedidos — Borrado masivo por IDs
export async function DELETE(request: Request) {
    try {
        const body = await request.json()
        const { ids } = body

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'Se requiere un array de IDs' }, { status: 400 })
        }

        // Ejecutar borrado en transacción para asegurar consistencia
        await prisma.$transaction([
            prisma.movimientoCaja.deleteMany({ where: { pedidoId: { in: ids } } }),
            prisma.entrega.deleteMany({ where: { pedidoId: { in: ids } } }),
            prisma.detallePedido.deleteMany({ where: { pedidoId: { in: ids } } }),
            prisma.pedido.deleteMany({ where: { id: { in: ids } } }),
        ])

        return NextResponse.json({ success: true, count: ids.length })
    } catch (error) {
        console.error('Error in bulk delete pedidos:', error)
        return NextResponse.json({ error: 'Error al eliminar pedidos de forma masiva' }, { status: 500 })
    }
}
