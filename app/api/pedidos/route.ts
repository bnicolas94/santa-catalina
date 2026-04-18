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
        const turno = searchParams.get('turno')
        const search = searchParams.get('search')

        // Construir filtros dinámicos
        const where: any = {}

        if (fechaDesde || fechaHasta) {
            where.fechaEntrega = {}
            if (fechaDesde) where.fechaEntrega.gte = new Date(fechaDesde + 'T00:00:00.000Z')
            if (fechaHasta) where.fechaEntrega.lte = new Date(fechaHasta + 'T23:59:59.999Z')
        }

        if (estado) where.estado = estado
        if (turno) where.turno = turno

        if (search) {
            where.cliente = {
                nombreComercial: { contains: search, mode: 'insensitive' }
            }
        }

        // Sorting dinámico
        const sortField = searchParams.get('sortField')
        const sortDir = (searchParams.get('sortDir') || 'asc') as 'asc' | 'desc'
        
        let orderBy: any = { fechaEntrega: 'desc' } // Default
        if (sortField === 'cliente') orderBy = { cliente: { nombreComercial: sortDir } }
        else if (sortField === 'fechaEntrega') orderBy = { fechaEntrega: sortDir }
        else if (sortField === 'totalUnidades') orderBy = { totalUnidades: sortDir }
        else if (sortField === 'totalImporte') orderBy = { totalImporte: sortDir }
        else if (sortField === 'turno') orderBy = { turno: sortDir }

        // Consultas en paralelo: pedidos paginados + total + stats
        const [pedidos, total, stats] = await Promise.all([
            prisma.pedido.findMany({
                where,
                orderBy,
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

        const todasPresentaciones = await prisma.presentacion.findMany({
            select: { id: true, precioVenta: true, cantidad: true, productoId: true }
        });
        const precioMap = new Map(todasPresentaciones.map(p => [p.id, p.precioVenta]));

        let totalUnidadesFisicas = 0;
        const detallesBrutos: any[] = [];

        for (const det of detalles) {
            const pActual = todasPresentaciones.find(p => p.id === det.presentacionId);
            if (!pActual) continue;
            
            const cantComprada = parseInt(det.cantidad);
            totalUnidadesFisicas += cantComprada * pActual.cantidad;
            
            for (let i = 0; i < cantComprada; i++) {
                detallesBrutos.push({
                    presentacionId: det.presentacionId,
                    productoId: pActual.productoId,
                    unidadesFisicas: pActual.cantidad,
                    precioBase: pActual.precioVenta,
                    observaciones: det.observaciones || null
                });
            }
        }

        // 2. Asignación de Packs (Lógica de agrupamiento)
        let nextPackNro = 1;
        let currentMixedPackNro: number | null = null;
        let currentMixedPackUnits = 0;

        const detallesConPack = detallesBrutos.map(d => {
            let nroPack: number | undefined;
            // Los x48 y x24 de JYQ suelen ser bultos cerrados
            const isClosed48 = d.unidadesFisicas === 48;
            
            if (isClosed48) {
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
            return { ...d, nroPack };
        });

        // 3. RECÁLCULO DE PRECIOS POR COMBO (Lógica espejo de la importación)
        const packStats = new Map<number, Map<string, number>>();
        detallesConPack.forEach(d => {
            if (d.nroPack) {
                if (!packStats.has(d.nroPack)) packStats.set(d.nroPack, new Map());
                const prodMap = packStats.get(d.nroPack)!;
                prodMap.set(d.productoId, (prodMap.get(d.productoId) || 0) + d.unidadesFisicas);
            }
        });

        // Agrupamos volúmenes totales por pack para el descuento de efectivo
        const totalUnitsByPack = new Map<number, number>();
        detallesConPack.forEach(d => {
            if (d.nroPack) {
                totalUnitsByPack.set(d.nroPack, (totalUnitsByPack.get(d.nroPack) || 0) + d.unidadesFisicas);
            }
        });

        let totalImporteBruto = 0;
        const detallesFinales = detallesConPack.map(d => {
            let precioFinal = d.precioBase;
            if (d.nroPack) {
                const totalProductoEnPack = packStats.get(d.nroPack)?.get(d.productoId) || 0;
                if (totalProductoEnPack > d.unidadesFisicas) {
                    const presEquivalent = todasPresentaciones.find(p => 
                        p.productoId === d.productoId && p.cantidad === totalProductoEnPack
                    );
                    if (presEquivalent) {
                        precioFinal = (presEquivalent.precioVenta / presEquivalent.cantidad) * d.unidadesFisicas;
                    }
                }
            }
            totalImporteBruto += precioFinal;
            return {
                presentacionId: d.presentacionId,
                cantidad: 1,
                precioUnitario: Math.round(precioFinal),
                nroPack: d.nroPack,
                observaciones: d.observaciones
            };
        });

        const uniquePacksCount = new Set(detallesFinales.map(d => d.nroPack).filter(n => n !== undefined)).size;
        const itemsSinPack = detallesFinales.filter(d => d.nroPack === undefined).length;
        const totalPacks = uniquePacksCount + itemsSinPack;

        // 4. CALCULO DE DESCUENTO POR EFECTIVO
        let totalDescuentoEfectivo = 0;
        if ((medioPago || 'efectivo') === 'efectivo') {
            for (const units of totalUnitsByPack.values()) {
                if (units >= 48) totalDescuentoEfectivo += 2000;
                else if (units >= 24) totalDescuentoEfectivo += 1000;
            }
        }

        const pedido = await prisma.pedido.create({
            data: {
                clienteId,
                fechaPedido: new Date(),
                fechaEntrega: new Date(fechaEntrega),
                medioPago: medioPago || 'efectivo',
                esRetiro: !!esRetiro,
                totalUnidades: totalUnidadesFisicas,
                totalImporte: Math.round(totalImporteBruto - totalDescuentoEfectivo),
                totalPacks,
                detalles: { 
                    create: detallesFinales.map(d => ({
                        presentacionId: d.presentacionId,
                        cantidad: d.cantidad,
                        precioUnitario: d.precioUnitario,
                        nroPack: d.nroPack,
                        observaciones: d.observaciones
                    }))
                },
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
