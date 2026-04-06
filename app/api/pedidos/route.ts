import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/pedidos
export async function GET() {
    try {
        const pedidos = await prisma.pedido.findMany({
            orderBy: { fechaPedido: 'desc' },
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
        })
        return NextResponse.json(pedidos)
    } catch (error) {
        console.error('Error fetching pedidos:', error)
        return NextResponse.json({ error: 'Error al obtener pedidos' }, { status: 500 })
    }
}

// POST /api/pedidos
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { clienteId, fechaEntrega, detalles, medioPago } = body

        if (!clienteId || !fechaEntrega || !detalles?.length) {
            return NextResponse.json({ error: 'Cliente, fecha de entrega y al menos un producto son requeridos' }, { status: 400 })
        }

        let totalUnidades = 0
        let totalImporte = 0
        const detallesBrutos = []

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
        const totalPacks = uniquePacks.size + detallesCreate.filter(d => d.nroPack === undefined).length;

        const pedido = await prisma.pedido.create({
            data: {
                clienteId,
                fechaPedido: new Date(),
                fechaEntrega: new Date(fechaEntrega),
                medioPago: medioPago || 'efectivo',
                totalUnidades,
                totalImporte,
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
